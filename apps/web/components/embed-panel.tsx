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
        } else {
          const message = (data as { error?: { message?: unknown } } | null)?.error?.message;
          addBotLine(typeof message === "string" ? message : "Something went wrong. Please try again.");
        }
      } catch {
        addBotLine("Could not reach the server. Check your connection and try again.");
      } finally {
        setTyping(false);
      }
    },
    [addBotLine, key, typing],
  );

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
            {line.role === "bot" && line.followUps && line.followUps.length > 0 && idx === lines.length - 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {line.followUps.map((fu, fIdx) => (
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
              </div>
            )}
          </div>
        ))}
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

      {config.showBadge && (
        <p className="pb-2 text-center text-xs text-muted">Powered by {APP_NAME}</p>
      )}
    </div>
  );
}
