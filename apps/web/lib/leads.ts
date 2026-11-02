import type { Lead } from "@askwell/shared";

function escapeCsvCell(val: string | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function leadsToCsv(leads: Lead[]): string {
  const headers = ["ID", "Created At", "Email", "Name", "Phone", "Conversation ID"];
  const rows = leads.map((lead) => [
    escapeCsvCell(lead.id),
    escapeCsvCell(lead.createdAt),
    escapeCsvCell(lead.email),
    escapeCsvCell(lead.name),
    escapeCsvCell(lead.phone),
    escapeCsvCell(lead.conversationId),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
