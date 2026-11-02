"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { APP_NAME, MAX_MESSAGE_LENGTH, chatResponseSchema, type WidgetConfig } from "@askwell/shared";
import { MESSAGE_SOURCE, getVisitorId, parseParentOrigin, type PanelMessage } from "@/lib/embed";

type Line = {
  id: number;
  role: "visitor" | "bot";
  body: string;
  sources?: string[];
  followUps?: string[];
};
type Load = { state: "loading" } | { state: "error" } | { state: "ready"; config: WidgetConfig };

export function EmbedPanel() {
  const params = useSearchParams();
  const key = params.get("key");
  const parentOrigin = parseParentOrigin(params.get("origin"));

  const [fetched, setLoad] = useState<Load>({ state: "loading" });
  const load: Load = key ? fetched : { state: "error" };
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState<{ open: boolean; type: "inquiry" | "handoff" } | null>(null);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const open = useRef(true);
  const unread = useRef(0);
  const conversationId = useRef<string | null>(null);
  const nextId = useRef(1);
  const visitorId = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tell = useCallback(
    (message: PanelMessage) => {
      // Never "*": data only goes to the host page's own origin.
      if (parentOrigin && window.parent !== window) window.parent.postMessage(message, parentOrigin);
    },
    [parentOrigin],
  );

  // Config, plus the visitor ID kept in this iframe's localStorage.
  useEffect(() => {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    visitorId.current = getVisitorId(storage);

    if (!key) return;
    const controller = new AbortController();
    fetch(`/api/widget/config?key=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<WidgetConfig>) : Promise.reject(new Error("config"))))
      .then((config) => setLoad({ state: "ready", config }))
      .catch((err) => {
        if (err?.name !== "AbortError") setLoad({ state: "error" });
      });
    return () => controller.abort();
  }, [key]);

  // Messages from the loader: visibility only, and only from our parent window.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!parentOrigin || event.origin !== parentOrigin || event.source !== window.parent) return;
      const data = event.data as { source?: string; type?: string; open?: unknown } | null;
      if (data?.source !== MESSAGE_SOURCE || data.type !== "visibility") return;
      open.current = data.open === true;
      if (open.current) {
        unread.current = 0;
        inputRef.current?.focus();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [parentOrigin]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") tell({ source: MESSAGE_SOURCE, type: "close" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tell]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines, typing]);

  const addBotLine = useCallback(
    (body: string, sources?: string[], followUps?: string[]) => {
      setLines((prev) => [...prev, { id: nextId.current++, role: "bot", body, sources, followUps }]);
      if (!open.current) {
        unread.current += 1;
        tell({ source: MESSAGE_SOURCE, type: "unread", count: unread.current });
      }
    },
    [tell],
  );

  const sendMessage = useCallback(
    async (rawText: string) => {
      const body = rawText.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!body || typing || !key) return;
      setDraft("");
      setLines((prev) => [...prev, { id: nextId.current++, role: "visitor", body }]);
      setTyping(true);
      try {
        const res = await fetch("/api/widget/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            visitorId: visitorId.current,
            conversationId: conversationId.current ?? undefined,
            message: body,
          }),
        });
        const data: unknown = await res.json().catch(() => null);
        const parsed = chatResponseSchema.safeParse(data);
        if (res.ok && parsed.success) {
          conversationId.current = parsed.data.conversationId;
          addBotLine(parsed.data.reply, parsed.data.sources, parsed.data.followUps);
          if (
            parsed.data.reply.includes("leave your email") ||
            parsed.data.reply.includes("temporarily unavailable")
          ) {
            setShowLeadForm({ open: true, type: "inquiry" });
          }
        } else {
          const message = (data as { error?: { message?: unknown } } | null)?.error?.message;
          const fallback = typeof message === "string" ? message : "Something went wrong. Please try again.";
          addBotLine(fallback);
          if (fallback.includes("leave your email") || fallback.includes("temporarily unavailable")) {
            setShowLeadForm({ open: true, type: "inquiry" });
          }
        }
      } catch {
        addBotLine("Could not reach the server. Check your connection and try again.");
      } finally {
        setTyping(false);
      }
    },
    [addBotLine, key, typing],
  );

  async function submitLead(event: FormEvent) {
    event.preventDefault();
    if (!leadEmail.trim() || leadBusy || !key || !conversationId.current) return;
    setLeadBusy(true);
    setLeadError(null);
    try {
      const res = await fetch("/api/widget/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          conversationId: conversationId.current,
          email: leadEmail.trim(),
          name: leadName.trim() || undefined,
          phone: leadPhone.trim() || undefined,
          type: showLeadForm?.type ?? "inquiry",
        }),
      });
      if (res.ok) {
        setShowLeadForm(null);
        setLeadEmail("");
        setLeadName("");
        setLeadPhone("");
        addBotLine("Thank you! We've received your contact info and our team will follow up soon.");
      } else {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setLeadError(body?.error?.message ?? "Could not save your contact info. Please try again.");
      }
    } catch {
      setLeadError("Network error. Please try again.");
    } finally {
      setLeadBusy(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    await sendMessage(draft);
  }

  if (load.state === "loading") {
    return <div className="h-full animate-pulse bg-glass" aria-busy="true" aria-label="Loading chat" />;
  }
  if (load.state === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-medium">Chat is unavailable</p>
        <p className="text-sm text-muted">Please try again later.</p>
      </div>
    );
  }

  const { config } = load;
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h1 className="truncate text-base font-semibold">{config.headerText}</h1>
        <button
          type="button"
          onClick={() => tell({ source: MESSAGE_SOURCE, type: "close" })}
          aria-label="Close chat"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-glass-strong focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div role="log" aria-live="polite" aria-label="Conversation" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {lines.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{config.welcomeMessage}</p>
            {config.starterQuestions && config.starterQuestions.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                {config.starterQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendMessage(q)}
                    disabled={typing}
                    className="rounded-2xl border border-border bg-glass-strong px-4 py-2.5 text-left text-sm text-foreground transition hover:bg-glass hover:border-brand/40 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {lines.map((line, idx) => (
          <div key={line.id} className="space-y-1.5">
            <div className={`flex ${line.role === "visitor" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%] space-y-1">
                <p
                  className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm ${
                    line.role === "visitor" ? "bg-accent text-accent-foreground" : "glass"
                  }`}
                >
                  {line.body}
                </p>
                {line.sources && line.sources.length > 0 && (
                  <p className="px-1 text-[11px] text-muted">
                    From: {line.sources.join(", ")}
                  </p>
                )}
              </div>
            </div>
            {line.role === "bot" && idx === lines.length - 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {line.followUps &&
                  line.followUps.map((fu, fIdx) => (
                    <button
                      key={fIdx}
                      type="button"
                      onClick={() => sendMessage(fu)}
                      disabled={typing}
                      className="rounded-full border border-border bg-glass px-3 py-1 text-xs text-foreground/85 transition hover:bg-glass-strong hover:text-foreground text-left disabled:opacity-50"
                    >
                      {fu}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => setShowLeadForm({ open: true, type: "handoff" })}
                  disabled={typing}
                  className="rounded-full border border-border bg-glass px-3 py-1 text-xs text-foreground/85 transition hover:bg-glass-strong hover:text-foreground text-left disabled:opacity-50"
                >
                  Talk to a person
                </button>
              </div>
            )}
          </div>
        ))}
        {showLeadForm && (
          <div className="glass rounded-2xl border border-border p-3.5 space-y-2.5 max-w-[90%]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">
                {showLeadForm.type === "handoff" ? "Talk to a person" : "Leave your email"}
              </p>
              <button
                type="button"
                onClick={() => setShowLeadForm(null)}
                className="text-xs text-muted hover:text-foreground px-1"
                aria-label="Dismiss contact form"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              {showLeadForm.type === "handoff"
                ? "Leave your details and we'll send your question and transcript to the site owner."
                : "Leave your email and someone from the team will follow up directly."}
            </p>
            <form onSubmit={submitLead} className="space-y-2 pt-1">
              <input
                type="email"
                required
                placeholder="your@email.com (required)"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                disabled={leadBusy}
                className="h-8 w-full rounded-xl border border-border bg-glass-strong px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  disabled={leadBusy}
                  maxLength={100}
                  className="h-8 flex-1 min-w-0 rounded-xl border border-border bg-glass-strong px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent"
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  disabled={leadBusy}
                  maxLength={30}
                  className="h-8 flex-1 min-w-0 rounded-xl border border-border bg-glass-strong px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent"
                />
              </div>
              {leadError && <p className="text-[11px] text-red-500">{leadError}</p>}
              <button
                type="submit"
                disabled={leadBusy || !leadEmail.trim()}
                className="h-8 w-full rounded-xl bg-accent px-3 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {leadBusy ? "Sending..." : "Submit details"}
              </button>
            </form>
          </div>
        )}
        {typing && (
          <div className="flex justify-start" aria-label="Typing" role="status">
            <span className="glass flex gap-1 rounded-2xl px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="typing-dot h-1.5 w-1.5 rounded-full bg-muted"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <label htmlFor="message" className="sr-only">
          Your message
        </label>
        <input
          ref={inputRef}
          id="message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Type your message"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-full border border-border bg-glass-strong px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="submit"
          disabled={typing || draft.trim() === ""}
          className="h-11 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <div className="flex flex-col items-center gap-1 pb-2.5 px-3 text-center text-xs text-muted">
        <p>
          Chats are stored by the site owner.{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Privacy
          </a>
        </p>
        {config.showBadge && (
          <p className="text-[11px] opacity-80">Powered by {APP_NAME}</p>
        )}
      </div>
    </div>
  );
}
