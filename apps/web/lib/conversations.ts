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

// The project's newest conversations, newest first.
export async function listConversations(
  client: Reader,
  projectId: string,
  limit = CONVERSATION_PAGE_SIZE,
): Promise<ConversationSummary[]> {
  const { data: conversations, error } = await client
    .from("conversations")
    .select("id, project_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
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
