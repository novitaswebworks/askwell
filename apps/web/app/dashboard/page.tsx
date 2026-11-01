import { EmptyState } from "@/components/empty-state";

export default function ProjectsPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Projects</h1>
      <EmptyState
        title="No projects yet"
        description="Create a project to get a chat widget for your website."
      />
    </>
  );
}
