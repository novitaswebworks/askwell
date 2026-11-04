import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { getPlanLimits } from "@askwell/shared";
import { OverviewStats } from "@/components/overview-stats";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { ProjectsManager } from "@/components/projects-manager";
import { getAccountPlan } from "@/lib/accounts";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { NO_ANSWER_VARIANTS } from "@/lib/chat";
import { buildOverview, MAX_OVERVIEW_ROWS, sinceIso } from "@/lib/overview";
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
  const now = new Date();
  const since = sinceIso(now);
  const [plan, { data, error }, activityResult, sourcesResult, seenResult, visitorRows, convoCount, botCount, noAnswerCount, upCount, downCount] = await Promise.all([
    getAccountPlan(userId),
    owner.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: true }),
    owner.rpc("owner_activity"),
    owner.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("status", "ready"),
    owner.from("widget_configs").select("project_id").not("last_seen_host", "is", null).limit(1),
    // The 30-day overview. Like the three above it only decorates the page, so a failure shows zeros.
    owner.from("messages").select("created_at").eq("role", "visitor").gte("created_at", since).order("created_at", { ascending: false }).limit(MAX_OVERVIEW_ROWS),
    owner.from("conversations").select("id", { count: "exact", head: true }).gte("created_at", since),
    owner.from("messages").select("id", { count: "exact", head: true }).eq("role", "bot").gte("created_at", since),
    owner.from("messages").select("id", { count: "exact", head: true }).eq("role", "bot").in("body", NO_ANSWER_VARIANTS).gte("created_at", since),
    owner.from("messages").select("id", { count: "exact", head: true }).eq("rating", 1).gte("created_at", since),
    owner.from("messages").select("id", { count: "exact", head: true }).eq("rating", -1).gte("created_at", since),
  ]);
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  const projects = (data as ProjectRow[]).map(toProject);
  const limits = getPlanLimits(plan);
  const usage = Object.fromEntries(projects.map((p) => [p.id, usageThisMonth(p, limits.messagesPerMonth, now)]));

  const activity = (activityResult.data ?? []) as { project_id: string; conversation_count: number | string }[];
  const conversations = Object.fromEntries(activity.map((a) => [a.project_id, Number(a.conversation_count)]));
  const facts = {
    projects: projects.length,
    readySources: sourcesResult.count ?? 0,
    widgetSeen: (seenResult.data ?? []).length > 0,
    conversations: Object.values(conversations).reduce((sum, n) => sum + n, 0),
  };

  const overview = buildOverview({
    visitorMessageTimes: ((visitorRows.data ?? []) as { created_at: string }[]).map((r) => r.created_at),
    conversations: convoCount.count ?? 0,
    botReplies: botCount.count ?? 0,
    unansweredReplies: noAnswerCount.count ?? 0,
    thumbsUp: upCount.count ?? 0,
    thumbsDown: downCount.count ?? 0,
    now,
  });

  return (
    <div className="flex flex-col gap-6">
      {projects.length > 0 && <OverviewStats overview={overview} />}
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
