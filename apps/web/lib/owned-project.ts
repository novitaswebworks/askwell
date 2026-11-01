import "server-only";
import { createOwnerClient } from "@/lib/supabase/owner";

// Owner client: RLS only returns the project when the signed-in user owns it.
// Routes call this before any service-client write (project.md section 9).
export async function getOwnedProject(projectId: string): Promise<{ id: string } | null> {
  const { data, error } = await createOwnerClient()
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Could not load project: ${error.message}`);
  return data as { id: string } | null;
}
