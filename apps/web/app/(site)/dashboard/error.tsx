"use client";

import { useEffect } from "react";
import { EmptyState } from "@/components/empty-state";
import { withPostHog } from "@/lib/posthog-client";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  // React hands render errors to this boundary, so PostHog's automatic capture
  // does not see them. Report them here.
  useEffect(() => {
    withPostHog((ph) => ph.captureException(error));
  }, [error]);

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
