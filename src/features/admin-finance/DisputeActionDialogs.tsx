import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSensitiveConfirm } from "./useSensitiveConfirm";
import { brl, DISPUTE_TYPE_LABEL, rpcErrorMessage, type DisputeType } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BaseProps { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }

/** Opens a dispute on a paid sale; the server immediately holds the amount in the seller balance. */
export function OpenDisputeDialog({ open, onOpenChange, onDone, defaultType }: BaseProps & { defaultType: DisputeType }) {
  const [txId, setTxId] = useState("");
  const [type, setType] = useState<DisputeType>(defaultType);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!UUID_RE.test(txId.trim())) { toast.error("ID da venda inválido"); return; }
    if (reason.trim().length < 3) { toast.error("Informe o motivo"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_open_dispute", {
      _transaction_id: txId.trim(), _type: type, _reason: reason.trim(), _deadline_days: Number(days) || 7,
    });
    setBusy(false);
    if (error) { toast.error(rpcErrorMessage(error)); return; }
    toast.success("Disputa aberta — valor bloqueado no saldo do seller");
    setTxId(""); setReason(""); onOpenChange(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir disputa</DialogTitle>
          <DialogDescription>O valor da venda fica bloqueado até a decisão. O seller é avisado e pode enviar defesa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(DISPUTE_TYPE_LABEL) as DisputeType[]).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={cn("rounded-lg border px-2 py-2 text-xs font-semibold", type === t ? "border-primary bg-primary/10" : "border-border text-muted-foreground")}>
                {DISPUTE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="space-y-1"><Label htmlFor="dsp-tx">ID da venda</Label><Input id="dsp-tx" value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="xxxxxxxx-xxxx-..." /></div>
          <div className="space-y-1"><Label htmlFor="dsp-reason">Motivo</Label><Textarea id="dsp-reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="dsp-days">Prazo de defesa (dias)</Label><Input id="dsp-days" type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} /></div>
          <Button className="w-full" onClick={submit} disabled={busy}>{busy ? "Abrindo..." : "Abrir disputa"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Full or partial refund; the ledger debit and commission reversals are applied on the server. */
export function RefundDialog({ open, onOpenChange, onDone }: BaseProps) {
  const [txId, setTxId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { confirm, dialog } = useSensitiveConfirm();

  const submit = async () => {
    const value = Number(amount.replace(",", "."));
    if (!UUID_RE.test(txId.trim())) { toast.error("ID da venda inválido"); return; }
    if (!Number.isFinite(value) || value <= 0) { toast.error("Valor inválido"); return; }
    if (reason.trim().length < 3) { toast.error("Informe o motivo"); return; }
    confirm(`Reembolsar ${brl(value)} da venda ${txId.trim().slice(0, 8)}. O valor será debitado do seller.`, () => execute(value));
  };

  const execute = async (value: number) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_refund_transaction", { _transaction_id: txId.trim(), _amount: value, _reason: reason.trim() });
    setBusy(false);
    if (error) { toast.error(rpcErrorMessage(error)); return; }
    const partial = (data as { partial?: boolean } | null)?.partial;
    toast.success(partial ? "Reembolso parcial registrado" : "Venda reembolsada por completo");
    setTxId(""); setAmount(""); setReason(""); onOpenChange(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reembolsar venda</DialogTitle>
          <DialogDescription>Debita o seller proporcionalmente. No reembolso total, o acesso do comprador é removido e as comissões são estornadas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="rf-tx">ID da venda</Label><Input id="rf-tx" value={txId} onChange={(e) => setTxId(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="rf-amount">Valor a reembolsar (R$)</Label><Input id="rf-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="rf-reason">Motivo</Label><Textarea id="rf-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button className="w-full" onClick={submit} disabled={busy}>{busy ? "Processando..." : "Confirmar reembolso"}</Button>
        </div>
        {dialog}
      </DialogContent>
    </Dialog>
  );
}
