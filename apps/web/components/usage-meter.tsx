import type { Usage } from "@/lib/usage";

// Messages used this month against the plan limit. Colour is never the only
// signal: the words say it too.
export function UsageMeter({ usage, compact = false }: { usage: Usage; compact?: boolean }) {
  const near = !usage.atLimit && usage.percent >= 80;
  return (
    <div className={compact ? "w-full max-w-xs" : "w-full max-w-sm"}>
      <p className="flex items-baseline justify-between gap-3 text-xs text-muted">
        <span>
          <span className="font-medium text-foreground">{usage.used.toLocaleString("en-US")}</span> of{" "}
          {usage.limit.toLocaleString("en-US")} messages this month
        </span>
        {usage.atLimit && <span className="font-medium text-red-700">Limit reached</span>}
        {near && <span className="font-medium text-amber-700">Almost at the limit</span>}
      </p>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="Messages used this month"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
      >
        <div
          className={`h-full rounded-full ${usage.atLimit ? "bg-red-600" : near ? "bg-amber-600" : "bg-accent"}`}
          style={{ width: `${usage.percent}%` }}
        />
      </div>
    </div>
  );
}
