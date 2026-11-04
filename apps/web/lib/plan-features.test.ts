import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "@askwell/shared";
import { billingEnabled, planFeatures, UPCOMING_FEATURES } from "./plan-features";

describe("planFeatures", () => {
  it("is built from the limits the server enforces", () => {
    expect(planFeatures("pro")).toContain(`${PLAN_LIMITS.pro.maxProjects} projects`);
    expect(planFeatures("free")).toContain("1 project");
  });
  it("lists leads for Pro only", () => {
    expect(planFeatures("pro").join(" ")).toMatch(/Leads/);
    expect(planFeatures("free").join(" ")).not.toMatch(/Leads/);
  });
});

describe("billingEnabled", () => {
  it("is on only for the exact value true", () => {
    expect(billingEnabled({ BILLING_ENABLED: "true" })).toBe(true);
    for (const v of [undefined, "", "false", "1", "TRUE"]) expect(billingEnabled({ BILLING_ENABLED: v })).toBe(false);
  });
});

describe("UPCOMING_FEATURES", () => {
  it("has the three agreed items", () => {
    expect(UPCOMING_FEATURES.map((f) => f.title)).toEqual(["Streaming replies", "Public help page", "Live demo on the landing page"]);
  });
});
