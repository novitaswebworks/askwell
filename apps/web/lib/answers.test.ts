import { describe, expect, it } from "vitest";
import {
  answersToText,
  buildInterviewPrompt,
  getTemplate,
  normalizeQuestion,
  parseSavedAnswers,
  rowsFor,
  TEMPLATES,
  toSaveInput,
} from "./answers";

describe("TEMPLATES", () => {
  it("has a kind of business for the common cases, each with distinct questions", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["shop", "services", "food", "education", "software", "other"]);
    for (const t of TEMPLATES) {
      const qs = t.prompts.map((p) => normalizeQuestion(p.question));
      expect(new Set(qs).size).toBe(qs.length);
      expect(qs.length).toBeGreaterThanOrEqual(6);
      for (const p of t.prompts) expect(p.hint.length).toBeGreaterThan(5);
    }
  });
  it("falls back to the general list for an unknown kind", () => {
    expect(getTemplate("nope").id).toBe("other");
  });
});

describe("normalizeQuestion", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalizeQuestion("  What are your  Opening hours?? ")).toBe("what are your opening hours");
  });
  it("keeps letters of other languages", () => {
    expect(normalizeQuestion("आपके खुलने का समय क्या है?")).toContain("खुलने");
  });
});

describe("answersToText", () => {
  it("writes one Question/Answer block per answered item and skips blanks", () => {
    expect(
      answersToText([
        { question: " Hours? ", answer: " 9 to 5 " },
        { question: "Skipped", answer: "  " },
        { question: "Delivery?", answer: "Free over 500." },
      ]),
    ).toBe("Question: Hours?\nAnswer: 9 to 5\n\nQuestion: Delivery?\nAnswer: Free over 500.");
  });
});

describe("parseSavedAnswers", () => {
  it("accepts the saved shape and drops malformed items", () => {
    expect(
      parseSavedAnswers({ template: "shop", items: [{ question: "a", answer: "b" }, { question: 1 }, null, { question: " ", answer: "x" }] }),
    ).toEqual({ template: "shop", items: [{ question: "a", answer: "b" }] });
  });
  it("returns null for anything else", () => {
    for (const v of [null, undefined, "x", 3, {}, { template: 1, items: [] }, { template: "a", items: "no" }]) {
      expect(parseSavedAnswers(v)).toBeNull();
    }
  });
});

describe("rowsFor", () => {
  it("lists saved answers first, then the template's questions not yet answered", () => {
    const rows = rowsFor("shop", [{ question: "What are your opening hours?", answer: "9 to 5" }]);
    expect(rows[0]).toEqual({ question: "What are your opening hours?", answer: "9 to 5" });
    expect(rows.filter((r) => normalizeQuestion(r.question) === "what are your opening hours")).toHaveLength(1);
    expect(rows.length).toBe(getTemplate("shop").prompts.length);
    expect(rows.slice(1).every((r) => r.answer === "")).toBe(true);
  });
  it("keeps saved questions that the template does not have", () => {
    const rows = rowsFor("shop", [{ question: "Do you gift wrap?", answer: "Yes" }]);
    expect(rows[0]!.question).toBe("Do you gift wrap?");
    expect(rows).toHaveLength(getTemplate("shop").prompts.length + 1);
  });
});

describe("toSaveInput", () => {
  it("keeps only answered rows, trimmed", () => {
    expect(toSaveInput("shop", [{ question: " a ", answer: " b " }, { question: "c", answer: "" }])).toEqual({
      template: "shop",
      items: [{ question: "a", answer: "b" }],
    });
  });
  it("is null when nothing is answered", () => {
    expect(toSaveInput("shop", [{ question: "a", answer: " " }])).toBeNull();
  });
});

describe("buildInterviewPrompt", () => {
  const p = buildInterviewPrompt();
  it("interviews one question at a time and ends with a document to paste", () => {
    expect(p).toMatch(/one question at a time/);
    expect(p).toMatch(/write one document/);
    expect(p).toMatch(/Frequently asked questions/);
  });
  it("forbids inventing facts and asking for secrets", () => {
    expect(p).toMatch(/Never invent prices/);
    expect(p).toMatch(/Do not ask for passwords/);
  });
});
