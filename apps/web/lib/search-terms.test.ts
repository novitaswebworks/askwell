import { describe, expect, it } from "vitest";
import { keywordQuery } from "./search-terms";

describe("keywordQuery", () => {
  it("keeps the words that name things and joins them with or", () => {
    expect(keywordQuery("Tell me about Cape Town")).toBe("cape or town");
    expect(keywordQuery("What should I see in Vietnam?")).toBe("see or vietnam");
  });
  it("drops stop words, short words and repeats", () => {
    expect(keywordQuery("How do I get to the UAE? UAE!")).toBe("uae");
    expect(keywordQuery("a an of to")).toBe("");
  });
  it("keeps non-English words and digits", () => {
    expect(keywordQuery("¿Qué destinos cubren en 2026?")).toBe("qué or destinos or cubren or 2026");
  });
  it("strips operators and punctuation so the result is safe to pass on", () => {
    expect(keywordQuery(`bali' & | ! (flights) "miles" :*`)).toBe("bali or flights or miles");
  });
  it("limits how many keywords it sends", () => {
    const text = Array.from({ length: 30 }, (_, i) => `word${i}x`).join(" ");
    expect(keywordQuery(text).split(" or ")).toHaveLength(12);
  });
  it("returns an empty string when nothing is left", () => {
    expect(keywordQuery("")).toBe("");
    expect(keywordQuery("?!")).toBe("");
  });
});
