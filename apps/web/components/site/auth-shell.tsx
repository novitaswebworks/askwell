import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "./logo";

// Clerk's form, dressed in the site's dark palette so sign-in does not feel like
// a different product.
export const clerkAppearance = {
  variables: {
    colorPrimary: "#ff7a45",
    colorBackground: "#111111",
    colorText: "#f5f5f4",
    colorTextSecondary: "#9a9a94",
    colorInputBackground: "#1a1a1a",
    colorInputText: "#f5f5f4",
    colorTextOnPrimaryBackground: "#1a0a02",
    colorNeutral: "#f5f5f4",
    borderRadius: "0.75rem",
  },
} as const;

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="theme-dark hero-glow flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <Logo />
        <Link href="/" className="text-sm text-muted transition-colors hover:text-foreground">
          Back to home
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">{children}</div>
    </div>
  );
}
