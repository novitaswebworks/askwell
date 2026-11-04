import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { getPlanLimits } from "@askwell/shared";
import { AboutForm } from "@/components/about-form";
import { AnswerBuilder } from "@/components/answer-builder";
import { CopyBlock } from "@/components/copy-block";
import { ButtonLink } from "@/components/button-link";
import { EmptyState } from "@/components/empty-state";
import { KnowledgeManager } from "@/components/knowledge-manager";
import { getAccountPlan } from "@/lib/accounts";
import { buildInterviewPrompt, parseSavedAnswers } from "@/lib/answers";
import { loadUnanswered } from "@/lib/unanswered";
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
  let saved: ReturnType<typeof parseSavedAnswers> = null;
  let unanswered: Awaited<ReturnType<typeof loadUnanswered>> = [];
  if (project) {
    // Three independent reads at once instead of one after another. Each is a trip to the
    // database, and the page cannot show anything until the slowest one is back.
    const answersRead = Promise.resolve(
      owner.from("knowledge_sources").select("answers").eq("project_id", project.id).not("answers", "is", null).limit(1).maybeSingle(),
    );
    const answeredQuestions = answersRead.then(({ data: row }) => parseSavedAnswers(row?.answers)?.items.map((i) => i.question) ?? []);
    const [{ data: rows, error: sourcesError }, { data: answersRow, error: answersError }, unansweredList] = await Promise.all([
      owner.from("knowledge_sources").select(SOURCE_COLUMNS).eq("project_id", project.id).order("created_at", { ascending: false }),
      answersRead,
      loadUnanswered(project.id, answeredQuestions),
    ]);
    if (sourcesError) throw new Error(`Could not load knowledge: ${sourcesError.message}`);
    if (answersError) throw new Error(`Could not load answers: ${answersError.message}`);
    sources = (rows as SourceRow[]).map(toSource);
    saved = parseSavedAnswers(answersRow?.answers);
    unanswered = unansweredList;
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

          <AboutForm key={project.id} projectId={project.id} about={project.about} />

          <AnswerBuilder key={`answers-${project.id}`} projectId={project.id} saved={saved} unanswered={unanswered} />

          <KnowledgeManager
            key={`sources-${project.id}`}
            projectId={project.id}
            sources={sources}
            maxSources={getPlanLimits(plan).maxKnowledgeSources}
            plan={plan}
          />

          <section className="glass flex flex-col gap-3 p-5" aria-labelledby="interview-heading">
            <h2 id="interview-heading" className="text-lg font-semibold">
              Rather talk than type? Let an AI interview you
            </h2>
            <p className="text-sm text-muted">
              Copy this into a free AI chat. It asks about your business one question at a time, then writes a document.
              Paste that document into &ldquo;Paste text&rdquo; above.
            </p>
            <CopyBlock
              key={`interview-${project.id}`}
              text={buildInterviewPrompt()}
              kind="interview_prompt"
              label="Copy the interview message"
              fold="Show what it says"
            />
          </section>

          <section className="glass flex flex-col gap-3 p-5" aria-labelledby="try-heading">
            <h2 id="try-heading" className="text-lg font-semibold">
              Try your assistant
            </h2>
            <p className="text-sm text-muted">
              Ask it what a customer would. Questions it can&apos;t answer show up above. These chats count toward your
              monthly messages.
            </p>
            <iframe
              key={`${project.id}-${sources.length}-${saved?.items.length ?? 0}`}
              title="Try your assistant"
              src={`/embed?key=${encodeURIComponent(project.publicKey)}`}
              className="h-[30rem] w-full max-w-md rounded-2xl border border-border bg-white"
            />
          </section>
        </div>
      )}
    </>
  );
}
