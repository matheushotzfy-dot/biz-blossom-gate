import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogError, DialogFoot, DialogHead, FieldHint, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { maskBRL, parseBRL, toMaskedBRL } from "@/components/seller-ui/money";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { brl } from "@/features/admin-finance/types";
import { friendlyError } from "@/lib/friendlyError";
import { SalePicker } from "./SalePicker";
import { checkRefund, remainingOf, shortId, type SaleHit } from "./disputesModel";

/** Reembolso total ou parcial: debita o seller na hora e o repasse ao comprador espera a confirmação em "Pendentes de aprovação". */
export function RefundDialog({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate?: (tab: string) => void }) {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm();
  const [sale, setSale] = useState<SaleHit | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => { if (open) { setSale(null); setAmount(""); setReason(""); setTouched(false); setServerError(null); } }, [open]);

  const value = parseBRL(amount);
  const problem = checkRefund(sale, value, reason);

  const refund = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_refund_transaction" as never, { _transaction_id: sale!.id, _amount: value, _reason: reason.trim() } as never);
      if (error) throw error;
      return data as unknown as { partial?: boolean } | null;
    },
    onSuccess: (data) => {
      toast.success(data?.partial === true ? "Reembolso parcial registrado." : data?.partial === false ? "Reembolso total registrado." : "Reembolso registrado.", {
        description: "O valor já saiu do saldo do seller. Confirme o repasse ao comprador em Pendentes de aprovação.",
        action: onNavigate ? { label: "Ir para lá", onClick: () => onNavigate("refund-approvals") } : undefined,
      });
      void qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível reembolsar. Nada foi debitado.")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (problem || !sale) return;
    sensitive.confirm(`Reembolsar ${brl(value)} da venda ${shortId(sale.id)}. O valor é debitado do seller agora.`, async () => { await refund.mutateAsync().catch(() => undefined); });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !refund.isPending) onClose(); }}>
        <DialogContent className={dialogBox("lg")}>
          <DialogHead icon={<Undo2 className="h-5 w-5" />} title="Reembolsar venda" subtitle="Total ou parcial. Debita o seller proporcionalmente." />
          <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
            <DialogBody>
              <SalePicker value={sale} mode="refund" onChange={(s) => { setSale(s); setAmount(s ? toMaskedBRL(remainingOf(s)) : ""); }} />
              <div>
                <FieldLabel htmlFor="rf-amount">Valor a reembolsar</FieldLabel>
                <div className="relative max-w-[300px]">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted-foreground">R$</span>
                  <input id="rf-amount" className="vp-field vp-field-lg tabular-nums" style={{ paddingLeft: 48 }} inputMode="numeric" autoComplete="off" placeholder="0,00" value={amount} onChange={(e) => setAmount(maskBRL(e.target.value))} disabled={!sale} />
                </div>
                {sale
                  ? <FieldHint>Ainda pode reembolsar {brl(remainingOf(sale))}. {value > 0 && value < remainingOf(sale) ? "Reembolso parcial: a venda e o acesso continuam." : "Reembolso total: o acesso do comprador é removido e as comissões são estornadas."}</FieldHint>
                  : <FieldHint>Escolha a venda primeiro.</FieldHint>}
                {touched && sale && !(value > 0) && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">Informe o valor a reembolsar.</p>}
                {touched && sale && value > remainingOf(sale) + 0.001 && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">O valor passa do que ainda pode ser reembolsado.</p>}
              </div>
              <div>
                <FieldLabel htmlFor="rf-reason">Motivo</FieldLabel>
                <textarea id="rf-reason" className="vp-field resize-none" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                {touched && reason.trim().length < 5 && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">Explique o motivo (mínimo 5 caracteres).</p>}
              </div>
              <p className="rounded-[16px] bg-muted/50 p-4 text-[13px] leading-relaxed text-muted-foreground">
                O dinheiro só chega ao comprador depois que o repasse for confirmado em <strong className="font-semibold text-foreground">Pendentes de aprovação</strong>. Enquanto não houver adquirente conectado, essa confirmação é manual.
              </p>
              {touched && !sale && <p role="alert" className="text-[13px] font-medium text-destructive">Escolha a venda.</p>}
            </DialogBody>
            {serverError && <DialogError>{serverError}</DialogError>}
            <DialogFoot>
              <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={refund.isPending}>Cancelar</button>
              <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[170px]" disabled={refund.isPending}>
                {refund.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Reembolsando…</> : "Reembolsar"}
              </button>
            </DialogFoot>
          </form>
        </DialogContent>
      </Dialog>
      {sensitive.dialog}
    </>
  );
}
