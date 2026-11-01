import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { addTextKnowledgeSchema, getPlanLimits } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { apiError, isUuid, readJson } from "@/lib/api";
import { processSource } from "@/lib/knowledge/process";
import { limitMessage, processingMessage, toSource, type SourceRow } from "@/lib/knowledge/sources";
import { getOwnedProject } from "@/lib/owned-project";
import { createServiceClient } from "@/lib/supabase/service";

// Embedding can wait on a cold model.
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  const parsed = addTextKnowledgeSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError("invalid_input", "Enter a title and some text (up to 200,000 characters).");

  const project = await getOwnedProject(id);
  if (!project) return apiError("not_found", "Project not found.");

  const plan = await getAccountPlan(userId);
  const service = createServiceClient();
  const { data, error } = await service.rpc("reserve_knowledge_source", {
    p_project_id: project.id,
    p_title: parsed.data.title,
    p_type: "text",
    p_storage_key: null,
    p_status: "processing",
    p_max_sources: getPlanLimits(plan).maxKnowledgeSources,
  });
  if (error) {
    if (error.code === "P0001") return apiError("limit_reached", limitMessage(plan));
    return apiError("internal", "Could not add the source.");
  }

  const row = data as SourceRow & { project_id: string };
  try {
    await processSource({ id: row.id, projectId: project.id }, parsed.data.text, service);
  } catch (e) {
    return apiError("internal", processingMessage(e));
  }
  return NextResponse.json(toSource({ ...row, status: "ready" } satisfies SourceRow), { status: 201 });
}
