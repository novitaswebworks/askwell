import "server-only";
import { planSchema, type Plan } from "@askwell/shared";
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

// The server decides the plan (project.md section 5). Never trust the client.
export async function getAccountPlan(
  clerkUserId: string,
  client: AccountsClient = createServiceClient(),
): Promise<Plan> {
  await ensureAccount(clerkUserId, client);
  const { data, error } = await client
    .from("accounts")
    .select("plan")
    .eq("clerk_user_id", clerkUserId)
    .single();
  if (error) throw new Error(`Could not read plan: ${error.message}`);
  return planSchema.parse(data.plan);
}
