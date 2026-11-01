import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { knowledgeFinalizeSchema, MAX_KNOWLEDGE_FILE_BYTES } from "@askwell/shared";
import { apiError, isUuid, readJson } from "@/lib/api";
import { KNOWLEDGE_BUCKET, type KnowledgeFileType } from "@/lib/knowledge/files";
import { extractText, looksLikePdf } from "@/lib/knowledge/extract";
import { processSource } from "@/lib/knowledge/process";
import { processingMessage, toSource } from "@/lib/knowledge/sources";
import { getOwnedProject } from "@/lib/owned-project";
import { createServiceClient } from "@/lib/supabase/service";

// Embedding can wait on a cold model.
export const maxDuration = 300;

// Step 3 of an upload: claim the source once, check the real file, process it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  const parsed = knowledgeFinalizeSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError("invalid_input", "Missing source.");

  const project = await getOwnedProject(id);
  if (!project) return apiError("not_found", "Project not found.");

  const service = createServiceClient();

  // Claim: only one request can move the source from uploading to processing.
  const { data: claimed, error: claimError } = await service
    .from("knowledge_sources")
    .update({ status: "processing" })
    .eq("id", parsed.data.sourceId)
    .eq("project_id", project.id)
    .eq("status", "uploading")
    .select("id, title, type, status, created_at, storage_key")
    .maybeSingle();
  if (claimError) return apiError("internal", "Could not process the file.");
  if (!claimed) return apiError("not_found", "That upload was not found or is already processing.");

  const storageKey = claimed.storage_key as string | null;
  const type = claimed.type as KnowledgeFileType;
  const refuse = async (message: string) => {
    if (storageKey) await service.storage.from(KNOWLEDGE_BUCKET).remove([storageKey]);
    await service.from("knowledge_sources").delete().eq("id", claimed.id);
    return apiError("invalid_input", message);
  };

  if (!storageKey) return refuse("That source has no file.");

  const { data: file, error: downloadError } = await service.storage.from(KNOWLEDGE_BUCKET).download(storageKey);
  if (downloadError || !file) {
    // The file never arrived. Put the reservation back so the upload can be retried.
    await service.from("knowledge_sources").update({ status: "uploading" }).eq("id", claimed.id);
    return apiError("invalid_input", "The file has not finished uploading.");
  }

  // Real size and content, not what the browser declared.
  if (file.size === 0 || file.size > MAX_KNOWLEDGE_FILE_BYTES) {
    return refuse("The file must be between 1 byte and 10 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (type === "pdf" && !looksLikePdf(bytes)) return refuse("That file is not a valid PDF.");

  try {
    await processSource({ id: claimed.id, projectId: project.id }, await extractText(type, bytes), service);
  } catch (e) {
    return apiError("internal", processingMessage(e));
  }
  return NextResponse.json(toSource({ ...claimed, status: "ready" }));
}
