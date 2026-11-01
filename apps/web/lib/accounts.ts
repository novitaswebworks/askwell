import "server-only";
import { createServiceClient } from "./supabase/service";

type AccountsClient = Pick<ReturnType<typeof createServiceClient>, "from">;

// Creates the accounts row (plan free) the first time a Clerk user is seen.
// An existing row is left untouched, so a Pro plan is never reset.
export async function ensureAccount(
  clerkUserId: string,
  client: AccountsClient = createServiceClient(),
) {
  const { error } = await client
    .from("accounts")
    .upsert({ clerk_user_id: clerkUserId }, { onConflict: "clerk_user_id", ignoreDuplicates: true });
  if (error) throw new Error(`Could not create account: ${error.message}`);
}
