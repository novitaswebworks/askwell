import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlanLimits, knowledgeUploadUrlRequestSchema } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { apiError, isUuid, readJson } from "@/lib/api";
import { extensionMatchesType, KNOWLEDGE_BUCKET, newStorageKey } from "@/lib/knowledge/files";
import { limitMessage, type SourceRow } from "@/lib/knowledge/sources";
import { getOwnedProject } from "@/lib/owned-project";
import { createServiceClient } from "@/lib/supabase/service";

// Step 1 of an upload: reserve the source (it counts toward the limit) and hand
// back a one-time signed URL. The file goes straight from the browser to Storage.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  const parsed = knowledgeUploadUrlRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError("invalid_input", "Choose a PDF, Markdown or text file up to 10 MB.");
  const { title, filename, type } = parsed.data;
  if (!extensionMatchesType(filename, type)) {
    return apiError("invalid_input", "The file name does not match its type.");
  }

  const project = await getOwnedProject(id);
  if (!project) return apiError("not_found", "Project not found.");

  const plan = await getAccountPlan(userId);
  const service = createServiceClient();
  const storageKey = newStorageKey(project.id, type);

  const { data, error } = await service.rpc("reserve_knowledge_source", {
    p_project_id: project.id,
    p_title: title,
    p_type: type,
    p_storage_key: storageKey,
    p_status: "uploading",
    p_max_sources: getPlanLimits(plan).maxKnowledgeSources,
  });
  if (error) {
    if (error.code === "P0001") return apiError("limit_reached", limitMessage(plan));
    return apiError("internal", "Could not start the upload.");
  }
  const source = data as SourceRow;

  const signed = await service.storage.from(KNOWLEDGE_BUCKET).createSignedUploadUrl(storageKey);
  if (signed.error || !signed.data) {
    await service.from("knowledge_sources").delete().eq("id", source.id);
    return apiError("internal", "Could not start the upload.");
  }

  return NextResponse.json({ sourceId: source.id, uploadUrl: signed.data.signedUrl });
}
