// The streamed form of a chat reply: one JSON object per line (application/x-ndjson).
//   {"t":"delta","text":"..."}                      more of the reply
//   {"t":"done","conversationId":..,"reply":..}     the final reply, which replaces the streamed text
//   {"t":"error","message":".."}                    the stream failed after it started
// Pure helpers shared by the route and the panel, so both are unit tested.

import type { ChatResponse } from "@askwell/shared";

export const NDJSON = "application/x-ndjson";

export type StreamEvent =
  | { t: "delta"; text: string }
  | { t: "done"; data: ChatResponse }
  | { t: "error"; message: string };

export const encodeEvent = (event: StreamEvent): string => `${JSON.stringify(event)}\n`;

// Splits what has arrived so far into whole events and the unfinished rest.
export function parseEvents(buffer: string): { events: StreamEvent[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const events: StreamEvent[] = [];
  for (const line of parts) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as StreamEvent;
      if (e && (e.t === "delta" || e.t === "done" || e.t === "error")) events.push(e);
    } catch {
      // a broken line is skipped; the final "done" still carries the whole reply
    }
  }
  return { events, rest };
}

const MARKERS = ["follow-up:", "follow up:"];

// The part of the model's raw output that is safe to show so far: everything before the first
// "Follow-up:" line, minus a last line that might still turn into one.
export function visibleReply(raw: string): string {
  const marker = raw.search(/(^|\n)[ \t]*Follow[- ]up:/i);
  const text = marker >= 0 ? raw.slice(0, marker) : raw;
  if (marker < 0) {
    const tail = text.slice(text.lastIndexOf("\n") + 1).trimStart().toLowerCase();
    if (tail && MARKERS.some((m) => m.startsWith(tail))) return text.slice(0, text.lastIndexOf("\n") + 1).trimEnd();
  }
  return text.trimEnd();
}
