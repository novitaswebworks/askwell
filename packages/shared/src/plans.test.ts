import { describe, expect, it } from "vitest";
import { getPlanLimits, PLAN_LIMITS } from "./plans";

describe("plan limits", () => {
  it("matches project.md section 5", () => {
    expect(PLAN_LIMITS.free).toEqual({
      maxProjects: 1,
      messagesPerMonth: 100,
      maxKnowledgeSources: 3,
      canCustomize: false,
    });
    expect(PLAN_LIMITS.pro).toEqual({
      maxProjects: 5,
      messagesPerMonth: 2000,
      maxKnowledgeSources: 25,
      canCustomize: true,
    });
  });

  it("getPlanLimits returns the limits for a plan", () => {
    expect(getPlanLimits("pro").canCustomize).toBe(true);
    expect(getPlanLimits("free").canCustomize).toBe(false);
  });
});
