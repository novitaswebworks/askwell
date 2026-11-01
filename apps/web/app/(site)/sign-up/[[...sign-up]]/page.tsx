import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthShell, clerkAppearance } from "@/components/site/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell>
      <Suspense>
        <SignUp appearance={clerkAppearance} fallbackRedirectUrl="/dashboard" />
      </Suspense>
    </AuthShell>
  );
}
