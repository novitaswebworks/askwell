import { describe, expect, it } from "vitest";
import { CHAT_TTL_MS, MAX_SAVED_LINES, chatStorageKey, clearChat, loadChat, saveChat } from "./embed-storage";

const KEY = "pk_abcdefgh12345678";
const ID = "0b1c2d3e-0000-4000-8000-000000000001";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe("saved chat", () => {
  it("round-trips a conversation", () => {
    const store = memory();
    const lines = [
      { role: "visitor" as const, body: "Hi" },
      { role: "bot" as const, body: "Hello", sources: ["FAQ"], followUps: ["More?"], rateable: true, rating: -1 as const },
    ];
    saveChat(store, KEY, { conversationId: ID, lines }, 1000);
    expect(loadChat(store, KEY, 2000)).toEqual({ conversationId: ID, lines });
  });
  it("keeps each project's chat apart", () => {
    const store = memory();
    saveChat(store, KEY, { conversationId: ID, lines: [{ role: "visitor", body: "Hi" }] }, 1);
    expect(loadChat(store, "pk_otherotherother1", 2)).toBeNull();
  });
  it("forgets a chat after a day", () => {
    const store = memory();
    saveChat(store, KEY, { conversationId: ID, lines: [{ role: "visitor", body: "Hi" }] }, 0);
    expect(loadChat(store, KEY, CHAT_TTL_MS)).not.toBeNull();
    expect(loadChat(store, KEY, CHAT_TTL_MS + 1)).toBeNull();
  });
  it("keeps only the latest lines", () => {
    const store = memory();
    const lines = Array.from({ length: MAX_SAVED_LINES + 5 }, (_, i) => ({ role: "visitor" as const, body: `m${i}` }));
    saveChat(store, KEY, { conversationId: ID, lines }, 1);
    const loaded = loadChat(store, KEY, 2);
    expect(loaded?.lines).toHaveLength(MAX_SAVED_LINES);
    expect(loaded?.lines.at(-1)?.body).toBe(`m${MAX_SAVED_LINES + 4}`);
  });
  it("ignores damaged or tampered data", () => {
    const store = memory();
    for (const raw of [
      "not json",
      "null",
      JSON.stringify({ conversationId: "nope", savedAt: 1, lines: [{ role: "bot", body: "x" }] }),
      JSON.stringify({ conversationId: ID, savedAt: "1", lines: [{ role: "bot", body: "x" }] }),
      JSON.stringify({ conversationId: ID, savedAt: 1, lines: [{ role: "admin", body: "x" }, 5, null] }),
      JSON.stringify({ conversationId: ID, savedAt: 1, lines: "x" }),
    ]) {
      store.setItem(chatStorageKey(KEY), raw);
      expect(loadChat(store, KEY, 2)).toBeNull();
    }
  });
  it("clears, and survives missing or failing storage", () => {
    const store = memory();
    saveChat(store, KEY, { conversationId: ID, lines: [{ role: "visitor", body: "Hi" }] }, 1);
    clearChat(store, KEY);
    expect(loadChat(store, KEY, 2)).toBeNull();
    expect(loadChat(null, KEY, 2)).toBeNull();
    expect(() => saveChat(null, KEY, { conversationId: ID, lines: [] }, 1)).not.toThrow();
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("full"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(loadChat(broken, KEY, 2)).toBeNull();
    expect(() => saveChat(broken, KEY, { conversationId: ID, lines: [{ role: "bot", body: "x" }] }, 1)).not.toThrow();
    expect(() => clearChat(broken, KEY)).not.toThrow();
  });
});
