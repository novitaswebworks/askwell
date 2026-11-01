import Link from "next/link";
import { APP_NAME, PLAN_LIMITS } from "@askwell/shared";
import { ButtonLink } from "@/components/button-link";
import { Faq } from "@/components/site/faq";
import { HeroChat } from "@/components/site/hero-chat";
import { ArrowRight, Chat, Check, Code, Document, Globe, Shield } from "@/components/site/icons";
import { Logo } from "@/components/site/logo";
import { SiteHeader } from "@/components/site/site-header";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://askwell.novitasweb.works").replace(/\/$/, "");
const SNIPPET = `<script src="${APP_URL}/widget.js" data-key="pk_your_key"></script>`;

const STEPS = [
  {
    icon: Document,
    title: "Teach it what you know",
    text: "Paste text or upload a PDF, Markdown or text file. Add a line about your business so it knows what is on topic.",
  },
  {
    icon: Code,
    title: "Paste one line on your site",
    text: "Copy a single script tag into your page. A chat button appears in the corner. No build step, no server.",
  },
  {
    icon: Chat,
    title: "Visitors get real answers",
    text: "They ask in their own words and get a short, friendly reply drawn from your content, in seconds.",
  },
];

function PlanCard({
  name,
  price,
  note,
  plan,
  cta,
  featured,
}: {
  name: string;
  price: string;
  note: string;
  plan: keyof typeof PLAN_LIMITS;
  cta: string;
  featured?: boolean;
}) {
  const l = PLAN_LIMITS[plan];
  const rows = [
    `${l.maxProjects} project${l.maxProjects > 1 ? "s" : ""}`,
    `${l.messagesPerMonth.toLocaleString("en-US")} messages a month per project`,
    `${l.maxKnowledgeSources} knowledge sources per project`,
    l.canCustomize ? "Your colour, position, label and animation" : "Standard widget look",
    l.canCustomize ? "No “Powered by” badge" : "“Powered by” badge shown",
  ];
  return (
    <div
      className={`flex flex-col gap-6 rounded-3xl border p-8 ${
        featured ? "border-brand/60 bg-brand/[0.06] shadow-[0_0_80px_-30px_var(--brand)]" : "border-border bg-glass"
      }`}
    >
      <div>
        <h3 className="text-xl font-semibold">{name}</h3>
        <p className="mt-3 text-4xl font-semibold tracking-tight">{price}</p>
        <p className="mt-1 text-sm text-muted">{note}</p>
      </div>
      <ul className="flex flex-col gap-3 text-sm">
        {rows.map((r) => (
          <li key={r} className="flex items-start gap-3">
            <Check className={`mt-0.5 size-4 shrink-0 ${featured ? "text-brand" : "text-muted"}`} />
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <ButtonLink href="/sign-up" variant={featured ? "brand" : "ghost"} className="mt-auto">
        {cta}
      </ButtonLink>
    </div>
  );
}

export default function Home() {
  return (
    <div className="theme-dark flex flex-1 flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1">
        <section className="hero-glow relative overflow-hidden">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-20 pt-16 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pb-32 lg:pt-24">
            <div className="rise">
              <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.03em] md:text-7xl">
                Your content, answering your customers.
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted md:text-xl">
                {APP_NAME} turns your own pages and documents into a chat assistant that replies in seconds, stays on
                topic, and says so when it doesn’t know.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <ButtonLink href="/sign-up" variant="brand" className="h-12 gap-2 px-7 text-base">
                  Start free <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href="/#how" variant="ghost" className="h-12 px-7 text-base">
                  See how it works
                </ButtonLink>
              </div>
              <p className="mt-6 text-sm text-muted">Free plan. No card needed. Live in a few minutes.</p>
            </div>
            <div className="rise" style={{ animationDelay: "150ms" }}>
              <HeroChat />
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl px-4 py-24 md:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                Live in the time it takes to make coffee.
              </h2>
              <p className="mt-5 max-w-md text-lg text-muted">
                No developers, no training runs, no dashboards to learn. Three steps, and the third is automatic.
              </p>
            </div>
            <ol className="flex flex-col">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative flex gap-6 pb-12 last:pb-0">
                  {i < STEPS.length - 1 && <span className="absolute left-6 top-14 h-[calc(100%-3.5rem)] w-px bg-border" aria-hidden="true" />}
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border bg-glass-strong text-brand">
                    <s.icon className="size-6" />
                  </span>
                  <div className="pt-1">
                    <h3 className="text-xl font-semibold">{s.title}</h3>
                    <p className="mt-2 max-w-lg text-muted leading-relaxed">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8">
          <h2 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Helpful, and never out of its depth.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-6">
            <article className="rounded-3xl border border-border bg-glass p-8 md:col-span-4">
              <Shield className="size-7 text-brand" />
              <h3 className="mt-5 text-2xl font-semibold">Stays on topic</h3>
              <p className="mt-3 max-w-xl text-muted leading-relaxed">
                Ask it about the football, a poem or its own instructions and it politely steers back to your business. It
                greets people, handles thanks, and tells them how to reach you when they want a human.
              </p>
            </article>
            <article className="rounded-3xl border border-border bg-glass p-8 md:col-span-2">
              <Globe className="size-7 text-brand" />
              <h3 className="mt-5 text-2xl font-semibold">Any language</h3>
              <p className="mt-3 text-muted leading-relaxed">
                Visitors write in theirs. Answers come back in it, even from English content.
              </p>
            </article>
            <article className="rounded-3xl border border-border bg-glass p-8 md:col-span-2">
              <Check className="size-7 text-brand" />
              <h3 className="mt-5 text-2xl font-semibold">Honest about gaps</h3>
              <p className="mt-3 text-muted leading-relaxed">
                If your content doesn’t say, it doesn’t guess. It points people to your contact details.
              </p>
            </article>
            <article className="overflow-hidden rounded-3xl border border-border bg-glass p-8 md:col-span-4">
              <Code className="size-7 text-brand" />
              <h3 className="mt-5 text-2xl font-semibold">One line to install</h3>
              <pre className="mt-5 overflow-x-auto rounded-2xl border border-border bg-black/60 p-5 font-mono text-xs leading-relaxed text-foreground/90 md:text-sm">
                <code>{SNIPPET}</code>
              </pre>
            </article>
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-6xl px-4 py-24 md:px-8">
          <h2 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Start free. Grow when you need to.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <PlanCard name="Free" price="$0" note="For trying it on your site" plan="free" cta="Start free" />
            <PlanCard name="Pro" price="Coming soon" note="Pricing announced at launch" plan="pro" cta="Get started" featured />
          </div>
        </section>

        <section id="faq" className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
            <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">Questions, answered.</h2>
            <Faq />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-24 md:px-8">
          <div className="hero-glow relative overflow-hidden rounded-[2rem] border border-border px-8 py-16 text-center md:py-24">
            <h2 className="mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
              Let your content do the answering.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-lg text-muted">
              Set it up today, and your next visitor gets an answer instead of a contact form.
            </p>
            <div className="mt-9 flex justify-center">
              <ButtonLink href="/sign-up" variant="brand" className="h-12 gap-2 px-8 text-base">
                Start free <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-4 py-10 md:flex-row md:items-center md:px-8">
          <Logo />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <Link href="/#how" className="hover:text-foreground">How it works</Link>
            <Link href="/#pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/#faq" className="hover:text-foreground">FAQ</Link>
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
            <Link href="/sign-up" className="hover:text-foreground">Sign up</Link>
          </nav>
          <p className="text-sm text-muted">© {APP_NAME}</p>
        </div>
      </footer>
    </div>
  );
}
