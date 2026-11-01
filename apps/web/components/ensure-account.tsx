"use client";

import { useEffect } from "react";
import { ensureAccountAction } from "@/lib/account-action";

// Creates the accounts row on first sign-in. Renders nothing. A failure here is
// harmless: every action that needs the account (getAccountPlan) creates it too.
export function EnsureAccount() {
  useEffect(() => {
    ensureAccountAction().catch(() => {});
  }, []);
  return null;
}
