import { ArrowDownToLine, Eye, EyeOff, FileText, Link2, QrCode, TrendingDown, TrendingUp } from "lucide-react";
import { Money } from "./Money";
import { cn } from "@/lib/utils";

export interface HeroBalanceProps {
  available: number;
  pending: number;
  disputed: number;
  trend?: number;
  hidden: boolean;
  onTogglePrivacy: () => void;
  onPix: () => void;
  onWithdraw: () => void;
  onCharge: () => void;
  onMore: () => void;
}

/** Posição de caixa: saldo total, decomposição em três colunas e ações operacionais. */
export function HeroBalance(p: HeroBalanceProps) {
  const available = Math.max(p.available, 0);
  const total = available + p.pending + p.disputed;
  const up = (p.trend ?? 0) >= 0;
  const parts = [
    { label: "Disponível", hint: "Pronto para saque", value: available, tone: "bg-[hsl(var(--vp-glow))]" },
    { label: "A liberar", hint: "Em compensação", value: p.pending, tone: "bg-muted-foreground" },
    { label: "Em análise", hint: "MED / reserva", value: p.disputed, tone: "bg-warning" },
  ];
  const actions = [
    { label: "Sacar", icon: ArrowDownToLine, onClick: p.onWithdraw, main: true },
    { label: "Cobrar Pix", icon: QrCode, onClick: p.onPix },
    { label: "Link de pagamento", icon: Link2, onClick: p.onCharge },
    { label: "Integrações", icon: FileText, onClick: p.onMore },
  ];

  return (
    <section className="vp-desk grid lg:grid-cols-[minmax(0,1fr)_300px]" aria-label="Posição de saldo">
      <div className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="vp-label">Posição total</span>
          <button onClick={p.onTogglePrivacy} aria-label={p.hidden ? "Mostrar valores" : "Ocultar valores"}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            {p.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{p.hidden ? "Mostrar" : "Ocultar"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
          <Money value={total} hidden={p.hidden} className="text-[38px] font-bold leading-none tracking-tight text-foreground md:text-[46px]" />
          {p.trend !== undefined && (
            <span className={cn("mb-1 inline-flex items-center gap-1 text-[12.5px] font-semibold vp-num", up ? "vp-glow-text" : "text-destructive")}>
              {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{up ? "+" : "−"}{Math.abs(p.trend)}% vs período anterior
            </span>
          )}
        </div>

        <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-sm bg-muted" aria-hidden>
          {total > 0 && parts.map((x) => <span key={x.label} className={x.tone} style={{ width: `${(x.value / total) * 100}%` }} />)}
        </div>

        <dl className="mt-4 vp-desk-split divide-x divide-border border-t border-border pt-4">
          {parts.map((x, i) => (
            <div key={x.label} className={cn("min-w-0", i > 0 && "pl-3 md:pl-5")}>
              <dt className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><span className={cn("h-2 w-2 rounded-[2px]", x.tone)} />{x.label}</dt>
              <dd className="mt-1"><Money value={x.value} hidden={p.hidden} className="text-[14px] font-semibold text-foreground md:text-[18px]" /></dd>
              <dd className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">{x.hint}</dd>
            </div>
          ))}
        </dl>
      </div>

      <nav className="grid grid-cols-2 border-t border-border lg:grid-cols-1 lg:border-l lg:border-t-0" aria-label="Ações rápidas">
        {actions.map((a, i) => (
          <button key={a.label} onClick={a.onClick}
            className={cn("group flex items-center gap-3 px-5 py-3.5 text-left text-[13.5px] font-semibold transition-colors",
              i % 2 === 1 && "border-l border-border lg:border-l-0", i > 1 && "border-t border-border", i === 1 && "lg:border-t",
              a.main ? "bg-[hsl(var(--vp-glow))] text-primary-foreground hover:brightness-110" : "text-foreground hover:bg-muted/60")}>
            <a.icon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
            <span className="flex-1 truncate">{a.label}</span>
            <span className={cn("text-[11px] opacity-50 transition-transform group-hover:translate-x-0.5")}>→</span>
          </button>
        ))}
      </nav>
    </section>
  );
}
