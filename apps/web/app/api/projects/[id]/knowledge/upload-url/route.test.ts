import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (...a: unknown[]) => getAccountPlan(...a) }));
const getOwnedProject = vi.fn();
vi.mock("@/lib/owned-project", () => ({ getOwnedProject: (...a: unknown[]) => getOwnedProject(...a) }));
const rpc = vi.fn();
const createSignedUploadUrl = vi.fn();
const deleteEq = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc,
    storage: { from: () => ({ createSignedUploadUrl }) },
    from: () => ({ delete: () => ({ eq: deleteEq }) }),
  }),
}));

import { POST } from "./route";

const PROJECT = "0b1c2d3e-0000-4000-8000-000000000001";
const SOURCE = "0b1c2d3e-0000-4000-8000-0000000000aa";
const body = { title: "Guide", filename: "guide.pdf", size: 1000, type: "pdf" };
const call = (b: unknown) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(b) }), { params: Promise.resolve({ id: PROJECT }) });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
  getAccountPlan.mockResolvedValue("pro");
  getOwnedProject.mockResolvedValue({ id: PROJECT });
  rpc.mockResolvedValue({ data: { id: SOURCE }, error: null });
  createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: "https://s.example/upload?token=t" }, error: null });
});

describe("POST /api/projects/:id/knowledge/upload-url", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call(body)).status).toBe(401);
  });
  it("rejects a file over 10 MB, a bad type, and a name that does not match", async () => {
    expect((await call({ ...body, size: 11 * 1024 * 1024 })).status).toBe(400);
    expect((await call({ ...body, type: "exe" })).status).toBe(400);
    expect((await call({ ...body, filename: "guide.exe" })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns 404 for a project the user does not own", async () => {
    getOwnedProject.mockResolvedValue(null);
    expect((await call(body)).status).toBe(404);
  });
  it("returns 403 at the source limit", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001" } });
    expect((await call(body)).status).toBe(403);
  });
  it("reserves an uploading source under a key that has no filename and returns the signed URL", async () => {
    const res = await call(body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sourceId: SOURCE, uploadUrl: "https://s.example/upload?token=t" });
    const args = rpc.mock.calls[0]![1];
    expect(args).toMatchObject({ p_status: "uploading", p_type: "pdf", p_max_sources: 25 });
    expect(args.p_storage_key).toMatch(new RegExp(`^${PROJECT}/[0-9a-f-]{36}\\.pdf$`));
    expect(createSignedUploadUrl).toHaveBeenCalledWith(args.p_storage_key);
  });
  it("releases the reservation if the signed URL cannot be made", async () => {
    createSignedUploadUrl.mockResolvedValue({ data: null, error: { message: "x" } });
    expect((await call(body)).status).toBe(500);
    expect(deleteEq).toHaveBeenCalledWith("id", SOURCE);
  });
});
