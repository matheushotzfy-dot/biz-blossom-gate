import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Linear / Vercel style admin primitives.
 * Ultra clean: 1px borders, no shadows, no gradients, no glassmorphism.
 * Mono tabular numerics. Single accent color used sparsely.
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

/** Page header — eyebrow + title + subtitle, with optional right-side actions. */
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
    <header className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        {(eyebrow || status) && (
          <div className="flex items-center gap-2">
            {status && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2 py-0.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[status.tone], status.pulse && "animate-pulse")} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{status.label}</span>
              </span>
            )}
            {eyebrow && !status && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">{eyebrow}</span>
            )}
          </div>
        )}
        <h1 className="font-display text-[26px] sm:text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </header>
  );
}

/** Horizontal stat row with 1px vertical dividers — Linear's signature metric strip. */
export function LinearStatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card sm:grid-cols-3 md:grid-cols-4 [&>*]:border-0">
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
    <div className="border-r border-b border-border/60 px-5 py-4 last:border-r-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={2} />}
      </div>
      <div className={cn("mt-2 font-display text-[24px] font-semibold leading-none tracking-tight tabular-nums", toneText[tone])}>
        {value}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
        {trend && (
          <span className={cn("font-semibold tabular-nums", trend.positive ? "text-success" : "text-destructive")}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
        )}
        {sub && <span className="truncate">{sub}</span>}
      </div>
    </div>
  );
}

/** 1px-bordered surface with optional minimal header. */
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
    <section className={cn("overflow-hidden rounded-xl border border-border/60 bg-card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.2} />}
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

/** Underline-style sub-tabs (Linear / Vercel pattern). */
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
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[12px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.icon && <opt.icon className="h-3.5 w-3.5" strokeWidth={2} />}
            {opt.label}
            {opt.count !== undefined && opt.count > 0 && (
              <span className={cn(
                "ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums",
                active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              )}>{opt.count}</span>
            )}
            {active && <span className="absolute -bottom-px left-0 right-0 h-px bg-foreground" />}
          </button>
        );
      })}
    </div>
  );
}

/** Inline status badge — colored dot + label, no fill. */
export function LinearBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-1.5 py-0.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[tone])} />
      <span className={cn("text-[10px] font-semibold tabular-nums", toneText[tone])}>{children}</span>
    </span>
  );
}

/** Empty state for lists/tables. */
export function LinearEmpty({ icon: Icon, title, subtitle }: { icon?: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
          <Icon className="h-4 w-4 text-muted-foreground" />
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
  thead: "border-b border-border/60",
  th: "px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70",
  row: "border-b border-border/40 transition-colors hover:bg-muted/20",
  td: "px-4 py-3 align-middle text-[12px]",
};
