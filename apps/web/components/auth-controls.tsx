import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";

const ghost =
  "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-foreground/80 transition-colors hover:bg-glass-strong hover:text-foreground";
const primary =
  "inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]";

// Plain links, not Clerk's buttons: they are visible, keyboard friendly, and sign
// people in on our own pages, which send them on to the dashboard.
export function AuthControls() {
  return (
    <Suspense fallback={<span className="h-10 w-40" aria-hidden="true" />}>
      <Show when="signed-out">
        <Link href="/sign-in" className={ghost}>
          Sign in
        </Link>
        <Link href="/sign-up" className={primary}>
          Get started
        </Link>
      </Show>
      <Show when="signed-in">
        <Link href="/dashboard" className={primary}>
          Dashboard
        </Link>
        <UserButton />
      </Show>
    </Suspense>
  );
}
