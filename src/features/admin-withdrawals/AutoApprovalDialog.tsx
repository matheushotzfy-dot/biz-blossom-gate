import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { friendlyError } from "@/lib/friendlyError";
import { brl } from "@/features/admin-finance/types";
import { fmtDateTime } from "./withdrawalsModel";

/**
 * Saque automático configurado pelo PRÓPRIO seller (`seller_auto_withdraw`): quando o saldo chega em
 * `target_amount`, `check_auto_withdrawal` cria um pedido na chave escolhida. Não existe aprovação
 * automática de saque; o pedido entra na fila como qualquer outro.
 */
export interface AutoConfig { id: string; user_id: string; enabled: boolean; target_amount: number | null; pix_key_id: string | null; updated_at?: string | null }

export const autoWithdrawLabel = (c?: AutoConfig) =>
  c?.enabled && c.target_amount ? `Saque automático de ${brl(Number(c.target_amount))}` : null;

/** Mostra o saque automático do seller e deixa o admin desligá-lo (motivo obrigatório; o seller é avisado). */
export function AutoApprovalDialog({ sellerId, sellerName, config, onClose, onSaved }: {
  sellerId: string | null; sellerName: string; config?: AutoConfig; adminId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const on = Boolean(config?.enabled);

  useEffect(() => { if (sellerId) { setReason(""); setError(""); } }, [sellerId]);

  const disable = async () => {
    const text = reason.trim();
    if (text.length < 5) { setError("Explique o motivo com pelo menos 5 caracteres. O seller lê este texto."); return; }
    if (!sellerId) return;
    setError(""); setBusy(true);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_disable_seller_auto_withdraw", { _seller: sellerId, _reason: text });
      if (rpcErr) { setError(friendlyError(rpcErr, "Não foi possível desligar o saque automático.")); return; }
      toast.success("Saque automático desligado. O seller foi avisado.");
      onSaved(); onClose();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!sellerId} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>Saque automático do seller</DialogTitle>
          <DialogDescription>{sellerName}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4 px-5 py-4" noValidate onSubmit={(e) => { e.preventDefault(); if (on) void disable(); }}>
          <div className="rounded-[10px] border border-border bg-muted/30 p-3 text-[13.5px]">
            {on ? (
              <>
                <p className="font-semibold text-foreground">Ligado pelo seller</p>
                <p className="mt-1 text-muted-foreground">
                  Quando o saldo chega em {config?.target_amount ? brl(Number(config.target_amount)) : "o valor escolhido"}, um pedido de saque desse valor entra na fila, na chave Pix que o seller escolheu. O pedido espera a sua aprovação como os outros.
                </p>
                {config?.updated_at && <p className="mt-1 text-[12px] text-muted-foreground">Última mudança em {fmtDateTime(config.updated_at)}.</p>}
              </>
            ) : (
              <>
                <p className="font-semibold text-foreground">Desligado</p>
                <p className="mt-1 text-muted-foreground">Só o seller liga o saque automático, na tela de Saques do painel dele.</p>
              </>
            )}
          </div>
          {on && (
            <div className="space-y-1">
              <Label htmlFor="auto-reason" className="text-[12.5px] font-medium">Motivo para desligar</Label>
              <Textarea id="auto-reason" rows={3} maxLength={300} value={reason} placeholder="Ex.: chave Pix em análise por suspeita de fraude"
                onChange={(e) => { setReason(e.target.value); if (error) setError(""); }} aria-invalid={Boolean(error)} />
              <p className="text-[12px] text-muted-foreground">O seller recebe um aviso com este motivo e pode ligar de novo.</p>
            </div>
          )}
          {error && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Fechar</Button>
            {on && <Button type="submit" variant="destructive" disabled={busy}>{busy ? "Desligando…" : "Desligar saque automático"}</Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
