import { auth } from "@clerk/nextjs/server";
import { apiError, isUuid } from "@/lib/api";
import { exportRows } from "@/lib/conversations";
import { toCsv } from "@/lib/csv";
import { createOwnerClient } from "@/lib/supabase/owner";

// The project's conversations as a spreadsheet file, one row per message. Owner client
// throughout: RLS means another owner's project simply has nothing to export.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  const owner = createOwnerClient();
  const { data: project, error } = await owner.from("projects").select("id, name").eq("id", id).maybeSingle();
  if (error) return apiError("internal", "Could not export conversations.");
  if (!project) return apiError("not_found", "Project not found.");

  const search = new URL(req.url).searchParams;
  let rows;
  try {
    rows = await exportRows(owner, id, { q: search.get("q") ?? undefined, unhelpful: search.get("filter") === "unhelpful" });
  } catch {
    return apiError("internal", "Could not export conversations.");
  }

  const csv = toCsv(
    ["Conversation", "Started (UTC)", "Who", "Message", "Rating", "Sent (UTC)"],
    rows.map((r) => [r.conversationId, r.startedAt, r.role, r.message, r.rating, r.sentAt]),
  );
  const slug = String(project.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="conversations-${slug}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
