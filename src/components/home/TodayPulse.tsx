import { cn } from "@/lib/utils";
import { Money } from "./Money";

export interface HourPoint { label: string; revenue: number; orders: number }

export interface TodayPulseProps {
  revenue: number;
  orders: number;
  /** 24 pontos, um por hora do dia. */
  hours: HourPoint[];
  /** Hora atual (0–23) em São Paulo — as seguintes ainda não aconteceram. */
  nowHour: number;
  hidden: boolean;
  loading: boolean;
  onCreateLink: () => void;
}

const AXIS = [0, 6, 12, 18, 23];

/** Vendas de hoje: uma barra por hora. Sem vendas, vira um convite para a primeira cobrança. */
export function TodayPulse(p: TodayPulseProps) {
  const max = Math.max(...p.hours.map((h) => h.revenue), 0);
  const empty = !p.loading && p.orders === 0;

  return (
    <section className="vp-sheet flex flex-col p-6" aria-label="Vendas de hoje">
      <header className="flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold tracking-[-0.02em] text-foreground">Vendas de hoje</h2>
        <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground">
          <span className="vp-live" aria-hidden />Ao vivo
        </span>
      </header>

      {p.loading ? (
        <div className="mt-5 space-y-4"><div className="vp-skel h-10 w-40" /><div className="vp-skel h-24 w-full" /></div>
      ) : (
        <>
          <Money value={p.revenue} hidden={p.hidden} className="mt-4 block text-[36px] font-extrabold leading-none tracking-[-0.04em] text-foreground" centsClassName="opacity-60" />
          <p className="mt-2 text-[13.5px] text-muted-foreground">
            {empty ? "Nenhuma venda paga até agora" : `${p.orders} ${p.orders === 1 ? "pedido pago" : "pedidos pagos"}`}
          </p>

          <div className="mt-auto pt-6">
            <div className="flex h-[88px] items-end gap-[3px]" role="img" aria-label={empty ? "Sem vendas hoje" : "Vendas por hora de hoje"}>
              {p.hours.map((h, i) => {
                const future = i > p.nowHour;
                const pct = max > 0 && h.revenue > 0 ? Math.max(14, Math.round((h.revenue / max) * 100)) : 0;
                return (
                  <span key={i} className="relative flex h-full flex-1 items-end" title={p.hidden ? undefined : `${h.label}: ${h.orders} ${h.orders === 1 ? "pedido" : "pedidos"}`}>
                    {pct > 0
                      ? <span className="w-full rounded-[3px] bg-primary" style={{ height: `${pct}%` }} />
                      : <span className={cn("w-full rounded-full", future ? "h-[3px] bg-muted" : "h-[3px] bg-border")} />}
                    {i === p.nowHour && <span aria-hidden className="absolute -bottom-[9px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-foreground" />}
                  </span>
                );
              })}
            </div>
            <div className="relative mt-3 h-4 text-[11.5px] text-muted-foreground" aria-hidden>
              {AXIS.map((h) => (
                <span key={h} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${((h + 0.5) / 24) * 100}%` }}>{h}h</span>
              ))}
            </div>
            {empty && (
              <button onClick={p.onCreateLink} className="vp-green-ink mt-3 text-[13.5px] font-bold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                Criar um link de pagamento
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
