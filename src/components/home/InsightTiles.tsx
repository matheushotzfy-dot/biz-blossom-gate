import { Money } from "./Money";

export interface InsightTilesProps {
  ticket: number; conversion: number; pixRate: number; cardRate: number;
  todayRevenue: number; todayOrders: number; hidden: boolean;
}

function Cell({ label, children, foot }: { label: string; children: React.ReactNode; foot: React.ReactNode }) {
  return (
    <div className="min-w-0 p-4 md:p-5">
      <p className="vp-label">{label}</p>
      <div className="mt-2 text-[22px] font-bold leading-none text-foreground md:text-[24px]">{children}</div>
      <div className="mt-2 text-[12px] text-muted-foreground">{foot}</div>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return <span className="mt-2 block h-1 w-full overflow-hidden rounded-sm bg-muted"><span className="block h-full bg-[hsl(var(--vp-glow))]" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} /></span>;
}

/** Régua de telemetria: quatro células conectadas por linhas finas. */
export function InsightTiles(p: InsightTilesProps) {
  return (
    <section className="vp-desk grid grid-cols-2 divide-border lg:grid-cols-4 [&>*:nth-child(odd)]:border-r [&>*:nth-child(n+3)]:border-t lg:[&>*]:border-t-0 lg:[&>*:not(:last-child)]:border-r [&>*]:border-border" aria-label="Indicadores">
      <Cell label="Hoje" foot={<span className="vp-num">{p.todayOrders} {p.todayOrders === 1 ? "pedido pago" : "pedidos pagos"}</span>}>
        <Money value={p.todayRevenue} hidden={p.hidden} />
      </Cell>
      <Cell label="Ticket médio" foot="Por venda paga no período"><Money value={p.ticket} hidden={p.hidden} /></Cell>
      <Cell label="Aprovação geral" foot={<Bar value={p.conversion} />}><span className="vp-num">{p.conversion}%</span></Cell>
      <Cell label="Por método" foot={<span className="vp-num">Pix {p.pixRate}% · Cartão {p.cardRate}%</span>}>
        <span className="vp-num">{p.pixRate}<span className="text-[0.6em] text-muted-foreground">% pix</span></span>
      </Cell>
    </section>
  );
}
