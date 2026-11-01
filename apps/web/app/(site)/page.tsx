import { APP_NAME, PLAN_LIMITS } from "@askwell/shared";
import { AuthControls } from "@/components/auth-controls";
import { ButtonLink } from "@/components/button-link";

const STEPS = [
  { title: "Add your info", text: "Paste text or upload a PDF with your product details." },
  { title: "Copy one line", text: "Paste a single script tag into your website." },
  { title: "Get answers", text: "Visitors chat with a bot that answers from your info." },
];

const SNIPPET = `<script src="https://your-app-url/widget.js" data-key="pk_your_key"></script>`;

function PlanCard({
  name,
  price,
  plan,
  highlight,
}: {
  name: string;
  price: string;
  plan: keyof typeof PLAN_LIMITS;
  highlight?: boolean;
}) {
  const l = PLAN_LIMITS[plan];
  const rows = [
    `${l.maxProjects} project${l.maxProjects > 1 ? "s" : ""}`,
    `${l.messagesPerMonth.toLocaleString("en-US")} messages / month per project`,
    `${l.maxKnowledgeSources} knowledge sources per project`,
    l.canCustomize ? "Custom color, position, label, animation, header" : "Default widget look",
    l.canCustomize ? "No “Powered by” badge" : "“Powered by” badge shown",
  ];
  return (
    <div className={`glass flex flex-col gap-4 p-6 ${highlight ? "bg-glass-strong" : ""}`}>
      <div>
        <h3 className="text-lg font-medium">{name}</h3>
        <p className="text-sm text-muted">{price}</p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((r) => (
          <li key={r} className="text-muted">
            <span className="mr-2 text-foreground">✓</span>
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  return (
    <div className="theme-dark flex flex-1 flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between p-4 md:px-8">
        <span className="text-lg font-semibold">{APP_NAME}</span>
        <nav className="flex items-center gap-3 text-sm">
          <a href="#pricing" className="hidden text-muted hover:text-foreground sm:inline">
            Pricing
          </a>
          <AuthControls />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 md:px-8">
        <section className="rise flex flex-col items-center gap-6 py-20 text-center md:py-32">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            A support chatbot that knows your product.
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Add your info, copy one script tag, and your visitors get instant answers from it.
          </p>
          <ButtonLink href="/sign-up">Start free</ButtonLink>
        </section>

        <section className="py-12" aria-labelledby="how">
          <h2 id="how" className="mb-8 text-center text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="glass rise p-6" style={{ animationDelay: `${i * 100}ms` }}>
                <span className="text-sm text-muted">Step {i + 1}</span>
                <h3 className="mt-1 text-lg font-medium">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="py-12" aria-labelledby="demo">
          <h2 id="demo" className="mb-8 text-center text-2xl font-semibold tracking-tight">
            See it in action
          </h2>
          <div className="glass mx-auto flex max-w-md flex-col gap-3 p-5 text-sm">
            <p className="self-end rounded-2xl bg-glass-strong px-4 py-2">What does {APP_NAME} do?</p>
            <p className="self-start rounded-2xl bg-glass px-4 py-2 text-muted">
              It answers your visitors’ questions using the info you give it.
            </p>
            <p className="text-center text-xs text-muted">Preview. The live chat arrives soon.</p>
          </div>
        </section>

        <section id="pricing" className="py-12" aria-labelledby="pricing-title">
          <h2 id="pricing-title" className="mb-8 text-center text-2xl font-semibold tracking-tight">
            Pricing
          </h2>
          <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
            <PlanCard name="Free" price="$0" plan="free" />
            <PlanCard name="Pro" price="Price announced at launch" plan="pro" highlight />
          </div>
        </section>

        <section className="py-12" aria-labelledby="install">
          <h2 id="install" className="mb-8 text-center text-2xl font-semibold tracking-tight">
            Install in one line
          </h2>
          <pre className="glass mx-auto max-w-3xl overflow-x-auto p-5 font-mono text-xs md:text-sm">
            <code>{SNIPPET}</code>
          </pre>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl border-t border-border p-6 text-center text-sm text-muted md:px-8">
        © {APP_NAME}
      </footer>
    </div>
  );
}
