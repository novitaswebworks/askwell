import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { getPlanLimits } from "@askwell/shared";
import { ProjectsManager } from "@/components/projects-manager";
import { getAccountPlan } from "@/lib/accounts";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { usageThisMonth } from "@/lib/usage";
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

  const owner = createOwnerClient();
  const [plan, { data, error }] = await Promise.all([
    getAccountPlan(userId),
    owner.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: true }),
  ]);
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  const projects = (data as ProjectRow[]).map(toProject);
  const limits = getPlanLimits(plan);
  const now = new Date();
  const usage = Object.fromEntries(projects.map((p) => [p.id, usageThisMonth(p, limits.messagesPerMonth, now)]));

  // Conversation counts are a nicety: if they fail to load, the page still works.
  const { data: activity } = await owner.rpc("owner_activity");
  const conversations = Object.fromEntries(
    ((activity ?? []) as { project_id: string; conversation_count: number | string }[]).map((a) => [
      a.project_id,
      Number(a.conversation_count),
    ]),
  );

  return (
    <ProjectsManager
      projects={projects}
      maxProjects={limits.maxProjects}
      usage={usage}
      conversations={conversations}
    />
  );
}
