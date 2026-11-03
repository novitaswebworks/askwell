import type { Lead } from "@askwell/shared";
import { toCsv } from "./csv";

// Visitors write these fields, so the shared CSV writer also defuses spreadsheet formulas.
export function leadsToCsv(leads: Lead[]): string {
  return toCsv(
    ["ID", "Created At", "Email", "Name", "Phone", "Conversation ID"],
    leads.map((l) => [l.id, l.createdAt, l.email, l.name ?? "", l.phone ?? "", l.conversationId ?? ""]),
  );
}
