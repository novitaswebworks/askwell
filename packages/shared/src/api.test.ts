import { describe, expect, it } from "vitest";
import {
  chatRequestSchema,
  saveAnswersSchema,
  chatResponseSchema,
  knowledgeUploadUrlRequestSchema,
  updateConfigSchema,
  conversationThreadSchema,
  subscribeResponseSchema,
  updateProjectSchema,
  widgetConfigSchema,
  captureLeadRequestSchema,
  testAnswerRequestSchema,
} from "./api";
import { MAX_KNOWLEDGE_FILE_BYTES, MAX_MESSAGE_LENGTH } from "./constants";

const base = { key: "pk_abcdefgh1234", visitorId: "visitor-1234" };

describe("chatRequestSchema", () => {
  it("accepts a normal message", () => {
    expect(chatRequestSchema.safeParse({ ...base, message: "hello" }).success).toBe(true);
  });
  it("rejects empty and oversize messages", () => {
    expect(chatRequestSchema.safeParse({ ...base, message: "   " }).success).toBe(false);
    expect(
      chatRequestSchema.safeParse({ ...base, message: "a".repeat(MAX_MESSAGE_LENGTH + 1) }).success,
    ).toBe(false);
  });
  it("rejects a malformed public key", () => {
    expect(chatRequestSchema.safeParse({ ...base, key: "sk_nope", message: "hi" }).success).toBe(false);
  });
});

describe("chatResponseSchema", () => {
  const id = "0b1c2d3e-0000-4000-8000-000000000001";
  it("accepts reply with optional sources and followUps", () => {
    expect(chatResponseSchema.safeParse({ conversationId: id, reply: "Hello" }).success).toBe(true);
    expect(
      chatResponseSchema.safeParse({
        conversationId: id,
        reply: "Hello",
        sources: ["Refund policy"],
        followUps: ["How do I return?", "What is the fee?"],
      }).success,
    ).toBe(true);
  });
});

