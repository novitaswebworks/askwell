import Link from "next/link";
import type { ComponentProps } from "react";

const styles = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  brand: "bg-brand text-brand-foreground font-semibold hover:scale-[1.03] active:scale-[0.98]",
  ghost: "glass hover:bg-glass-strong",
} as const;

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof styles }) {
  return (
    <Link
      className={`inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
