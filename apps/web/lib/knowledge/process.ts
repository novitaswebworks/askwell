import "server-only";
import { embedTexts } from "@/lib/ai/ollama";
import { createServiceClient } from "@/lib/supabase/service";
import { chunkText, MAX_CHUNKS_PER_SOURCE } from "./chunk";

type ServiceClient = Pick<ReturnType<typeof createServiceClient>, "from">;

const INSERT_BATCH_SIZE = 100;

export class EmptySourceError extends Error {
  constructor() {
    super("No readable text found.");
    this.name = "EmptySourceError";
  }
}

export class SourceTooLargeError extends Error {
  constructor() {
    super("The text is too long.");
    this.name = "SourceTooLargeError";
  }
}

// Chunks the text, embeds it, stores the chunks and marks the source ready.
// On any failure the partial chunks are removed and the source is marked failed.
export async function processSource(
  source: { id: string; projectId: string },
  text: string,
  client: ServiceClient = createServiceClient(),
) {
  try {
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new EmptySourceError();
    if (chunks.length > MAX_CHUNKS_PER_SOURCE) throw new SourceTooLargeError();

    const embeddings = await embedTexts(chunks);
    const rows = chunks.map((content, i) => ({
      project_id: source.projectId,
      source_id: source.id,
      content,
      embedding: embeddings[i] as string,
    }));
    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const { error } = await client.from("knowledge_chunks").insert(rows.slice(i, i + INSERT_BATCH_SIZE));
      if (error) throw new Error(`Could not store chunks: ${error.message}`);
    }
    const { error } = await client.from("knowledge_sources").update({ status: "ready" }).eq("id", source.id);
    if (error) throw new Error(`Could not mark source ready: ${error.message}`);
  } catch (error) {
    await client.from("knowledge_chunks").delete().eq("source_id", source.id);
    await client.from("knowledge_sources").update({ status: "failed" }).eq("id", source.id);
    throw error;
  }
}
