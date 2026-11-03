import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const protectRate = vi.fn();
vi.mock("@/lib/protect", () => ({ protectRate: (...a: unknown[]) => protectRate(...a) }));
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
  protectRate.mockResolvedValue(true);
});

let leadCalls = 0;

describe("POST /api/widget/lead", () => {
  beforeEach(() => {
    leadCalls = 0;
  });

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
        // First the "same details sent recently?" check (none), then the insert.
        return queryResult({ data: ++leadCalls === 1 ? null : { id: "lead_123" } });
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
        // First the "same details sent recently?" check (none), then the insert.
        return queryResult({ data: ++leadCalls === 1 ? null : { id: "lead_123" } });
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

  const tables = (plan: string, overrides: Record<string, unknown> = {}) =>
    from.mockImplementation((table: string) => {
      if (table in overrides) return queryResult({ data: overrides[table] });
      if (table === "projects") return queryResult({ data: { id: "p1", name: "Acme", owner_id: "user_pro" } });
      if (table === "conversations") return queryResult({ data: { id: "c1", visitor_id: "v1" } });
      if (table === "leads") return queryResult({ data: ++leadCalls === 1 ? null : { id: "lead_123" } });
      if (table === "accounts") return queryResult({ data: { plan } });
      return queryResult({ data: [] });
    });
  const body = { key: "pk_12345678abcdef", conversationId: "550e8400-e29b-41d4-a716-446655440000", email: "visitor@example.com" };

  it("refuses with 429 before touching the database when the rate limit is hit", async () => {
    protectRate.mockResolvedValue(false);
    tables("pro");
    const res = await post(body);
    expect(res.status).toBe(429);
    expect(from).not.toHaveBeenCalled();
    expect(protectRate).toHaveBeenCalledWith(expect.anything(), "pk_12345678abcdef", "lead", 5);
  });

  it("saves a lead with no conversation (the first chat message was refused) and still emails the owner", async () => {
    tables("pro");
    notifyOwnerOfLead.mockResolvedValue(true);
    const res = await post({ key: body.key, email: body.email });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, leadId: "lead_123" });
    expect(notifyOwnerOfLead).toHaveBeenCalledWith(expect.objectContaining({ transcript: [] }));
  });

  it("does not save or email again when the same details are sent twice in a row", async () => {
    tables("pro", {});
    from.mockImplementation((table: string) => {
      if (table === "projects") return queryResult({ data: { id: "p1", name: "Acme", owner_id: "user_pro" } });
      if (table === "conversations") return queryResult({ data: { id: "c1", visitor_id: "v1" } });
      if (table === "leads") return queryResult({ data: { id: "lead_existing" } }); // found by the replay check
      return queryResult({ data: { plan: "pro" } });
    });
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, leadId: "lead_existing" });
    expect(notifyOwnerOfLead).not.toHaveBeenCalled();
  });

  it("still refuses a conversation that is not this project's", async () => {
    tables("pro", { conversations: null });
    expect((await post(body)).status).toBe(404);
  });
});
