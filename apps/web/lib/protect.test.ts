import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const protect = vi.fn();
vi.mock("@arcjet/next", () => ({
  default: () => ({ protect }),
  fixedWindow: () => [],
  detectPromptInjection: () => [],
}));

const decision = (o: { errored?: boolean; denied?: boolean; rate?: boolean }) => ({
  isErrored: () => !!o.errored,
  isDenied: () => !!o.denied,
  reason: { isRateLimit: () => !!o.rate },
});

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.ARCJET_KEY = "ajkey_test";
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ARCJET_KEY;
});

async function run() {
  const { protectChat } = await import("./protect");
  return protectChat(new Request("http://x"), "pk_abcdefgh12345678", "hi");
}

describe("protectChat", () => {
  it("allows a clean request and passes the key and message to Arcjet", async () => {
    protect.mockResolvedValue(decision({}));
    expect(await run()).toEqual({ ok: true });
    expect(protect).toHaveBeenCalledWith(expect.any(Request), {
      publicKey: "pk_abcdefgh12345678",
      detectPromptInjectionMessage: "hi",
    });
  });
  it("reports a rate limit and an injection separately", async () => {
    protect.mockResolvedValue(decision({ denied: true, rate: true }));
    expect(await run()).toEqual({ ok: false, reason: "rate_limit" });
    protect.mockResolvedValue(decision({ denied: true }));
    expect(await run()).toEqual({ ok: false, reason: "injection" });
  });
  it("fails open on an Arcjet error decision, a thrown error, and a missing key", async () => {
    protect.mockResolvedValue(decision({ errored: true }));
    expect(await run()).toEqual({ ok: true });
    protect.mockRejectedValue(new Error("network"));
    expect(await run()).toEqual({ ok: true });
    delete process.env.ARCJET_KEY;
    expect(await run()).toEqual({ ok: true });
  });
});
