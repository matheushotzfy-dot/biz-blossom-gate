import React from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="relative space-y-6 pb-10 animate-fade-in">{children}</div>;
}

export function Panel({ children, className, onClick, style }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) {
  return <div className={cn("panel-enterprise p-5 rounded-2xl", className)} onClick={onClick} style={style}>{children}</div>;
}

export function SectionHeader({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="text-[15px] font-display font-bold text-foreground leading-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
        <span className="text-primary-foreground">{icon}</span>
      </div>
      <div className="space-y-0.5">
        <h1 className="text-xl md:text-2xl font-display font-extrabold tracking-tight text-foreground leading-none">{title}</h1>
        <p className="text-[13px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <Panel className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/30">
              {headers.map((h) => (
                <th key={h} className="text-left p-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
