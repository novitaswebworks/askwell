import { describe, expect, it } from "vitest";
import { usageThisMonth } from "./usage";

const now = new Date("2026-11-15T10:00:00Z");

describe("usageThisMonth", () => {
  it("shows the count for the current month", () => {
    expect(usageThisMonth({ messagesUsed: 30, periodStart: "2026-11-01" }, 100, now)).toEqual({
      used: 30,
      limit: 100,
      percent: 30,
      atLimit: false,
    });
  });
  it("shows zero when the counter is from an earlier month (it resets on the next message)", () => {
    expect(usageThisMonth({ messagesUsed: 99, periodStart: "2026-10-01" }, 100, now).used).toBe(0);
    expect(usageThisMonth({ messagesUsed: 5, periodStart: "2025-12-01" }, 100, now).used).toBe(0);
  });
  it("reports the limit as reached, and never goes past 100 percent", () => {
    expect(usageThisMonth({ messagesUsed: 100, periodStart: "2026-11-01" }, 100, now)).toMatchObject({ percent: 100, atLimit: true });
    expect(usageThisMonth({ messagesUsed: 150, periodStart: "2026-11-01" }, 100, now).percent).toBe(100);
  });
  it("copes with a zero limit", () => {
    expect(usageThisMonth({ messagesUsed: 0, periodStart: "2026-11-01" }, 0, now).percent).toBe(0);
  });
  it("uses UTC, like the database", () => {
    // 00:30 on 1 December in Asia is still 30 November in UTC.
    expect(usageThisMonth({ messagesUsed: 7, periodStart: "2026-11-01" }, 100, new Date("2026-11-30T20:00:00Z")).used).toBe(7);
  });
});
