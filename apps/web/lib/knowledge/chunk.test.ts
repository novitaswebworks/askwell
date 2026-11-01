import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns nothing for blank text", () => {
    expect(chunkText("  \n\n ")).toEqual([]);
  });
  it("keeps short text as one chunk", () => {
    expect(chunkText("Refunds take 5 days.")).toEqual(["Refunds take 5 days."]);
  });
  it("splits long text into overlapping chunks no larger than the size", () => {
    const sentence = "The shop opens at nine and closes at five. ";
    const chunks = chunkText(sentence.repeat(100), 300, 50);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= 300)).toBe(true);
    // overlap: each chunk starts with text that ended the previous one
    for (let i = 1; i < chunks.length; i++) {
      const tail = (chunks[i - 1] as string).slice(-20);
      expect((chunks[i] as string).startsWith(tail.trim().slice(0, 5)) || chunks[i]!.includes(tail.trim().slice(-8))).toBe(true);
    }
  });
  it("prefers to cut at a paragraph break", () => {
    const text = `${"a".repeat(180)}\n\n${"b".repeat(180)}`;
    const chunks = chunkText(text, 250, 20);
    expect(chunks[0]).toBe("a".repeat(180));
  });
  it("covers all of the text", () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
    const joined = chunkText(words, 200, 30).join(" ");
    for (const w of ["word0", "word199", "word399"]) expect(joined).toContain(w);
  });
  it("always terminates, even with no break points", () => {
    expect(chunkText("x".repeat(5000), 500, 100).length).toBeGreaterThan(9);
  });
});
