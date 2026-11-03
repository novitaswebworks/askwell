import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { getPlanLimits } from "@askwell/shared";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { ProjectsManager } from "@/components/projects-manager";
import { getAccountPlan } from "@/lib/accounts";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { usageThisMonth } from "@/lib/usage";
import { createOwnerClient } from "@/lib/supabase/owner";

function Skeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading projects">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass h-24 animate-pulse rounded-2xl" />
        <div className="glass h-24 animate-pulse rounded-2xl" />
        <div className="glass h-24 animate-pulse rounded-2xl" />
      </div>
      <div className="glass h-36 animate-pulse rounded-2xl" />
      <div className="glass h-48 animate-pulse rounded-2xl" />
    </div>
  );
}

// The heading is the instant shell; the data streams in behind the skeleton.
export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your AI chat widgets, training data, and appearance.
        </p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <ProjectsContent />
      </Suspense>
    </div>
  );
}

async function ProjectsContent() {
  const { userId } = await auth();
  if (!userId) return null; // the proxy already sends signed-out visitors to sign-in

  const owner = createOwnerClient();
  // All at once: each is a trip to the database. The last three only feed the checklist and the
  // conversation counts, so if one fails the page still works.
  const [plan, { data, error }, activityResult, sourcesResult, seenResult] = await Promise.all([
    getAccountPlan(userId),
    owner.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: true }),
    owner.rpc("owner_activity"),
    owner.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("status", "ready"),
    owner.from("widget_configs").select("project_id").not("last_seen_host", "is", null).limit(1),
  ]);
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  const projects = (data as ProjectRow[]).map(toProject);
  const limits = getPlanLimits(plan);
  const now = new Date();
  const usage = Object.fromEntries(projects.map((p) => [p.id, usageThisMonth(p, limits.messagesPerMonth, now)]));

  const activity = (activityResult.data ?? []) as { project_id: string; conversation_count: number | string }[];
  const conversations = Object.fromEntries(activity.map((a) => [a.project_id, Number(a.conversation_count)]));
  const facts = {
    projects: projects.length,
    readySources: sourcesResult.count ?? 0,
    widgetSeen: (seenResult.data ?? []).length > 0,
    conversations: Object.values(conversations).reduce((sum, n) => sum + n, 0),
  };

  return (
    <div className="flex flex-col gap-6">
      {projects.length > 0 && <OnboardingChecklist facts={facts} projectId={projects[0].id} />}
      <ProjectsManager
        projects={projects}
        maxProjects={limits.maxProjects}
        usage={usage}
        conversations={conversations}
        plan={plan}
      />
    </div>
  );
}
