import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { REFUNDS } from "@/lib/legal";

export const metadata: Metadata = {
  title: REFUNDS.title,
  description: REFUNDS.description,
  alternates: { canonical: "/refunds" },
};

export default function Page() {
  return <LegalPage doc={REFUNDS} />;
}
