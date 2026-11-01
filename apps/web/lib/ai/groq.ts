import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { requireEnv } from "@/lib/supabase/env";
import { AiUnavailableError } from "./errors";
import type { Generation } from "@/lib/analytics";

// Chat runs on Groq: fast enough for a visitor waiting on a reply. Embeddings
// stay on our own Ollama server (see ollama.ts).
// Groq's Llama models are not open to every account (this key's /models list has
// none), so the default is an open-weights model every key can use. The 20B model
// answered in about a second every time; the 120B one often timed out on this key.
export const DEFAULT_CHAT_MODEL = "openai/gpt-oss-20b";
// Groq limits tokens per minute per model (8,000 on this key). When one model is
// throttled or down, the next one has its own allowance, so replies keep flowing.
export const DEFAULT_FALLBACK_MODELS = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"];
const CHAT_TIMEOUT_MS = 30_000;
const MIN_ATTEMPT_MS = 3_000;

type Env = Record<string, string | undefined>;

export function chatModelName(env: Env = process.env): string {
  return env.GROQ_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
}

// The primary model first, then the fallbacks (GROQ_FALLBACK_MODELS, comma
// separated, or the defaults), without repeats.
export function chatModelNames(env: Env = process.env): string[] {
  const primary = chatModelName(env);
  const fallbacks =
    env.GROQ_FALLBACK_MODELS === undefined
      ? DEFAULT_FALLBACK_MODELS
      : env.GROQ_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean);
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

export async function generateAnswer(
  system: string,
  prompt: string,
  options: { maxOutputTokens?: number; timeoutMs?: number; onGeneration?: (g: Generation) => void } = {},
): Promise<string> {
  let lastError: unknown;
  try {
    const groq = createOpenAICompatible({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: requireEnv("GROQ_API_KEY", process.env.GROQ_API_KEY),
    });
    const models = chatModelNames();
    const deadline = Date.now() + (options.timeoutMs ?? CHAT_TIMEOUT_MS);

    for (const [index, name] of models.entries()) {
      const remaining = deadline - Date.now();
      if (remaining < 500) break;
      // A whole number of milliseconds: AbortSignal.timeout rejects fractions.
      const attemptMs = Math.floor(Math.max(MIN_ATTEMPT_MS, remaining / (models.length - index)));
      const startedAt = Date.now();
      try {
        const { text, usage } = await generateText({
          model: groq.chatModel(name),
          system,
          prompt,
          temperature: 0.2,
          // gpt-oss models think before they answer; low effort keeps replies fast,
          // and the output budget leaves room for the reasoning tokens.
          ...(name.startsWith("openai/gpt-oss") ? { providerOptions: { groq: { reasoningEffort: "low" } } } : {}),
          maxOutputTokens: options.maxOutputTokens ?? 800,
          abortSignal: AbortSignal.timeout(Math.min(attemptMs, Math.floor(remaining))),
          maxRetries: 0, // a throttled model is skipped, not waited on
        });
        options.onGeneration?.({
          model: name,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          latencyMs: Date.now() - startedAt,
        });
        return text.trim();
      } catch (error) {
        lastError = error;
        console.error(`[groq] ${name} failed:`, error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    lastError = error;
  }
  throw new AiUnavailableError(lastError ?? new Error("no time left"));
}
