import { describe, expect, it } from "vitest";
import { extractPage, parseSitemap } from "./html";

const PAGE = `<!doctype html><html><head><title> Pricing | Acme </title><style>.x{}</style><script>var a=1</script></head>
<body><header><nav><a href="/about">About</a><a href="/pricing">Pricing</a></nav></header>
<main><h1>Pricing</h1><p>Plans start at <b>$10</b> a month.</p><ul><li>Free trial</li><li>Cancel anytime</li></ul>
<a href="mailto:hi@acme.com">mail</a><a href="https://other.example/x">out</a><a href="#top">top</a><a href="/contact?x=1#y">contact</a>
<script>alert(1)</script></main><footer>Copyright Acme</footer></body></html>`;

describe("extractPage", () => {
  const page = extractPage(PAGE, "https://acme.com/pricing");
  it("takes the title and the main text, with headings and list items", () => {
    expect(page.title).toBe("Pricing | Acme");
    expect(page.text).toContain("# Pricing");
    expect(page.text).toContain("Plans start at $10 a month.");
    expect(page.text).toContain("- Free trial");
    expect(page.text).toContain("- Cancel anytime");
  });
  it("leaves out scripts, styles, menus and footers", () => {
    expect(page.text).not.toMatch(/alert|var a|Copyright|About/);
  });
  it("collects links from the whole page, resolved, without mail or fragment links", () => {
    expect(page.links).toContain("https://acme.com/about");
    expect(page.links).toContain("https://acme.com/contact?x=1#y");
    expect(page.links).toContain("https://other.example/x");
    expect(page.links.some((l) => l.startsWith("mailto:") || l.endsWith("#top"))).toBe(false);
  });
  it("keeps neighbouring links apart", () => {
    expect(extractPage('<main><a href="/a">Plan my trip</a><a href="/b">What we do</a></main>', "https://a.com/").text).toBe("Plan my trip What we do");
  });
  it("copes with an empty or broken page", () => {
    expect(extractPage("", "https://a.com/").text).toBe("");
    expect(extractPage("<p>unclosed <b>x", "https://a.com/").text).toContain("unclosed x");
  });
});

describe("parseSitemap", () => {
  it("lists page addresses and decodes ampersands", () => {
    const xml = "<urlset><url><loc>https://a.com/x</loc></url><url><loc> https://a.com/y?a=1&amp;b=2 </loc></url></urlset>";
    expect(parseSitemap(xml)).toEqual(["https://a.com/x", "https://a.com/y?a=1&b=2"]);
  });
  it("stops at the limit", () => {
    const xml = Array.from({ length: 10 }, (_, i) => `<loc>https://a.com/${i}</loc>`).join("");
    expect(parseSitemap(xml, 3)).toHaveLength(3);
  });
});
