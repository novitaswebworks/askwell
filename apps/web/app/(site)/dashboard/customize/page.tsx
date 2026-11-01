import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Suspense } from "react";
import { DEFAULT_WIDGET_CONFIG, getPlanLimits, type WidgetConfig } from "@askwell/shared";
import { ButtonLink } from "@/components/button-link";
import { CustomizeManager } from "@/components/customize-manager";
import { EmptyState } from "@/components/empty-state";
import { getAccountPlan } from "@/lib/accounts";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { createOwnerClient } from "@/lib/supabase/owner";

function Skeleton() {
  return <div className="glass h-96 animate-pulse" aria-busy="true" aria-label="Loading" />;
}

// The heading is the instant shell; data streams in behind the skeleton.
export default function CustomizePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Customize</h1>
      <Suspense fallback={<Skeleton />}>
        <CustomizeContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomizeContent({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { userId } = await auth();
  if (!userId) return null;
  const { project: selectedId } = await searchParams;

  const owner = createOwnerClient();
  const [plan, { data, error }] = await Promise.all([
    getAccountPlan(userId),
    owner.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: true }),
  ]);
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  const projects = (data as ProjectRow[]).map(toProject);
  const project = projects.find((p) => p.id === selectedId) ?? projects[0];

  let config: WidgetConfig = DEFAULT_WIDGET_CONFIG;
  if (project) {
    const { data: row, error: configError } = await owner
      .from("widget_configs")
      .select("button_color, position, label, animation, header_text, show_badge")
      .eq("project_id", project.id)
      .maybeSingle();
    if (configError) throw new Error(`Could not load widget config: ${configError.message}`);
    if (row) {
      config = {
        buttonColor: row.button_color,
        position: row.position,
        label: row.label,
        animation: row.animation,
        headerText: row.header_text,
        showBadge: row.show_badge,
      };
    }
  }

  return (
    <>
      {!project ? (
        <EmptyState
          title="No project yet"
          description="Create a project to customize the chat widget."
          action={<ButtonLink href="/dashboard">Create a project</ButtonLink>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {projects.length > 1 && (
            <nav aria-label="Project" className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/customize?project=${p.id}`}
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
          <CustomizeManager
            key={project.id}
            projectId={project.id}
            initialConfig={config}
            canCustomize={getPlanLimits(plan).canCustomize}
          />
        </div>
      )}
    </>
  );
}
