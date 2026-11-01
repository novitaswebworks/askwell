import "server-only";
import { randomUUID } from "node:crypto";
import { PRO_PRICE_INR } from "@askwell/shared";
import { requireEnv } from "@/lib/supabase/env";

// Cashfree Subscriptions over plain HTTPS. The secret never leaves the server.
const API_VERSION = "2026-01-01";
const TIMEOUT_MS = 20_000;

export type CashfreeMode = "sandbox" | "production";

export function cashfreeMode(env: Record<string, string | undefined> = process.env): CashfreeMode {
  return env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

const BASE: Record<CashfreeMode, string> = {
  sandbox: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
};

export class CashfreeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CashfreeError";
  }
}

async function request<T>(method: "POST" | "GET", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE[cashfreeMode()]}${path}`, {
    method,
    headers: {
      "x-api-version": API_VERSION,
      "x-client-id": requireEnv("CASHFREE_APP_ID", process.env.CASHFREE_APP_ID),
      "x-client-secret": requireEnv("CASHFREE_SECRET_KEY", process.env.CASHFREE_SECRET_KEY),
      "x-idempotency-key": randomUUID(),
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
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
    const message = (data as { message?: string } | null)?.message ?? `Cashfree answered ${res.status}`;
    throw new CashfreeError(message, res.status);
  }
  return data as T;
}

export interface NewSubscription {
  subscriptionId: string;
  name: string;
  email: string;
  phone: string;
  returnUrl: string;
}

// A monthly Pro subscription, priced in one place (PRO_PRICE_INR). The customer
// authorises it on Cashfree's hosted page, using the returned session ID.
export async function createProSubscription(input: NewSubscription): Promise<{ sessionId: string }> {
  const created = await request<{ subscription_session_id?: string }>("POST", "/subscriptions", {
    subscription_id: input.subscriptionId,
    customer_details: {
      customer_name: input.name,
      customer_email: input.email,
      customer_phone: input.phone,
    },
    plan_details: {
      plan_name: "Askwell Pro",
      plan_type: "PERIODIC",
      plan_currency: "INR",
      plan_amount: PRO_PRICE_INR,
      plan_max_amount: PRO_PRICE_INR,
      plan_intervals: 1,
      plan_interval_type: "MONTH",
    },
    subscription_meta: { return_url: input.returnUrl, notification_channel: ["EMAIL", "SMS"] },
    subscription_tags: { app: "askwell" },
  });
  if (!created?.subscription_session_id) throw new CashfreeError("Cashfree gave no session", 502);
  return { sessionId: created.subscription_session_id };
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await request("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}/manage`, { action: "CANCEL" });
}

// Our own ID, safe for Cashfree (letters, digits, underscore).
export function newSubscriptionId(): string {
  return `askwell_${randomUUID().replace(/-/g, "")}`;
}
