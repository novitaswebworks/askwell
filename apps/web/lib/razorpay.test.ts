import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { cancelSubscription, createProSubscription, razorpayMode, RazorpayError } from "./razorpay";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
  process.env.RAZORPAY_KEY_SECRET = "secret";
  process.env.RAZORPAY_PLAN_ID = "plan_pro";
});
afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("razorpayMode", () => {
  it("is production only for live keys", () => {
    expect(razorpayMode({ RAZORPAY_KEY_ID: "rzp_live_x" })).toBe("production");
    expect(razorpayMode({ RAZORPAY_KEY_ID: "rzp_test_x" })).toBe("sandbox");
    expect(razorpayMode({})).toBe("sandbox");
  });
});

describe("createProSubscription", () => {
  it("creates a subscription on the configured plan, with the keys in the auth header only", async () => {
    reply(200, { id: "sub_123" });
    expect(await createProSubscription({ email: "a@example.com" })).toEqual({ subscriptionId: "sub_123" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.razorpay.com/v1/subscriptions");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("rzp_test_abc:secret").toString("base64")}`);
    expect(JSON.parse(init.body)).toMatchObject({ plan_id: "plan_pro", total_count: 120, customer_notify: 1 });
    expect(init.body).not.toContain("secret");
  });
  it("throws a RazorpayError with Razorpay's reason when it refuses", async () => {
    reply(400, { error: { description: "Plan is not valid" } });
    await expect(createProSubscription({ email: "a@example.com" })).rejects.toMatchObject({ message: "Plan is not valid", status: 400 });
  });
  it("throws when Razorpay returns no subscription", async () => {
    reply(200, {});
    await expect(createProSubscription({ email: "a@example.com" })).rejects.toBeInstanceOf(RazorpayError);
  });
  it("fails clearly when the plan is not configured", async () => {
    delete process.env.RAZORPAY_PLAN_ID;
    await expect(createProSubscription({ email: "a@example.com" })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("cancelSubscription", () => {
  it("cancels at once, not at the end of the cycle", async () => {
    reply(200, {});
    await cancelSubscription("sub_1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.razorpay.com/v1/subscriptions/sub_1/cancel");
    expect(JSON.parse(init.body)).toEqual({ cancel_at_cycle_end: 0 });
  });
});
