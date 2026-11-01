import type { Project } from "@askwell/shared";

export const PROJECT_COLUMNS = "id, name, public_key, messages_used, period_start, created_at";

export interface ProjectRow {
  id: string;
  name: string;
  public_key: string;
  messages_used: number;
  period_start: string;
  created_at: string;
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    publicKey: row.public_key,
    messagesUsed: row.messages_used,
    periodStart: row.period_start,
    createdAt: row.created_at,
  };
}
