import { PLAN_LIMITS, type Plan } from "@askwell/shared";

// One list of what each plan includes and what is coming, shown on the Billing
// page and the landing page so the two never disagree. The numbers come from
// PLAN_LIMITS, which the server enforces.
export function planFeatures(plan: Plan): string[] {
  const l = PLAN_LIMITS[plan];
  return [
    `${l.maxProjects} project${l.maxProjects > 1 ? "s" : ""}`,
    `${l.messagesPerMonth.toLocaleString("en-US")} messages a month per project`,
    `${l.maxKnowledgeSources} knowledge sources per project`,
    l.canCustomize ? "Your colour, position, label and animation" : "Standard widget look",
    l.canCustomize ? "No “Powered by” badge" : "“Powered by” badge shown",
    ...(plan === "pro" ? ["Leads captured from chats, with CSV export"] : []),
  ];
}

export const UPCOMING_FEATURES: { title: string; text: string }[] = [
  { title: "Streaming replies", text: "Answers appear word by word instead of all at once." },
  { title: "Public help page", text: "A shareable page for each project, built from your knowledge." },
  { title: "Live demo on the landing page", text: "Try Askwell on a real site before you sign up." },
];

// Billing opens when BILLING_ENABLED is "true" (the payment gateway is set up
// and tested). Until then the Upgrade button is hidden. Existing Pro accounts
// can still cancel.
export function billingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.BILLING_ENABLED === "true";
}
