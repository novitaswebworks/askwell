"use client";

import { PricingTable } from "@clerk/nextjs";

// Clerk's own pricing table and checkout: we never touch card details.
export function BillingPlans() {
  return <PricingTable newSubscriptionRedirectUrl="/dashboard/billing" />;
}
