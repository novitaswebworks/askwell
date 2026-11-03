// Minimal CSV writer. Spreadsheet programs run cells that start with = + - @ as formulas, and
// visitors write these messages, so such cells get a leading quote (OWASP "CSV injection").

function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: string[][]): string {
  // The byte order mark makes Excel read the file as UTF-8.
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
