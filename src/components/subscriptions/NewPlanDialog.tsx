import { useEffect, useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceChip, DialogBody, DialogFoot, DialogHead, FieldHint, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { maskBRL } from "@/components/seller-ui/money";
import { PLAN_INTERVALS, PLAN_MAX_TRIAL, PLAN_NAME_MAX, planSummary, validatePlan, type PlanErrors } from "./planMeta";
import type { PlanFormValues } from "./types";

const EMPTY: PlanFormValues = { name: "", description: "", price: "", interval: "monthly", trial: "0", product: "" };

export interface NewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Array<{ id: string; name: string }>;
  /** Devolve true quando o plano foi criado; o formulário só limpa nesse caso. */
  onCreate: (values: PlanFormValues) => Promise<boolean>;
}

function Err({ id, children }: { id: string; children?: string }) {
  return children ? <p id={id} role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{children}</p> : null;
}

export function NewPlanDialog({ open, onOpenChange, products, onCreate }: NewPlanDialogProps) {
  const [v, setV] = useState<PlanFormValues>(EMPTY);
  const [errors, setErrors] = useState<PlanErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<PlanFormValues>) => {
    setV((cur) => ({ ...cur, ...patch }));
    setErrors((cur) => { const next = { ...cur }; for (const k of Object.keys(patch)) delete next[k as keyof PlanErrors]; return next; });
  };

  useEffect(() => { if (open) setErrors({}); }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const found = validatePlan(v);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>('#new-plan [aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    try {
      if (await onCreate(v)) { setV(EMPTY); setErrors({}); }
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogBox("md")}>
        <DialogHead icon={<Repeat className="h-5 w-5" />} title="Novo plano de assinatura" subtitle="A cobrança se repete sozinha, no intervalo que você escolher." />
        <form id="new-plan" onSubmit={(e) => { void submit(e); }} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody>
            <div>
              <FieldLabel htmlFor="plan-name">Nome do plano</FieldLabel>
              <input id="plan-name" className="vp-field" value={v.name} maxLength={PLAN_NAME_MAX} autoComplete="off" onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Plano Premium" aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? "plan-name-err" : undefined} />
              <Err id="plan-name-err">{errors.name}</Err>
            </div>

            <div>
              <FieldLabel htmlFor="plan-price">Preço</FieldLabel>
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">R$</span>
                <input id="plan-price" className="vp-field vp-field-lg" type="text" inputMode="numeric" autoComplete="off" value={v.price} onChange={(e) => set({ price: maskBRL(e.target.value) })} placeholder="0,00" aria-invalid={errors.price ? true : undefined} aria-describedby={errors.price ? "plan-price-err" : undefined} />
              </div>
              <Err id="plan-price-err">{errors.price}</Err>
            </div>

            <div>
              <FieldLabel>Cobrar</FieldLabel>
              <div role="group" aria-label="Intervalo da cobrança" className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
                {PLAN_INTERVALS.map((i) => (
                  <ChoiceChip key={i.value} active={v.interval === i.value} onClick={() => set({ interval: i.value })} className={v.interval === i.value ? "justify-center bg-accent text-accent-foreground !border-primary/50" : "justify-center bg-background"}>{i.label}</ChoiceChip>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="plan-trial">Dias de teste grátis</FieldLabel>
              <input id="plan-trial" className="vp-field" type="number" min={0} max={PLAN_MAX_TRIAL} inputMode="numeric" value={v.trial} onChange={(e) => set({ trial: e.target.value })} aria-invalid={errors.trial ? true : undefined} aria-describedby="plan-trial-hint" />
              {errors.trial ? <Err id="plan-trial-hint">{errors.trial}</Err> : <FieldHint><span id="plan-trial-hint">0 = a primeira cobrança acontece na hora da assinatura.</span></FieldHint>}
            </div>

            <div>
              <FieldLabel htmlFor="plan-desc">Descrição</FieldLabel>
              <input id="plan-desc" className="vp-field" value={v.description} maxLength={200} autoComplete="off" onChange={(e) => set({ description: e.target.value })} placeholder="O que o assinante recebe" />
              <FieldHint>Opcional.</FieldHint>
            </div>

            {products.length > 0 && (
              <div>
                <FieldLabel htmlFor="plan-product">Produto ligado ao plano</FieldLabel>
                <Select value={v.product || "none"} onValueChange={(product) => set({ product })}>
                  <SelectTrigger id="plan-product" className="vp-r16 h-12"><SelectValue /></SelectTrigger>
                  <SelectContent collisionPadding={16}>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldHint>Opcional.</FieldHint>
              </div>
            )}
          </DialogBody>
          <DialogFoot lead={<p className="truncate text-[15px] font-bold text-foreground">{planSummary(v)}</p>}>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="submit" disabled={busy} className="vp-cta !h-12 justify-center sm:min-w-[150px]">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Criando…</> : "Criar plano"}
            </button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
