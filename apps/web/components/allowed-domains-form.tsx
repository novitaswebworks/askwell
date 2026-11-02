"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MAX_ALLOWED_DOMAINS, normalizeDomain } from "@askwell/shared";

const toLines = (domains: string[]) => domains.join("\n");
const parse = (text: string) => text.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);

// Which websites may show this project's chat. Empty means any site, which is how
// a key ends up on the wrong website without anyone noticing.
export function AllowedDomainsForm({
  projectId,
  domains,
  seenHost,
}: {
  projectId: string;
  domains: string[];
  seenHost: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(toLines(domains));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const entries = parse(value);
  const invalid = entries.filter((e) => !normalizeDomain(e));
  const cleaned = [...new Set(entries.map((e) => normalizeDomain(e)).filter((d): d is string => d !== null))];
  const changed = cleaned.join("\n") !== domains.join("\n");
  const suggestion = seenHost ? normalizeDomain(seenHost) : null;
  const canSuggest = suggestion !== null && !cleaned.includes(suggestion) && cleaned.length < MAX_ALLOWED_DOMAINS;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (cleaned.length === 0 && domains.length > 0 && !window.confirm("Remove all restrictions? Any website will be able to show this chat.")) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedDomains: cleaned }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMessage({ kind: "error", text: body?.error?.message ?? "Something went wrong. Try again." });
        return;
      }
      setMessage({ kind: "ok", text: cleaned.length ? "Saved. Only these websites can show the chat." : "Saved. Any website can show the chat." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Network error. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="glass flex flex-col gap-3 p-4">
      <h2 className="text-lg font-semibold">Allowed websites</h2>
      <p className="text-sm text-muted">
        Only these websites can show your chat. Add your own site so nobody else can use your code. Subdomains such as
        www are included. Leave it empty to allow any website.
      </p>
      <label htmlFor="allowed-domains" className="sr-only">
        Allowed websites, one per line
      </label>
      <textarea
        id="allowed-domains"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder={"example.com\nshop.example.com"}
        disabled={busy}
        className="min-h-20 w-full rounded-xl border border-border bg-glass-strong p-3.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground"
      />
      {invalid.length > 0 && (
        <p role="alert" className="text-xs font-medium text-red-700">
          Not a website address: {invalid.join(", ")}
        </p>
      )}
      {entries.length > MAX_ALLOWED_DOMAINS && (
        <p role="alert" className="text-xs font-medium text-red-700">
          Up to {MAX_ALLOWED_DOMAINS} websites.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !changed || invalid.length > 0 || entries.length > MAX_ALLOWED_DOMAINS}
          className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-xs font-medium text-background hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving..." : "Save allowed websites"}
        </button>
        {canSuggest && (
          <button
            type="button"
            onClick={() => setValue((v) => (v.trim() ? `${v.trim()}\n${suggestion}` : suggestion))}
            className="glass inline-flex h-9 items-center rounded-full px-4 text-xs"
          >
            Add {suggestion} (where your chat was last seen)
          </button>
        )}
        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={`text-xs font-medium ${message.kind === "error" ? "text-red-700" : "text-emerald-600"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
