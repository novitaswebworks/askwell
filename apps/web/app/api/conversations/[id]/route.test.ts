import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const ownerFrom = vi.fn();
vi.mock("@/lib/supabase/owner", () => ({ createOwnerClient: () => ({ from: ownerFrom }) }));
const serviceFrom = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: serviceFrom }) }));
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...a: unknown[]) => track(...a) }));

import { DELETE, GET } from "./route";

const ID = "0b1c2d3e-0000-4000-8000-000000000001";
const call = (id = ID) => GET(new Request("http://x"), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
});

describe("GET /api/conversations/:id", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call()).status).toBe(401);
  });
  it("returns 404 for a bad id and for a conversation that is not the caller's", async () => {
    expect((await call("nope")).status).toBe(404);
    ownerFrom.mockReturnValue(queryResult({ data: null }));
    expect((await call()).status).toBe(404);
  });
  it("returns the whole thread, visitor and bot, in order", async () => {
    ownerFrom.mockImplementation((table: string) =>
      queryResult(
        table === "conversations"
          ? { data: { id: ID, project_id: ID, created_at: "2026-11-01T00:00:00Z" } }
          : {
              data: [
                { id: ID, conversation_id: ID, role: "visitor", body: "Hi", created_at: "2026-11-01T00:00:00Z" },
                { id: ID, conversation_id: ID, role: "bot", body: "Hello!", created_at: "2026-11-01T00:00:01Z" },
              ],
            },
      ),
    );
    const res = await call();
    expect(res.status).toBe(200);
    const thread = await res.json();
    expect(thread.messages.map((m: { role: string }) => m.role)).toEqual(["visitor", "bot"]);
  });
  it("returns 500 with a friendly message when the database fails", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: null, error: { message: "x" } }));
    expect((await call()).status).toBe(500);
  });
});

describe("DELETE /api/conversations/:id", () => {
  const del = (id = ID) => DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ id }) });
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await del()).status).toBe(401);
  });
  it("returns 404 for a bad id and for someone else's conversation, deleting nothing", async () => {
    expect((await del("nope")).status).toBe(404);
    ownerFrom.mockReturnValue(queryResult({ data: null }));
    expect((await del()).status).toBe(404);
    expect(serviceFrom).not.toHaveBeenCalled();
  });
  it("deletes an owned conversation with the service client and says which project it was in", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: { id: ID, project_id: "p1" } }));
    serviceFrom.mockReturnValue(queryResult({ data: null }));
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, projectId: "p1" });
    expect(serviceFrom).toHaveBeenCalledWith("conversations");
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ event: "conversation_deleted" }));
  });
  it("reports a failed delete without details", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: { id: ID, project_id: "p1" } }));
    serviceFrom.mockReturnValue(queryResult({ error: { message: "secret" } }));
    const res = await del();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
