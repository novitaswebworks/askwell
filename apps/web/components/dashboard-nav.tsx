"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const DASHBOARD_LINKS = [
  { href: "/dashboard", label: "Projects" },
  { href: "/dashboard/knowledge", label: "Knowledge" },
  { href: "/dashboard/install", label: "Install" },
  { href: "/dashboard/conversations", label: "Conversations" },
  { href: "/dashboard/customize", label: "Customize" },
  { href: "/dashboard/billing", label: "Billing" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto md:flex-col">
      {DASHBOARD_LINKS.map(({ href, label }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors md:rounded-xl ${
              active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-glass-strong"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
