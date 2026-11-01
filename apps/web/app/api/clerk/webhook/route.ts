import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { apiError } from "@/lib/api";
import { planFromItems, SUBSCRIPTION_EVENTS } from "@/lib/billing";
import { createServiceClient } from "@/lib/supabase/service";

// Clerk Billing tells us when someone's subscription changes, and we keep
// accounts.plan in step (project.md section 8). The signature is checked first:
// without it, anyone could upgrade themselves.
export async function POST(req: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(req); // reads CLERK_WEBHOOK_SIGNING_SECRET
  } catch {
    return apiError("invalid_input", "Invalid webhook signature.");
  }

  if (!SUBSCRIPTION_EVENTS.has(event.type)) return NextResponse.json({ ok: true, ignored: event.type });

  const subscription = event.data as {
    payer?: { user_id?: string };
    items?: { status?: string; period_end?: number | null; plan?: { slug?: string } | null }[];
  };
  // Organisation payers are not part of this product.
  const userId = subscription.payer?.user_id;
  if (!userId) return NextResponse.json({ ok: true, ignored: "no user payer" });

  const plan = planFromItems(subscription.items, Date.now());
  const { error } = await createServiceClient()
    .from("accounts")
    .upsert({ clerk_user_id: userId, plan }, { onConflict: "clerk_user_id" });
  // A 500 makes Clerk retry the delivery.
  if (error) return apiError("internal", "Could not update the plan.");

  return NextResponse.json({ ok: true, plan });
}
