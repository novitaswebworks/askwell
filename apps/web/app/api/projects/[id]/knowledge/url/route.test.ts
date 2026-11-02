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
const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc, from }) }));
const processSource = vi.fn();
vi.mock("@/lib/knowledge/process", () => ({ processSource: (...a: unknown[]) => processSource(...a) }));
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
const reserved = {
  id: "0b1c2d3e-0000-4000-8000-0000000000aa",
  title: "Website: acme.com",
  type: "text",
  status: "processing",
  created_at: "2026-11-01T00:00:00Z",
};
const call = (body: unknown, id = PROJECT) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
  getAccountPlan.mockResolvedValue("free");
  getOwnedProject.mockResolvedValue({ id: PROJECT });
  rpc.mockResolvedValue({ data: reserved, error: null });
  from.mockImplementation(() => queryResult({ data: null }));
  crawlSite.mockResolvedValue({ text: "# Home\nhello", pages: 3, skipped: 1 });
  processSource.mockResolvedValue(undefined);
});

describe("POST /api/projects/:id/knowledge/url", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call({ url: "https://acme.com" })).status).toBe(401);
  });
  it("rejects addresses it must never visit, before touching the database", async () => {
    for (const url of ["", "ftp://acme.com", "http://127.0.0.1", "http://169.254.169.254/", "http://localhost:3000", "https://user:pw@acme.com"]) {
      const res = await call({ url });
      expect(res.status, url).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(crawlSite).not.toHaveBeenCalled();
  });
  it("returns 404 for a project the user does not own", async () => {
    getOwnedProject.mockResolvedValue(null);
    expect((await call({ url: "https://acme.com" })).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns 403 at the source limit, without reading the site", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001" } });
    expect((await call({ url: "https://acme.com" })).status).toBe(403);
    expect(crawlSite).not.toHaveBeenCalled();
  });
  it("reads the site as one source and reports the page count", async () => {
    const res = await call({ url: "acme.com" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ title: "Website: acme.com (3 pages)", status: "ready", type: "text" });
    expect(rpc).toHaveBeenCalledWith("reserve_knowledge_source", expect.objectContaining({ p_title: "Website: acme.com", p_max_sources: 3 }));
    expect(crawlSite.mock.calls[0][0].toString()).toBe("https://acme.com/");
    expect(crawlSite.mock.calls[0][2]).toMatchObject({ maxPages: 10 });
    expect(processSource).toHaveBeenCalledWith({ id: reserved.id, projectId: PROJECT }, "# Home\nhello", expect.anything());
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ source_type: "website", pages: 3 }) }));
  });
  it("gives Pro a bigger crawl", async () => {
    getAccountPlan.mockResolvedValue("pro");
    await call({ url: "https://acme.com" });
    expect(crawlSite.mock.calls[0][2]).toMatchObject({ maxPages: 40 });
  });
  it("drops the placeholder and explains when the site cannot be read", async () => {
    const cases: [Error, number, RegExp][] = [
      [new RobotsBlockedError(), 400, /robots/i],
      [new BlockedAddressError(), 400, /can't be read/],
      [new NoReadablePagesError(), 400, /couldn't read/],
      [new Error("boom"), 500, /reach that website/],
    ];
    for (const [error, status, message] of cases) {
      from.mockClear();
      crawlSite.mockRejectedValueOnce(error);
      const res = await call({ url: "https://acme.com" });
      expect(res.status).toBe(status);
      expect((await res.json()).error.message).toMatch(message);
      expect(from).toHaveBeenCalledWith("knowledge_sources"); // the placeholder row is deleted
      expect(processSource).not.toHaveBeenCalled();
    }
  });
  it("returns a friendly error when indexing fails", async () => {
    const err = new Error("x");
    err.name = "AiUnavailableError";
    processSource.mockRejectedValue(err);
    const res = await call({ url: "https://acme.com" });
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toMatch(/not responding/);
  });
});
