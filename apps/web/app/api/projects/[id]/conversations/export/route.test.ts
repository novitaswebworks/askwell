import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const ownerFrom = vi.fn();
vi.mock("@/lib/supabase/owner", () => ({ createOwnerClient: () => ({ from: ownerFrom }) }));
const exportRows = vi.fn();
vi.mock("@/lib/conversations", () => ({ exportRows: (...a: unknown[]) => exportRows(...a) }));

import { GET } from "./route";

const ID = "0b1c2d3e-0000-4000-8000-000000000001";
const call = (query = "", id = ID) => GET(new Request(`http://x/export${query}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
  ownerFrom.mockReturnValue(queryResult({ data: { id: ID, name: "Suite Dreams & Co" } }));
  exportRows.mockResolvedValue([
    { conversationId: "c1", startedAt: "2026-11-01T00:00:00Z", role: "visitor", message: "=cmd|' /C calc'!A0", rating: "", sentAt: "2026-11-01T00:00:00Z" },
  ]);
});

describe("GET /api/projects/:id/conversations/export", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call()).status).toBe(401);
  });
  it("returns 404 for a bad id and for a project that is not the caller's", async () => {
    expect((await call("", "nope")).status).toBe(404);
    ownerFrom.mockReturnValue(queryResult({ data: null }));
    expect((await call()).status).toBe(404);
    expect(exportRows).not.toHaveBeenCalled();
  });
  it("sends a CSV file named after the project, with formulas defused and no caching", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="conversations-suite-dreams-co.csv"');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const text = await res.text();
    expect(text).toContain("Conversation,Started (UTC),Who,Message,Rating,Sent (UTC)");
    expect(text).toContain("'=cmd|");
  });
  it("passes the search and the not-helpful filter on", async () => {
    await call("?q=refund&filter=unhelpful");
    expect(exportRows).toHaveBeenCalledWith(expect.anything(), ID, { q: "refund", unhelpful: true });
  });
  it("reports a read failure without details", async () => {
    exportRows.mockRejectedValue(new Error("secret db detail"));
    const res = await call();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
