import type { Metadata } from "next";
import { APP_NAME } from "@askwell/shared";
import { PageShell } from "@/components/site/legal-page";
import { contactEmail } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contact",
  description: `How to reach the ${APP_NAME} team.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const email = contactEmail();
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Contact</h1>
      <p className="mt-6 leading-relaxed text-muted">
        Questions about {APP_NAME}, a payment, or your data? Here is how to reach us.
      </p>
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Ask the assistant</h2>
        <p className="mt-3 leading-relaxed text-muted">
          The chat button in the corner of our home page is {APP_NAME} itself. It can answer questions about plans, setup
          and billing right away.
        </p>
      </section>
      {email && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Email</h2>
          <p className="mt-3 leading-relaxed text-muted">
            <a href={`mailto:${email}`} className="underline hover:text-foreground">
              {email}
            </a>
            . For payment questions, write from the email on your account and include the date and amount.
          </p>
        </section>
      )}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Your data</h2>
        <p className="mt-3 leading-relaxed text-muted">
          To see, correct, export or delete your personal data or your account, contact us and say which one you need.
        </p>
      </section>
    </PageShell>
  );
}
