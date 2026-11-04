"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PRO_PRICE_INR, type SubscribeResponse } from "@askwell/shared";

const buttonStyles =
  "inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-50";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface CheckoutOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
  handler: () => void;
  modal: { ondismiss: () => void };
}
type RazorpayCtor = new (options: CheckoutOptions) => { open(): void; on(event: string, cb: (r: { error?: { description?: string } }) => void): void };

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? "Something went wrong. Try again.";
}

// Razorpay's own script, loaded only when the owner clicks Upgrade.
function loadCheckout(): Promise<RazorpayCtor | null> {
  const existing = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve((window as unknown as { Razorpay?: RazorpayCtor }).Razorpay ?? null);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

// Upgrade and cancel. The card, UPI or bank details are entered in Razorpay
// Checkout; this component never sees them.
export function BillingActions({ plan, mode }: { plan: "free" | "pro"; mode: "sandbox" | "production" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscribe", { method: "POST" });
      if (!res.ok) {
        setError(await errorMessage(res));
        setBusy(false);
        return;
      }
      const sub = (await res.json()) as SubscribeResponse;
      const Razorpay = await loadCheckout();
      if (!Razorpay) {
        setError("Could not load the payment page. Check your connection and try again.");
        setBusy(false);
        return;
      }
      const checkout = new Razorpay({
        key: sub.keyId,
        subscription_id: sub.subscriptionId,
        name: "Askwell",
        description: "Pro, monthly",
        prefill: { name: sub.name, email: sub.email },
        // The plan only ever changes through the signed webhook; this just takes
        // the owner back to the Billing page to wait for it.
        handler: () => window.location.assign("/dashboard/billing?checkout=return"),
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on("payment.failed", (r) => {
        setError(r.error?.description ?? "The payment did not go through. Try again.");
        setBusy(false);
      });
      checkout.open();
    } catch {
      setError("Network error. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm("Cancel Pro? It ends now and the month you paid for is not refunded.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (!res.ok) {
        setError(await errorMessage(res));
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass flex flex-col gap-4 p-5">
      {plan === "free" ? (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">Upgrade to Pro</h2>
            <p className="mt-1 text-sm text-muted">
              ₹{PRO_PRICE_INR.toLocaleString("en-IN")} a month. More projects and messages, and a widget in your own
              colours. Pay with UPI, an Indian card or an international Visa or Mastercard. Cancel any time.
            </p>
          </div>
          <button
            type="button"
            onClick={upgrade}
            disabled={busy}
            className={`${buttonStyles} self-start bg-accent text-accent-foreground hover:opacity-90`}
          >
            {busy ? "Opening payment…" : `Upgrade for ₹${PRO_PRICE_INR.toLocaleString("en-IN")} a month`}
          </button>
          {mode === "sandbox" && <p className="text-xs text-muted">Test mode: no real money moves.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">Pro subscription</h2>
            <p className="mt-1 text-sm text-muted">
              You are on Pro. You can also stop it from your UPI app or bank at any time.
            </p>
          </div>
          <button type="button" onClick={cancel} disabled={busy} className={`${buttonStyles} glass self-start`}>
            {busy ? "Cancelling…" : "Cancel subscription"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
