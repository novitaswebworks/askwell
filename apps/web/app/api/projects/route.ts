import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createProjectSchema, getPlanLimits } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { apiError, readJson } from "@/lib/api";
import { PROJECT_COLUMNS, toProject, type ProjectRow } from "@/lib/projects";
import { generatePublicKey } from "@/lib/public-key";
import { createOwnerClient } from "@/lib/supabase/owner";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  // Owner client: RLS returns only this owner's projects.
  const { data, error } = await createOwnerClient()
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) return apiError("internal", "Could not load projects.");
  return NextResponse.json((data as ProjectRow[]).map(toProject));
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const parsed = createProjectSchema.safeParse(await readJson(req));
  if (!parsed.success) return apiError("invalid_input", "Enter a project name (1 to 100 characters).");

  // The plan is read here, on the server. The limit is enforced in the database
  // function, which locks the account row so two requests cannot both pass.
  const plan = await getAccountPlan(userId);
  const { maxProjects } = getPlanLimits(plan);
  const service = createServiceClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await service.rpc("create_project", {
      p_owner_id: userId,
      p_name: parsed.data.name,
      p_public_key: generatePublicKey(),
      p_max_projects: maxProjects,
    });
    if (!error) return NextResponse.json(toProject(data as ProjectRow), { status: 201 });
    if (error.code === "P0001") {
      return apiError(
        "limit_reached",
        plan === "free"
          ? "The Free plan includes 1 project. Upgrade to Pro for up to 5."
          : "You have reached the project limit for your plan.",
      );
    }
    if (error.code !== "23505") break; // only a public_key collision is worth retrying
  }
  return apiError("internal", "Could not create the project.");
}
