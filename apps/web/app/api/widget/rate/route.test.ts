import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...a: unknown[]) => track(...a) }));
const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from, rpc }) }));

import { OPTIONS, POST } from "./route";

const KEY = "pk_abcdefgh12345678";
const CONVO = "550e8400-e29b-41d4-a716-446655440000";
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/widget/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation(() => queryResult({ data: { id: "p1" } }));
  rpc.mockResolvedValue({ data: true, error: null });
});

describe("POST /api/widget/rate", () => {
  it("answers the preflight and allows any origin", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
  it("rates the latest answer of this project's conversation", async () => {
    const res = await post({ key: KEY, conversationId: CONVO, rating: -1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rating: -1 });
    expect(rpc).toHaveBeenCalledWith("rate_last_reply", { p_project_id: "p1", p_conversation_id: CONVO, p_rating: -1 });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ event: "answer_rated" }));
  });
  it("lets a visitor take a rating back", async () => {
    const res = await post({ key: KEY, conversationId: CONVO, rating: 0 });
    expect(await res.json()).toEqual({ rating: null });
    expect(track).not.toHaveBeenCalled();
  });
  it("rejects anything but 1, -1 and 0, and bad IDs", async () => {
    for (const body of [
      { key: KEY, conversationId: CONVO, rating: 5 },
      { key: KEY, conversationId: CONVO, rating: "up" },
      { key: KEY, conversationId: "not-a-uuid", rating: 1 },
      { key: "nope", conversationId: CONVO, rating: 1 },
      {},
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it("404s for an unknown key", async () => {
    from.mockImplementation(() => queryResult({ data: null }));
    expect((await post({ key: KEY, conversationId: CONVO, rating: 1 })).status).toBe(404);
  });
  it("404s when the conversation is not this project's or has no answer", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await post({ key: KEY, conversationId: CONVO, rating: 1 })).status).toBe(404);
  });
  it("reports a database failure without leaking it", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await post({ key: KEY, conversationId: CONVO, rating: 1 });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});
