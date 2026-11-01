import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { getPlanLimits } from "@askwell/shared";
import { ProjectsManager } from "@/components/projects-manager";
import { getAccountPlan } from "@/lib/accounts";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { createOwnerClient } from "@/lib/supabase/owner";

function Skeleton() {
  return <div className="glass h-40 animate-pulse" aria-busy="true" aria-label="Loading" />;
}

// The heading is the instant shell; the data streams in behind the skeleton.
export default function ProjectsPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Projects</h1>
      <Suspense fallback={<Skeleton />}>
        <ProjectsContent />
      </Suspense>
    </>
  );
}

async function ProjectsContent() {
  const { userId } = await auth();
  if (!userId) return null; // the proxy already sends signed-out visitors to sign-in

  const [plan, { data, error }] = await Promise.all([
    getAccountPlan(userId),
    createOwnerClient().from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: true }),
  ]);
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  return (
    <ProjectsManager
      projects={(data as ProjectRow[]).map(toProject)}
      maxProjects={getPlanLimits(plan).maxProjects}
    />
  );
}
