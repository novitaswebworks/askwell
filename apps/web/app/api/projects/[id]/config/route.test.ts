import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const ownerFrom = vi.fn();
vi.mock("@/lib/supabase/owner", () => ({ createOwnerClient: () => ({ from: ownerFrom }) }));
const serviceFrom = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: serviceFrom }) }));
const getAccountPlan = vi.fn();
vi.mock("@/lib/accounts", () => ({ getAccountPlan: (userId: string) => getAccountPlan(userId) }));
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (event: unknown) => track(event) }));

import { PATCH } from "./route";

const id = "0b1c2d3e-0000-4000-8000-000000000001";
const ctx = (value = id) => ({ params: Promise.resolve({ id: value }) });
const patch = (body: unknown, value?: string) =>
  PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }), ctx(value));

const proRow = {
  project_id: id,
  button_color: "#1d4ed8",
  position: "bottom-left",
  label: "Ask support",
  animation: "scale",
  header_text: "Ask our team",
  show_badge: false,
  welcome_message: "Ask a question and we'll reply right here.",
  starter_questions: [
    "What services do you offer?",
    "How do I get started?",
    "How can I contact you?",
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user_1" });
  ownerFrom.mockReturnValue(queryResult({ data: { id } }));
  getAccountPlan.mockResolvedValue("pro");
  serviceFrom.mockReturnValue(queryResult({ data: proRow }));
});

describe("PATCH /api/projects/:id/config", () => {
  it("returns 401 when signed out", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await patch({ buttonColor: "#123456" })).status).toBe(401);
  });

  it("returns 404 for an id that is not a UUID", async () => {
    expect((await patch({ buttonColor: "#123456" }, "invalid-id")).status).toBe(404);
  });

  it("returns 404 when project is not owned by the caller", async () => {
    ownerFrom.mockReturnValue(queryResult({ data: null }));
    expect((await patch({ buttonColor: "#123456" })).status).toBe(404);
  });

  it("returns 400 for empty body or invalid fields", async () => {
    expect((await patch({})).status).toBe(400);
    expect((await patch({ buttonColor: "red" })).status).toBe(400);
    expect((await patch({ label: "" })).status).toBe(400);
    expect((await patch({ label: "x".repeat(41) })).status).toBe(400);
    expect((await patch({ headerText: "x".repeat(61) })).status).toBe(400);
    expect((await patch({ position: "center" })).status).toBe(400);
    expect((await patch({ animation: "bounce" })).status).toBe(400);
  });

  it("returns 402 for Free plan and writes nothing", async () => {
    getAccountPlan.mockResolvedValue("free");
    const res = await patch({ buttonColor: "#123456" });
    expect(res.status).toBe(402);
    expect(serviceFrom).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.error.code).toBe("plan_required");
  });

  it("updates widget configuration on Pro plan and tracks event", async () => {
    const update = vi.fn().mockReturnValue(queryResult({ data: proRow }));
    serviceFrom.mockReturnValue({ update });

    const res = await patch({
      buttonColor: "#1d4ed8",
      position: "bottom-left",
      label: "Ask support",
      animation: "scale",
      headerText: "Ask our team",
      showBadge: false,
    });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      button_color: "#1d4ed8",
      position: "bottom-left",
      label: "Ask support",
      animation: "scale",
      header_text: "Ask our team",
      show_badge: false,
    });

    const data = await res.json();
    expect(data).toEqual({
      buttonColor: "#1d4ed8",
      position: "bottom-left",
      label: "Ask support",
      animation: "scale",
      headerText: "Ask our team",
      showBadge: false,
      welcomeMessage: "Ask a question and we'll reply right here.",
      starterQuestions: [
        "What services do you offer?",
        "How do I get started?",
        "How can I contact you?",
      ],
    });

    expect(track).toHaveBeenCalledWith({
      distinctId: "user_1",
      event: "widget_customized",
      properties: { projectId: id },
    });
  });

  it("updates welcomeMessage and starterQuestions on Pro plan", async () => {
    const update = vi.fn().mockReturnValue(queryResult({ data: proRow }));
    serviceFrom.mockReturnValue({ update });

    const res = await patch({
      welcomeMessage: "Hello, welcome to our store!",
      starterQuestions: ["Where are you located?", "What are your hours?"],
    });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      welcome_message: "Hello, welcome to our store!",
      starter_questions: ["Where are you located?", "What are your hours?"],
    });
  });

  it("never touches unallowed columns even if passed in body", async () => {
    const update = vi.fn().mockReturnValue(queryResult({ data: proRow }));
    serviceFrom.mockReturnValue({ update });

    await patch({
      buttonColor: "#1d4ed8",
      project_id: "fake",
      messages_used: 999,
      owner_id: "other",
    } as unknown as Record<string, unknown>);

    expect(update).toHaveBeenCalledWith({
      button_color: "#1d4ed8",
    });
  });
});
