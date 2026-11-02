import { APP_NAME, PLAN_LIMITS, PRO_PRICE_INR } from "@askwell/shared";

export const LEGAL_UPDATED = "2 November 2026";

export interface Section {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

export interface LegalDoc {
  slug: "terms" | "privacy" | "refunds";
  title: string;
  description: string;
  intro: string;
  sections: Section[];
}

const PRO = `${PLAN_LIMITS.pro.maxProjects} projects, ${PLAN_LIMITS.pro.messagesPerMonth.toLocaleString("en-IN")} messages a month per project and ${PLAN_LIMITS.pro.maxKnowledgeSources} knowledge sources per project`;

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of service",
  description: `The rules for using ${APP_NAME}.`,
  intro: `These terms are an agreement between you and ${APP_NAME}. By creating an account or using the chat widget you accept them. If you do not agree, please do not use ${APP_NAME}.`,
  sections: [
    {
      heading: "What Askwell is",
      paragraphs: [
        `${APP_NAME} lets a business add an AI chat assistant to its website. The business (the "owner") adds its own information, and the assistant answers visitors' questions from it.`,
      ],
    },
    {
      heading: "Your account",
      list: [
        "You must give accurate details and keep your sign-in secure. You are responsible for what happens under your account.",
        "You must be old enough to enter a contract where you live, or use the service for a business that is.",
      ],
    },
    {
      heading: "Your content and your visitors",
      list: [
        "You keep ownership of the text and files you add. You allow us to store and process them to run your assistant.",
        "You promise you have the right to use what you add, and that it is not unlawful, infringing, or misleading.",
        "You are responsible for telling your website's visitors that they are chatting with an AI assistant and that their messages are processed. Our Privacy page explains what we do with them.",
      ],
    },
    {
      heading: "Using the assistant",
      paragraphs: [
        "The assistant is built to answer only from the information you give it, but AI can still be wrong or incomplete. Check the answers it gives your visitors, keep your information up to date, and do not rely on it for legal, medical or financial advice.",
      ],
      list: [
        "Do not use the service to break the law, harass people, send spam, spread malware, or collect people's sensitive data.",
        "Do not try to break, overload, probe or reverse engineer the service, or get around its limits.",
        "We may block abusive traffic and messages to protect the service.",
      ],
    },
    {
      heading: "Plans, limits and payment",
      list: [
        `Free: ${PLAN_LIMITS.free.maxProjects} project, ${PLAN_LIMITS.free.messagesPerMonth} messages a month and ${PLAN_LIMITS.free.maxKnowledgeSources} knowledge sources. No card needed.`,
        `Pro: ₹${PRO_PRICE_INR} a month, with ${PRO}.`,
        "A message is one question from a visitor. The count resets at the start of each month.",
        "Pro is billed monthly in Indian rupees through Cashfree. We never see or store your card, UPI or bank details.",
        "Prices and limits can change. We will tell you before a change affects what you pay.",
        "Cancelling and refunds are described on the Cancellation and refunds page.",
      ],
    },
    {
      heading: "Availability",
      paragraphs: [
        "We work to keep the service running, but we do not promise it will always be available or error free. We may change or remove features, and we will try to give notice of big changes.",
      ],
    },
    {
      heading: "Ending your use",
      paragraphs: [
        "You can stop using the service and cancel Pro at any time. We may suspend or close an account that breaks these terms or puts the service or other people at risk. You can ask us to delete your account and its data (see Privacy).",
      ],
    },
    {
      heading: "Limits on our responsibility",
      paragraphs: [
        `The service is provided "as is". To the extent the law allows, ${APP_NAME} is not liable for indirect or consequential losses, lost profits, or what the assistant tells your visitors. Our total liability for any claim is limited to what you paid us in the 3 months before it.`,
      ],
    },
    {
      heading: "Changes and law",
      paragraphs: [
        "We may update these terms. The date at the top shows the latest version, and using the service after a change means you accept it. These terms are governed by the laws of India, and the courts of India have jurisdiction.",
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy policy",
  description: `What ${APP_NAME} collects, why, and who helps us handle it.`,
  intro: `This explains what ${APP_NAME} collects, why, and the choices you have. It covers owners who sign up and visitors who use a chat widget on an owner's website.`,
  sections: [
    {
      heading: "What we collect",
      list: [
        "Owners: your sign-in details (email and name, handled by our sign-in provider), the projects, knowledge text and files you add, your widget settings, and your plan.",
        "Visitors: the messages typed into the chat, the assistant's replies, and a random visitor ID kept in the browser so a conversation continues. We do not ask visitors to sign in.",
        "Technical data: the website a widget loaded on and when, your IP address (for rate limiting and abuse protection), and basic usage events such as pages opened and buttons clicked. Usage events never include the text of chat messages.",
      ],
    },
    {
      heading: "Why we use it",
      list: [
        "To run the service: answer visitors' questions, show owners their conversations, and apply plan limits.",
        "To keep it safe: block spam, abuse and attempts to manipulate the assistant.",
        "To understand and improve the product, using usage events.",
        "To take payments and keep billing records.",
      ],
    },
    {
      heading: "Who handles it for us",
      paragraphs: ["We use these providers to run the service. They process data only to provide their part of it."],
      list: [
        "Clerk: owner sign-in and accounts.",
        "Supabase: our database and file storage.",
        "Vercel: hosting.",
        "Groq and other AI model providers: when a visitor sends a message, the message, recent messages in that chat, and the matching passages from the owner's information are sent to an AI model to write the reply. A separate server of ours turns text into search vectors.",
        "Cashfree: Pro payments. Card, UPI and bank details go to Cashfree, never to us.",
        "Arcjet: rate limiting and abuse detection.",
        "PostHog: product usage analytics.",
      ],
    },
    {
      heading: "Owners and visitors",
      paragraphs: [
        "For a chat on an owner's website, the owner decides what the assistant knows and is responsible for telling their visitors about the chat. Owners can read the conversations on their own projects. We do not sell personal data.",
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "We keep owner data and conversations while the account is active. Deleting a knowledge source removes its stored text pieces. You can ask us to delete your account, projects and conversations, and we will do so unless the law requires us to keep something, such as billing records.",
      ],
    },
    {
      heading: "Your choices",
      paragraphs: [
        "You can ask to see, correct, export or delete your personal data, or ask a question about this policy, through the Contact page. Visitors can ask the website owner too.",
      ],
    },
    {
      heading: "Security and changes",
      paragraphs: [
        "Data is sent over encrypted connections, each owner's data is separated from others', and secrets are kept on the server. No system is perfectly secure. We may update this policy and will change the date above when we do.",
      ],
    },
  ],
};

export const REFUNDS: LegalDoc = {
  slug: "refunds",
  title: "Cancellation and refunds",
  description: `How to cancel ${APP_NAME} Pro and how refunds work.`,
  intro: `Free is free. This page is about the Pro plan, ₹${PRO_PRICE_INR} a month.`,
  sections: [
    {
      heading: "Cancelling",
      list: [
        "You can cancel Pro at any time from Billing in the dashboard.",
        "Cancelling stops future charges. Your account returns to the Free plan straight away, with Free limits. Your account and data stay, and the widget goes back to the standard look.",
        "You can also stop the monthly payment from your UPI app or your bank.",
      ],
    },
    {
      heading: "Refunds",
      list: [
        "The month you have already paid for is not refunded when you cancel.",
        "If you were charged by mistake, charged twice, or charged after cancelling, contact us and we will check and refund what you should not have paid.",
        "Refunds go back to the payment method you used, and the time they take depends on your bank or payment provider.",
      ],
    },
    {
      heading: "How payments work",
      paragraphs: [
        "Pro is billed every month in Indian rupees through Cashfree. Customers outside India can pay with an international Visa or Mastercard and are charged in rupees at their card issuer's exchange rate.",
      ],
    },
    {
      heading: "Problems with a payment",
      paragraphs: ["If a payment fails or something looks wrong, use the Contact page and include the email on your account."],
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [TERMS, PRIVACY, REFUNDS];

// Where people write to us. Set NEXT_PUBLIC_CONTACT_EMAIL to show an address on the Contact page.
export function contactEmail(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}
