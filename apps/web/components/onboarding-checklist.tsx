import Link from "next/link";
import { onboardingProgress, onboardingSteps, type OnboardingFacts } from "@/lib/onboarding";

// Shown on the dashboard until every step is done. Each open step links to where it is done.
export function OnboardingChecklist({ facts, projectId }: { facts: OnboardingFacts; projectId: string | null }) {
  const steps = onboardingSteps(facts);
  const { done, total, complete } = onboardingProgress(steps);
  if (complete) return null;
  const suffix = projectId ? `?project=${projectId}` : "";
  const href: Record<string, string> = {
    project: "/dashboard",
    knowledge: `/dashboard/knowledge${suffix}`,
    install: `/dashboard/install${suffix}`,
    chat: `/dashboard/install${suffix}`,
  };
  const firstOpen = steps.find((s) => !s.done)?.id;

  return (
    <section aria-labelledby="onboarding-heading" className="glass flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="onboarding-heading" className="text-base font-semibold tracking-tight">
          Get started
        </h2>
        <p className="text-xs text-muted">
          {done} of {total} done
        </p>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link
              href={href[step.id]}
              className={`flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-glass-strong ${
                step.id === firstOpen ? "bg-glass" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  step.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-border text-muted"
                }`}
              >
                {step.done ? "✓" : index + 1}
              </span>
              <span className="flex flex-col">
                <span className={`text-sm font-medium ${step.done ? "text-muted line-through" : ""}`}>
                  {step.title}
                  <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
                </span>
                {!step.done && <span className="text-xs text-muted">{step.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
