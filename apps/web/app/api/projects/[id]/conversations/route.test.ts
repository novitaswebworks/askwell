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

describe("GET /api/projects/:id/conversations", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call()).status).toBe(401);
  });
  it("returns 404 for a bad id and for a project RLS hides", async () => {
    expect((await call("nope")).status).toBe(404);
    ownerFrom.mockReturnValue(queryResult({ data: null }));
    expect((await call()).status).toBe(404);
  });
  it("returns the conversation summaries of an owned project", async () => {
    ownerFrom.mockImplementation((table: string) =>
      queryResult(
        table === "projects"
          ? { data: { id: ID } }
          : table === "conversations"
            ? { data: [{ id: ID, project_id: ID, created_at: "2026-11-01T00:00:00Z" }] }
            : { data: [{ id: ID, conversation_id: ID, role: "visitor", body: "Hello", created_at: "2026-11-01T00:00:00Z" }] },
      ),
    );
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: ID, firstMessage: "Hello", messageCount: 1, helpful: 0, notHelpful: 0, createdAt: "2026-11-01T00:00:00Z" },
    ]);
  });
  it("returns 500 with a friendly message when the database fails", async () => {
    ownerFrom.mockImplementation((table: string) =>
      queryResult(table === "projects" ? { data: { id: ID } } : { data: null, error: { message: "x" } }),
    );
    const res = await call();
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toBe("Could not load conversations.");
  });
});
