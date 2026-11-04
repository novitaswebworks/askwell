import { createHmac, timingSafeEqual } from "node:crypto";

// Pure helpers for Razorpay's webhook: checking who sent it, and what it means
// for an account. No network and no database here, so all of it is unit tested.

// Razorpay signs the raw body with HMAC SHA-256 and sends it as hex
// (x-razorpay-signature). The comparison is constant time.
export function signWebhook(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyWebhook(input: { rawBody: string; signature: string | null }, secret: string): boolean {
  if (!secret || !input.signature) return false;
  const expected = Buffer.from(signWebhook(input.rawBody, secret));
  const given = Buffer.from(input.signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface RazorpayEvent {
  event?: string;
  payload?: { subscription?: { entity?: { id?: string } } };
}

export function eventSubscriptionId(event: RazorpayEvent): string | null {
  return event.payload?.subscription?.entity?.id ?? null;
}

// What an event means for the plan: "pro", "free", or null for no change.
// `subscription.pending` and `halted` handling: pending means a charge failed and
// Razorpay is retrying, so it changes nothing; halted means the retries ran out.
// `paused` also changes nothing here.
export function planForEvent(event: RazorpayEvent): "pro" | "free" | null {
  switch (event.event) {
    case "subscription.activated":
    case "subscription.charged":
      return "pro";
    case "subscription.cancelled":
    case "subscription.completed":
    case "subscription.expired":
    case "subscription.halted":
      return "free";
    default:
      return null;
  }
}
