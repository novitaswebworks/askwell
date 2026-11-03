import { describe, expect, it } from "vitest";
import { leadsToCsv } from "./leads";
import type { Lead } from "@askwell/shared";

describe("leadsToCsv", () => {
  it("formats leads into proper CSV", () => {
    const leads: Lead[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        projectId: "550e8400-e29b-41d4-a716-446655440001",
        conversationId: "550e8400-e29b-41d4-a716-446655440002",
        email: "test@example.com",
        name: 'John "The Boss" Doe',
        phone: "+1 555-1234",
        createdAt: "2026-11-02T10:00:00Z",
      },
    ];

    const csv = leadsToCsv(leads);
    expect(csv).toContain("ID,Created At,Email,Name,Phone,Conversation ID");
    expect(csv).toContain("test@example.com");
    expect(csv).toContain('"John ""The Boss"" Doe"');
  });
  it("defuses spreadsheet formulas in what visitors typed", () => {
    const base = { id: "i", projectId: "p", conversationId: null, createdAt: "2026-11-02T10:00:00Z" };
    const csv = leadsToCsv([
      { ...base, email: "a@b.co", name: "=HYPERLINK(\"http://evil\")", phone: "+1 555" },
      { ...base, email: "c@d.co", name: "@SUM(1)", phone: "-5" },
    ]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+1 555");
    expect(csv).toContain("'@SUM(1)");
    expect(csv).toContain("'-5");
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });
});
