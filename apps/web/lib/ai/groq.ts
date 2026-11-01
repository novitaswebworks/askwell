import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { requireEnv } from "@/lib/supabase/env";
import { AiUnavailableError } from "./errors";

// Chat runs on Groq: fast enough for a visitor waiting on a reply. Embeddings
// stay on our own Ollama server (see ollama.ts).
export const DEFAULT_CHAT_MODEL = "llama-3.3-70b-versatile";
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
      maxOutputTokens: 400,
      abortSignal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
      maxRetries: 1,
    });
    return text.trim();
  } catch (error) {
    throw new AiUnavailableError(error);
  }
}
