import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { PLAN_LIMITS } from "@askwell/shared";
import { BillingPlans } from "@/components/billing-plans";
import { getAccountPlan } from "@/lib/accounts";

function Skeleton() {
  return <div className="glass h-40 animate-pulse" aria-busy="true" aria-label="Loading" />;
}

// The heading is the instant shell; the data streams in behind the skeleton.
export default function BillingPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Billing</h1>
      <Suspense fallback={<Skeleton />}>
        <BillingContent />
      </Suspense>
    </>
  );
}

async function BillingContent() {
  const { userId } = await auth();
  if (!userId) return null; // the proxy already sends signed-out visitors to sign-in

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
      <p className="text-xs text-muted">
        After you subscribe it can take a few seconds for your plan to update. Reload this page if it still says Free.
      </p>
      <BillingPlans />
    </div>
  );
}
