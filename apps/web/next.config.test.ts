import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

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
