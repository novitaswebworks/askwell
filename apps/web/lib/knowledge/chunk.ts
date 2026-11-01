export const CHUNK_SIZE = 1000; // characters
export const CHUNK_OVERLAP = 150;
export const MAX_CHUNKS_PER_SOURCE = 400;

// Splits text into overlapping pieces of about CHUNK_SIZE characters, preferring
// to cut at a paragraph, line or sentence end so a chunk reads as a whole thought.
export function chunkText(input: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const text = input.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const floor = Math.floor(size * 0.5);
      const cut = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("? "),
        window.lastIndexOf("! "),
      );
      if (cut >= floor) end = start + cut + 1;
    }
    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
