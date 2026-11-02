"use client";

// Thumbs up / down under the latest answer. Pressing the same one again takes it back.
export function RatingButtons({
  rating,
  onRate,
  helpfulLabel,
  notHelpfulLabel,
}: {
  rating: 1 | -1 | null;
  onRate: (next: 1 | -1 | null) => void;
  helpfulLabel: string;
  notHelpfulLabel: string;
}) {
  const base =
    "flex h-7 w-7 items-center justify-center rounded-full border border-border transition hover:bg-glass-strong focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <span className="ml-auto flex items-center gap-1">
      <button
        type="button"
        aria-label={helpfulLabel}
        title={helpfulLabel}
        aria-pressed={rating === 1}
        onClick={() => onRate(rating === 1 ? null : 1)}
        className={`${base} ${rating === 1 ? "bg-accent text-accent-foreground" : "bg-glass text-foreground/80"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 10v11H3V10h4zM7 10l4-8a2.5 2.5 0 0 1 2.5 2.5V8H20a2 2 0 0 1 2 2.3l-1.2 8A2 2 0 0 1 18.8 20H7" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={notHelpfulLabel}
        title={notHelpfulLabel}
        aria-pressed={rating === -1}
        onClick={() => onRate(rating === -1 ? null : -1)}
        className={`${base} ${rating === -1 ? "bg-accent text-accent-foreground" : "bg-glass text-foreground/80"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 14V3h4v11h-4zM17 14l-4 8a2.5 2.5 0 0 1-2.5-2.5V16H4a2 2 0 0 1-2-2.3l1.2-8A2 2 0 0 1 5.2 4H17" />
        </svg>
      </button>
    </span>
  );
}
