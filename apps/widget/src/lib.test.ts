import { describe, expect, it } from "vitest";
import { anchorStyles, embedUrl, isValidKey, parseOffset, parsePanelMessage, readableTextColor } from "./lib";

const APP = "https://app.example.com";
const frame = {};
const event = (over: Partial<{ origin: string; source: unknown; data: unknown }> = {}) => ({
  origin: APP,
  source: frame,
  data: { source: "askwell", type: "close" },
  ...over,
});

describe("isValidKey", () => {
  it("accepts pk_ keys and rejects everything else", () => {
    expect(isValidKey("pk_abcdefgh12345678")).toBe(true);
    for (const bad of ["", "abc", "pk_short", "sk_abcdefgh12345678", undefined, null]) {
      expect(isValidKey(bad as string | null | undefined)).toBe(false);
    }
  });
});

describe("readableTextColor", () => {
  it("picks white on dark and black on light buttons", () => {
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#1d4ed8")).toBe("#ffffff");
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#facc15")).toBe("#000000");
  });
});

describe("anchorStyles", () => {
  it("anchors the button to the chosen corner, clear of the safe area", () => {
    expect(anchorStyles("bottom-right").button).toBe(
      "bottom:calc(var(--ay) + env(safe-area-inset-bottom,0px));right:calc(var(--ax) + env(safe-area-inset-right,0px));",
    );
    expect(anchorStyles("top-left").button).toContain("top:calc(var(--ay)");
    expect(anchorStyles("top-left").button).toContain("left:calc(var(--ax)");
  });
  it("opens the panel on the side with room", () => {
    expect(anchorStyles("bottom-left").panel).toContain("bottom:calc(var(--ay) + env(safe-area-inset-bottom,0px) + 64px)");
    expect(anchorStyles("top-right").panel).toContain("top:calc(var(--ay) + env(safe-area-inset-top,0px) + 64px)");
  });
});

describe("parseOffset", () => {
  it("reads whole pixel values and clamps big ones", () => {
    expect(parseOffset("80", 20)).toBe(80);
    expect(parseOffset("0", 20)).toBe(0);
    expect(parseOffset("9999", 20)).toBe(300);
  });
  it("falls back for anything else", () => {
    for (const bad of [undefined, null, "", "-5", "12px", "1.5", "calc(1px)", "abc"]) {
      expect(parseOffset(bad as string | null | undefined, 20)).toBe(20);
    }
  });
});

describe("parsePanelMessage", () => {
  it("accepts a close and an unread message from our iframe", () => {
    expect(parsePanelMessage(event(), APP, frame)).toEqual({ type: "close" });
    expect(
      parsePanelMessage(event({ data: { source: "askwell", type: "unread", count: 2 } }), APP, frame),
    ).toEqual({ type: "unread", count: 2 });
  });
  it("ignores another origin", () => {
    expect(parsePanelMessage(event({ origin: "https://evil.example" }), APP, frame)).toBeNull();
  });
  it("ignores messages from any other window", () => {
    expect(parsePanelMessage(event({ source: {} }), APP, frame)).toBeNull();
    expect(parsePanelMessage(event(), APP, null)).toBeNull();
  });
  it("ignores unknown shapes", () => {
    for (const data of [null, "close", { type: "close" }, { source: "askwell", type: "nope" },
      { source: "askwell", type: "unread", count: "2" }]) {
      expect(parsePanelMessage(event({ data }), APP, frame)).toBeNull();
    }
  });
});

describe("embedUrl", () => {
  it("builds the embed URL with the key and the host origin", () => {
    const url = new URL(embedUrl(APP, "pk_abcdefgh12345678", "https://shop.example"));
    expect(url.origin + url.pathname).toBe(`${APP}/embed`);
    expect(url.searchParams.get("key")).toBe("pk_abcdefgh12345678");
    expect(url.searchParams.get("origin")).toBe("https://shop.example");
  });
});
