"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Chat,
  Code,
  CreditCard,
  Document,
  Grid,
  Sliders,
  Users,
} from "@/components/site/icons";

export const DASHBOARD_LINKS = [
  { href: "/dashboard", label: "Projects", icon: Grid },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: Document },
  { href: "/dashboard/install", label: "Install", icon: Code },
  { href: "/dashboard/conversations", label: "Conversations", icon: Chat },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/customize", label: "Customize", icon: Sliders },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1.5 overflow-x-auto py-1 md:flex-col md:py-0">
      {DASHBOARD_LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-all md:rounded-xl md:px-3 md:py-2.5 ${
              active
                ? "bg-foreground text-background shadow-xs font-semibold"
                : "text-muted hover:text-foreground hover:bg-glass-strong"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 transition-transform ${
                active ? "opacity-100" : "opacity-70 group-hover:opacity-100 group-hover:scale-105"
              }`}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
