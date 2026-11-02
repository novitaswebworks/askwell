import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (...a: unknown[]) => getAccountPlan(...a) }));
const getOwnedProject = vi.fn();
vi.mock("@/lib/owned-project", () => ({ getOwnedProject: (...a: unknown[]) => getOwnedProject(...a) }));
const processSource = vi.fn();
vi.mock("@/lib/knowledge/process", () => ({ processSource: (...a: unknown[]) => processSource(...a) }));
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...a: unknown[]) => track(...a) }));

// A tiny stand-in for the service client that records what the route does.
const state = {
  existing: null as { id: string } | null,
  updated: null as Record<string, unknown> | null,
  chunksDeleted: [] as string[],
  sourcesDeleted: [] as string[],
  reserveError: null as { code: string } | null,
  saveError: null as unknown,
};
const reserved = {
  id: "0b1c2d3e-0000-4000-8000-0000000000aa",
  title: "Business answers",
  type: "text",
  status: "processing",
  created_at: "2026-11-02T00:00:00Z",
  project_id: "p",
};
const rpc = vi.fn(async () => (state.reserveError ? { data: null, error: state.reserveError } : { data: reserved, error: null }));
function from(table: string) {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.not = () => q;
  q.eq = () => q;
  q.limit = () => q;
  q.maybeSingle = async () => ({ data: state.existing, error: null });
  q.single = async () => ({ data: { ...reserved, id: state.existing?.id ?? reserved.id }, error: null });
  q.update = (v: Record<string, unknown>) => {
    state.updated = v;
    return { eq: () => Object.assign(Promise.resolve({ error: state.saveError }), { select: () => q }) };
  };
  q.delete = () => ({
    eq: async (_c: string, id: string) => {
      (table === "knowledge_chunks" ? state.chunksDeleted : state.sourcesDeleted).push(id);
      return { error: null };
    },
  });
  return q;
}
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from, rpc }) }));

import { PUT } from "./route";

const PROJECT = "0b1c2d3e-0000-4000-8000-000000000001";
const body = { template: "shop", items: [{ question: "Hours?", answer: "9 to 5" }] };
const call = (b: unknown, id = PROJECT) =>
  PUT(new Request("http://x", { method: "PUT", body: JSON.stringify(b) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, { existing: null, updated: null, chunksDeleted: [], sourcesDeleted: [], reserveError: null, saveError: null });
  auth.mockResolvedValue({ userId: "user_1" });
  getAccountPlan.mockResolvedValue("free");
  getOwnedProject.mockResolvedValue({ id: PROJECT });
  processSource.mockResolvedValue(undefined);
});

describe("PUT /api/projects/:id/answers", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call(body)).status).toBe(401);
  });
  it("returns 404 for a bad id and for a project the user does not own", async () => {
    expect((await call(body, "nope")).status).toBe(404);
    getOwnedProject.mockResolvedValue(null);
    expect((await call(body)).status).toBe(404);
    expect(processSource).not.toHaveBeenCalled();
  });
  it("returns 400 for no answers or an over-long answer", async () => {
    expect((await call({ template: "shop", items: [] })).status).toBe(400);
    expect((await call({ template: "shop", items: [{ question: "q", answer: "a".repeat(2001) }] })).status).toBe(400);
  });
  it("creates the Business answers source once, indexes the text, and returns it ready", async () => {
    const res = await call(body);
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Business answers");
    expect(rpc).toHaveBeenCalledWith("reserve_knowledge_source", expect.objectContaining({ p_title: "Business answers", p_max_sources: 3 }));
    expect(state.updated).toEqual({ answers: body });
    expect(processSource).toHaveBeenCalledWith(expect.objectContaining({ projectId: PROJECT }), "Question: Hours?\nAnswer: 9 to 5", expect.anything());
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ event: "answers_saved" }));
  });
  it("replaces the existing source instead of using another slot", async () => {
    state.existing = { id: "0b1c2d3e-0000-4000-8000-0000000000bb" };
    const res = await call(body);
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(state.chunksDeleted).toEqual([state.existing.id]);
    expect(state.updated).toEqual({ status: "processing", answers: body });
  });
  it("returns 403 limit_reached when the plan has no free slot", async () => {
    state.reserveError = { code: "P0001" };
    const res = await call(body);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("limit_reached");
  });
  it("removes the new source if its answers could not be stored", async () => {
    state.saveError = { message: "boom" };
    expect((await call(body)).status).toBe(500);
    expect(state.sourcesDeleted).toEqual([reserved.id]);
    expect(processSource).not.toHaveBeenCalled();
  });
  it("returns 500 when indexing fails", async () => {
    processSource.mockRejectedValue(new Error("embed down"));
    expect((await call(body)).status).toBe(500);
  });
});
