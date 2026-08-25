import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Premium hero header used across all Financeiro hub pages.
 * Billion-Dollar SaaS standard: 52px display, radial accent, status chip, action slot.
 */
export function FinanceiroHero({
  eyebrow,
  title,
  subtitle,
  status,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status?: { tone: "success" | "warning" | "info" | "neutral" | "destructive"; label: string; pulse?: boolean };
  actions?: ReactNode;
}) {
  const dotCls: Record<string, string> = {
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-info",
    neutral: "bg-muted-foreground",
    destructive: "bg-destructive",
  };
  return (
    <div className="relative overflow-hidden animate-fade-in">
      <div
        className="pointer-events-none absolute -top-24 -left-20 h-[280px] w-[520px] rounded-full opacity-60"
        style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.10), transparent 70%)" }}
      />
      <div className="relative flex flex-col gap-4 sm:gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 sm:space-y-3 min-w-0">
          {(status || eyebrow) && (
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-2.5 py-1">
              {status && (
                <span className={cn("h-1.5 w-1.5 rounded-full", dotCls[status.tone], status.pulse && "animate-pulse")} />
              )}
              <span className="text-[11px] font-medium text-muted-foreground">
                {status?.label || eyebrow}
              </span>
            </div>
          )}
          <h1 className="font-display text-[28px] sm:text-[40px] lg:text-[52px] font-black leading-[0.95] tracking-[-0.03em] text-foreground break-words">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] sm:text-[13px] text-muted-foreground/80 max-w-xl leading-relaxed">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * KPI card used inside a 1px-divider grid (parent: `bg-border/40 gap-px`).
 */
export type KpiTone = "success" | "info" | "warning" | "neutral" | "destructive" | "primary";

export function FinanceiroKpi({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: KpiTone;
}) {
  const iconTint: Record<KpiTone, string> = {
    success: "text-success",
    info: "text-info",
    warning: "text-warning",
    neutral: "text-muted-foreground",
    destructive: "text-destructive",
    primary: "text-primary",
  };
  const barCls: Record<KpiTone, string> = {
    success: "bg-success",
    info: "bg-info",
    warning: "bg-warning",
    neutral: "bg-foreground/40",
    destructive: "bg-destructive",
    primary: "bg-primary",
  };
  return (
    <div className="group relative bg-card px-4 py-4 flex flex-col gap-2 transition-colors hover:bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground/70 leading-tight break-words">{label}</span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-90", iconTint[tone])} strokeWidth={2.2} />
      </div>
      <div className="font-display text-[20px] sm:text-[24px] font-black leading-none tabular-nums tracking-tight break-all text-foreground">
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground/75 font-medium truncate">{sub}</div>}
      <span className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100", barCls[tone])} />
    </div>
  );
}

export function FinanceiroKpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 }) {
  const colCls: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 lg:grid-cols-5",
  };
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 animate-fade-in stagger-1", colCls[cols])}>
      {children}
    </div>
  );
}
