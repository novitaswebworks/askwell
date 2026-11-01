import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const ownerFrom = vi.fn();
vi.mock("@/lib/supabase/owner", () => ({ createOwnerClient: () => ({ from: ownerFrom }) }));
const remove = vi.fn().mockResolvedValue({ error: null });
const deleteEq = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    storage: { from: () => ({ remove }) },
    from: () => ({ delete: () => ({ eq: deleteEq }) }),
  }),
}));

import { DELETE } from "./route";

const SOURCE = "0b1c2d3e-0000-4000-8000-0000000000aa";
const call = (id = SOURCE) => DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
});

describe("DELETE /api/knowledge/:id", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call()).status).toBe(401);
  });
  it("returns 404 for a bad id", async () => {
    expect((await call("nope")).status).toBe(404);
  });
  it("returns 404 when RLS hides the source (not the user's), deleting nothing", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: null }));
    expect((await call()).status).toBe(404);
    expect(deleteEq).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it("deletes the file and the source", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: { id: SOURCE, storage_key: "p/k.pdf" } }));
    expect((await call()).status).toBe(200);
    expect(remove).toHaveBeenCalledWith(["p/k.pdf"]);
    expect(deleteEq).toHaveBeenCalledWith("id", SOURCE);
  });
  it("skips Storage for pasted text", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: { id: SOURCE, storage_key: null } }));
    expect((await call()).status).toBe(200);
    expect(remove).not.toHaveBeenCalled();
  });
});
