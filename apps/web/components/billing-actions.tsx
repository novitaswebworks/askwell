"use client";

import { load } from "@cashfreepayments/cashfree-js";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PRO_PRICE_INR } from "@askwell/shared";

const buttonStyles =
  "inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-50";

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? "Something went wrong. Try again.";
}

// Upgrade and cancel. The card, UPI or bank details are entered on Cashfree's own
// page; this component never sees them.
export function BillingActions({ plan, mode }: { plan: "free" | "pro"; mode: "sandbox" | "production" }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        setError(await errorMessage(res));
        return;
      }
      const { sessionId } = (await res.json()) as { sessionId: string };
      const cashfree = await load({ mode });
      if (!cashfree) {
        setError("Could not load the payment page. Check your connection and try again.");
        return;
      }
      const result = await cashfree.subscriptionsCheckout({ subsSessionId: sessionId, redirectTarget: "_self" });
      if (result?.error) setError(result.error.message ?? "The payment page could not open.");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
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
        <form onSubmit={upgrade} className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">Upgrade to Pro</h2>
            <p className="mt-1 text-sm text-muted">
              ₹{PRO_PRICE_INR.toLocaleString("en-IN")} a month. More projects and messages, and a widget in your own
              colours. Pay with UPI, an Indian card or an international Visa or Mastercard. Cancel any time.
            </p>
          </div>
          <label htmlFor="phone" className="text-sm font-medium">
            Mobile number
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="For example 98765 43210"
            disabled={busy}
            className="h-11 max-w-sm rounded-full border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <p className="text-xs text-muted">Cashfree needs it to set up the monthly payment. We do not use it for anything else.</p>
          <button
            type="submit"
            disabled={busy || phone.replace(/\D/g, "").length < 8}
            className={`${buttonStyles} self-start bg-accent text-accent-foreground hover:opacity-90`}
          >
            {busy ? "Opening payment…" : `Upgrade for ₹${PRO_PRICE_INR.toLocaleString("en-IN")} a month`}
          </button>
          {mode === "sandbox" && <p className="text-xs text-muted">Test mode: no real money moves.</p>}
        </form>
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
