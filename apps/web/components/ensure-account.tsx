import { auth } from "@clerk/nextjs/server";
import { ensureAccount } from "@/lib/accounts";

// Creates the accounts row on first sign-in. Renders nothing.
export async function EnsureAccount() {
  const { userId } = await auth();
  if (userId) await ensureAccount(userId);
  return null;
}
