import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
const currentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth(), currentUser: () => currentUser() }));
const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (...a: unknown[]) => getAccountPlan(...a) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
const createProSubscription = vi.fn();
vi.mock("@/lib/razorpay", () => ({ createProSubscription: (...a: unknown[]) => createProSubscription(...a) }));
const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: () => ({ update }) }) }));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
  auth.mockResolvedValue({ userId: "user_1" });
  getAccountPlan.mockResolvedValue("free");
  currentUser.mockResolvedValue({ fullName: "Asha Rao", primaryEmailAddress: { emailAddress: "asha@example.com" } });
  createProSubscription.mockResolvedValue({ subscriptionId: "sub_abc" });
  eq.mockResolvedValue({ error: null });
});

describe("POST /api/billing/subscribe", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await POST()).status).toBe(401);
    expect(createProSubscription).not.toHaveBeenCalled();
  });
  it("refuses an owner who is already on Pro", async () => {
    getAccountPlan.mockResolvedValue("pro");
    expect((await POST()).status).toBe(400);
    expect(createProSubscription).not.toHaveBeenCalled();
  });
  it("needs an email address on the account", async () => {
    currentUser.mockResolvedValue({ fullName: "A", primaryEmailAddress: null });
    expect((await POST()).status).toBe(400);
  });
  it("creates the subscription from server-side facts and stores Razorpay's ID for the webhook", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ subscriptionId: "sub_abc", keyId: "rzp_test_abc", name: "Asha Rao", email: "asha@example.com" });
    expect(createProSubscription).toHaveBeenCalledWith({ email: "asha@example.com" });
    expect(update).toHaveBeenCalledWith({ razorpay_subscription_id: "sub_abc" });
    expect(eq).toHaveBeenCalledWith("clerk_user_id", "user_1");
  });
  it("hides a Razorpay failure and stores nothing", async () => {
    createProSubscription.mockRejectedValueOnce(new Error("socket hang up"));
    const res = await POST();
    expect(res.status).toBe(500);
    expect(update).not.toHaveBeenCalled();
  });
});
