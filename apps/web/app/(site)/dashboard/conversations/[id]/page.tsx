import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LocalTime } from "@/components/local-time";
import { RefreshButton } from "@/components/refresh-button";
import { getThread } from "@/lib/conversations";
import { isUuid } from "@/lib/api";
import { createOwnerClient } from "@/lib/supabase/owner";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ project?: string }> };

function Skeleton() {
  return <div className="glass h-64 animate-pulse" aria-busy="true" aria-label="Loading" />;
}

export default function ConversationPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Thread params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Thread({ params, searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null; // the proxy already sends signed-out visitors to sign-in
  const { id } = await params;
  const { project } = await searchParams;
  if (!isUuid(id)) notFound();

  // Owner client: another owner's conversation is simply not found.
  const thread = await getThread(createOwnerClient(), id);
  if (!thread) notFound();

  const back = `/dashboard/conversations?project=${project && isUuid(project) ? project : thread.projectId}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={back} className="text-sm text-muted transition-colors hover:text-foreground">
            ← All conversations
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Conversation</h1>
          <p className="text-xs text-muted">
            Started <LocalTime iso={thread.createdAt} /> · {thread.messages.length}{" "}
            {thread.messages.length === 1 ? "message" : "messages"}
          </p>
        </div>
        <RefreshButton />
      </div>

      <ol className="glass flex flex-col gap-3 p-4 md:p-6" aria-label="Messages">
        {thread.messages.map((m) => (
          <li key={m.id} className={`flex flex-col ${m.role === "visitor" ? "items-end" : "items-start"}`}>
            <p className="mb-1 text-xs text-muted">{m.role === "visitor" ? "Visitor" : "Assistant"}</p>
            {/* Plain text, never HTML: visitors write these (project.md section 9). */}
            <p
              className={`ph-no-capture max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "visitor" ? "bg-accent text-accent-foreground" : "bg-glass-strong"
              }`}
            >
              {m.body}
            </p>
            <p className="mt-1 text-xs text-muted">
              <LocalTime iso={m.createdAt} />
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
