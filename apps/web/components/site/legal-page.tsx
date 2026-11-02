import Link from "next/link";
import { LEGAL_UPDATED, type LegalDoc } from "@/lib/legal";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 py-14 md:px-8 md:py-20">{children}</article>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
      <p className="mt-6 leading-relaxed">{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.heading} className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">{s.heading}</h2>
          {s.paragraphs?.map((p) => (
            <p key={p} className="mt-3 leading-relaxed text-muted">
              {p}
            </p>
          ))}
          {s.list && (
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted">
              {s.list.map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="mt-12 text-sm text-muted">
        Questions? <Link href="/contact" className="underline hover:text-foreground">Contact us</Link>.
      </p>
    </PageShell>
  );
}
