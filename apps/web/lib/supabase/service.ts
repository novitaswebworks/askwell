import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, requireEnv } from "./env";

// Acts as service_role and skips RLS. Server only. Call it only after the
// route has checked ownership and plan (project.md section 9).
export function createServiceClient() {
  const { url } = getSupabasePublicEnv();
  return createClient(url, requireEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
