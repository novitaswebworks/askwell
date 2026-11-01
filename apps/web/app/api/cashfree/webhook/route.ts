import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { eventSubscriptionId, planForEvent, verifyWebhook, type CashfreeEvent } from "@/lib/cashfree-events";
import { createServiceClient } from "@/lib/supabase/service";

// Cashfree tells us when a subscription changes (project.md section 8). The
// signature is checked first: without it anyone could upgrade themselves. The
// owner is found from our own subscription ID, never from anything in the body
// that a caller could choose.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.CASHFREE_WEBHOOK_SECRET ?? process.env.CASHFREE_SECRET_KEY ?? "";
  const valid = verifyWebhook(
    {
      rawBody,
      signature: req.headers.get("x-webhook-signature"),
      timestamp: req.headers.get("x-webhook-timestamp"),
    },
    secret,
    Date.now(),
  );
  if (!valid) return apiError("invalid_input", "Invalid webhook signature.");

  let event: CashfreeEvent;
  try {
    event = JSON.parse(rawBody) as CashfreeEvent;
  } catch {
    return apiError("invalid_input", "Invalid webhook body.");
  }

  const plan = planForEvent(event);
  const subscriptionId = eventSubscriptionId(event);
  if (!plan || !subscriptionId) return NextResponse.json({ ok: true, ignored: event.type ?? "unknown" });

  // Only the subscription this account currently has counts: an old, abandoned
  // attempt must not change a newer one.
  const { data, error } = await createServiceClient()
    .from("accounts")
    .update({ plan })
    .eq("cashfree_subscription_id", subscriptionId)
    .select("clerk_user_id");
  // A 500 makes Cashfree retry the delivery.
  if (error) return apiError("internal", "Could not update the plan.");

  return NextResponse.json({ ok: true, plan, matched: (data ?? []).length });
}
