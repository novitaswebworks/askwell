"use client";

import type { FormEvent } from "react";
import type { Strings } from "@/lib/embed-i18n";

// The "leave your email" / "talk to a person" form shown inside the chat.
export function LeadForm({
  type,
  t,
  email,
  name,
  phone,
  busy,
  error,
  onEmail,
  onName,
  onPhone,
  onSubmit,
  onDismiss,
}: {
  type: "inquiry" | "handoff";
  t: Strings;
  email: string;
  name: string;
  phone: string;
  busy: boolean;
  error: string | null;
  onEmail: (v: string) => void;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="glass rounded-2xl border border-border p-3.5 space-y-2.5 max-w-[90%]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">
          {type === "handoff" ? t.talkToPerson : t.leaveEmail}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-muted hover:text-foreground px-1"
          aria-label={t.dismissForm}
        >
          ✕
        </button>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        {type === "handoff" ? t.handoffHint : t.leaveEmailHint}
      </p>
      <form onSubmit={onSubmit} className="space-y-2 pt-1">
        <input
          type="email"
          required
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          disabled={busy}
          className="h-8 w-full rounded-xl border border-border bg-glass-strong px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => onName(e.target.value)}
            disabled={busy}
            maxLength={100}
            className="h-8 flex-1 min-w-0 rounded-xl border border-border bg-glass-strong px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />
          <input
            type="tel"
            placeholder={t.phonePlaceholder}
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            disabled={busy}
            maxLength={30}
            className="h-8 flex-1 min-w-0 rounded-xl border border-border bg-glass-strong px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />
        </div>
        {error && <p className="text-[11px] text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="h-8 w-full rounded-xl bg-accent px-3 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t.sending : t.submitDetails}
        </button>
      </form>
    </div>
  );
}
