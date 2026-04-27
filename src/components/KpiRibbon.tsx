/**
 * KpiRibbon — Premium dense KPI strip used across Vendas, Cupons,
 * Assinaturas, Extrato and Saques. Visual identity matches the
 * "Minhas Vendas" reference (zero-gap grid, accent line on top,
 * tones, optional progress bar / tag / delta).
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Sparkles } from "lucide-react";

export type KpiTone = "success" | "info" | "warning" | "destructive" | "neutral" | "muted" | "primary";

export type KpiItem = {
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  progress?: number;
  tag?: string;
  delta?: { cur: number; prev: number };
  /** Optional override label for the bottom strip when no progress bar is shown */
  footer?: string;
};

const TONES: Record<KpiTone, {
  panel: string;
  line: string;
  dot: string;
  value: string;
  track: string;
  fill: string;
  tag: string;
}> = {
  success: {
    panel: "bg-gradient-to-b from-success/[0.05] via-card to-card hover:from-success/[0.08]",
    line: "bg-success/70", dot: "bg-success", value: "text-success",
    track: "bg-success/10", fill: "bg-success",
    tag: "border-success/20 bg-success/10 text-success",
  },
  info: {
    panel: "bg-gradient-to-b from-info/[0.05] via-card to-card hover:from-info/[0.08]",
    line: "bg-info/70", dot: "bg-info", value: "text-info",
    track: "bg-info/10", fill: "bg-info",
    tag: "border-info/20 bg-info/10 text-info",
  },
  warning: {
    panel: "bg-gradient-to-b from-warning/[0.05] via-card to-card hover:from-warning/[0.08]",
    line: "bg-warning/70", dot: "bg-warning", value: "text-warning",
    track: "bg-warning/10", fill: "bg-warning",
    tag: "border-warning/20 bg-warning/10 text-warning",
  },
  destructive: {
    panel: "bg-gradient-to-b from-destructive/[0.05] via-card to-card hover:from-destructive/[0.08]",
    line: "bg-destructive/70", dot: "bg-destructive", value: "text-destructive",
    track: "bg-destructive/10", fill: "bg-destructive",
    tag: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  primary: {
    panel: "bg-gradient-to-b from-primary/[0.05] via-card to-card hover:from-primary/[0.08]",
    line: "bg-primary/70", dot: "bg-primary", value: "text-primary",
    track: "bg-primary/10", fill: "bg-primary",
    tag: "border-primary/20 bg-primary/10 text-primary",
  },
  neutral: {
    panel: "bg-gradient-to-b from-foreground/[0.03] via-card to-card hover:from-foreground/[0.05]",
    line: "bg-foreground/30", dot: "bg-foreground/60", value: "text-foreground",
    track: "bg-foreground/10", fill: "bg-foreground/70",
    tag: "border-border/60 bg-foreground/[0.04] text-foreground/80",
  },
  muted: {
    panel: "bg-gradient-to-b from-muted/20 via-card to-card hover:from-muted/30",
    line: "bg-border", dot: "bg-muted-foreground/50", value: "text-foreground/70",
    track: "bg-muted/40", fill: "bg-muted-foreground/40",
    tag: "border-border/50 bg-muted/30 text-muted-foreground",
  },
};

function DeltaPill({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) {
    return (
      <span className="text-[9px] font-bold text-success bg-success/8 px-2 py-0.5 rounded-md inline-flex items-center gap-0.5 border border-success/10">
        <Sparkles className="h-2.5 w-2.5" />novo
      </span>
    );
  }
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[9px] font-bold tabular-nums px-2 py-0.5 rounded-md border",
      up ? "text-success bg-success/6 border-success/10" : "text-destructive bg-destructive/6 border-destructive/10"
    )}>
      {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export interface KpiRibbonProps {
  items: KpiItem[];
  /** Number of columns at xl breakpoint. Defaults to items.length (capped to 8). */
  cols?: 4 | 5 | 6 | 7 | 8;
  className?: string;
}

const COLS_CLS: Record<number, string> = {
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
  7: "xl:grid-cols-7",
  8: "xl:grid-cols-8",
};

export function KpiRibbon({ items, cols, className }: KpiRibbonProps) {
  const xl = cols ?? Math.min(Math.max(items.length, 4), 8) as 4 | 5 | 6 | 7 | 8;
  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_0_hsl(var(--border)/0.6),0_8px_24px_-18px_hsl(var(--foreground)/0.25)]",
      className,
    )}>
      <div className={cn("grid grid-cols-2 gap-px bg-border/60 md:grid-cols-4", COLS_CLS[xl])}>
        {items.map((kpi) => {
          const tones = TONES[kpi.tone ?? "neutral"];
          return (
            <div
              key={kpi.label}
              className={cn(
                "group relative min-h-[136px] bg-card px-4 py-4 transition-colors duration-200",
                tones.panel,
              )}
            >
              {/* Top accent line */}
              <span className={cn("absolute inset-x-0 top-0 h-px", tones.line)} />
              {/* Soft corner glow — subtle photographic depth */}
              <span aria-hidden className={cn("pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100", tones.fill)} style={{ filter: "blur(40px)", opacity: 0.06 }} />
              {/* Bottom hairline shine */}
              <span aria-hidden className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0 ring-2", tones.dot)} style={{ boxShadow: "0 0 0 3px hsl(var(--card))" }} />
                    <p className="truncate text-[9px] font-heading font-bold uppercase tracking-[0.18em] text-muted-foreground/75">
                      {kpi.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {kpi.tag && (
                      <span className={cn("rounded-md border px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider", tones.tag)}>
                        {kpi.tag}
                      </span>
                    )}
                    {kpi.delta && <DeltaPill cur={kpi.delta.cur} prev={kpi.delta.prev} />}
                  </div>
                </div>

                <div className="mt-4">
                  <p className={cn("text-[22px] font-heading font-black tabular-nums leading-none tracking-[-0.035em] sm:text-[25px] transition-transform duration-300 group-hover:-translate-y-px", tones.value)}>
                    {kpi.value}
                  </p>
                  {kpi.sub && (
                    <p className="mt-2 min-h-[28px] text-[10px] font-medium leading-[1.4] text-muted-foreground/68 break-words">
                      {kpi.sub}
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-4">
                  {typeof kpi.progress === "number" ? (
                    <div className="space-y-1.5">
                      <div className={cn("relative h-[4px] overflow-hidden rounded-full", tones.track)}>
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", tones.fill)}
                          style={{ width: `${Math.min(Math.max(kpi.progress, 0), 100)}%` }}
                        />
                        <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-foreground/0 via-foreground/[0.06] to-foreground/0" />
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-semibold tabular-nums text-muted-foreground/65">
                        <span className="uppercase tracking-[0.12em]">participação</span>
                        <span>{Math.min(Math.max(kpi.progress, 0), 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ) : kpi.footer ? (
                    <div className="h-[20px] border-t border-border/50 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/55">
                      {kpi.footer}
                    </div>
                  ) : (
                    <div className="h-[20px]" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────── Shared page header (matches Vendas) ─────────────── */
export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/50 pb-5", className)}>
      <span aria-hidden className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div>
        {eyebrow && (
          <div className="flex items-center gap-2 mb-1.5">{eyebrow}</div>
        )}
        <h1 className="text-[28px] sm:text-[34px] font-heading font-black tracking-[-0.045em] text-foreground leading-none">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[680px] text-[12.5px] text-muted-foreground/75 font-medium leading-[1.55]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
