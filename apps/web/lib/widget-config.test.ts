import { DEFAULT_WIDGET_CONFIG, type WidgetConfig } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { applyPlanToConfig } from "./widget-config";

const custom: WidgetConfig = {
  buttonColor: "#ff0000",
  position: "top-left",
  label: "Ask us",
  animation: "scale",
  headerText: "Hi there",
  showBadge: false,
};

describe("applyPlanToConfig", () => {
  it("gives Free the defaults and the badge, whatever is stored", () => {
    expect(applyPlanToConfig(custom, "free")).toEqual(DEFAULT_WIDGET_CONFIG);
  });
  it("gives Pro the stored config", () => {
    expect(applyPlanToConfig(custom, "pro")).toEqual(custom);
  });
});
