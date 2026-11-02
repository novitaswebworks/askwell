"use client";

import { useState } from "react";
import type { Platform } from "@/lib/install";

// One tab per website builder; only the chosen one's steps are shown.
export function PlatformSteps({ platforms }: { platforms: Platform[] }) {
  const [id, setId] = useState(platforms[0]!.id);
  const current = platforms.find((p) => p.id === id) ?? platforms[0]!;

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="What is your website built with?" className="flex flex-wrap gap-2">
        {platforms.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === current.id}
            onClick={() => setId(p.id)}
            className={`inline-flex h-10 items-center rounded-full px-4 text-sm ${
              p.id === current.id ? "bg-accent text-accent-foreground" : "glass"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {current.intro && <p className="text-sm text-muted">{current.intro}</p>}
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {current.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {current.note && <p className="rounded-xl bg-black/5 p-3 text-sm text-muted">{current.note}</p>}
    </div>
  );
}
