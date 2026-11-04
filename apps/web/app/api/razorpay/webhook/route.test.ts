import { beforeEach, describe, expect, it, vi } from "vitest";
import { signWebhook } from "@/lib/razorpay-events";

vi.mock("server-only", () => ({}));
const select = vi.fn();
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: () => ({ update }) }) }));

import { POST } from "./route";

const SECRET = "whsec_test";
const call = (body: string, signature?: string) =>
  POST(
    new Request("http://x/api/razorpay/webhook", {
      method: "POST",
      body,
      headers: signature ? { "x-razorpay-signature": signature } : {},
    }),
  );
const ev = (name: string, id = "sub_1") => JSON.stringify({ event: name, payload: { subscription: { entity: { id } } } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  select.mockResolvedValue({ data: [{ clerk_user_id: "user_1" }], error: null });
});

describe("POST /api/razorpay/webhook", () => {
  it("rejects unsigned and wrongly signed requests, and changes nothing", async () => {
    const body = ev("subscription.activated");
    expect((await call(body)).status).toBe(400);
    expect((await call(body, signWebhook(body, "wrong"))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects everything when no webhook secret is configured", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const body = ev("subscription.activated");
    expect((await call(body, signWebhook(body, ""))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a signed body that was tampered with afterwards", async () => {
    const signature = signWebhook(ev("subscription.cancelled"), SECRET);
    expect((await call(ev("subscription.activated"), signature)).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("sets the account that owns this subscription to Pro when it activates", async () => {
    const body = ev("subscription.activated");
    const res = await call(body, signWebhook(body, SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, plan: "pro", matched: 1 });
    expect(update).toHaveBeenCalledWith({ plan: "pro" });
    expect(eq).toHaveBeenCalledWith("razorpay_subscription_id", "sub_1");
  });

  it("sets it back to Free when the subscription ends", async () => {
    const body = ev("subscription.cancelled");
    await call(body, signWebhook(body, SECRET));
    expect(update).toHaveBeenCalledWith({ plan: "free" });
  });

  it("acknowledges and ignores events that change nothing, and events without a subscription", async () => {
    for (const body of [ev("subscription.pending"), ev("payment.failed"), JSON.stringify({ event: "subscription.activated", payload: {} })]) {
      expect((await call(body, signWebhook(body, SECRET))).status).toBe(200);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("matches nobody for a subscription we did not create", async () => {
    select.mockResolvedValue({ data: [], error: null });
    const body = ev("subscription.activated", "someone_elses");
    expect(await (await call(body, signWebhook(body, SECRET))).json()).toMatchObject({ matched: 0 });
  });

  it("answers 500 when the database fails, so Razorpay retries", async () => {
    select.mockResolvedValue({ data: null, error: { message: "down" } });
    const body = ev("subscription.activated");
    expect((await call(body, signWebhook(body, SECRET))).status).toBe(500);
  });

  it("rejects a signed body that is not JSON", async () => {
    expect((await call("not json", signWebhook("not json", SECRET))).status).toBe(400);
  });
});
