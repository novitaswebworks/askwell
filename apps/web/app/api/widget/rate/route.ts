import { NextResponse } from "next/server";
import { rateReplyRequestSchema, type RateReplyResponse } from "@askwell/shared";
import { track } from "@/lib/analytics";
import { apiError, readJson } from "@/lib/api";
import { protectRate } from "@/lib/protect";
import { createServiceClient } from "@/lib/supabase/service";

// Public route, called from the chat panel. The key only identifies a project; the
// conversation ID (a random UUID only that visitor's browser holds) picks the chat.
const CORS = { "Access-Control-Allow-Origin": "*" };

const RATINGS_PER_MINUTE = 30; // per public key + IP

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

  const parsed = rateReplyRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("invalid_input", "Choose thumbs up or down for an answer.");
  const { key, conversationId, rating } = parsed.data;

  if (!(await protectRate(req, key, "rate", RATINGS_PER_MINUTE))) {
    return fail("rate_limited", "Too many requests. Please wait a minute and try again.");
  }

  const service = createServiceClient();
  const { data: project, error: projectError } = await service
    .from("projects")
    .select("id")
    .eq("public_key", key)
    .maybeSingle();
  if (projectError) return fail("internal", "Could not save your rating.");
  if (!project) return fail("not_found", "Unknown key.");

  // The function checks the conversation belongs to this project and rates its latest answer.
  const { data: rated, error } = await service.rpc("rate_last_reply", {
    p_project_id: project.id,
    p_conversation_id: conversationId,
    p_rating: rating,
  });
  if (error) return fail("internal", "Could not save your rating.");
  if (rated !== true) return fail("not_found", "Conversation not found.");

  if (rating !== 0) {
    track({
      distinctId: conversationId,
      event: "answer_rated",
      anonymous: true,
      properties: { project_id: project.id, rating: rating === 1 ? "helpful" : "not_helpful" },
    });
  }
  const body: RateReplyResponse = { rating: rating === 0 ? null : rating };
  return NextResponse.json(body, { headers: CORS });
}
