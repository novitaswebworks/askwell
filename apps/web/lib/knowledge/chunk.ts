export const CHUNK_SIZE = 1000; // characters
export const CHUNK_OVERLAP = 150;
export const MAX_CHUNKS_PER_SOURCE = 400;
// A markdown section shorter than this is kept together with the one after it,
// so a heading never ends up alone in a chunk.
const MIN_SECTION = 250;

// Splits one block of text into overlapping pieces of about `size` characters,
// preferring to cut at a paragraph, line or sentence end.
function splitWindow(text: string, size: number, overlap: number): string[] {
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

// Chunks follow the document's own structure: each markdown section (a heading
// and what is under it) becomes its own chunk, so a question about one place or
// topic matches a chunk about just that. Short sections join the next one, and a
// section longer than `size` is split with overlap. Text with no headings is
// split by size alone.
export function chunkText(input: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const text = input.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];

  const sections = text
    .split(/\n(?=#{1,6}[ \t])/)
    .map((section) => section.trim())
    .filter(Boolean);
  const blocks: string[] = [];
  let pending = "";
  for (const section of sections) {
    if (pending && pending.length >= MIN_SECTION) {
      blocks.push(pending);
      pending = section;
    } else {
      pending = pending ? `${pending}\n\n${section}` : section;
    }
  }
  if (pending) blocks.push(pending);

  return blocks.flatMap((block) => (block.length <= size ? [block.trim()] : splitWindow(block, size, overlap)));
}
