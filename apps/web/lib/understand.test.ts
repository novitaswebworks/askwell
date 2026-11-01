import { describe, expect, it } from "vitest";
import { buildUnderstandPrompt, HISTORY_TURNS, parseUnderstanding, trimHistory, type Turn } from "./understand";

const msg = "How can I book?";

describe("parseUnderstanding", () => {
  it("reads a question and its standalone rewrite", () => {
    expect(parseUnderstanding('{"type":"question","smalltalk":null,"standalone":"How do I book a trip?"}', msg)).toEqual({
      type: "question",
      standalone: "How do I book a trip?",
    });
  });
  it("reads small talk and defaults an unknown kind to hello", () => {
    expect(parseUnderstanding('{"type":"smalltalk","smalltalk":"thanks","standalone":""}', "thx")).toEqual({
      type: "smalltalk",
      smalltalk: "thanks",
    });
    expect(parseUnderstanding('{"type":"smalltalk","smalltalk":"wat"}', "yo")).toEqual({ type: "smalltalk", smalltalk: "hello" });
  });
  it("reads off-topic and human requests", () => {
    expect(parseUnderstanding('{"type":"off_topic","standalone":""}', "who won the cup")).toEqual({ type: "off_topic" });
    expect(parseUnderstanding('{"type":"human","standalone":"Contact someone"}', "agent please")).toEqual({
      type: "human",
      standalone: "Contact someone",
    });
  });
  it("uses the original message when the rewrite is missing or blank", () => {
    expect(parseUnderstanding('{"type":"question","standalone":"  "}', msg)).toEqual({ type: "question", standalone: msg });
    expect(parseUnderstanding('{"type":"question"}', msg)).toEqual({ type: "question", standalone: msg });
  });
  it("finds JSON inside extra text or a code fence", () => {
    expect(parseUnderstanding('```json\n{"type":"off_topic"}\n```', msg)).toEqual({ type: "off_topic" });
  });
  it("falls back to a plain question for anything unusable", () => {
    for (const bad of ["", "not json", "{broken", '{"type":"banana"}', "[1,2]", "null", '{"type":7}']) {
      expect(parseUnderstanding(bad, msg)).toEqual({ type: "question", standalone: msg });
    }
  });
});

describe("history and prompt", () => {
  const turns: Turn[] = Array.from({ length: 7 }, (_, i) => ({ role: i % 2 ? "bot" : "visitor", body: `m${i}` }));
  it("keeps only the last few turns and trims long ones", () => {
    expect(trimHistory(turns).map((t) => t.body)).toEqual(["m3", "m4", "m5", "m6"]);
    expect(HISTORY_TURNS).toBe(4);
    expect(trimHistory([{ role: "bot", body: "x".repeat(900) }])[0]!.body).toHaveLength(300);
  });
  it("builds a prompt with the business, the conversation and the latest message", () => {
    const prompt = buildUnderstandPrompt("A travel advisor.", turns.slice(-2), "and Japan?");
    expect(prompt).toContain("About the business: A travel advisor.");
    expect(prompt).toContain("Assistant: m5\nVisitor: m6");
    expect(prompt.endsWith("Latest visitor message:\nand Japan?")).toBe(true);
  });
  it("says so when there is no description or history", () => {
    const prompt = buildUnderstandPrompt("  ", [], "hi");
    expect(prompt).toContain("About the business: (not provided)");
    expect(prompt).toContain("Conversation so far:\n(none)");
  });
});
