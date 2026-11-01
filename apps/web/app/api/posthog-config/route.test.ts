import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => {} }));
import { GET } from "./route";

afterEach(() => {
  delete process.env.POSTHOG_KEY;
  delete process.env.POSTHOG_HOST;
});

describe("GET /api/posthog-config", () => {
  it("returns nulls when PostHog is not configured, so the browser sends nothing", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ key: null, host: null });
  });
  it("returns the public key and host read at request time", async () => {
    process.env.POSTHOG_KEY = "phc_live";
    process.env.POSTHOG_HOST = "https://eu.i.posthog.com";
    expect(await (await GET()).json()).toEqual({ key: "phc_live", host: "https://eu.i.posthog.com" });
  });
  it("returns nothing secret: only the key and host", async () => {
    process.env.POSTHOG_KEY = "phc_live";
    expect(Object.keys(await (await GET()).json()).sort()).toEqual(["host", "key"]);
  });
});
