import { PRO_PRICE_INR } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { contactEmail, LEGAL_DOCS, PRIVACY, REFUNDS, TERMS } from "./legal";

const text = (d: (typeof LEGAL_DOCS)[number]) =>
  [d.intro, ...d.sections.flatMap((s) => [s.heading, ...(s.paragraphs ?? []), ...(s.list ?? [])])].join("\n");

describe("legal documents", () => {
  it("each has a title, a description and several sections, and no empty sections", () => {
    expect(LEGAL_DOCS.map((d) => d.slug)).toEqual(["terms", "privacy", "refunds"]);
    for (const d of LEGAL_DOCS) {
      expect(d.title.length).toBeGreaterThan(5);
      expect(d.description.length).toBeGreaterThan(10);
      expect(d.sections.length).toBeGreaterThanOrEqual(4);
      for (const s of d.sections) expect((s.paragraphs?.length ?? 0) + (s.list?.length ?? 0)).toBeGreaterThan(0);
    }
  });
  it("quote the real price and the real plan limits", () => {
    expect(text(TERMS)).toContain(`₹${PRO_PRICE_INR} a month`);
    expect(text(TERMS)).toContain("100 messages a month");
    expect(text(REFUNDS)).toContain(`₹${PRO_PRICE_INR} a month`);
  });
  it("say what the product does about cancelling and refunds", () => {
    expect(text(REFUNDS)).toMatch(/returns to the Free plan straight away/);
    expect(text(REFUNDS)).toMatch(/not refunded/);
  });
  it("name the providers that handle data, and say chat text is not sent to analytics", () => {
    for (const name of ["Clerk", "Supabase", "Vercel", "Groq", "Cashfree", "Arcjet", "PostHog"]) expect(text(PRIVACY)).toContain(name);
    expect(text(PRIVACY)).toMatch(/never include the text of chat messages/);
  });
});

describe("contactEmail", () => {
  it("is shown only for a valid address", () => {
    expect(contactEmail({})).toBeNull();
    expect(contactEmail({ NEXT_PUBLIC_CONTACT_EMAIL: "not an email" })).toBeNull();
    expect(contactEmail({ NEXT_PUBLIC_CONTACT_EMAIL: " help@example.com " })).toBe("help@example.com");
  });
});
