import { APP_NAME } from "@askwell/shared";
import Link from "next/link";
import { Suspense } from "react";
import { AuthControls } from "@/components/auth-controls";
import { DashboardNav } from "@/components/dashboard-nav";
import { EnsureAccount } from "@/components/ensure-account";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:flex-row md:p-8">
      <Suspense>
        <EnsureAccount />
      </Suspense>
      <aside className="glass flex flex-col gap-4 p-4 md:w-56 md:self-start">
        <Link href="/dashboard" className="px-2 text-lg font-semibold">
          {APP_NAME}
        </Link>
        <Suspense>
          <DashboardNav />
        </Suspense>
        <div className="flex items-center gap-3 px-2 md:mt-4">
          <AuthControls />
        </div>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
