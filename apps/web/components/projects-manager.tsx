"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Project } from "@askwell/shared";
import { EmptyState } from "@/components/empty-state";
import { UsageMeter } from "@/components/usage-meter";
import type { Usage } from "@/lib/usage";

const inputStyles =
  "h-11 min-w-0 flex-1 rounded-full border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
const buttonStyles =
  "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity disabled:opacity-50";

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? "Something went wrong. Try again.";
}

export function ProjectsManager({
  projects,
  maxProjects,
  usage,
  conversations,
}: {
  projects: Project[];
  maxProjects: number;
  usage: Record<string, Usage>;
  conversations: Record<string, number>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const atLimit = projects.length >= maxProjects;

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        setError(await errorMessage(res));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const ok = await send("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (ok) setName("");
  }

  async function rename(e: FormEvent, id: string) {
    e.preventDefault();
    const ok = await send(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    if (ok) setEditingId(null);
  }

  async function remove(project: Project) {
    if (!window.confirm(`Delete "${project.name}"? Its knowledge and conversations are deleted too.`)) return;
    await send(`/api/projects/${project.id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={create} className="glass flex flex-col gap-3 p-4 sm:flex-row">
        <label htmlFor="project-name" className="sr-only">
          Project name
        </label>
        <input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="Project name"
          disabled={atLimit || busy}
          className={inputStyles}
        />
        <button
          type="submit"
          disabled={atLimit || busy || name.trim() === ""}
          className={`${buttonStyles} bg-accent text-accent-foreground hover:opacity-90`}
        >
          Create project
        </button>
      </form>
      <p className="text-sm text-muted">
        {projects.length} of {maxProjects} projects used.
        {atLimit && maxProjects === 1 && " Upgrade to Pro for up to 5."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to get a chat widget for your website."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id} className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              {editingId === project.id ? (
                <form onSubmit={(e) => rename(e, project.id)} className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <label htmlFor={`rename-${project.id}`} className="sr-only">
                    New name for {project.name}
                  </label>
                  <input
                    id={`rename-${project.id}`}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={100}
                    className={inputStyles}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={busy || editName.trim() === ""}
                    className={`${buttonStyles} bg-accent text-accent-foreground hover:opacity-90`}
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className={`${buttonStyles} glass`}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{project.name}</p>
                    {usage[project.id] && (
                      <div className="mt-2">
                        <UsageMeter usage={usage[project.id]!} compact />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dashboard/conversations?project=${project.id}`} className={`${buttonStyles} glass`}>
                      Conversations{conversations[project.id] ? ` (${conversations[project.id]})` : ""}
                    </Link>
                    <Link href={`/dashboard/install?project=${project.id}`} className={`${buttonStyles} glass`}>
                      Install
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(project.id);
                        setEditName(project.name);
                      }}
                      className={`${buttonStyles} glass`}
                    >
                      Rename
                    </button>
                    <button type="button" onClick={() => remove(project)} disabled={busy} className={`${buttonStyles} glass`}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
