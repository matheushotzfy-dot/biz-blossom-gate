import { CreditCard, Eye, FileText, Smartphone } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { brl } from "@/features/admin-finance/types";
import { fmtDateTime } from "@/features/admin-finance/format";
import { cn, deriveTransactionStatus } from "@/lib/utils";
import { methodLabel, type Tx } from "./transactionsModel";

export interface TxContext {
  nameOf: (userId: string) => string;
  productOf: (productId: string | null) => string;
  onOpen: (t: Tx) => void;
}

function MethodTag({ m }: { m: string | null }) {
  const Icon = m === "pix" ? Smartphone : m === "credit_card" ? CreditCard : m === "boleto" ? FileText : null;
  return <span className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/80">{Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}{methodLabel(m)}</span>;
}

function Amounts({ t }: { t: Tx }) {
  return (
    <div className="whitespace-nowrap">
      <p className="text-[14px] font-bold tabular-nums text-foreground">{brl(t.amount)}</p>
      <p className="text-[12px] tabular-nums text-muted-foreground">Líquido {brl(t.net_amount)}</p>
      <p className="text-[12px] tabular-nums text-muted-foreground">Taxa {brl(t.fee_amount)}</p>
    </div>
  );
}

const tint = (t: Tx) => (t.status === "chargeback" || t.status === "chargedback" ? "bg-destructive/[0.04]" : t.status === "refunded" || t.status === "partially_refunded" ? "bg-warning/[0.04]" : "");

function OpenButton({ t, ctx }: { t: Tx; ctx: TxContext }) {
  return (
    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" aria-label={`Ver detalhes da transação de ${t.customer_name || t.customer_email || t.id.slice(0, 8)}`} onClick={(e) => { e.stopPropagation(); ctx.onOpen(t); }}>
      <Eye className="h-3.5 w-3.5" /> Detalhes
    </Button>
  );
}

export function TxTable({ rows, ctx }: { rows: Tx[]; ctx: TxContext }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
            {["Data", "Cliente", "Seller e produto", "Método", "Valor", "Situação", ""].map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-3">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className={cn("cursor-pointer border-b border-border/40 align-top last:border-b-0", tint(t))} onClick={() => ctx.onOpen(t)}>
              <td className="whitespace-nowrap px-4 py-3.5">
                <p className="text-[12.5px] text-foreground/80">{fmtDateTime(t.created_at)}</p>
                <p className="font-mono text-[11px] text-muted-foreground">#{t.id.slice(0, 8)}</p>
              </td>
              <td className="max-w-[220px] px-4 py-3.5">
                <p className="truncate text-[13px] font-semibold text-foreground">{t.customer_name || "—"}</p>
                <p className="truncate text-[12px] text-muted-foreground">{t.customer_email || ""}</p>
              </td>
              <td className="max-w-[240px] px-4 py-3.5">
                <p className="truncate text-[13px] text-foreground/90">{ctx.nameOf(t.user_id)}</p>
                <p className="truncate text-[12px] text-muted-foreground">{ctx.productOf(t.product_id)}</p>
              </td>
              <td className="px-4 py-3.5"><MethodTag m={t.payment_method} /></td>
              <td className="px-4 py-3.5"><Amounts t={t} /></td>
              <td className="px-4 py-3.5"><StatusBadge status={deriveTransactionStatus(t)} /></td>
              <td className="px-4 py-3.5"><OpenButton t={t} ctx={ctx} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TxCards({ rows, ctx }: { rows: Tx[]; ctx: TxContext }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((t) => (
        <li key={t.id} className={cn("flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4", tint(t))}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground">{t.customer_name || "—"}</p>
              <p className="truncate text-[12px] text-muted-foreground">{t.customer_email || ""}</p>
            </div>
            <StatusBadge status={deriveTransactionStatus(t)} />
          </div>
          <Amounts t={t} />
          <div className="min-w-0 text-[12.5px]">
            <p className="truncate text-foreground/90">{ctx.nameOf(t.user_id)}</p>
            <p className="truncate text-muted-foreground">{ctx.productOf(t.product_id)}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
            <div>
              <p className="text-[12px] text-muted-foreground">{fmtDateTime(t.created_at)}</p>
              <MethodTag m={t.payment_method} />
            </div>
            <OpenButton t={t} ctx={ctx} />
          </div>
        </li>
      ))}
    </ul>
  );
}
