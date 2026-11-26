import { useEffect, useState } from "react";
import { ArrowDownLeft, Clock } from "lucide-react";
import { EXAMPLE_SALES, HERO_ROWS } from "./landingData";
import { brlFromCents } from "./splitMath";
import { useCountUp, usePrefersReducedMotion } from "./motion";

/** Quando cada venda nova chega e quando o boleto é pago (ms desde a abertura da página). */
const ARRIVALS = [1300, 3000];
const BOLETO_PAID_AT = 4800;

/** Parte inteira grande e centavos pequenos, como no painel. */
function BigMoney({ cents }: { cents: number }) {
  const [int, dec] = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(",");
  return (
    <span className="tabular-nums">
      <span className="mr-1.5 text-[clamp(1.1rem,2.4vw,1.4rem)] font-bold opacity-80">R$</span>
      <span className="text-[clamp(2.6rem,6vw,3.6rem)] font-extrabold tracking-[-0.045em]">{int}</span>
      <span className="text-[clamp(1.1rem,2.4vw,1.5rem)] font-bold opacity-75">,{dec}</span>
    </span>
  );
}

const isPaid = (index: number, boletoPaid: boolean) => EXAMPLE_SALES[index].paid || (boletoPaid && !!EXAMPLE_SALES[index].paysLater);

/**
 * Cena única do topo: o painel de um dia de exemplo. O cartão já abre cheio (o dia começou);
 * duas vendas novas chegam por cima, empurrando as antigas, e o boleto que estava aguardando é pago.
 * Roda uma vez e para. Com movimento reduzido, mostra o fim da cena direto.
 */
export function LiveLedger() {
  const reduce = usePrefersReducedMotion();
  const [arrived, setArrived] = useState(reduce ? EXAMPLE_SALES.length : HERO_ROWS);
  const [boletoPaid, setBoletoPaid] = useState(reduce);

  useEffect(() => {
    if (reduce) { setArrived(EXAMPLE_SALES.length); setBoletoPaid(true); return undefined; }
    const timers = ARRIVALS.map((at, i) => window.setTimeout(() => setArrived(HERO_ROWS + i + 1), at));
    timers.push(window.setTimeout(() => setBoletoPaid(true), BOLETO_PAID_AT));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduce]);

  const indexes = Array.from({ length: arrived }, (_, i) => i);
  const paidIndexes = indexes.filter((i) => isPaid(i, boletoPaid));
  const paidTotal = paidIndexes.reduce((sum, i) => sum + EXAMPLE_SALES[i].cents, 0);
  const waiting = arrived - paidIndexes.length;
  const total = useCountUp(paidTotal, reduce);
  // Mais nova em cima. Uma linha a mais que o cartão comporta: a que sai fica escondida embaixo.
  const rows = indexes.slice().reverse().slice(0, HERO_ROWS + 1);

  const finalTotal = EXAMPLE_SALES.reduce((sum, s) => sum + s.cents, 0);
  const summary = `Exemplo de um dia: ${EXAMPLE_SALES.length} vendas pagas somando ${brlFromCents(finalTotal)}, entre elas um boleto que foi pago depois.`;

  return (
    <figure className="relative m-0" aria-label="Exemplo do painel Vemprapay">
      <p className="sr-only">{summary}</p>
      <div aria-hidden="true">
        <div className="vp-balance relative z-0 px-6 pb-14 pt-6 sm:px-7">
          <p className="text-[14px] font-semibold opacity-85">Vendas pagas hoje</p>
          <p className="mt-1.5"><BigMoney cents={total} /></p>
          <p className="mt-2 text-[13.5px] font-medium opacity-80">
            {paidIndexes.length} {paidIndexes.length === 1 ? "venda paga" : "vendas pagas"}{waiting ? `, ${waiting} aguardando` : ""}
          </p>
        </div>

        <div className="lp-feed relative z-10 -mt-9 ml-4 sm:ml-10">
          {rows.map((i) => {
            const sale = EXAMPLE_SALES[i];
            const paid = isPaid(i, boletoPaid);
            return (
              <div key={i} className="lp-row" data-enter={i >= HERO_ROWS ? "" : undefined} data-flash={sale.paysLater && boletoPaid && !reduce ? "" : undefined}>
                <span className="lp-avatar">{sale.who.slice(0, 1)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-bold leading-tight text-foreground">{sale.who}</span>
                  <span className="block truncate text-[12.5px] leading-snug text-muted-foreground">{sale.what}, {sale.method}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-[14.5px] font-extrabold tabular-nums text-foreground">{paid ? "+ " : ""}{brlFromCents(sale.cents)}</span>
                  {paid
                    ? <span key="paid" className="lp-pill lp-pill-ok" data-pop={sale.paysLater ? "" : undefined}><ArrowDownLeft className="h-3 w-3" strokeWidth={3} />Paga</span>
                    : <span key="wait" className="lp-pill lp-pill-wait"><Clock className="h-3 w-3" strokeWidth={3} />Aguardando</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="mt-4 pl-4 text-[12.5px] text-muted-foreground sm:pl-10">Vendas e valores de exemplo.</figcaption>
    </figure>
  );
}
