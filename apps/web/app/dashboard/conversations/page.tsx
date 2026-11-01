import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Conversations</h1>
      <EmptyState title="No conversations yet" description="Chats from your widget will show up here." />
    </>
  );
}
