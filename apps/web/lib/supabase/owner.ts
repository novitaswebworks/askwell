import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

// Acts as the signed-in owner: Supabase receives their Clerk session token,
// so RLS reads the user ID from auth.jwt()->>'sub'. Use for every owner read.
export function createOwnerClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createClient(url, publishableKey, {
    accessToken: async () => (await auth()).getToken(),
  });
}
