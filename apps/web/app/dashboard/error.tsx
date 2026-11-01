"use client";

import { EmptyState } from "@/components/empty-state";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      title="Something went wrong"
      description="Try again. If it keeps happening, reload the page."
      action={
        <button onClick={reset} className="rounded-full bg-accent px-5 py-2 text-sm text-accent-foreground">
          Try again
        </button>
      }
    />
  );
}
