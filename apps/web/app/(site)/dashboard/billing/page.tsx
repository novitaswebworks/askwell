import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { PLAN_LIMITS } from "@askwell/shared";
import { BillingActions } from "@/components/billing-actions";
import { getAccountPlan } from "@/lib/accounts";
import { cashfreeMode } from "@/lib/cashfree";

function Skeleton() {
  return <div className="glass h-40 animate-pulse" aria-busy="true" aria-label="Loading" />;
}

type Props = { searchParams: Promise<{ checkout?: string }> };

// The heading is the instant shell; the data streams in behind the skeleton.
export default function BillingPage({ searchParams }: Props) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Billing</h1>
      <Suspense fallback={<Skeleton />}>
        <BillingContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BillingContent({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null; // the proxy already sends signed-out visitors to sign-in
  const { checkout } = await searchParams;

  // The server decides the plan; this page only shows it (project.md section 5).
  const plan = await getAccountPlan(userId);
  const limits = PLAN_LIMITS[plan];

  return (
    <div className="flex flex-col gap-6">
      <div className="glass p-5">
        <p className="text-sm text-muted">Your plan</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{plan === "pro" ? "Pro" : "Free"}</p>
        <p className="mt-2 text-sm text-muted">
          {limits.maxProjects} {limits.maxProjects === 1 ? "project" : "projects"},{" "}
          {limits.messagesPerMonth.toLocaleString("en-US")} messages a month per project,{" "}
          {limits.maxKnowledgeSources} knowledge sources per project
          {limits.canCustomize ? ", and a widget in your own colours." : "."}
        </p>
      </div>

      {checkout === "return" && plan === "free" && (
        <p role="status" className="glass p-4 text-sm">
          Thanks. We are waiting for Cashfree to confirm your payment. This usually takes a few seconds; reload this
          page if it still says Free. Some banks take a day or two to approve the monthly payment.
        </p>
      )}

      <BillingActions plan={plan} mode={cashfreeMode()} />
    </div>
  );
}
