import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (...a: unknown[]) => getAccountPlan(...a) }));
const ownerFrom = vi.fn();
vi.mock("@/lib/supabase/owner", () => ({ createOwnerClient: () => ({ from: ownerFrom }) }));
const rpc = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc }) }));

import { GET, POST } from "./route";

const row = {
  id: "0b1c2d3e-0000-4000-8000-000000000001",
  name: "Shop",
  about: "A shop.",
  allowed_domains: [],
  public_key: "pk_abcdefgh12345678",
  messages_used: 0,
  period_start: "2026-11-01",
  created_at: "2026-11-01T00:00:00Z",
};
const post = (body: unknown) =>
  POST(new Request("http://x/api/projects", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
  getAccountPlan.mockResolvedValue("free");
});

describe("GET /api/projects", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await GET()).status).toBe(401);
  });
  it("returns the owner's projects mapped to the shared shape", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: [row] }));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: row.id,
        name: "Shop",
        about: "A shop.",
        allowedDomains: [],
        publicKey: row.public_key,
        messagesUsed: 0,
        periodStart: "2026-11-01",
        createdAt: row.created_at,
      },
    ]);
  });
});

describe("POST /api/projects", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await post({ name: "A" })).status).toBe(401);
  });
  it("rejects an empty name", async () => {
    const res = await post({ name: "  " });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_input");
  });
  it("creates a project with the server-read plan limit", async () => {
    rpc.mockResolvedValue({ data: row, error: null });
    const res = await post({ name: "Shop" });
    expect(res.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith(
      "create_project",
      expect.objectContaining({ p_owner_id: "user_1", p_name: "Shop", p_max_projects: 1 }),
    );
  });
  it("uses the Pro limit for a Pro account", async () => {
    getAccountPlan.mockResolvedValue("pro");
    rpc.mockResolvedValue({ data: row, error: null });
    await post({ name: "Shop" });
    expect(rpc.mock.calls[0][1].p_max_projects).toBe(5);
  });
  it("refuses the second project on Free", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "project_limit_reached" } });
    const res = await post({ name: "Second" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("limit_reached");
  });
  it("retries once on a public key collision", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate" } })
      .mockResolvedValueOnce({ data: row, error: null });
    expect((await post({ name: "Shop" })).status).toBe(201);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
