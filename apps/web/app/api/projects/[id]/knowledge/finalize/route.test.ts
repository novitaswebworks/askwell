import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const getOwnedProject = vi.fn();
vi.mock("@/lib/owned-project", () => ({ getOwnedProject: (...a: unknown[]) => getOwnedProject(...a) }));
const processSource = vi.fn();
vi.mock("@/lib/knowledge/process", () => ({ processSource: (...a: unknown[]) => processSource(...a) }));

const claim = vi.fn();
const download = vi.fn();
const remove = vi.fn().mockResolvedValue({ error: null });
const deleteEq = vi.fn().mockResolvedValue({ error: null });
const revertEq = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    storage: { from: () => ({ download, remove }) },
    from: () => ({
      update: (arg: { status: string }) =>
        arg.status === "processing"
          ? { eq: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: claim }) }) }) }) }
          : { eq: revertEq },
      delete: () => ({ eq: deleteEq }),
    }),
  }),
}));

import { POST } from "./route";

const PROJECT = "0b1c2d3e-0000-4000-8000-000000000001";
const SOURCE = "0b1c2d3e-0000-4000-8000-0000000000aa";
const row = (type: string) => ({
  id: SOURCE,
  title: "Guide",
  type,
  status: "processing",
  created_at: "2026-11-01T00:00:00Z",
  storage_key: `${PROJECT}/k.${type}`,
});
const blob = (s: string) => new Blob([s]);
const call = () =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify({ sourceId: SOURCE }) }), {
    params: Promise.resolve({ id: PROJECT }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
  getOwnedProject.mockResolvedValue({ id: PROJECT });
  claim.mockResolvedValue({ data: row("txt"), error: null });
  download.mockResolvedValue({ data: blob("Refunds take 5 days."), error: null });
  processSource.mockResolvedValue(undefined);
});

describe("POST /api/projects/:id/knowledge/finalize", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call()).status).toBe(401);
  });
  it("returns 404 for a project the user does not own", async () => {
    getOwnedProject.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });
  it("refuses a source that is not uploading, so it cannot be claimed twice", async () => {
    claim.mockResolvedValue({ data: null, error: null });
    expect((await call()).status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });
  it("puts the reservation back when the file has not arrived", async () => {
    download.mockResolvedValue({ data: null, error: { message: "not found" } });
    expect((await call()).status).toBe(400);
    expect(revertEq).toHaveBeenCalled();
    expect(deleteEq).not.toHaveBeenCalled();
  });
  it("deletes a .pdf that does not start with the PDF header", async () => {
    claim.mockResolvedValue({ data: row("pdf"), error: null });
    download.mockResolvedValue({ data: blob("<html>not a pdf</html>"), error: null });
    expect((await call()).status).toBe(400);
    expect(remove).toHaveBeenCalledWith([`${PROJECT}/k.pdf`]);
    expect(deleteEq).toHaveBeenCalledWith("id", SOURCE);
    expect(processSource).not.toHaveBeenCalled();
  });
  it("deletes an empty file", async () => {
    download.mockResolvedValue({ data: blob(""), error: null });
    expect((await call()).status).toBe(400);
    expect(remove).toHaveBeenCalled();
  });
  it("processes a good file and returns the ready source", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: SOURCE, type: "txt", status: "ready" });
    expect(processSource).toHaveBeenCalledWith({ id: SOURCE, projectId: PROJECT }, "Refunds take 5 days.", expect.anything());
  });
  it("returns a friendly error when processing fails", async () => {
    processSource.mockRejectedValue(Object.assign(new Error("x"), { name: "EmptySourceError" }));
    const res = await call();
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toMatch(/readable text/);
  });
});
