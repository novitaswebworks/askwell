import Link from "next/link";
import { APP_NAME } from "@askwell/shared";

// A speech bubble with a check: an answer you can rely on.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path
        d="M9 10.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3v-3H9A1.5 1.5 0 0 1 7.5 19v-7A1.5 1.5 0 0 1 9 10.5Z"
        fill="var(--brand-foreground)"
      />
      <path d="M12.5 15.6l2.2 2.2 4.3-4.3" stroke="var(--brand)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight">
      <LogoMark />
      {APP_NAME}
    </Link>
  );
}
