"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Plan, Project } from "@askwell/shared";
import { EmptyState } from "@/components/empty-state";
import {
  Chat,
  Check,
  Code,
  Copy,
  Document,
  Edit,
  Plus,
  Sliders,
  Trash,
} from "@/components/site/icons";
import { UsageMeter } from "@/components/usage-meter";
import type { Usage } from "@/lib/usage";

const inputStyles =
  "h-11 min-w-0 flex-1 rounded-full border border-border bg-glass-strong px-4 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground";
const buttonStyles =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-all disabled:opacity-50";

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? "Something went wrong. Try again.";
}

export function ProjectsManager({
  projects,
  maxProjects,
  usage,
  conversations,
  plan = "free",
}: {
  projects: Project[];
  maxProjects: number;
  usage: Record<string, Usage>;
  conversations: Record<string, number>;
  plan?: Plan;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const atLimit = projects.length >= maxProjects;
  const isPro = plan === "pro";

  // Calculate aggregated stats across projects
  const totalUsed = Object.values(usage).reduce((sum, u) => sum + u.used, 0);
  const totalLimit =
    projects.length > 0
      ? Object.values(usage).reduce((sum, u) => sum + u.limit, 0)
      : isPro
        ? 5000
        : 100;
  const totalConversations = Object.values(conversations).reduce((sum, c) => sum + c, 0);
  const capacityPercent = Math.min(100, Math.round((totalUsed / Math.max(1, totalLimit)) * 100));

  async function copyKey(project: Project) {
    if (typeof window === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(project.publicKey);
      setCopiedId(project.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }

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
    if (!name.trim()) return;
    const ok = await send("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (ok) setName("");
  }

  async function rename(e: FormEvent, id: string) {
    e.preventDefault();
    if (!editName.trim()) return;
    const ok = await send(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (ok) setEditingId(null);
  }

  async function remove(project: Project) {
    if (
      !window.confirm(
        `Delete "${project.name}"? Its knowledge base, widget config, and conversations will be deleted too.`,
      )
    )
      return;
    await send(`/api/projects/${project.id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Overview Metrics Cards */}
      <section aria-label="Account Overview" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Projects KPI */}
        <div className="glass flex flex-col justify-between p-5 rounded-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Projects</p>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">
              {projects.length}
            </span>
            <span className="text-sm text-muted">/ {maxProjects} max</span>
          </div>
          <div className="text-xs">
            {atLimit && !isPro ? (
              <Link
                href="/dashboard/billing"
                className="font-medium text-brand hover:underline inline-flex items-center gap-1"
              >
                Upgrade to Pro for up to 5 &rarr;
              </Link>
            ) : (
              <span className="text-muted">
                {isPro ? "Pro plan (up to 5 projects)" : "Free tier (1 project limit)"}
              </span>
            )}
          </div>
        </div>

        {/* Monthly Messages KPI */}
        <div className="glass flex flex-col justify-between p-5 rounded-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Messages this month</p>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">
              {totalUsed.toLocaleString("en-US")}
            </span>
            <span className="text-sm text-muted">/ {totalLimit.toLocaleString("en-US")}</span>
          </div>
          <div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-label="Aggregate messages used"
              aria-valuenow={totalUsed}
              aria-valuemin={0}
              aria-valuemax={totalLimit}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  capacityPercent >= 100
                    ? "bg-red-600"
                    : capacityPercent >= 80
                      ? "bg-amber-600"
                      : "bg-foreground"
                }`}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Conversations KPI */}
        <div className="glass flex flex-col justify-between p-5 rounded-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Total Conversations</p>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">
              {totalConversations.toLocaleString("en-US")}
            </span>
          </div>
          <p className="text-xs text-muted">Visitor chat sessions logged</p>
        </div>
      </section>

      {/* 2. Create Project Card */}
      <section aria-label="Create Project" className="glass p-5 rounded-2xl">
        <div className="mb-3">
          <h2 className="text-base font-semibold tracking-tight">Create a new project</h2>
          <p className="text-xs text-muted mt-0.5">
            Each project has its own knowledge base, public key, and embeddable widget.
          </p>
        </div>

        <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="project-name" className="sr-only">
            Project name
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Acme Support or Store Assistant"
            disabled={atLimit || busy}
            className={inputStyles}
          />
          <button
            type="submit"
            disabled={atLimit || busy || name.trim() === ""}
            className={`${buttonStyles} bg-foreground text-background hover:opacity-90 disabled:cursor-not-allowed`}
          >
            <Plus className="h-4 w-4" />
            <span>{busy ? "Creating..." : "Create project"}</span>
          </button>
        </form>

        {atLimit && !isPro && (
          <p className="mt-3 text-xs text-muted">
            You have reached the 1 project limit on Free.{" "}
            <Link href="/dashboard/billing" className="font-medium text-brand hover:underline">
              Upgrade to Pro
            </Link>{" "}
            to create up to 5 projects.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      {/* 3. Projects List */}
      <section aria-label="Your Projects" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">
            Your projects ({projects.length})
          </h2>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create your first project above to generate a chat widget for your website."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="glass rounded-2xl p-5 transition-all hover:border-foreground/20"
              >
                {editingId === project.id ? (
                  <form
                    onSubmit={(e) => rename(e, project.id)}
                    className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center"
                  >
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
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={busy || editName.trim() === ""}
                        className={`${buttonStyles} bg-foreground text-background hover:opacity-90`}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className={`${buttonStyles} glass`}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Top Row: Name, Live Badge, Public Key Pill */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-lg font-semibold tracking-tight">{project.name}</h3>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-glass px-2.5 py-0.5 text-xs text-muted">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Live widget
                        </span>
                        <span className="text-xs text-muted">
                          Created{" "}
                          {new Date(project.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Public key copy pill */}
                      <button
                        type="button"
                        onClick={() => copyKey(project)}
                        title="Click to copy public key"
                        className="group inline-flex items-center gap-1.5 self-start rounded-full border border-border/80 bg-glass px-3 py-1 text-xs text-muted transition-colors hover:text-foreground hover:border-foreground/30 sm:self-auto"
                      >
                        {copiedId === project.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="font-medium text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
                            <span className="font-mono text-[11px]">
                              {project.publicKey.slice(0, 14)}...
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Middle Row: Description & Usage */}
                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 md:items-center">
                      <div className="text-xs text-muted">
                        {project.about ? (
                          <p className="line-clamp-2 leading-relaxed text-foreground/80">
                            {project.about}
                          </p>
                        ) : (
                          <p className="italic text-muted">
                            No business description set. Add one in{" "}
                            <Link
                              href={`/dashboard/knowledge?project=${project.id}`}
                              className="underline hover:text-foreground"
                            >
                              Knowledge
                            </Link>{" "}
                            to give the AI background context.
                          </p>
                        )}
                      </div>

                      {usage[project.id] && (
                        <div className="md:ml-auto md:w-full md:max-w-xs">
                          <UsageMeter usage={usage[project.id]!} compact />
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/conversations?project=${project.id}`}
                          className={`${buttonStyles} glass text-xs hover:border-foreground/30`}
                        >
                          <Chat className="h-3.5 w-3.5" />
                          <span>
                            Conversations
                            {conversations[project.id] ? ` (${conversations[project.id]})` : ""}
                          </span>
                        </Link>
                        <Link
                          href={`/dashboard/knowledge?project=${project.id}`}
                          className={`${buttonStyles} glass text-xs hover:border-foreground/30`}
                        >
                          <Document className="h-3.5 w-3.5" />
                          <span>Knowledge</span>
                        </Link>
                        <Link
                          href={`/dashboard/customize?project=${project.id}`}
                          className={`${buttonStyles} glass text-xs hover:border-foreground/30`}
                        >
                          <Sliders className="h-3.5 w-3.5" />
                          <span>Customize</span>
                        </Link>
                        <Link
                          href={`/dashboard/install?project=${project.id}`}
                          className={`${buttonStyles} glass text-xs hover:border-foreground/30`}
                        >
                          <Code className="h-3.5 w-3.5" />
                          <span>Install</span>
                        </Link>
                      </div>

                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(project.id);
                            setEditName(project.name);
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs text-muted transition-colors hover:text-foreground hover:bg-glass"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Rename</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(project)}
                          disabled={busy}
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs text-muted transition-colors hover:text-red-700 hover:bg-red-500/10"
                        >
                          <Trash className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
