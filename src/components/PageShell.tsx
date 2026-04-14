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
 "relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-5 md:p-6 backdrop-blur-xl transition-all duration-300",
 "shadow-[0_2px_12px_hsl(var(--foreground)/0.03)]",
 "hover:border-border/55 hover:bg-card/65 hover:shadow-[0_6px_24px_hsl(var(--foreground)/0.06)]",
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
 primary: "from-primary/10 via-primary/[0.03] to-transparent",
 info: "from-info/10 via-info/[0.03] to-transparent",
 warning: "from-warning/10 via-warning/[0.03] to-transparent",
 success: "from-success/10 via-success/[0.03] to-transparent",
 };

 return (
 <div
 className={cn(
 "group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-5 md:p-6 backdrop-blur-xl transition-all duration-300",
 "shadow-[0_2px_12px_hsl(var(--foreground)/0.03)]",
 "hover:border-border/55 hover:bg-card/65 hover:shadow-[0_6px_24px_hsl(var(--foreground)/0.06)]",
 className,
 )}
 onClick={onClick}
 style={style}
 >
 <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-55 transition-opacity duration-500 group-hover:opacity-70", glowColors[glow])} />
 <div className="relative z-[1]">{children}</div>
 </div>
 );
}

export function SectionHeader({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
 return (
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3.5">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/35 bg-card/50 backdrop-blur-xl shadow-sm">
 <span className="text-primary">{icon}</span>
 </div>
 <div>
 <h3 className="text-[15px] font-display font-bold leading-tight text-foreground tracking-[-0.02em]">{title}</h3>
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
 <div className="flex h-11 w-11 md:h-13 md:w-13 shrink-0 items-center justify-center rounded-xl md:rounded-2xl border border-border/35 bg-card/50 backdrop-blur-xl shadow-sm">
 <span className="text-primary">{icon}</span>
 </div>
 <div className="space-y-0.5 md:space-y-1 min-w-0">
 <h1 className="font-display text-lg md:text-2xl font-black leading-none tracking-[-0.03em] text-foreground truncate">{title}</h1>
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
 * GlassKpi — Unified KPI card used across all pages.
 */
export function GlassKpi({ label, value, sub, icon: Icon, tone = "primary", large, delay = 0 }: {
 label: string; value: string; sub?: string;
 icon: React.ComponentType<{ className?: string }>;
 tone?: "primary" | "info" | "warning" | "success" | "destructive";
 large?: boolean; delay?: number;
}) {
 const toneStyles: Record<string, { bg: string; color: string }> = {
 primary: { bg: "bg-primary/10", color: "text-primary" },
 info: { bg: "bg-info/10", color: "text-info" },
 warning: { bg: "bg-warning/10", color: "text-warning" },
 success: { bg: "bg-success/10", color: "text-success" },
 destructive: { bg: "bg-destructive/10", color: "text-destructive" },
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
 "group relative rounded-xl md:rounded-2xl bg-card/60 backdrop-blur-xl border border-border/35 overflow-hidden",
 "hover:border-border/50 hover:shadow-[0_6px_24px_hsl(var(--foreground)/0.06)] transition-all duration-300",
 large ? "p-4 md:p-7" : "p-4 md:p-6"
 )}
 style={{ animationDelay: `${delay * 60}ms` }}
 >
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", accentBar[tone] || accentBar.primary)} />
 <div className="pl-2">
 <div className="flex items-center justify-between mb-2.5 md:mb-3.5">
 <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.16em]">{label}</span>
 <div className={cn("h-9 w-9 md:h-10 md:w-10 rounded-xl flex items-center justify-center ring-1 ring-border/15", t.bg)}>
 <Icon className={cn("h-4 w-4 md:h-[18px] md:w-[18px]", t.color)} />
 </div>
 </div>
 <p className={cn(
 "font-display font-black text-foreground tracking-[-0.03em] tabular-nums",
 large ? "text-2xl md:text-4xl" : "text-xl md:text-[28px]"
 )}>{value}</p>
 {sub && <p className="text-[10px] md:text-[11px] text-muted-foreground/50 mt-1.5 md:mt-2 font-medium">{sub}</p>}
 </div>
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
