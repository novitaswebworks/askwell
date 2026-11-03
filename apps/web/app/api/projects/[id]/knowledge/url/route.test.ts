import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (...a: unknown[]) => getAccountPlan(...a) }));
const getOwnedProject = vi.fn();
vi.mock("@/lib/owned-project", () => ({ getOwnedProject: (...a: unknown[]) => getOwnedProject(...a) }));
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...a: unknown[]) => track(...a) }));
const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from, rpc }) }));
const crawlSite = vi.fn();
vi.mock("@/lib/knowledge/crawl", async (orig) => ({
  ...(await orig<typeof import("@/lib/knowledge/crawl")>()),
  crawlSite: (...a: unknown[]) => crawlSite(...a),
}));
vi.mock("@/lib/knowledge/safe-fetch", () => ({ fetchPublic: vi.fn() }));

import { BlockedAddressError } from "@/lib/knowledge/net-safety";
import { NoReadablePagesError, RobotsBlockedError } from "@/lib/knowledge/crawl";
import { POST } from "./route";

const PROJECT = "0b1c2d3e-0000-4000-8000-000000000001";
const call = (body: unknown, id = PROJECT) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
  getAccountPlan.mockResolvedValue("free");
  getOwnedProject.mockResolvedValue({ id: PROJECT });
  from.mockImplementation(() => queryResult({ data: null }));
  crawlSite.mockResolvedValue({ text: "# Home\nhello", pages: 3, skipped: 1, sparse: false });
});

describe("POST /api/projects/:id/knowledge/url (preview)", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call({ url: "https://acme.com" })).status).toBe(401);
  });
  it("rejects addresses it must never visit, before reading anything", async () => {
    for (const url of ["", "ftp://acme.com", "http://127.0.0.1", "http://169.254.169.254/", "http://localhost:3000", "https://user:pw@acme.com"]) {
      expect((await call({ url })).status, url).toBe(400);
    }
    expect(crawlSite).not.toHaveBeenCalled();
  });
  it("returns 404 for a project the user does not own", async () => {
    getOwnedProject.mockResolvedValue(null);
    expect((await call({ url: "https://acme.com" })).status).toBe(404);
    expect(crawlSite).not.toHaveBeenCalled();
  });
  it("returns 403 without reading the site when the project is already at its source limit", async () => {
    from.mockImplementation(() => queryResult({ data: null, count: 3 } as never));
    const res = await call({ url: "https://acme.com" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("limit_reached");
    expect(crawlSite).not.toHaveBeenCalled();
  });
  it("returns the text for review and saves nothing", async () => {
    const res = await call({ url: "acme.com" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: "Website: acme.com (3 pages)", text: "# Home\nhello", pages: 3, skipped: 1, sparse: false });
    expect(crawlSite.mock.calls[0][0].toString()).toBe("https://acme.com/");
    expect(crawlSite.mock.calls[0][2]).toMatchObject({ maxPages: 10 });
    expect(rpc).not.toHaveBeenCalled(); // no source is reserved, nothing is indexed
    expect(from).toHaveBeenCalledTimes(1); // only the limit check reads the table
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ event: "website_previewed" }));
  });
  it("passes on that very little text was found", async () => {
    crawlSite.mockResolvedValue({ text: "# Home\nhi", pages: 1, skipped: 0, sparse: true });
    expect((await (await call({ url: "acme.com" })).json()).sparse).toBe(true);
  });
  it("gives Pro a bigger crawl", async () => {
    getAccountPlan.mockResolvedValue("pro");
    await call({ url: "https://acme.com" });
    expect(crawlSite.mock.calls[0][2]).toMatchObject({ maxPages: 40 });
  });
  it("explains when the site cannot be read", async () => {
    const cases: [Error, number, RegExp][] = [
      [new RobotsBlockedError(), 400, /robots/i],
      [new BlockedAddressError(), 400, /can't be read/],
      [new NoReadablePagesError(), 400, /couldn't read/],
      [new Error("boom"), 500, /reach that website/],
    ];
    for (const [error, status, message] of cases) {
      crawlSite.mockRejectedValueOnce(error);
      const res = await call({ url: "https://acme.com" });
      expect(res.status).toBe(status);
      expect((await res.json()).error.message).toMatch(message);
    }
  });
});
