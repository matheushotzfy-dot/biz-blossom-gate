import React from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="relative space-y-6 pb-10 animate-fade-in">{children}</div>;
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("panel-enterprise p-5", className)}>{children}</div>;
}

export function PageTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground flex items-center gap-3">
        <span className="text-primary shrink-0">{icon}</span>
        <span>{title}</span>
      </h1>
      <p className="text-sm md:text-[15px] text-muted-foreground">{subtitle}</p>
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
