import { DEFAULT_WIDGET_CONFIG, getPlanLimits, type Plan, type WidgetConfig } from "@askwell/shared";

// Free gets the defaults and the badge, whatever is stored (project.md section 5).
export function applyPlanToConfig(stored: WidgetConfig, plan: Plan): WidgetConfig {
  return getPlanLimits(plan).canCustomize ? stored : DEFAULT_WIDGET_CONFIG;
}

// Black or white text, whichever reads better on the button color (WCAG luminance).
export function readableTextColor(hex: string): "#000000" | "#ffffff" {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
