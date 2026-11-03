import { describe, expect, it } from "vitest";
import { crawlLimitsFor, crawlSite, SPARSE_TEXT_CHARS, NoReadablePagesError, RobotsBlockedError, type PageFetcher } from "./crawl";

const long = (s: string) => `${s} `.repeat(30);
const html = (title: string, body: string, links: string[] = []) =>
  `<html><head><title>${title}</title></head><body><nav>${links.map((l) => `<a href="${l}">l</a>`).join("")}</nav><main><p>${body}</p></main></body></html>`;

// A pretend website: path -> response.
function site(pages: Record<string, { status?: number; type?: string; body: string }>) {
  const asked: string[] = [];
  const fetcher: PageFetcher = async (url) => {
    asked.push(url.pathname);
    const page = pages[url.pathname];
    if (!page) return { url, status: 404, wrongType: false, body: "" };
    return { url, status: page.status ?? 200, wrongType: page.type === "other", body: page.body };
  };
  return { fetcher, asked };
}
const opts = { maxPages: 10, maxChars: 50_000, deadlineAt: Date.now() + 60_000, delayMs: 0 };
const start = new URL("https://acme.com/");

describe("crawlSite", () => {
  it("reads the start page and the pages it links to on the same site, once each", async () => {
    const { fetcher, asked } = site({
      "/": { body: html("Home", long("welcome home"), ["/about", "/about/", "https://acme.com/pricing", "https://other.example/x", "/logo.png"]) },
      "/about": { body: html("About", long("about us"), ["/"]) },
      "/pricing": { body: html("Pricing", long("price list")) },
    });
    const out = await crawlSite(start, fetcher, opts);
    expect(out.pages).toBe(3);
    expect(out.text).toContain("# Home");
    expect(out.text).toContain("Source: https://acme.com/about");
    expect(asked.filter((p) => p === "/about")).toHaveLength(1);
    expect(asked).not.toContain("/x");
    expect(asked).not.toContain("/logo.png");
  });
  it("treats www and the bare domain as the same site", async () => {
    const { fetcher } = site({
      "/": { body: html("Home", long("hello"), ["https://www.acme.com/team"]) },
      "/team": { body: html("Team", long("the team")) },
    });
    expect((await crawlSite(start, fetcher, opts)).pages).toBe(2);
  });
  it("uses the sitemap to find pages the menu does not link to", async () => {
    const { fetcher } = site({
      "/": { body: html("Home", long("hello")) },
      "/sitemap.xml": { body: "<urlset><url><loc>https://acme.com/hidden</loc></url></urlset>" },
      "/hidden": { body: html("Hidden", long("secret page")) },
    });
    const out = await crawlSite(start, fetcher, opts);
    expect(out.text).toContain("# Hidden");
  });
  it("obeys robots.txt for pages and refuses a start page it forbids", async () => {
    const robots = { body: "User-agent: *\nDisallow: /private" };
    const ok = site({
      "/robots.txt": robots,
      "/": { body: html("Home", long("hello"), ["/private/a", "/open"]) },
      "/private/a": { body: html("Private", long("no")) },
      "/open": { body: html("Open", long("yes")) },
    });
    const out = await crawlSite(start, ok.fetcher, opts);
    expect(ok.asked).not.toContain("/private/a");
    expect(out.text).toContain("# Open");
    const blocked = site({ "/robots.txt": { body: "User-agent: *\nDisallow: /" }, "/": { body: html("Home", long("x")) } });
    await expect(crawlSite(start, blocked.fetcher, opts)).rejects.toBeInstanceOf(RobotsBlockedError);
  });
  it("stops at the page limit and the size limit", async () => {
    const pages: Record<string, { body: string }> = { "/": { body: html("Home", long("home"), ["/1", "/2", "/3", "/4"]) } };
    for (const n of [1, 2, 3, 4]) pages[`/${n}`] = { body: html(`P${n}`, long(`page ${n}`)) };
    const { fetcher } = site(pages);
    expect((await crawlSite(start, fetcher, { ...opts, maxPages: 2 })).pages).toBe(2);
    const small = await crawlSite(start, fetcher, { ...opts, maxChars: 1500 });
    expect(small.text.length).toBeLessThanOrEqual(1500);
  });
  it("stops starting pages once the deadline has passed", async () => {
    const { fetcher } = site({ "/": { body: html("Home", long("hello"), ["/a"]) }, "/a": { body: html("A", long("a page")) } });
    let t = 0;
    const out = await crawlSite(start, fetcher, { ...opts, deadlineAt: 1, now: () => (t++ === 0 ? 0 : 2) });
    expect(out.pages).toBe(1);
  });
  it("skips failed, wrong-type and nearly empty pages, and throws when nothing is readable", async () => {
    const { fetcher } = site({
      "/": { body: html("Home", long("hello"), ["/gone", "/pdf", "/thin"]) },
      "/pdf": { type: "other", body: "%PDF" },
      "/thin": { body: html("Thin", "hi") },
    });
    const out = await crawlSite(start, fetcher, opts);
    expect(out.pages).toBe(1);
    expect(out.skipped).toBe(3);
    const empty = site({ "/": { status: 500, body: "" } });
    await expect(crawlSite(start, empty.fetcher, opts)).rejects.toBeInstanceOf(NoReadablePagesError);
    await expect(crawlSite(start, async () => null, opts)).rejects.toBeInstanceOf(NoReadablePagesError);
  });
  it("does not follow links to other sites or private addresses", async () => {
    const { fetcher, asked } = site({
      "/": { body: html("Home", long("hello"), ["http://169.254.169.254/latest", "http://localhost/admin", "https://evil.example/"]) },
    });
    await crawlSite(start, fetcher, opts);
    expect(asked.filter((p) => p !== "/" && p !== "/robots.txt" && p !== "/sitemap.xml")).toEqual([]);
  });
});

