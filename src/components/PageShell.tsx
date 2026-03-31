import React from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative animate-fade-in">
      {/* Ambient top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72 overflow-hidden">
        <div className="mx-auto h-full w-full max-w-[1180px]">
          <div className="absolute left-1/2 top-[-160px] h-80 w-[48rem] -translate-x-1/2 rounded-full bg-primary/8 blur-[140px] opacity-50" />
          <div className="absolute right-0 top-[-80px] h-48 w-64 rounded-full bg-primary/5 blur-[100px] opacity-30" />
        </div>
      </div>

      <div className="relative z-[1] mx-auto w-full max-w-[1180px] space-y-6 pb-10">{children}</div>
    </div>
  );
}

export function Panel({ children, className, onClick, style, accent }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties; accent?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-xl transition-all duration-300",
        "shadow-[0_2px_12px_hsl(var(--foreground)/0.03)]",
        "hover:border-border/70 hover:bg-card/70 hover:shadow-[0_8px_24px_hsl(var(--foreground)/0.06)]",
        className,
      )}
      onClick={onClick}
      style={style}
    >
      {accent && <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", accent)} />}
      {children}
    </div>
  );
}

export function GlowPanel({ children, className, onClick, style, glow = "primary" }: {
  children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties; glow?: "primary" | "info" | "warning" | "success"
}) {
  const glowColors: Record<string, string> = {
    primary: "from-primary/8 via-primary/[0.02] to-transparent",
    info: "from-info/8 via-info/[0.02] to-transparent",
    warning: "from-warning/8 via-warning/[0.02] to-transparent",
    success: "from-success/8 via-success/[0.02] to-transparent",
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-xl transition-all duration-300",
        "shadow-[0_2px_12px_hsl(var(--foreground)/0.03)]",
        "hover:border-border/70 hover:bg-card/70 hover:shadow-[0_8px_24px_hsl(var(--foreground)/0.06)]",
        className,
      )}
      onClick={onClick}
      style={style}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity duration-500 group-hover:opacity-80", glowColors[glow])} />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

export function SectionHeader({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/30 bg-primary/8 backdrop-blur-xl shadow-sm">
          <span className="text-primary">{icon}</span>
        </div>
        <div>
          <h3 className="text-[15px] font-display font-bold leading-tight text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8 backdrop-blur-xl shadow-lg shadow-primary/10">
        <span className="text-primary">{icon}</span>
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-xl font-black leading-none tracking-[-0.04em] text-foreground md:text-2xl">{title}</h1>
        <p className="text-[13px] text-muted-foreground/70">{subtitle}</p>
      </div>
    </div>
  );
}

export function KpiCard({ label, value, sub, icon, color, bg, accent }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; accent?: string;
}) {
  const Icon = icon;
  return (
    <GlowPanel className="relative overflow-hidden p-4 md:p-5">
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", accent || "bg-primary")} />
      <div className="pl-2">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{label}</span>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border border-border/20 shadow-sm", bg)}>
            <Icon className={cn("h-[18px] w-[18px]", color)} />
          </div>
        </div>
        <p className="font-display text-[22px] font-black leading-none text-foreground md:text-2xl tabular-nums tracking-[-0.03em]">{value}</p>
        {sub && <p className="mt-1.5 text-[11px] font-medium text-muted-foreground/50">{sub}</p>}
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
                <th key={h} className="p-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
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
    <div className="py-16 text-center">
      <div className="relative mx-auto mb-5">
        <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-2xl border border-border/20 bg-muted/10 shadow-sm">
          <span className="text-muted-foreground/20">{icon}</span>
        </div>
        <div className="absolute inset-0 mx-auto h-18 w-18 rounded-2xl bg-primary/5 blur-xl" />
      </div>
      <p className="font-display text-[15px] font-bold text-foreground/60">{title}</p>
      {subtitle && <p className="mx-auto mt-1.5 max-w-xs text-[12px] text-muted-foreground/40">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * GlassKpi — Unified KPI card used across all pages.
 */
export function GlassKpi({ label, value, sub, icon: Icon, tone = "primary", large, delay = 0 }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "info" | "warning" | "success" | "destructive";
  large?: boolean; delay?: number;
}) {
  const toneStyles: Record<string, { bg: string; color: string; ring: string }> = {
    primary: { bg: "bg-primary/10", color: "text-primary", ring: "ring-primary/15" },
    info: { bg: "bg-info/10", color: "text-info", ring: "ring-info/15" },
    warning: { bg: "bg-warning/10", color: "text-warning", ring: "ring-warning/15" },
    success: { bg: "bg-success/10", color: "text-success", ring: "ring-success/15" },
    destructive: { bg: "bg-destructive/10", color: "text-destructive", ring: "ring-destructive/15" },
  };
  const t = toneStyles[tone] || toneStyles.primary;

  const accentBar: Record<string, string> = {
    primary: "bg-primary",
    info: "bg-info",
    warning: "bg-warning",
    success: "bg-success",
    destructive: "bg-destructive",
  };

  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-card/60 backdrop-blur-xl border border-border/40 overflow-hidden",
        "hover:border-border/65 hover:shadow-[0_8px_24px_hsl(var(--foreground)/0.06)] transition-all duration-300",
        "animate-fade-in",
        large ? "p-6" : "p-4 md:p-5"
      )}
      style={{ animationDelay: `${delay * 60}ms` }}
    >
      {/* Accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", accentBar[tone] || accentBar.primary)} />
      {/* Subtle ambient glow on hover */}
      <div className={cn("pointer-events-none absolute -top-4 -right-4 h-16 w-16 rounded-full blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500", t.bg)} />
      <div className="pl-1.5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em]">{label}</span>
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center ring-1 shadow-sm", t.bg, t.ring)}>
            <Icon className={cn("h-4 w-4", t.color)} />
          </div>
        </div>
        <p className={cn(
          "font-display font-black text-foreground tracking-[-0.03em] tabular-nums",
          large ? "text-3xl md:text-4xl" : "text-[22px] md:text-2xl"
        )}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground/50 mt-1.5 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

/**
 * PageSkeleton — Loading skeleton for page content
 */
export function PageSkeleton({ rows = 3, kpis = 4 }: { rows?: number; kpis?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-13 w-13 rounded-2xl bg-muted/20 border border-border/20" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-lg bg-muted/20" />
          <div className="h-4 w-32 rounded-lg bg-muted/15" />
        </div>
      </div>
      {/* KPI skeletons */}
      {kpis > 0 && (
        <div className={cn("grid gap-3", kpis <= 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
          {Array.from({ length: kpis }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/20 bg-card/30 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="h-3 w-20 rounded bg-muted/20" />
                <div className="h-9 w-9 rounded-xl bg-muted/15" />
              </div>
              <div className="h-7 w-28 rounded-lg bg-muted/20" />
              <div className="h-3 w-16 rounded bg-muted/15 mt-2" />
            </div>
          ))}
        </div>
      )}
      {/* Row skeletons */}
      <div className="rounded-2xl border border-border/20 bg-card/30 p-5 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-muted/15 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted/20" />
              <div className="h-3 w-1/2 rounded bg-muted/15" />
            </div>
            <div className="h-6 w-20 rounded-lg bg-muted/15" />
          </div>
        ))}
      </div>
    </div>
  );
}
