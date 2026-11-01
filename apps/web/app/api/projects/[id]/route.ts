import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { updateProjectSchema } from "@askwell/shared";
import { apiError, isUuid, readJson } from "@/lib/api";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { createOwnerClient } from "@/lib/supabase/owner";

type Context = { params: Promise<{ id: string }> };

// Rename, describe and delete go through the owner client: RLS and column grants decide
// who may change a row, so another owner's project simply is not found.
export async function PATCH(req: Request, { params }: Context) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");
  const parsed = updateProjectSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return apiError("invalid_input", "Enter a project name (1 to 100 characters) or a description (up to 600).");
  }

  // Only the columns the owner may change (name, about); RLS limits the row.
  const changes: { name?: string; about?: string } = {};
  if (parsed.data.name !== undefined) changes.name = parsed.data.name;
  if (parsed.data.about !== undefined) changes.about = parsed.data.about;

  const { data, error } = await createOwnerClient()
    .from("projects")
    .update(changes)
    .eq("id", id)
    .select(PROJECT_COLUMNS)
    .maybeSingle();
  if (error) return apiError("internal", "Could not update the project.");
  if (!data) return apiError("not_found", "Project not found.");
  return NextResponse.json(toProject(data as ProjectRow));
}

export async function DELETE(_req: Request, { params }: Context) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  const { data, error } = await createOwnerClient()
    .from("projects")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return apiError("internal", "Could not delete the project.");
  if (!data) return apiError("not_found", "Project not found.");
  return new NextResponse(null, { status: 204 });
}
