import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Customize</h1>
      <EmptyState title="Create a project first" description="Pick a project to change the widget's look." />
    </>
  );
}
