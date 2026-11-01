import { randomUUID } from "node:crypto";

export type KnowledgeFileType = "pdf" | "md" | "txt";

const EXTENSIONS: Record<KnowledgeFileType, string[]> = {
  pdf: [".pdf"],
  md: [".md", ".markdown"],
  txt: [".txt"],
};

export const KNOWLEDGE_MIME: Record<KnowledgeFileType, string> = {
  pdf: "application/pdf",
  md: "text/markdown",
  txt: "text/plain",
};

export const KNOWLEDGE_BUCKET = "knowledge";

// The declared type must match the file's extension.
export function extensionMatchesType(filename: string, type: KnowledgeFileType): boolean {
  const lower = filename.toLowerCase();
  return EXTENSIONS[type].some((ext) => lower.endsWith(ext));
}

// The key never contains the visitor's filename, so it cannot escape the folder.
export function newStorageKey(projectId: string, type: KnowledgeFileType): string {
  return `${projectId}/${randomUUID()}.${type}`;
}
