import { describe, expect, it } from "vitest";
import { onboardingProgress, onboardingSteps } from "./onboarding";

const none = { projects: 0, readySources: 0, widgetSeen: false, conversations: 0 };

describe("onboarding checklist", () => {
  it("starts with nothing done", () => {
    const steps = onboardingSteps(none);
    expect(steps.map((s) => s.done)).toEqual([false, false, false, false]);
    expect(onboardingProgress(steps)).toEqual({ done: 0, total: 4, complete: false });
  });
  it("ticks each step from what the owner has done", () => {
    expect(onboardingSteps({ ...none, projects: 1 }).map((s) => s.done)).toEqual([true, false, false, false]);
    expect(onboardingSteps({ projects: 1, readySources: 2, widgetSeen: false, conversations: 0 }).map((s) => s.done)).toEqual([true, true, false, false]);
    expect(onboardingSteps({ projects: 1, readySources: 1, widgetSeen: true, conversations: 3 }).map((s) => s.done)).toEqual([true, true, true, true]);
  });
  it("is complete only when every step is done", () => {
    expect(onboardingProgress(onboardingSteps({ projects: 1, readySources: 1, widgetSeen: true, conversations: 1 })).complete).toBe(true);
    expect(onboardingProgress(onboardingSteps({ projects: 1, readySources: 1, widgetSeen: true, conversations: 0 })).complete).toBe(false);
  });
});
