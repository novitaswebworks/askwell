"use client";

import { useState } from "react";
import { withPostHog } from "@/lib/posthog-client";

export function CopySnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      withPostHog((ph) => ph.capture("install_snippet_copied"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="glass flex flex-col gap-3 p-4">
      <pre className="overflow-x-auto text-sm">
        <code>{snippet}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-11 items-center justify-center self-start rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        {copied ? "Copied" : "Copy snippet"}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Snippet copied" : ""}
      </span>
    </div>
  );
}
