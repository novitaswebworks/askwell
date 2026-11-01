import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import type { KnowledgeFileType } from "./files";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export function looksLikePdf(bytes: Uint8Array): boolean {
  return PDF_MAGIC.every((b, i) => bytes[i] === b);
}

// Text the model will see as data. Control characters (except tab and newline)
// are dropped; PDFs sometimes contain NUL bytes that Postgres refuses.
function clean(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export async function extractText(type: KnowledgeFileType, bytes: Uint8Array): Promise<string> {
  if (type === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return clean(text);
  }
  return clean(new TextDecoder("utf-8").decode(bytes));
}
