import type { ConversationSummary, ConversationThread, Message } from "@askwell/shared";

// Reads for the Conversations page and its API routes. They take the owner's
// client, so RLS decides which conversations exist for the caller.

export const CONVERSATION_PAGE_SIZE = 50;
const PREVIEW_MAX = 140;

type Reader = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

interface ConversationRow {
  id: string;
  project_id: string;
  created_at: string;
}
interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  body: string;
  rating?: number | null;
  created_at: string;
}

export function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_MAX ? `${flat.slice(0, PREVIEW_MAX - 1).trimEnd()}…` : flat;
}

// First visitor message and message count per conversation. Messages must be
// oldest first.
export function summarize(conversations: ConversationRow[], messages: MessageRow[]): ConversationSummary[] {
  const byConversation = new Map<string, MessageRow[]>();
  for (const m of messages) {
    const list = byConversation.get(m.conversation_id) ?? [];
    list.push(m);
    byConversation.set(m.conversation_id, list);
  }
  return conversations.map((c) => {
    const list = byConversation.get(c.id) ?? [];
    const first = list.find((m) => m.role === "visitor") ?? list[0];
    return {
      id: c.id,
      firstMessage: first ? preview(first.body) : "",
      messageCount: list.length,
      helpful: list.filter((m) => m.rating === 1).length,
      notHelpful: list.filter((m) => m.rating === -1).length,
      createdAt: c.created_at,
    };
  });
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    role: row.role === "bot" ? "bot" : "visitor",
    body: row.body,
    rating: row.rating === 1 || row.rating === -1 ? row.rating : null,
    createdAt: row.created_at,
  };
}

export interface ConversationFilter {
  q?: string; // text a visitor or the assistant wrote
  unhelpful?: boolean; // only chats where a visitor pressed thumbs down
}

export const MAX_SEARCH_TERM = 100;
const MAX_MATCHED_CONVERSATIONS = 200;

// ilike treats % and _ as wildcards; a search for "50%" should find "50%".
export function likePattern(term: string): string {
  return `%${term.trim().slice(0, MAX_SEARCH_TERM).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Which conversations in the project match the filter, or null when there is no filter.
async function matchingConversationIds(client: Reader, projectId: string, filter: ConversationFilter): Promise<string[] | null> {
  const term = filter.q?.trim();
  if (!term && !filter.unhelpful) return null;
  let query = client
    .from("messages")
    .select("conversation_id, conversations!inner(project_id)")
    .eq("conversations.project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(MAX_MATCHED_CONVERSATIONS * 5);
  if (term) query = query.ilike("body", likePattern(term));
  if (filter.unhelpful) query = query.eq("rating", -1);
  const { data, error } = await query;
  if (error) throw new Error(`Could not search conversations: ${error.message}`);
  return [...new Set(((data ?? []) as { conversation_id: string }[]).map((m) => m.conversation_id))].slice(0, MAX_MATCHED_CONVERSATIONS);
}

// The project's newest conversations, newest first, optionally only those matching a search.
export async function listConversations(
  client: Reader,
  projectId: string,
  limit = CONVERSATION_PAGE_SIZE,
  filter: ConversationFilter = {},
): Promise<ConversationSummary[]> {
  const ids = await matchingConversationIds(client, projectId, filter);
  if (ids && ids.length === 0) return [];
  let query = client
    .from("conversations")
    .select("id, project_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (ids) query = query.in("id", ids);
  const { data: conversations, error } = await query;
  if (error) throw new Error(`Could not load conversations: ${error.message}`);
  const rows = (conversations ?? []) as ConversationRow[];
  if (rows.length === 0) return [];

  const { data: messages, error: messagesError } = await client
    .from("messages")
    .select("id, conversation_id, role, body, rating, created_at")
    .in("conversation_id", rows.map((c) => c.id))
    .order("created_at", { ascending: true });
  if (messagesError) throw new Error(`Could not load messages: ${messagesError.message}`);
  return summarize(rows, (messages ?? []) as MessageRow[]);
}

export const MAX_EXPORT_CONVERSATIONS = 500;

export interface ExportRow {
  conversationId: string;
  startedAt: string;
  role: "visitor" | "assistant";
  message: string;
  rating: "helpful" | "not helpful" | "";
  sentAt: string;
}

// Every message of the matching conversations (newest conversations first, up to a cap), one row each.
export async function exportRows(client: Reader, projectId: string, filter: ConversationFilter = {}): Promise<ExportRow[]> {
  const ids = await matchingConversationIds(client, projectId, filter);
  if (ids && ids.length === 0) return [];
  let query = client
    .from("conversations")
    .select("id, project_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(MAX_EXPORT_CONVERSATIONS);
  if (ids) query = query.in("id", ids);
  const { data: conversations, error } = await query;
  if (error) throw new Error(`Could not load conversations: ${error.message}`);
  const rows = (conversations ?? []) as ConversationRow[];
  if (rows.length === 0) return [];
  const { data: messages, error: messagesError } = await client
    .from("messages")
    .select("id, conversation_id, role, body, rating, created_at")
    .in("conversation_id", rows.map((c) => c.id))
    .order("created_at", { ascending: true });
  if (messagesError) throw new Error(`Could not load messages: ${messagesError.message}`);
  const started = new Map(rows.map((c) => [c.id, c.created_at]));
  const order = new Map(rows.map((c, i) => [c.id, i]));
  return ((messages ?? []) as MessageRow[])
    .sort((a, b) => (order.get(a.conversation_id) ?? 0) - (order.get(b.conversation_id) ?? 0) || a.created_at.localeCompare(b.created_at))
    .map((m) => ({
      conversationId: m.conversation_id,
      startedAt: started.get(m.conversation_id) ?? "",
      role: m.role === "bot" ? "assistant" : "visitor",
      message: m.body,
      rating: m.rating === 1 ? "helpful" : m.rating === -1 ? "not helpful" : "",
      sentAt: m.created_at,
    }));
}

// One conversation with every message, or null when it does not exist or is not
// the caller's.
export async function getThread(client: Reader, conversationId: string): Promise<ConversationThread | null> {
  const { data: conversation, error } = await client
    .from("conversations")
    .select("id, project_id, created_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the conversation: ${error.message}`);
  if (!conversation) return null;

  const { data: messages, error: messagesError } = await client
    .from("messages")
    .select("id, conversation_id, role, body, rating, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (messagesError) throw new Error(`Could not load messages: ${messagesError.message}`);
  const row = conversation as ConversationRow;
  return {
    id: row.id,
    projectId: row.project_id,
    createdAt: row.created_at,
    messages: ((messages ?? []) as MessageRow[]).map(toMessage),
  };
}
