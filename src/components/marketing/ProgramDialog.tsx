import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DialogHead, FieldHint, FieldLabel, FormSection, GroupBox, ToggleRow, ChoiceChip, dialogShell } from "@/components/seller-ui/form";
import { cn, formatCurrency } from "@/lib/utils";
import { COMMISSION_DEFAULT, COMMISSION_MAX, COMMISSION_MIN, commissionOf } from "./affiliateMeta";

export interface ProgramProduct { id: string; name: string; price: number; status: string; enabled: boolean; commission: number; affiliates: number }

export interface ProgramValues { enabled: boolean; commission: number; applyToCurrent: boolean }
export interface ProgramSaveResult { ok: boolean; message?: string }

export function ProgramDialog({ product, onOpenChange, onSave }: {
  product: ProgramProduct | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: ProgramValues) => Promise<ProgramSaveResult>;
}) {
  const [enabled, setEnabled] = useState(false);
  const [pct, setPct] = useState(String(COMMISSION_DEFAULT));
  const [applyAll, setApplyAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setEnabled(product.enabled);
      setPct(String(product.commission > 0 ? product.commission : COMMISSION_DEFAULT));
      setApplyAll(false); setBusy(false); setTouched(false); setError(null);
    }
  }, [product]);

  const pctNum = Number(pct);
  const pctValid = Number.isInteger(pctNum) && pctNum >= COMMISSION_MIN && pctNum <= COMMISSION_MAX;
  const changedPct = !!product && product.enabled && pctValid && pctNum !== product.commission;
  const turningOff = !!product && product.enabled && !enabled;
  const needsPct = enabled;
  const unchanged = !!product && enabled === product.enabled && (!enabled || (pctValid && pctNum === product.commission));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if ((needsPct && !pctValid) || busy || !product) return;
    setBusy(true); setError(null);
    try {
      const res = await onSave({ enabled, commission: enabled ? pctNum : product.commission, applyToCurrent: enabled && changedPct && applyAll });
      if (!res.ok) setError(res.message || "Não foi possível salvar. Tente de novo.");
    } finally { setBusy(false); }
  };

  const example = 100;
  const aff = pctValid ? commissionOf(example, pctNum) : 0;

  return (
    <Dialog open={!!product} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className={cn(dialogShell, "flex max-h-[min(92dvh,760px)] w-[calc(100vw-1rem)] max-w-[560px] flex-col")}>
        <DialogHead icon={<Users className="h-5 w-5" />} title="Programa de afiliados" subtitle={product?.name ?? ""} />
        <form onSubmit={(e) => { void submit(e); }} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6 sm:px-8">
            <GroupBox>
              <ToggleRow title="Aceitar afiliados neste produto" description="Ele aparece em Explorar produtos para outros vendedores divulgarem.">
                <Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); setError(null); }} aria-label="Aceitar afiliados neste produto" />
              </ToggleRow>
            </GroupBox>

            {product && product.status !== "active" && enabled && (
              <p className="rounded-[16px] bg-warning/15 px-4 py-3 text-[13.5px] font-medium leading-snug text-warning">
                Este produto não está ativo. Ele só aparece para afiliados quando estiver ativo.
              </p>
            )}

            {enabled && (
              <FormSection title="Comissão" subtitle="Quanto de cada venda vai para quem divulgar.">
                <div>
                  <FieldLabel htmlFor="aff-pct">Porcentagem para o afiliado</FieldLabel>
                  <div className="relative max-w-[220px]">
                    <input id="aff-pct" inputMode="numeric" className="vp-field !pr-10 font-bold tabular-nums" value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, "").slice(0, 2))} aria-invalid={touched && !pctValid} aria-describedby="aff-pct-hint" />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-muted-foreground">%</span>
                  </div>
                  <p id="aff-pct-hint" className={cn("mt-1.5 text-[12.5px] leading-snug", touched && !pctValid ? "font-medium text-destructive" : "text-muted-foreground")} role={touched && !pctValid ? "alert" : undefined}>
                    {touched && !pctValid ? `Use um número inteiro entre ${COMMISSION_MIN}% e ${COMMISSION_MAX}%.` : `De ${COMMISSION_MIN}% a ${COMMISSION_MAX}%.`}
                  </p>
                </div>

                <div className="rounded-[16px] bg-accent px-4 py-3.5" aria-live="polite">
                  <p className="text-[12.5px] font-medium text-accent-foreground/80">A cada {formatCurrency(example)} líquidos de uma venda</p>
                  {pctValid ? (
                    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-4 text-accent-foreground">
                      <span><span className="vp-num text-[22px] font-extrabold tracking-[-0.03em]">{formatCurrency(aff)}</span> <span className="text-[13.5px] font-semibold">para o afiliado</span></span>
                      <span><span className="vp-num text-[22px] font-extrabold tracking-[-0.03em]">{formatCurrency(example - aff)}</span> <span className="text-[13.5px] font-semibold">ficam com você</span></span>
                    </p>
                  ) : <p className="mt-0.5 text-[13.5px] text-accent-foreground/80">Informe a comissão para ver a divisão.</p>}
                  {product && product.price > 0 && pctValid && <p className="mt-1.5 text-[12.5px] text-accent-foreground/80">No preço de {formatCurrency(product.price)}, são até {formatCurrency(commissionOf(product.price, pctNum))} por venda, antes das taxas.</p>}
                </div>
                <FieldHint>A comissão é calculada sobre o valor líquido da venda, depois das taxas, e sai do seu saldo no momento em que o pagamento é aprovado.</FieldHint>

                {changedPct && product && product.affiliates > 0 && (
                  <div>
                    <FieldLabel>Quem já divulga ({product.affiliates})</FieldLabel>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Aplicar a nova comissão">
                      <ChoiceChip active={!applyAll} onClick={() => setApplyAll(false)}>Manter a comissão antiga</ChoiceChip>
                      <ChoiceChip active={applyAll} onClick={() => setApplyAll(true)}>Passar para a nova</ChoiceChip>
                    </div>
                    <FieldHint>{applyAll ? `Os links atuais passam a pagar ${pctNum}% nas próximas vendas. Vendas já feitas não mudam.` : "Os links atuais continuam com a comissão antiga. A nova vale só para quem se afiliar daqui para frente."}</FieldHint>
                  </div>
                )}
              </FormSection>
            )}

            {turningOff && (
              <p className="rounded-[16px] bg-warning/15 px-4 py-3 text-[13.5px] font-medium leading-snug text-warning">
                {product && product.affiliates > 0
                  ? `Os ${product.affiliates} ${product.affiliates === 1 ? "link de afiliado será pausado" : "links de afiliados serão pausados"}: vendas feitas por eles deixam de pagar comissão. O produto sai de Explorar produtos.`
                  : "O produto sai de Explorar produtos."}
              </p>
            )}
          </div>

          {error && <p role="alert" className="border-t border-border bg-destructive/10 px-6 py-3 text-[13.5px] font-medium text-destructive sm:px-8">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center" disabled={busy || unchanged}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Salvando…</> : "Salvar programa"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
