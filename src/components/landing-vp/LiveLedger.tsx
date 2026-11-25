import { useEffect, useState } from "react";
import { ArrowDownLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXAMPLE_SALES } from "./landingData";
import { brlFromCents } from "./splitMath";
import { useCountUp, usePrefersReducedMotion } from "./motion";

const FIRST_DELAY = 900;
const STEP = 1250;

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

/**
 * Cena única do topo: o painel de um dia de exemplo. As vendas chegam uma a uma e o total do dia sobe.
 * Roda uma vez e para (nada em loop). Com movimento reduzido, mostra o dia pronto.
 */
export function LiveLedger() {
  const reduce = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduce ? EXAMPLE_SALES.length : 0);

  useEffect(() => {
    if (reduce) { setShown(EXAMPLE_SALES.length); return; }
    const timers: number[] = [];
    EXAMPLE_SALES.forEach((_, i) => { timers.push(window.setTimeout(() => setShown(i + 1), FIRST_DELAY + i * STEP)); });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduce]);

  const visible = EXAMPLE_SALES.slice(0, shown);
  const paidTotal = visible.filter((s) => s.paid).reduce((sum, s) => sum + s.cents, 0);
  const paidCount = visible.filter((s) => s.paid).length;
  const waiting = visible.filter((s) => !s.paid).length;
  const total = useCountUp(paidTotal, reduce);

  const finalPaid = EXAMPLE_SALES.filter((s) => s.paid);
  const summary = `Exemplo de um dia: ${finalPaid.length} vendas pagas somando ${brlFromCents(finalPaid.reduce((a, s) => a + s.cents, 0))} e 1 boleto aguardando pagamento.`;

  return (
    <figure className="relative m-0" aria-label="Exemplo do painel Vemprapay">
      <p className="sr-only">{summary}</p>
      <div aria-hidden="true">
        <div className="vp-balance relative z-0 px-6 pb-14 pt-6 sm:px-7">
          <p className="text-[14px] font-semibold opacity-85">Vendas pagas hoje</p>
          <p className="mt-1.5"><BigMoney cents={total} /></p>
          <p className="mt-2 text-[13.5px] font-medium opacity-80">
            {paidCount === 0 ? "Esperando a primeira venda" : `${paidCount} ${paidCount === 1 ? "venda paga" : "vendas pagas"}${waiting ? `, ${waiting} aguardando` : ""}`}
          </p>
        </div>

        <div className="lp-feed relative z-10 -mt-9 ml-4 sm:ml-10">
          {EXAMPLE_SALES.map((s, i) => {
            const state = i < shown ? "in" : "wait";
            const initial = s.who.slice(0, 1);
            return (
              <div key={i} className={cn("lp-row", i === 0 && "rounded-t-[22px]", i === EXAMPLE_SALES.length - 1 && "rounded-b-[22px]")} data-state={state}>
                <span className="lp-avatar">{initial}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-bold leading-tight text-foreground">{s.who}</span>
                  <span className="block truncate text-[12.5px] leading-snug text-muted-foreground">{s.what}, {s.method}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-[14.5px] font-extrabold tabular-nums text-foreground">{s.paid ? "+ " : ""}{brlFromCents(s.cents)}</span>
                  {s.paid
                    ? <span className="lp-pill lp-pill-ok"><ArrowDownLeft className="h-3 w-3" strokeWidth={3} />Paga</span>
                    : <span className="lp-pill lp-pill-wait"><Clock className="h-3 w-3" strokeWidth={3} />Aguardando</span>}
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
