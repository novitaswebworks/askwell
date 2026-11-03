import { afterEach, describe, expect, it } from "vitest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { FALLBACK_SITE_URL, HOME_DESCRIPTION, HOME_TITLE, PRIVATE_PATHS, siteUrl } from "./site";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("siteUrl", () => {
  it("uses NEXT_PUBLIC_APP_URL without a trailing slash, else the public address", () => {
    expect(siteUrl({ NEXT_PUBLIC_APP_URL: "https://example.com/" })).toBe("https://example.com");
    expect(siteUrl({ NEXT_PUBLIC_APP_URL: "  " })).toBe(FALLBACK_SITE_URL);
    expect(siteUrl({})).toBe(FALLBACK_SITE_URL);
  });
});

describe("search snippet", () => {
  it("has a title of 50 to 60 characters and a description of 140 to 160", () => {
    expect(HOME_TITLE.length).toBeGreaterThanOrEqual(50);
    expect(HOME_TITLE.length).toBeLessThanOrEqual(60);
    expect(HOME_DESCRIPTION.length).toBeGreaterThanOrEqual(140);
    expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });
});

describe("robots.txt", () => {
  it("allows the site, keeps the app, API and chat panel out, and points to the sitemap", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://askwell.example";
    const r = robots();
    expect(r.rules).toEqual({ userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] });
    expect(PRIVATE_PATHS).toEqual(expect.arrayContaining(["/dashboard", "/api/", "/embed"]));
    expect(r.sitemap).toBe("https://askwell.example/sitemap.xml");
  });
});

describe("sitemap.xml", () => {
  it("lists the home page and the policy pages on the public address", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://askwell.example";
    expect(sitemap().map((e) => e.url)).toEqual([
      "https://askwell.example",
      "https://askwell.example/terms",
      "https://askwell.example/privacy",
      "https://askwell.example/refunds",
      "https://askwell.example/contact",
    ]);
  });
});
