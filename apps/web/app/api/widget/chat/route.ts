import { NextResponse } from "next/server";
import { chatRequestSchema, getPlanLimits, type ChatResponse } from "@askwell/shared";
import { AiUnavailableError, embedTexts, generateAnswer } from "@/lib/ai/ollama";
import { getAccountPlan } from "@/lib/accounts";
import { apiError, isUuid, readJson } from "@/lib/api";
import {
  buildPrompt,
  MATCH_COUNT,
  NO_ANSWER,
  QUOTA_MESSAGE,
  relevantChunks,
  SYSTEM_PROMPT,
  UNAVAILABLE_MESSAGE,
  type MatchedChunk,
} from "@/lib/chat";
import { protectChat } from "@/lib/protect";
import { createServiceClient } from "@/lib/supabase/service";

// Public route, called from any website. The key only identifies a project.
const CORS = { "Access-Control-Allow-Origin": "*" };

// A cold model can take over a minute to load.
export const maxDuration = 300;

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

  // 1. Validate the shape (message 1 to 1,000 characters, key format).
  const parsed = chatRequestSchema.safeParse(await readJson(req.clone()));
  if (!parsed.success) return fail("invalid_input", "Enter a message of up to 1,000 characters.");
  const { key, visitorId, conversationId, message } = parsed.data;

  // 2. Protect: rate limit and prompt injection, before any database or AI work.
  const protection = await protectChat(req, key, message);
  if (!protection.ok) {
    return protection.reason === "rate_limit"
      ? fail("rate_limited", "You are sending messages too fast. Wait a moment and try again.")
      : fail("message_blocked", "That message can't be sent.");
  }

  // 3. Resolve the project from the public key only.
  const service = createServiceClient();
  const { data: project, error: projectError } = await service
    .from("projects")
    .select("id, owner_id")
    .eq("public_key", key)
    .maybeSingle();
  if (projectError) return fail("internal", UNAVAILABLE_MESSAGE);
  if (!project) return fail("not_found", "Unknown key.");

  // A conversation must belong to this project; otherwise 404 and nothing is counted.
  if (conversationId) {
    if (!isUuid(conversationId)) return fail("not_found", "Conversation not found.");
    const { data: conversation, error } = await service
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("project_id", project.id)
      .maybeSingle();
    if (error) return fail("internal", UNAVAILABLE_MESSAGE);
    if (!conversation) return fail("not_found", "Conversation not found.");
  }

  // 4. Count the message before any AI call. A model error still uses one message.
  const plan = await getAccountPlan(project.owner_id, service);
  const { data: counted, error: countError } = await service.rpc("consume_message", {
    p_project_id: project.id,
    p_monthly_limit: getPlanLimits(plan).messagesPerMonth,
  });
  if (countError) return fail("internal", UNAVAILABLE_MESSAGE);
  if (counted !== true) return fail("quota_exceeded", QUOTA_MESSAGE);

  // 5. Retrieve (this project's ready sources only) and answer.
  let reply: string;
  try {
    const [embedding] = await embedTexts([message]);
    const { data: matches, error: matchError } = await service.rpc("match_chunks", {
      p_project_id: project.id,
      p_query_embedding: embedding,
      p_match_count: MATCH_COUNT,
    });
    if (matchError) throw new Error(`match_chunks: ${matchError.message}`);

    const chunks = relevantChunks((matches ?? []) as MatchedChunk[]);
    reply = chunks.length === 0 ? NO_ANSWER : await generateAnswer(SYSTEM_PROMPT, buildPrompt(chunks, message));
    if (!reply) reply = NO_ANSWER;
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) console.error("[chat] failed", error);
    return fail("internal", UNAVAILABLE_MESSAGE);
  }

  // 6. Save the turn; the first message creates the conversation.
  const { data: savedId, error: saveError } = await service.rpc("save_chat_turn", {
    p_project_id: project.id,
    p_visitor_id: visitorId,
    p_conversation_id: conversationId ?? null,
    p_visitor_message: message,
    p_bot_reply: reply,
  });
  if (saveError) return fail("internal", UNAVAILABLE_MESSAGE);

  const body: ChatResponse = { conversationId: savedId as string, reply };
  return NextResponse.json(body, { headers: CORS });
}
