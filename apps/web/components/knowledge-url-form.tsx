"use client";

import type { FormEvent } from "react";
import { Plus } from "@/components/site/icons";

// Paste a website address and we read its pages into one knowledge source.
export function KnowledgeUrlForm({
  url,
  onUrl,
  onSubmit,
  disabled,
  busy,
  maxPages,
}: {
  url: string;
  onUrl: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  disabled: boolean;
  busy: string | null;
  maxPages: number;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="website-url" className="text-xs font-medium text-muted">
          Website address
        </label>
        <input
          id="website-url"
          type="text"
          inputMode="url"
          autoComplete="url"
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          maxLength={2048}
          placeholder="https://example.com"
          disabled={disabled}
          className="h-11 min-w-0 w-full rounded-xl border border-border bg-glass-strong px-4 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground placeholder:text-muted/60"
        />
        <p className="text-xs leading-relaxed text-muted">
          We read up to {maxPages} pages of this website, following its own links, then show you the text so you can
          edit it before it is added. Pages that need a login are skipped, and we respect the site&apos;s robots.txt. It
          counts as one source. To refresh it later, delete it and add it again.
        </p>
      </div>
      <button
        type="submit"
        disabled={disabled || url.trim() === ""}
        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-full bg-foreground px-5 text-sm font-medium text-background transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        <span>{busy ?? "Read website and review"}</span>
      </button>
    </form>
  );
}
