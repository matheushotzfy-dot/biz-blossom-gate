import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneTag } from "@/features/admin-products/parts";
import { cn } from "@/lib/utils";
import { brl } from "@/features/admin-finance/types";
import { discountLabel, expiryLabel, isFullDiscount, stateInfo, usesLabel, type CouponItem } from "./couponsModel";

const int = (v: number) => v.toLocaleString("pt-BR");

const Name = ({ c }: { c: CouponItem }) => (
  <div className="flex min-w-0 items-center gap-3">
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-muted text-muted-foreground"><Tag className="h-[18px] w-[18px]" /></span>
    <div className="min-w-0">
      <p className="truncate text-[14px] font-bold tracking-wide text-foreground" title={c.code}>{c.code}</p>
      <p className="truncate text-[13px] text-muted-foreground">{discountLabel(c)} de desconto</p>
    </div>
  </div>
);

const Owner = ({ c }: { c: CouponItem }) => (
  <div className="min-w-0">
    <p className="truncate text-[14px] text-foreground" title={c.seller_email ?? undefined}>{c.seller_name}</p>
    <p className="truncate text-[13px] text-muted-foreground" title={c.product_name ?? undefined}>
      {c.product_id ? `${c.product_name ?? "Produto"}${c.product_deleted ? " (apagado)" : ""}` : "Todos os produtos"}
    </p>
  </div>
);

function State({ c }: { c: CouponItem }) {
  const st = stateInfo(c.state);
  const expiry = c.state === "active" || c.state === "expired" ? expiryLabel(c) : null;
  return (
    <div className="space-y-1.5">
      <ToneTag tone={st.tone}>{st.label}</ToneTag>
      {isFullDiscount(c) && c.state === "active" && <p className="max-w-[170px] text-[12.5px] font-medium text-warning">100%: sai de graça</p>}
      {expiry && <p className="text-[12.5px] text-muted-foreground">{expiry}</p>}
      {c.hold_reason && <p className="line-clamp-2 max-w-[220px] text-[12.5px] text-muted-foreground">Motivo: {c.hold_reason}</p>}
    </div>
  );
}

const Usage = ({ c }: { c: CouponItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{int(c.sales)} {c.sales === 1 ? "venda paga" : "vendas pagas"}</p>
    <p className="text-[12.5px] text-muted-foreground">{usesLabel(c)}</p>
  </>
);

const Given = ({ c }: { c: CouponItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{brl(c.discount)}</p>
    <p className="text-[12.5px] text-muted-foreground">{int(c.buyers)} {c.buyers === 1 ? "comprador" : "compradores"}</p>
  </>
);

const Action = ({ c, onOpen }: { c: CouponItem; onOpen: (c: CouponItem) => void }) => (
  <Button type="button" size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => onOpen(c)} aria-label={`Ver ${c.code}`}>Detalhes</Button>
);

export function CouponsTable({ rows, onOpen }: { rows: CouponItem[]; onOpen: (c: CouponItem) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Cupom", "Seller e produto", "Situação", "Uso", "Desconto dado", ""].map((h, i) => <th key={h + i} className="whitespace-nowrap px-3 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className={cn("border-b border-border/40 align-middle last:border-b-0")}>
              <td className="max-w-[210px] px-3 py-3"><Name c={c} /></td>
              <td className="max-w-[190px] px-3 py-3"><Owner c={c} /></td>
              <td className="px-3 py-3"><State c={c} /></td>
              <td className="whitespace-nowrap px-3 py-3"><Usage c={c} /></td>
              <td className="whitespace-nowrap px-3 py-3"><Given c={c} /></td>
              <td className="px-3 py-3 text-right"><Action c={c} onOpen={onOpen} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CouponsCards({ rows, onOpen }: { rows: CouponItem[]; onOpen: (c: CouponItem) => void }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((c) => (
        <li key={c.id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <Name c={c} />
          <State c={c} />
          <Owner c={c} />
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 border-t border-border/40 pt-3">
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Uso</dt><dd><Usage c={c} /></dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Desconto dado</dt><dd><Given c={c} /></dd></div>
          </dl>
          <div className="flex justify-end"><Action c={c} onOpen={onOpen} /></div>
        </li>
      ))}
    </ul>
  );
}
