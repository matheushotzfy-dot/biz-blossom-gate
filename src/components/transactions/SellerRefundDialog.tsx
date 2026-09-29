import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export interface SellerRefundDialogProps {
  tx: Tables<"transactions"> | null;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * Seller-issued refund. All rules (ownership, sale paid, no open MED, remaining amount,
 * sufficient balance) are enforced server-side; the client only pre-validates for UX.
 */
export function SellerRefundDialog({ tx, onClose, onDone }: SellerRefundDialogProps) {
  const qc = useQueryClient();
  const remaining = tx ? Math.max(0, Number(tx.amount) - Number(tx.refunded_amount ?? 0)) : 0;
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const value = amount.trim() === "" ? remaining : Number(amount.replace(",", "."));
  const valid = Number.isFinite(value) && value > 0 && value <= remaining + 1e-9 && reason.trim().length >= 5;

  const submit = async () => {
    if (!tx || !valid || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("seller_refund_transaction", {
      _transaction_id: tx.id, _amount: Math.round(value * 100) / 100, _reason: reason.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message.replace(/^.*?:\s*/, "") || "Não foi possível reembolsar"); return; }
    toast.success("Reembolso registrado e descontado do seu saldo");
    await qc.invalidateQueries();
    onDone?.();
    onClose();
  };

  return (
    <Dialog open={!!tx} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Reembolsar cliente</DialogTitle>
          <DialogDescription>
            O valor sai do seu saldo na hora. Disponível para reembolso: <strong>{formatCurrency(remaining)}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Valor (deixe vazio para reembolso total)</Label>
            <Input id="refund-amount" inputMode="decimal" placeholder={remaining.toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Motivo</Label>
            <Textarea id="refund-reason" maxLength={500} placeholder="Ex.: cliente pediu cancelamento pelo suporte" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Reembolso total remove o acesso do comprador ao produto. Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={submit} disabled={!valid || busy}>
              {busy ? "Processando..." : `Reembolsar ${formatCurrency(Number.isFinite(value) ? value : 0)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
