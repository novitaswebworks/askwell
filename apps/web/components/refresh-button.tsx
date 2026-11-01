"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// There is no live feed (project.md section 6.7): the owner refreshes by hand.
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      className="glass inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-opacity hover:bg-glass-strong disabled:opacity-60"
    >
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
