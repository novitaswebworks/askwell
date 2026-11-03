"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { WebsitePreview } from "@askwell/shared";

const MAX_TEXT = 200_000; // the same limit as "Paste text"

// What we found on the website, in a window the owner can edit before anything is saved.
// `onConfirm` returns an error message to show here, or null once the source has been added.
export function KnowledgePreviewDialog({
  draft,
  onCancel,
  onConfirm,
}: {
  draft: WebsitePreview;
  onCancel: () => void;
  onConfirm: (title: string, text: string) => Promise<string | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [title, setTitle] = useState(draft.title);
  const [text, setText] = useState(draft.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edited = title !== draft.title || text !== draft.text;
  const tooLong = text.length > MAX_TEXT;
  const canSave = !busy && title.trim() !== "" && text.trim() !== "" && !tooLong;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function cancel() {
    if (busy) return;
    if (edited && !window.confirm("Discard your changes? Nothing has been added yet.")) return;
    onCancel();
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const message = await onConfirm(title.trim(), text.trim());
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault(); // Esc goes through the same "discard?" check as the Cancel button
        cancel();
      }}
      className="m-auto w-[min(52rem,calc(100vw-2rem))] max-w-none rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-lg font-semibold tracking-tight">
            Review before adding
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            We read {draft.pages} {draft.pages === 1 ? "page" : "pages"}
            {draft.skipped > 0 ? ` (${draft.skipped} skipped)` : ""}. Edit anything below, such as removing text you don&apos;t
            want the assistant to say. Nothing is saved until you press &ldquo;Save and add&rdquo;.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${headingId}-title`} className="text-xs font-medium text-muted">
            Title
          </label>
          <input
            id={`${headingId}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            disabled={busy}
            className="h-11 w-full rounded-xl border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor={`${headingId}-text`} className="text-xs font-medium text-muted">
              Content
            </label>
            <span className={`font-mono text-xs ${tooLong ? "text-red-700" : "text-muted"}`}>
              {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
            </span>
          </div>
          <textarea
            id={`${headingId}-text`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            spellCheck={false}
            className="min-h-64 w-full flex-1 resize-y rounded-xl border border-border bg-glass-strong p-3.5 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          />
          {tooLong && (
            <p role="alert" className="text-xs font-medium text-red-700">
              Too long: shorten it to {MAX_TEXT.toLocaleString()} characters or fewer.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className="text-xs text-muted">
            Adding and indexing. This can take a minute...
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-glass-strong disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Adding..." : "Save and add"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
