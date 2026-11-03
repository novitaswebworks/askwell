import type { WidgetConfig } from "@askwell/shared";
import {
  GREETING_DELAY_MS,
  GREETING_VISIBLE_MS,
  MAX_QUEUED_OPS,
  MESSAGE_SOURCE,
  anchorStyles,
  hasBeenGreeted,
  markGreeted,
  embedUrl,
  isValidKey,
  parseFlag,
  parseOffset,
  parsePanelMessage,
  pickLang,
  readableTextColor,
  type WidgetOp,
} from "./lib";

// window.Askwell, for a site's own buttons: Askwell.open(), .close(), .toggle().
// Calls made before the widget has loaded are kept and run once it is ready.
interface AskwellApi {
  open(): void;
  close(): void;
  toggle(): void;
}
declare global {
  interface Window {
    Askwell?: AskwellApi;
  }
}
let applyOp: ((op: WidgetOp) => void) | null = null;
const pendingOps: WidgetOp[] = [];
function runOp(op: WidgetOp) {
  if (applyOp) applyOp(op);
  else if (pendingOps.length < MAX_QUEUED_OPS) pendingOps.push(op);
}

// Runs on the customer's site. Reads data-key, fetches the config, draws a button
// inside a shadow root, and opens the chat panel in an iframe. Bad key: nothing renders.
const script = document.currentScript as HTMLScriptElement | null;
const key = script?.dataset.key;
const ROOT_ID = "askwell-widget";

// Only the first loader tag on a page starts: a second one must not replace the working window.Askwell.
if (script?.src && isValidKey(key) && !document.getElementById(ROOT_ID) && !window.Askwell) {
  window.Askwell = { open: () => runOp("open"), close: () => runOp("close"), toggle: () => runOp("toggle") };
  void start(script.src, key);
}

