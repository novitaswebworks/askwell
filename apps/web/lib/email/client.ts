import "server-only";
import { APP_NAME } from "@askwell/shared";

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
};

// Sends an email via Resend if RESEND_API_KEY is configured.
// Never throws: failures are logged so background notifications do not break user flows.
export async function sendEmail({ to, subject, text }: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    // In dev or test environments without an email key, skip cleanly without failing.
    return false;
  }

  const from = process.env.LEADS_FROM_EMAIL?.trim() || `${APP_NAME} <onboarding@resend.dev>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown error");
      console.error("[email] dispatch failed:", res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] network error:", err instanceof Error ? err.message : "unknown");
    return false;
  }
}
