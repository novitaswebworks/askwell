import "server-only";
import type { TestAnswerResponse } from "@askwell/shared";
import { generateAnswer } from "@/lib/ai/groq";
import { embedTexts } from "@/lib/ai/ollama";
import { understandMessage } from "@/lib/ai/understand";
import {
  buildPrompt,
  buildSystemPrompt,
  HUMAN_QUERY,
  MATCH_COUNT,
  MIN_SIMILARITY,
  NO_ANSWER,
  OFF_TOPIC_REPLY,
  parseAnswerAndFollowUps,
  SMALLTALK_REPLIES,
  type MatchedChunk,
} from "@/lib/chat";
import { keywordQuery } from "@/lib/search-terms";
import { createServiceClient } from "@/lib/supabase/service";

const EXCERPT_CHARS = 280;

// Answers one question the way the widget would, but saves nothing, counts no message and
// shows what it found. Only call it after the route has checked the owner owns the project.
// shortcut: mirrors the steps in the chat route; extract one shared function when a third caller appears.
export async function answerForOwner(
  project: { id: string; about: string | null },
  message: string,
): Promise<TestAnswerResponse> {
  const ms = { understand: 0, search: 0, answer: 0 };
  const about = project.about ?? "";

  let t = Date.now();
  const understanding = await understandMessage(about, [], message);
  ms.understand = Date.now() - t;

  const base = { chunks: [], followUps: [] as string[], ms };
  if (understanding.type === "smalltalk") {
    return { kind: "smalltalk", reply: SMALLTALK_REPLIES[understanding.smalltalk], understoodAs: null, ...base };
  }
  if (understanding.type === "off_topic") {
    return { kind: "off_topic", reply: OFF_TOPIC_REPLY, understoodAs: null, ...base };
  }

  const query = understanding.type === "human" ? HUMAN_QUERY : understanding.standalone;
  const service = createServiceClient();
  t = Date.now();
  const [embedding] = await embedTexts([query], "query");
  const { data, error } = await service.rpc("match_chunks_hybrid", {
    p_project_id: project.id,
    p_query_embedding: embedding,
    p_query_text: keywordQuery(query),
    p_match_count: MATCH_COUNT,
  });
  if (error) throw new Error(`match_chunks_hybrid: ${error.message}`);
  ms.search = Date.now() - t;

  const matched = (data ?? []) as MatchedChunk[];
  const used = matched.filter((c) => c.similarity >= MIN_SIMILARITY);
  const ids = [...new Set(matched.map((c) => c.source_id))];
  const { data: sources } = ids.length > 0 ? await service.from("knowledge_sources").select("id, title").in("id", ids) : { data: [] };
  const titles = new Map((sources ?? []).map((s) => [s.id as string, (s.title as string) || "Untitled"]));
  const chunks = matched.map((c) => ({
    title: titles.get(c.source_id) ?? "Unknown source",
    similarity: Math.round(c.similarity * 100) / 100,
    used: c.similarity >= MIN_SIMILARITY,
    excerpt: c.content.slice(0, EXCERPT_CHARS),
  }));

  if (used.length === 0) {
    return { kind: understanding.type, reply: NO_ANSWER, understoodAs: query, chunks, followUps: [], ms };
  }

  t = Date.now();
  const raw = await generateAnswer(buildSystemPrompt(about), buildPrompt(used, message, query));
  ms.answer = Date.now() - t;
  const parsed = raw ? parseAnswerAndFollowUps(raw) : { reply: "", followUps: [] as string[] };
  return {
    kind: understanding.type,
    reply: parsed.reply || NO_ANSWER,
    understoodAs: query,
    chunks,
    followUps: parsed.followUps,
    ms,
  };
}
