import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const ownerFrom = vi.fn();
vi.mock("@/lib/supabase/owner", () => ({ createOwnerClient: () => ({ from: ownerFrom }) }));

import { DELETE, PATCH } from "./route";

const id = "0b1c2d3e-0000-4000-8000-000000000001";
const ctx = (value = id) => ({ params: Promise.resolve({ id: value }) });
const patch = (body: unknown, value?: string) =>
  PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }), ctx(value));

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
});

describe("PATCH /api/projects/:id", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await patch({ name: "New" })).status).toBe(401);
  });
  it("returns 404 for an id that is not a UUID", async () => {
    expect((await patch({ name: "New" }, "nope")).status).toBe(404);
  });
  it("rejects an empty name", async () => {
    expect((await patch({ name: "" })).status).toBe(400);
  });
  it("returns 404 when RLS hides the project (not the caller's)", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: null }));
    expect((await patch({ name: "New" })).status).toBe(404);
  });
  it("renames an owned project", async () => {
    ownerFrom.mockReturnValue(
      queryResult({
        data: { id, name: "New", about: "", public_key: "pk_abcdefgh12345678", messages_used: 0, period_start: "d", created_at: "d" },
      }),
    );
    const res = await patch({ name: "New" });
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("New");
  });
  it("saves the business description", async () => {
    const update = vi.fn().mockReturnValue(
      queryResult({
        data: { id, name: "Shop", about: "A travel advisor.", public_key: "pk_abcdefgh12345678", messages_used: 0, period_start: "d", created_at: "d" },
      }),
    );
    ownerFrom.mockReturnValue({ update });
    const res = await patch({ about: "  A travel advisor.  " });
    expect(res.status).toBe(200);
    expect((await res.json()).about).toBe("A travel advisor.");
    expect(update).toHaveBeenCalledWith({ about: "A travel advisor." });
  });
  it("only ever updates name and about, never other columns", async () => {
    const update = vi.fn().mockReturnValue(queryResult({ data: null }));
    ownerFrom.mockReturnValue({ update });
    await patch({ name: "N", messages_used: 0, owner_id: "user_2", public_key: "pk_x" });
    expect(update).toHaveBeenCalledWith({ name: "N" });
  });
  it("rejects a description over 600 characters and an empty body", async () => {
    expect((await patch({ about: "x".repeat(601) })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
  });
});

describe("DELETE /api/projects/:id", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await DELETE(new Request("http://x"), ctx())).status).toBe(401);
  });
  it("returns 404 when the project is not the caller's", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: null }));
    expect((await DELETE(new Request("http://x"), ctx())).status).toBe(404);
  });
  it("deletes an owned project", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: { id } }));
    expect((await DELETE(new Request("http://x"), ctx())).status).toBe(204);
  });
});
