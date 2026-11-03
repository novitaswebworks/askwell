import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { apiError, isUuid } from "@/lib/api";
import { getThread } from "@/lib/conversations";
import { createOwnerClient } from "@/lib/supabase/owner";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Conversation not found.");

  try {
    const thread = await getThread(createOwnerClient(), id);
    if (!thread) return apiError("not_found", "Conversation not found.");
    return NextResponse.json(thread);
  } catch {
    return apiError("internal", "Could not load the conversation.");
  }
}

// Delete one conversation and its messages. Leads captured in it stay (their link to the
// conversation is cleared), because the owner may still need to follow them up.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Conversation not found.");

  // Owner client: RLS hides other owners' conversations, so this is the ownership check.
  const { data: conversation, error } = await createOwnerClient()
    .from("conversations")
    .select("id, project_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return apiError("internal", "Could not delete the conversation.");
  if (!conversation) return apiError("not_found", "Conversation not found.");

  // Messages go with it (on delete cascade).
  const { error: deleteError } = await createServiceClient().from("conversations").delete().eq("id", conversation.id);
  if (deleteError) return apiError("internal", "Could not delete the conversation.");
  track({ distinctId: userId, event: "conversation_deleted" });
  return NextResponse.json({ ok: true, projectId: conversation.project_id });
}
