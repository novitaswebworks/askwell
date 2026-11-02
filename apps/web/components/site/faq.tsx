import { FAQ_ITEMS } from "@/lib/faq";
import { Plus } from "./icons";


export function Faq() {
  return (
    <div className="divide-y divide-border rounded-3xl border border-border">
      {FAQ_ITEMS.map((item) => (
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
