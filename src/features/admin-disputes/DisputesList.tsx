import { Button } from "@/components/ui/button";
import { brl } from "@/features/admin-finance/types";
import { cn } from "@/lib/utils";
import { ToneTag } from "./parts";
import { dateLabel, deadlineInfo, isActive, methodLabel, shortId, statusInfo, typeLabel, type DisputeItem } from "./disputesModel";

const DL_TEXT = { destructive: "text-destructive", warning: "text-warning", info: "text-info", success: "text-success", neutral: "text-muted-foreground" } as const;

function Status({ d, now }: { d: DisputeItem; now: number }) {
  const st = statusInfo(d); const dl = deadlineInfo(d, now);
  return (
    <div className="space-y-1">
      <ToneTag tone={st.tone}>{st.label}</ToneTag>
      {dl && st.label !== dl.label && <p className={cn("text-[12.5px] font-medium", DL_TEXT[dl.tone])}>{dl.label}</p>}
      {!isActive(d) && d.resolved_at && <p className="text-[12.5px] text-muted-foreground">em {dateLabel(d.resolved_at)}</p>}
    </div>
  );
}
const Money = ({ d }: { d: DisputeItem }) => (
  <>
    <p className="text-[15px] font-bold tabular-nums text-foreground">{brl(d.amount)}</p>
    {isActive(d) && d.held_amount > 0 && <p className="text-[12.5px] text-muted-foreground">{brl(d.held_amount)} congelados</p>}
    {d.status === "resolved_buyer" && d.fee_amount > 0 && <p className="text-[12.5px] text-muted-foreground">+ taxa {brl(d.fee_amount)}</p>}
  </>
);
const Sale = ({ d }: { d: DisputeItem }) => (
  <>
    <p className="truncate text-[14px] font-semibold text-foreground">{d.seller_name}</p>
    <p className="truncate text-[13px] text-muted-foreground">{d.product_name || "Produto"} · {methodLabel(d.payment_method)} · venda {shortId(d.transaction_id)}</p>
    <p className="truncate text-[13px] text-muted-foreground">Comprador: {d.buyer_name || d.buyer_email || "sem nome"}</p>
  </>
);
const Action = ({ d, onOpen }: { d: DisputeItem; onOpen: (d: DisputeItem) => void }) => (
  <Button type="button" size="sm" variant={isActive(d) ? "default" : "outline"} className="h-8 text-[12px]" onClick={() => onOpen(d)}
    aria-label={`${isActive(d) ? "Analisar" : "Ver"} ${typeLabel(d.type)} de ${d.seller_name}`}>
    {isActive(d) ? "Analisar" : "Ver detalhes"}
  </Button>
);

export function DisputesTable({ rows, now, onOpen }: { rows: DisputeItem[]; now: number; onOpen: (d: DisputeItem) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Tipo", "Valor", "Seller e venda", "Situação", "Aberta em", ""].map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className={cn("border-b border-border/40 align-top last:border-b-0", !isActive(d) && "text-foreground/85")}>
              <td className="whitespace-nowrap px-4 py-3.5 text-[14px] font-semibold text-foreground">{typeLabel(d.type)}</td>
              <td className="whitespace-nowrap px-4 py-3.5"><Money d={d} /></td>
              <td className="max-w-[340px] px-4 py-3.5"><Sale d={d} /></td>
              <td className="px-4 py-3.5"><Status d={d} now={now} /></td>
              <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-muted-foreground">{dateLabel(d.created_at)}</td>
              <td className="px-4 py-3.5 text-right"><Action d={d} onOpen={onOpen} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DisputesCards({ rows, now, onOpen }: { rows: DisputeItem[]; now: number; onOpen: (d: DisputeItem) => void }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((d) => (
        <li key={d.id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-[12.5px] font-medium text-muted-foreground">{typeLabel(d.type)}</p><Money d={d} /></div>
            <Status d={d} now={now} />
          </div>
          <div className="min-w-0"><Sale d={d} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
            <p className="text-[12.5px] text-muted-foreground">Aberta em {dateLabel(d.created_at)}</p>
            <Action d={d} onOpen={onOpen} />
          </div>
        </li>
      ))}
    </ul>
  );
}
