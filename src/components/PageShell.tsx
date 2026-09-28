import React from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children }: { children: React.ReactNode }) {
 return (
 <div className="relative animate-fade-in">
 <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-64 overflow-hidden">
 <div className="mx-auto h-full w-full max-w-[1180px]">
 </div>
 </div>

 <div className="relative z-[1] mx-auto w-full max-w-[1180px] space-y-5 md:space-y-7 pb-8 md:pb-12">{children}</div>
 </div>
 );
}

export function Panel({ children, className, onClick, style, accent }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties; accent?: string }) {
 return (
 <div
 className={cn(
 "relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-colors duration-200 md:p-6",
 "hover:border-primary/30 hover:bg-card-elevated",
 className,
 )}
 onClick={onClick}
 style={style}
 >
 {accent && <div className={cn("absolute inset-y-4 left-0 w-0.5", accent)} />}
 {children}
 </div>
 );
}

export function GlowPanel({ children, className, onClick, style, glow = "primary" }: {
 children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties; glow?: "primary" | "info" | "warning" | "success"
}) {
 const glowColors: Record<string, string> = {
 primary: "from-primary/10 via-primary/[0.03] to-transparent",
 info: "from-info/10 via-info/[0.03] to-transparent",
 warning: "from-warning/10 via-warning/[0.03] to-transparent",
 success: "from-success/10 via-success/[0.03] to-transparent",
 };

 return (
 <div
 className={cn(
 "group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-colors duration-200 md:p-6",
 "hover:border-primary/30 hover:bg-card-elevated",
 className,
 )}
 onClick={onClick}
 style={style}
 >
  <div className={cn("pointer-events-none absolute inset-y-4 left-0 w-0.5 opacity-70", glowColors[glow].replace("from-", "bg-").split(" ")[0])} />
 <div className="relative z-[1]">{children}</div>
 </div>
 );
}

export function SectionHeader({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
 return (
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3.5">
  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card-inset">
 <span className="text-primary">{icon}</span>
 </div>
 <div>
  <h3 className="text-[15px] font-display font-semibold leading-tight text-foreground">{title}</h3>
 {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{subtitle}</p>}
 </div>
 </div>
 {action}
 </div>
 );
}

export function PageTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
 return (
 <div className="flex items-center gap-3 md:gap-4">
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card-inset md:h-11 md:w-11">
 <span className="text-primary">{icon}</span>
 </div>
 <div className="space-y-0.5 md:space-y-1 min-w-0">
  <h1 className="truncate font-display text-lg font-semibold leading-none text-foreground md:text-2xl">{title}</h1>
 <p className="text-[12px] md:text-[13px] text-muted-foreground/70 truncate">{subtitle}</p>
 </div>
 </div>
 );
}

export function KpiCard({ label, value, sub, icon, color, bg, accent }: {
 label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; accent?: string;
}) {
 const Icon = icon;
 return (
 <GlowPanel className="relative overflow-hidden p-4 md:p-6">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", accent || "bg-primary")} />
 <div className="pl-2 md:pl-2.5">
 <div className="mb-2.5 md:mb-3.5 flex items-center justify-between">
 <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{label}</span>
 <div className={cn("flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-xl md:rounded-xl border border-border/25", bg)}>
 <Icon className={cn("h-4 w-4 md:h-5 md:w-5", color)} />
 </div>
 </div>
 <p className="font-display text-xl md:text-[28px] font-black leading-none text-foreground tabular-nums tracking-[-0.03em]">{value}</p>
 {sub && <p className="mt-1.5 md:mt-2 text-[10px] md:text-[11px] font-medium text-muted-foreground/55">{sub}</p>}
 </div>
 </GlowPanel>
 );
}

