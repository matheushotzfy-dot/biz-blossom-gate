import { Button } from "@/components/ui/button";
import { brl } from "@/features/admin-finance/types";
import { dateLabel } from "@/features/admin-disputes/disputesModel";
import { cn } from "@/lib/utils";
import { ClassTag, Thumb, ToneTag } from "./parts";
import { isDeleted, statusInfo, type ProductItem } from "./productsModel";

const needsLook = (p: ProductItem) => !isDeleted(p) && p.status === "pending_review";

function State({ p }: { p: ProductItem }) {
  const st = statusInfo(p);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToneTag tone={st.tone}>{st.label}</ToneTag>
        {p.classification !== "white" && <ClassTag value={p.classification} />}
      </div>
      {p.rejection_reason && (p.status !== "active") && <p className="line-clamp-2 max-w-[220px] text-[12.5px] text-muted-foreground">Motivo: {p.rejection_reason}</p>}
    </div>
  );
}

const Name = ({ p, price }: { p: ProductItem; price?: boolean }) => (
  <div className="flex min-w-0 items-center gap-3">
    <Thumb url={p.image_url} name={p.name} />
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-foreground" title={p.name}>{p.name}</p>
      <p className="truncate text-[13px] text-muted-foreground">{p.seller_name}{price ? ` · ${brl(p.price)}` : ""}</p>
    </div>
  </div>
);

const Sales = ({ p }: { p: ProductItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{p.sales.toLocaleString("pt-BR")} {p.sales === 1 ? "venda" : "vendas"}</p>
    <p className="text-[12.5px] text-muted-foreground">{p.attempts === 0 ? "sem tentativas" : `${p.attempts.toLocaleString("pt-BR")} ${p.attempts === 1 ? "tentativa" : "tentativas"}`}</p>
  </>
);

const Money = ({ p }: { p: ProductItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{brl(p.gross)}</p>
    {p.refunded > 0 && <p className="text-[12.5px] text-muted-foreground">{brl(p.refunded)} reembolsados</p>}
  </>
);

const Issues = ({ p }: { p: ProductItem }) => {
  if (p.chargebacks === 0 && p.refunds === 0) return <span className="text-[13px] text-muted-foreground">Nenhuma</span>;
  return (
    <div className="space-y-0.5 text-[13px]">
      {p.chargebacks > 0 && <p className="font-semibold text-destructive">{p.chargebacks} {p.chargebacks === 1 ? "chargeback" : "chargebacks"}</p>}
      {p.refunds > 0 && <p className="text-muted-foreground">{p.refunds} {p.refunds === 1 ? "reembolso" : "reembolsos"}</p>}
    </div>
  );
};

const Action = ({ p, onOpen }: { p: ProductItem; onOpen: (p: ProductItem) => void }) => (
  <Button type="button" size="sm" variant={needsLook(p) ? "default" : "outline"} className="h-8 text-[12px]" onClick={() => onOpen(p)}
    aria-label={`${needsLook(p) ? "Analisar" : "Ver"} ${p.name}`}>
    {needsLook(p) ? "Analisar" : "Ver detalhes"}
  </Button>
);

export function ProductsTable({ rows, onOpen }: { rows: ProductItem[]; onOpen: (p: ProductItem) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Produto e seller", "Situação", "Vendas", "Faturado", "Contestações", ""].map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={cn("border-b border-border/40 align-middle last:border-b-0", isDeleted(p) && "opacity-75")}>
              <td className="max-w-[300px] px-4 py-3"><Name p={p} price /></td>
              <td className="min-w-[150px] px-4 py-3"><State p={p} /></td>
              <td className="whitespace-nowrap px-4 py-3"><Sales p={p} /></td>
              <td className="whitespace-nowrap px-4 py-3"><Money p={p} /></td>
              <td className="whitespace-nowrap px-4 py-3"><Issues p={p} /></td>
              <td className="px-4 py-3 text-right"><Action p={p} onOpen={onOpen} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductsCards({ rows, onOpen }: { rows: ProductItem[]; onOpen: (p: ProductItem) => void }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((p) => (
        <li key={p.id} className={cn("flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4", isDeleted(p) && "opacity-75")}>
          <Name p={p} />
          <State p={p} />
          <dl className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 border-t border-border/40 pt-3">
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Preço</dt><dd className="text-[14px] font-semibold tabular-nums text-foreground">{brl(p.price)}</dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Vendas</dt><dd><Sales p={p} /></dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Faturado</dt><dd><Money p={p} /></dd></div>
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0"><p className="text-[12px] text-muted-foreground">Contestações</p><Issues p={p} /><p className="mt-1 text-[12.5px] text-muted-foreground">Criado em {dateLabel(p.created_at)}</p></div>
            <Action p={p} onOpen={onOpen} />
          </div>
        </li>
      ))}
    </ul>
  );
}
