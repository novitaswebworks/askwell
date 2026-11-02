import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { Lead } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { apiError, isUuid } from "@/lib/api";
import { leadsToCsv } from "@/lib/leads";
import { createOwnerClient } from "@/lib/supabase/owner";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  // Pro feature: read the plan on the server.
  const plan = await getAccountPlan(userId);
  if (plan !== "pro") {
    return apiError("plan_required", "Upgrade to Pro to view and export leads.");
  }

  const owner = createOwnerClient();
  const { data: project, error: projError } = await owner
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (projError) return apiError("internal", "Could not load leads.");
  if (!project) return apiError("not_found", "Project not found.");

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const format = searchParams.get("format");

  let query = owner
    .from("leads")
    .select("id, project_id, conversation_id, email, name, phone, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return apiError("internal", "Could not load leads.");

  const leads: Lead[] = (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    conversationId: row.conversation_id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    createdAt: row.created_at,
  }));

  if (format === "csv") {
    const csv = leadsToCsv(leads);
    const safeProjectName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${safeProjectName}.csv"`,
      },
    });
  }

  return NextResponse.json(leads);
}
