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

const toneBar: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  neutral: "bg-foreground/40",
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
    <section className={cn("overflow-hidden rounded-[12px] border border-border/60 bg-card", className)}>
      {(title || eyebrow || Icon || action) && (
        <header className="flex flex-col gap-3 border-b border-border/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.2} />}
            <div className="min-w-0">
              {eyebrow && <p className="text-[11px] font-medium text-muted-foreground/70">{eyebrow}</p>}
              {title && <h2 className="font-display text-[14px] font-semibold tracking-tight text-foreground">{title}</h2>}
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
    <div className={cn("group relative overflow-hidden rounded-[12px] border border-border/60 bg-card px-3.5 py-4 transition-colors hover:border-border sm:px-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-medium text-muted-foreground/70">{label}</p>
        <Icon className={cn("h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-90", toneText[tone])} strokeWidth={2.2} />
      </div>
      <p className="mt-4 break-words font-display text-[20px] font-semibold sm:text-[26px] leading-none tracking-[-0.02em] tabular-nums text-foreground">
        {value}
      </p>
      {sub && <p className="mt-2 truncate text-[11px] font-medium text-muted-foreground/75">{sub}</p>}
      <span className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100", toneBar[tone])} />
    </div>
  );
}

export function PremiumMetricGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const cls: Record<number, string> = {
    // minmax(0,1fr): sem isso um valor longo empurra a coluna e a página vaza para o lado
    3: "grid-cols-[minmax(0,1fr)] md:grid-cols-[repeat(3,minmax(0,1fr))]",
    4: "grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(4,minmax(0,1fr))]",
    5: "grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(5,minmax(0,1fr))]",
    6: "grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(6,minmax(0,1fr))]",
  };
  return <div className={cn("grid gap-3 sm:gap-4", cls[cols])}>{children}</div>;
}

export function PremiumSegmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-[10px] border border-border/60 bg-transparent p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-[8px] px-3 py-1.5 text-[11.5px] font-medium transition-colors",
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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[12px] border border-border/60 bg-transparent">
        <Icon className="h-7 w-7 opacity-40" />
      </div>
      <p className="text-[13.5px] font-semibold text-foreground/80">{title}</p>
      {subtitle && <p className="mt-1 text-[12px] font-medium text-muted-foreground/70">{subtitle}</p>}
    </div>
  );
}

export const premiumTable = {
  wrapper: "overflow-x-auto rounded-[12px] border border-border/60",
  table: "w-full text-left border-collapse",
  headRow: "border-b border-border bg-muted/25 text-[11px] font-medium text-muted-foreground/80 sticky top-0 z-[1]",
  th: "px-5 py-3.5 whitespace-nowrap",
  row: "group relative border-b border-border/40 last:border-b-0 transition-[background-color,box-shadow,transform] duration-200 hover:bg-muted/25",
  td: "px-5 py-3.5 align-middle",
};
