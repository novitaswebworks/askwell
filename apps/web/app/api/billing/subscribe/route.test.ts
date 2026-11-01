import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
const currentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth(), currentUser: () => currentUser() }));
const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (...a: unknown[]) => getAccountPlan(...a) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
const createProSubscription = vi.fn();
vi.mock("@/lib/cashfree", () => ({
  createProSubscription: (...a: unknown[]) => createProSubscription(...a),
  newSubscriptionId: () => "askwell_fixed",
  CashfreeError: class CashfreeError extends Error {
    constructor(m: string, readonly status: number) {
      super(m);
    }
  },
}));
const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: () => ({ update }) }) }));

import { CashfreeError } from "@/lib/cashfree";
import { POST } from "./route";

const call = (body: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
  auth.mockResolvedValue({ userId: "user_1" });
  getAccountPlan.mockResolvedValue("free");
  currentUser.mockResolvedValue({ fullName: "Asha Rao", primaryEmailAddress: { emailAddress: "asha@example.com" } });
  createProSubscription.mockResolvedValue({ sessionId: "sub_session_abc" });
  eq.mockResolvedValue({ error: null });
});

describe("POST /api/billing/subscribe", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call({ phone: "9876543210" })).status).toBe(401);
  });
  it("rejects a bad phone number before calling Cashfree", async () => {
    expect((await call({ phone: "abc" })).status).toBe(400);
    expect(createProSubscription).not.toHaveBeenCalled();
  });
  it("refuses an owner who is already on Pro", async () => {
    getAccountPlan.mockResolvedValue("pro");
    const res = await call({ phone: "9876543210" });
    expect(res.status).toBe(400);
    expect(createProSubscription).not.toHaveBeenCalled();
  });
  it("needs an email address on the account", async () => {
    currentUser.mockResolvedValue({ fullName: "A", primaryEmailAddress: null });
    expect((await call({ phone: "9876543210" })).status).toBe(400);
  });
  it("creates the subscription from server-side facts and stores our ID for the webhook", async () => {
    const res = await call({ phone: "+91 98765-43210" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessionId: "sub_session_abc" });
    expect(createProSubscription).toHaveBeenCalledWith({
      subscriptionId: "askwell_fixed",
      name: "Asha Rao",
      email: "asha@example.com",
      phone: "919876543210",
      returnUrl: "https://app.example.com/api/billing/return",
    });
    expect(update).toHaveBeenCalledWith({ cashfree_subscription_id: "askwell_fixed" });
    expect(eq).toHaveBeenCalledWith("clerk_user_id", "user_1");
  });
  it("does not let the browser choose the plan or price", async () => {
    await call({ phone: "9876543210", plan: "enterprise", price: 1, amount: 1, email: "evil@example.com" });
    const args = createProSubscription.mock.calls[0]![0];
    expect(args.email).toBe("asha@example.com");
    expect(Object.keys(args).sort()).toEqual(["email", "name", "phone", "returnUrl", "subscriptionId"]);
  });
  it("explains a Cashfree rejection of the details, and hides other failures", async () => {
    createProSubscription.mockRejectedValueOnce(new CashfreeError("bad phone", 400));
    const rejected = await (await call({ phone: "9876543210" })).json();
    expect(rejected.error.message).toMatch(/phone number/);
    createProSubscription.mockRejectedValueOnce(new Error("socket hang up"));
    const failed = await call({ phone: "9876543210" });
    expect(failed.status).toBe(500);
    expect(update).not.toHaveBeenCalled();
  });
});
