import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const notifyOwnerOfLead = vi.fn();
vi.mock("@/lib/email/notify", () => ({
  notifyOwnerOfLead: (...a: unknown[]) => notifyOwnerOfLead(...a),
}));

const from = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from }) }));

import { OPTIONS, POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/widget/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/widget/lead", () => {
  it("handles OPTIONS preflight", async () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 400 for invalid email", async () => {
    const res = await post({
      key: "pk_12345678abcdef",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      email: "invalid-email",
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 if project key is unknown", async () => {
    from.mockImplementation(() => queryResult({ data: null }));
    const res = await post({
      key: "pk_12345678abcdef",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      email: "valid@example.com",
    });
    expect(res.status).toBe(404);
  });

  it("saves lead and triggers owner email notification when plan is pro", async () => {
    from.mockImplementation((table: string) => {
      if (table === "projects") {
        return queryResult({ data: { id: "p1", name: "Acme", owner_id: "user_pro" } });
      }
      if (table === "conversations") {
        return queryResult({ data: { id: "c1", visitor_id: "v1" } });
      }
      if (table === "leads") {
        return queryResult({ data: { id: "lead_123" } });
      }
      if (table === "accounts") {
        return queryResult({ data: { plan: "pro" } });
      }
      if (table === "messages") {
        return queryResult({ data: [{ role: "visitor", body: "Need help" }] });
      }
      return queryResult({ data: null });
    });

    notifyOwnerOfLead.mockResolvedValue(true);

    const res = await post({
      key: "pk_12345678abcdef",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      email: "visitor@example.com",
      name: "Alice",
      phone: "+1 555-0199",
      type: "inquiry",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true, leadId: "lead_123" });
    expect(notifyOwnerOfLead).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "user_pro",
        projectName: "Acme",
        lead: { email: "visitor@example.com", name: "Alice", phone: "+1 555-0199" },
      }),
    );
  });

  it("saves lead without sending email notification when plan is free", async () => {
    from.mockImplementation((table: string) => {
      if (table === "projects") {
        return queryResult({ data: { id: "p1", name: "Acme", owner_id: "user_free" } });
      }
      if (table === "conversations") {
        return queryResult({ data: { id: "c1", visitor_id: "v1" } });
      }
      if (table === "leads") {
        return queryResult({ data: { id: "lead_123" } });
      }
      if (table === "accounts") {
        return queryResult({ data: { plan: "free" } });
      }
      return queryResult({ data: null });
    });

    const res = await post({
      key: "pk_12345678abcdef",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      email: "visitor@example.com",
    });

    expect(res.status).toBe(200);
    expect(notifyOwnerOfLead).not.toHaveBeenCalled();
  });
});
