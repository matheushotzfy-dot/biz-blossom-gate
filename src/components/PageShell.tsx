import React from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative space-y-6 pb-10 animate-fade-in">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-info/[0.03] blur-[100px]" />
      </div>
      <div className="relative z-[1] space-y-6">{children}</div>
    </div>
  );
}

export function Panel({ children, className, onClick, style }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border/80 backdrop-blur-xl overflow-hidden transition-all duration-300",
        "bg-card/90 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_8px_32px_rgba(0,0,0,0.04)]",
        "hover:border-primary/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08),0_0_0_1px_hsl(var(--primary)/0.06)]",
        "p-5",
        className
      )}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}

export function GlowPanel({ children, className, onClick, style, glow = "primary" }: { 
  children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties; glow?: "primary" | "info" | "warning" | "success" 
}) {
  const glowColors: Record<string, string> = {
    primary: "from-primary/[0.08] via-transparent to-info/[0.04]",
    info: "from-info/[0.08] via-transparent to-primary/[0.04]",
    warning: "from-warning/[0.06] via-transparent to-transparent",
    success: "from-success/[0.06] via-transparent to-transparent",
  };
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border/60 backdrop-blur-xl overflow-hidden transition-all duration-300",
        "bg-card/85 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_8px_32px_rgba(0,0,0,0.04)]",
        "hover:border-primary/25 hover:shadow-[0_8px_30px_rgba(0,0,0,0.1),0_0_0_1px_hsl(var(--primary)/0.08)]",
        "hover:-translate-y-[1px]",
        "p-5 group",
        className
      )}
      onClick={onClick}
      style={style}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 group-hover:opacity-100 transition-opacity duration-500", glowColors[glow])} />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

export function SectionHeader({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3.5">
        <div className="relative h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          <span className="text-primary-foreground">{icon}</span>
          <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div>
          <h3 className="text-[15px] font-display font-bold text-foreground leading-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="h-13 w-13 rounded-2xl gradient-primary flex items-center justify-center shrink-0 shadow-xl shadow-primary/25">
          <span className="text-primary-foreground">{icon}</span>
        </div>
        <div className="absolute -inset-1 rounded-2xl bg-primary/20 blur-lg opacity-40 -z-10" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-display font-black tracking-tight text-foreground leading-none">{title}</h1>
        <p className="text-[13px] text-muted-foreground/80">{subtitle}</p>
      </div>
    </div>
  );
}

export function KpiCard({ label, value, sub, icon, color, bg }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string;
}) {
  const Icon = icon;
  return (
    <GlowPanel className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em]">{label}</span>
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border border-border/40", bg)}>
          <Icon className={cn("h-[18px] w-[18px]", color)} />
        </div>
      </div>
      <p className="text-[22px] md:text-2xl font-display font-black text-foreground leading-none">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/60 mt-1.5 font-medium">{sub}</p>}
    </GlowPanel>
  );
}

export function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <Panel className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40">
              {headers.map((h) => (
                <th key={h} className="text-left p-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em]">
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
      <div className="relative mx-auto mb-4">
        <div className="h-16 w-16 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center mx-auto">
          <span className="text-muted-foreground/25">{icon}</span>
        </div>
        <div className="absolute -inset-3 rounded-3xl bg-primary/[0.03] blur-xl -z-10" />
      </div>
      <p className="text-[15px] font-display font-bold text-foreground/70">{title}</p>
      {subtitle && <p className="text-[12px] text-muted-foreground/50 mt-1.5 max-w-xs mx-auto">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}