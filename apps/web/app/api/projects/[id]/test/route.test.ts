import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/owner", () => ({
  createOwnerClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}));
const protectRate = vi.fn();
vi.mock("@/lib/protect", () => ({ protectRate: (...a: unknown[]) => protectRate(...a) }));
const answerForOwner = vi.fn();
vi.mock("@/lib/test-answer", () => ({ answerForOwner: (...a: unknown[]) => answerForOwner(...a) }));

import { POST } from "./route";

const ID = "0b1c2d3e-0000-4000-8000-000000000001";
const call = (body: unknown, id = ID) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
  maybeSingle.mockResolvedValue({ data: { id: ID, about: "A shop" }, error: null });
  protectRate.mockResolvedValue(true);
  answerForOwner.mockResolvedValue({ kind: "question", reply: "Yes", understoodAs: "q", chunks: [], followUps: [], ms: { understand: 1, search: 1, answer: 1 } });
});

describe("POST /api/projects/:id/test", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await call({ message: "hi" })).status).toBe(401);
    expect(answerForOwner).not.toHaveBeenCalled();
  });
  it("rejects a bad id and an empty or oversize message", async () => {
    expect((await call({ message: "hi" }, "nope")).status).toBe(404);
    expect((await call({ message: "  " })).status).toBe(400);
    expect((await call({ message: "a".repeat(1001) })).status).toBe(400);
  });
  it("returns 404 for a project the caller does not own, without calling the AI", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await call({ message: "hi" })).status).toBe(404);
    expect(answerForOwner).not.toHaveBeenCalled();
  });
  it("limits how often one owner can test", async () => {
    protectRate.mockResolvedValue(false);
    expect((await call({ message: "hi" })).status).toBe(429);
    expect(protectRate).toHaveBeenCalledWith(expect.anything(), "user_1", "test", 10);
    expect(answerForOwner).not.toHaveBeenCalled();
  });
  it("returns the answer for the owner's own project", async () => {
    const res = await call({ message: "Do you ship?" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ kind: "question", reply: "Yes" });
    expect(answerForOwner).toHaveBeenCalledWith({ id: ID, about: "A shop" }, "Do you ship?");
  });
  it("hides an AI failure behind a generic message", async () => {
    answerForOwner.mockRejectedValue(new Error("model down"));
    const res = await call({ message: "hi" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("model down");
  });
});
