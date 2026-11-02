import { APP_NAME, PLAN_LIMITS, PRO_PRICE_INR } from "@askwell/shared";
import { FAQ_ITEMS } from "./faq";
import { HOME_DESCRIPTION } from "./site";

// Structured data for the home page. Everything here is also visible on the page.
export function buildJsonLd(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: APP_NAME,
        url: `${baseUrl}/`,
        logo: `${baseUrl}/icon`,
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        name: APP_NAME,
        url: `${baseUrl}/`,
        publisher: { "@id": `${baseUrl}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${baseUrl}/#software`,
        name: APP_NAME,
        description: HOME_DESCRIPTION,
        url: `${baseUrl}/`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        publisher: { "@id": `${baseUrl}/#organization` },
        offers: [
          {
            "@type": "Offer",
            name: "Free",
            price: "0",
            priceCurrency: "INR",
            description: `${PLAN_LIMITS.free.maxProjects} project, ${PLAN_LIMITS.free.messagesPerMonth} messages a month, ${PLAN_LIMITS.free.maxKnowledgeSources} knowledge sources`,
          },
          {
            "@type": "Offer",
            name: "Pro",
            price: String(PRO_PRICE_INR),
            priceCurrency: "INR",
            description: `Up to ${PLAN_LIMITS.pro.maxProjects} projects, ${PLAN_LIMITS.pro.messagesPerMonth} messages a month per project, ${PLAN_LIMITS.pro.maxKnowledgeSources} knowledge sources per project`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((i) => ({
          "@type": "Question",
          name: i.q,
          acceptedAnswer: { "@type": "Answer", text: i.a },
        })),
      },
    ],
  };
}

// JSON inside a script tag: "<" is escaped so no text can close the tag early.
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
