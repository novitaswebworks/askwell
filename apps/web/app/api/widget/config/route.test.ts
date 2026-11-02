import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const recordSeen = vi.fn();
vi.mock("@/lib/seen", async (orig) => ({ ...(await orig<typeof import("@/lib/seen")>()), recordSeen: (...a: unknown[]) => recordSeen(...a) }));
const from = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from }) }));

import { GET, OPTIONS } from "./route";

const get = (key?: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://x/api/widget/config${key ? `?key=${key}` : ""}`, { headers }));
const stored = {
  button_color: "#ff0000",
  position: "top-left",
  label: "Ask us",
  animation: "scale",
  header_text: "Hi there",
  show_badge: false,
  welcome_message: "Custom welcome",
  starter_questions: ["Q1", "Q2"],
  last_seen_at: null,
  last_seen_host: null,
};

function mockTables(plan: string, project: unknown = { id: "p1", owner_id: "user_1" }) {
  from.mockImplementation((table: string) =>
    queryResult({
      data: table === "projects" ? project : table === "widget_configs" ? stored : { plan },
    }),
  );
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/widget/config", () => {
  it("returns 404 for a missing or malformed key", async () => {
    expect((await get()).status).toBe(404);
    expect((await get("nope")).status).toBe(404);
  });
  it("returns 404 for an unknown key", async () => {
    mockTables("free", null);
    expect((await get("pk_abcdefgh12345678")).status).toBe(404);
  });
  it("gives a Free project the defaults and the badge", async () => {
    mockTables("free");
    const res = await get("pk_abcdefgh12345678");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(DEFAULT_WIDGET_CONFIG);
  });
  it("gives a Pro project its stored config", async () => {
    mockTables("pro");
    const body = await (await get("pk_abcdefgh12345678")).json();
    expect(body).toMatchObject({ buttonColor: "#ff0000", position: "top-left", showBadge: false });
  });
  it("allows any origin", async () => {
    mockTables("free");
    expect((await get("pk_abcdefgh12345678")).headers.get("access-control-allow-origin")).toBe("*");
    expect(OPTIONS().status).toBe(204);
  });
});

describe("GET /api/widget/config: last seen", () => {
  it("notes the site the widget is running on", async () => {
    mockTables("free");
    const res = await get("pk_abcdefgh12345678", { origin: "https://shop.example.com" });
    expect(res.status).toBe(200);
    expect(recordSeen).toHaveBeenCalledWith(expect.anything(), "p1", "shop.example.com");
  });
  it("does nothing without a usable Origin or Referer", async () => {
    mockTables("free");
    await get("pk_abcdefgh12345678");
    expect(recordSeen).not.toHaveBeenCalled();
  });
  it("does not write again for a recent sighting of the same site", async () => {
    mockTables("free");
    stored.last_seen_at = new Date().toISOString() as never;
    stored.last_seen_host = "shop.example.com" as never;
    await get("pk_abcdefgh12345678", { origin: "https://shop.example.com" });
    expect(recordSeen).not.toHaveBeenCalled();
    stored.last_seen_at = null as never;
    stored.last_seen_host = null as never;
  });
  it("never lets last-seen data leak into the public config", async () => {
    mockTables("pro");
    const body = await (await get("pk_abcdefgh12345678", { origin: "https://shop.example.com" })).json();
    expect(Object.keys(body).sort()).toEqual([
      "animation",
      "buttonColor",
      "headerText",
      "label",
      "position",
      "showBadge",
      "starterQuestions",
      "welcomeMessage",
    ]);
  });

  describe("allowed domains", () => {
    const withList = (list: string[]) => mockTables("free", { id: "p1", owner_id: "user_1", allowed_domains: list });
    const KEY = "pk_abcdefgh12345678";
    it("allows any site when the list is empty", async () => {
      withList([]);
      expect((await get(KEY, { origin: "https://anything.example" })).status).toBe(200);
    });
    it("refuses a site that is not listed", async () => {
      withList(["suitedreams.com"]);
      const res = await get(KEY, { origin: "https://askwell.example" });
      expect(res.status).toBe(403);
      expect(res.headers.get("vary")).toBe("Origin");
    });
    it("refuses a request that names no site", async () => {
      withList(["suitedreams.com"]);
      expect((await get(KEY)).status).toBe(403);
    });
    it("allows the listed site, its subdomains and local testing", async () => {
      withList(["suitedreams.com"]);
      for (const origin of ["https://suitedreams.com", "https://www.suitedreams.com", "http://localhost:3000"]) {
        expect((await get(KEY, { origin })).status).toBe(200);
      }
    });
    it("does not match look-alike hosts", async () => {
      withList(["suitedreams.com"]);
      expect((await get(KEY, { origin: "https://notsuitedreams.com" })).status).toBe(403);
    });
    it("checks the host page's origin when the embed panel asks from our own address", async () => {
      withList(["suitedreams.com"]);
      const embed = (origin: string) =>
        GET(new Request(`http://x/api/widget/config?key=${KEY}&origin=${encodeURIComponent(origin)}`, { headers: { referer: "http://x/embed" } }));
      expect((await embed("https://suitedreams.com")).status).toBe(200);
      expect((await embed("https://other.example")).status).toBe(403);
    });
    it("lets the dashboard preview (our own address, no origin) through", async () => {
      withList(["suitedreams.com"]);
      expect((await get(KEY, { origin: "http://x" })).status).toBe(200);
    });
  });
});
