import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthShell, clerkAppearance } from "@/components/site/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell>
      <Suspense>
        <SignIn appearance={clerkAppearance} fallbackRedirectUrl="/dashboard" />
      </Suspense>
    </AuthShell>
  );
}
