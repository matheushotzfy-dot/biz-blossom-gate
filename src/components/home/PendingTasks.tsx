import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PendingTask { id: string; title: string; desc: string; icon: LucideIcon; onClick: () => void; tone: "warning" | "info" }

/** Pendências da conta — só aparece quando há algo a fazer. */
export function PendingTasks({ items }: { items: PendingTask[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="Pendências" className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={t.onClick}
          className="vp-sheet group flex items-center gap-4 rounded-[18px] p-4 text-left transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[14px]", t.tone === "warning" ? "bg-warning/15 text-warning" : "bg-accent text-accent-foreground")}>
            <t.icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-bold text-foreground">{t.title}</span>
            <span className="block text-[13px] text-muted-foreground">{t.desc}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </section>
  );
}
