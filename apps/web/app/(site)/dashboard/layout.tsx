import { APP_NAME } from "@askwell/shared";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Suspense } from "react";
import { Show, UserButton } from "@clerk/nextjs";
import { DashboardNav } from "@/components/dashboard-nav";
import { EnsureAccount } from "@/components/ensure-account";
import { PostHogIdentify } from "@/components/posthog-identify";
import { LogoMark } from "@/components/site/logo";
import { getAccountPlan } from "@/lib/accounts";

async function SidebarPlanBadge() {
  const { userId } = await auth();
  if (!userId) return null;
  const plan = await getAccountPlan(userId);
  const isPro = plan === "pro";
  return (
    <Link
      href="/dashboard/billing"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
        isPro
          ? "border border-border bg-foreground/5 text-foreground"
          : "border border-brand/20 bg-brand/10 text-brand hover:bg-brand/20"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isPro ? "bg-emerald-500" : "bg-brand"}`} />
      <span>{isPro ? "Pro Plan" : "Free Plan"}</span>
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:flex-row md:p-8">
      <EnsureAccount />
      <PostHogIdentify />
      <aside className="glass flex flex-col gap-5 p-4 md:sticky md:top-8 md:w-60 md:self-start md:p-5">
        <div className="flex items-center justify-between gap-2 px-1">
          <Link href="/dashboard" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <LogoMark size={24} />
            <span>{APP_NAME}</span>
          </Link>
          <Suspense fallback={<div className="h-5 w-16 animate-pulse rounded-full bg-border" />}>
            <SidebarPlanBadge />
          </Suspense>
        </div>

        <div className="h-px bg-border/60" />

        <Suspense>
          <DashboardNav />
        </Suspense>

        <div className="mt-auto hidden border-t border-border/60 pt-4 md:flex md:flex-col md:gap-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2.5">
              <Suspense>
                <Show when="signed-in">
                  <UserButton />
                </Show>
              </Suspense>
              <span className="text-xs font-medium text-muted">Account</span>
            </div>
            <Link
              href="/"
              className="text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              Home &rarr;
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3 md:hidden">
          <Suspense>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </Suspense>
          <Link href="/" className="text-sm text-muted transition-colors hover:text-foreground">
            Home &rarr;
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
