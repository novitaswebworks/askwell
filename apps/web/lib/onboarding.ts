// The "get started" checklist on the dashboard: what the owner has done so far.

export interface OnboardingFacts {
  projects: number;
  readySources: number;
  widgetSeen: boolean; // the widget has loaded on a website at least once
  conversations: number;
}

export interface OnboardingStep {
  id: "project" | "knowledge" | "install" | "chat";
  title: string;
  hint: string;
  done: boolean;
}

export function onboardingSteps(facts: OnboardingFacts): OnboardingStep[] {
  return [
    { id: "project", title: "Create a project", hint: "One project is one chat assistant for one website.", done: facts.projects > 0 },
    { id: "knowledge", title: "Add what it should know", hint: "Upload a document, paste text, or read your website.", done: facts.readySources > 0 },
    { id: "install", title: "Put it on your website", hint: "Copy one line of code. We tell you when it is live.", done: facts.widgetSeen },
    { id: "chat", title: "Get your first conversation", hint: "Ask it a question yourself on your website.", done: facts.conversations > 0 },
  ];
}

export function onboardingProgress(steps: OnboardingStep[]) {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, complete: done === steps.length };
}
