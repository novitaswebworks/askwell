import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const embedTexts = vi.fn();
vi.mock("@/lib/ai/ollama", () => ({ embedTexts: (...a: unknown[]) => embedTexts(...a) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));

import { processSource } from "./process";

function fakeClient(insertError: { message: string } | null = null) {
  const calls: { table: string; op: string; arg?: unknown }[] = [];
  const from = (table: string) => ({
    insert: (arg: unknown) => {
      calls.push({ table, op: "insert", arg });
      return Promise.resolve({ error: insertError });
    },
    update: (arg: unknown) => {
      calls.push({ table, op: "update", arg });
      return { eq: () => Promise.resolve({ error: null }) };
    },
    delete: () => {
      calls.push({ table, op: "delete" });
      return { eq: () => Promise.resolve({ error: null }) };
    },
  });
  return { client: { from } as never, calls };
}

const source = { id: "s1", projectId: "p1" };

beforeEach(() => vi.clearAllMocks());

describe("processSource", () => {
  it("stores one row per chunk and marks the source ready", async () => {
    embedTexts.mockImplementation(async (texts: string[]) => texts.map(() => "[0,1]"));
    const { client, calls } = fakeClient();
    await processSource(source, "Refunds take 5 days.", client);
    const insert = calls.find((c) => c.op === "insert");
    expect(insert?.table).toBe("knowledge_chunks");
    expect(insert?.arg).toEqual([
      { project_id: "p1", source_id: "s1", content: "Refunds take 5 days.", embedding: "[0,1]" },
    ]);
    expect(calls.at(-1)).toEqual({ table: "knowledge_sources", op: "update", arg: { status: "ready" } });
  });

  it("marks the source failed and removes chunks when embedding fails", async () => {
    embedTexts.mockRejectedValue(new Error("down"));
    const { client, calls } = fakeClient();
    await expect(processSource(source, "Some text", client)).rejects.toThrow("down");
    expect(calls).toContainEqual({ table: "knowledge_chunks", op: "delete" });
    expect(calls.at(-1)).toEqual({ table: "knowledge_sources", op: "update", arg: { status: "failed" } });
  });

  it("rejects text with nothing readable, without calling the AI", async () => {
    const { client, calls } = fakeClient();
    await expect(processSource(source, "   \n  ", client)).rejects.toMatchObject({ name: "EmptySourceError" });
    expect(embedTexts).not.toHaveBeenCalled();
    expect(calls.at(-1)).toEqual({ table: "knowledge_sources", op: "update", arg: { status: "failed" } });
  });

  it("fails when the database refuses the chunks", async () => {
    embedTexts.mockResolvedValue(["[0]"]);
    const { client, calls } = fakeClient({ message: "nope" });
    await expect(processSource(source, "Text", client)).rejects.toThrow("Could not store chunks");
    expect(calls.at(-1)).toEqual({ table: "knowledge_sources", op: "update", arg: { status: "failed" } });
  });
});