describe("crawl hygiene", () => {
  it("queues a link repeated on every page once, so it cannot crowd out later pages", async () => {
    // 600 links to /same, then one real, different page.
    const links = [...Array.from({ length: 600 }, () => "/same"), "/real"];
    const { fetcher, asked } = site({
      "/": { body: html("Home", long("hello"), links) },
      "/same": { body: html("Same", long("same page")) },
      "/real": { body: html("Real", long("a different page")) },
    });
    const out = await crawlSite(start, fetcher, opts);
    expect(out.text).toContain("# Real");
    expect(asked.filter((p) => p === "/same")).toHaveLength(1);
  });
  it("does not read the start page twice when it has a query and pages link back without one", async () => {
    const { fetcher, asked } = site({ "/shop": { body: html("Shop", long("shop"), ["/shop", "/shop?page=1"]) } });
    await crawlSite(new URL("https://acme.com/shop?ref=ad"), fetcher, opts);
    expect(asked.filter((p) => p === "/shop")).toHaveLength(1);
  });
  it("applies robots.txt to the page a request ended up on after a redirect", async () => {
    const asked: string[] = [];
    const fetcher: PageFetcher = async (url, kind) => {
      asked.push(url.pathname);
      if (kind === "robots") return { url, status: 200, wrongType: false, body: "User-agent: *\nDisallow: /private" };
      if (kind === "sitemap") return null;
      if (url.pathname === "/") return { url, status: 200, wrongType: false, body: html("Home", long("hello"), ["/moved"]) };
      // /moved redirects to a path robots.txt forbids
      return { url: new URL("https://acme.com/private/secret"), status: 200, wrongType: false, body: html("Secret", long("not for crawlers")) };
    };
    const out = await crawlSite(start, fetcher, opts);
    expect(out.text).not.toContain("not for crawlers");
    expect(out.pages).toBe(1);
  });
});

describe("sparse results", () => {
  it("flags a site that gave very little text, but not a normal one", async () => {
    const thin = site({ "/": { body: html("Home", `${"short page text here ".repeat(6)}`) } });
    expect((await crawlSite(start, thin.fetcher, opts)).sparse).toBe(true);
    const rich = site({ "/": { body: html("Home", "plenty of real content here. ".repeat(80)) } });
    const out = await crawlSite(start, rich.fetcher, opts);
    expect(out.text.length).toBeGreaterThanOrEqual(SPARSE_TEXT_CHARS);
    expect(out.sparse).toBe(false);
  });
});

describe("crawlLimitsFor", () => {
  it("gives Pro more room than Free", () => {
    expect(crawlLimitsFor("pro").maxPages).toBeGreaterThan(crawlLimitsFor("free").maxPages);
    expect(crawlLimitsFor("pro").maxChars).toBeGreaterThan(crawlLimitsFor("free").maxChars);
  });
});
