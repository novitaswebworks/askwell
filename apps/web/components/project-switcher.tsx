"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface SwitcherProject {
  id: string;
  name: string;
  connected: boolean;
}

// One project choice for every dashboard page. The pages already read ?project=, so this only
// sets it; other filters on the page are dropped because they belong to the old project.
export function ProjectSwitcher({ projects }: { projects: SwitcherProject[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = projects.find((p) => p.id === params.get("project")) ?? projects[0];
  if (!current || projects.length < 2) return null;

  return (
    <div className="flex flex-col gap-1.5 px-1">
      <label htmlFor="project-switcher" className="text-xs font-medium text-muted">
        Project
      </label>
      <div className="relative">
        <span
          aria-hidden
          className={`pointer-events-none absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full ${current.connected ? "bg-green-600" : "bg-border"}`}
        />
        <select
          id="project-switcher"
          value={current.id}
          onChange={(e) => router.push(`${pathname}?project=${encodeURIComponent(e.target.value)}`)}
          className="h-10 w-full rounded-xl border border-border bg-glass-strong pl-7 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted">{current.connected ? "Widget connected" : "Widget not seen yet"}</p>
    </div>
  );
}
