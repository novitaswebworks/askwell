import { describe, expect, it, vi } from "vitest";
import { VISITOR_ID_KEY, getVisitorId, mockReply, parseParentOrigin } from "./embed";

describe("parseParentOrigin", () => {
  it("returns the origin of an http(s) URL", () => {
    expect(parseParentOrigin("https://shop.example/page?x=1")).toBe("https://shop.example");
    expect(parseParentOrigin("http://localhost:8000")).toBe("http://localhost:8000");
  });
  it("rejects missing, malformed and non-http values", () => {
    for (const bad of [null, "", "not a url", "javascript:alert(1)", "*", "data:text/html,x"]) {
      expect(parseParentOrigin(bad)).toBeNull();
    }
  });
});

describe("getVisitorId", () => {
  it("creates an ID once and reuses it", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const first = getVisitorId(storage);
    expect(first.length).toBeGreaterThanOrEqual(8);
    expect(store.get(VISITOR_ID_KEY)).toBe(first);
    expect(getVisitorId(storage)).toBe(first);
  });
  it("still returns an ID when storage throws", () => {
    const storage = { getItem: vi.fn(() => { throw new Error("blocked"); }), setItem: vi.fn() };
    expect(getVisitorId(storage).length).toBeGreaterThanOrEqual(8);
    expect(getVisitorId(null).length).toBeGreaterThanOrEqual(8);
  });
});

describe("mockReply", () => {
  it("cycles through canned replies", () => {
    expect(mockReply(0)).toBe(mockReply(3));
    expect(mockReply(0)).not.toBe(mockReply(1));
  });
});
