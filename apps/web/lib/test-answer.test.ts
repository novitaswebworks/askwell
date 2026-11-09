import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_ANSWER, OFF_TOPIC_REPLY } from "@/lib/chat";

vi.mock("server-only", () => ({}));
const understandMessage = vi.fn();
vi.mock("@/lib/ai/understand", () => ({ understandMessage: (...a: unknown[]) => understandMessage(...a) }));
const generateAnswer = vi.fn();
vi.mock("@/lib/ai/groq", () => ({ generateAnswer: (...a: unknown[]) => generateAnswer(...a) }));
const embedTexts = vi.fn();
vi.mock("@/lib/ai/ollama", () => ({ embedTexts: (...a: unknown[]) => embedTexts(...a) }));
const rpc = vi.fn();
const sourcesIn = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ rpc, from: () => ({ select: () => ({ in: sourcesIn }) }) }),
}));

import { answerForOwner } from "./test-answer";

const project = { id: "p1", about: "A shop" };

beforeEach(() => {
  vi.clearAllMocks();
  embedTexts.mockResolvedValue([[0.1]]);
  sourcesIn.mockResolvedValue({ data: [{ id: "s1", title: "Shipping" }] });
});

describe("answerForOwner", () => {
  it("answers off-topic messages without searching", async () => {
    understandMessage.mockResolvedValue({ type: "off_topic" });
    const r = await answerForOwner(project, "Who won?");
    expect(r).toMatchObject({ kind: "off_topic", reply: OFF_TOPIC_REPLY, chunks: [] });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("shows every match but marks weak ones as not used", async () => {
    understandMessage.mockResolvedValue({ type: "question", standalone: "Do you ship abroad?" });
    rpc.mockResolvedValue({
      data: [
        { id: "c1", source_id: "s1", content: "We ship worldwide.", similarity: 0.8 },
        { id: "c2", source_id: "s1", content: "Unrelated text", similarity: 0.1 },
      ],
      error: null,
    });
    generateAnswer.mockResolvedValue("Yes, we ship worldwide.");
    const r = await answerForOwner(project, "ship abroad?");
    expect(r.reply).toBe("Yes, we ship worldwide.");
    expect(r.chunks.map((c) => [c.title, c.used])).toEqual([["Shipping", true], ["Shipping", false]]);
    expect(r.understoodAs).toBe("Do you ship abroad?");
  });
  it("says it has no answer, without calling the model, when nothing is strong enough", async () => {
    understandMessage.mockResolvedValue({ type: "question", standalone: "q" });
    rpc.mockResolvedValue({ data: [{ id: "c2", source_id: "s1", content: "x", similarity: 0.1 }], error: null });
    const r = await answerForOwner(project, "q");
    expect(r.reply).toBe(NO_ANSWER);
    expect(generateAnswer).not.toHaveBeenCalled();
  });
  it("throws when the search fails", async () => {
    understandMessage.mockResolvedValue({ type: "question", standalone: "q" });
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(answerForOwner(project, "q")).rejects.toThrow(/match_chunks_hybrid/);
  });
});
