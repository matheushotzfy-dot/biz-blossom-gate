import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl } from "@/features/admin-finance/types";
import { fmtDateTime, waitingLabel } from "@/features/admin-finance/format";
import { cn } from "@/lib/utils";
import { canRetry, explain, statusLabel, statusTone, type Delivery } from "./deliveriesModel";

export interface DeliveryContext { retrying: string | null; busy: boolean; onRetry: (d: Delivery) => void }

const TONE: Record<string, string> = {
  success: "border-success/25 bg-success/10 text-success", warning: "border-warning/25 bg-warning/10 text-warning",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive", muted: "border-border bg-muted/40 text-muted-foreground",
};
export const StatusPill = ({ status }: { status: string }) => <span className={cn("rounded-full border px-2.5 py-0.5 text-[12px] font-semibold", TONE[statusTone(status)])}>{statusLabel(status)}</span>;

const Buyer = ({ d }: { d: Delivery }) => (
  <>
    <p className="truncate text-[13px] font-semibold text-foreground">{d.product_name || "Produto removido"}</p>
    <p className="truncate text-[12px] text-muted-foreground">{d.customer_email}</p>
    <p className="truncate text-[12px] text-muted-foreground">Vendedor: {d.seller_name || d.seller_email || `Conta ${d.seller_user_id.slice(0, 8)}`}</p>
  </>
);
const Detail = ({ d }: { d: Delivery }) => {
  const when = d.status === "delivered" ? `Entregue em ${fmtDateTime(d.delivered_at)}` : d.status === "revoked" ? "" : `Aberta ${waitingLabel(d.created_at)}`;
  return (
    <>
      <p className="text-[12.5px] leading-snug text-foreground/85">{explain(d)}</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        {[when, `${d.attempt_count} ${d.attempt_count === 1 ? "tentativa" : "tentativas"}`, d.tx_amount != null ? brl(d.tx_amount) : ""].filter(Boolean).join(" · ")}
      </p>
    </>
  );
};
const RetryButton = ({ d, ctx }: { d: Delivery; ctx: DeliveryContext }) => (canRetry(d) ? (
  <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" disabled={ctx.busy} onClick={() => ctx.onRetry(d)} aria-label={`Reprocessar entrega para ${d.customer_email}`}>
    <RefreshCw className={cn("h-3.5 w-3.5", ctx.retrying === d.id && "animate-spin")} /> {ctx.retrying === d.id ? "Reprocessando…" : "Reprocessar"}
  </Button>
) : null);

export function DeliveryTable({ rows, ctx }: { rows: Delivery[]; ctx: DeliveryContext }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Produto e comprador", "Situação", "O que aconteceu", "Criada em", ""].map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-border/40 align-top last:border-b-0">
              <td className="max-w-[300px] px-4 py-3.5"><Buyer d={d} /></td>
              <td className="px-4 py-3.5"><StatusPill status={d.status} /></td>
              <td className="max-w-[360px] px-4 py-3.5"><Detail d={d} /></td>
              <td className="whitespace-nowrap px-4 py-3.5 text-[12.5px] text-muted-foreground">{fmtDateTime(d.created_at)}</td>
              <td className="px-4 py-3.5"><RetryButton d={d} ctx={ctx} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeliveryCards({ rows, ctx }: { rows: Delivery[]; ctx: DeliveryContext }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((d) => (
        <li key={d.id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Buyer d={d} /></div><StatusPill status={d.status} /></div>
          <div><Detail d={d} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
            <p className="text-[12px] text-muted-foreground">Criada em {fmtDateTime(d.created_at)}</p>
            <RetryButton d={d} ctx={ctx} />
          </div>
        </li>
      ))}
    </ul>
  );
}
