import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const generateAnswer = vi.fn();
vi.mock("./groq", () => ({ generateAnswer: (...a: unknown[]) => generateAnswer(...a) }));

import { understandMessage } from "./understand";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("understandMessage", () => {
  it("returns the parsed classification and asks the model with the business and history", async () => {
    generateAnswer.mockResolvedValue('{"type":"off_topic","standalone":""}');
    const result = await understandMessage("A travel advisor.", [{ role: "bot", body: "Hi" }], "who won the cup?");
    expect(result).toEqual({ type: "off_topic" });
    expect(generateAnswer.mock.calls[0]![1]).toContain("A travel advisor.");
    expect(generateAnswer.mock.calls[0]![1]).toContain("Assistant: Hi");
    expect(generateAnswer.mock.calls[0]![2]).toMatchObject({ timeoutMs: 12000 });
  });
  it("treats the message as a plain question when the model fails", async () => {
    generateAnswer.mockRejectedValue(new Error("timeout"));
    expect(await understandMessage("", [], "How can I book?")).toEqual({ type: "question", standalone: "How can I book?" });
  });
  it("treats the message as a plain question when the model returns junk", async () => {
    generateAnswer.mockResolvedValue("I think this is a question!");
    expect(await understandMessage("", [], "hi")).toEqual({ type: "question", standalone: "hi" });
  });
});
