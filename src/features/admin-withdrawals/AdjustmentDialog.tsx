import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";
import { SellerSelect } from "@/features/admin-finance/SellerSelect";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { brl, rpcErrorMessage } from "@/features/admin-finance/types";
import { cn } from "@/lib/utils";
import { parseAmount, validateAdjustment } from "./withdrawalsModel";

/**
 * Ajuste manual de saldo. O banco exige senha confirmada nos últimos 10 minutos
 * (assert_recent_auth), por isso o envio passa pela confirmação reforçada.
 */
export function AdjustmentDialog({ open, onOpenChange, profiles, onApplied }: { open: boolean; onOpenChange: (open: boolean) => void; profiles: Tables<"profiles">[]; onApplied: () => void }) {
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const { confirm, dialog } = useSensitiveConfirm();

  const reset = () => { setUserId(""); setType("credit"); setAmount(""); setReason(""); setError(""); };
  const close = (next: boolean) => { if (!next) reset(); onOpenChange(next); };

  const submit = () => {
    const problem = validateAdjustment({ userId, amount, reason });
    if (problem) { setError(problem); return; }
    setError("");
    const value = parseAmount(amount) ?? 0;
    const who = profiles.find((p) => p.user_id === userId);
    const name = who?.full_name || who?.email || "o seller";
    confirm(`${type === "credit" ? "Creditar" : "Debitar"} ${brl(value)} ${type === "credit" ? "no saldo de" : "do saldo de"} ${name}. Fica registrado na auditoria e não dá para desfazer.`, async () => {
      const { error: rpcError } = await supabase.rpc("admin_request_balance_adjustment", { _user_id: userId, _type: type, _amount: value, _reason: reason.trim() });
      if (rpcError) { setError(rpcErrorMessage(rpcError)); return; }
      toast.success(`${type === "credit" ? "Crédito" : "Débito"} de ${brl(value)} aplicado`);
      reset(); onOpenChange(false); onApplied();
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle>Ajuste manual de saldo</DialogTitle>
            <DialogDescription>Soma ou tira dinheiro do saldo de um seller. Cada ajuste pede a sua senha e fica na auditoria.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4 px-5 py-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="space-y-1"><Label className="text-[12px] font-medium text-muted-foreground">Seller</Label><SellerSelect profiles={profiles} value={userId} onChange={(v) => { setUserId(v); setError(""); }} /></div>
            <div role="group" aria-label="Tipo de ajuste" className="grid grid-cols-2 gap-2 rounded-[10px] border border-border bg-muted/30 p-1.5">
              {([["credit", "Crédito", Plus, "bg-success/10 text-success border-success/30"], ["debit", "Débito", Minus, "bg-destructive/10 text-destructive border-destructive/30"]] as const).map(([v, label, Icon, on]) => (
                <button key={v} type="button" aria-pressed={type === v} onClick={() => setType(v)}
                  className={cn("flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[13px] font-semibold transition-colors", type === v ? on : "border-transparent text-muted-foreground hover:text-foreground")}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="adj-amount" className="text-[12px] font-medium text-muted-foreground">Valor (R$)</Label>
              <Input id="adj-amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => { setAmount(e.target.value); if (error) setError(""); }} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adj-reason" className="text-[12px] font-medium text-muted-foreground">Motivo (obrigatório)</Label>
              <Textarea id="adj-reason" className="min-h-[80px]" maxLength={1000} placeholder="Ex.: compensação de chargeback indevido" value={reason} onChange={(e) => { setReason(e.target.value); if (error) setError(""); }} />
            </div>
            {error && <p role="alert" className="text-[12.5px] font-medium text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => close(false)}>Cancelar</Button>
              <Button type="submit">Continuar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}
