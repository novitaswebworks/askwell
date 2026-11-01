import { APP_NAME } from "@askwell/shared";
import Link from "next/link";
import { Suspense } from "react";
import { Show, UserButton } from "@clerk/nextjs";
import { DashboardNav } from "@/components/dashboard-nav";
import { EnsureAccount } from "@/components/ensure-account";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:flex-row md:p-8">
      <EnsureAccount />
      <aside className="glass flex flex-col gap-4 p-4 md:w-56 md:self-start">
        <Link href="/dashboard" className="px-2 text-lg font-semibold">
          {APP_NAME}
        </Link>
        <Suspense>
          <DashboardNav />
        </Suspense>
        <div className="flex items-center justify-between gap-3 px-2 md:mt-4">
          <Suspense>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </Suspense>
          <Link href="/" className="text-sm text-muted transition-colors hover:text-foreground">
            Home
          </Link>
        </div>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
