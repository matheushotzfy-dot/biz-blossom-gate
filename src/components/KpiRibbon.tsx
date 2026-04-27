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
  line: string;
  dot: string;
  value: string;
  track: string;
  fill: string;
  tag: string;
}> = {
  success:     { line: "bg-success/70",     dot: "bg-success",            value: "text-success",       track: "bg-success/12",     fill: "bg-success",            tag: "border-success/20 bg-success/10 text-success" },
  info:        { line: "bg-info/70",        dot: "bg-info",               value: "text-info",          track: "bg-info/12",        fill: "bg-info",               tag: "border-info/20 bg-info/10 text-info" },
  warning:     { line: "bg-warning/70",     dot: "bg-warning",            value: "text-warning",       track: "bg-warning/12",     fill: "bg-warning",            tag: "border-warning/20 bg-warning/10 text-warning" },
  destructive: { line: "bg-destructive/70", dot: "bg-destructive",        value: "text-destructive",   track: "bg-destructive/12", fill: "bg-destructive",        tag: "border-destructive/20 bg-destructive/10 text-destructive" },
  primary:     { line: "bg-primary/70",     dot: "bg-primary",            value: "text-primary",       track: "bg-primary/12",     fill: "bg-primary",            tag: "border-primary/20 bg-primary/10 text-primary" },
  neutral:     { line: "bg-foreground/30",  dot: "bg-foreground/60",      value: "text-foreground",    track: "bg-foreground/10",  fill: "bg-foreground/70",      tag: "border-border/60 bg-foreground/[0.04] text-foreground/80" },
  muted:       { line: "bg-border",         dot: "bg-muted-foreground/50", value: "text-foreground/70", track: "bg-muted/40",       fill: "bg-muted-foreground/40", tag: "border-border/50 bg-muted/30 text-muted-foreground" },
};

function DeltaPill({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) {
    return (
      <span className="text-[9px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 border border-success/20">
        <Sparkles className="h-2.5 w-2.5" />novo
      </span>
    );
  }
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded border",
      up ? "text-success bg-success/10 border-success/20" : "text-destructive bg-destructive/10 border-destructive/20"
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
    <div className={cn("overflow-hidden rounded-2xl border border-border/70 bg-card", className)}>
      <div className={cn("grid grid-cols-2 gap-px bg-border/60 md:grid-cols-4", COLS_CLS[xl])}>
        {items.map((kpi) => {
          const tones = TONES[kpi.tone ?? "neutral"];
          return (
            <div key={kpi.label} className="relative bg-card px-4 py-3.5 transition-colors hover:bg-foreground/[0.02]">
              <span className={cn("absolute inset-x-0 top-0 h-px", tones.line)} />

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tones.dot)} />
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

              <p className={cn("mt-2.5 text-[22px] font-heading font-black tabular-nums leading-none tracking-[-0.035em] sm:text-[24px]", tones.value)}>
                {kpi.value}
              </p>
              {kpi.sub && (
                <p className="mt-1.5 text-[10px] font-medium leading-[1.4] text-muted-foreground/68 break-words">
                  {kpi.sub}
                </p>
              )}

              {typeof kpi.progress === "number" ? (
                <div className="mt-2.5 space-y-1">
                  <div className={cn("h-[3px] overflow-hidden rounded-full", tones.track)}>
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", tones.fill)}
                      style={{ width: `${Math.min(Math.max(kpi.progress, 0), 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-semibold tabular-nums text-muted-foreground/65">
                    <span className="uppercase tracking-[0.12em]">participação</span>
                    <span>{Math.min(Math.max(kpi.progress, 0), 100).toFixed(0)}%</span>
                  </div>
                </div>
              ) : kpi.footer ? (
                <p className="mt-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/55">
                  {kpi.footer}
                </p>
              ) : null}
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
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-border/50 pb-4", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="flex items-center gap-2 mb-1.5">{eyebrow}</div>}
        <h1 className="text-[24px] sm:text-[28px] font-heading font-black tracking-[-0.04em] text-foreground leading-none">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[680px] text-[12px] text-muted-foreground/75 font-medium leading-[1.5]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
