import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Billing</h1>
      <EmptyState title="You are on the Free plan" description="Upgrade to Pro for more projects, messages and customization." />
    </>
  );
}
