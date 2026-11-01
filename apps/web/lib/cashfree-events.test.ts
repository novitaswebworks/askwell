import { describe, expect, it } from "vitest";
import {
  eventSubscriptionId,
  planForEvent,
  REPLAY_WINDOW_MS,
  signWebhook,
  timestampMs,
  verifyWebhook,
  type CashfreeEvent,
} from "./cashfree-events";

const SECRET = "cfsk_test_secret";
const NOW = 1_800_000_000_000;
const body = JSON.stringify({ type: "SUBSCRIPTION_STATUS_CHANGED", data: {} });
const signed = (timestamp: string, raw = body, secret = SECRET) => ({
  rawBody: raw,
  timestamp,
  signature: signWebhook(timestamp, raw, secret),
});

describe("timestampMs", () => {
  it("reads seconds, milliseconds and ISO dates", () => {
    expect(timestampMs("1800000000")).toBe(1_800_000_000_000);
    expect(timestampMs("1800000000000")).toBe(1_800_000_000_000);
    expect(timestampMs("2027-01-15T08:00:00Z")).toBe(Date.parse("2027-01-15T08:00:00Z"));
  });
  it("returns null for nonsense", () => {
    expect(timestampMs("soon")).toBeNull();
  });
});

describe("verifyWebhook", () => {
  const ts = String(NOW);
  it("accepts a correctly signed, recent request", () => {
    expect(verifyWebhook(signed(ts), SECRET, NOW)).toBe(true);
    expect(verifyWebhook(signed(String(NOW / 1000)), SECRET, NOW)).toBe(true); // seconds
  });
  it("rejects a wrong secret, a changed body, and a changed signature", () => {
    expect(verifyWebhook(signed(ts, body, "other"), SECRET, NOW)).toBe(false);
    expect(verifyWebhook({ ...signed(ts), rawBody: body + " " }, SECRET, NOW)).toBe(false);
    expect(verifyWebhook({ ...signed(ts), signature: "AAAA" }, SECRET, NOW)).toBe(false);
  });
  it("rejects missing headers and an empty secret", () => {
    expect(verifyWebhook({ ...signed(ts), signature: null }, SECRET, NOW)).toBe(false);
    expect(verifyWebhook({ ...signed(ts), timestamp: null }, SECRET, NOW)).toBe(false);
    expect(verifyWebhook(signed(ts), "", NOW)).toBe(false);
  });
  it("rejects a replay older (or newer) than five minutes", () => {
    const old = String(NOW - REPLAY_WINDOW_MS - 1000);
    const future = String(NOW + REPLAY_WINDOW_MS + 1000);
    expect(verifyWebhook(signed(old), SECRET, NOW)).toBe(false);
    expect(verifyWebhook(signed(future), SECRET, NOW)).toBe(false);
    expect(verifyWebhook(signed(String(NOW - REPLAY_WINDOW_MS + 1000)), SECRET, NOW)).toBe(true);
  });
  it("rejects a timestamp that is not a time", () => {
    expect(verifyWebhook(signed("soon"), SECRET, NOW)).toBe(false);
  });
});

const status = (s: string): CashfreeEvent => ({
  type: "SUBSCRIPTION_STATUS_CHANGED",
  data: { subscription_details: { subscription_id: "askwell_1", subscription_status: s } },
});

describe("planForEvent", () => {
  it("is Pro when the subscription becomes ACTIVE", () => {
    expect(planForEvent(status("ACTIVE"))).toBe("pro");
  });
  it("is Free once it has ended, whoever ended it", () => {
    for (const s of ["CANCELLED", "CUSTOMER_CANCELLED", "COMPLETED", "EXPIRED", "CARD_EXPIRED"]) {
      expect(planForEvent(status(s))).toBe("free");
    }
  });
  it("changes nothing while it is pending, on hold (retrying), paused, or an unused link expired", () => {
    for (const s of ["INITIALIZED", "BANK_APPROVAL_PENDING", "ON_HOLD", "PAUSED", "CUSTOMER_PAUSED", "LINK_EXPIRED", "SOMETHING_NEW"]) {
      expect(planForEvent(status(s))).toBeNull();
    }
  });
  it("is Pro after a successful payment, and nothing for a failed one", () => {
    expect(planForEvent({ type: "SUBSCRIPTION_PAYMENT_SUCCESS", data: { payment_status: "SUCCESS" } })).toBe("pro");
    expect(planForEvent({ type: "SUBSCRIPTION_PAYMENT_FAILED", data: { payment_status: "FAILED" } })).toBeNull();
    expect(planForEvent({ type: "SUBSCRIPTION_PAYMENT_SUCCESS", data: { payment_status: "PENDING" } })).toBeNull();
  });
  it("ignores other events", () => {
    expect(planForEvent({ type: "SUBSCRIPTION_AUTH_STATUS", data: {} })).toBeNull();
    expect(planForEvent({})).toBeNull();
  });
});

describe("eventSubscriptionId", () => {
  it("reads the nested ID and the top-level one used by payment events", () => {
    expect(eventSubscriptionId(status("ACTIVE"))).toBe("askwell_1");
    expect(eventSubscriptionId({ type: "SUBSCRIPTION_PAYMENT_SUCCESS", data: { subscription_id: "askwell_2" } })).toBe("askwell_2");
    expect(eventSubscriptionId({})).toBeNull();
  });
});
