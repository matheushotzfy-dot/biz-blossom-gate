import { Gauge, Radio, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Money } from "./Money";

export interface InsightTilesProps {
  ticket: number; conversion: number; pixRate: number; cardRate: number;
  todayRevenue: number; todayOrders: number; hidden: boolean;
}

function Tile({ icon: Icon, label, children, foot }: { icon: LucideIcon; label: string; children: React.ReactNode; foot: React.ReactNode }) {
  return (
    <div className="vp-glass flex items-center gap-4 p-5">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-muted text-foreground"><Icon className="h-6 w-6" strokeWidth={2} /></span>
      <div className="min-w-0">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-[24px] font-extrabold leading-tight text-foreground">{children}</div>
        <p className="mt-0.5 text-[12.5px]">{foot}</p>
      </div>
    </div>
  );
}

/** Três leituras rápidas: hoje, ticket médio e aprovação. */
export function InsightTiles(p: InsightTilesProps) {
  return (
    <section className="grid gap-4 md:grid-cols-3" aria-label="Indicadores">
      <Tile icon={Radio} label="Vendas de hoje" foot={<span className="vp-glow-text font-semibold">{p.todayOrders} {p.todayOrders === 1 ? "pedido pago" : "pedidos pagos"}</span>}>
        <Money value={p.todayRevenue} hidden={p.hidden} centsClassName="opacity-100 text-[1em]" />
      </Tile>
      <Tile icon={Receipt} label="Ticket médio" foot={<span className="text-muted-foreground">Média por venda paga</span>}>
        <Money value={p.ticket} hidden={p.hidden} centsClassName="opacity-100 text-[1em]" />
      </Tile>
      <Tile icon={Gauge} label="Taxa de aprovação" foot={<span className="text-muted-foreground">Pix {p.pixRate}% · Cartão {p.cardRate}%</span>}>
        <span className="vp-num">{p.conversion}%</span>
      </Tile>
    </section>
  );
}
