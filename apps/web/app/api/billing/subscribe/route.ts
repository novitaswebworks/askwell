import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { SubscribeResponse } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { track } from "@/lib/analytics";
import { apiError } from "@/lib/api";
import { billingEnabled } from "@/lib/plan-features";
import { createProSubscription } from "@/lib/razorpay";
import { requireEnv } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";

// Starts the Pro subscription. The plan, the price and the owner all come from
// the server; the browser sends nothing. Razorpay Checkout collects the contact
// and payment details itself.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");
  // The page hides the Upgrade button while billing is closed; the server refuses too.
  if (!billingEnabled()) return apiError("forbidden", "Paid plans are not open yet.");

  const service = createServiceClient();
  if ((await getAccountPlan(userId, service)) === "pro") {
    return apiError("invalid_input", "You are already on the Pro plan.");
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return apiError("invalid_input", "Add an email address to your account first.");

  try {
    const keyId = requireEnv("RAZORPAY_KEY_ID", process.env.RAZORPAY_KEY_ID);
    const { subscriptionId } = await createProSubscription({ email });

    // Remember it, so the webhook can find this owner when payment completes.
    const { error } = await service
      .from("accounts")
      .update({ razorpay_subscription_id: subscriptionId })
      .eq("clerk_user_id", userId);
    if (error) return apiError("internal", "Could not start the upgrade.");

    track({ distinctId: userId, event: "upgrade_started" });
    const body: SubscribeResponse = {
      subscriptionId,
      keyId,
      name: user?.fullName?.trim() || email.split("@")[0] || "Askwell owner",
      email,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[billing] subscribe failed:", error instanceof Error ? error.message : error);
    return apiError("internal", "Could not start the upgrade. Try again in a moment.");
  }
}
