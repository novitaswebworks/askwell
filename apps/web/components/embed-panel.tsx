"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { APP_NAME, MAX_MESSAGE_LENGTH, chatResponseSchema, type WidgetConfig } from "@askwell/shared";
import { MESSAGE_SOURCE, getVisitorId, parseParentOrigin, type PanelMessage } from "@/lib/embed";
import { LeadForm } from "@/components/embed-lead-form";
import { RatingButtons } from "@/components/embed-rating";
import { getStrings, localizeConfigText, resolveLang } from "@/lib/embed-i18n";
import { NDJSON, parseEvents } from "@/lib/chat-stream";
import { clearChat, loadChat, saveChat } from "@/lib/embed-storage";

type Line = {
  id: number;
  role: "visitor" | "bot";
  body: string;
  sources?: string[];
  followUps?: string[];
  rateable?: boolean; // a real answer from the server, so it can be rated
  rating?: 1 | -1 | null;
};
const noopSubscribe = () => () => {};
type Load = { state: "loading" } | { state: "error" } | { state: "ready"; config: WidgetConfig };

export function EmbedPanel() {
  const params = useSearchParams();
  const key = params.get("key");
  const parentOrigin = parseParentOrigin(params.get("origin"));

  // The loader passes the page's language; without it, follow the browser (after mount, so
  // the server render and the first client render agree).
  const browserLang = useSyncExternalStore(
    noopSubscribe,
    () => navigator.language,
    () => null,
  );
  const t = getStrings(resolveLang(params.get("lang") ?? browserLang));

  const [fetched, setLoad] = useState<Load>({ state: "loading" });
  const load: Load = key ? fetched : { state: "error" };
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  // The line being written while a reply streams in; the typing dots give way to it.
  const [streamingId, setStreamingId] = useState<number | null>(null);
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
  const storageRef = useRef<Storage | null>(null);
  // Bumped by "New chat": an answer that arrives for an earlier chat is dropped, not saved again.
  const generation = useRef(0);
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
    storageRef.current = storage;
    visitorId.current = getVisitorId(storage);

    if (!key) return;

    const controller = new AbortController();
    fetch(`/api/widget/config?key=${encodeURIComponent(key)}${parentOrigin ? `&origin=${encodeURIComponent(parentOrigin)}` : ""}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<WidgetConfig>) : Promise.reject(new Error("config"))))
      .then((config) => {
        // Pick up where this visitor left off on this site.
        const saved = loadChat(storage, key, Date.now());
        if (saved) {
          conversationId.current = saved.conversationId;
          nextId.current = saved.lines.length + 1;
          setLines(saved.lines.map((line, i) => ({ id: i + 1, ...line })));
        }
        setLoad({ state: "ready", config });
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setLoad({ state: "error" });
      });
    return () => controller.abort();
  }, [key, parentOrigin]);

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

  // Remember the conversation so a page change or reload does not lose it.
  useEffect(() => {
    if (!key || !conversationId.current || lines.length === 0) return;
    saveChat(
      storageRef.current,
      key,
      { conversationId: conversationId.current, lines: lines.map(({ role, body, sources, followUps, rateable, rating }) => ({ role, body, sources, followUps, rateable, rating })) },
      Date.now(),
    );
  }, [lines, key]);

  const addBotLine = useCallback(
    (body: string, sources?: string[], followUps?: string[], rateable = false) => {
      setLines((prev) => [...prev, { id: nextId.current++, role: "bot", body, sources, followUps, rateable }]);
      if (!open.current) {
        unread.current += 1;
        tell({ source: MESSAGE_SOURCE, type: "unread", count: unread.current });
      }
    },
    [tell],
  );

  // A reply that arrives as it is written. The final "done" event carries the whole reply, which
  // replaces what was shown (follow-ups removed, no-answer wording fixed) and makes it rateable.
  const readReply = useCallback(
    async (stream: ReadableStream<Uint8Array>, turn: number) => {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lineId: number | null = null;
      const finish = (reply: string, sources?: string[], followUps?: string[], rateable = false) => {
        if (lineId === null) return addBotLine(reply, sources, followUps, rateable);
        const id = lineId;
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, body: reply, sources, followUps, rateable } : l)));
        if (!open.current) {
          unread.current += 1;
          tell({ source: MESSAGE_SOURCE, type: "unread", count: unread.current });
        }
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (turn !== generation.current) {
            void reader.cancel();
            return; // "New chat" was pressed while this was on its way
          }
          buffer += decoder.decode(value, { stream: !done });
          const parsed = parseEvents(done ? `${buffer}\n` : buffer);
          buffer = parsed.rest;
          for (const event of parsed.events) {
            if (event.t === "delta") {
              if (lineId === null) {
                const id = nextId.current++;
                lineId = id;
                setStreamingId(id);
                setLines((prev) => [...prev, { id, role: "bot", body: event.text }]);
              } else {
                const id = lineId;
                setLines((prev) => prev.map((l) => (l.id === id ? { ...l, body: l.body + event.text } : l)));
              }
            } else if (event.t === "done") {
              conversationId.current = event.data.conversationId;
              finish(event.data.reply, event.data.sources, event.data.followUps, true);
              if (event.data.reply.includes("leave your email") || event.data.reply.includes("temporarily unavailable")) {
                setShowLeadForm({ open: true, type: "inquiry" });
              }
              return;
            } else {
              finish(event.message || t.errorGeneric);
              return;
            }
          }
          if (done) {
            finish(t.errorGeneric); // the stream ended without a final reply
            return;
          }
        }
      } finally {
        // Only this reply's own line: a newer reply (after "New chat") may already be streaming.
        const own = lineId;
        if (own !== null) setStreamingId((current) => (current === own ? null : current));
      }
    },
    [addBotLine, t, tell],
  );

  const sendMessage = useCallback(
    async (rawText: string) => {
      const body = rawText.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!body || typing || !key) return;
      setDraft("");
      const turn = generation.current;
      const visitorLineId = nextId.current++;
      setLines((prev) => [...prev, { id: visitorLineId, role: "visitor", body }]);
      setTyping(true);
      try {
        const post = (conversation: string | null) =>
          fetch("/api/widget/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: `${NDJSON}, application/json` },
            body: JSON.stringify({
              key,
              visitorId: visitorId.current,
              conversationId: conversation ?? undefined,
              message: body,
            }),
          });
        let res = await post(conversationId.current);
        // A remembered conversation the server no longer knows: start a new one, keep the message.
        if (res.status === 404 && conversationId.current) {
          conversationId.current = null;
          clearChat(storageRef.current, key);
          // The old transcript belongs to a conversation the server no longer has: show only this message.
          setLines((prev) => prev.filter((l) => l.id === visitorLineId));
          res = await post(null);
        }
        if (res.ok && res.body && res.headers.get("content-type")?.includes(NDJSON)) {
          await readReply(res.body, turn);
          return;
        }
        const data: unknown = await res.json().catch(() => null);
        if (turn !== generation.current) return; // "New chat" was pressed while this was on its way
        const parsed = chatResponseSchema.safeParse(data);
        if (res.ok && parsed.success) {
          conversationId.current = parsed.data.conversationId;
          addBotLine(parsed.data.reply, parsed.data.sources, parsed.data.followUps, true);
          if (
            parsed.data.reply.includes("leave your email") ||
            parsed.data.reply.includes("temporarily unavailable")
          ) {
            setShowLeadForm({ open: true, type: "inquiry" });
          }
        } else {
          const message = (data as { error?: { message?: unknown } } | null)?.error?.message;
          const fallback = typeof message === "string" ? message : t.errorGeneric;
          addBotLine(fallback);
          if (fallback.includes("leave your email") || fallback.includes("temporarily unavailable")) {
            setShowLeadForm({ open: true, type: "inquiry" });
          }
        }
      } catch {
        if (turn === generation.current) addBotLine(t.errorNetwork);
      } finally {
        if (turn === generation.current) setTyping(false);
      }
    },
    [addBotLine, key, readReply, t, typing],
  );

  // Thumbs on the latest answer. Shown at once; put back if the server says no.
  const rate = useCallback(
    async (lineId: number, next: 1 | -1 | null, previous: 1 | -1 | null) => {
      if (!key || !conversationId.current) return;
      const set = (rating: 1 | -1 | null) =>
        setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, rating } : l)));
      set(next);
      try {
        const res = await fetch("/api/widget/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, conversationId: conversationId.current, rating: next ?? 0 }),
        });
        if (!res.ok) set(previous);
      } catch {
        set(previous);
      }
    },
    [key],
  );

  async function submitLead(event: FormEvent) {
    event.preventDefault();
    if (!leadEmail.trim() || leadBusy || !key) return;
    setLeadBusy(true);
    setLeadError(null);
    try {
      const res = await fetch("/api/widget/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          conversationId: conversationId.current ?? undefined,
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
        addBotLine(t.thanks);
      } else {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setLeadError(body?.error?.message ?? t.errorLeadSave);
      }
    } catch {
      setLeadError(t.errorLeadNetwork);
    } finally {
      setLeadBusy(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    await sendMessage(draft);
  }

  const startNewChat = useCallback(() => {
    generation.current += 1;
    conversationId.current = null;
    setTyping(false);
    if (key) clearChat(storageRef.current, key);
    setLines([]);
    setShowLeadForm(null);
    setDraft("");
  }, [key]);

  if (load.state === "loading") {
    return <div className="h-full animate-pulse bg-glass" aria-busy="true" aria-label={t.loading} />;
  }
  if (load.state === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-medium">{t.unavailable}</p>
        <p className="text-sm text-muted">{t.tryLater}</p>
      </div>
    );
  }

  const config = { ...load.config, ...localizeConfigText(load.config, t) };
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h1 className="truncate text-base font-semibold">{config.headerText}</h1>
        <div className="flex items-center gap-1">
          {lines.length > 0 && (
            <button
              type="button"
              onClick={startNewChat}
              aria-label={t.newChat}
              title={t.newChat}
              className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted hover:bg-glass-strong hover:text-foreground transition"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              <span>{t.newChat}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => tell({ source: MESSAGE_SOURCE, type: "close" })}
            aria-label={t.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-glass-strong focus-visible:outline-2 focus-visible:outline-accent"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div role="log" aria-live="polite" aria-label={t.conversation} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
                  {t.talkToPerson}
                </button>
                {line.rateable && (
                  <RatingButtons
                    rating={line.rating ?? null}
                    onRate={(next) => void rate(line.id, next, line.rating ?? null)}
                    helpfulLabel={t.helpful}
                    notHelpfulLabel={t.notHelpful}
                  />
                )}
              </div>
            )}
          </div>
        ))}
        {showLeadForm && (
          <LeadForm
            type={showLeadForm.type}
            t={t}
            email={leadEmail}
            name={leadName}
            phone={leadPhone}
            busy={leadBusy}
            error={leadError}
            onEmail={setLeadEmail}
            onName={setLeadName}
            onPhone={setLeadPhone}
            onSubmit={submitLead}
            onDismiss={() => setShowLeadForm(null)}
          />
        )}
        {typing && streamingId === null && (
          <div className="flex justify-start" aria-label={t.typing} role="status">
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
          {t.yourMessage}
        </label>
        <input
          ref={inputRef}
          id="message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={t.placeholder}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-full border border-border bg-glass-strong px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="submit"
          disabled={typing || draft.trim() === ""}
          className="h-11 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t.send}
        </button>
      </form>

      <div className="flex flex-col items-center gap-1 pb-2.5 px-3 text-center text-xs text-muted">
        <p>
          {t.storedBy}{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            {t.privacy}
          </a>
        </p>
        {config.showBadge && (
          <p className="text-[11px] opacity-80">{t.poweredBy} {APP_NAME}</p>
        )}
      </div>
    </div>
  );
}
