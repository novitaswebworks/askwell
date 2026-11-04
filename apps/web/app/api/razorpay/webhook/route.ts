import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { eventSubscriptionId, planForEvent, verifyWebhook, type RazorpayEvent } from "@/lib/razorpay-events";
import { createServiceClient } from "@/lib/supabase/service";

// Razorpay tells us when a subscription changes (project.md section 8). The
// signature is checked first: without it anyone could upgrade themselves. The
// owner is found from the subscription ID we stored, never from anything in the
// body that a caller could choose. The updates are idempotent, so a repeated
// delivery is harmless.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const valid = verifyWebhook(
    { rawBody, signature: req.headers.get("x-razorpay-signature") },
    process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  );
  if (!valid) return apiError("invalid_input", "Invalid webhook signature.");

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    return apiError("invalid_input", "Invalid webhook body.");
  }

  const plan = planForEvent(event);
  const subscriptionId = eventSubscriptionId(event);
  if (!plan || !subscriptionId) return NextResponse.json({ ok: true, ignored: event.event ?? "unknown" });

  // Only the subscription this account currently has counts: an old, abandoned
  // attempt must not change a newer one.
  const { data, error } = await createServiceClient()
    .from("accounts")
    .update({ plan })
    .eq("razorpay_subscription_id", subscriptionId)
    .select("clerk_user_id");
  // A 500 makes Razorpay retry the delivery.
  if (error) return apiError("internal", "Could not update the plan.");

  return NextResponse.json({ ok: true, plan, matched: (data ?? []).length });
}
