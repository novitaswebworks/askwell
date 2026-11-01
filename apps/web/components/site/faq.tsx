import { Plus } from "./icons";

const ITEMS = [
  {
    q: "Will it make things up?",
    a: "No. It answers only from the information you give it. When your content doesn’t cover a question, it says so and points the visitor to your contact details.",
  },
  {
    q: "What if someone asks something unrelated?",
    a: "It politely says it can only help with your business and steers back. It also ignores attempts to change its rules or reveal its instructions.",
  },
  {
    q: "What can I teach it?",
    a: "Paste text, or upload a PDF, Markdown or plain text file up to 10 MB. Add a short description of your business and it knows what is on topic.",
  },
  {
    q: "Which languages does it speak?",
    a: "Your visitors can write in their own language and get the answer back in it, even when your content is in English.",
  },
  {
    q: "How do I add it to my website?",
    a: "Copy one script tag into your page. There is nothing to build or host, and it works on any site.",
  },
  {
    q: "What does the Free plan include?",
    a: "One project, 100 messages a month and 3 knowledge sources. Upgrade when you need more.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-border rounded-3xl border border-border">
      {ITEMS.map((item) => (
        <details key={item.q} className="group px-6 py-5 md:px-8">
          <summary className="flex cursor-pointer items-center justify-between gap-6 text-base font-medium md:text-lg">
            {item.q}
            <Plus className="faq-plus size-5 shrink-0 text-muted transition-transform duration-300" />
          </summary>
          <p className="mt-3 max-w-2xl text-muted leading-relaxed">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
