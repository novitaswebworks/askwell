import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { apiError, isUuid } from "@/lib/api";
import { getThread } from "@/lib/conversations";
import { createOwnerClient } from "@/lib/supabase/owner";

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
