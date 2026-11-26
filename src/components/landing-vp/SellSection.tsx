import { useId, useMemo, useState } from "react";
import { maskBRL, parseBRL } from "@/components/seller-ui/money";
import { SELL_FEATURES } from "./landingData";
import { AFF_MAX, CO_MAX, brlFromCents, computeSplit } from "./splitMath";
import { Tight } from "./Tight";

const COLORS = { owner: "hsl(var(--primary))", partner: "hsl(222 47% 11%)", affiliate: "hsl(var(--warning))" } as const;

/**
 * Divisão de uma venda (espelha apply_transaction_splits): cada parte é uma barra do tamanho do que recebe,
 * para a conta se ler de relance. A taxa da forma de pagamento sai antes e não entra aqui (valor líquido).
 */
export function SplitCalculator() {
  const uid = useId();
  const [net, setNet] = useState("100,00");
  const [co, setCo] = useState(30);
  const [aff, setAff] = useState(10);

  const cents = Math.round(parseBRL(net) * 100);
  const split = useMemo(() => computeSplit(cents, co, aff), [cents, co, aff]);
  const total = split.owner + split.partner + split.affiliate;
  const rows = [
    { key: "owner", label: "Você", value: split.owner, color: COLORS.owner },
    { key: "partner", label: co > 0 ? `Coprodutor, ${co}%` : "Coprodutor", value: split.partner, color: COLORS.partner },
    { key: "affiliate", label: aff > 0 ? `Afiliado, ${aff}%` : "Afiliado", value: split.affiliate, color: COLORS.affiliate },
  ] as const;

  return (
    <div className="lp-spec p-6 sm:p-8">
      <label htmlFor={`${uid}-net`} className="mb-2 block text-[13.5px] font-bold text-foreground">Valor líquido da venda</label>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.05rem] font-bold text-muted-foreground">R$</span>
        <input id={`${uid}-net`} className="lp-field !pl-12 tabular-nums" inputMode="numeric" autoComplete="off" value={net} onChange={(e) => setNet(maskBRL(e.target.value))} />
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${uid}-co`} className="text-[13.5px] font-bold text-foreground">Coprodutor</label>
            <output htmlFor={`${uid}-co`} className="text-[14px] font-extrabold tabular-nums text-foreground">{co}%</output>
          </div>
          <input id={`${uid}-co`} type="range" min={0} max={CO_MAX} step={1} value={co} onChange={(e) => setCo(Number(e.target.value))} className="lp-range mt-1" aria-valuetext={co === 0 ? "Sem coprodutor" : `${co} por cento`} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${uid}-aff`} className="text-[13.5px] font-bold text-foreground">Afiliado</label>
            <output htmlFor={`${uid}-aff`} className="text-[14px] font-extrabold tabular-nums text-foreground">{aff}%</output>
          </div>
          <input id={`${uid}-aff`} type="range" min={0} max={AFF_MAX} step={1} value={aff} onChange={(e) => setAff(Number(e.target.value))} className="lp-range mt-1" aria-valuetext={aff === 0 ? "Sem afiliado" : `${aff} por cento`} />
        </div>
      </div>

      <ul className="lp-split" aria-live="polite">
        {rows.map((r) => (
          <li key={r.key} className="lp-split-row">
            <span className="lp-split-label">{r.label}</span>
            <span className="lp-split-track" aria-hidden>
              <i style={{ width: `${total > 0 ? (r.value / total) * 100 : 0}%`, background: r.color }} />
            </span>
            <span className="lp-split-value tabular-nums">{brlFromCents(r.value)}</span>
          </li>
        ))}
      </ul>
      {split.capped && (
        <p className="mt-4 rounded-[14px] bg-accent px-4 py-3 text-[13.5px] leading-snug text-accent-foreground">
          A comissão do afiliado nunca passa do que sobra depois do coprodutor, por isso ela foi reduzida.
        </p>
      )}
      <p className="mt-5 text-[13px] leading-snug text-muted-foreground">Coprodução vai de 1% a 99% e afiliado de 1% a 90%. Uma conta de exemplo, sem taxas.</p>
    </div>
  );
}

export function SellSection() {
  return (
    <section id="vender" className="bg-card py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div id="divisao" className="grid gap-12 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div>
            <h2 className="lp-h2 max-w-[16ch] text-foreground"><Tight>Para onde vai cada real.</Tight></h2>
            <p className="mt-6 max-w-[30rem] text-[17px] leading-[1.7] text-muted-foreground">
              A taxa da forma de pagamento sai primeiro, e a tabela fica no seu painel, em Financeiro, na página Taxas. O que sobra é dividido entre você, o coprodutor e o afiliado.
            </p>
            <p className="mt-4 max-w-[30rem] text-[17px] leading-[1.7] text-muted-foreground">
              Cada parte cai no saldo de quem recebe quando a venda é aprovada, e vira um lançamento no extrato de cada um. Ninguém precisa de planilha para acertar no fim do mês.
            </p>
          </div>
          <SplitCalculator />
        </div>

        <h2 className="lp-h2 mt-28 max-w-[20ch] text-foreground sm:mt-32"><Tight>Tudo o que vem na conta.</Tight></h2>
        <dl className="lp-kit">
          {SELL_FEATURES.map((f) => (
            <div key={f.t} className="lp-kit-item">
              <dt className="text-[1.1rem] font-extrabold tracking-[-0.025em] text-foreground">{f.t}</dt>
              <dd className="m-0 mt-1.5 text-[15.5px] leading-[1.65] text-muted-foreground">{f.d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
