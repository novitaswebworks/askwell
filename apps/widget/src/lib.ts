import type { WidgetConfig } from "@askwell/shared";

export const MESSAGE_SOURCE = "askwell";
const KEY_PATTERN = /^pk_[A-Za-z0-9]{8,64}$/;

export function isValidKey(key: string | null | undefined): key is string {
  return typeof key === "string" && KEY_PATTERN.test(key);
}

// Black or white text, whichever reads better on the button color (WCAG luminance).
export function readableTextColor(hex: string): "#000000" | "#ffffff" {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

const MAX_OFFSET = 300;

// Optional data-offset-* values from the script tag, in px. Anything else means "use the default".
export function parseOffset(value: string | null | undefined, fallback: number): number {
  if (typeof value !== "string" || !/^\d{1,4}$/.test(value.trim())) return fallback;
  return Math.min(Number(value), MAX_OFFSET);
}

// CSS for the button; the panel sits next to it, on the side with room. Distances
// come from --ax / --ay (set on the host, so a phone can override them) plus the
// device's safe-area inset, which keeps the button clear of notches and home bars.
export function anchorStyles(position: WidgetConfig["position"]) {
  const top = position.startsWith("top");
  const left = position.endsWith("left");
  const v = top ? "top" : "bottom";
  const h = left ? "left" : "right";
  const edge = (side: string, size: string, extra = "") =>
    `${side}:calc(${size} + env(safe-area-inset-${side},0px)${extra});`;
  return {
    button: edge(v, "var(--ay)") + edge(h, "var(--ax)"),
    panel: edge(v, "var(--ay)", " + 64px") + edge(h, "var(--ax)"),
    from: top ? "-12px" : "12px",
  };
}

export type PanelMessage =
  | { type: "close" }
  | { type: "unread"; count: number };

// Accept only the shapes we define, from the app origin, from our own iframe.
export function parsePanelMessage(
  event: { origin: string; source: unknown; data: unknown },
  appOrigin: string,
  frameWindow: unknown,
): PanelMessage | null {
  if (event.origin !== appOrigin || !frameWindow || event.source !== frameWindow) return null;
  const data = event.data as { source?: unknown; type?: unknown; count?: unknown } | null;
  if (!data || typeof data !== "object" || data.source !== MESSAGE_SOURCE) return null;
  if (data.type === "close") return { type: "close" };
  if (data.type === "unread" && typeof data.count === "number" && Number.isFinite(data.count)) {
    return { type: "unread", count: Math.max(0, Math.floor(data.count)) };
  }
  return null;
}

export function embedUrl(appOrigin: string, key: string, hostOrigin: string): string {
  const url = new URL("/embed", appOrigin);
  url.searchParams.set("key", key);
  url.searchParams.set("origin", hostOrigin);
  return url.toString();
}
