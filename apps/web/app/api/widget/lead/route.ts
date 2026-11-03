import { NextResponse } from "next/server";
import { captureLeadRequestSchema, type CaptureLeadResponse } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { track } from "@/lib/analytics";
import { apiError, isUuid, readJson } from "@/lib/api";
import { notifyOwnerOfLead } from "@/lib/email/notify";
import { protectRate } from "@/lib/protect";
import { createServiceClient } from "@/lib/supabase/service";

const CORS = { "Access-Control-Allow-Origin": "*" };

const LEADS_PER_MINUTE = 5; // per public key + IP
const REPLAY_WINDOW_MS = 10 * 60 * 1000;

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(req: Request) {
  const fail = (...args: Parameters<typeof apiError>) => apiError(args[0], args[1], { headers: CORS });

  const body = await readJson(req);
  const parsed = captureLeadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_input", "Please provide a valid email address.");
  }

  const { key, conversationId, email, name, phone, type } = parsed.data;

  // Before any database work: this route writes with the service role and can send the owner email.
  if (!(await protectRate(req, key, "lead", LEADS_PER_MINUTE))) {
    return fail("rate_limited", "Too many requests. Please wait a minute and try again.");
  }

  const service = createServiceClient();
  const { data: project, error: projectError } = await service
    .from("projects")
    .select("id, name, owner_id")
    .eq("public_key", key)
    .maybeSingle();

  if (projectError || !project) {
    return fail("not_found", "Project not found.");
  }

  // A conversation is optional (see the schema), but one that is named must be this project's.
  let conversation: { id: string; visitor_id: string } | null = null;
  if (conversationId) {
    if (!isUuid(conversationId)) return fail("not_found", "Conversation not found.");
    const { data, error: convError } = await service
      .from("conversations")
      .select("id, visitor_id")
      .eq("id", conversationId)
      .eq("project_id", project.id)
      .maybeSingle();
    if (convError || !data) return fail("not_found", "Conversation not found.");
    conversation = data;
  }

  // The same details sent again (a replay, a double click) are not a new lead and not another email.
  let recent = service
    .from("leads")
    .select("id")
    .eq("project_id", project.id)
    .eq("email", email)
    .gte("created_at", new Date(Date.now() - REPLAY_WINDOW_MS).toISOString())
    .limit(1);
  recent = conversation ? recent.eq("conversation_id", conversation.id) : recent.is("conversation_id", null);
  const { data: existing } = await recent.maybeSingle();
  if (existing) {
    const again: CaptureLeadResponse = { success: true, leadId: existing.id };
    return NextResponse.json(again, { headers: CORS });
  }

  // Insert lead
  const { data: lead, error: insertError } = await service
    .from("leads")
    .insert({
      project_id: project.id,
      conversation_id: conversation?.id ?? null,
      email,
      name: name ?? null,
      phone: phone ?? null,
    })
    .select("id")
    .single();

  if (insertError || !lead) {
    return fail("internal", "Could not save your contact info. Please try again.");
  }

  // Load plan: notification emails are a Pro feature
  const plan = await getAccountPlan(project.owner_id, service);
  if (plan === "pro") {
    // Load transcript to include in the notification email (none when there was no conversation yet)
    const { data: messages } = conversation
      ? await service
          .from("messages")
          .select("role, body")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true })
          .limit(20)
      : { data: [] as { role: string; body: string }[] };

    const transcript = (messages ?? []).map((m) => ({
      role: m.role as "visitor" | "bot",
      body: m.body,
    }));

    await notifyOwnerOfLead({
      ownerId: project.owner_id,
      projectName: project.name,
      lead: { email, name, phone },
      transcript,
      isHandoff: type === "handoff",
    });
  }

  track({
    distinctId: conversation?.visitor_id ?? `lead:${project.id}`,
    event: "lead_captured",
    anonymous: true,
    properties: {
      projectId: project.id,
      type,
      plan,
      hasName: Boolean(name),
      hasPhone: Boolean(phone),
    },
  });

  const resBody: CaptureLeadResponse = {
    success: true,
    leadId: lead.id,
  };
  return NextResponse.json(resBody, { headers: CORS });
}
