import { ChevronRight } from "lucide-react";
import { PeriodPicker, type PeriodValue } from "@/components/PeriodPicker";

interface PeriodDialProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  label: string;
  goalPct: number;
  revenueLabel: string;
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}

export function PeriodDial({ open, setOpen, label, goalPct, revenueLabel, value, onChange }: PeriodDialProps) {
  const today = new Date();
  const dayNum = today.getDate();
  const pct = Math.max(0, Math.min(100, goalPct));

  return (
    <PeriodPicker
      open={open}
      onOpenChange={setOpen}
      value={value}
      onChange={onChange}
      align="end"
      side="bottom"
      trigger={
        <button
          aria-label="Selecionar período"
          className="group relative flex items-end gap-3 border-b border-primary/30 bg-transparent px-1 pb-1.5 pt-1 text-left transition-colors hover:border-primary/70"
        >
          <span className="flex items-baseline gap-[3px] leading-none">
            <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.05em] tabular-nums text-foreground">
              {String(dayNum).padStart(2, "0")}
            </span>
            <span className="font-display text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-muted-foreground/60">
              {today.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
            </span>
          </span>

          <span className="h-6 w-px bg-border/70" />

          <span className="min-w-0 leading-none">
            <span className="block text-[9.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
              {label}
            </span>
            <span className="mt-1 block font-display text-[14px] font-bold leading-none tabular-nums tracking-[-0.03em] text-foreground">
              {revenueLabel}
            </span>
          </span>

          <ChevronRight className="mb-[3px] h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />

          <span aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] overflow-hidden">
            <span className="block h-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
          </span>
        </button>
      }
    />
  );
}
