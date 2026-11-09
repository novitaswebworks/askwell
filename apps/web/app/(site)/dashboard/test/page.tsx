import { Suspense } from "react";
import { ButtonLink } from "@/components/button-link";
import { EmptyState } from "@/components/empty-state";
import { TestAssistant } from "@/components/test-assistant";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { createOwnerClient } from "@/lib/supabase/owner";

function Skeleton() {
  return <div className="glass h-40 animate-pulse" aria-busy="true" aria-label="Loading" />;
}

// The heading is the instant shell; the data streams in behind the skeleton.
export default function TestPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Test your assistant</h1>
      <p className="mb-4 mt-1 text-sm text-muted">
        Ask a question the way a visitor would, and see which parts of your knowledge it used. Nothing is saved and it
        does not use up your messages.
      </p>
      <Suspense fallback={<Skeleton />}>
        <TestContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function TestContent({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project: selectedId } = await searchParams;
  const { data, error } = await createOwnerClient().from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  const projects = (data as ProjectRow[]).map(toProject);
  const project = projects.find((p) => p.id === selectedId) ?? projects[0];
  if (!project) {
    return (
      <EmptyState
        title="No project yet"
        description="Create a project and add knowledge, then try questions here."
        action={<ButtonLink href="/dashboard">Create a project</ButtonLink>}
      />
    );
  }
  return <TestAssistant key={project.id} projectId={project.id} projectName={project.name} />;
}
