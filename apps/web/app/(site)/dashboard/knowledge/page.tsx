import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Knowledge</h1>
      <EmptyState title="No knowledge yet" description="Add text or upload a PDF so the bot can answer from it." />
    </>
  );
}
