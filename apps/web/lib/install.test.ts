import { describe, expect, it } from "vitest";
import {
  AI_TOOLS,
  buildAiPrompt,
  buildDeveloperMessage,
  buildSnippet,
  connectionState,
  describeAge,
  hostLabel,
  mailtoLink,
  PLATFORMS,
} from "./install";

const KEY = "pk_2dcQjggZG54OZLORJ5w01M4h";
const snippet = buildSnippet("https://askwell.novitasweb.works/", KEY);

describe("buildSnippet", () => {
  it("is one script tag pointing at the widget with the key, without a double slash", () => {
    expect(snippet).toBe(`<script src="https://askwell.novitasweb.works/widget.js" data-key="${KEY}"></script>`);
  });
});

describe("PLATFORMS", () => {
  it("covers the common builders, each with numbered steps ending in a way to check it worked", () => {
    expect(PLATFORMS.map((p) => p.id)).toEqual(["wordpress", "shopify", "wix", "squarespace", "webflow", "html", "other"]);
    for (const p of PLATFORMS) {
      expect(p.steps.length).toBeGreaterThanOrEqual(3);
      expect(p.steps.at(-1)).toMatch(/chat button appears/i);
    }
  });
  it("warns where a paid plan is needed", () => {
    for (const id of ["wix", "squarespace", "webflow"]) {
      expect(PLATFORMS.find((p) => p.id === id)?.note).toMatch(/plan/i);
    }
  });
});

describe("buildAiPrompt", () => {
  const prompt = buildAiPrompt(snippet);
  it("contains the exact code and says the key is public", () => {
    expect(prompt).toContain(snippet);
    expect(prompt).toMatch(/key inside it is public/);
  });
  it("makes the AI ask which platform, go step by step, and help verify and troubleshoot", () => {
    expect(prompt).toMatch(/what my website is built with/);
    expect(prompt).toMatch(/one short step at a time/);
    expect(prompt).toMatch(/check that a chat button now appears/);
    expect(prompt).toMatch(/If the button does not appear/);
  });
  it("forbids asking for passwords or payment details", () => {
    expect(prompt).toMatch(/never ask for my password, login codes or payment details/);
  });
});

describe("buildDeveloperMessage and mailtoLink", () => {
  it("gives a developer the code and where it goes", () => {
    const msg = buildDeveloperMessage(snippet);
    expect(msg).toContain(snippet);
    expect(msg).toMatch(/before the closing <\/body> tag/);
  });
  it("encodes the subject and body for an email link", () => {
    const link = mailtoLink("Add a chat widget", "line one\nline <two> & three");
    expect(link.startsWith("mailto:?subject=Add%20a%20chat%20widget&body=")).toBe(true);
    expect(link).not.toContain("<");
    expect(decodeURIComponent(link.split("body=")[1]!)).toBe("line one\nline <two> & three");
  });
});

describe("AI_TOOLS", () => {
  it("links only to the tools' own https sites", () => {
    for (const t of AI_TOOLS) expect(t.href).toMatch(/^https:\/\//);
  });
});

describe("connectionState", () => {
  const now = Date.parse("2026-11-02T10:00:00Z");
  it("waits until the widget has been seen", () => {
    expect(connectionState(null, null, now)).toEqual({ state: "waiting" });
    expect(connectionState("2026-11-02T09:00:00Z", null, now)).toEqual({ state: "waiting" });
    expect(connectionState("garbage", "a.example", now)).toEqual({ state: "waiting" });
  });
  it("is connected with the site and how long ago", () => {
    expect(connectionState("2026-11-02T09:55:00Z", "shop.example.com", now)).toEqual({
      state: "connected",
      host: "shop.example.com",
      ageMinutes: 5,
      quiet: false,
    });
  });
  it("marks a site not seen for over a week as quiet", () => {
    expect(connectionState("2026-10-20T10:00:00Z", "shop.example.com", now)).toMatchObject({ state: "connected", quiet: true });
  });
  it("never reports a negative age (clock differences)", () => {
    expect(connectionState("2026-11-02T10:05:00Z", "a.example", now)).toMatchObject({ ageMinutes: 0 });
  });
});

describe("describeAge and hostLabel", () => {
  it("speaks plainly", () => {
    expect(describeAge(0)).toBe("just now");
    expect(describeAge(1)).toBe("1 minute ago");
    expect(describeAge(45)).toBe("45 minutes ago");
    expect(describeAge(120)).toBe("2 hours ago");
    expect(describeAge(60 * 24 * 5)).toBe("5 days ago");
  });
  it("names localhost in plain words", () => {
    expect(hostLabel("localhost")).toMatch(/your own computer/);
    expect(hostLabel("shop.example.com")).toBe("shop.example.com");
  });
});
