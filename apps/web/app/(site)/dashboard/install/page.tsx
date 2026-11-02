import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { AllowedDomainsForm } from "@/components/allowed-domains-form";
import { CopyBlock } from "@/components/copy-block";
import { InstallStatus } from "@/components/install-status";
import { PlatformSteps } from "@/components/platform-steps";
import {
  AI_TOOLS,
  PLATFORMS,
  buildAiPrompt,
  buildDeveloperMessage,
  buildSnippet,
  connectionState,
  mailtoLink,
} from "@/lib/install";
import { ButtonLink } from "@/components/button-link";
import { requireEnv } from "@/lib/supabase/env";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { createOwnerClient } from "@/lib/supabase/owner";

// Read in a helper so the render itself stays free of impure calls.
function currentTime(): number {
  return Date.now();
}

function Skeleton() {
  return <div className="glass h-40 animate-pulse" aria-busy="true" aria-label="Loading" />;
}

// The heading is the instant shell; the data streams in behind the skeleton.
export default function InstallPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Install</h1>
      <Suspense fallback={<Skeleton />}>
        <InstallContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InstallContent({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project: selectedId } = await searchParams;
  const { data, error } = await createOwnerClient()
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  const projects = (data as ProjectRow[]).map(toProject);
  const project = projects.find((p) => p.id === selectedId) ?? projects[0];
  const appUrl = requireEnv("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, "");

  const seen = project
    ? await createOwnerClient()
        .from("widget_configs")
        .select("last_seen_at, last_seen_host")
        .eq("project_id", project.id)
        .maybeSingle()
    : null;
  if (seen?.error) throw new Error(`Could not load install status: ${seen.error.message}`);

  const snippet = project ? buildSnippet(appUrl, project.publicKey) : "";
  const connection = connectionState(seen?.data?.last_seen_at ?? null, seen?.data?.last_seen_host ?? null, currentTime());
  const message = buildDeveloperMessage(snippet);

  return (
    <>
      {!project ? (
        <EmptyState
          title="Nothing to install yet"
          description="Create a project to get your code."
          action={<ButtonLink href="/dashboard">Create a project</ButtonLink>}
        />
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          {projects.length > 1 && (
            <nav aria-label="Project" className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/install?project=${p.id}`}
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

          <InstallStatus key={project.id} connection={connection} seenAt={seen?.data?.last_seen_at ?? null} />

          <section className="glass flex flex-col gap-3 p-4">
            <h2 className="text-lg font-semibold">1. Copy your code</h2>
            <p className="text-sm text-muted">
              This is one line that adds the chat to your website. It is safe to share: it only tells Askwell which
              project it belongs to and gives no access to your account.
            </p>
            <CopyBlock key={`snippet-${project.id}`} text={snippet} kind="snippet" label="Copy code" />
          </section>

          <AllowedDomainsForm
            key={project.id}
            projectId={project.id}
            domains={project.allowedDomains}
            seenHost={seen?.data?.last_seen_host ?? null}
          />

          <section className="glass flex flex-col gap-3 p-4">
            <h2 className="text-lg font-semibold">2. Paste it into your website</h2>
            <p className="text-sm text-muted">Choose what your website is built with to see where it goes.</p>
            <PlatformSteps key={`platforms-${project.id}`} platforms={PLATFORMS} />
          </section>

          <section className="glass flex flex-col gap-3 p-4">
            <h2 className="text-lg font-semibold">Stuck? Let an AI guide you</h2>
            <p className="text-sm text-muted">
              Copy this, open a free AI chat, and paste it. It will ask what your website uses and walk you through, one
              step at a time.
            </p>
            <CopyBlock
              key={`ai-${project.id}`}
              text={buildAiPrompt(snippet)}
              kind="ai_prompt"
              label="Copy the AI helper message"
              fold="Show what it says"
            />
            <div className="flex flex-wrap gap-2 text-sm">
              {AI_TOOLS.map((t) => (
                <a
                  key={t.label}
                  href={t.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass inline-flex h-10 items-center rounded-full px-4"
                >
                  Open {t.label}
                </a>
              ))}
            </div>
          </section>

          <section className="glass flex flex-col gap-3 p-4">
            <h2 className="text-lg font-semibold">Someone else builds your website?</h2>
            <p className="text-sm text-muted">Send them this message. It has everything they need.</p>
            <CopyBlock
              key={`message-${project.id}`}
              text={message}
              kind="developer_message"
              label="Copy the message"
              fold="Show the message"
            />
            <a
              href={mailtoLink("Please add a chat assistant to our website", message)}
              className="glass inline-flex h-10 items-center self-start rounded-full px-4 text-sm"
            >
              Write an email with it
            </a>
          </section>
        </div>
      )}
    </>
  );
}
