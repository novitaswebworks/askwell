import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { requireEnv } from "@/lib/supabase/env";
import { AiUnavailableError } from "./errors";

// Chat runs on Groq: fast enough for a visitor waiting on a reply. Embeddings
// stay on our own Ollama server (see ollama.ts).
// Groq's Llama models are not open to every account (this key's /models list has
// none), so the default is an open-weights model every key can use. About 1 s a reply.
export const DEFAULT_CHAT_MODEL = "openai/gpt-oss-120b";
const CHAT_TIMEOUT_MS = 30_000;

export function chatModelName(env: Record<string, string | undefined> = process.env): string {
  return env.GROQ_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
}

export async function generateAnswer(system: string, prompt: string): Promise<string> {
  try {
    const groq = createOpenAICompatible({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: requireEnv("GROQ_API_KEY", process.env.GROQ_API_KEY),
    });
    const { text } = await generateText({
      model: groq.chatModel(chatModelName()),
      system,
      prompt,
      temperature: 0.2,
      // gpt-oss models think before they answer; low effort keeps replies fast,
      // and the output budget leaves room for the reasoning tokens.
      providerOptions: { groq: { reasoningEffort: "low" } },
      maxOutputTokens: 800,
      abortSignal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
      maxRetries: 1,
    });
    return text.trim();
  } catch (error) {
    throw new AiUnavailableError(error);
  }
}
