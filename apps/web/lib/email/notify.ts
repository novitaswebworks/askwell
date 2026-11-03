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

async function ownerEmailOf(ownerId: string): Promise<string | undefined> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(ownerId);
    return user.primaryEmailAddress?.emailAddress;
  } catch (err) {
    console.error("[email] could not load owner email:", err instanceof Error ? err.message : "unknown");
    return undefined;
  }
}

export async function notifyOwnerOfLead({
  ownerId,
  projectName,
  lead,
  transcript = [],
  isHandoff = false,
}: NotifyOwnerParams): Promise<boolean> {
  const ownerEmail = await ownerEmailOf(ownerId);

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

export type QuotaNoticeParams = {
  ownerId: string;
  projectName: string;
  level: 80 | 100;
  used: number;
  limit: number;
  plan: "free" | "pro";
};

// "Your project is nearly out of messages" / "is out of messages", once each per month.
export async function notifyOwnerOfQuota({ ownerId, projectName, level, used, limit, plan }: QuotaNoticeParams): Promise<boolean> {
  const to = await ownerEmailOf(ownerId);
  if (!to) return false;

  const billing = `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/dashboard/billing`;
  const lines =
    level === 80
      ? [
          `${projectName} has used ${used.toLocaleString("en-US")} of its ${limit.toLocaleString("en-US")} messages this month (80%).`,
          "",
          "The count starts again on the 1st of each month (UTC). When it runs out, visitors are told the team is unavailable and can leave their email instead.",
        ]
      : [
          `${projectName} has used all ${limit.toLocaleString("en-US")} of its messages this month.`,
          "",
          "Until the 1st of next month (UTC), visitors are told the team is unavailable and can leave their email instead.",
        ];
  if (plan === "free") {
    lines.push("", `Upgrade to Pro for more messages: ${billing}`);
  }
  lines.push("", `You get this email once per month for each level (80% and 100%).`);

  return sendEmail({
    to,
    subject:
      level === 80
        ? `[${APP_NAME}] ${projectName} has used 80% of its monthly messages`
        : `[${APP_NAME}] ${projectName} is out of messages for this month`,
    text: lines.join("\n"),
  });
}
