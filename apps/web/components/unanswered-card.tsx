import Link from "next/link";
import { parseSavedAnswers } from "@/lib/answers";
import { createOwnerClient } from "@/lib/supabase/owner";
import { loadUnanswered } from "@/lib/unanswered";

export function UnansweredSkeleton() {
  return <div className="glass h-40 animate-pulse rounded-2xl" aria-busy="true" aria-label="Loading unanswered questions" />;
}

// What visitors asked that the assistant could not answer, for one project, so the owner sees
// the gap on the home page and can go fill it. It streams in on its own and says nothing when
// there is nothing to show or the read fails: it only decorates the page.
export async function UnansweredCard({ projectId, projectName }: { projectId: string; projectName: string }) {
  let items: Awaited<ReturnType<typeof loadUnanswered>> = [];
  try {
    const answers = Promise.resolve(
      createOwnerClient().from("knowledge_sources").select("answers").eq("project_id", projectId).not("answers", "is", null).limit(1).maybeSingle(),
    ).then(({ data }) => parseSavedAnswers(data?.answers)?.items.map((i) => i.question) ?? []);
    items = await loadUnanswered(projectId, answers);
  } catch {
    return null;
  }
  if (items.length === 0) return null;

  const shown = items.slice(0, 5);
  return (
    <section aria-labelledby="unanswered-heading" className="glass flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="unanswered-heading" className="font-medium">
          Visitors asked, and your assistant didn&apos;t know
        </h2>
        <Link href={`/dashboard/knowledge?project=${projectId}`} className="text-sm font-medium text-brand hover:underline">
          Add answers →
        </Link>
      </div>
      <p className="text-xs text-muted">{projectName}</p>
      <ul className="flex flex-col gap-2 text-sm">
        {shown.map((u) => (
          <li key={u.question} className="flex items-start justify-between gap-3">
            <span className="min-w-0 break-words">{u.question}</span>
            {u.count > 1 && <span className="shrink-0 text-muted">asked {u.count} times</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
