import Link from "next/link";
import { APP_NAME } from "@askwell/shared";
import { Logo } from "./logo";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Cancellation & refunds" },
  { href: "/contact", label: "Contact" },
  { href: "/sign-in", label: "Sign in" },
  { href: "/sign-up", label: "Sign up" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-4 py-10 md:flex-row md:items-center md:px-8">
        <Logo />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted">© {APP_NAME}</p>
      </div>
      <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-sm text-muted md:px-8">
        Developed by{" "}
        <a
          href="https://novitasweb.works"
          target="_blank"
          rel="noopener"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Novitas WebWorks
        </a>
      </p>
    </footer>
  );
}
