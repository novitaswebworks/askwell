export type Plan = "free" | "pro";

export type WidgetPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type WidgetAnimation = "fade" | "slide" | "scale";

export interface PlanLimits {
  maxProjects: number;
  messagesPerMonth: number;
  maxKnowledgeSources: number;
  canCustomize: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxProjects: 1,
    messagesPerMonth: 100,
    maxKnowledgeSources: 3,
    canCustomize: false,
  },
  pro: {
    maxProjects: 5,
    messagesPerMonth: 2000,
    maxKnowledgeSources: 25,
    canCustomize: true,
  },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}
