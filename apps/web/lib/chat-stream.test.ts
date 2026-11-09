import { describe, expect, it } from "vitest";
import { encodeEvent, mayBeRefusal, parseEvents, visibleReply } from "./chat-stream";

describe("parseEvents", () => {
  it("returns whole events and keeps the unfinished line for later", () => {
    const first = encodeEvent({ t: "delta", text: "Hel" }) + '{"t":"del';
    const { events, rest } = parseEvents(first);
    expect(events).toEqual([{ t: "delta", text: "Hel" }]);
    expect(parseEvents(rest + 'ta","text":"lo"}\n').events).toEqual([{ t: "delta", text: "lo" }]);
  });
  it("skips broken and unknown lines", () => {
    expect(parseEvents('not json\n{"t":"nope"}\n' + encodeEvent({ t: "error", message: "x" })).events).toEqual([{ t: "error", message: "x" }]);
  });
});

describe("visibleReply", () => {
  it("shows plain text as it grows", () => {
    expect(visibleReply("We ship")).toBe("We ship");
    expect(visibleReply("We ship worldwide.")).toBe("We ship worldwide.");
  });
  it("cuts the follow-up lines", () => {
    expect(visibleReply("Yes.\nFollow-up: Cost?\nFollow-up: Time?")).toBe("Yes.");
    expect(visibleReply("Yes.\n\nfollow up: Cost?")).toBe("Yes.");
  });
  it("holds back a last line that may still become a follow-up marker", () => {
    expect(visibleReply("Yes.\nFol")).toBe("Yes.");
    expect(visibleReply("Yes.\nFollow-")).toBe("Yes.");
    expect(visibleReply("Yes.\nFollowing the steps")).toBe("Yes.\nFollowing the steps");
  });
  it("never shows a reply that starts as a marker", () => {
    expect(visibleReply("Follow-up: x")).toBe("");
  });
});

describe("mayBeRefusal", () => {
  const refusals = ["I don't have that information right now."];
  it("holds back a start of the refusal and a full refusal", () => {
    expect(mayBeRefusal("I don", refusals)).toBe(true);
    expect(mayBeRefusal("Sorry. I don't have that information right now.", refusals)).toBe(true);
  });
  it("lets other text through", () => {
    expect(mayBeRefusal("I can help with that.", refusals)).toBe(false);
    expect(mayBeRefusal("We ship worldwide.", refusals)).toBe(false);
  });
});
