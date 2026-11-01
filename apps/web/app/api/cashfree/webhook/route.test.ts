import { beforeEach, describe, expect, it, vi } from "vitest";
import { signWebhook } from "@/lib/cashfree-events";

vi.mock("server-only", () => ({}));
const select = vi.fn();
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: () => ({ update }) }) }));

import { POST } from "./route";

const SECRET = "cfsk_test_secret";
const call = (body: string, headers: Record<string, string | undefined> = {}) =>
  POST(new Request("http://x/api/cashfree/webhook", { method: "POST", body, headers: headers as Record<string, string> }));
const signedHeaders = (body: string, timestamp = String(Date.now()), secret = SECRET) => ({
  "x-webhook-timestamp": timestamp,
  "x-webhook-signature": signWebhook(timestamp, body, secret),
});
const statusEvent = (status: string, id = "askwell_1") =>
  JSON.stringify({
    type: "SUBSCRIPTION_STATUS_CHANGED",
    data: { subscription_details: { subscription_id: id, subscription_status: status } },
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CASHFREE_SECRET_KEY = SECRET;
  delete process.env.CASHFREE_WEBHOOK_SECRET;
  select.mockResolvedValue({ data: [{ clerk_user_id: "user_1" }], error: null });
});

describe("POST /api/cashfree/webhook", () => {
  it("rejects unsigned, wrongly signed and stale requests, and changes nothing", async () => {
    const body = statusEvent("ACTIVE");
    expect((await call(body)).status).toBe(400);
    expect((await call(body, signedHeaders(body, String(Date.now()), "wrong"))).status).toBe(400);
    expect((await call(body, signedHeaders(body, String(Date.now() - 3_600_000)))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a signed body that was tampered with afterwards", async () => {
    const body = statusEvent("CANCELLED");
    const headers = signedHeaders(body);
    expect((await call(statusEvent("ACTIVE"), headers)).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("sets the account that owns this subscription to Pro when it becomes ACTIVE", async () => {
    const body = statusEvent("ACTIVE");
    const res = await call(body, signedHeaders(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, plan: "pro", matched: 1 });
    expect(update).toHaveBeenCalledWith({ plan: "pro" });
    expect(eq).toHaveBeenCalledWith("cashfree_subscription_id", "askwell_1");
  });

  it("sets it back to Free when the subscription ends", async () => {
    const body = statusEvent("CUSTOMER_CANCELLED");
    await call(body, signedHeaders(body));
    expect(update).toHaveBeenCalledWith({ plan: "free" });
  });

  it("acknowledges and ignores states that change nothing, and events without a subscription", async () => {
    for (const body of [statusEvent("ON_HOLD"), statusEvent("INITIALIZED"), JSON.stringify({ type: "SUBSCRIPTION_AUTH_STATUS", data: {} }), JSON.stringify({ type: "SUBSCRIPTION_STATUS_CHANGED", data: {} })]) {
      const res = await call(body, signedHeaders(body));
      expect(res.status).toBe(200);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("matches nobody for a subscription we did not create (the update touches no row)", async () => {
    select.mockResolvedValue({ data: [], error: null });
    const body = statusEvent("ACTIVE", "someone_elses");
    const res = await call(body, signedHeaders(body));
    expect(await res.json()).toMatchObject({ matched: 0 });
  });

  it("uses CASHFREE_WEBHOOK_SECRET when it is set", async () => {
    process.env.CASHFREE_WEBHOOK_SECRET = "separate_secret";
    const body = statusEvent("ACTIVE");
    expect((await call(body, signedHeaders(body))).status).toBe(400);
    expect((await call(body, signedHeaders(body, String(Date.now()), "separate_secret"))).status).toBe(200);
  });

  it("answers 500 when the database fails, so Cashfree retries", async () => {
    select.mockResolvedValue({ data: null, error: { message: "down" } });
    const body = statusEvent("ACTIVE");
    expect((await call(body, signedHeaders(body))).status).toBe(500);
  });

  it("rejects a signed body that is not JSON", async () => {
    const body = "not json";
    expect((await call(body, signedHeaders(body))).status).toBe(400);
  });
});
