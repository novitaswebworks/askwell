import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlanLimits, saveAnswersSchema } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { track } from "@/lib/analytics";
import { apiError, isUuid, readJson } from "@/lib/api";
import { ANSWERS_TITLE, answersToText } from "@/lib/answers";
import { processSource } from "@/lib/knowledge/process";
import { limitMessage, processingMessage, toSource, type SourceRow } from "@/lib/knowledge/sources";
import { getOwnedProject } from "@/lib/owned-project";
import { createServiceClient } from "@/lib/supabase/service";

// Embedding can wait on a cold model.
export const maxDuration = 300;

// Saves the guided builder's answers as the project's one "Business answers"
// source: created the first time, replaced after that, so it uses one source slot.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  const parsed = saveAnswersSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError("invalid_input", "Answer at least one question (each answer up to 2,000 characters, about 90,000 in total).");

  const project = await getOwnedProject(id);
  if (!project) return apiError("not_found", "Project not found.");

  const service = createServiceClient();
  const { data: existing, error: findError } = await service
    .from("knowledge_sources")
    .select("id")
    .eq("project_id", project.id)
    .not("answers", "is", null)
    .limit(1)
    .maybeSingle();
  if (findError) return apiError("internal", "Could not save your answers.");

  const plan = await getAccountPlan(userId);
  let row: SourceRow & { project_id: string };
  if (existing) {
    // Old sections go first; the new ones are embedded below.
    const { error: clearError } = await service.from("knowledge_chunks").delete().eq("source_id", existing.id);
    if (clearError) return apiError("internal", "Could not save your answers.");
    const { data, error } = await service
      .from("knowledge_sources")
      .update({ status: "processing", answers: parsed.data })
      .eq("id", existing.id)
      .select("id, title, type, status, created_at, project_id")
      .single();
    if (error) return apiError("internal", "Could not save your answers.");
    row = data as SourceRow & { project_id: string };
  } else {
    const { data, error } = await service.rpc("reserve_knowledge_source", {
      p_project_id: project.id,
      p_title: ANSWERS_TITLE,
      p_type: "text",
      p_storage_key: null,
      p_status: "processing",
      p_max_sources: getPlanLimits(plan).maxKnowledgeSources,
    });
    if (error) {
      if (error.code === "P0001") return apiError("limit_reached", limitMessage(plan));
      return apiError("internal", "Could not save your answers.");
    }
    row = data as SourceRow & { project_id: string };
    const { error: saveError } = await service.from("knowledge_sources").update({ answers: parsed.data }).eq("id", row.id);
    if (saveError) {
      await service.from("knowledge_sources").delete().eq("id", row.id);
      return apiError("internal", "Could not save your answers.");
    }
  }

  try {
    await processSource({ id: row.id, projectId: project.id }, answersToText(parsed.data.items), service);
  } catch (e) {
    return apiError("internal", processingMessage(e));
  }
  track({
    distinctId: userId,
    event: "answers_saved",
    properties: { template: parsed.data.template, answers: parsed.data.items.length, plan },
  });
  return NextResponse.json(toSource({ ...row, status: "ready" } satisfies SourceRow));
}
