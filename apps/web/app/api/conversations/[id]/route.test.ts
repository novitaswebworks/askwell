import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const ownerFrom = vi.fn();
vi.mock("@/lib/supabase/owner", () => ({ createOwnerClient: () => ({ from: ownerFrom }) }));

import { GET } from "./route";

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
