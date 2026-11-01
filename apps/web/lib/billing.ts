import type { Plan } from "@askwell/shared";

// Which plan a Clerk subscription means. Clerk sends the whole subscription with
// every event, so the answer comes from that one payload and does not depend on
// the order events arrive in.

export interface SubscriptionItemLike {
  status?: string;
  period_end?: number | null;
  plan?: { slug?: string } | null;
}

// Paying (or briefly behind on payment) for `pro` means Pro. A cancelled item
// stays Pro until the period it paid for ends. Anything else is Free.
export function planFromItems(items: SubscriptionItemLike[] | undefined, now: number): Plan {
  for (const item of items ?? []) {
    if (item.plan?.slug !== "pro") continue;
    if (item.status === "active" || item.status === "past_due") return "pro";
    if (item.status === "canceled" && typeof item.period_end === "number" && item.period_end > now) return "pro";
  }
  return "free";
}

// Only these events carry the whole subscription. The per-item events carry one
// item, so they are acknowledged and ignored.
export const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.pastDue",
]);
