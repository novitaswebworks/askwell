import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const generateText = vi.fn();
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a) }));
const chatModel = vi.fn((id: string) => ({ id }));
const createOpenAICompatible = vi.fn((_opts: unknown) => ({ chatModel }));
vi.mock("@ai-sdk/openai-compatible", () => ({ createOpenAICompatible: (o: unknown) => createOpenAICompatible(o) }));

import { chatModelName, chatModelNames, DEFAULT_CHAT_MODEL, DEFAULT_FALLBACK_MODELS, generateAnswer } from "./groq";

beforeEach(() => {
  vi.clearAllMocks();
  generateText.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.GROQ_API_KEY = "gsk_test";
  delete process.env.GROQ_CHAT_MODEL;
  delete process.env.GROQ_FALLBACK_MODELS;
});
afterEach(() => {
  delete process.env.GROQ_API_KEY;
});

describe("chatModelName", () => {
  it("defaults to openai/gpt-oss-20b and can be overridden", () => {
    expect(chatModelName({})).toBe(DEFAULT_CHAT_MODEL);
    expect(DEFAULT_CHAT_MODEL).toBe("openai/gpt-oss-20b");
    expect(chatModelName({ GROQ_CHAT_MODEL: " llama-3.1-8b-instant " })).toBe("llama-3.1-8b-instant");
    expect(chatModelName({ GROQ_CHAT_MODEL: "  " })).toBe(DEFAULT_CHAT_MODEL);
  });
});

describe("chatModelNames", () => {
  it("lists the primary model, then the default fallbacks", () => {
    expect(chatModelNames({})).toEqual([DEFAULT_CHAT_MODEL, ...DEFAULT_FALLBACK_MODELS]);
  });
  it("honours GROQ_FALLBACK_MODELS and never repeats the primary", () => {
    expect(chatModelNames({ GROQ_CHAT_MODEL: "a", GROQ_FALLBACK_MODELS: "b, a ,c" })).toEqual(["a", "b", "c"]);
    expect(chatModelNames({ GROQ_FALLBACK_MODELS: "" })).toEqual([DEFAULT_CHAT_MODEL]);
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
        maxRetries: 0,
      }),
    );
  });

  it("fails over to the next model when one is throttled, and skips reasoning options for non-gpt-oss models", async () => {
    generateText
      .mockRejectedValueOnce(new Error("429 rate limit"))
      .mockResolvedValueOnce({ text: "From the second model" });
    expect(await generateAnswer("s", "p")).toBe("From the second model");
    expect(chatModel.mock.calls.map((c) => c[0])).toEqual([DEFAULT_CHAT_MODEL, DEFAULT_FALLBACK_MODELS[0]]);
    expect(generateText.mock.calls[1]![0]).not.toHaveProperty("providerOptions");
  });

  it("passes whole-millisecond timeouts, even when the time left does not divide evenly", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValue(1_000 + 1); // deadline, then 1 ms later
    generateText.mockRejectedValueOnce(new Error("429")).mockResolvedValueOnce({ text: "ok" });
    await generateAnswer("s", "p", { timeoutMs: 20_001 });
    for (const [ms] of timeout.mock.calls) expect(Number.isInteger(ms)).toBe(true);
    timeout.mockRestore();
  });

  it("fails as unavailable only after every model has failed", async () => {
    generateText.mockRejectedValue(new Error("down"));
    await expect(generateAnswer("s", "p")).rejects.toMatchObject({ name: "AiUnavailableError" });
    expect(generateText).toHaveBeenCalledTimes(1 + DEFAULT_FALLBACK_MODELS.length);
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
