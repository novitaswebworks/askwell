// Pure helpers for the /embed panel and its postMessage contract with the loader.

export const VISITOR_ID_KEY = "askwell_visitor_id";
export const MESSAGE_SOURCE = "askwell";

export type PanelMessage = { source: typeof MESSAGE_SOURCE; type: "close" } | {
  source: typeof MESSAGE_SOURCE;
  type: "unread";
  count: number;
};

// The host page's origin, passed by the loader. Only an http(s) origin is usable
// as a postMessage target; anything else means "no parent to talk to".
export function parseParentOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function newVisitorId(): string {
  return crypto.randomUUID();
}

// localStorage can throw (blocked third-party storage); fall back to a per-load ID.
export function getVisitorId(storage: Pick<Storage, "getItem" | "setItem"> | null): string {
  try {
    const existing = storage?.getItem(VISITOR_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const id = newVisitorId();
    storage?.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    return newVisitorId();
  }
}
