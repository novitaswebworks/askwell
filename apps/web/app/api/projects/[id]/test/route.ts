import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { testAnswerRequestSchema } from "@askwell/shared";
import { AiUnavailableError } from "@/lib/ai/errors";
import { apiError, isUuid, readJson } from "@/lib/api";
import { UNAVAILABLE_MESSAGE } from "@/lib/chat";
import { protectRate } from "@/lib/protect";
import { createOwnerClient } from "@/lib/supabase/owner";
import { answerForOwner } from "@/lib/test-answer";

// Embedding on a cold Ollama model can take a while.
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

// The owner tries a question and sees how it was answered. Nothing is saved and no message
// is counted, so it is limited per owner instead.
export async function POST(req: Request, { params }: Context) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  const parsed = testAnswerRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError("invalid_input", "Enter a question of up to 1,000 characters.");

  // Owner client: RLS only returns the project when the signed-in user owns it.
  const { data: project, error } = await createOwnerClient().from("projects").select("id, about").eq("id", id).maybeSingle();
  if (error) return apiError("internal", UNAVAILABLE_MESSAGE);
  if (!project) return apiError("not_found", "Project not found.");

  if (!(await protectRate(req, userId, "test", 10, false))) {
    return apiError("rate_limited", "You are testing a bit too fast. Wait a moment and try again.");
  }

  try {
    return NextResponse.json(await answerForOwner({ id: project.id as string, about: project.about as string | null }, parsed.data.message));
  } catch (e) {
    const cause = e instanceof AiUnavailableError && e.cause instanceof Error ? e.cause : e;
    console.error("[test-answer] failed:", cause instanceof Error ? cause.message : cause);
    return apiError("internal", UNAVAILABLE_MESSAGE);
  }
}
