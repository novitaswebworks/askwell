import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { CopySnippet } from "@/components/copy-snippet";
import { ButtonLink } from "@/components/button-link";
import { requireEnv } from "@/lib/supabase/env";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { createOwnerClient } from "@/lib/supabase/owner";

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

  return (
    <>
      {!project ? (
        <EmptyState
          title="Nothing to install yet"
          description="Create a project to get your script tag."
          action={<ButtonLink href="/dashboard">Create a project</ButtonLink>}
        />
      ) : (
        <div className="flex flex-col gap-4">
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
          <CopySnippet
            snippet={`<script src="${appUrl}/widget.js" data-key="${project.publicKey}"></script>`}
          />
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Copy the snippet.</li>
            <li>
              Paste it into your page, just before the closing <code>&lt;/body&gt;</code> tag.
            </li>
            <li>Reload the page. The chat button appears in the corner.</li>
          </ol>
        </div>
      )}
    </>
  );
}
