import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { embedMany, generateText } from "ai";
import { requireEnv } from "@/lib/supabase/env";
import { padEmbedding, toVectorLiteral } from "./vectors";

export const CHAT_MODEL = "llama3.2:3b";
export const EMBEDDING_MODEL = "nomic-embed-text";

// The server has little memory, so the first call after a quiet period loads
// the model and can take over a minute. Warm calls take a few seconds.
const EMBED_TIMEOUT_MS = 120_000;
const CHAT_TIMEOUT_MS = 120_000;
const EMBED_BATCH_SIZE = 16;

// Thrown for any failure reaching or using the model; routes show a friendly message.
export class AiUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The AI service is unavailable.", { cause });
    this.name = "AiUnavailableError";
  }
}

function provider() {
  return createOpenAICompatible({
    name: "ollama",
    baseURL: `${requireEnv("OLLAMA_BASE_URL", process.env.OLLAMA_BASE_URL).replace(/\/$/, "")}/v1`,
    apiKey: requireEnv("OLLAMA_API_KEY", process.env.OLLAMA_API_KEY),
  });
}

// Returns one vector literal per text, padded to the column width.
export async function embedTexts(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  const model = provider().embeddingModel(EMBEDDING_MODEL);
  const out: string[] = [];
  try {
    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
      const { embeddings } = await embedMany({
        model,
        values: texts.slice(i, i + EMBED_BATCH_SIZE),
        abortSignal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
        maxRetries: 1,
      });
      for (const e of embeddings) out.push(toVectorLiteral(padEmbedding(e)));
    }
  } catch (error) {
    throw new AiUnavailableError(error);
  }
  return out;
}

export async function generateAnswer(system: string, prompt: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: provider().chatModel(CHAT_MODEL),
      system,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 400,
      abortSignal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
      maxRetries: 0,
    });
    return text.trim();
  } catch (error) {
    throw new AiUnavailableError(error);
  }
}
