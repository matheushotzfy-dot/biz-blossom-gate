import React from "react";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 relative pb-8 min-h-screen animate-fade-in">
      {children}
    </div>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 bg-card border border-border transition-all duration-150 ${className || ""}`} style={{ boxShadow: "var(--card-shadow)" }}>
      {children}
    </div>
  );
}

export function PageTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
        <span className="text-primary">{icon}</span>
        {title}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

export function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <Panel className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {headers.map((h) => (
                <th key={h} className="text-left p-3.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Panel>
  );
}
