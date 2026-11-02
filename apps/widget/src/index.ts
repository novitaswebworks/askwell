import type { WidgetConfig } from "@askwell/shared";
import { MESSAGE_SOURCE, anchorStyles, embedUrl, isValidKey, parseOffset, parsePanelMessage, readableTextColor } from "./lib";

// Runs on the customer's site. Reads data-key, fetches the config, draws a button
// inside a shadow root, and opens the chat panel in an iframe. Bad key: nothing renders.
const script = document.currentScript as HTMLScriptElement | null;
const key = script?.dataset.key;
const ROOT_ID = "askwell-widget";

if (script?.src && isValidKey(key) && !document.getElementById(ROOT_ID)) {
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
    @media (max-width: 480px) {
      :host { --ay: ${mobileOffsetY}px; }
      button { height: 48px; padding: 0 18px; font-size: 14px; }
      .panel { left: calc(10px + env(safe-area-inset-left,0px)); right: calc(10px + env(safe-area-inset-right,0px));
        width: auto; max-width: none; }
    }
    @media (prefers-reduced-motion: reduce) { .panel, button { transition: none; } }
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
    // The panel loads on first open, so pages that never open the chat pay nothing.
    if (open && !frame.src) frame.src = embedUrl(appOrigin, key, location.origin);
    panel.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    if (open) dot.classList.remove("on");
    else button.focus();
    tellPanel();
  }

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

  shadow.append(style, panel, button);
  document.body.append(host);
}
