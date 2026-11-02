import "server-only";
import { NO_ANSWER_VARIANTS } from "@/lib/chat";
import { normalizeQuestion } from "@/lib/answers";
import { createOwnerClient } from "@/lib/supabase/owner";

export interface Unanswered {
  question: string;
  count: number;
}

interface BotRow {
  conversation_id: string;
  created_at: string;
}
interface VisitorRow extends BotRow {
  body: string;
}

const MAX_BOT_ROWS = 100;
const MAX_SHOWN = 10;

// The bot says NO_ANSWER word for word when the knowledge does not cover a
// question. Pair each of those replies with the visitor message just before it,
// group repeats, and leave out anything the owner has already answered.
export function pairUnanswered(bots: BotRow[], visitors: VisitorRow[], answered: string[]): Unanswered[] {
  const have = new Set(answered.map(normalizeQuestion));
  const groups = new Map<string, Unanswered>();
  for (const bot of bots) {
    let best: VisitorRow | undefined;
    for (const v of visitors) {
      if (v.conversation_id !== bot.conversation_id || v.created_at >= bot.created_at) continue;
      if (!best || v.created_at > best.created_at) best = v;
    }
    const question = best?.body.trim();
    if (!question) continue;
    const key = normalizeQuestion(question);
    if (!key || have.has(key)) continue;
    const found = groups.get(key);
    if (found) found.count += 1;
    else groups.set(key, { question, count: 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, MAX_SHOWN);
}

// Owner client: RLS limits both reads to the signed-in owner's own conversations.
export async function loadUnanswered(projectId: string, answered: string[]): Promise<Unanswered[]> {
  const owner = createOwnerClient();
  const { data: bots, error } = await owner
    .from("messages")
    .select("conversation_id, created_at, conversations!inner(project_id)")
    .eq("role", "bot")
    .in("body", NO_ANSWER_VARIANTS)
    .eq("conversations.project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(MAX_BOT_ROWS);
  if (error) throw new Error(`Could not load unanswered questions: ${error.message}`);
  if (!bots || bots.length === 0) return [];

  const ids = [...new Set(bots.map((b) => b.conversation_id))];
  const { data: visitors, error: visitorError } = await owner
    .from("messages")
    .select("conversation_id, created_at, body")
    .eq("role", "visitor")
    .in("conversation_id", ids);
  if (visitorError) throw new Error(`Could not load unanswered questions: ${visitorError.message}`);

  return pairUnanswered(
    bots.map((b) => ({ conversation_id: b.conversation_id, created_at: b.created_at })),
    visitors ?? [],
    answered,
  );
}
