// The guided "answer common questions" builder: question lists by kind of business,
// the text we index from the answers, and the AI interview prompt. Plain functions
// so the wording is tested and lives in one place.
import { MAX_ANSWER_ITEMS, type SaveAnswersInput } from "@askwell/shared";

export const ANSWERS_TITLE = "Business answers";

export interface Prompt {
  question: string;
  hint: string;
}

export interface Template {
  id: string;
  label: string;
  prompts: Prompt[];
}

const COMMON: Prompt[] = [
  { question: "What does your business do?", hint: "One or two sentences, as you would tell a new customer." },
  { question: "What are your opening hours?", hint: "Include days, holidays and time zone if it matters." },
  { question: "How can customers contact you?", hint: "Phone, email, WhatsApp, address, social media." },
];

export const TEMPLATES: Template[] = [
  {
    id: "shop",
    label: "Online shop",
    prompts: [
      ...COMMON,
      { question: "Where do you deliver and how long does it take?", hint: "Countries or cities, delivery times, courier." },
      { question: "How much does delivery cost?", hint: "Free over a certain amount? Flat rate?" },
      { question: "What is your return and refund policy?", hint: "How many days, what condition, who pays shipping." },
      { question: "Which payment methods do you accept?", hint: "Cards, UPI, cash on delivery, bank transfer." },
      { question: "How can a customer track an order or get help with one?", hint: "Where to find the order number, who to contact." },
    ],
  },
  {
    id: "services",
    label: "Services or agency",
    prompts: [
      ...COMMON,
      { question: "Which services do you offer?", hint: "List each one with a short description." },
      { question: "How much do your services cost?", hint: "Prices, packages or how you quote." },
      { question: "How does a customer book or get started?", hint: "The steps, and how long until the first reply." },
      { question: "Which areas or countries do you serve?", hint: "Or say you work online worldwide." },
      { question: "What is your cancellation or refund policy?", hint: "Notice needed, fees, refunds." },
    ],
  },
  {
    id: "food",
    label: "Restaurant or cafe",
    prompts: [
      ...COMMON,
      { question: "Where are you located and how do I get there?", hint: "Address, landmarks, parking." },
      { question: "How do I book a table?", hint: "Phone, website, walk-in only, group rules." },
      { question: "Do you offer vegetarian, vegan or gluten-free food?", hint: "And how you handle allergies." },
      { question: "Do you deliver or take orders for pick-up?", hint: "Apps, areas, minimum order." },
      { question: "What are your most popular dishes and typical prices?", hint: "A few examples are enough." },
    ],
  },
  {
    id: "education",
    label: "Courses or school",
    prompts: [
      ...COMMON,
      { question: "Which courses or classes do you offer?", hint: "Names, level, who they are for." },
      { question: "When do the next batches start?", hint: "Dates, duration, class timings." },
      { question: "How much are the fees and how can I pay?", hint: "Installments, discounts, scholarships." },
      { question: "How do I enrol or apply?", hint: "Steps, documents, deadlines." },
      { question: "What is your refund or transfer policy?", hint: "Until when, how much." },
    ],
  },
  {
    id: "software",
    label: "Software or app",
    prompts: [
      ...COMMON,
      { question: "What does your product do and who is it for?", hint: "The main problem it solves." },
      { question: "How much does it cost?", hint: "Plans, free trial, billing period." },
      { question: "How do I get started or sign up?", hint: "The first steps for a new user." },
      { question: "Which devices, browsers or tools does it work with?", hint: "Integrations, system requirements." },
      { question: "How do I get support or report a problem?", hint: "Where to write, usual reply time." },
      { question: "How is my data kept private and secure?", hint: "In plain words." },
    ],
  },
  {
    id: "other",
    label: "Something else",
    prompts: [
      ...COMMON,
      { question: "What are your prices?", hint: "Or how you quote." },
      { question: "How does a customer get started?", hint: "The steps, step by step." },
      { question: "What is your refund or cancellation policy?", hint: "Plain and short." },
    ],
  },
];

export function getTemplate(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[TEMPLATES.length - 1]!;
}

export interface Item {
  question: string;
  answer: string;
}

export interface SavedAnswers {
  template: string;
  items: Item[];
}

// For matching a visitor's wording against a saved question.
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// What we index: one short block per answered question, so a visitor's question
// finds the matching block.
export function answersToText(items: Item[]): string {
  return items
    .filter((i) => i.question.trim() && i.answer.trim())
    .map((i) => `Question: ${i.question.trim()}\nAnswer: ${i.answer.trim()}`)
    .join("\n\n");
}

// Rows read back from the database are not trusted to have our shape.
export function parseSavedAnswers(value: unknown): SavedAnswers | null {
  if (!value || typeof value !== "object") return null;
  const { template, items } = value as { template?: unknown; items?: unknown };
  if (typeof template !== "string" || !Array.isArray(items)) return null;
  const clean: Item[] = [];
  for (const raw of items.slice(0, MAX_ANSWER_ITEMS)) {
    const { question, answer } = (raw ?? {}) as { question?: unknown; answer?: unknown };
    if (typeof question === "string" && typeof answer === "string" && question.trim() && answer.trim()) {
      clean.push({ question, answer });
    }
  }
  return { template, items: clean };
}

// The form rows for a kind of business: every saved item first, then the
// template's questions that are not already there (left blank).
export function rowsFor(templateId: string, saved: Item[]): Item[] {
  const have = new Set(saved.map((i) => normalizeQuestion(i.question)));
  const extra = getTemplate(templateId)
    .prompts.filter((p) => !have.has(normalizeQuestion(p.question)))
    .map((p) => ({ question: p.question, answer: "" }));
  return [...saved, ...extra];
}

export function toSaveInput(templateId: string, rows: Item[]): SaveAnswersInput | null {
  const items = rows
    .map((r) => ({ question: r.question.trim(), answer: r.answer.trim() }))
    .filter((r) => r.question && r.answer);
  if (items.length === 0) return null;
  return { template: templateId, items: items.slice(0, MAX_ANSWER_ITEMS) };
}

// A prompt for any AI chat tool: it interviews the owner, then writes a document
// that can be pasted into "Paste text".
export function buildInterviewPrompt(): string {
  return [
    "I run a business and I want to teach a website chat assistant (Askwell) to answer my customers' questions. Please interview me, then write the document the assistant will learn from. I am not technical. Use plain language and be friendly.",
    "",
    "How to interview me:",
    "1. Start by asking what my business is and who my customers are.",
    "2. Then ask one question at a time. Cover: what I sell or offer, prices, opening hours, location, how to contact me, how customers order or book, delivery or service areas, refunds and cancellations, payment methods, and the questions customers ask me most often.",
    "3. If an answer is vague, ask a short follow-up. If I say I do not know or it does not apply, move on.",
    "4. After about 15 questions, ask if there is anything else customers often ask. Stop when I say I am done.",
    "",
    "When I am done, write one document with these rules:",
    "- Plain text with short headings, one topic per section (for example: Prices, Opening hours, Delivery, Refunds).",
    "- Only facts I told you. Never invent prices, hours or policies. If something was not covered, leave it out.",
    "- Complete sentences that name the business, so each section makes sense on its own.",
    "- Add a final section called Frequently asked questions, written as a question followed by its answer.",
    "",
    "Do not ask for passwords, payment details or private customer information.",
  ].join("\n");
}
