import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { APP_NAME } from "@askwell/shared";
import { sendEmail } from "./client";

export type NotifyOwnerParams = {
  ownerId: string;
  projectName: string;
  lead: {
    email: string;
    name?: string | null;
    phone?: string | null;
  };
  transcript?: Array<{ role: "visitor" | "bot"; body: string }>;
  isHandoff?: boolean;
};

export async function notifyOwnerOfLead({
  ownerId,
  projectName,
  lead,
  transcript = [],
  isHandoff = false,
}: NotifyOwnerParams): Promise<boolean> {
  let ownerEmail: string | undefined;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(ownerId);
    ownerEmail = user.primaryEmailAddress?.emailAddress;
  } catch (err) {
    console.error("[email] could not load owner email:", err instanceof Error ? err.message : "unknown");
  }

  if (!ownerEmail) return false;

  const subject = isHandoff
    ? `[${APP_NAME}] Visitor requested a person on ${projectName}`
    : `[${APP_NAME}] New lead captured on ${projectName}`;

  const lines: string[] = [];
  lines.push(isHandoff ? `A website visitor requested to talk to a person.` : `A new lead was submitted via your chat widget.`);
  lines.push(`Project: ${projectName}`);
  lines.push("");
  lines.push("Contact Details:");
  lines.push(`- Email: ${lead.email}`);
  if (lead.name) lines.push(`- Name: ${lead.name}`);
  if (lead.phone) lines.push(`- Phone: ${lead.phone}`);
  lines.push("");

  if (transcript.length > 0) {
    lines.push("Conversation Transcript:");
    lines.push("------------------------");
    for (const turn of transcript) {
      const speaker = turn.role === "visitor" ? "Visitor" : "Assistant";
      lines.push(`${speaker}: ${turn.body}`);
    }
    lines.push("------------------------");
    lines.push("");
  }

  lines.push(`View all leads in your ${APP_NAME} dashboard.`);

  return sendEmail({
    to: ownerEmail,
    subject,
    text: lines.join("\n"),
  });
}
