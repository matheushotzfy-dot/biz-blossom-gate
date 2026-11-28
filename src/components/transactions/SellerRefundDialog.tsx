import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { maskBRL, parseBRL, toMaskedBRL } from "@/components/seller-ui/money";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export interface SellerRefundDialogProps {
  tx: Tables<"transactions"> | null;
  onClose: () => void;
  onDone?: () => void;
}

const REASON_MIN = 5;
const REASON_MAX = 500;

/** Quanto ainda pode ser devolvido da venda (valor pago menos o que já foi reembolsado). */
const refundableAmount = (tx: Pick<Tables<"transactions">, "amount" | "refunded_amount"> | null) =>
  tx ? Math.max(0, Math.round((Number(tx.amount) - Number(tx.refunded_amount ?? 0)) * 100) / 100) : 0;

/**
 * Reembolso feito pelo seller. Todas as regras (dono da venda, venda paga, sem MED aberto, valor restante,
 * saldo suficiente) valem no servidor; aqui só se confere antes para dar resposta rápida.
 */
export function SellerRefundDialog({ tx, onClose, onDone }: SellerRefundDialogProps) {
  const qc = useQueryClient();
  // guarda a última venda para o texto não virar R$ 0,00 durante a animação de fechar
  const lastTx = useRef(tx);
  if (tx) lastTx.current = tx;
  const shown = tx ?? lastTx.current;
  const remaining = refundableAmount(shown);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // cada venda abre o formulário do zero
  useEffect(() => {
    if (!tx) return;
    setAmount(""); setReason(""); setTouched(false); setError(null);
  }, [tx?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const typed = parseBRL(amount);
  const value = amount === "" ? remaining : typed;
  const isTotal = Math.abs(value - remaining) < 0.005;
  const cleanReason = reason.trim();

  const amountError = value <= 0 ? "Informe um valor maior que zero." : value > remaining + 0.004 ? `O máximo para esta venda é ${formatCurrency(remaining)}.` : null;
  const reasonError = cleanReason.length < REASON_MIN ? `Escreva pelo menos ${REASON_MIN} caracteres.` : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tx || busy) return;
    setTouched(true);
    if (amountError || reasonError) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc("seller_refund_transaction", {
      _transaction_id: tx.id, _amount: Math.round(value * 100) / 100, _reason: cleanReason,
    });
    setBusy(false);
    if (err) {
      const text = err.message.replace(/^P\d{4}:\s*/, "").trim();
      setError(text ? text.charAt(0).toUpperCase() + text.slice(1) : "Não foi possível reembolsar.");
      return;
    }
    toast.success("Reembolso registrado e descontado do seu saldo");
    await qc.invalidateQueries();
    onDone?.();
    onClose();
  };

  return (
    <Dialog open={!!tx} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className={dialogBox("md")}>
        <DialogHead icon={<Undo2 className="h-5 w-5" />} title="Reembolsar cliente" subtitle="O valor sai do seu saldo na hora." />
        <form noValidate onSubmit={(e) => { void submit(e); }} className="flex min-h-0 flex-1 flex-col">
          <DialogBody>
            <div className="flex items-center justify-between gap-4 rounded-[16px] bg-muted/60 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-muted-foreground">Disponível para reembolso</p>
                {shown && Number(shown.refunded_amount ?? 0) > 0 && (
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">Já devolvido: {formatCurrency(Number(shown.refunded_amount))}</p>
                )}
              </div>
              <p className="shrink-0 text-[24px] font-extrabold tabular-nums tracking-[-0.03em] text-foreground">{formatCurrency(remaining)}</p>
            </div>

            <FormField
              id="refund-amount" label="Quanto devolver"
              hint={isTotal ? "Reembolso total: o comprador perde o acesso ao produto." : "Reembolso parcial: o acesso do comprador continua."}
              error={touched ? amountError : null}
            >
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">R$</span>
                <input
                  id="refund-amount" type="text" inputMode="numeric" autoComplete="off"
                  className="vp-field vp-field-lg" placeholder={toMaskedBRL(remaining) || "0,00"}
                  value={amount} onChange={(e) => setAmount(maskBRL(e.target.value))}
                  aria-invalid={touched && amountError ? true : undefined} aria-describedby="refund-amount-msg"
                />
              </div>
              <button
                type="button" disabled={remaining <= 0 || amount === ""}
                onClick={() => setAmount("")}
                className="vp-pill mt-2.5 border border-border bg-background disabled:pointer-events-none disabled:opacity-40"
              >
                Devolver tudo ({formatCurrency(remaining)})
              </button>
            </FormField>

            <FormField
              id="refund-reason" label="Motivo"
              hint={<>Fica registrado na venda. <span className="tabular-nums">{cleanReason.length}/{REASON_MAX}</span></>}
              error={touched ? reasonError : null}
            >
              <textarea
                id="refund-reason" rows={3} maxLength={REASON_MAX} className="vp-field resize-none"
                placeholder="Ex.: o cliente pediu o cancelamento pelo suporte"
                value={reason} onChange={(e) => setReason(e.target.value)}
                aria-invalid={touched && reasonError ? true : undefined} aria-describedby="refund-reason-msg"
              />
            </FormField>

            <p className="text-[13px] leading-relaxed text-muted-foreground">Esta ação não pode ser desfeita.</p>
          </DialogBody>
          {error && <DialogError>{error}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="submit" className="vp-cta vp-cta-danger !h-12 justify-center sm:min-w-[210px]" disabled={busy || remaining <= 0}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Processando…</> : amountError ? "Reembolsar" : `Reembolsar ${formatCurrency(value)}`}
            </button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
