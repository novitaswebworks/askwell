"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MAX_ABOUT_LENGTH } from "@askwell/shared";
import { Check, Sparkles } from "@/components/site/icons";

const buttonStyles =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium transition-all disabled:opacity-40";

// The owner's short description of the business. The chat assistant uses it to
// tell whether a visitor's question is about this business.
export function AboutForm({ projectId, about }: { projectId: string; about: string }) {
  const router = useRouter();
  const [value, setValue] = useState(about);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const changed = value.trim() !== about.trim();

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMessage({ kind: "error", text: body?.error?.message ?? "Something went wrong. Try again." });
        return;
      }
      setMessage({ kind: "ok", text: "Saved successfully." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Network error. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="glass flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-foreground/80" />
        <h2 className="text-base font-semibold tracking-tight">Business Scope & Identity</h2>
      </div>
      <p className="text-xs text-muted leading-relaxed">
        One or two sentences describing your company. The assistant uses this context to determine if a
        visitor&apos;s question is about your business, politely declining off-topic questions.
      </p>
      <label htmlFor="about" className="sr-only">
        About this business
      </label>
      <textarea
        id="about"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={MAX_ABOUT_LENGTH}
        rows={3}
        placeholder="For example: A personal travel advisor who plans trips, flights, and boutique hotel stays across Europe."
        disabled={busy}
        className="min-h-20 w-full rounded-xl border border-border bg-glass-strong p-3.5 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground placeholder:text-muted/60"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !changed}
            className={`${buttonStyles} bg-foreground text-background hover:opacity-90`}
          >
            {busy ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Save business info</span>
              </>
            )}
          </button>
          {message && (
            <p
              role={message.kind === "error" ? "alert" : "status"}
              className={`text-xs font-medium ${
                message.kind === "error" ? "text-red-700" : "text-emerald-600"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
        <span className="font-mono text-xs text-muted">
          {value.length} / {MAX_ABOUT_LENGTH}
        </span>
      </div>
    </form>
  );
}
