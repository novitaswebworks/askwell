"use client";

import { useState } from "react";
import { withPostHog } from "@/lib/posthog-client";

type Kind = "snippet" | "ai_prompt" | "developer_message";

// Text the owner copies somewhere else. `preview` shows it in full (the code) or
// folds it away (long prompts and messages).
export function CopyBlock({
  text,
  kind,
  label,
  fold,
}: {
  text: string;
  kind: Kind;
  label: string;
  fold?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      withPostHog((ph) => ph.capture(kind === "snippet" ? "install_snippet_copied" : `install_${kind}_copied`));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const body = (
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/5 p-3 text-sm">
      <code>{text}</code>
    </pre>
  );

  return (
    <div className="flex flex-col gap-3">
      {fold ? (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground">{fold}</summary>
          <div className="mt-2">{body}</div>
        </details>
      ) : (
        body
      )}
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-11 items-center justify-center self-start rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        {copied ? "Copied" : label}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
