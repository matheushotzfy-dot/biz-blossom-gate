import { useState } from "react";
import { Check, Copy, MoreHorizontal, Pencil, RotateCcw, Trash2, LogOut, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pager } from "@/components/seller-ui/Pager";
import { StatusPill } from "@/components/seller-ui/tx";
import { SellerMenuItem, sellerMenuContent } from "@/components/seller-ui/menu";
import { cn, formatCurrency } from "@/lib/utils";
import { STATE_META, coState, type CoDirection, type CoProduction } from "./coproMeta";
import { Thumb } from "./Thumb";

export interface CoRow {
  cp: CoProduction;
  dir: CoDirection;
  productName: string;
  productImage: string | null;
  productPrice: number;
  partner: string;
  /** Sua parte, em %, do valor líquido de cada venda. */
  mine: number;
}

export interface CoLedgerProps {
  rows: CoRow[];
  busyId: string | null;
  onAccept: (r: CoRow) => void;
  onReject: (r: CoRow) => void;
  onEdit: (r: CoRow) => void;
  onCancel: (r: CoRow) => void;
  onReinvite: (r: CoRow) => void;
  onLeave: (r: CoRow) => void;
  onCopyEmail: (r: CoRow) => void;
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).replace(/\./g, "");

const COLS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_160px_190px_190px]";
const PAGE = 8;

export function CoLedger(p: CoLedgerProps) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(p.rows.length / PAGE));
  const current = Math.min(page, pages);
  const shown = p.rows.slice((current - 1) * PAGE, current * PAGE);

  return (
    <section className="vp-sheet overflow-hidden" aria-label="Coproduções">
      <div role="table" aria-label="Coproduções">
        <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground md:grid md:items-center md:gap-4", COLS)}>
          <span role="columnheader">Parceiro</span><span role="columnheader">Produto</span><span role="columnheader">Sua parte</span><span role="columnheader">Situação</span><span role="columnheader" className="text-right">Ações</span>
        </div>
        <ul>
          {shown.map((r) => {
            const st = coState(r.cp);
            const meta = STATE_META[st];
            const busy = p.busyId === r.cp.id;
            const answer = r.dir === "received" && r.cp.status === "pending";
            const hasMenu = !answer && !(r.dir === "received" && r.cp.status === "rejected");
            return (
              <li key={r.cp.id} role="row" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-t border-border px-5 py-4 first:border-t-0 sm:px-7 md:gap-4", COLS, busy && "opacity-60")}>
                <span role="cell" className="col-start-1 row-start-1 flex min-w-0 items-center gap-3.5">
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-extrabold text-accent-foreground">{r.partner.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "CP"}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-bold text-foreground">{r.partner}</span>
                    <span className="block text-[12.5px] text-muted-foreground">{r.dir === "sent" ? "Enviado" : "Recebido"} em {dayLabel(r.cp.created_at)}</span>
                  </span>
                </span>

                <span role="cell" className="col-start-2 row-start-1 justify-self-end md:col-start-5 md:row-start-1">
                  {answer ? (
                    <span className="hidden items-center gap-2 md:flex">
                      <button type="button" className="vp-cta !h-10 !px-4" disabled={busy} onClick={() => p.onAccept(r)}><Check className="h-4 w-4" strokeWidth={2.4} />Aceitar</button>
                      <button type="button" className="vp-ghost !h-10 !px-4" disabled={busy} onClick={() => p.onReject(r)}>Recusar</button>
                    </span>
                  ) : hasMenu ? (
                    <RowMenu r={r} {...p} />
                  ) : null}
                </span>

                <span role="cell" className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1 md:col-start-2 md:row-start-1">
                  <Thumb src={r.productImage} className="h-10 w-10" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-foreground">{r.productName}</span>
                    <span className="block text-[12.5px] tabular-nums text-muted-foreground">{r.productPrice > 0 ? formatCurrency(r.productPrice) : "Preço indisponível"}</span>
                  </span>
                </span>

                <span role="cell" className="col-span-2 md:col-span-1 md:col-start-3 md:row-start-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-[18px] font-extrabold tabular-nums tracking-[-0.03em] text-foreground">{r.mine}%</span>
                    <span className="text-[12.5px] text-muted-foreground">do valor líquido</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${r.mine}%` }} /></span>
                </span>

                <span role="cell" className="col-span-2 md:col-span-1 md:col-start-4 md:row-start-1">
                  <StatusPill label={meta.label} tone={meta.tone} />
                  {st === "unlinked" && <span className="mt-1.5 block max-w-[30ch] text-[12px] leading-snug text-muted-foreground">A divisão começa quando a conta do parceiro for vinculada.</span>}
                </span>

                {answer && (
                  <span role="cell" className="col-span-2 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 md:hidden">
                    <button type="button" className="vp-cta justify-center" disabled={busy} onClick={() => p.onAccept(r)}><Check className="h-4 w-4" strokeWidth={2.4} />Aceitar</button>
                    <button type="button" className="vp-ghost justify-center" disabled={busy} onClick={() => p.onReject(r)}><X className="h-4 w-4" />Recusar</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <Pager page={current} pageSize={PAGE} total={p.rows.length} onPage={setPage} />
    </section>
  );
}

function RowMenu({ r, onEdit, onCancel, onReinvite, onLeave, onCopyEmail }: { r: CoRow } & CoLedgerProps) {
  const sent = r.dir === "sent";
  const status = r.cp.status;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="vp-orb h-10 w-10" aria-label={`Ações da coprodução com ${r.partner}`}><MoreHorizontal className="h-[18px] w-[18px]" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className={cn(sellerMenuContent, "w-72")}>
        {sent && status === "pending" && <SellerMenuItem icon={Pencil} label="Alterar divisão" onSelect={() => onEdit(r)} />}
        {sent && status === "rejected" && <SellerMenuItem icon={RotateCcw} label="Convidar de novo" onSelect={() => onReinvite(r)} />}
        {sent && <SellerMenuItem icon={Copy} label="Copiar e-mail do parceiro" onSelect={() => onCopyEmail(r)} />}
        {sent && <DropdownMenuSeparator className="my-1.5" />}
        {sent && <SellerMenuItem icon={Trash2} destructive label={status === "accepted" ? "Encerrar parceria" : status === "pending" ? "Cancelar convite" : "Remover da lista"} onSelect={() => onCancel(r)} />}
        {!sent && status === "accepted" && <SellerMenuItem icon={LogOut} destructive label="Sair da parceria" onSelect={() => onLeave(r)} />}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
