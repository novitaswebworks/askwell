import { DEFAULT_WIDGET_CONFIG, type WidgetConfig } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { applyPlanToConfig, readableTextColor } from "./widget-config";

const custom: WidgetConfig = {
  buttonColor: "#ff0000",
  position: "top-left",
  label: "Ask us",
  animation: "scale",
  headerText: "Hi there",
  showBadge: false,
  welcomeMessage: "Custom welcome",
  starterQuestions: ["Question A", "Question B"],
};

describe("applyPlanToConfig", () => {
  it("gives Free the defaults and the badge, whatever is stored", () => {
    expect(applyPlanToConfig(custom, "free")).toEqual(DEFAULT_WIDGET_CONFIG);
  });
  it("gives Pro the stored config", () => {
    expect(applyPlanToConfig(custom, "pro")).toEqual(custom);
  });
});

describe("readableTextColor", () => {
  it("picks white on dark and black on light buttons", () => {
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#1d4ed8")).toBe("#ffffff");
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#facc15")).toBe("#000000");
  });
  it("falls back safely for invalid input", () => {
    expect(readableTextColor("invalid")).toBe("#ffffff");
  });
});
