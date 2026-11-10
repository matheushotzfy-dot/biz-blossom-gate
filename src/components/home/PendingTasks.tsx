import { ChevronRight, type LucideIcon } from "lucide-react";

export interface PendingTask { id: string; title: string; desc: string; icon: LucideIcon; onClick: () => void; tone: "warning" | "info" }

/** Pendências da conta — só aparece quando há algo a fazer. */
export function PendingTasks({ items }: { items: PendingTask[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="Pendências" className="grid gap-2.5 md:grid-cols-2">
      {items.map((t) => (
        <button key={t.id} onClick={t.onClick} className="vp-panel flex items-center gap-3 p-4 text-left transition-colors hover:border-primary/40">
          <span className={t.tone === "warning" ? "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warning/15 text-warning" : "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-info/10 text-info"}>
            <t.icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold text-foreground">{t.title}</span>
            <span className="block text-[12px] text-muted-foreground">{t.desc}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      ))}
    </section>
  );
}
