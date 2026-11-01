import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { embedMany } from "ai";
import { requireEnv } from "@/lib/supabase/env";
import { AiUnavailableError } from "./errors";
import { padEmbedding, toVectorLiteral } from "./vectors";

export const EMBEDDING_MODEL = "nomic-embed-text";

// The server has little memory, so the first call after a quiet period loads
// the model and can take a while. Warm calls take a few seconds.
const EMBED_TIMEOUT_MS = 120_000;
const EMBED_BATCH_SIZE = 16;

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
