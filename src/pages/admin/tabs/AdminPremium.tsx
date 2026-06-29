import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "destructive" | "info" | "neutral";

const toneText: Record<Tone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
  neutral: "text-foreground",
};

const toneSurface: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary border-primary/15",
  success: "bg-success/10 text-success border-success/15",
  warning: "bg-warning/10 text-warning border-warning/15",
  destructive: "bg-destructive/10 text-destructive border-destructive/15",
  info: "bg-info/10 text-info border-info/15",
  neutral: "bg-secondary text-muted-foreground border-border/60",
};

export function PremiumPanel({ children, className, title, eyebrow, icon: Icon, action }: {
  children: ReactNode;
  className?: string;
  title?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[24px] border border-border/60 bg-card", className)}>
      {(title || eyebrow || Icon || action) && (
        <header className="flex flex-col gap-3 border-b border-border/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/10 text-primary"><Icon className="h-5 w-5" strokeWidth={2.4} /></div>}
            <div className="min-w-0">
              {eyebrow && <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">{eyebrow}</p>}
              {title && <h2 className="font-display text-sm font-black uppercase tracking-tight text-foreground sm:text-base">{title}</h2>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PremiumMetric({ label, value, sub, icon: Icon, tone = "neutral", className }: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("group relative overflow-hidden rounded-[24px] border border-border/60 bg-card p-5 transition-colors hover:border-primary/25", className)}>
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
          <p className={cn("mt-3 break-words font-display text-2xl font-black leading-none tracking-tight tabular-nums", toneText[tone])}>{value}</p>
          {sub && <p className="mt-2 truncate text-[11px] font-bold text-muted-foreground/70">{sub}</p>}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", toneSurface[tone])}>
          <Icon className="h-5 w-5" strokeWidth={2.35} />
        </div>
      </div>
      <Icon className="pointer-events-none absolute -bottom-7 -right-5 h-28 w-28 rotate-[-12deg] text-foreground/[0.035] transition-transform duration-500 group-hover:scale-110" strokeWidth={1.4} />
    </div>
  );
}

export function PremiumMetricGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const cls: Record<number, string> = {
    3: "grid-cols-1 md:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-5",
    6: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-6",
  };
  return <div className={cn("grid gap-4", cls[cols])}>{children}</div>;
}

export function PremiumSegmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors",
            value === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PremiumEmpty({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
        <Icon className="h-7 w-7 opacity-40" />
      </div>
      <p className="text-sm font-black uppercase tracking-tight text-foreground/70">{title}</p>
      {subtitle && <p className="mt-1 text-[11px] font-bold text-muted-foreground/70">{subtitle}</p>}
    </div>
  );
}

export const premiumTable = {
  wrapper: "overflow-x-auto rounded-xl border border-border/60",
  table: "w-full text-left border-collapse",
  headRow: "border-b border-border bg-muted/40 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/80 sticky top-0 z-[1]",
  th: "px-5 py-3.5 whitespace-nowrap",
  row: "group relative border-b border-border/40 last:border-b-0 transition-[background-color,box-shadow,transform] duration-200 hover:bg-muted/30 hover:shadow-[inset_3px_0_0_0_hsl(var(--primary))]",
  td: "px-5 py-3.5 align-middle",
};
