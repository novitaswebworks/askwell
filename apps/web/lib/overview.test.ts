import { describe, expect, it } from "vitest";
import { buildOverview, dailyCounts, MAX_OVERVIEW_ROWS, percentOf, sinceIso } from "./overview";

const now = new Date("2026-11-04T10:00:00Z");

describe("dailyCounts", () => {
  it("gives one entry per day, oldest first, with zeros for quiet days", () => {
    const days = dailyCounts(["2026-11-04T01:00:00Z", "2026-11-04T09:00:00Z", "2026-11-02T12:00:00Z"], now, 5);
    expect(days.map((d) => d.day)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(days.map((d) => d.count)).toEqual([0, 0, 1, 0, 2]);
  });
  it("ignores messages outside the window", () => {
    expect(dailyCounts(["2026-01-01T00:00:00Z"], now, 3).every((d) => d.count === 0)).toBe(true);
  });
  it("defaults to 30 days", () => {
    expect(dailyCounts([], now)).toHaveLength(30);
  });
});

describe("percentOf", () => {
  it("rounds, and is null for an empty total", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 0)).toBeNull();
  });
});

describe("sinceIso", () => {
  it("starts at midnight UTC of the first day in the window", () => {
    expect(sinceIso(now, 3)).toBe("2026-11-02T00:00:00.000Z");
  });
});

describe("buildOverview", () => {
  const base = { visitorMessageTimes: ["2026-11-04T01:00:00Z"], conversations: 1, botReplies: 10, unansweredReplies: 2, thumbsUp: 3, thumbsDown: 1, now };
  it("works out the answered and helpful rates", () => {
    const o = buildOverview(base);
    expect(o).toMatchObject({ questions: 1, conversations: 1, answeredPercent: 80, helpfulPercent: 75, truncated: false });
  });
  it("has no rates before there is any data", () => {
    const o = buildOverview({ ...base, visitorMessageTimes: [], botReplies: 0, unansweredReplies: 0, thumbsUp: 0, thumbsDown: 0 });
    expect(o.answeredPercent).toBeNull();
    expect(o.helpfulPercent).toBeNull();
  });
  it("says so when the read was capped", () => {
    const times = Array.from({ length: MAX_OVERVIEW_ROWS }, () => "2026-11-04T01:00:00Z");
    expect(buildOverview({ ...base, visitorMessageTimes: times }).truncated).toBe(true);
  });
});
