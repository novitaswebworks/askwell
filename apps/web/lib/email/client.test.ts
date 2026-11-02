import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendEmail } from "./client";

describe("sendEmail", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false cleanly if RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;
    const sent = await sendEmail({
      to: "owner@example.com",
      subject: "Test",
      text: "Test body",
    });
    expect(sent).toBe(false);
  });

  it("calls Resend endpoint when RESEND_API_KEY is present", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.LEADS_FROM_EMAIL = "Askwell <leads@example.com>";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const sent = await sendEmail({
      to: "owner@example.com",
      subject: "New Lead",
      text: "Lead details",
    });

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
        }),
      }),
    );
  });
});
