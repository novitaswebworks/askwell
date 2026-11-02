import "server-only";
import { after } from "next/server";

// The Install page says "Connected" once the widget has loaded on the owner's
// site. Every load already asks for the config, so we note when and from which
// site, at most every ten minutes per site. It is display-only: nothing else
// depends on it, and a failure here must never slow or break the widget.

export const SEEN_REFRESH_MS = 10 * 60 * 1000;

const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/;

// The site the widget is running on, from the browser's Origin (or Referer)
// header. Only a plain host name is kept: no path, no port, no credentials.
export function hostFromHeaders(headers: Pick<Headers, "get">): string | null {
  for (const name of ["origin", "referer"]) {
    const value = headers.get(name);
    if (!value || value === "null") continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      const host = url.hostname.toLowerCase();
      if (HOST_PATTERN.test(host)) return host;
    } catch {
      // try the next header
    }
  }
  return null;
}

export function shouldRecordSeen(
  last: { at: string | null; host: string | null },
  host: string | null,
  now: number,
): boolean {
  if (!host) return false;
  if (!last.at || last.host !== host) return true;
  const seenAt = Date.parse(last.at);
  return Number.isNaN(seenAt) || now - seenAt > SEEN_REFRESH_MS;
}

type Writer = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function write(client: Writer, projectId: string, host: string, now: number) {
  try {
    await client
      .from("widget_configs")
      .update({ last_seen_at: new Date(now).toISOString(), last_seen_host: host })
      .eq("project_id", projectId);
  } catch {
    // display-only
  }
}

// Runs after the response has gone out, so the visitor never waits for it.
export function recordSeen(client: Writer, projectId: string, host: string, now = Date.now()): void {
  try {
    after(() => write(client, projectId, host, now));
  } catch {
    void write(client, projectId, host, now);
  }
}
