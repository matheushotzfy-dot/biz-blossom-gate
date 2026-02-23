import React from "react";

/** Shared page wrapper that applies the themed background + fade-in to all sub-pages */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="space-y-5 relative pb-8 min-h-screen animate-fade-in"
      style={{ background: "var(--page-bg)" }}
    >
      {/* Ambient mesh */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute w-[700px] h-[700px] -top-[250px] -left-[150px] rounded-full" style={{ background: `radial-gradient(circle, var(--mesh-green), transparent 70%)`, opacity: "var(--mesh-opacity)" }} />
        <div className="absolute w-[500px] h-[500px] bottom-[-150px] right-[-100px] rounded-full" style={{ background: `radial-gradient(circle, var(--mesh-blue), transparent 70%)`, opacity: "var(--mesh-opacity)" }} />
      </div>
      {children}
    </div>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 relative overflow-hidden transition-all duration-500 ${className || ""}`}
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(20px)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: "var(--top-line)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}

export function PageTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
        <span className="text-primary">{icon}</span>
        {title}
      </h1>
      <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

export function DataTable({ headers, children, emptyMessage }: { headers: string[]; children: React.ReactNode; emptyMessage?: string }) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--glass-separator)" }}>
              {headers.map((h) => (
                <th key={h} className="text-left p-3.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Panel>
  );
}
