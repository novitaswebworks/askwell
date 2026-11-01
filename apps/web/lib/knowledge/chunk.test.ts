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

  describe("markdown sections", () => {
    const section = (title: string, n: number) => `### ${title}\n${`${title} is lovely. `.repeat(n)}`.trim();

    it("makes each section its own chunk, starting with its heading", () => {
      const doc = ["# Guide", section("Bali", 20), section("Japan", 20), section("Cape Town", 20)].join("\n\n");
      const chunks = chunkText(doc);
      expect(chunks.map((c) => c.split("\n")[0])).toEqual(["# Guide", "### Japan", "### Cape Town"]);
      expect(chunks[0]).toContain("### Bali");
      expect(chunks[2]).not.toContain("Japan");
    });

    it("keeps a short section together with the next one so a heading is never alone", () => {
      const chunks = chunkText(`## Destinations\n\n${section("Bali", 20)}\n\n${section("Japan", 20)}`);
      expect(chunks[0]).toMatch(/^## Destinations\n\n### Bali/);
      expect(chunks).toHaveLength(2);
    });

    it("still splits a section that is longer than the chunk size", () => {
      const chunks = chunkText(`### Long\n${"Sentence number one is here. ".repeat(80)}`, 500, 50);
      expect(chunks.length).toBeGreaterThan(3);
      expect(chunks.every((c) => c.length <= 500)).toBe(true);
    });

    it("does not treat a # in the middle of a line as a heading", () => {
      expect(chunkText("Call us about plan #1 today. ".repeat(5))).toHaveLength(1);
    });
  });
});
