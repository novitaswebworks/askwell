import { describe, expect, it } from "vitest";
import { padEmbedding, toVectorLiteral, withEmbedPrefix } from "./vectors";

describe("padEmbedding", () => {
  it("pads a 768-wide vector with zeros to 1536", () => {
    const padded = padEmbedding(new Array(768).fill(0.5));
    expect(padded).toHaveLength(1536);
    expect(padded.slice(0, 768).every((v) => v === 0.5)).toBe(true);
    expect(padded.slice(768).every((v) => v === 0)).toBe(true);
  });
  it("keeps cosine similarity unchanged", () => {
    const cosine = (a: number[], b: number[]) => {
      const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
      return dot / (Math.hypot(...a) * Math.hypot(...b));
    };
    const a = [0.2, -0.4, 0.9];
    const b = [0.1, 0.8, -0.3];
    expect(cosine(padEmbedding(a, 8), padEmbedding(b, 8))).toBeCloseTo(cosine(a, b), 12);
  });
  it("leaves a full-size vector alone and rejects an oversized one", () => {
    expect(padEmbedding(new Array(1536).fill(1))).toHaveLength(1536);
    expect(() => padEmbedding(new Array(1537).fill(1))).toThrow();
  });
});

describe("toVectorLiteral", () => {
  it("formats a pgvector text literal", () => {
    expect(toVectorLiteral([1, 0.5, -2])).toBe("[1,0.5,-2]");
  });
});

describe("withEmbedPrefix", () => {
  it("adds nomic's task prefix for documents and for questions", () => {
    expect(withEmbedPrefix("document", "Refunds take 5 days.")).toBe("search_document: Refunds take 5 days.");
    expect(withEmbedPrefix("query", "How long?")).toBe("search_query: How long?");
  });
});
