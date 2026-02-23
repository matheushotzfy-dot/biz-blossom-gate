import React from "react";

/** Shared page wrapper that applies the cinematic background + fade-in to all sub-pages */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="space-y-5 relative pb-8 min-h-screen animate-fade-in"
      style={{
        background: "linear-gradient(165deg, #080c18 0%, #0d1225 30%, #0a0f1e 60%, #0c1029 100%)",
      }}
    >
      {/* Ambient mesh */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute w-[700px] h-[700px] -top-[250px] -left-[150px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, #00FFA3, transparent 70%)" }} />
        <div className="absolute w-[500px] h-[500px] bottom-[-150px] right-[-100px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #0094FF, transparent 70%)" }} />
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
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}

export function PageTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-tight text-white flex items-center gap-2.5">
        <span style={{ color: "#00FFA3" }}>{icon}</span>
        {title}
      </h1>
      <p className="text-[13px] text-white/30 mt-1">{subtitle}</p>
    </div>
  );
}

export function DataTable({ headers, children, emptyMessage }: { headers: string[]; children: React.ReactNode; emptyMessage?: string }) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {headers.map((h) => (
                <th key={h} className="text-left p-3.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Panel>
  );
}