export function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
 return (
 <Panel className="overflow-hidden p-0">
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border/30 bg-muted/10">
 {headers.map((h) => (
 <th key={h} className="p-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
 {h}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>{children}</tbody>
 </table>
 </div>
 </Panel>
 );
}

export function EmptyState({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
 return (
 <div className="py-20 text-center">
 <div className="relative mx-auto mb-5">
 <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/25 bg-card/50 shadow-sm">
 <span className="text-muted-foreground/30">{icon}</span>
 </div>
 </div>
 <p className="font-display text-[15px] font-bold text-foreground/70">{title}</p>
 {subtitle && <p className="mx-auto mt-2 max-w-xs text-[12px] text-muted-foreground/45 leading-relaxed">{subtitle}</p>}
 {action && <div className="mt-5">{action}</div>}
 </div>
 );
}

/**
 * GlassKpi — Unified premium KPI card used across all pages.
 */
export function GlassKpi({ label, value, sub, icon: Icon, tone = "primary", large, delay = 0 }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "info" | "warning" | "success" | "destructive";
  large?: boolean; delay?: number;
}) {
  const toneStyles: Record<string, { bg: string; color: string; line: string; glow: string }> = {
    primary: { bg: "bg-primary/10", color: "text-primary", line: "bg-primary", glow: "shadow-primary/5" },
    info: { bg: "bg-info/10", color: "text-info", line: "bg-info", glow: "shadow-info/5" },
    warning: { bg: "bg-warning/10", color: "text-warning", line: "bg-warning", glow: "shadow-warning/5" },
    success: { bg: "bg-success/10", color: "text-success", line: "bg-success", glow: "shadow-success/5" },
    destructive: { bg: "bg-destructive/10", color: "text-destructive", line: "bg-destructive", glow: "shadow-destructive/5" },
  };
  const t = toneStyles[tone] || toneStyles.primary;

  return (
    <div
      className={cn(
        "group relative rounded-[2.5rem] bg-card/60 backdrop-blur-2xl border border-border/40 overflow-hidden",
        "hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1.5 transition-all duration-500",
        t.glow,
        large ? "p-8 md:p-10" : "p-5 md:p-7",
        "animate-in fade-in slide-in-from-bottom-4"
      )}
      style={{ animationDelay: `${delay * 50}ms` }}
    >
      {/* Decorative gradient blob */}
      <div className={cn(
        "absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-[0.12]",
        t.bg
      )} />
      
      {/* Inner glass reflection */}
      <div className="absolute inset-px rounded-[2.45rem] bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] md:text-[11px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] group-hover:text-muted-foreground/60 transition-colors">
            {label}
          </p>
          <div className={cn(
            "h-11 w-11 md:h-13 md:w-13 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-lg",
            t.bg,
            "border border-border/10"
          )}>
            <Icon className={cn("h-6 w-6 md:h-7 md:w-7", t.color)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className={cn(
            "font-black text-foreground tracking-tighter tabular-nums leading-none transition-all duration-300 group-hover:tracking-tight",
            large ? "text-4xl md:text-6xl" : "text-2xl md:text-[32px]"
          )}>{value}</p>
          {sub && (
            <p className="text-[10px] md:text-[11px] text-muted-foreground/30 mt-2 md:mt-3 font-bold group-hover:text-muted-foreground/50 transition-colors tracking-wide">
              {sub}
            </p>
          )}
        </div>
      </div>
      
      {/* Subtle accent bar on top hover */}
      <div className={cn("absolute inset-x-0 top-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-500", t.line)} />
    </div>
  );
}


/**
 * PageSkeleton — Loading skeleton for page content
 */
export function PageSkeleton({ rows = 3, kpis = 4 }: { rows?: number; kpis?: number }) {
 return (
 <div className="space-y-7 animate-pulse">
 {/* Title skeleton */}
 <div className="flex items-center gap-4">
 <div className="h-13 w-13 rounded-2xl bg-muted/25" />
 <div className="space-y-2.5">
 <div className="h-6 w-48 rounded-lg bg-muted/25" />
 <div className="h-4 w-32 rounded-lg bg-muted/15" />
 </div>
 </div>
 {/* KPI skeletons */}
 {kpis > 0 && (
 <div className={cn("grid gap-3", kpis <= 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
 {Array.from({ length: kpis }).map((_, i) => (
 <div key={i} className="rounded-2xl border border-border/25 bg-card/30 p-6">
 <div className="flex items-center justify-between mb-3.5">
 <div className="h-3 w-20 rounded bg-muted/25" />
 <div className="h-10 w-10 rounded-xl bg-muted/15" />
 </div>
 <div className="h-7 w-28 rounded-lg bg-muted/25" />
 <div className="h-3 w-16 rounded bg-muted/15 mt-2.5" />
 </div>
 ))}
 </div>
 )}
 {/* Row skeletons */}
 <div className="rounded-2xl border border-border/25 bg-card/30 p-6 space-y-5">
 {Array.from({ length: rows }).map((_, i) => (
 <div key={i} className="flex items-center gap-4">
 <div className="h-11 w-11 rounded-xl bg-muted/15 shrink-0" />
 <div className="flex-1 space-y-2.5">
 <div className="h-4 w-3/4 rounded bg-muted/25" />
 <div className="h-3 w-1/2 rounded bg-muted/15" />
 </div>
 <div className="h-6 w-20 rounded-lg bg-muted/15" />
 </div>
 ))}
 </div>
 </div>
  );
}

/**
 * TableSkeleton — Loading skeleton for tabular lists (rows with avatar/icon + 2 text lines + value)
 * Use inside a Card/Panel that already has its own border.
 */
export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border/30 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <div className="h-10 w-10 rounded-xl bg-muted/20 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 rounded bg-muted/25" style={{ width: `${55 + ((i * 13) % 30)}%` }} />
            <div className="h-2.5 w-1/3 rounded bg-muted/15" />
          </div>
          {Array.from({ length: Math.max(0, columns - 2) }).map((_, j) => (
            <div key={j} className="hidden md:block h-3 w-16 rounded bg-muted/15" />
          ))}
          <div className="h-7 w-20 rounded-lg bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

/**
 * GridSkeleton — Loading skeleton for card grids (products, marketplace, courses).
 */
export function GridSkeleton({ items = 6, cols = 3 }: { items?: number; cols?: 2 | 3 | 4 }) {
  const colsCls = cols === 4 ? "lg:grid-cols-4" : cols === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
  return (
    <div className={cn("grid gap-4 animate-pulse grid-cols-1 sm:grid-cols-2", colsCls)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/25 bg-card/30 overflow-hidden">
          <div className="aspect-[16/10] bg-muted/15" />
          <div className="p-4 space-y-3">
            <div className="h-4 w-3/4 rounded bg-muted/25" />
            <div className="h-3 w-1/2 rounded bg-muted/15" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-5 w-20 rounded bg-muted/20" />
              <div className="h-7 w-16 rounded-lg bg-muted/15" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * SectionSkeleton — Compact skeleton for a single content section/panel.
 */
export function SectionSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-border/25 bg-card/30 p-6 space-y-3 animate-pulse">
      <div className="h-5 w-40 rounded bg-muted/25" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-muted/15" style={{ width: `${60 + ((i * 17) % 35)}%` }} />
      ))}
    </div>
  );
}

