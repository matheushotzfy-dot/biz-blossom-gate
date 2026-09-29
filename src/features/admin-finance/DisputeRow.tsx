import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, DISPUTE_STATUS_LABEL, DISPUTE_TYPE_LABEL, rpcErrorMessage, type DisputeType } from "./types";

export interface DisputeItem {
  id: string; transaction_id: string | null; seller_user_id: string; type: DisputeType; status: string;
  reason: string | null; amount: number; buyer_name: string | null; buyer_email: string | null;
  created_at: string; response_deadline: string | null; seller_response: string | null; fee_amount: number;
}

interface EventRow { id: string; event: string; note: string | null; created_at: string }

const EVENT_LABEL: Record<string, string> = {
  opened: "Disputa aberta", in_review: "Em análise", seller_responded: "Seller enviou defesa",
  won_by_seller: "Ganha pelo seller", lost_by_seller: "Perdida pelo seller",
};

interface DisputeRowProps { item: DisputeItem; sellerName: string; onChanged: () => void }

export function DisputeRow({ item, sellerName, onChanged }: DisputeRowProps) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [fee, setFee] = useState("0");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const active = item.status === "open" || item.status === "in_review";

  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && !events) {
      const { data } = await supabase.from("dispute_events").select("id,event,note,created_at").eq("dispute_id", item.id).order("created_at");
      setEvents((data ?? []) as EventRow[]);
    }
  };

  const run = async (fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(rpcErrorMessage(error)); return; }
    toast.success(ok); setEvents(null); setOpen(false); onChanged();
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <button type="button" onClick={toggle} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{sellerName} <span className="font-normal text-muted-foreground">· {DISPUTE_TYPE_LABEL[item.type]}</span></p>
          <p className="truncate text-xs text-muted-foreground">{item.buyer_name || item.buyer_email || "Comprador"} · {new Date(item.created_at).toLocaleDateString("pt-BR")}</p>
        </div>
        <span className="font-mono text-sm tabular-nums">{brl(item.amount)}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold",
          active ? "border-destructive/30 text-destructive" : item.status === "resolved_seller" ? "border-primary/30 text-primary" : "border-border text-muted-foreground")}>
          {DISPUTE_STATUS_LABEL[item.status] ?? item.status}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-3 text-sm">
          {item.reason && <p><span className="text-muted-foreground">Motivo: </span>{item.reason}</p>}
          {item.response_deadline && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />Prazo de defesa: {new Date(item.response_deadline).toLocaleString("pt-BR")}</p>}
          <div className="rounded-lg bg-muted/40 p-2 text-xs"><span className="font-semibold">Defesa do seller: </span>{item.seller_response || "Ainda não enviada"}</div>
          {item.fee_amount > 0 && <p className="text-xs">Taxa de disputa cobrada: {brl(item.fee_amount)}</p>}

          <ol className="space-y-1 border-l border-border pl-3">
            {(events ?? []).map((e) => (
              <li key={e.id} className="text-xs"><span className="font-semibold">{EVENT_LABEL[e.event] ?? e.event}</span> · {new Date(e.created_at).toLocaleString("pt-BR")}{e.note ? ` — ${e.note}` : ""}</li>
            ))}
            {events?.length === 0 && <li className="text-xs text-muted-foreground">Sem histórico registrado</li>}
          </ol>

          {active && (
            <div className="space-y-2 border-t border-border pt-3">
              <Input placeholder="Observação da decisão (opcional)" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} aria-label="Observação" />
              <div className="flex flex-wrap items-center gap-2">
                {item.status === "open" && (
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => run(() => supabase.rpc("admin_set_dispute_review", { _dispute_id: item.id, _note: note || undefined }), "Movida para análise")}>Em análise</Button>
                )}
                <Button size="sm" variant="outline" disabled={busy}
                  onClick={() => run(() => supabase.rpc("admin_resolve_dispute", { _dispute_id: item.id, _outcome: "seller", _note: note || undefined }), "Seller ganhou — valor liberado")}>Seller ganhou</Button>
                <div className="flex items-center gap-1">
                  <Input className="h-8 w-24" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} aria-label="Taxa de disputa" title="Taxa de disputa (R$)" />
                  <Button size="sm" variant="destructive" disabled={busy}
                    onClick={() => {
                      if (!window.confirm("Confirmar perda? O valor não volta ao seller e o acesso do comprador será removido.")) return;
                      void run(() => supabase.rpc("admin_resolve_dispute", { _dispute_id: item.id, _outcome: "buyer", _fee: Number(fee.replace(",", ".")) || 0, _note: note || undefined }), "Disputa encerrada contra o seller");
                    }}>Seller perdeu</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
