import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const after = vi.fn();
vi.mock("next/server", () => ({ after: (fn: () => void) => after(fn) }));
const capture = vi.fn();
const flush = vi.fn().mockResolvedValue(undefined);
const captureExceptionImmediate = vi.fn().mockResolvedValue(undefined);
const PostHog = vi.fn((..._args: unknown[]) => ({ capture, flush, captureExceptionImmediate }));
vi.mock("posthog-node", () => ({ PostHog: function (...a: unknown[]) { return PostHog(...a); } }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.POSTHOG_KEY;
  delete process.env.POSTHOG_HOST;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
});

describe("postHogConfig", () => {
  it("is null without a key", async () => {
    const { postHogConfig } = await import("./analytics");
    expect(postHogConfig({})).toBeNull();
    expect(postHogConfig({ POSTHOG_KEY: "  " })).toBeNull();
  });
  it("prefers the server variables, falls back to the public ones, and defaults the host", async () => {
    const { postHogConfig } = await import("./analytics");
    expect(postHogConfig({ POSTHOG_KEY: "phc_a", POSTHOG_HOST: "https://eu.i.posthog.com/" })).toEqual({
      key: "phc_a",
      host: "https://eu.i.posthog.com",
    });
    expect(postHogConfig({ NEXT_PUBLIC_POSTHOG_KEY: "phc_b" })).toEqual({ key: "phc_b", host: "https://us.i.posthog.com" });
  });
});

describe("track", () => {
  it("does nothing when PostHog is not configured", async () => {
    const { track } = await import("./analytics");
    track({ distinctId: "u1", event: "x" });
    expect(PostHog).not.toHaveBeenCalled();
  });

  it("captures the event and flushes after the response", async () => {
    process.env.POSTHOG_KEY = "phc_test";
    const { track } = await import("./analytics");
    track({ distinctId: "u1", event: "project_created", properties: { plan: "free" } });
    expect(capture).toHaveBeenCalledWith({ distinctId: "u1", event: "project_created", properties: { plan: "free" } });
    expect(after).toHaveBeenCalledTimes(1);
    after.mock.calls[0]![0]();
    expect(flush).toHaveBeenCalled();
  });

  it("creates no person profile for anonymous visitors", async () => {
    process.env.POSTHOG_KEY = "phc_test";
    const { track } = await import("./analytics");
    track({ distinctId: "visitor-1", event: "widget_message", anonymous: true, properties: { kind: "question" } });
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { kind: "question", $process_person_profile: false } }),
    );
  });

  it("never throws, even when PostHog does", async () => {
    process.env.POSTHOG_KEY = "phc_test";
    capture.mockImplementationOnce(() => {
      throw new Error("network");
    });
    const { track } = await import("./analytics");
    expect(() => track({ distinctId: "u1", event: "x" })).not.toThrow();
  });

  it("flushes straight away when there is no request to run it after", async () => {
    process.env.POSTHOG_KEY = "phc_test";
    after.mockImplementationOnce(() => {
      throw new Error("outside a request scope");
    });
    const { track } = await import("./analytics");
    track({ distinctId: "u1", event: "x" });
    expect(flush).toHaveBeenCalled();
  });
});

describe("trackGeneration", () => {
  it("sends an $ai_generation with model, tokens, latency in seconds and project, and no text", async () => {
    process.env.POSTHOG_KEY = "phc_test";
    const { trackGeneration } = await import("./analytics");
    trackGeneration({
      distinctId: "visitor-1",
      projectId: "p1",
      traceId: "t1",
      spanName: "answer_question",
      model: "openai/gpt-oss-20b",
      inputTokens: 900,
      outputTokens: 60,
      latencyMs: 1500,
    });
    const sent = capture.mock.calls[0]![0];
    expect(sent.event).toBe("$ai_generation");
    expect(sent.properties).toMatchObject({
      $ai_trace_id: "t1",
      $ai_span_name: "answer_question",
      $ai_provider: "groq",
      $ai_model: "openai/gpt-oss-20b",
      $ai_input_tokens: 900,
      $ai_output_tokens: 60,
      $ai_latency: 1.5,
      project_id: "p1",
      $process_person_profile: false,
    });
    expect(Object.keys(sent.properties).join(",")).not.toMatch(/input\b|output\b|content|prompt/i);
  });
});

describe("captureServerError", () => {
  it("reports the error with its route", async () => {
    process.env.POSTHOG_KEY = "phc_test";
    const { captureServerError } = await import("./analytics");
    const err = new Error("boom");
    await captureServerError(err, { path: "/api/x" });
    expect(captureExceptionImmediate).toHaveBeenCalledWith(err, undefined, { path: "/api/x" });
  });
  it("swallows failures and does nothing without a key", async () => {
    const { captureServerError } = await import("./analytics");
    await expect(captureServerError(new Error("x"))).resolves.toBeUndefined();
    process.env.POSTHOG_KEY = "phc_test";
    vi.resetModules();
    captureExceptionImmediate.mockRejectedValueOnce(new Error("down"));
    const again = await import("./analytics");
    await expect(again.captureServerError(new Error("x"))).resolves.toBeUndefined();
  });
});
