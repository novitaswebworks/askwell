import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const from = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from }) }));

import { GET, OPTIONS } from "./route";

const get = (key?: string) =>
  GET(new Request(`http://x/api/widget/config${key ? `?key=${key}` : ""}`));
const stored = {
  button_color: "#ff0000",
  position: "top-left",
  label: "Ask us",
  animation: "scale",
  header_text: "Hi there",
  show_badge: false,
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
