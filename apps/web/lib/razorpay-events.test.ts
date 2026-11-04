import { describe, expect, it } from "vitest";
import { eventSubscriptionId, planForEvent, signWebhook, verifyWebhook } from "./razorpay-events";

const event = (name: string, id = "sub_1") => ({ event: name, payload: { subscription: { entity: { id } } } });

describe("verifyWebhook", () => {
  const body = JSON.stringify(event("subscription.activated"));
  it("accepts the right signature", () => {
    expect(verifyWebhook({ rawBody: body, signature: signWebhook(body, "s") }, "s")).toBe(true);
  });
  it("rejects a missing, wrong or tampered signature, and an empty secret", () => {
    expect(verifyWebhook({ rawBody: body, signature: null }, "s")).toBe(false);
    expect(verifyWebhook({ rawBody: body, signature: signWebhook(body, "other") }, "s")).toBe(false);
    expect(verifyWebhook({ rawBody: body + " ", signature: signWebhook(body, "s") }, "s")).toBe(false);
    expect(verifyWebhook({ rawBody: body, signature: signWebhook(body, "") }, "")).toBe(false);
  });
});

describe("planForEvent", () => {
  it("makes an account Pro when a subscription activates or is charged", () => {
    expect(planForEvent(event("subscription.activated"))).toBe("pro");
    expect(planForEvent(event("subscription.charged"))).toBe("pro");
  });
  it("makes it Free when the subscription is over", () => {
    for (const name of ["cancelled", "completed", "expired", "halted"]) {
      expect(planForEvent(event(`subscription.${name}`))).toBe("free");
    }
  });
  it("changes nothing for retries, pauses, authentication and unknown events", () => {
    for (const name of ["subscription.pending", "subscription.paused", "subscription.authenticated", "payment.failed", "x"]) {
      expect(planForEvent(event(name))).toBeNull();
    }
    expect(planForEvent({})).toBeNull();
  });
});

describe("eventSubscriptionId", () => {
  it("reads our subscription ID, or null", () => {
    expect(eventSubscriptionId(event("subscription.activated", "sub_9"))).toBe("sub_9");
    expect(eventSubscriptionId({ event: "x", payload: {} })).toBeNull();
  });
});
