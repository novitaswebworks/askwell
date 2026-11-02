import { describe, expect, it } from "vitest";
import nextConfig, { ALIAS_HOSTS } from "./next.config";

describe("security headers in nextConfig", () => {
  it("defines standard security headers and clickjacking protections", async () => {
    expect(nextConfig.headers).toBeDefined();
    const headers = await nextConfig.headers!();

    const globalHeaders = headers.find((h) => h.source === "/:path*");
    expect(globalHeaders).toBeDefined();
    expect(globalHeaders?.headers).toEqual(
      expect.arrayContaining([
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
      ]),
    );

    const embedHeaders = headers.find((h) => h.source === "/embed");
    expect(embedHeaders).toBeDefined();
    expect(embedHeaders?.headers).toContainEqual({
      key: "Content-Security-Policy",
      value: "frame-ancestors *",
    });

    const otherHeaders = headers.find((h) => h.source === "/((?!embed).*)");
    expect(otherHeaders).toBeDefined();
    expect(otherHeaders?.headers).toEqual(
      expect.arrayContaining([
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ]),
    );
  });
});

describe("alias host redirect", () => {
  it("sends the vercel.app alias to the public address and leaves other hosts alone", async () => {
    expect(nextConfig.redirects).toBeDefined();
    const redirects = await nextConfig.redirects!();
    if (!process.env.NEXT_PUBLIC_APP_URL) return expect(redirects).toEqual([]);
    expect(redirects).toHaveLength(ALIAS_HOSTS.length);
    for (const r of redirects) {
      expect(r.permanent).toBe(true);
      expect(r.has).toEqual([{ type: "host", value: expect.stringMatching(/\.vercel\.app$/) }]);
      expect(r.destination).toMatch(/^https?:\/\/.+\/:path\*$/);
    }
    // Preview deployments have their own hosts and must never be redirected.
    expect(ALIAS_HOSTS.every((h) => !h.includes("-git-") && !h.includes("projects"))).toBe(true);
  });
});