describe("knowledgeUploadUrlRequestSchema", () => {
  const ok = { title: "Guide", filename: "guide.pdf", size: 1000, type: "pdf" };
  it("accepts a file within the size limit", () => {
    expect(knowledgeUploadUrlRequestSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects files over the limit and the text type", () => {
    expect(
      knowledgeUploadUrlRequestSchema.safeParse({ ...ok, size: MAX_KNOWLEDGE_FILE_BYTES + 1 }).success,
    ).toBe(false);
    expect(knowledgeUploadUrlRequestSchema.safeParse({ ...ok, type: "text" }).success).toBe(false);
  });
});

describe("updateConfigSchema", () => {
  it("accepts a partial update and rejects an empty one", () => {
    expect(updateConfigSchema.safeParse({ buttonColor: "#ff0000" }).success).toBe(true);
    expect(updateConfigSchema.safeParse({}).success).toBe(false);
    expect(updateConfigSchema.safeParse({ buttonColor: "red" }).success).toBe(false);
    expect(updateConfigSchema.safeParse({ welcomeMessage: "   " }).success).toBe(false);
    expect(updateConfigSchema.safeParse({ welcomeMessage: "Welcome!" }).success).toBe(true);
  });
  it("limits the greeting bubble text to 1 to 120 characters", () => {
    expect(updateConfigSchema.safeParse({ greetingEnabled: true, greetingText: "Hi there" }).success).toBe(true);
    expect(updateConfigSchema.safeParse({ greetingText: "   " }).success).toBe(false);
    expect(updateConfigSchema.safeParse({ greetingText: "x".repeat(121) }).success).toBe(false);
    expect(updateConfigSchema.safeParse({ greetingEnabled: "yes" }).success).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("accepts a name, a description, or both", () => {
    expect(updateProjectSchema.safeParse({ name: "Shop" }).success).toBe(true);
    expect(updateProjectSchema.safeParse({ about: "A travel advisor." }).success).toBe(true);
    expect(updateProjectSchema.safeParse({ name: "Shop", about: "x" }).success).toBe(true);
  });
  it("allows clearing the description", () => {
    expect(updateProjectSchema.parse({ about: "   " })).toEqual({ about: "" });
  });
  it("rejects an empty body, a blank name and a description over 600 characters", () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
    expect(updateProjectSchema.safeParse({ name: " " }).success).toBe(false);
    expect(updateProjectSchema.safeParse({ about: "x".repeat(601) }).success).toBe(false);
  });
});

describe("conversationThreadSchema", () => {
  const id = "0b1c2d3e-0000-4000-8000-000000000001";
  it("accepts a thread with visitor and bot messages", () => {
    expect(
      conversationThreadSchema.safeParse({
        id,
        projectId: id,
        createdAt: "2026-11-01T00:00:00Z",
        messages: [
          { id, role: "visitor", body: "Hi", rating: null, createdAt: "2026-11-01T00:00:00Z" },
          { id, role: "bot", body: "Hello!", rating: 1, createdAt: "2026-11-01T00:00:01Z" },
        ],
      }).success,
    ).toBe(true);
  });
  it("rejects an unknown role", () => {
    expect(
      conversationThreadSchema.safeParse({
        id,
        projectId: id,
        createdAt: "x",
        messages: [{ id, role: "system", body: "x", createdAt: "x" }],
      }).success,
    ).toBe(false);
  });
});

describe("subscribeResponseSchema", () => {
  it("needs the subscription ID and the public key ID", () => {
    const ok = { subscriptionId: "sub_1", keyId: "rzp_test_abc", name: "Asha", email: "a@example.com" };
    expect(subscribeResponseSchema.safeParse(ok).success).toBe(true);
    expect(subscribeResponseSchema.safeParse({ ...ok, subscriptionId: "" }).success).toBe(false);
    expect(subscribeResponseSchema.safeParse({ ...ok, keyId: "" }).success).toBe(false);
  });
});

describe("captureLeadRequestSchema", () => {
  it("accepts valid email and conversation id", () => {
    const valid = captureLeadRequestSchema.safeParse({
      key: "pk_12345678abcdef",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      email: "visitor@example.com",
      name: "Jane Doe",
      phone: "+1 555-1234",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects invalid email formats", () => {
    const invalid = captureLeadRequestSchema.safeParse({
      key: "pk_12345678abcdef",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      email: "not-an-email",
    });
    expect(invalid.success).toBe(false);
  });
});

describe("updateProjectSchema allowed domains", () => {
  it("accepts and normalizes a domain list on its own", () => {
    expect(updateProjectSchema.parse({ allowedDomains: ["https://www.Site.com/"] })).toEqual({ allowedDomains: ["site.com"] });
    expect(updateProjectSchema.parse({ allowedDomains: [] })).toEqual({ allowedDomains: [] });
  });
  it("rejects a bad entry", () => {
    expect(updateProjectSchema.safeParse({ allowedDomains: ["not a domain"] }).success).toBe(false);
  });
});

describe("saveAnswersSchema size", () => {
  const item = (n: number) => ({ question: `Question ${n}?`, answer: "a".repeat(2000) });
  it("accepts a normal set of answers", () => {
    expect(saveAnswersSchema.safeParse({ template: "business", items: Array.from({ length: 10 }, (_, i) => item(i)) }).success).toBe(true);
  });
  it("refuses a set the database would reject (over about 95,000 bytes in total)", () => {
    const tooBig = { template: "business", items: Array.from({ length: 80 }, (_, i) => item(i)) }; // about 164,000 bytes
    expect(saveAnswersSchema.safeParse(tooBig).success).toBe(false);
  });
  it("counts bytes, not characters, so non-Latin text cannot slip past", () => {
    const wide = { template: "business", items: Array.from({ length: 40 }, (_, i) => ({ question: `Q${i}?`, answer: "é".repeat(1500) })) }; // 2 bytes each
    expect(new TextEncoder().encode(JSON.stringify(wide)).length).toBeGreaterThan(95_000);
    expect(saveAnswersSchema.safeParse(wide).success).toBe(false);
  });
});

describe("testAnswerRequestSchema", () => {
  it("accepts a question and rejects an empty or oversize one", () => {
    expect(testAnswerRequestSchema.safeParse({ message: "Do you ship?" }).success).toBe(true);
    expect(testAnswerRequestSchema.safeParse({ message: "  " }).success).toBe(false);
    expect(testAnswerRequestSchema.safeParse({ message: "a".repeat(MAX_MESSAGE_LENGTH + 1) }).success).toBe(false);
  });
});
