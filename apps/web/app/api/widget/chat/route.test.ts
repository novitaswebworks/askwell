import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const protectChat = vi.fn();
vi.mock("@/lib/protect", () => ({ protectChat: (...a: unknown[]) => protectChat(...a) }));
const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (...a: unknown[]) => getAccountPlan(...a) }));
const embedTexts = vi.fn();
const generateAnswer = vi.fn();
const streamAnswer = vi.fn();
vi.mock("@/lib/ai/errors", () => {
  class AiUnavailableError extends Error {}
  return { AiUnavailableError };
});
vi.mock("@/lib/ai/ollama", () => ({ embedTexts: (...a: unknown[]) => embedTexts(...a) }));
vi.mock("@/lib/ai/groq", () => ({
  generateAnswer: (...a: unknown[]) => generateAnswer(...a),
  streamAnswer: (...a: unknown[]) => streamAnswer(...a),
}));
const track = vi.fn();
const trackGeneration = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...a: unknown[]) => track(...a), trackGeneration: (...a: unknown[]) => trackGeneration(...a) }));
const understandMessage = vi.fn();
vi.mock("@/lib/ai/understand", () => ({ understandMessage: (...a: unknown[]) => understandMessage(...a) }));
const notifyOwnerOfQuota = vi.fn();
vi.mock("@/lib/email/notify", () => ({ notifyOwnerOfQuota: (...a: unknown[]) => notifyOwnerOfQuota(...a) }));
vi.mock("@/lib/after", () => ({ runAfterResponse: (work: () => Promise<unknown>) => void work().catch(() => {}) }));
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
  const defaults: Tables = { projects: { data: { id: PROJECT, name: "Shop", owner_id: "user_1", about: "A travel advisor.", messages_used: 3, period_start: new Date().toISOString().slice(0, 10) } },
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
    claim_quota_warning: { data: true, error: null },
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

  it("returns source attribution and follow-up chips when available", async () => {
    tables({
      knowledge_sources: { data: [{ title: "Refund policy" }] },
    });
    generateAnswer.mockResolvedValue(
      "Refunds take 5 days.\n\nFollow-up: How do I initiate a return?\nFollow-up: Who pays shipping?",
    );
    const res = await call(body);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("Refunds take 5 days.");
    expect(data.sources).toEqual(["Refund policy"]);
    expect(data.followUps).toEqual(["How do I initiate a return?", "Who pays shipping?"]);
  });

  it("provides graceful NO_ANSWER when nothing is relevant", async () => {
    rpcs({ match_chunks_hybrid: { data: [], error: null } });
    const res = await call(body);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe(NO_ANSWER);
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
      expect.any(Function),
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

describe("POST /api/widget/chat: analytics", () => {
  it("records a widget_message with counts and kinds only, never the text", async () => {
    await call(body);
    expect(track).toHaveBeenCalledWith({
      distinctId: body.visitorId,
      event: "widget_message",
      anonymous: true,
      properties: { project_id: PROJECT, plan: "free", kind: "question", answered: true, is_new_conversation: true },
    });
    expect(JSON.stringify(track.mock.calls)).not.toContain(body.message);
  });

  it("marks off-topic and small talk as not answered from the knowledge", async () => {
    understandMessage.mockResolvedValue({ type: "off_topic" });
    await call(body);
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ event: "widget_message", properties: expect.objectContaining({ kind: "off_topic", answered: false }) }),
    );
  });

  it("traces each model call with the project, without any message text", async () => {
    understandMessage.mockImplementation(async (_a: string, _h: unknown, _m: string, onGeneration: (g: unknown) => void) => {
      onGeneration({ model: "openai/gpt-oss-20b", inputTokens: 100, outputTokens: 20, latencyMs: 400 });
      return { type: "question", standalone: "How long do refunds take?" };
    });
    await call(body);
    expect(trackGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openai/gpt-oss-20b", projectId: PROJECT, spanName: "understand_message", distinctId: body.visitorId }),
    );
    expect(JSON.stringify(trackGeneration.mock.calls)).not.toContain(body.message);
  });

  it("records a blocked message with the reason", async () => {
    protectChat.mockResolvedValue({ ok: false, reason: "rate_limit" });
    await call(body);
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ event: "message_blocked", properties: { reason: "rate_limit", public_key: KEY } }),
    );
  });

  it("records when a project runs out of messages", async () => {
    rpcs({ consume_message: { data: false, error: null } });
    await call(body);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ event: "quota_exceeded" }));
  });
});

