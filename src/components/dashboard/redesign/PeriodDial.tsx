import { CalendarDays, ChevronRight } from "lucide-react";
import { PeriodPicker, type PeriodValue } from "@/components/PeriodPicker";
import { Button } from "@/components/ui/button";

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
        <Button
          type="button"
          variant="outline"
          aria-label="Selecionar período"
          className="group relative h-10 w-full justify-between gap-4 overflow-hidden rounded-lg border-border bg-card px-3 text-left shadow-none hover:border-primary/35 hover:bg-accent/50 md:w-auto"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-[10px] font-medium leading-none text-muted-foreground">{label}</span>
              <span className="mt-1 block truncate font-numbers text-xs font-semibold leading-none text-foreground">{revenueLabel}</span>
            </span>
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden bg-border">
            <span className="block h-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
          </span>
        </Button>
      }
    />
  );
}
