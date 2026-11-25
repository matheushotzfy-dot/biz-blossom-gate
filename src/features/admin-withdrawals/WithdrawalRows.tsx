import { useRef } from "react";
import { FileText, Paperclip, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Tables } from "@/integrations/supabase/types";
import { brl } from "@/features/admin-finance/types";
import { cn } from "@/lib/utils";
import { PayoutTarget } from "./PayoutTarget";
import type { AutoConfig } from "./AutoApprovalDialog";
import { REVIEW_VALUE, STATUS_LABEL, fmtDateTime, waitingLabel, withdrawalFlags } from "./withdrawalsModel";

type Withdrawal = Tables<"withdrawals">;

export interface RowContext {
  nameOf: (userId: string) => string;
  emailOf: (userId: string) => string;
  createdAtOf: (userId: string) => string | undefined;
  autoOf: (userId: string) => AutoConfig | undefined;
  adminNameOf: (userId: string | null) => string;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onReject: (id: string) => void;
  onAuto: (userId: string) => void;
  onProof: (id: string, file: File) => void;
  onViewProof: (path: string) => void;
  proofBusy: string | null;
  now: number;
}

const PILL: Record<string, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function StatusPill({ status }: { status: string }) {
  return <span className={cn("inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold", PILL[status] ?? "border-border bg-muted/40 text-muted-foreground")}>{STATUS_LABEL[status] ?? status}</span>;
}

function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "warning" | "muted" | "primary" }) {
  return <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-medium", tone === "warning" ? "border-warning/30 bg-warning/10 text-warning" : tone === "primary" ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground")}>{children}</span>;
}

export function SellerCell({ w, ctx }: { w: Withdrawal; ctx: RowContext }) {
  const flags = w.status === "pending" ? withdrawalFlags(Number(w.amount), ctx.createdAtOf(w.user_id), ctx.now) : [];
  const auto = ctx.autoOf(w.user_id);
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold text-foreground">{ctx.nameOf(w.user_id)}</p>
      {ctx.emailOf(w.user_id) && <p className="truncate text-[12px] text-muted-foreground">{ctx.emailOf(w.user_id)}</p>}
      {(flags.length > 0 || w.origin === "auto") && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {flags.map((f) => <Tag key={f} tone="warning">{f}</Tag>)}
          {w.origin === "auto" && <Tag tone="primary">Pedido automático</Tag>}
        </div>
      )}
      <button type="button" data-no-fluid onClick={() => ctx.onAuto(w.user_id)} style={{ minHeight: 0, padding: 0 }} className="mt-1.5 block text-left text-[12px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        {auto?.enabled ? `Auto-aprovação até ${brl(auto.max_amount)}` : "Configurar auto-aprovação"}
      </button>
    </div>
  );
}

export function AmountCell({ w }: { w: Withdrawal }) {
  const amount = Number(w.amount) || 0;
  return (
    <div className="whitespace-nowrap">
      <p className={cn("text-[14px] font-bold tabular-nums", amount >= REVIEW_VALUE ? "text-warning" : "text-foreground")} title={amount >= REVIEW_VALUE ? `Acima de ${brl(REVIEW_VALUE)}` : undefined}>{brl(amount)}</p>
      <p className="text-[12px] tabular-nums text-muted-foreground">Líquido {brl(w.net_amount)}</p>
      <p className="text-[12px] tabular-nums text-muted-foreground">Taxa {brl(w.fee_amount)}</p>
    </div>
  );
}

export function StatusCell({ w, ctx }: { w: Withdrawal; ctx: RowContext }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <StatusPill status={w.status} />
      {w.status === "pending" && <span className="text-[12px] text-muted-foreground">Na fila {waitingLabel(w.created_at, ctx.now)}</span>}
      {w.status !== "pending" && (
        <span className="text-[12px] text-muted-foreground">{ctx.adminNameOf(w.processed_by ?? null)}{w.processed_at ? ` · ${fmtDateTime(w.processed_at)}` : ""}</span>
      )}
      {w.status === "rejected" && w.rejection_reason && <p className="line-clamp-3 break-words text-[12px] text-foreground/80">Motivo: {w.rejection_reason}</p>}
      {w.failure_code && <p className="text-[12px] text-destructive">Última falha: {w.failure_code}</p>}
    </div>
  );
}

