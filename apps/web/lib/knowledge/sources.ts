import type { KnowledgeSource } from "@askwell/shared";
import { knowledgeStatusSchema, knowledgeTypeSchema } from "@askwell/shared";

export const SOURCE_COLUMNS = "id, title, type, status, created_at";

export interface SourceRow {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
}

export function toSource(row: SourceRow): KnowledgeSource {
  return {
    id: row.id,
    title: row.title,
    type: knowledgeTypeSchema.parse(row.type),
    status: knowledgeStatusSchema.parse(row.status),
    createdAt: row.created_at,
  };
}

export function limitMessage(plan: "free" | "pro"): string {
  return plan === "free"
    ? "The Free plan includes 3 knowledge sources per project. Upgrade to Pro for 25."
    : "You have reached the knowledge source limit for your plan.";
}

export function processingMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "EmptySourceError") return "We could not find any readable text in that source.";
  if (name === "SourceTooLargeError") return "That source is too long. Split it into smaller ones.";
  if (name === "AiUnavailableError") return "The AI service is not responding. Try again in a minute.";
  return "Could not process that source. Delete it and try again.";
}
