import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Premium admin primitives — matches the seller dashboard aesthetic.
 * Gradient heroes, accent rails, soft glows, tabular numerics.
 */

type Tone = "neutral" | "success" | "warning" | "destructive" | "info" | "primary";

const toneText: Record<Tone, string> = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
  primary: "text-primary",
};

const toneDot: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  primary: "bg-primary",
};

const toneRail: Record<Tone, string> = {
  neutral: "bg-muted-foreground/40",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  primary: "bg-primary",
};

const toneSoft: Record<Tone, string> = {
  neutral: "bg-muted/40 text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  primary: "bg-primary/10 text-primary",
};

/** Premium page hero — gradient surface, eyebrow, status pill, actions. */
export function LinearHero({
  eyebrow,
  title,
  subtitle,
  status,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status?: { tone: Tone; label: string; pulse?: boolean };
  actions?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-card">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/4 h-48 w-48 rounded-full bg-info/5 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="relative flex flex-col gap-4 p-6 sm:p-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {status && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 backdrop-blur">
                <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[status.tone], status.pulse && "animate-pulse")} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{status.label}</span>
              </span>
            )}
            {eyebrow && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">{eyebrow}</span>
            )}
          </div>
          <h1 className="font-display text-[28px] sm:text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="relative flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

/** Responsive premium stat grid. */
export function LinearStatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {children}
    </div>
  );
}

export function LinearStat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  tone?: Tone;
  trend?: { value: string; positive?: boolean };
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card px-4 py-4 transition-all duration-300 hover:border-border hover:shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)] hover:-translate-y-0.5">
      <span className={cn("absolute inset-x-0 bottom-0 h-[2px] opacity-70", toneRail[tone])} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{label}</span>
        {Icon && (
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", toneSoft[tone])}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className={cn("mt-2.5 font-display text-[24px] font-semibold leading-none tracking-tight tabular-nums", toneText[tone])}>
        {value}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
        {trend && (
          <span className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums",
            trend.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
        )}
        {sub && <span className="truncate">{sub}</span>}
      </div>
    </div>
  );
}

/** Premium surface card with accent-striped header. */
export function LinearCard({
  children,
  className,
  title,
  eyebrow,
  action,
  icon: Icon,
  noPadding,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  noPadding?: boolean;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-border", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-5 w-1 shrink-0 rounded-full bg-primary" />
            {Icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" strokeWidth={2.2} />
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">{eyebrow}</p>}
              {title && <h2 className="truncate text-[13px] font-semibold text-foreground">{title}</h2>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(noPadding ? "" : "p-5")}>{children}</div>
    </section>
  );
}

/** Pill-style sub-tabs with active fill. */
export function LinearTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; count?: number; icon?: LucideIcon }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-[12px] font-medium transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {opt.icon && <opt.icon className="h-3.5 w-3.5" strokeWidth={2} />}
            {opt.label}
            {opt.count !== undefined && opt.count > 0 && (
              <span className={cn(
                "ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums",
                active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Soft-filled status badge with dot. */
export function LinearBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5", toneSoft[tone])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[tone])} />
      <span className="text-[10px] font-semibold tabular-nums">{children}</span>
    </span>
  );
}

/** Empty state for lists/tables. */
export function LinearEmpty({ icon: Icon, title, subtitle }: { icon?: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-b from-muted/40 to-transparent">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      {subtitle && <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export const linearTable = {
  wrap: "overflow-x-auto",
  table: "w-full text-left",
  thead: "border-b border-border/60 bg-muted/20",
  th: "px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70",
  row: "border-b border-border/40 transition-colors hover:bg-primary/[0.03]",
  td: "px-4 py-3.5 align-middle text-[12px]",
};
