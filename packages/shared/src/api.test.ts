import { describe, expect, it } from "vitest";
import { chatRequestSchema, knowledgeUploadUrlRequestSchema, updateConfigSchema } from "./api";
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
  });
});
