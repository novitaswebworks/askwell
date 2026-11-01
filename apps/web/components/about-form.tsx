"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MAX_ABOUT_LENGTH } from "@askwell/shared";

const buttonStyles =
  "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity disabled:opacity-50";

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
      setMessage({ kind: "ok", text: "Saved." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Network error. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="glass flex flex-col gap-3 p-4">
      <h2 className="font-medium">About this business</h2>
      <p className="text-sm text-muted">
        One or two sentences. The assistant uses it to tell which questions are about you, and politely
        declines the rest.
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
        placeholder="For example: A personal travel advisor who plans trips, flights and hotel stays."
        disabled={busy}
        className="min-h-20 rounded-2xl border border-border bg-glass-strong p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !changed}
          className={`${buttonStyles} bg-accent text-accent-foreground hover:opacity-90`}
        >
          Save
        </button>
        <span className="text-xs text-muted">
          {value.length} of {MAX_ABOUT_LENGTH}
        </span>
        {message && (
          <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm ${message.kind === "error" ? "text-red-700" : "text-muted"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
