import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logAdminAction } from "@/lib/auditLog";
import { friendlyError } from "@/lib/friendlyError";
import { PAYOUTS_AVAILABLE, parseAmount, validateAutoLimit } from "./withdrawalsModel";

export interface AutoConfig { id: string; user_id: string; enabled: boolean; max_amount: number; admin_user_id: string }

/** Regra de auto-aprovação de um seller: liga/desliga e valor máximo. */
export function AutoApprovalDialog({ sellerId, sellerName, config, adminId, onClose, onSaved }: {
  sellerId: string | null; sellerName: string; config?: AutoConfig; adminId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [max, setMax] = useState("100,00");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sellerId) return;
    setEnabled(config?.enabled ?? false);
    setMax(config ? Number(config.max_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "100,00");
    setError("");
  }, [sellerId, config]);

  const save = async () => {
    const problem = validateAutoLimit(max);
    if (problem) { setError(problem); return; }
    if (!sellerId || !adminId) { setError("Sessão inválida. Entre de novo."); return; }
    setError(""); setBusy(true);
    try {
      const payload = { user_id: sellerId, enabled, max_amount: parseAmount(max) ?? 0, admin_user_id: adminId, updated_at: new Date().toISOString() };
      const { error: upErr } = await supabase.from("seller_auto_withdraw").upsert(payload, { onConflict: "user_id" });
      if (upErr) { setError(friendlyError(upErr, "Não foi possível salvar a regra.")); return; }
      toast.success("Regra salva");
      await logAdminAction("update_seller_auto_withdraw", "seller_auto_withdraw", sellerId, payload);
      onSaved(); onClose();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!sellerId} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>Auto-aprovação de saques</DialogTitle>
          <DialogDescription>{sellerName}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4 px-5 py-4" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[10px] border border-border bg-muted/30 p-3">
            <span><span className="block text-[13.5px] font-semibold">Aprovar sozinho até o limite</span><span className="block text-[12px] text-muted-foreground">Acima do limite o saque espera a sua revisão.</span></span>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Aprovar sozinho até o limite" />
          </label>
          <div className="space-y-1">
            <Label htmlFor="auto-max" className="text-[12px] font-medium text-muted-foreground">Limite por saque (R$)</Label>
            <Input id="auto-max" inputMode="decimal" value={max} onChange={(e) => { setMax(e.target.value); if (error) setError(""); }} />
          </div>
          {!PAYOUTS_AVAILABLE && <p className="rounded-[10px] border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-foreground">A regra fica salva, mas nenhum saque é pago enquanto não houver uma adquirente configurada.</p>}
          {error && <p role="alert" className="text-[12.5px] font-medium text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar regra"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
