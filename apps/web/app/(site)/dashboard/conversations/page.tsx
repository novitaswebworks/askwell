import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Suspense } from "react";
import { getPlanLimits } from "@askwell/shared";
import { ButtonLink } from "@/components/button-link";
import { ConversationSearch } from "@/components/conversation-search";
import { EmptyState } from "@/components/empty-state";
import { LocalTime } from "@/components/local-time";
import { RefreshButton } from "@/components/refresh-button";
import { UsageMeter } from "@/components/usage-meter";
import { getAccountPlan } from "@/lib/accounts";
import { CONVERSATION_PAGE_SIZE, MAX_SEARCH_TERM, listConversations } from "@/lib/conversations";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { createOwnerClient } from "@/lib/supabase/owner";
import { usageThisMonth } from "@/lib/usage";

function Skeleton() {
  return <div className="glass h-40 animate-pulse" aria-busy="true" aria-label="Loading" />;
}

// The heading is the instant shell; the data streams in behind the skeleton.
type Search = { project?: string; q?: string; filter?: string };

export default function ConversationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Conversations</h1>
      <Suspense fallback={<Skeleton />}>
        <ConversationsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ConversationsContent({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId } = await auth();
  if (!userId) return null; // the proxy already sends signed-out visitors to sign-in
  const { project: selectedId, q: rawQ, filter } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, MAX_SEARCH_TERM);
  const unhelpful = filter === "unhelpful";

  const owner = createOwnerClient();
  const [plan, { data, error }] = await Promise.all([
    getAccountPlan(userId),
    owner.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: true }),
  ]);
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  const projects = (data as ProjectRow[]).map(toProject);
  const project = projects.find((p) => p.id === selectedId) ?? projects[0];
  if (!project) {
    return (
      <EmptyState
        title="No project yet"
        description="Create a project and install the widget. Its conversations will show up here."
        action={<ButtonLink href="/dashboard">Create a project</ButtonLink>}
      />
    );
  }

  const conversations = await listConversations(owner, project.id, CONVERSATION_PAGE_SIZE, { q, unhelpful });
  const filtered = q !== "" || unhelpful;
  const usage = usageThisMonth(project, getPlanLimits(plan).messagesPerMonth, new Date());

  return (
    <div className="flex flex-col gap-4">
      {projects.length > 1 && (
        <nav aria-label="Project" className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/conversations?project=${p.id}`}
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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <UsageMeter usage={usage} />
        <RefreshButton />
      </div>

      <ConversationSearch projectId={project.id} q={q} unhelpful={unhelpful} />

      {conversations.length === 0 && filtered ? (
        <EmptyState
          title="No conversations match"
          description="Try different words, or clear the search to see everything."
          action={<ButtonLink href={`/dashboard/conversations?project=${project.id}`}>Clear search</ButtonLink>}
        />
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Chats from your widget will show up here. Send a test message on a page with the widget, then refresh."
          action={<ButtonLink href={`/dashboard/install?project=${project.id}`}>Install the widget</ButtonLink>}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/conversations/${c.id}?project=${project.id}`}
                  className="glass block p-4 transition-colors hover:bg-glass-strong"
                >
                  <p className="ph-no-capture line-clamp-2 break-words font-medium">
                    {c.firstMessage || "(no message)"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {c.messageCount} {c.messageCount === 1 ? "message" : "messages"} · <LocalTime iso={c.createdAt} />
                    {c.notHelpful > 0 && <span className="ml-2 font-medium text-red-700">👎 {c.notHelpful}</span>}
                    {c.helpful > 0 && <span className="ml-2 font-medium text-emerald-600">👍 {c.helpful}</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {conversations.length === CONVERSATION_PAGE_SIZE && (
            <p className="text-center text-xs text-muted">Showing the latest {CONVERSATION_PAGE_SIZE}.</p>
          )}
        </>
      )}
    </div>
  );
}
