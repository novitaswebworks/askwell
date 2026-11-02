// The visitor's current conversation, kept in the panel's own localStorage so it
// survives a page change or reload. Storage can be blocked or full, so every
// call tolerates failure and the chat simply starts fresh.

export const CHAT_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_SAVED_LINES = 40;

export interface SavedLine {
  role: "visitor" | "bot";
  body: string;
  sources?: string[];
  followUps?: string[];
}
export interface SavedChat {
  conversationId: string;
  lines: SavedLine[];
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

export const chatStorageKey = (publicKey: string) => `askwell_chat_${publicKey}`;

function cleanLine(raw: unknown): SavedLine | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  if ((l.role !== "visitor" && l.role !== "bot") || typeof l.body !== "string" || !l.body) return null;
  return {
    role: l.role,
    body: l.body.slice(0, 5000),
    ...(strings(l.sources) ? { sources: l.sources.slice(0, 10) } : {}),
    ...(strings(l.followUps) ? { followUps: l.followUps.slice(0, 4) } : {}),
  };
}

export function loadChat(store: Store | null, publicKey: string, now: number): SavedChat | null {
  if (!store) return null;
  try {
    const parsed = JSON.parse(store.getItem(chatStorageKey(publicKey)) ?? "null") as {
      conversationId?: unknown;
      savedAt?: unknown;
      lines?: unknown;
    } | null;
    if (!parsed || typeof parsed.conversationId !== "string" || !UUID.test(parsed.conversationId)) return null;
    if (typeof parsed.savedAt !== "number" || now - parsed.savedAt > CHAT_TTL_MS) return null;
    if (!Array.isArray(parsed.lines)) return null;
    const lines = parsed.lines.map(cleanLine).filter((l): l is SavedLine => l !== null);
    return lines.length > 0 ? { conversationId: parsed.conversationId, lines: lines.slice(-MAX_SAVED_LINES) } : null;
  } catch {
    return null;
  }
}

export function saveChat(store: Store | null, publicKey: string, chat: SavedChat, now: number): void {
  if (!store) return;
  try {
    const lines = chat.lines.slice(-MAX_SAVED_LINES).map(cleanLine).filter((l): l is SavedLine => l !== null);
    store.setItem(chatStorageKey(publicKey), JSON.stringify({ conversationId: chat.conversationId, savedAt: now, lines }));
  } catch {
    // blocked or full: the chat still works, it just won't be remembered
  }
}

export function clearChat(store: Store | null, publicKey: string): void {
  try {
    store?.removeItem(chatStorageKey(publicKey));
  } catch {
    // nothing to do
  }
}
