import { DEFAULT_WIDGET_CONFIG, getPlanLimits, type Plan, type WidgetConfig } from "@askwell/shared";

// Free gets the defaults and the badge, whatever is stored (project.md section 5).
export function applyPlanToConfig(stored: WidgetConfig, plan: Plan): WidgetConfig {
  return getPlanLimits(plan).canCustomize ? stored : DEFAULT_WIDGET_CONFIG;
}
