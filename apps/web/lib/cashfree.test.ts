import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { cancelSubscription, cashfreeMode, CashfreeError, createProSubscription, newSubscriptionId } from "./cashfree";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.CASHFREE_APP_ID = "TEST_APP";
  process.env.CASHFREE_SECRET_KEY = "cfsk_secret";
  process.env.CASHFREE_ENV = "sandbox";
});
afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("cashfreeMode", () => {
  it("is production only when asked for, otherwise sandbox", () => {
    expect(cashfreeMode({ CASHFREE_ENV: "production" })).toBe("production");
    expect(cashfreeMode({ CASHFREE_ENV: "sandbox" })).toBe("sandbox");
    expect(cashfreeMode({})).toBe("sandbox");
    expect(cashfreeMode({ CASHFREE_ENV: "prod" })).toBe("sandbox");
  });
});

describe("createProSubscription", () => {
  const input = { subscriptionId: "askwell_1", name: "Asha", email: "a@example.com", phone: "9876543210", returnUrl: "https://x/return" };

  it("sends a monthly Pro plan at the one price, with the keys in headers only", async () => {
    reply(200, { subscription_session_id: "sess_1" });
    expect(await createProSubscription(input)).toEqual({ sessionId: "sess_1" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://sandbox.cashfree.com/pg/subscriptions");
    expect(init.headers["x-client-id"]).toBe("TEST_APP");
    expect(init.headers["x-client-secret"]).toBe("cfsk_secret");
    const body = JSON.parse(init.body);
    expect(body.plan_details).toMatchObject({ plan_type: "PERIODIC", plan_currency: "INR", plan_amount: 999, plan_interval_type: "MONTH", plan_intervals: 1 });
    expect(body.customer_details).toEqual({ customer_name: "Asha", customer_email: "a@example.com", customer_phone: "9876543210" });
    expect(init.body).not.toContain("cfsk_secret");
  });
  it("talks to the live API in production", async () => {
    process.env.CASHFREE_ENV = "production";
    reply(200, { subscription_session_id: "s" });
    await createProSubscription(input);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.cashfree.com/pg/subscriptions");
  });
  it("fails clearly when Cashfree refuses or returns no session", async () => {
    reply(400, { message: "customer_phone is invalid" });
    await expect(createProSubscription(input)).rejects.toMatchObject({ name: "CashfreeError", status: 400, message: "customer_phone is invalid" });
    reply(200, {});
    await expect(createProSubscription(input)).rejects.toBeInstanceOf(CashfreeError);
  });
});

describe("cancelSubscription", () => {
  it("posts the CANCEL action for that subscription", async () => {
    reply(200, {});
    await cancelSubscription("askwell_1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://sandbox.cashfree.com/pg/subscriptions/askwell_1/manage");
    expect(JSON.parse(init.body)).toEqual({ action: "CANCEL" });
  });
});

describe("newSubscriptionId", () => {
  it("is unique and uses only characters Cashfree allows", () => {
    const a = newSubscriptionId();
    expect(a).toMatch(/^askwell_[0-9a-f]{32}$/);
    expect(newSubscriptionId()).not.toBe(a);
  });
});
