import { describe, expect, it } from "vitest";
import { getThread, listConversations, preview, summarize, toMessage } from "./conversations";
import { queryResult } from "./test-utils";

const conv = (id: string, at: string) => ({ id, project_id: "p1", created_at: at });
const msg = (id: string, c: string, role: string, body: string, at = "2026-11-01T00:00:00Z") => ({
  id,
  conversation_id: c,
  role,
  body,
  created_at: at,
});

describe("preview", () => {
  it("flattens whitespace and cuts long text with an ellipsis", () => {
    expect(preview("  Hello\n\n  there  ")).toBe("Hello there");
    const long = preview("word ".repeat(100));
    expect(long.length).toBeLessThanOrEqual(140);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("summarize", () => {
  it("gives the first visitor message and the message count of each conversation, keeping order", () => {
    const out = summarize(
      [conv("b", "2026-11-02"), conv("a", "2026-11-01")],
      [msg("1", "a", "visitor", "Which destinations?"), msg("2", "a", "bot", "Many."), msg("3", "b", "visitor", "Hi"), msg("4", "b", "bot", "Hello"), msg("5", "b", "visitor", "Bye")],
    );
    expect(out).toEqual([
      { id: "b", firstMessage: "Hi", messageCount: 3, helpful: 0, notHelpful: 0, createdAt: "2026-11-02" },
      { id: "a", firstMessage: "Which destinations?", messageCount: 2, helpful: 0, notHelpful: 0, createdAt: "2026-11-01" },
    ]);
  });
  it("copes with a conversation that has no messages", () => {
    expect(summarize([conv("a", "x")], [])).toEqual([{ id: "a", firstMessage: "", messageCount: 0, helpful: 0, notHelpful: 0, createdAt: "x" }]);
  });
});

describe("toMessage", () => {
  it("maps rows and treats anything but bot as the visitor", () => {
    expect(toMessage(msg("1", "a", "bot", "Hi"))).toEqual({ id: "1", role: "bot", body: "Hi", rating: null, createdAt: "2026-11-01T00:00:00Z" });
    expect(toMessage(msg("2", "a", "weird", "x")).role).toBe("visitor");
  });
});

describe("listConversations", () => {
  it("returns summaries, newest first as the database ordered them", async () => {
    const client = {
      from: (table: string) =>
        queryResult(
          table === "conversations"
            ? { data: [conv("a", "2026-11-01")] }
            : { data: [msg("1", "a", "visitor", "Hello"), msg("2", "a", "bot", "Hi")] },
        ),
    };
    expect(await listConversations(client, "p1")).toEqual([
      { id: "a", firstMessage: "Hello", messageCount: 2, helpful: 0, notHelpful: 0, createdAt: "2026-11-01" },
    ]);
  });
  it("returns an empty list without asking for messages", async () => {
    const tables: string[] = [];
    const client = { from: (t: string) => (tables.push(t), queryResult({ data: [] })) };
    expect(await listConversations(client, "p1")).toEqual([]);
    expect(tables).toEqual(["conversations"]);
  });
  it("throws a clear error when the database fails", async () => {
    const client = { from: () => queryResult({ data: null, error: { message: "boom" } }) };
    await expect(listConversations(client, "p1")).rejects.toThrow("Could not load conversations: boom");
  });
});

describe("getThread", () => {
  it("returns the conversation with all messages in order", async () => {
    const client = {
      from: (table: string) =>
        queryResult(
          table === "conversations"
            ? { data: conv("a", "2026-11-01") }
            : { data: [msg("1", "a", "visitor", "Hello"), msg("2", "a", "bot", "Hi")] },
        ),
    };
    const thread = await getThread(client, "a");
    expect(thread).toMatchObject({ id: "a", projectId: "p1", createdAt: "2026-11-01" });
    expect(thread?.messages.map((m) => m.role)).toEqual(["visitor", "bot"]);
  });
  it("returns null when it is not found or not the caller's", async () => {
    const client = { from: () => queryResult({ data: null }) };
    expect(await getThread(client, "a")).toBeNull();
  });
});

describe("ratings", () => {
  it("counts helpful and not-helpful answers per conversation", () => {
    const rows = [
      { ...msg("1", "a", "visitor", "Hi"), rating: null },
      { ...msg("2", "a", "bot", "Hello"), rating: 1 },
      { ...msg("3", "a", "bot", "More"), rating: -1 },
      { ...msg("4", "a", "bot", "Again"), rating: -1 },
    ];
    expect(summarize([conv("a", "x")], rows)[0]).toMatchObject({ helpful: 1, notHelpful: 2 });
  });
  it("only accepts 1 and -1 as a rating", () => {
    expect(toMessage({ ...msg("1", "a", "bot", "Hi"), rating: 1 }).rating).toBe(1);
    expect(toMessage({ ...msg("1", "a", "bot", "Hi"), rating: -1 }).rating).toBe(-1);
    expect(toMessage({ ...msg("1", "a", "bot", "Hi"), rating: 7 }).rating).toBeNull();
    expect(toMessage(msg("1", "a", "bot", "Hi")).rating).toBeNull();
  });
});

describe("search and filter", () => {
  // A client that records what was asked of each table and answers from fixtures.
  function fake(fixtures: Record<string, unknown[]>) {
    const calls: { table: string; ops: [string, ...unknown[]][] }[] = [];
    const client = {
      from(table: string) {
        const call = { table, ops: [] as [string, ...unknown[]][] };
        calls.push(call);
        const builder: unknown = new Proxy(
          {},
          {
            get: (_t, prop: string) =>
              prop === "then"
                ? (resolve: (v: unknown) => unknown) => resolve({ data: fixtures[table] ?? [], error: null })
                : (...args: unknown[]) => {
                    call.ops.push([prop, ...args]);
                    return builder;
                  },
          },
        );
        return builder;
      },
    };
    return { client, calls };
  }

  it("escapes % and _ so they are searched literally", async () => {
    const { likePattern } = await import("./conversations");
    expect(likePattern("50% off_x")).toBe("%50\\% off\\_x%");
    expect(likePattern("  a  ")).toBe("%a%");
    expect(likePattern("x".repeat(500)).length).toBe(102);
  });
  it("searches message text inside the project, then loads only the matching conversations", async () => {
    const { client, calls } = fake({
      messages: [msg("1", "a", "visitor", "refund?"), msg("2", "a", "bot", "yes"), msg("3", "b", "visitor", "refund")],
      conversations: [conv("a", "2026-11-01")],
    });
    await listConversations(client, "p1", 50, { q: "refund" });
    const search = calls[0];
    expect(search.table).toBe("messages");
    expect(search.ops).toContainEqual(["ilike", "body", "%refund%"]);
    expect(search.ops).toContainEqual(["eq", "conversations.project_id", "p1"]);
    const list = calls[1];
    expect(list.ops).toContainEqual(["in", "id", ["a", "b"]]);
  });
  it("filters to thumbs-down chats", async () => {
    const { client, calls } = fake({ messages: [msg("1", "a", "bot", "no")], conversations: [conv("a", "2026-11-01")] });
    await listConversations(client, "p1", 50, { unhelpful: true });
    expect(calls[0].ops).toContainEqual(["eq", "rating", -1]);
  });
  it("returns nothing, without loading conversations, when nothing matches", async () => {
    const { client, calls } = fake({ messages: [] });
    expect(await listConversations(client, "p1", 50, { q: "zzz" })).toEqual([]);
    expect(calls.map((c) => c.table)).toEqual(["messages"]);
  });
  it("does not search at all without a filter", async () => {
    const { client, calls } = fake({ conversations: [] });
    await listConversations(client, "p1");
    expect(calls.map((c) => c.table)).toEqual(["conversations"]);
  });
});

describe("search combined with the thumbs-down filter", () => {
  // Answers each query on `messages` from a list, in the order they are asked.
  function sequenced(messageAnswers: unknown[][], conversations: unknown[]) {
    const calls: { table: string; ops: [string, ...unknown[]][] }[] = [];
    let message = 0;
    const client = {
      from(table: string) {
        const call = { table, ops: [] as [string, ...unknown[]][] };
        calls.push(call);
        const data = table === "messages" ? (messageAnswers[message++] ?? []) : conversations;
        const builder: unknown = new Proxy(
          {},
          {
            get: (_t, prop: string) =>
              prop === "then"
                ? (resolve: (v: unknown) => unknown) => resolve({ data, error: null })
                : (...args: unknown[]) => {
                    call.ops.push([prop, ...args]);
                    return builder;
                  },
          },
        );
        return builder;
      },
    };
    return { client, calls };
  }

  it("keeps a chat when the words and the thumbs-down are on different messages, and drops one that only has one of them", async () => {
    const { client, calls } = sequenced(
      [[{ conversation_id: "a" }, { conversation_id: "b" }], [{ conversation_id: "b" }, { conversation_id: "c" }]],
      [],
    );
    await listConversations(client, "p1", 50, { q: "refund", unhelpful: true });
    expect(calls[0].ops).toContainEqual(["ilike", "body", "%refund%"]);
    expect(calls[1].ops).toContainEqual(["eq", "rating", -1]);
    // Only "b" has both. The text search and the rating are separate queries, so they need not be the same message.
    expect(calls[2].ops).toContainEqual(["in", "id", ["b"]]);
  });
  it("lets an export match up to its own cap, not the smaller list cap", async () => {
    const { exportRows, MAX_EXPORT_CONVERSATIONS } = await import("./conversations");
    const { client, calls } = sequenced([[{ conversation_id: "a" }]], []);
    await exportRows(client, "p1", { q: "refund" });
    expect(calls[0].ops).toContainEqual(["limit", MAX_EXPORT_CONVERSATIONS * 5]);
    const list = sequenced([[{ conversation_id: "a" }]], []);
    await listConversations(list.client, "p1", 50, { q: "refund" });
    expect(list.calls[0].ops).toContainEqual(["limit", 200 * 5]);
  });
});

describe("exportRows", () => {
  it("lists every message with its conversation, who wrote it and the rating", async () => {
    const { exportRows } = await import("./conversations");
    const client = {
      from: (table: string) =>
        queryResult(
          table === "conversations"
            ? { data: [conv("a", "2026-11-02"), conv("b", "2026-11-01")] }
            : {
                data: [
                  { ...msg("1", "b", "visitor", "Old question", "2026-11-01T00:00:00Z"), rating: null },
                  { ...msg("2", "a", "visitor", "Hi", "2026-11-02T00:00:00Z"), rating: null },
                  { ...msg("3", "a", "bot", "Hello", "2026-11-02T00:00:01Z"), rating: -1 },
                ],
              },
        ),
    };
    const rows = await exportRows(client, "p1");
    expect(rows.map((r) => `${r.conversationId}:${r.role}:${r.message}:${r.rating}`)).toEqual([
      "a:visitor:Hi:",
      "a:assistant:Hello:not helpful",
      "b:visitor:Old question:",
    ]);
  });
});
