import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { subscribeRequestSchema, type SubscribeResponse } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { track } from "@/lib/analytics";
import { apiError, readJson } from "@/lib/api";
import { CashfreeError, createProSubscription, newSubscriptionId } from "@/lib/cashfree";
import { requireEnv } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";

// Starts the Pro subscription. The plan, the price and the owner all come from
// the server; the browser only supplies a phone number (Cashfree requires one).
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const parsed = subscribeRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError("invalid_input", "Enter a valid phone number.");

  const service = createServiceClient();
  if ((await getAccountPlan(userId, service)) === "pro") {
    return apiError("invalid_input", "You are already on the Pro plan.");
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return apiError("invalid_input", "Add an email address to your account first.");

  const subscriptionId = newSubscriptionId();
  try {
    const appUrl = requireEnv("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, "");
    const { sessionId } = await createProSubscription({
      subscriptionId,
      name: user?.fullName?.trim() || email.split("@")[0] || "Askwell owner",
      email,
      phone: parsed.data.phone,
      // Cashfree returns the customer with a POST, so it goes to a route, not a page.
      returnUrl: `${appUrl}/api/billing/return`,
    });

    // Remember it, so the webhook can find this owner when payment completes.
    const { error } = await service
      .from("accounts")
      .update({ cashfree_subscription_id: subscriptionId })
      .eq("clerk_user_id", userId);
    if (error) return apiError("internal", "Could not start the upgrade.");

    track({ distinctId: userId, event: "upgrade_started" });
    const body: SubscribeResponse = { sessionId };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[billing] subscribe failed:", error instanceof Error ? error.message : error);
    return apiError(
      "internal",
      error instanceof CashfreeError && error.status === 400
        ? "Cashfree did not accept those details. Check your phone number and try again."
        : "Could not start the upgrade. Try again in a moment.",
    );
  }
}
