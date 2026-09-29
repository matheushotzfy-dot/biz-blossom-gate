import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, rpcErrorMessage } from "./types";

interface PendingRequest { id: string; type: string; amount: number; reason: string; created_at: string }

interface BalanceAdjustCardProps { userId: string; onDone: () => void }

/**
 * Credit/debit a seller balance through the audited server routine.
 * Amounts above R$ 5.000 become a request that a second admin must approve.
 */
export function BalanceAdjustCard({ userId, onDone }: BalanceAdjustCardProps) {
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRequest[]>([]);

  const loadPending = useCallback(async () => {
    const { data } = await supabase.from("balance_adjustment_requests")
      .select("id,type,amount,reason,created_at").eq("user_id", userId).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(20);
    setPending((data ?? []) as PendingRequest[]);
  }, [userId]);

  useEffect(() => { void loadPending(); }, [loadPending]);

  const submit = async () => {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) { toast.error("Informe um valor válido"); return; }
    if (reason.trim().length < 5) { toast.error("Motivo obrigatório (mín. 5 caracteres)"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_request_balance_adjustment", {
      _user_id: userId, _type: type, _amount: value, _reason: reason.trim(),
    });
    setBusy(false);
    if (error) { toast.error(rpcErrorMessage(error)); return; }
    const status = (data as { status?: string } | null)?.status;
    toast.success(status === "pending_approval" ? "Pedido criado — outro admin precisa aprovar" : "Saldo ajustado");
    setAmount(""); setReason("");
    void loadPending(); onDone();
  };

  const decide = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("admin_decide_balance_adjustment", { _request_id: id, _approve: approve });
    if (error) { toast.error(rpcErrorMessage(error)); return; }
    toast.success(approve ? "Ajuste aprovado" : "Ajuste recusado");
    void loadPending(); onDone();
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-2">
        {(["credit", "debit"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={cn("rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
              type === t ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {t === "credit" ? "Creditar" : "Debitar"}
          </button>
        ))}
      </div>
      <Input inputMode="decimal" placeholder="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Valor do ajuste" />
      <Textarea rows={2} maxLength={1000} placeholder="Motivo (fica registrado na auditoria)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motivo" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Acima de R$ 5.000 exige aprovação de outro admin.</p>
        <Button size="sm" onClick={submit} disabled={busy}>{busy ? "Enviando..." : "Confirmar ajuste"}</Button>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-semibold">Aguardando aprovação</p>
          {pending.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold">{p.type === "credit" ? "Crédito" : "Débito"} de {brl(p.amount)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{p.reason}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => decide(p.id, true)} aria-label="Aprovar"><Check className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => decide(p.id, false)} aria-label="Recusar"><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
