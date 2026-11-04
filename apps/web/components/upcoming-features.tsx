import { UPCOMING_FEATURES } from "@/lib/plan-features";

export function UpcomingFeatures({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <h2 className="font-medium">Coming soon</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {UPCOMING_FEATURES.map((f) => (
          <li key={f.title} className="rounded-xl border border-border bg-glass p-4">
            <p className="text-sm font-medium">{f.title}</p>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
