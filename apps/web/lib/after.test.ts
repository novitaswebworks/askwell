import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  after: () => {
    throw new Error("called outside a request");
  },
}));

import { runAfterResponse } from "./after";

describe("runAfterResponse", () => {
  it("runs the work even outside a request", async () => {
    const work = vi.fn(async () => undefined);
    runAfterResponse(work);
    await vi.waitFor(() => expect(work).toHaveBeenCalledTimes(1));
  });
  it("never lets a failure in the background work escape", async () => {
    const work = vi.fn(async () => {
      throw new Error("mail down");
    });
    expect(() => runAfterResponse(work)).not.toThrow();
    await vi.waitFor(() => expect(work).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10)); // would surface an unhandled rejection here
  });
});
