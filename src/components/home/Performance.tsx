import { Money } from "./Money";

export interface PerformanceProps {
  /** Taxa de aprovação geral, em %. */
  conversion: number;
  pixRate: number;
  cardRate: number;
  ticket: number;
  /** Pagamentos aprovados no período. */
  orders: number;
  /** Pagamentos tentados no período (aprovados ou não). */
  attempts: number;
  /** Houve tentativas de pagamento no período? Sem elas, a taxa não significa nada. */
  hasData: boolean;
  hidden: boolean;
  loading: boolean;
}

const R = 52;
const C = 2 * Math.PI * R;

/** Qualidade da cobrança: aprovação (anel), Pix × cartão (barras) e os números que a explicam. */
export function Performance(p: PerformanceProps) {
  const pct = Math.min(Math.max(p.conversion, 0), 100);

  return (
    <section className="vp-sheet flex flex-col p-6 sm:p-7" aria-label="Aprovação de pagamentos">
      <h2 className="text-[19px] font-extrabold tracking-[-0.025em] text-foreground">Aprovação de pagamentos</h2>
      <p className="mt-0.5 text-[13.5px] text-muted-foreground">Aprovados sobre o total tentado no período</p>

      {p.loading ? (
        <div className="mt-6 space-y-4"><div className="vp-skel h-[128px] w-full" /><div className="vp-skel h-24 w-full" /></div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-6">
            <div className="relative h-[128px] w-[128px] shrink-0" role="img" aria-label={p.hasData ? `Taxa de aprovação ${pct}%` : "Sem pagamentos no período"}>
              <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
                <circle cx="64" cy="64" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="11" />
                {p.hasData && pct > 0 && (
                  <circle cx="64" cy="64" r={R} fill="none" stroke="hsl(var(--primary))" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} />
                )}
              </svg>
              <span className="absolute inset-0 grid place-items-center text-[30px] font-extrabold tracking-[-0.04em] text-foreground vp-num">
                {p.hasData ? `${pct}%` : "—"}
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-5">
              <Bar label="Pix" value={p.pixRate} on={p.hasData} />
              <Bar label="Cartão" value={p.cardRate} on={p.hasData} />
            </div>
          </div>

          <div className="mt-auto pt-7">
            <dl className="divide-y divide-border border-t border-border">
              <Row label="Pagamentos tentados"><span className="vp-num">{p.attempts}</span></Row>
              <Row label="Pagamentos aprovados"><span className="vp-num">{p.orders}</span></Row>
              <Row label="Ticket médio"><Money value={p.ticket} hidden={p.hidden} centsClassName="opacity-60" /></Row>
            </dl>
          </div>
        </>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <dt className="text-[14px] text-muted-foreground">{label}</dt>
      <dd className="text-[17px] font-extrabold tracking-[-0.03em] text-foreground">{children}</dd>
    </div>
  );
}

function Bar({ label, value, on }: { label: string; value: number; on: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[14px]">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-bold tabular-nums text-foreground">{on ? `${value}%` : "—"}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: on ? `${Math.min(Math.max(value, 0), 100)}%` : "0%" }} />
      </div>
    </div>
  );
}
