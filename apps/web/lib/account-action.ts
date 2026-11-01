"use server";

import { auth } from "@clerk/nextjs/server";
import { ensureAccount } from "./accounts";

// Server action: creates the accounts row for the signed-in user (project.md 6.2).
// Called from the client, so no database write happens while a page renders.
export async function ensureAccountAction() {
  const { userId } = await auth();
  if (userId) await ensureAccount(userId);
}
