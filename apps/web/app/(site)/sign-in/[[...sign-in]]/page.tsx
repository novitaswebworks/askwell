import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthShell, clerkAppearance } from "@/components/site/auth-shell";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <AuthShell>
      <Suspense>
        <SignIn appearance={clerkAppearance} fallbackRedirectUrl="/dashboard" />
      </Suspense>
    </AuthShell>
  );
}
