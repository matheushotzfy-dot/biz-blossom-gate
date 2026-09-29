import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { brl, rpcErrorMessage } from "./types";
import { useSensitiveConfirm } from "./useSensitiveConfirm";
import { ManualApprovalSettings } from "./ManualApprovalSettings";

interface RefundRow {
  id: string; created_at: string; status: "pending_confirmation" | "confirmed" | "reverted";
  amount: number; debited_amount: number; reason: string; requested_role: string;
  decision_note: string | null; proof_ref: string | null; decided_at: string | null;
  transaction_id: string; tx_amount: number; payment_method: string | null;
  customer_name: string | null; customer_email: string | null; seller_name: string | null; seller_email: string | null;
}
type Outcome = "confirmed" | "reverted";
const STATUS_LABEL: Record<RefundRow["status"], string> = {
  pending_confirmation: "Aguardando você", confirmed: "Devolução efetivada", reverted: "Não efetivada (saldo devolvido)",
};
const ROLE_LABEL: Record<string, string> = { seller: "Seller", admin: "Suporte/Dono", manager: "Gerente", employee: "Funcionário" };

/** Owner queue: seller/support refunds already debited from the seller, waiting for manual confirmation. */
export default function RefundApprovalsTab() {
  const [status, setStatus] = useState<RefundRow["status"]>("pending_confirmation");
  const [rows, setRows] = useState<RefundRow[] | null>(null);
  const [decide, setDecide] = useState<{ row: RefundRow; outcome: Outcome } | null>(null);
  const [note, setNote] = useState("");
  const [proof, setProof] = useState("");
  const { confirm, dialog } = useSensitiveConfirm();

  const load = useCallback(async () => {
    setRows(null);
    const { data, error } = await supabase.rpc("admin_list_refund_requests", { _status: status, _limit: 100, _offset: 0 });
    if (error) { toast.error(rpcErrorMessage(error)); setRows([]); return; }
    setRows(((data as unknown as { rows: RefundRow[] }).rows) ?? []);
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const submit = () => {
    if (!decide) return;
    if (decide.outcome === "reverted" && note.trim().length < 5) { toast.error("Informe o motivo (mín. 5 caracteres)"); return; }
    const { row, outcome } = decide;
    const desc = outcome === "confirmed"
      ? `Confirmar que ${brl(row.amount)} foi devolvido ao comprador.`
      : `Marcar como não efetivado: ${brl(row.debited_amount)} volta ao saldo do seller.`;
    confirm(desc, async () => {
      const { error } = await supabase.rpc("admin_decide_refund", { _request_id: row.id, _outcome: outcome, _note: note.trim() || undefined, _proof: proof.trim() || undefined });
      if (error) { toast.error(rpcErrorMessage(error)); return; }
      toast.success(outcome === "confirmed" ? "Devolução confirmada" : "Saldo devolvido ao seller");
      setDecide(null); setNote(""); setProof(""); void load();
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Reembolsos pendentes de aprovação</h2>
        <p className="text-xs text-muted-foreground">O valor já foi descontado do seller. Confirme se a devolução ao comprador foi feita ou marque como não efetivada.</p>
      </div>
      <ManualApprovalSettings />
      <Tabs value={status} onValueChange={(v) => setStatus(v as RefundRow["status"])}>
        <TabsList><TabsTrigger value="pending_confirmation">Pendentes</TabsTrigger><TabsTrigger value="confirmed">Efetivados</TabsTrigger><TabsTrigger value="reverted">Não efetivados</TabsTrigger></TabsList>
      </Tabs>

      {rows === null ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum reembolso neste filtro</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-1 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-semibold tabular-nums">{brl(r.amount)}</span>
                  <span className="text-muted-foreground">de {brl(r.tx_amount)} · {r.payment_method ?? "—"}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 font-semibold">{STATUS_LABEL[r.status]}</span>
                </div>
                <p><span className="text-muted-foreground">Seller:</span> {r.seller_name || r.seller_email || "—"} · <span className="text-muted-foreground">descontado</span> <span className="font-mono">{brl(r.debited_amount)}</span></p>
                <p><span className="text-muted-foreground">Comprador:</span> {r.customer_name || "—"} {r.customer_email ? `(${r.customer_email})` : ""}</p>
                <p><span className="text-muted-foreground">Pedido por:</span> {ROLE_LABEL[r.requested_role] ?? r.requested_role} em {new Date(r.created_at).toLocaleString("pt-BR")}</p>
                <p className="text-muted-foreground">Motivo: {r.reason}</p>
                <p className="font-mono text-[10px] text-muted-foreground">Venda {r.transaction_id}</p>
                {r.decision_note && <p>Decisão: {r.decision_note}</p>}
                {r.proof_ref && <p>Comprovante: {r.proof_ref}</p>}
              </div>
              {r.status === "pending_confirmation" && (
                <div className="flex flex-row gap-2 md:flex-col">
                  <Button size="sm" onClick={() => setDecide({ row: r, outcome: "confirmed" })}><CheckCircle2 className="mr-1.5 h-4 w-4" />Devolução efetivada</Button>
                  <Button size="sm" variant="outline" onClick={() => setDecide({ row: r, outcome: "reverted" })}><Undo2 className="mr-1.5 h-4 w-4" />Não efetivada</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!decide} onOpenChange={(o) => { if (!o) setDecide(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{decide?.outcome === "confirmed" ? "Confirmar devolução ao comprador" : "Devolução não efetivada"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {decide?.outcome === "confirmed" && (
              <div className="space-y-1"><Label htmlFor="rf-proof">Comprovante / ID do estorno (opcional)</Label><Input id="rf-proof" maxLength={500} value={proof} onChange={(e) => setProof(e.target.value)} /></div>
            )}
            <div className="space-y-1">
              <Label htmlFor="rf-note">{decide?.outcome === "reverted" ? "Motivo (obrigatório)" : "Observação (opcional)"}</Label>
              <Textarea id="rf-note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {decide?.outcome === "reverted" && <p className="text-xs text-muted-foreground">{brl(decide.row.debited_amount)} volta ao saldo do seller e a venda deixa de constar como reembolsada.</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDecide(null)}>Cancelar</Button><Button onClick={submit}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </div>
  );
}
