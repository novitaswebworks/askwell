import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "./logo";

// Clerk's form, dressed in the site's dark palette so sign-in does not feel like
// a different product.
export const clerkAppearance = {
  variables: {
    colorPrimary: "#d97757",
    colorPrimaryForeground: "#141413",
    colorBackground: "#262624",
    colorForeground: "#faf9f5",
    colorMutedForeground: "#a8a69d",
    colorMuted: "#30302e",
    colorInput: "#30302e",
    colorInputForeground: "#faf9f5",
    colorNeutral: "#faf9f5",
    colorBorder: "#3d3d3a",
    colorDanger: "#ff6b6b",
    colorRing: "#d97757",
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
