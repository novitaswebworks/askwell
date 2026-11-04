import type { Overview } from "@/lib/overview";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const pct = (n: number | null) => (n === null ? "No data yet" : `${n}%`);

// Last 30 days across all projects: four numbers and a bar per day. The chart is plain SVG,
// with a text table for screen readers.
export function OverviewStats({ overview }: { overview: Overview }) {
  const max = Math.max(1, ...overview.daily.map((d) => d.count));
  const barWidth = 100 / overview.daily.length;
  return (
    <section aria-labelledby="overview-heading" className="flex flex-col gap-4">
      <h2 id="overview-heading" className="font-medium">
        Last 30 days
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Questions asked" value={overview.questions.toLocaleString("en-US")} hint={overview.truncated ? "Showing the most recent" : undefined} />
        <Stat label="Conversations" value={overview.conversations.toLocaleString("en-US")} />
        <Stat label="Answered" value={pct(overview.answeredPercent)} hint="Replies that were real answers" />
        <Stat label="Helpful" value={pct(overview.helpfulPercent)} hint="Thumbs up of all ratings" />
      </div>
      <div className="glass p-4">
        <p className="text-sm text-muted">Questions per day</p>
        <svg
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Questions per day, busiest day ${max}`}
          className="mt-3 h-32 w-full"
        >
          {overview.daily.map((d, i) => {
            const h = (d.count / max) * 30;
            return (
              <rect
                key={d.day}
                x={i * barWidth + barWidth * 0.15}
                y={32 - Math.max(h, d.count > 0 ? 0.8 : 0.3)}
                width={barWidth * 0.7}
                height={Math.max(h, d.count > 0 ? 0.8 : 0.3)}
                rx={0.3}
                className={d.count > 0 ? "fill-brand" : "fill-border"}
              >
                <title>{`${d.day}: ${d.count}`}</title>
              </rect>
            );
          })}
        </svg>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{overview.daily[0]?.day}</span>
          <span>{overview.daily[overview.daily.length - 1]?.day}</span>
        </div>
        <table className="sr-only">
          <caption>Questions per day</caption>
          <tbody>
            {overview.daily.map((d) => (
              <tr key={d.day}>
                <th scope="row">{d.day}</th>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