describe("OPTIONS /api/widget/chat", () => {
  it("answers the CORS preflight for any origin", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  describe("quota warning emails", () => {
    beforeEach(() => notifyOwnerOfQuota.mockReset());
    const nearLimit = (used: number) => tables({ projects: { data: { id: PROJECT, name: "Shop", owner_id: "user_1", about: "x", messages_used: used, period_start: new Date().toISOString().slice(0, 10) } } });
    it("sends nothing on an ordinary message and asks the database nothing extra", async () => {
      await call(body);
      expect(rpc).not.toHaveBeenCalledWith("claim_quota_warning", expect.anything());
      expect(notifyOwnerOfQuota).not.toHaveBeenCalled();
    });
    it("emails the owner once when this message takes the project to 80% (Free: 100 messages)", async () => {
      nearLimit(79);
      await call(body);
      await vi.waitFor(() => expect(notifyOwnerOfQuota).toHaveBeenCalledTimes(1));
      expect(rpc).toHaveBeenCalledWith("claim_quota_warning", { p_project_id: PROJECT, p_level: 80 });
      expect(notifyOwnerOfQuota).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "user_1", projectName: "Shop", level: 80, limit: 100, plan: "free" }));
    });
    it("does not email when the warning was already claimed", async () => {
      nearLimit(79);
      rpcs({ claim_quota_warning: { data: false, error: null } });
      await call(body);
      await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith("claim_quota_warning", expect.anything()));
      expect(notifyOwnerOfQuota).not.toHaveBeenCalled();
    });
    it("sends the limit-reached email on the last message", async () => {
      nearLimit(99);
      await call(body);
      await vi.waitFor(() => expect(notifyOwnerOfQuota).toHaveBeenCalledWith(expect.objectContaining({ level: 100 })));
    });
    it("still answers when the email cannot be sent", async () => {
      nearLimit(79);
      notifyOwnerOfQuota.mockResolvedValue(false); // what sendEmail returns when mail is down
      const res = await call(body);
      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(notifyOwnerOfQuota).toHaveBeenCalled());
    });
  });
});


describe("POST /api/widget/chat as a stream", () => {
  const callStream = (b: unknown) =>
    POST(new Request("http://x/api/widget/chat", { method: "POST", body: JSON.stringify(b), headers: { accept: "application/x-ndjson" } }));
  const chunks = (parts: string[]) =>
    streamAnswer.mockImplementation(async function* () {
      for (const p of parts) yield p;
    });
  const events = async (res: Response) =>
    (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as { t: string; text?: string; data?: { reply: string; followUps?: string[]; conversationId: string }; message?: string });

  it("streams the reply, keeps the follow-ups out of it, and ends with the saved reply", async () => {
    chunks(["Refunds take ", "5 days.\nFollow-up: ", "Is it free?"]);
    const res = await callStream(body);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson");
    const got = await events(res);
    expect(got.filter((e) => e.t === "delta").map((e) => e.text).join("")).toBe("Refunds take 5 days.");
    const done = got.at(-1)!;
    expect(done).toMatchObject({ t: "done", data: { conversationId: CONVO, reply: "Refunds take 5 days.", followUps: ["Is it free?"] } });
    expect(generateAnswer).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("save_chat_turn", expect.objectContaining({ p_bot_reply: "Refunds take 5 days." }));
  });

  it("replaces a streamed refusal with the standard no-answer wording", async () => {
    chunks(["Sorry, I do not know. " + NO_ANSWER]);
    const done = (await events(await callStream(body))).at(-1)!;
    expect(done.data?.reply).toBe(NO_ANSWER);
  });

  it("still answers whole messages that need no model, as plain JSON", async () => {
    understandMessage.mockResolvedValue({ type: "off_topic" });
    const res = await callStream(body);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect((await res.json()).reply).toBe(OFF_TOPIC_REPLY);
    expect(streamAnswer).not.toHaveBeenCalled();
  });

  it("returns a normal error when the model fails before its first word", async () => {
    streamAnswer.mockImplementation(async function* () {
      throw new AiUnavailableError("down");
    });
    const res = await callStream(body);
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("ends with an error event when saving the turn fails", async () => {
    chunks(["Hi there."]);
    rpcs({ save_chat_turn: { data: null, error: { message: "db" } } });
    expect((await events(await callStream(body))).at(-1)!.t).toBe("error");
  });
});
