import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const protectChat = vi.fn();
vi.mock("@/lib/protect", () => ({ protectChat: (...a: unknown[]) => protectChat(...a) }));
const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (...a: unknown[]) => getAccountPlan(...a) }));
const embedTexts = vi.fn();
const generateAnswer = vi.fn();
vi.mock("@/lib/ai/errors", () => {
  class AiUnavailableError extends Error {}
  return { AiUnavailableError };
});
vi.mock("@/lib/ai/ollama", () => ({ embedTexts: (...a: unknown[]) => embedTexts(...a) }));
vi.mock("@/lib/ai/groq", () => ({ generateAnswer: (...a: unknown[]) => generateAnswer(...a) }));
const understandMessage = vi.fn();
vi.mock("@/lib/ai/understand", () => ({ understandMessage: (...a: unknown[]) => understandMessage(...a) }));
const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from, rpc }) }));

import { AiUnavailableError } from "@/lib/ai/errors";
import { HUMAN_QUERY, NO_ANSWER, OFF_TOPIC_REPLY, SMALLTALK_REPLIES } from "@/lib/chat";
import { OPTIONS, POST } from "./route";

const KEY = "pk_abcdefgh12345678";
const PROJECT = "0b1c2d3e-0000-4000-8000-000000000001";
const CONVO = "0b1c2d3e-0000-4000-8000-0000000000cc";
const body = { key: KEY, visitorId: "visitor-12345678", message: "How long do refunds take?" };
const call = (b: unknown) => POST(new Request("http://x/api/widget/chat", { method: "POST", body: JSON.stringify(b) }));

type Tables = Record<string, { data: unknown }>;
function tables(t: Tables = {}) {
  const defaults: Tables = { projects: { data: { id: PROJECT, owner_id: "user_1", about: "A travel advisor." } },
    conversations: { data: { id: CONVO } },
    messages: { data: [{ role: "bot", body: "Hi" }, { role: "visitor", body: "Hello" }] },
  };
  const merged = { ...defaults, ...t };
  from.mockImplementation((name: string) => queryResult(merged[name] ?? { data: null }));
}

function rpcs(overrides: Record<string, unknown> = {}) {
  const results: Record<string, unknown> = {
    consume_message: { data: true, error: null },
    match_chunks_hybrid: { data: [{ id: "c", source_id: "s", content: "Refunds take 5 days.", similarity: 0.8 }], error: null },
    save_chat_turn: { data: CONVO, error: null },
    ...overrides,
  };
  rpc.mockImplementation(async (name: string) => results[name]);
}

beforeEach(() => {
  vi.clearAllMocks();
  protectChat.mockResolvedValue({ ok: true });
  getAccountPlan.mockResolvedValue("free");
  embedTexts.mockResolvedValue(["[0.1,0.2]"]);
  generateAnswer.mockResolvedValue("Refunds take 5 days.");
  understandMessage.mockResolvedValue({ type: "question", standalone: "How long do refunds take?" });
  tables();
  rpcs();
});

