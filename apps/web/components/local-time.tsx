"use client";

// Shows a moment in the reader's own time zone. The server renders it in its
// zone, so the first paint can differ; suppressHydrationWarning accepts that.
export function LocalTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  const text = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