async function start(scriptSrc: string, key: string) {
  const appOrigin = new URL(scriptSrc).origin;
  let config: WidgetConfig;
  try {
    const res = await fetch(`${appOrigin}/api/widget/config?key=${encodeURIComponent(key)}`);
    if (!res.ok) return;
    config = (await res.json()) as WidgetConfig;
  } catch {
    return;
  }
  if (document.getElementById(ROOT_ID)) return;

  const { button: buttonAnchor, panel: panelAnchor, from } = anchorStyles(config.position);
  // The site owner can nudge the widget clear of their own UI (a bottom menu bar, say)
  // with data-offset-x / data-offset-y, and data-mobile-offset-y for phones only.
  const offsetX = parseOffset(script?.dataset.offsetX, 20);
  const offsetY = parseOffset(script?.dataset.offsetY, 20);
  const mobileOffsetY = parseOffset(script?.dataset.mobileOffsetY, offsetY);
  const host = document.createElement("div");
  host.id = ROOT_ID;
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; --ax: ${offsetX}px; --ay: ${offsetY}px; }
    * { box-sizing: border-box; }
    button { position: fixed; ${buttonAnchor} z-index: 2147483646; display: inline-flex; align-items: center;
      height: 52px; padding: 0 22px; border: 0; border-radius: 26px; cursor: pointer;
      font: 500 15px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      background: ${config.buttonColor}; color: ${readableTextColor(config.buttonColor)};
      box-shadow: 0 6px 24px rgb(0 0 0 / 0.22); transition: transform .15s ease-out; }
    button:hover { transform: translateY(-1px); }
    button:focus-visible { outline: 3px solid ${config.buttonColor}; outline-offset: 3px; }
    .dot { display: none; position: absolute; top: -4px; right: -4px; width: 14px; height: 14px;
      border-radius: 50%; background: #e11d48; border: 2px solid #fff; }
    .dot.on { display: block; }
    .panel { position: fixed; ${panelAnchor} z-index: 2147483647; width: 380px;
      --room: calc(var(--ay) + 64px + 24px + env(safe-area-inset-top,0px) + env(safe-area-inset-bottom,0px));
      height: min(600px, calc(100vh - var(--room))); height: min(600px, calc(100dvh - var(--room)));
      max-width: calc(100vw - 2 * var(--ax) - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px)); border-radius: 16px; overflow: hidden; background: #fff;
      box-shadow: 0 12px 48px rgb(0 0 0 / 0.28); visibility: hidden; opacity: 0; pointer-events: none;
      transition: opacity .2s ease-out, transform .2s ease-out, visibility 0s linear .2s; }
    .panel.fade { transform: none; }
    .panel.slide { transform: translateY(${from}); }
    .panel.scale { transform: scale(.92); transform-origin: ${config.position.replace("-", " ")}; }
    .panel.open { visibility: visible; opacity: 1; pointer-events: auto; transform: none;
      transition: opacity .2s ease-out, transform .2s ease-out, visibility 0s; }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
    .bubble { position: fixed; ${panelAnchor} z-index: 2147483646; display: none; max-width: min(260px, calc(100vw - 2 * var(--ax) - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px)));
      background: #fff; color: #111; border-radius: 16px; box-shadow: 0 8px 32px rgb(0 0 0 / 0.22); }
    .bubble.on { display: block; animation: pop .25s ease-out; }
    .bubble .msg { all: unset; display: block; box-sizing: border-box; cursor: pointer; padding: 11px 32px 11px 14px;
      font: 400 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; overflow-wrap: anywhere; }
    .bubble .msg:focus-visible, .bubble .x:focus-visible { outline: 2px solid ${config.buttonColor}; outline-offset: 2px; border-radius: 8px; }
    .bubble .x { all: unset; position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; line-height: 22px; text-align: center;
      border-radius: 50%; cursor: pointer; color: #555; font: 400 16px/22px system-ui, sans-serif; }
    .bubble .x:hover { background: #eee; }
    @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }
    @media (max-width: 480px) {
      :host { --ay: ${mobileOffsetY}px; }
      button { height: 48px; padding: 0 18px; font-size: 14px; }
      .panel { left: calc(10px + env(safe-area-inset-left,0px)); right: calc(10px + env(safe-area-inset-right,0px));
        width: auto; max-width: none; }
    }
    @media (prefers-reduced-motion: reduce) { .panel, button { transition: none; } .bubble.on { animation: none; } }
  `;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = config.label;
  button.setAttribute("aria-expanded", "false");
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.setAttribute("aria-hidden", "true");
  button.append(dot);

  const panel = document.createElement("div");
  panel.className = `panel ${config.animation}`;
  const frame = document.createElement("iframe");
  frame.title = config.headerText;
  panel.append(frame);

  let open = false;
  // Until the panel page has loaded, the iframe is an empty document on the
  // host's own origin, and posting to it with our origin as target is refused.
  let ready = false;
  function tellPanel() {
    if (!ready) return;
    frame.contentWindow?.postMessage({ source: MESSAGE_SOURCE, type: "visibility", open }, appOrigin);
  }
  function setOpen(next: boolean) {
    open = next;
    if (open) hideGreeting();
    // The panel loads on first open, so pages that never open the chat pay nothing.
    if (open && !frame.src) {
      const lang = pickLang(script?.dataset.lang, document.documentElement.lang, navigator.language);
      frame.src = embedUrl(appOrigin, key, location.origin, lang);
    }
    panel.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    if (open) dot.classList.remove("on");
    else button.focus();
    tellPanel();
  }

  // Greeting bubble: off unless the owner turned it on, shown once per visitor, never while the
  // chat is open, and a site can switch it off for a page with data-no-greeting.
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const greetingButton = document.createElement("button");
  greetingButton.type = "button";
  greetingButton.className = "msg";
  greetingButton.textContent = config.greetingText;
  const greetingClose = document.createElement("button");
  greetingClose.type = "button";
  greetingClose.className = "x";
  greetingClose.setAttribute("aria-label", "Close");
  greetingClose.textContent = "\u00d7";
  bubble.append(greetingButton, greetingClose);
  let greetingTimer: number | undefined;
  function hideGreeting() {
    window.clearTimeout(greetingTimer);
    bubble.classList.remove("on");
  }
  greetingButton.addEventListener("click", () => setOpen(true));
  greetingClose.addEventListener("click", hideGreeting);

  button.addEventListener("click", () => setOpen(!open));
  frame.addEventListener("load", () => {
    // Some browsers fire load for the empty iframe too; only our panel counts.
    if (!frame.src) return;
    ready = true;
    tellPanel();
  });
  window.addEventListener("message", (event) => {
    const message = parsePanelMessage(event, appOrigin, frame.contentWindow);
    if (!message) return;
    if (message.type === "close") setOpen(false);
    else if (!open && message.count > 0) dot.classList.add("on");
  });

  shadow.append(style, panel, bubble, button);
  document.body.append(host);

  if (config.greetingEnabled && config.greetingText && !parseFlag(script?.dataset.noGreeting)) {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    if (!hasBeenGreeted(storage, key)) {
      greetingTimer = window.setTimeout(() => {
        if (open) return;
        markGreeted(storage, key);
        bubble.classList.add("on");
        greetingTimer = window.setTimeout(hideGreeting, GREETING_VISIBLE_MS);
      }, GREETING_DELAY_MS);
    }
  }

  applyOp = (op) => {
    const next = op === "toggle" ? !open : op === "open";
    if (next !== open) setOpen(next);
  };
  const queued = pendingOps.splice(0);
  for (const op of queued) applyOp(op);
  if (queued.length === 0 && parseFlag(script?.dataset.openOnLoad)) setOpen(true);
}
