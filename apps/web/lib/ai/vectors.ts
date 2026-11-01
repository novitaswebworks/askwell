// The database column is vector(1536). Ollama's nomic-embed-text returns 768
// numbers, so each vector is padded with zeros. Zeros add nothing to a dot
// product or a norm, so cosine similarity is exactly the same as unpadded.
export const EMBEDDING_COLUMN_DIMENSIONS = 1536;

export function padEmbedding(values: number[], size = EMBEDDING_COLUMN_DIMENSIONS): number[] {
  if (values.length > size) {
    throw new Error(`Embedding has ${values.length} dimensions; the column holds ${size}.`);
  }
  return values.length === size ? values : [...values, ...new Array<number>(size - values.length).fill(0)];
}

// pgvector accepts '[0.1,0.2,...]' as text; PostgREST sends it as a string.
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

// nomic-embed-text is trained with a task prefix on every text. Without it,
// questions rank the right passages noticeably worse.
export type EmbedKind = "document" | "query";

export function withEmbedPrefix(kind: EmbedKind, text: string): string {
  return `search_${kind}: ${text}`;
}
