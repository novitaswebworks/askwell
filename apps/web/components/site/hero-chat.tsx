import { Check } from "./icons";

// A picture of the product: the widget answering a real question from the
// owner's content, then politely declining one that is not about the business.
// It plays once, each message easing in after the one before.
export function HeroChat() {
  return (
    <div
      className="relative mx-auto w-full max-w-md rounded-[28px] border border-border bg-[#1f1e1d] p-2 shadow-[0_40px_80px_-20px_rgb(0_0_0/0.8),0_0_0_1px_rgb(255_255_255/0.04)]"
      role="img"
      aria-label="Example chat: a visitor asks about airport transfers and gets an answer from the business's own information, then asks an unrelated question and is politely redirected."
    >
      <div className="overflow-hidden rounded-[22px] bg-[#262624]">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="grid size-9 place-items-center rounded-full bg-brand text-brand-foreground">
            <Check className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Acme Travel</p>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Replies in seconds
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-5 py-6 text-[0.9rem] leading-snug" aria-hidden="true">
          <p className="chat-in max-w-[82%] self-end rounded-2xl rounded-br-md bg-brand px-4 py-2.5 font-medium text-brand-foreground" style={{ "--d": "0.5s" } as React.CSSProperties}>
            Do you arrange airport transfers?
          </p>
          <div className="chat-in max-w-[88%] self-start" style={{ "--d": "1.5s" } as React.CSSProperties}>
            <p className="rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-2.5">
              Yes. Transfers are included with most of our packages. Tell me where you’re flying to and I’ll check for you.
            </p>
            <p className="mt-1.5 pl-1 text-xs text-muted">From your “Packages and perks” page</p>
          </div>
          <p className="chat-in max-w-[82%] self-end rounded-2xl rounded-br-md bg-brand px-4 py-2.5 font-medium text-brand-foreground" style={{ "--d": "3.1s" } as React.CSSProperties}>
            Who won the football world cup?
          </p>
          <p className="chat-in max-w-[88%] self-start rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-2.5" style={{ "--d": "4.1s" } as React.CSSProperties}>
            I can only help with questions about Acme Travel and its trips. Anything about your booking I can look up?
          </p>
        </div>

        <div className="mx-5 mb-5 flex items-center justify-between rounded-full border border-border px-4 py-2.5 text-sm text-muted">
          Type your message
          <span className="grid size-7 place-items-center rounded-full bg-white/10 text-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
