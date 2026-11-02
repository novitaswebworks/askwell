import { NextResponse } from "next/server";
import { chatRequestSchema, getPlanLimits, type ChatResponse } from "@askwell/shared";
import { AiUnavailableError } from "@/lib/ai/errors";
import { generateAnswer } from "@/lib/ai/groq";
import { embedTexts } from "@/lib/ai/ollama";
import { understandMessage } from "@/lib/ai/understand";
import { getAccountPlan } from "@/lib/accounts";
import { track, trackGeneration, type Generation } from "@/lib/analytics";
import { apiError, isUuid, readJson } from "@/lib/api";
import {
  buildPrompt,
  buildSystemPrompt,
  DEFAULT_FOLLOW_UPS,
  HUMAN_QUERY,
  MATCH_COUNT,
  NO_ANSWER,
  OFF_TOPIC_REPLY,
  parseAnswerAndFollowUps,
  QUOTA_MESSAGE,
  RATE_LIMIT_MESSAGE,
  relevantChunks,
  SMALLTALK_REPLIES,
  UNAVAILABLE_MESSAGE,
  type MatchedChunk,
} from "@/lib/chat";
import { keywordQuery } from "@/lib/search-terms";
import type { Turn } from "@/lib/understand";
import { protectChat } from "@/lib/protect";
import { createServiceClient } from "@/lib/supabase/service";

// Public route, called from any website. The key only identifies a project.
const CORS = { "Access-Control-Allow-Origin": "*" };

// Embedding on a cold Ollama model can take a while.
export const maxDuration = 120;

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
    track({
      distinctId: visitorId,
      event: "message_blocked",
      anonymous: true,
      properties: { reason: protection.reason, public_key: key },
    });
    return protection.reason === "rate_limit"
      ? fail("rate_limited", RATE_LIMIT_MESSAGE)
      : fail("message_blocked", "That message can't be sent.");
  }

  // 3. Resolve the project from the public key only.
  const service = createServiceClient();
  const { data: project, error: projectError } = await service
    .from("projects")
    .select("id, owner_id, about")
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
  if (counted !== true) {
    track({ distinctId: visitorId, event: "quota_exceeded", anonymous: true, properties: { project_id: project.id } });
    return fail("quota_exceeded", QUOTA_MESSAGE);
  }

  // 5. Understand the message, then answer, decline or chat accordingly.
  let reply: string;
  let kind: string = "question";
  let sources: string[] | undefined;
  let followUps: string[] | undefined;
  // Token counts and timings only, never the text of a message (project.md section 6.6).
  const traceId = crypto.randomUUID();
  const traced = (spanName: string) => (g: Generation) =>
    trackGeneration({ ...g, distinctId: visitorId, projectId: project.id, traceId, spanName });
  try {
    const about = (project.about as string | null) ?? "";
    const history = conversationId ? await loadHistory(service, conversationId) : [];
    const understanding = await understandMessage(about, history, message, traced("understand_message"));
    kind = understanding.type;

    if (understanding.type === "smalltalk") {
      reply = SMALLTALK_REPLIES[understanding.smalltalk];
      followUps = DEFAULT_FOLLOW_UPS;
    } else if (understanding.type === "off_topic") {
      reply = OFF_TOPIC_REPLY;
      followUps = DEFAULT_FOLLOW_UPS.slice(0, 2);
    } else {
      // Retrieve (this project's ready sources only) and answer.
      const query = understanding.type === "human" ? HUMAN_QUERY : understanding.standalone;
      const [embedding] = await embedTexts([query], "query");
      // Meaning and keywords together: a chunk that names the place or product
      // asked about is found even when the embedding ranks it low.
      const { data: matches, error: matchError } = await service.rpc("match_chunks_hybrid", {
        p_project_id: project.id,
        p_query_embedding: embedding,
        p_query_text: keywordQuery(query),
        p_match_count: MATCH_COUNT,
      });
      if (matchError) throw new Error(`match_chunks_hybrid: ${matchError.message}`);

      const chunks = relevantChunks((matches ?? []) as MatchedChunk[]);
      if (chunks.length === 0) {
        reply = NO_ANSWER;
        followUps = ["How can I contact support?", "What are your business hours?"];
      } else {
        const sourceIds = [...new Set(chunks.map((c) => c.source_id))];
        const { data: sourcesData } = await service
          .from("knowledge_sources")
          .select("title")
          .in("id", sourceIds);
        const titles = (sourcesData ?? []).map((s) => s.title).filter(Boolean);
        if (titles.length > 0) sources = titles;

        const raw = await generateAnswer(buildSystemPrompt(about), buildPrompt(chunks, message, query), {
          onGeneration: traced("answer_question"),
        });
        if (!raw) {
          reply = NO_ANSWER;
          sources = undefined;
          followUps = ["How can I contact support?", "What are your business hours?"];
        } else {
          const parsed = parseAnswerAndFollowUps(raw);
          reply = parsed.reply || NO_ANSWER;
          if (reply.includes(NO_ANSWER)) {
            reply = NO_ANSWER;
            sources = undefined;
            followUps = ["How can I contact support?", "What are your business hours?"];
          } else {
            followUps = parsed.followUps.length > 0 ? parsed.followUps : undefined;
          }
        }
      }
    }
  } catch (error) {
    // Log why, so a "temporarily unavailable" reply can be traced in the runtime logs.
    const cause = error instanceof AiUnavailableError && error.cause instanceof Error ? error.cause : error;
    console.error("[chat] failed:", cause instanceof Error ? cause.message : cause);
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

  track({
    distinctId: visitorId,
    event: "widget_message",
    anonymous: true,
    properties: {
      project_id: project.id,
      plan,
      kind,
      answered: reply !== NO_ANSWER && kind !== "off_topic" && kind !== "smalltalk",
      is_new_conversation: !conversationId,
    },
  });

  const body: ChatResponse = {
    conversationId: savedId as string,
    reply,
    ...(sources && sources.length > 0 ? { sources } : {}),
    ...(followUps && followUps.length > 0 ? { followUps } : {}),
  };
  return NextResponse.json(body, { headers: CORS });
}

// The last few messages of this conversation, oldest first, so a short follow-up
// like "what about Japan?" can be understood.
async function loadHistory(service: ReturnType<typeof createServiceClient>, conversationId: string): Promise<Turn[]> {
  const { data, error } = await service
    .from("messages")
    .select("role, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(4);
  if (error || !data) return [];
  return (data as Turn[]).reverse();
}
