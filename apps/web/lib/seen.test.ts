import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const after = vi.fn();
vi.mock("next/server", () => ({ after: (fn: () => void) => after(fn) }));

import { hostFromHeaders, recordSeen, SEEN_REFRESH_MS, shouldRecordSeen } from "./seen";

const headers = (h: Record<string, string>) => new Headers(h);

describe("hostFromHeaders", () => {
  it("reads the host from Origin, lower-cased, without port or path", () => {
    expect(hostFromHeaders(headers({ origin: "https://Shop.Example.com:8443" }))).toBe("shop.example.com");
    expect(hostFromHeaders(headers({ referer: "https://www.example.com/pricing?a=1" }))).toBe("www.example.com");
  });
  it("prefers Origin, and falls back to Referer when Origin is missing or opaque", () => {
    expect(hostFromHeaders(headers({ origin: "https://a.example", referer: "https://b.example/" }))).toBe("a.example");
    expect(hostFromHeaders(headers({ origin: "null", referer: "https://b.example/x" }))).toBe("b.example");
  });
  it("accepts localhost for local testing", () => {
    expect(hostFromHeaders(headers({ origin: "http://localhost:3000" }))).toBe("localhost");
  });
  it("returns null for nothing, junk, other schemes, or addresses that are not host names", () => {
    expect(hostFromHeaders(headers({}))).toBeNull();
    expect(hostFromHeaders(headers({ origin: "not a url" }))).toBeNull();
    expect(hostFromHeaders(headers({ origin: "file:///Users/me/index.html" }))).toBeNull();
    expect(hostFromHeaders(headers({ origin: "https://exa mple.com" }))).toBeNull();
    expect(hostFromHeaders(headers({ origin: "https://" + "a".repeat(260) + ".com" }))).toBeNull();
  });
});

describe("shouldRecordSeen", () => {
  const now = Date.parse("2026-11-02T10:00:00Z");
  it("records the first sighting and a change of site", () => {
    expect(shouldRecordSeen({ at: null, host: null }, "a.example", now)).toBe(true);
    expect(shouldRecordSeen({ at: "2026-11-02T09:59:00Z", host: "a.example" }, "b.example", now)).toBe(true);
  });
  it("skips a recent sighting of the same site, and refreshes an old one", () => {
    expect(shouldRecordSeen({ at: "2026-11-02T09:55:00Z", host: "a.example" }, "a.example", now)).toBe(false);
    expect(shouldRecordSeen({ at: new Date(now - SEEN_REFRESH_MS - 1000).toISOString(), host: "a.example" }, "a.example", now)).toBe(true);
  });
  it("never records without a host, and survives a bad stored date", () => {
    expect(shouldRecordSeen({ at: null, host: null }, null, now)).toBe(false);
    expect(shouldRecordSeen({ at: "garbage", host: "a.example" }, "a.example", now)).toBe(true);
  });
});

describe("recordSeen", () => {
  const update = vi.fn();
  const eq = vi.fn();
  const client = { from: vi.fn(() => ({ update })) };
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockReturnValue({ eq });
    eq.mockResolvedValue({ error: null });
  });

  it("writes the time and host after the response", async () => {
    recordSeen(client, "p1", "a.example", Date.parse("2026-11-02T10:00:00Z"));
    expect(update).not.toHaveBeenCalled(); // not before the response
    await after.mock.calls[0]![0]();
    expect(client.from).toHaveBeenCalledWith("widget_configs");
    expect(update).toHaveBeenCalledWith({ last_seen_at: "2026-11-02T10:00:00.000Z", last_seen_host: "a.example" });
    expect(eq).toHaveBeenCalledWith("project_id", "p1");
  });
  it("still writes when there is no request to run it after", async () => {
    after.mockImplementationOnce(() => {
      throw new Error("outside a request");
    });
    recordSeen(client, "p1", "a.example");
    await vi.waitFor(() => expect(update).toHaveBeenCalled());
  });
  it("never throws, even when the database does", async () => {
    eq.mockRejectedValue(new Error("down"));
    recordSeen(client, "p1", "a.example");
    await expect(after.mock.calls[0]![0]()).resolves.toBeUndefined();
  });
});
