import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const generateText = vi.fn();
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a) }));
const chatModel = vi.fn((id: string) => ({ id }));
const createOpenAICompatible = vi.fn((_opts: unknown) => ({ chatModel }));
vi.mock("@ai-sdk/openai-compatible", () => ({ createOpenAICompatible: (o: unknown) => createOpenAICompatible(o) }));

import { chatModelName, DEFAULT_CHAT_MODEL, generateAnswer } from "./groq";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GROQ_API_KEY = "gsk_test";
  delete process.env.GROQ_CHAT_MODEL;
});
afterEach(() => {
  delete process.env.GROQ_API_KEY;
});

describe("chatModelName", () => {
  it("defaults to openai/gpt-oss-120b and can be overridden", () => {
    expect(chatModelName({})).toBe(DEFAULT_CHAT_MODEL);
    expect(DEFAULT_CHAT_MODEL).toBe("openai/gpt-oss-120b");
    expect(chatModelName({ GROQ_CHAT_MODEL: " llama-3.1-8b-instant " })).toBe("llama-3.1-8b-instant");
    expect(chatModelName({ GROQ_CHAT_MODEL: "  " })).toBe(DEFAULT_CHAT_MODEL);
  });
});

describe("generateAnswer", () => {
  it("calls Groq's OpenAI-compatible endpoint with the key and returns trimmed text", async () => {
    generateText.mockResolvedValue({ text: "  Refunds take 5 days.  " });
    expect(await generateAnswer("system", "prompt")).toBe("Refunds take 5 days.");
    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: "gsk_test",
    });
    expect(chatModel).toHaveBeenCalledWith(DEFAULT_CHAT_MODEL);
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "system",
        prompt: "prompt",
        providerOptions: { groq: { reasoningEffort: "low" } },
      }),
    );
  });

  it("wraps any provider failure so the route shows a friendly message", async () => {
    generateText.mockRejectedValue(new Error("429 rate limited"));
    await expect(generateAnswer("s", "p")).rejects.toMatchObject({ name: "AiUnavailableError" });
  });

  it("fails as unavailable when the key is missing", async () => {
    delete process.env.GROQ_API_KEY;
    await expect(generateAnswer("s", "p")).rejects.toMatchObject({ name: "AiUnavailableError" });
    expect(generateText).not.toHaveBeenCalled();
  });
});
