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
