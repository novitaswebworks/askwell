import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { apiError } from "@/lib/api";
import { cancelSubscription } from "@/lib/cashfree";
import { createServiceClient } from "@/lib/supabase/service";

// Cancels the owner's own subscription. Pro ends now: Cashfree stops future
// charges, and the month already paid is not refunded.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const service = createServiceClient();
  const { data: account, error } = await service
    .from("accounts")
    .select("plan, cashfree_subscription_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (error) return apiError("internal", "Could not cancel the subscription.");
  if (!account || account.plan !== "pro" || !account.cashfree_subscription_id) {
    return apiError("not_found", "You do not have an active subscription.");
  }

  try {
    await cancelSubscription(account.cashfree_subscription_id as string);
  } catch (e) {
    console.error("[billing] cancel failed:", e instanceof Error ? e.message : e);
    return apiError("internal", "Could not cancel with Cashfree. Try again in a moment.");
  }

  // The webhook would also do this; doing it now means the page is right at once.
  const { error: updateError } = await service.from("accounts").update({ plan: "free" }).eq("clerk_user_id", userId);
  if (updateError) return apiError("internal", "Cancelled, but could not update your plan. Reload the page.");

  track({ distinctId: userId, event: "subscription_cancelled" });
  return NextResponse.json({ ok: true });
}
