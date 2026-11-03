import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (...a: unknown[]) => getAccountPlan(...a) }));

const from = vi.fn();
vi.mock("@/lib/supabase/owner", () => ({ createOwnerClient: () => ({ from }) }));

import { GET } from "./route";

const PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/projects/:id/leads", () => {
  it("returns 401 when user is not signed in", async () => {
    auth.mockResolvedValue({ userId: null });
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: PROJECT_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 402 / plan_required when user is on free plan", async () => {
    auth.mockResolvedValue({ userId: "user_free" });
    getAccountPlan.mockResolvedValue("free");

    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: PROJECT_ID }) });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe("plan_required");
  });

  it("returns leads array when user is on Pro plan", async () => {
    auth.mockResolvedValue({ userId: "user_pro" });
    getAccountPlan.mockResolvedValue("pro");

    from.mockImplementation((table: string) => {
      if (table === "projects") {
        return queryResult({ data: { id: PROJECT_ID, name: "Acme" } });
      }
      if (table === "leads") {
        return queryResult({
          data: [
            {
              id: "550e8400-e29b-41d4-a716-446655440001",
              project_id: PROJECT_ID,
              conversation_id: null,
              email: "lead@example.com",
              name: "Jane",
              phone: null,
              created_at: "2026-11-02T12:00:00Z",
            },
          ],
        });
      }
      return queryResult({ data: null });
    });

    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: PROJECT_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].email).toBe("lead@example.com");
  });

  it("returns CSV file when format=csv", async () => {
    auth.mockResolvedValue({ userId: "user_pro" });
    getAccountPlan.mockResolvedValue("pro");

    from.mockImplementation((table: string) => {
      if (table === "projects") {
        return queryResult({ data: { id: PROJECT_ID, name: "Acme Corp" } });
      }
      if (table === "leads") {
        return queryResult({
          data: [
            {
              id: "550e8400-e29b-41d4-a716-446655440001",
              project_id: PROJECT_ID,
              conversation_id: null,
              email: "lead@example.com",
              name: "Jane",
              phone: "+123456",
              created_at: "2026-11-02T12:00:00Z",
            },
          ],
        });
      }
      return queryResult({ data: null });
    });

    const res = await GET(new Request("http://localhost?format=csv"), { params: Promise.resolve({ id: PROJECT_ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain('filename="leads-acme_corp.csv"');
    const text = await res.text();
    expect(text).toContain("ID,Created At,Email,Name,Phone,Conversation ID");
    expect(text).toContain('lead@example.com');
  });
});