function ProofControl({ w, ctx }: { w: Withdrawal; ctx: RowContext }) {
  const input = useRef<HTMLInputElement>(null);
  const busy = ctx.proofBusy === w.id;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {w.payment_proof_url && (
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => ctx.onViewProof(w.payment_proof_url as string)}>
          <FileText className="h-3.5 w-3.5" /> Ver comprovante
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" disabled={busy} onClick={() => input.current?.click()}>
        <Paperclip className="h-3.5 w-3.5" /> {busy ? "Enviando…" : w.payment_proof_url ? "Trocar" : "Anexar comprovante"}
      </Button>
      <input ref={input} type="file" className="sr-only" tabIndex={-1} accept="image/*,application/pdf" aria-label={`Comprovante do saque de ${ctx.nameOf(w.user_id)}`}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) ctx.onProof(w.id, f); }} />
    </div>
  );
}

export function ActionsCell({ w, ctx }: { w: Withdrawal; ctx: RowContext }) {
  if (w.status === "pending") {
    return (
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-destructive/40 text-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => ctx.onReject(w.id)}>
        <XCircle className="h-3.5 w-3.5" /> Recusar
      </Button>
    );
  }
  if (w.status === "approved") return <ProofControl w={w} ctx={ctx} />;
  return <span className="text-[12px] text-muted-foreground">—</span>;
}

export function QueueTable({ rows, ctx, allSelected, onToggleAll, canSelect }: { rows: Withdrawal[]; ctx: RowContext; allSelected: boolean; onToggleAll: () => void; canSelect: boolean }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
            <th className="w-11 px-4 py-3">{canSelect && <Checkbox checked={allSelected} onCheckedChange={onToggleAll} aria-label="Selecionar os pendentes desta página" />}</th>
            {["Seller", "Destino", "Valor", "Situação", "Pedido em", "Ação"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id} className={cn("border-b border-border/40 align-top last:border-b-0", w.status === "pending" && "bg-warning/[0.03]")}>
              <td className="px-4 py-3.5">{w.status === "pending" && <Checkbox checked={ctx.selected.has(w.id)} onCheckedChange={() => ctx.onToggle(w.id)} aria-label={`Selecionar saque de ${ctx.nameOf(w.user_id)}`} />}</td>
              <td className="max-w-[240px] px-4 py-3.5"><SellerCell w={w} ctx={ctx} /></td>
              <td className="px-4 py-3.5"><PayoutTarget withdrawal={w} /></td>
              <td className="px-4 py-3.5"><AmountCell w={w} /></td>
              <td className="max-w-[240px] px-4 py-3.5"><StatusCell w={w} ctx={ctx} /></td>
              <td className="whitespace-nowrap px-4 py-3.5 text-[12.5px] text-muted-foreground">{fmtDateTime(w.created_at)}</td>
              <td className="px-4 py-3.5"><ActionsCell w={w} ctx={ctx} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QueueCards({ rows, ctx }: { rows: Withdrawal[]; ctx: RowContext }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((w) => (
        <li key={w.id} className={cn("flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4", w.status === "pending" && "bg-warning/[0.03]")}>
          <div className="flex items-start gap-3">
            {w.status === "pending" && <Checkbox className="mt-0.5" checked={ctx.selected.has(w.id)} onCheckedChange={() => ctx.onToggle(w.id)} aria-label={`Selecionar saque de ${ctx.nameOf(w.user_id)}`} />}
            <div className="min-w-0 flex-1"><SellerCell w={w} ctx={ctx} /></div>
          </div>
          <div className="flex items-end justify-between gap-3"><AmountCell w={w} /></div>
          <div className="min-w-0"><PayoutTarget withdrawal={w} /></div>
          <StatusCell w={w} ctx={ctx} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
            <span className="text-[12px] text-muted-foreground">{fmtDateTime(w.created_at)}</span>
            <ActionsCell w={w} ctx={ctx} />
          </div>
        </li>
      ))}
    </ul>
  );
}
