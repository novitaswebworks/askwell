import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { apiError, isUuid } from "@/lib/api";
import { listConversations } from "@/lib/conversations";
import { createOwnerClient } from "@/lib/supabase/owner";

// Owner client throughout: RLS shows only this owner's projects and conversations,
// so another owner's project simply has none.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  const owner = createOwnerClient();
  const { data: project, error } = await owner.from("projects").select("id").eq("id", id).maybeSingle();
  if (error) return apiError("internal", "Could not load conversations.");
  if (!project) return apiError("not_found", "Project not found.");

  try {
    return NextResponse.json(await listConversations(owner, id));
  } catch {
    return apiError("internal", "Could not load conversations.");
  }
}
