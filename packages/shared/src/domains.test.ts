import { describe, expect, it } from "vitest";
import { allowedDomainsSchema, isHostAllowed, normalizeDomain } from "./domains";

describe("normalizeDomain", () => {
  it("reduces addresses to a bare domain", () => {
    expect(normalizeDomain("https://www.SuitedReams.com/shop?x=1")).toBe("suitedreams.com");
    expect(normalizeDomain("  example.co.uk ")).toBe("example.co.uk");
    expect(normalizeDomain("shop.example.com:8080")).toBe("shop.example.com");
  });
  it("rejects anything that is not a domain", () => {
    for (const bad of ["", "localhost", "nodot", "192.168.1.1", "a b.com", "-x.com", "x..com", "https://", "javascript:alert(1)"]) {
      expect(normalizeDomain(bad)).toBeNull();
    }
  });
});

describe("allowedDomainsSchema", () => {
  it("normalizes, de-duplicates and caps the list", () => {
    expect(allowedDomainsSchema.parse(["https://www.a.com", "a.com", "b.com"])).toEqual(["a.com", "b.com"]);
    expect(allowedDomainsSchema.safeParse(["nope"]).success).toBe(false);
    expect(allowedDomainsSchema.safeParse(Array.from({ length: 11 }, (_, i) => `s${i}.com`)).success).toBe(false);
  });
});

describe("isHostAllowed", () => {
  it("allows everything for an empty list", () => {
    expect(isHostAllowed("x.com", [])).toBe(true);
    expect(isHostAllowed(null, [])).toBe(true);
  });
  it("matches the domain and its subdomains only", () => {
    const list = ["a.com"];
    expect(isHostAllowed("a.com", list)).toBe(true);
    expect(isHostAllowed("www.a.com", list)).toBe(true);
    expect(isHostAllowed("evil-a.com", list)).toBe(false);
    expect(isHostAllowed("a.com.evil.io", list)).toBe(false);
    expect(isHostAllowed(null, list)).toBe(false);
  });
  it("always allows local testing", () => {
    expect(isHostAllowed("localhost", ["a.com"])).toBe(true);
    expect(isHostAllowed("127.0.0.1", ["a.com"])).toBe(true);
  });
});
