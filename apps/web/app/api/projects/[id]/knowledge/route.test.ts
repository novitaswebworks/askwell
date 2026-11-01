import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (...a: unknown[]) => getAccountPlan(...a) }));
const getOwnedProject = vi.fn();
vi.mock("@/lib/owned-project", () => ({ getOwnedProject: (...a: unknown[]) => getOwnedProject(...a) }));
const rpc = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc }) }));
const processSource = vi.fn();
vi.mock("@/lib/knowledge/process", () => ({ processSource: (...a: unknown[]) => processSource(...a) }));

import { POST } from "./route";

const PROJECT = "0b1c2d3e-0000-4000-8000-000000000001";
const reserved = {
  id: "0b1c2d3e-0000-4000-8000-0000000000aa",
  title: "Refunds",
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
  processSource.mockResolvedValue(undefined);
});

describe("POST /api/projects/:id/knowledge", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call({ title: "a", text: "b" })).status).toBe(401);
  });
  it("returns 400 for invalid input", async () => {
    expect((await call({ title: "", text: "b" })).status).toBe(400);
  });
  it("returns 404 for a project the user does not own", async () => {
    getOwnedProject.mockResolvedValue(null);
    expect((await call({ title: "a", text: "b" })).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns 403 limit_reached at the plan limit, with the Free limit passed from the plan", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001" } });
    const res = await call({ title: "a", text: "b" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("limit_reached");
    expect(rpc).toHaveBeenCalledWith("reserve_knowledge_source", expect.objectContaining({ p_max_sources: 3 }));
  });
  it("reserves, processes, and returns the ready source", async () => {
    const res = await call({ title: "Refunds", text: "Refunds take 5 days." });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: reserved.id,
      title: "Refunds",
      type: "text",
      status: "ready",
      createdAt: reserved.created_at,
    });
    expect(processSource).toHaveBeenCalledWith({ id: reserved.id, projectId: PROJECT }, "Refunds take 5 days.", expect.anything());
  });
  it("returns a friendly error when processing fails", async () => {
    const err = new Error("x");
    err.name = "AiUnavailableError";
    processSource.mockRejectedValue(err);
    const res = await call({ title: "a", text: "b" });
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toMatch(/AI service/);
  });
});
