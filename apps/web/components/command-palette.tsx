"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DASHBOARD_LINKS } from "@/components/dashboard-nav";
import { buildCommands, filterCommands } from "@/lib/dashboard-links";

// ⌘K (or Ctrl+K) opens a search over every dashboard page and project.
export function CommandPalette({ projects }: { projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(
    () => filterCommands(buildCommands(DASHBOARD_LINKS, projects, params.get("project")), query),
    [projects, params, query],
  );

  function open() {
    setQuery("");
    setActive(0);
    dialog.current?.showModal();
  }
  function go(href: string) {
    dialog.current?.close();
    router.push(href);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-border bg-glass-strong px-3 text-sm text-muted transition-colors hover:text-foreground"
      >
        <span>Search</span>
        <kbd className="rounded border border-border px-1.5 text-xs">⌘K</kbd>
      </button>
      <dialog
        ref={dialog}
        aria-label="Search the dashboard"
        className="m-auto mt-[15vh] w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/40"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              go(results[active]!.href);
            }
          }}
          placeholder="Search pages and projects"
          aria-label="Search pages and projects"
          className="h-12 w-full rounded-t-2xl border-b border-border bg-transparent px-4 text-sm outline-none"
        />
        <ul role="listbox" aria-label="Results" className="max-h-72 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing found</li>}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => go(r.href)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === active ? "bg-glass-strong" : ""}`}
              >
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="shrink-0 text-xs text-muted">{r.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
