import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Suspense } from "react";
import { getPlanLimits } from "@askwell/shared";
import { AboutForm } from "@/components/about-form";
import { ButtonLink } from "@/components/button-link";
import { EmptyState } from "@/components/empty-state";
import { KnowledgeManager } from "@/components/knowledge-manager";
import { getAccountPlan } from "@/lib/accounts";
import { SOURCE_COLUMNS, toSource, type SourceRow } from "@/lib/knowledge/sources";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { createOwnerClient } from "@/lib/supabase/owner";

function Skeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading knowledge">
      <div className="glass h-48 animate-pulse rounded-2xl" />
      <div className="glass h-80 animate-pulse rounded-2xl" />
      <div className="glass h-44 animate-pulse rounded-2xl" />
    </div>
  );
}

// The heading is the instant shell; the data streams in behind the skeleton.
export default function KnowledgePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
        <p className="mt-1 text-sm text-muted">
          Train your AI assistant with business context, documentation, and answers.
        </p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <KnowledgeContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function KnowledgeContent({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { userId } = await auth();
  if (!userId) return null; // the proxy already sends signed-out visitors to sign-in
  const { project: selectedId } = await searchParams;

  const owner = createOwnerClient();
  const [plan, { data, error }] = await Promise.all([
    getAccountPlan(userId),
    owner.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: true }),
  ]);
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  const projects = (data as ProjectRow[]).map(toProject);
  const project = projects.find((p) => p.id === selectedId) ?? projects[0];

  let sources: ReturnType<typeof toSource>[] = [];
  if (project) {
    const { data: rows, error: sourcesError } = await owner
      .from("knowledge_sources")
      .select(SOURCE_COLUMNS)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    if (sourcesError) throw new Error(`Could not load knowledge: ${sourcesError.message}`);
    sources = (rows as SourceRow[]).map(toSource);
  }

  return (
    <>
      {!project ? (
        <EmptyState
          title="No project yet"
          description="Create a project first, then add the knowledge documents your bot should answer from."
          action={<ButtonLink href="/dashboard">Create a project</ButtonLink>}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {projects.length > 1 && (
            <nav aria-label="Project selector" className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/knowledge?project=${p.id}`}
                  aria-current={p.id === project.id ? "page" : undefined}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    p.id === project.id
                      ? "bg-foreground text-background shadow-xs"
                      : "glass hover:text-foreground"
                  }`}
                >
                  {p.name}
                </Link>
              ))}
            </nav>
          )}

          <AboutForm key={project.id} projectId={project.id} about={project.about} />

          <KnowledgeManager
            projectId={project.id}
            sources={sources}
            maxSources={getPlanLimits(plan).maxKnowledgeSources}
            plan={plan}
          />
        </div>
      )}
    </>
  );
}
