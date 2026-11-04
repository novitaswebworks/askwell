import "server-only";
import { requireEnv } from "@/lib/supabase/env";

// Razorpay Subscriptions over plain HTTPS. The key secret never leaves the server;
// the key ID is public by design (checkout needs it in the browser).
const BASE = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 20_000;
// Razorpay needs a number of billing cycles. 120 monthly cycles is ten years.
const TOTAL_COUNT = 120;

export type RazorpayMode = "sandbox" | "production";

// Test keys start with rzp_test_, live keys with rzp_live_.
export function razorpayMode(env: Record<string, string | undefined> = process.env): RazorpayMode {
  return env.RAZORPAY_KEY_ID?.startsWith("rzp_live_") ? "production" : "sandbox";
}

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const keyId = requireEnv("RAZORPAY_KEY_ID", process.env.RAZORPAY_KEY_ID);
  const keySecret = requireEnv("RAZORPAY_KEY_SECRET", process.env.RAZORPAY_KEY_SECRET);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // keep null
  }
  if (!res.ok) {
    const message = (data as { error?: { description?: string } } | null)?.error?.description ?? `Razorpay answered ${res.status}`;
    throw new RazorpayError(message, res.status);
  }
  return data as T;
}

// A monthly Pro subscription on the plan created in the Razorpay dashboard
// (RAZORPAY_PLAN_ID). The customer authorises it in Razorpay Checkout, using the
// returned subscription ID.
export async function createProSubscription(input: { email: string }): Promise<{ subscriptionId: string }> {
  const created = await request<{ id?: string }>("/subscriptions", {
    plan_id: requireEnv("RAZORPAY_PLAN_ID", process.env.RAZORPAY_PLAN_ID),
    total_count: TOTAL_COUNT,
    customer_notify: 1,
    notes: { app: "askwell", email: input.email },
  });
  if (!created?.id) throw new RazorpayError("Razorpay gave no subscription", 502);
  return { subscriptionId: created.id };
}

// Cancels now (not at the end of the cycle): future charges stop at once.
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await request(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { cancel_at_cycle_end: 0 });
}
