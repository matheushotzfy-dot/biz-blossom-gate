import { Handshake, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneTag } from "@/features/admin-products/parts";
import { brl } from "@/features/admin-finance/types";
import { affiliateState, conversionLabel, pctLabel, productProgramState, refundAttention, type AffiliateItem, type ProductItem } from "./affiliatesModel";

const int = (v: number) => v.toLocaleString("pt-BR");
const plural = (n: number, one: string, many: string) => `${int(n)} ${n === 1 ? one : many}`;
const TH = "whitespace-nowrap px-3 py-3";

/* ───────── visão por afiliado ───────── */

const Name = ({ a }: { a: AffiliateItem }) => (
  <div className="flex min-w-0 items-center gap-3">
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-muted text-muted-foreground"><Handshake className="h-[18px] w-[18px]" /></span>
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-foreground" title={a.name}>{a.name}</p>
      <p className="truncate text-[13px] text-muted-foreground" title={a.email ?? undefined}>{a.email ?? "Sem e-mail"}</p>
    </div>
  </div>
);

function State({ a }: { a: AffiliateItem }) {
  const st = affiliateState(a);
  const attention = refundAttention(a);
  return (
    <div className="space-y-1.5">
      <ToneTag tone={st.tone}>{st.label}</ToneTag>
      <p className="text-[12.5px] text-muted-foreground">
        {a.links_held > 0 ? plural(a.links_held, "link pausado", "links pausados") : `${plural(a.links_active, "link no ar", "links no ar")} de ${int(a.links)}`}
      </p>
      {a.hold_reason && <p className="line-clamp-2 max-w-[190px] text-[12.5px] text-muted-foreground">Motivo: {a.hold_reason}</p>}
      {attention && <p className="text-[12.5px] font-medium text-warning">{attention}</p>}
    </div>
  );
}

const Reach = ({ a }: { a: AffiliateItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{plural(a.clicks, "clique", "cliques")}</p>
    <p className="text-[12.5px] text-muted-foreground">{plural(a.products, "produto", "produtos")} · {plural(a.sellers, "seller", "sellers")}</p>
  </>
);

const Sales = ({ a }: { a: AffiliateItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{plural(a.sales, "venda paga", "vendas pagas")}</p>
    <p className="text-[12.5px] text-muted-foreground">{a.refunded > 0 ? `${plural(a.refunded, "estornada", "estornadas")} · ` : ""}{conversionLabel(a.sales, a.clicks)}</p>
  </>
);

const Earned = ({ a }: { a: AffiliateItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{brl(a.commission)}</p>
    <p className="text-[12.5px] text-muted-foreground">{a.reversed > 0 ? `${brl(a.reversed)} estornados` : `de ${brl(a.revenue)} vendidos`}</p>
  </>
);

const Action = ({ a, onOpen }: { a: AffiliateItem; onOpen: (a: AffiliateItem) => void }) => (
  <Button type="button" size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => onOpen(a)} aria-label={`Ver ${a.name}`}>Detalhes</Button>
);

export function AffiliatesTable({ rows, onOpen }: { rows: AffiliateItem[]; onOpen: (a: AffiliateItem) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Afiliado", "Situação", "Alcance", "Vendas", "Comissão", ""].map((h, i) => <th key={h + i} className={TH}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.user_id} className="border-b border-border/40 align-middle last:border-b-0">
              <td className="max-w-[200px] px-3 py-3"><Name a={a} /></td>
              <td className="px-3 py-3"><State a={a} /></td>
              <td className="whitespace-nowrap px-3 py-3"><Reach a={a} /></td>
              <td className="whitespace-nowrap px-3 py-3"><Sales a={a} /></td>
              <td className="whitespace-nowrap px-3 py-3"><Earned a={a} /></td>
              <td className="px-3 py-3 text-right"><Action a={a} onOpen={onOpen} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AffiliatesCards({ rows, onOpen }: { rows: AffiliateItem[]; onOpen: (a: AffiliateItem) => void }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((a) => (
        <li key={a.user_id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <Name a={a} />
          <State a={a} />
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 border-t border-border/40 pt-3">
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Vendas</dt><dd><Sales a={a} /></dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Comissão</dt><dd><Earned a={a} /></dd></div>
          </dl>
          <div className="flex justify-end"><Action a={a} onOpen={onOpen} /></div>
        </li>
      ))}
    </ul>
  );
}

/* ───────── visão por produto (somente leitura) ───────── */

const PName = ({ p }: { p: ProductItem }) => (
  <div className="flex min-w-0 items-center gap-3">
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-muted text-muted-foreground"><Package className="h-[18px] w-[18px]" /></span>
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-foreground" title={p.name}>{p.name}</p>
      <p className="truncate text-[13px] text-muted-foreground" title={p.seller_email ?? undefined}>{p.seller_name}</p>
    </div>
  </div>
);

const PState = ({ p }: { p: ProductItem }) => {
  const st = productProgramState(p);
  return (
    <div className="space-y-1.5">
      <ToneTag tone={st.tone}>{st.label}</ToneTag>
      <p className="text-[12.5px] text-muted-foreground">Comissão {pctLabel(p.commission_pct)}{p.price != null ? ` · produto de ${brl(p.price)}` : ""}</p>
    </div>
  );
};

const PReach = ({ p }: { p: ProductItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{plural(p.affiliates, "afiliado", "afiliados")}</p>
    <p className="text-[12.5px] text-muted-foreground">{plural(p.links_active, "link no ar", "links no ar")} de {int(p.links)} · {plural(p.clicks, "clique", "cliques")}</p>
  </>
);

const PSales = ({ p }: { p: ProductItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{plural(p.sales, "venda paga", "vendas pagas")}</p>
    <p className="text-[12.5px] text-muted-foreground">{p.refunded > 0 ? `${plural(p.refunded, "estornada", "estornadas")} · ` : ""}{brl(p.revenue)} vendidos</p>
  </>
);

const PPaid = ({ p }: { p: ProductItem }) => (
  <p className="text-[14px] font-semibold tabular-nums text-foreground">{brl(p.commission)}</p>
);

export function ProductsTable({ rows }: { rows: ProductItem[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Produto e seller", "Programa", "Afiliados", "Vendas", "Comissão paga"].map((h) => <th key={h} className={TH}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.product_id} className="border-b border-border/40 align-middle last:border-b-0">
              <td className="max-w-[230px] px-3 py-3"><PName p={p} /></td>
              <td className="px-3 py-3"><PState p={p} /></td>
              <td className="whitespace-nowrap px-3 py-3"><PReach p={p} /></td>
              <td className="whitespace-nowrap px-3 py-3"><PSales p={p} /></td>
              <td className="whitespace-nowrap px-3 py-3"><PPaid p={p} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductsCards({ rows }: { rows: ProductItem[] }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((p) => (
        <li key={p.product_id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <PName p={p} />
          <PState p={p} />
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 border-t border-border/40 pt-3">
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Afiliados</dt><dd><PReach p={p} /></dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Vendas</dt><dd><PSales p={p} /></dd></div>
          </dl>
          <p className="text-[13px] text-muted-foreground">Comissão paga: <span className="font-semibold tabular-nums text-foreground">{brl(p.commission)}</span></p>
        </li>
      ))}
    </ul>
  );
}
