import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
const cancelSubscription = vi.fn();
vi.mock("@/lib/cashfree", () => ({ cancelSubscription: (...a: unknown[]) => cancelSubscription(...a) }));
const maybeSingle = vi.fn();
const updateEq = vi.fn();
const update = vi.fn(() => ({ eq: updateEq }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }), update }) }),
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
  maybeSingle.mockResolvedValue({ data: { plan: "pro", cashfree_subscription_id: "askwell_1" }, error: null });
  cancelSubscription.mockResolvedValue(undefined);
  updateEq.mockResolvedValue({ error: null });
});

describe("POST /api/billing/cancel", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await POST()).status).toBe(401);
  });
  it("cancels the caller's own subscription and moves them to Free", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(cancelSubscription).toHaveBeenCalledWith("askwell_1");
    expect(update).toHaveBeenCalledWith({ plan: "free" });
    expect(updateEq).toHaveBeenCalledWith("clerk_user_id", "user_1");
  });
  it("404s for someone who is not on a paid subscription", async () => {
    for (const data of [null, { plan: "free", cashfree_subscription_id: "askwell_1" }, { plan: "pro", cashfree_subscription_id: null }]) {
      maybeSingle.mockResolvedValue({ data, error: null });
      expect((await POST()).status).toBe(404);
    }
    expect(cancelSubscription).not.toHaveBeenCalled();
  });
  it("keeps Pro if Cashfree could not cancel", async () => {
    cancelSubscription.mockRejectedValue(new Error("down"));
    expect((await POST()).status).toBe(500);
    expect(update).not.toHaveBeenCalled();
  });
});
