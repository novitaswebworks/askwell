import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import type { Lead } from "@askwell/shared";
import { ButtonLink } from "@/components/button-link";
import { EmptyState } from "@/components/empty-state";
import { LeadsManager } from "@/components/leads-manager";
import { getAccountPlan } from "@/lib/accounts";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { createOwnerClient } from "@/lib/supabase/owner";

function Skeleton() {
  return <div className="glass h-96 animate-pulse rounded-2xl" aria-busy="true" aria-label="Loading leads" />;
}

export default function LeadsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads & Contacts</h1>
        <p className="mt-1 text-sm text-muted">
          Review visitor contact details, follow-up requests, and human handoffs from your chat widget.
        </p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <LeadsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LeadsContent({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { userId } = await auth();
  if (!userId) return null;

  const { project: selectedId } = await searchParams;

  const owner = createOwnerClient();
  const [plan, { data, error }] = await Promise.all([
    getAccountPlan(userId),
    owner.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: true }),
  ]);

  if (error) throw new Error(`Could not load projects: ${error.message}`);

  // Pro feature gate: check on the server
  if (plan !== "pro") {
    return (
      <div className="glass flex flex-col items-center justify-center rounded-2xl border border-brand/20 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">Lead Capture is a Pro Feature</h2>
        <p className="mt-2 max-w-md text-sm text-muted leading-relaxed">
          Capture visitor emails and phone numbers when your AI assistant can&apos;t answer or when visitors ask to talk to a person.
          Receive real-time email notifications and export your leads to CSV.
        </p>
        <div className="mt-6">
          <ButtonLink href="/dashboard/billing">Upgrade to Pro</ButtonLink>
        </div>
      </div>
    );
  }

  const projects = (data as ProjectRow[]).map(toProject);
  const project = projects.find((p) => p.id === selectedId) ?? projects[0];

  if (!project) {
    return (
      <EmptyState
        title="No project yet"
        description="Create a project to start capturing leads from your chat widget."
        action={<ButtonLink href="/dashboard">Create a project</ButtonLink>}
      />
    );
  }

  const { data: leadsRows, error: leadsError } = await owner
    .from("leads")
    .select("id, project_id, conversation_id, email, name, phone, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  if (leadsError) throw new Error(`Could not load leads: ${leadsError.message}`);

  const initialLeads: Lead[] = (leadsRows ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    conversationId: row.conversation_id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    createdAt: row.created_at,
  }));

  return (
    <LeadsManager
      projects={projects}
      selectedProjectId={project.id}
      initialLeads={initialLeads}
    />
  );
}
