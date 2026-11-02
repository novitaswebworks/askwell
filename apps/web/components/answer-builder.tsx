"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_ANSWER_ITEMS } from "@askwell/shared";
import {
  TEMPLATES,
  getTemplate,
  normalizeQuestion,
  rowsFor,
  toSaveInput,
  type Item,
  type SavedAnswers,
} from "@/lib/answers";
import type { Unanswered } from "@/lib/unanswered";

const fieldStyles =
  "w-full rounded-xl border border-border bg-glass-strong px-4 py-3 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground placeholder:text-muted/60";

type Row = Item & { key: number };

// Row keys: the first render uses positions, rows made later use this counter
// (only ever called from event handlers).
let laterKey = 1_000;
const newKey = () => laterKey++;
const withIndexKeys = (items: Item[]): Row[] => items.map((i, n) => ({ ...i, key: n }));
const withNewKeys = (items: Item[]): Row[] => items.map((i) => ({ ...i, key: newKey() }));

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? "Something went wrong. Try again.";
}

// The guided way to teach the assistant: pick the kind of business, answer plain
// questions, save. Saving replaces the project's one "Business answers" source.
export function AnswerBuilder({
  projectId,
  saved,
  unanswered,
}: {
  projectId: string;
  saved: SavedAnswers | null;
  unanswered: Unanswered[];
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(saved?.template ?? "shop");
  const [rows, setRows] = useState<Row[]>(() => withIndexKeys(rowsFor(saved?.template ?? "shop", saved?.items ?? [])));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [focusKey, setFocusKey] = useState<number | null>(null);

  const template = getTemplate(templateId);
  const hints = new Map(template.prompts.map((p) => [normalizeQuestion(p.question), p.hint]));
  const answered = rows.filter((r) => r.answer.trim()).length;

  function pickTemplate(id: string) {
    setTemplateId(id);
    // Keep everything already answered, and add the new kind's questions.
    setRows(withNewKeys(rowsFor(id, rows.filter((r) => r.answer.trim()))));
    setMessage(null);
  }

  function update(key: number, patch: Partial<Item>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setMessage(null);
  }

  function addRow(question = "") {
    const existing = question ? rows.find((r) => normalizeQuestion(r.question) === normalizeQuestion(question)) : undefined;
    if (existing) {
      setFocusKey(existing.key);
      return;
    }
    if (rows.length >= MAX_ANSWER_ITEMS) {
      setMessage({ ok: false, text: `You can have up to ${MAX_ANSWER_ITEMS} questions.` });
      return;
    }
    const key = newKey();
    setRows((prev) => [{ key, question, answer: "" }, ...prev]);
    setFocusKey(key);
  }

  async function save() {
    const input = toSaveInput(templateId, rows);
    if (!input) {
      setMessage({ ok: false, text: "Answer at least one question first." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/answers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        setMessage({ ok: false, text: await errorMessage(res) });
        return;
      }
      setMessage({ ok: true, text: `Saved. Your assistant now knows ${input.items.length} answers.` });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Network error. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass flex flex-col gap-5 p-5" aria-labelledby="answers-heading">
      <div>
        <h2 id="answers-heading" className="text-lg font-semibold">
          Answer common questions
        </h2>
        <p className="mt-1 text-sm text-muted">
          The quickest way to teach your assistant. Pick your kind of business, answer in your own words, and skip
          anything that doesn&apos;t apply.
        </p>
      </div>

      {unanswered.length > 0 && (
        <div className="rounded-xl border border-border bg-glass-strong p-4">
          <h3 className="text-sm font-semibold">Visitors asked, and your assistant didn&apos;t know</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {unanswered.map((u) => (
              <li key={u.question} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 break-words">
                  {u.question}
                  {u.count > 1 && <span className="ml-2 text-muted">asked {u.count} times</span>}
                </span>
                <button
                  type="button"
                  onClick={() => addRow(u.question)}
                  className="glass inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium"
                >
                  Answer this
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div role="group" aria-label="What kind of business is it?" className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={t.id === templateId}
            onClick={() => pickTemplate(t.id)}
            className={`inline-flex h-10 items-center rounded-full px-4 text-sm ${
              t.id === templateId ? "bg-accent text-accent-foreground" : "glass"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {rows.map((r) => {
          const hint = hints.get(normalizeQuestion(r.question));
          const custom = hint === undefined;
          return (
            <div key={r.key} className="flex flex-col gap-1.5">
              {custom ? (
                <input
                  aria-label="Your question"
                  value={r.question}
                  maxLength={300}
                  onChange={(e) => update(r.key, { question: e.target.value })}
                  placeholder="Type a question customers ask"
                  className={`${fieldStyles} h-11 py-0 font-medium`}
                />
              ) : (
                <label htmlFor={`answer-${r.key}`} className="text-sm font-medium">
                  {r.question}
                </label>
              )}
              <textarea
                id={`answer-${r.key}`}
                aria-label={custom ? `Answer to: ${r.question || "your question"}` : undefined}
                rows={2}
                maxLength={2000}
                value={r.answer}
                onChange={(e) => update(r.key, { answer: e.target.value })}
                placeholder={hint ?? "Your answer"}
                ref={(el) => {
                  if (el && focusKey === r.key) {
                    el.focus();
                    setFocusKey(null);
                  }
                }}
                className={`${fieldStyles} resize-y`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => addRow()}
          className="glass inline-flex h-10 items-center rounded-full px-4 text-sm font-medium"
        >
          Add your own question
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || answered === 0}
          className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : saved ? "Save changes" : "Save answers"}
        </button>
        <span className="text-sm text-muted">
          {answered} answered
        </span>
      </div>
      <p role="status" aria-live="polite" className={`text-sm ${message?.ok ? "text-green-700" : "text-red-700"}`}>
        {message?.text}
      </p>
    </section>
  );
}
