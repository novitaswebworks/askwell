import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { apiError, isUuid } from "@/lib/api";
import { KNOWLEDGE_BUCKET } from "@/lib/knowledge/files";
import { createOwnerClient } from "@/lib/supabase/owner";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Source not found.");

  // Owner client: RLS hides sources in other people's projects, so this is the ownership check.
  const { data: source, error } = await createOwnerClient()
    .from("knowledge_sources")
    .select("id, storage_key")
    .eq("id", id)
    .maybeSingle();
  if (error) return apiError("internal", "Could not delete the source.");
  if (!source) return apiError("not_found", "Source not found.");

  const service = createServiceClient();
  if (source.storage_key) {
    const removed = await service.storage.from(KNOWLEDGE_BUCKET).remove([source.storage_key as string]);
    if (removed.error) return apiError("internal", "Could not delete the source.");
  }
  // Chunks go with the source (on delete cascade).
  const { error: deleteError } = await service.from("knowledge_sources").delete().eq("id", source.id);
  if (deleteError) return apiError("internal", "Could not delete the source.");
  track({ distinctId: userId, event: "knowledge_source_deleted" });
  return NextResponse.json({ ok: true });
}
