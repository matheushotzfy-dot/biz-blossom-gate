import { useId, useMemo, useState } from "react";
import { maskBRL, parseBRL } from "@/components/seller-ui/money";
import { SELL_FEATURES } from "./landingData";
import { AFF_MAX, CO_MAX, brlFromCents, computeSplit } from "./splitMath";
import { RULE_BELOW, RULE_BOTH, line } from "./lines";
import { Tight } from "./Tight";

const COLORS = { owner: "hsl(var(--primary))", partner: "hsl(222 47% 11%)", affiliate: "hsl(var(--warning))" } as const;

export function SplitCalculator() {
  const uid = useId();
  const [net, setNet] = useState("100,00");
  const [co, setCo] = useState(30);
  const [aff, setAff] = useState(10);

  const cents = Math.round(parseBRL(net) * 100);
  const split = useMemo(() => computeSplit(cents, co, aff), [cents, co, aff]);
  const rows = [
    { key: "owner", label: "Você", value: split.owner, color: COLORS.owner },
    { key: "partner", label: co > 0 ? `Coprodutor, ${co}%` : "Coprodutor", value: split.partner, color: COLORS.partner },
    { key: "affiliate", label: aff > 0 ? `Afiliado, ${aff}%` : "Afiliado", value: split.affiliate, color: COLORS.affiliate },
  ] as const;

  return (
    <div className="lp-spec p-6 sm:p-8">
      <h3 className="text-[1.35rem] font-extrabold tracking-[-0.03em] text-foreground">Divida uma venda e veja a conta</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
        A divisão é feita sobre o valor líquido, depois das taxas, e cada parte cai no saldo de quem recebe quando a venda é aprovada.
      </p>

      <div className="mt-6">
        <label htmlFor={`${uid}-net`} className="mb-2 block text-[13.5px] font-bold text-foreground">Valor líquido da venda</label>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.05rem] font-bold text-muted-foreground">R$</span>
          <input id={`${uid}-net`} className="lp-field !pl-12 tabular-nums" inputMode="numeric" autoComplete="off" value={net} onChange={(e) => setNet(maskBRL(e.target.value))} />
        </div>
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

      <div className="lp-bar mt-6" aria-hidden="true">
        {rows.map((r) => <i key={r.key} style={{ flexGrow: r.value, flexBasis: 0, background: r.color, marginRight: r.value === 0 ? -2 : 0 }} />)}
      </div>

      <ul className="m-0 mt-5 grid gap-3 p-0" style={{ listStyle: "none" }} aria-live="polite">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 text-[15px]">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
            <span className="flex-1 font-semibold text-foreground">{r.label}</span>
            <span className="text-[1.05rem] font-extrabold tabular-nums text-foreground">{brlFromCents(r.value)}</span>
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
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <h2 className="max-w-[40rem] text-[clamp(2rem,4.2vw,3.1rem)] font-extrabold leading-[1.07] tracking-[-0.04em] text-foreground">
          <Tight>Venda do seu jeito. Divida sem planilha.</Tight>
        </h2>
        <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <dl className="m-0 grid">
            {SELL_FEATURES.map((f, i) => (
              <div key={f.t} className="lp-line py-5" style={line(i === 0 ? RULE_BOTH : RULE_BELOW)}>
                <dt className="text-[1.15rem] font-extrabold tracking-[-0.025em] text-foreground">{f.t}</dt>
                <dd className="m-0 mt-1.5 max-w-[32rem] text-[15.5px] leading-[1.65] text-muted-foreground">{f.d}</dd>
              </div>
            ))}
          </dl>
          <div className="lg:pt-0">
            <SplitCalculator />
          </div>
        </div>
      </div>
    </section>
  );
}
