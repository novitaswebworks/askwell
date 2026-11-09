"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { TestAnswerResponse } from "@askwell/shared";

const KIND_LABEL: Record<TestAnswerResponse["kind"], string> = {
  question: "Question",
  human: "Asked for a person",
  smalltalk: "Small talk",
  off_topic: "Off topic",
};

// Try a question and see how it was answered: what it was understood as, which parts of the
// knowledge matched (and which were too weak to use), and how long each step took.
export function TestAssistant({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ asked: string; answer: TestAnswerResponse } | null>(null);

  async function ask(e: FormEvent) {
    e.preventDefault();
    const asked = message.trim();
    if (!asked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: asked }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not test that question. Try again.");
        return;
      }
      setResult({ asked, answer: body as TestAnswerResponse });
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const a = result?.answer;
  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <form onSubmit={ask} className="glass flex flex-col gap-3 p-4 sm:flex-row">
        <label htmlFor="test-question" className="sr-only">
          Question to test for {projectName}
        </label>
        <input
          id="test-question"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          placeholder={`Ask ${projectName} something a visitor might ask`}
          disabled={busy}
          className="ph-no-capture h-11 flex-1 rounded-full border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="submit"
          disabled={busy || !message.trim()}
          className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {busy ? "Thinking…" : "Test"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {result && a && (
        <div className="ph-no-capture flex flex-col gap-4" aria-live="polite">
          <section className="glass flex flex-col gap-2 p-5">
            <p className="text-xs text-muted">
              You asked: <span className="text-foreground">{result.asked}</span>
            </p>
            <p className="whitespace-pre-wrap break-words">{a.reply}</p>
            <p className="text-xs text-muted">
              {KIND_LABEL[a.kind]}
              {a.understoodAs && a.understoodAs !== result.asked ? ` · understood as “${a.understoodAs}”` : ""}
            </p>
            {a.followUps.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-1">
                {a.followUps.map((f) => (
                  <li key={f} className="rounded-full border border-border px-3 py-1 text-xs">
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {a.kind === "question" || a.kind === "human" ? (
            <section className="glass flex flex-col gap-3 p-5">
              <h2 className="font-medium">What it found in your knowledge</h2>
              {a.chunks.length === 0 ? (
                <p className="text-sm text-muted">
                  Nothing matched. Add this topic to your knowledge, or answer it in{" "}
                  <Link href={`/dashboard/knowledge?project=${projectId}`} className="text-brand hover:underline">
                    Knowledge
                  </Link>
                  .
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {a.chunks.map((c, i) => (
                    <li key={i} className={`rounded-xl border border-border p-3 text-sm ${c.used ? "" : "opacity-60"}`}>
                      <p className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{c.title}</span>
                        <span className="text-xs text-muted">
                          match {Math.round(c.similarity * 100)}% · {c.used ? "used for the answer" : "too weak, not used"}
                        </span>
                      </p>
                      <p className="mt-1 break-words text-muted">{c.excerpt}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">
                Understanding {a.ms.understand} ms · search {a.ms.search} ms · answer {a.ms.answer} ms
              </p>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
