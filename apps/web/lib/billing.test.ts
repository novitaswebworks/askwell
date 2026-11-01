import { describe, expect, it } from "vitest";
import { planFromItems, SUBSCRIPTION_EVENTS } from "./billing";

const NOW = 1_800_000_000_000;
const pro = (status: string, period_end: number | null = null) => ({ status, period_end, plan: { slug: "pro" } });

describe("planFromItems", () => {
  it("is Pro while the pro item is active or only past due", () => {
    expect(planFromItems([pro("active")], NOW)).toBe("pro");
    expect(planFromItems([pro("past_due")], NOW)).toBe("pro");
  });
  it("keeps Pro for a cancelled item until the paid period ends", () => {
    expect(planFromItems([pro("canceled", NOW + 86_400_000)], NOW)).toBe("pro");
    expect(planFromItems([pro("canceled", NOW - 1)], NOW)).toBe("free");
    expect(planFromItems([pro("canceled", null)], NOW)).toBe("free");
  });
  it("is Free once the item has ended, expired, or never completed", () => {
    for (const status of ["ended", "expired", "abandoned", "incomplete", "upcoming"]) {
      expect(planFromItems([pro(status)], NOW)).toBe("free");
    }
  });
  it("is Free for the free plan, for other plan slugs, and when there are no items", () => {
    expect(planFromItems([{ status: "active", plan: { slug: "free" } }], NOW)).toBe("free");
    expect(planFromItems([{ status: "active", plan: { slug: "enterprise" } }], NOW)).toBe("free");
    expect(planFromItems([{ status: "active", plan: null }], NOW)).toBe("free");
    expect(planFromItems([], NOW)).toBe("free");
    expect(planFromItems(undefined, NOW)).toBe("free");
  });
  it("is Pro if any item is an active pro item, whatever the order", () => {
    expect(planFromItems([{ status: "active", plan: { slug: "free" } }, pro("active")], NOW)).toBe("pro");
    expect(planFromItems([pro("ended"), pro("active")], NOW)).toBe("pro");
  });
});

describe("SUBSCRIPTION_EVENTS", () => {
  it("includes the whole-subscription events and not the per-item ones", () => {
    expect(SUBSCRIPTION_EVENTS.has("subscription.updated")).toBe(true);
    expect(SUBSCRIPTION_EVENTS.has("subscriptionItem.active")).toBe(false);
    expect(SUBSCRIPTION_EVENTS.has("user.created")).toBe(false);
  });
});
