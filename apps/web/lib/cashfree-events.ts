import { createHmac, timingSafeEqual } from "node:crypto";

// Pure helpers for Cashfree's webhook: checking who sent it, and what it means
// for an account. No network and no database here, so all of it is unit tested.

export const REPLAY_WINDOW_MS = 5 * 60 * 1000;

// Cashfree signs timestamp + raw body with HMAC SHA-256 and sends it base64
// (x-webhook-signature, x-webhook-timestamp). The comparison is constant time.
export function signWebhook(timestamp: string, rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
}

// The timestamp may arrive in seconds, milliseconds or ISO form.
export function timestampMs(value: string): number | null {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return n < 1e12 ? n * 1000 : n;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export function verifyWebhook(
  input: { rawBody: string; signature: string | null; timestamp: string | null },
  secret: string,
  now: number,
): boolean {
  if (!secret || !input.signature || !input.timestamp) return false;
  const sentAt = timestampMs(input.timestamp);
  if (sentAt === null || Math.abs(now - sentAt) > REPLAY_WINDOW_MS) return false;
  const expected = Buffer.from(signWebhook(input.timestamp, input.rawBody, secret));
  const given = Buffer.from(input.signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface CashfreeEvent {
  type?: string;
  data?: {
    subscription_id?: string;
    subscription_details?: { subscription_id?: string; subscription_status?: string };
    payment_status?: string;
  };
}

export function eventSubscriptionId(event: CashfreeEvent): string | null {
  return event.data?.subscription_details?.subscription_id ?? event.data?.subscription_id ?? null;
}

// Subscription states that mean it is over, whoever ended it.
const ENDED = new Set(["CANCELLED", "CUSTOMER_CANCELLED", "COMPLETED", "EXPIRED", "CARD_EXPIRED"]);

// What an event means for the plan: "pro", "free", or null for no change.
// ON_HOLD (a charge failed, Cashfree retries), paused and pending states change
// nothing. A link that expired was never authorised, so it changes nothing either.
export function planForEvent(event: CashfreeEvent): "pro" | "free" | null {
  const status = event.data?.subscription_details?.subscription_status;
  if (event.type === "SUBSCRIPTION_STATUS_CHANGED") {
    if (status === "ACTIVE") return "pro";
    if (status && ENDED.has(status)) return "free";
    return null;
  }
  if (event.type === "SUBSCRIPTION_PAYMENT_SUCCESS" && event.data?.payment_status === "SUCCESS") return "pro";
  return null;
}