describe("POST /api/widget/chat", () => {
  it("answers from the retrieved chunks, saves the turn and returns the conversation ID", async () => {
    const res = await call(body);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({ conversationId: CONVO, reply: "Refunds take 5 days." });
    expect(rpc).toHaveBeenCalledWith("match_chunks_hybrid", {
      p_project_id: PROJECT,
      p_query_embedding: "[0.1,0.2]",
      p_query_text: "long or refunds or take",
      p_match_count: 8,
    });
    expect(rpc).toHaveBeenCalledWith("save_chat_turn", expect.objectContaining({ p_project_id: PROJECT, p_conversation_id: null, p_bot_reply: "Refunds take 5 days." }));
    expect(generateAnswer.mock.calls[0]![1]).toContain("Refunds take 5 days.");
  });

  it("answers 'I don't know' without calling the chat model when nothing is relevant", async () => {
    rpcs({ match_chunks_hybrid: { data: [{ id: "c", source_id: "s", content: "x", similarity: 0.3 }], error: null } });
    const res = await call(body);
    expect((await res.json()).reply).toBe(NO_ANSWER);
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it("rejects bad input with 400 before doing anything", async () => {
    for (const bad of [{}, { ...body, message: "" }, { ...body, message: "x".repeat(1001) }, { ...body, key: "nope" }]) {
      expect((await call(bad)).status).toBe(400);
    }
    expect(protectChat).not.toHaveBeenCalled();
  });

  it("refuses the 21st message in a minute (rate limited) and counts nothing", async () => {
    protectChat.mockResolvedValue({ ok: false, reason: "rate_limit" });
    const res = await call(body);
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("rate_limited");
    expect(rpc).not.toHaveBeenCalled();
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("blocks a prompt injection before any AI call", async () => {
    protectChat.mockResolvedValue({ ok: false, reason: "injection" });
    const res = await call(body);
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("message_blocked");
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown key", async () => {
    tables({ projects: { data: null } });
    expect((await call(body)).status).toBe(404);
  });

  it("returns 404 and counts nothing for a conversation in another project", async () => {
    tables({ conversations: { data: null } });
    const res = await call({ ...body, conversationId: CONVO });
    expect(res.status).toBe(404);
    expect(rpc).not.toHaveBeenCalledWith("consume_message", expect.anything());
  });

  it("returns the quota message and makes no AI call at the monthly limit", async () => {
    rpcs({ consume_message: { data: false, error: null } });
    const res = await call(body);
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("quota_exceeded");
    expect(embedTexts).not.toHaveBeenCalled();
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it("passes the plan's monthly limit from the server", async () => {
    getAccountPlan.mockResolvedValue("pro");
    await call(body);
    expect(rpc).toHaveBeenCalledWith("consume_message", { p_project_id: PROJECT, p_monthly_limit: 2000 });
  });

  it("keeps the counted message but shows a friendly error when the model is down", async () => {
    embedTexts.mockRejectedValue(new AiUnavailableError("down"));
    const res = await call(body);
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toMatch(/unavailable/);
    expect(rpc).toHaveBeenCalledWith("consume_message", expect.anything());
    expect(rpc).not.toHaveBeenCalledWith("save_chat_turn", expect.anything());
  });

  it("continues an existing conversation", async () => {
    await call({ ...body, conversationId: CONVO });
    expect(rpc).toHaveBeenCalledWith("save_chat_turn", expect.objectContaining({ p_conversation_id: CONVO }));
  });
});

describe("POST /api/widget/chat: understanding the message", () => {
  it("answers small talk with a fixed reply, without searching or calling the answer model", async () => {
    understandMessage.mockResolvedValue({ type: "smalltalk", smalltalk: "thanks" });
    const res = await call({ ...body, message: "thanks!" });
    expect((await res.json()).reply).toBe(SMALLTALK_REPLIES.thanks);
    expect(embedTexts).not.toHaveBeenCalled();
    expect(generateAnswer).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("save_chat_turn", expect.objectContaining({ p_bot_reply: SMALLTALK_REPLIES.thanks }));
  });

  it("politely declines an off-topic question, without searching", async () => {
    understandMessage.mockResolvedValue({ type: "off_topic" });
    const res = await call({ ...body, message: "who won the world cup?" });
    expect((await res.json()).reply).toBe(OFF_TOPIC_REPLY);
    expect(embedTexts).not.toHaveBeenCalled();
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it("still counts the message when it only needed small talk or a decline", async () => {
    understandMessage.mockResolvedValue({ type: "off_topic" });
    await call(body);
    expect(rpc).toHaveBeenCalledWith("consume_message", expect.anything());
  });

  it("searches with the rewritten question and tells the model both versions", async () => {
    understandMessage.mockResolvedValue({ type: "question", standalone: "What is the best time to visit Japan?" });
    await call({ ...body, message: "and Japan?", conversationId: CONVO });
    expect(embedTexts).toHaveBeenCalledWith(["What is the best time to visit Japan?"], "query");
    const prompt = generateAnswer.mock.calls[0]![1] as string;
    expect(prompt).toContain("Visitor message: and Japan?");
    expect(prompt).toContain("Understood as: What is the best time to visit Japan?");
  });

  it("looks up contact details when the visitor wants a person", async () => {
    understandMessage.mockResolvedValue({ type: "human", standalone: "talk to someone" });
    await call({ ...body, message: "can I talk to someone?" });
    expect(embedTexts).toHaveBeenCalledWith([HUMAN_QUERY], "query");
  });

  it("gives the owner's business description to both steps and loads recent history", async () => {
    await call({ ...body, conversationId: CONVO });
    expect(understandMessage).toHaveBeenCalledWith(
      "A travel advisor.",
      [{ role: "bot", body: "Hi" }, { role: "visitor", body: "Hello" }].reverse(),
      body.message,
    );
    expect(generateAnswer.mock.calls[0]![0]).toContain("A travel advisor.");
  });

  it("starts with no history on the first message of a conversation", async () => {
    await call(body);
    expect(understandMessage.mock.calls[0]![1]).toEqual([]);
  });

  it("says it has no information when nothing in the knowledge is related", async () => {
    rpcs({ match_chunks_hybrid: { data: [{ id: "c", source_id: "s", content: "x", similarity: 0.1 }], error: null } });
    const res = await call(body);
    expect((await res.json()).reply).toBe(NO_ANSWER);
    expect(generateAnswer).not.toHaveBeenCalled();
  });
});

describe("OPTIONS /api/widget/chat", () => {
  it("answers the CORS preflight for any origin", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
