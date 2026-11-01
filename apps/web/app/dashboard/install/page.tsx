import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Install</h1>
      <EmptyState title="Nothing to install yet" description="Create a project to get your script tag." />
    </>
  );
}
