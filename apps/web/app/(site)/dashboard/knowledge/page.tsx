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
  return <div className="glass h-40 animate-pulse" aria-busy="true" aria-label="Loading" />;
}

// The heading is the instant shell; the data streams in behind the skeleton.
export default function KnowledgePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Knowledge</h1>
      <Suspense fallback={<Skeleton />}>
        <KnowledgeContent searchParams={searchParams} />
      </Suspense>
    </>
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
          description="Create a project, then add the text or files the bot should answer from."
          action={<ButtonLink href="/dashboard">Create a project</ButtonLink>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {projects.length > 1 && (
            <nav aria-label="Project" className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/knowledge?project=${p.id}`}
                  aria-current={p.id === project.id ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm ${
                    p.id === project.id ? "bg-accent text-accent-foreground" : "glass"
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
          />
        </div>
      )}
    </>
  );
}
