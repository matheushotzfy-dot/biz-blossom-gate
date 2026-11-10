import type { LucideIcon } from "lucide-react";

export interface QuickAction { label: string; hint: string; icon: LucideIcon; onClick: () => void; tone?: "money" | "default" }

/** Atalhos em trilho rolável (celular) / grade (desktop). */
export function QuickActions({ items }: { items: QuickAction[] }) {
  return (
    <section aria-label="Atalhos" className="-mx-3 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex gap-2.5 sm:grid sm:grid-cols-3 lg:grid-cols-6">
        {items.map((a) => (
          <li key={a.label} className="shrink-0">
            <button onClick={a.onClick} className="vp-action-tile flex h-full w-[132px] flex-col items-start gap-3 rounded-2xl p-3.5 text-left sm:w-full">
              <span className={a.tone === "money" ? "grid h-10 w-10 place-items-center rounded-[12px] bg-primary text-primary-foreground" : "grid h-10 w-10 place-items-center rounded-[12px] bg-accent text-accent-foreground"}>
                <a.icon className="h-[19px] w-[19px]" strokeWidth={2.1} />
              </span>
              <span>
                <span className="block text-[13.5px] font-bold text-foreground">{a.label}</span>
                <span className="block text-[11.5px] text-muted-foreground">{a.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
