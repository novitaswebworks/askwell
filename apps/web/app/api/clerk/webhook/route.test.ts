import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const verifyWebhook = vi.fn();
vi.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook: (...a: unknown[]) => verifyWebhook(...a) }));
const upsert = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: () => ({ upsert }) }) }));

import { NextRequest } from "next/server";
import { POST } from "./route";

const call = () => POST(new NextRequest("http://x/api/clerk/webhook", { method: "POST", body: "{}" }));
const subscription = (items: unknown[], payer: unknown = { user_id: "user_1" }) => ({
  type: "subscription.updated",
  data: { payer, items },
});
const proItem = (status: string) => ({ status, period_end: null, plan: { slug: "pro" } });

beforeEach(() => {
  vi.clearAllMocks();
  upsert.mockResolvedValue({ error: null });
});

describe("POST /api/clerk/webhook", () => {
  it("rejects a request whose signature does not verify, and changes nothing", async () => {
    verifyWebhook.mockRejectedValue(new Error("bad signature"));
    const res = await call();
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("sets the account to Pro when the pro subscription is active", async () => {
    verifyWebhook.mockResolvedValue(subscription([proItem("active")]));
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, plan: "pro" });
    expect(upsert).toHaveBeenCalledWith({ clerk_user_id: "user_1", plan: "pro" }, { onConflict: "clerk_user_id" });
  });

  it("sets the account back to Free when the subscription has ended", async () => {
    verifyWebhook.mockResolvedValue(subscription([proItem("ended")]));
    await call();
    expect(upsert).toHaveBeenCalledWith({ clerk_user_id: "user_1", plan: "free" }, { onConflict: "clerk_user_id" });
  });

  it("acknowledges and ignores events that are not whole-subscription events", async () => {
    verifyWebhook.mockResolvedValue({ type: "subscriptionItem.active", data: {} });
    const res = await call();
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("ignores subscriptions paid by an organisation", async () => {
    verifyWebhook.mockResolvedValue(subscription([proItem("active")], { organization_id: "org_1" }));
    const res = await call();
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("answers 500 when the database fails, so Clerk retries the delivery", async () => {
    verifyWebhook.mockResolvedValue(subscription([proItem("active")]));
    upsert.mockResolvedValue({ error: { message: "down" } });
    expect((await call()).status).toBe(500);
  });
});
