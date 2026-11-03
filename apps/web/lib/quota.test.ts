import { describe, expect, it } from "vitest";
import { quotaWarningLevel } from "./quota";

const now = new Date("2026-11-15T10:00:00Z");
const project = (messagesUsed: number, periodStart = "2026-11-01") => ({ messagesUsed, periodStart });

describe("quotaWarningLevel", () => {
  it("is quiet until the message that reaches 80%", () => {
    expect(quotaWarningLevel(project(0), 100, now)).toBeNull();
    expect(quotaWarningLevel(project(78), 100, now)).toBeNull(); // this message is #79
    expect(quotaWarningLevel(project(79), 100, now)).toBe(80); // this message is #80
  });
  it("keeps offering 80% for a few messages in case one was missed, then stops", () => {
    expect(quotaWarningLevel(project(81), 100, now)).toBe(80);
    expect(quotaWarningLevel(project(82), 100, now)).toBe(80);
    expect(quotaWarningLevel(project(83), 100, now)).toBeNull();
    expect(quotaWarningLevel(project(90), 100, now)).toBeNull();
  });
  it("warns that the limit is reached on the last message", () => {
    expect(quotaWarningLevel(project(98), 100, now)).toBeNull();
    expect(quotaWarningLevel(project(99), 100, now)).toBe(100);
  });
  it("counts from zero in a new month", () => {
    expect(quotaWarningLevel(project(99, "2026-10-01"), 100, now)).toBeNull();
    expect(quotaWarningLevel(project(79, "2026-10-01"), 100, now)).toBeNull();
  });
  it("works for the Pro limit and odd limits", () => {
    expect(quotaWarningLevel(project(1599), 2000, now)).toBe(80);
    expect(quotaWarningLevel(project(7), 10, now)).toBe(80);
    expect(quotaWarningLevel(project(0), 1, now)).toBe(100);
    expect(quotaWarningLevel(project(5), 0, now)).toBeNull();
  });
});
