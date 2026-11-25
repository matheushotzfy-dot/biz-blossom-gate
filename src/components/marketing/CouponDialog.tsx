import { useEffect, useMemo, useState } from "react";
import { Dices, Loader2, Ticket } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DialogHead, FieldHint, FieldLabel, FormSection, GroupBox, ToggleRow, ChoiceChip, dialogShell } from "@/components/seller-ui/form";
import { cn, formatCurrency } from "@/lib/utils";
import {
  CODE_MAX, CODE_MIN, PERCENT_MAX, addDaysInput, applyDiscount, cleanCode, parseAmount, randomCode, toDateInput, todayInput,
  type Coupon,
} from "./couponMeta";

export interface CouponFormValues {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  productId: string | null;
  maxUses: number | null;
  /** AAAA-MM-DD ou vazio (sem prazo). */
  expires: string;
  applyToBumps: boolean;
}

export interface CouponSaveResult { ok: boolean; field?: "code"; message?: string }

export interface CouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "edit" altera o cupom; "create" e "duplicate" criam um novo. */
  mode: "create" | "edit" | "duplicate";
  /** Cupom base (edição ou duplicação). */
  coupon?: Coupon | null;
  products: Array<{ id: string; name: string; price: number; status: string }>;
  /** Códigos que o vendedor já tem (em maiúsculas), para avisar antes de salvar. */
  takenCodes: string[];
  onSave: (values: CouponFormValues) => Promise<CouponSaveResult>;
}

const EXPIRY_CHIPS: Array<{ label: string; days: number | null }> = [
  { label: "Sem prazo", days: null },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

interface FormState { code: string; type: "percentage" | "fixed"; value: string; productId: string; maxUses: string; expires: string; bumps: boolean }

const fromCoupon = (c: Coupon | null | undefined, mode: CouponDialogProps["mode"]): FormState => ({
  code: c && mode === "edit" ? c.code : "",
  type: c?.discount_type === "fixed" ? "fixed" : "percentage",
  value: c ? String(Number(c.discount_value)).replace(".", ",") : "",
  productId: c?.product_id ?? "all",
  maxUses: c?.max_uses ? String(c.max_uses) : "",
  expires: mode === "edit" ? toDateInput(c?.expires_at ?? null) : "",
  bumps: !!c?.apply_to_bumps,
});

export function CouponDialog({ open, onOpenChange, mode, coupon, products, takenCodes, onSave }: CouponDialogProps) {
  const [f, setF] = useState<FormState>(() => fromCoupon(coupon, mode));
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<{ field?: "code"; message: string } | null>(null);
  const set = (patch: Partial<FormState>) => { setServerError(null); setF((cur) => ({ ...cur, ...patch })); };

  // Cada abertura começa do cupom certo (novo, editado ou copiado).
  useEffect(() => {
    if (open) { setF(fromCoupon(coupon, mode)); setTouched(false); setServerError(null); setBusy(false); }
  }, [open, coupon, mode]);

  const editing = mode === "edit";
  const today = todayInput();
  const product = products.find((p) => p.id === f.productId);
  const valueNum = parseAmount(f.value);
  const maxUsesNum = f.maxUses.trim() === "" ? null : Number(f.maxUses);

  const errors = useMemo(() => {
    const e: Partial<Record<"code" | "value" | "maxUses" | "expires", string>> = {};
    if (!editing) {
      if (f.code.length < CODE_MIN) e.code = `Use pelo menos ${CODE_MIN} caracteres.`;
      else if (takenCodes.includes(f.code)) e.code = "Você já tem um cupom com esse código.";
    }
    if (!Number.isFinite(valueNum) || valueNum <= 0) e.value = f.type === "percentage" ? "Informe a porcentagem do desconto." : "Informe o valor do desconto.";
    else if (f.type === "percentage" && (valueNum < 1 || valueNum > PERCENT_MAX)) e.value = `A porcentagem fica entre 1% e ${PERCENT_MAX}%.`;
    if (maxUsesNum !== null) {
      if (!Number.isInteger(maxUsesNum) || maxUsesNum < 1) e.maxUses = "Use um número inteiro a partir de 1.";
      else if (editing && coupon && maxUsesNum < coupon.current_uses) e.maxUses = `Já houve ${coupon.current_uses} ${coupon.current_uses === 1 ? "resgate" : "resgates"}. O limite precisa ser ${coupon.current_uses} ou mais.`;
    }
    const keptDate = editing && coupon && toDateInput(coupon.expires_at) === f.expires;
    if (f.expires && f.expires < today && !keptDate) e.expires = "Escolha hoje ou uma data futura.";
    return e;
  }, [f, valueNum, maxUsesNum, editing, coupon, takenCodes, today]);

  const hasErrors = Object.keys(errors).length > 0;
  const codeError = serverError?.field === "code" ? serverError.message : errors.code;

  const price = product && product.price > 0 ? product.price : 100;
  const preview = Number.isFinite(valueNum) && valueNum > 0 && (f.type === "fixed" || valueNum <= PERCENT_MAX) ? applyDiscount(f.type, valueNum, price) : null;
  const fixedTooBig = f.type === "fixed" && Number.isFinite(valueNum) && valueNum >= price;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched(true);
    if (hasErrors || busy) return;
    setBusy(true);
    try {
      const res = await onSave({
        code: f.code, type: f.type, value: Math.round(valueNum * 100) / 100,
        productId: f.productId === "all" ? null : f.productId, maxUses: maxUsesNum, expires: f.expires, applyToBumps: f.bumps,
      });
      if (!res.ok) setServerError({ field: res.field, message: res.message || "Não foi possível salvar. Tente de novo." });
    } finally { setBusy(false); }
  };

  const title = editing ? "Editar cupom" : mode === "duplicate" ? "Duplicar cupom" : "Novo cupom";
  const subtitle = editing ? `Altera só o que vale daqui para frente. ${coupon?.code ?? ""}` : "Um código que o cliente digita no checkout.";
  const showErr = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className={cn(dialogShell, "flex max-h-[min(92dvh,860px)] w-[calc(100vw-1rem)] max-w-[620px] flex-col")}>
        <DialogHead icon={<Ticket className="h-5 w-5" />} title={title} subtitle={subtitle} />
        <form onSubmit={(e) => { void submit(e); }} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6 sm:px-8">
            <FormSection title="Código" subtitle="É o que o cliente digita. Só letras, números, hífen e sublinhado.">
              <div className="flex gap-2">
                <input
                  id="coupon-code" className="vp-field font-mono !text-[16px] font-bold uppercase tracking-[0.06em]" placeholder="BLACKFRIDAY" value={f.code}
                  onChange={(e) => set({ code: cleanCode(e.target.value) })} readOnly={editing} maxLength={CODE_MAX} autoComplete="off" autoCapitalize="characters" spellCheck={false}
                  aria-invalid={!!(codeError && (touched || serverError))} aria-describedby="coupon-code-hint"
                />
                {!editing && (
                  <button type="button" className="vp-ghost vp-r16 !h-12 shrink-0 !px-4" onClick={() => set({ code: randomCode() })} aria-label="Gerar um código">
                    <Dices className="h-[18px] w-[18px]" /><span className="hidden sm:inline">Gerar</span>
                  </button>
                )}
              </div>
              <p id="coupon-code-hint" className={cn("text-[12.5px] leading-snug", codeError && (touched || serverError) ? "font-medium text-destructive" : "text-muted-foreground")} role={codeError && (touched || serverError) ? "alert" : undefined}>
                {(touched || serverError) && codeError ? codeError : editing ? "O código não muda depois de criado, porque os clientes já podem ter ele." : `Entre ${CODE_MIN} e ${CODE_MAX} caracteres.`}
              </p>
            </FormSection>

            <FormSection title="Desconto">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de desconto">
                <ChoiceChip active={f.type === "percentage"} onClick={() => set({ type: "percentage" })}>Porcentagem</ChoiceChip>
                <ChoiceChip active={f.type === "fixed"} onClick={() => set({ type: "fixed" })}>Valor fixo em reais</ChoiceChip>
              </div>
              <div>
                <FieldLabel htmlFor="coupon-value">{f.type === "percentage" ? "Quanto sai do preço" : "Quanto sai do preço, em reais"}</FieldLabel>
                <div className="relative max-w-[240px]">
                  {f.type === "fixed" && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-muted-foreground">R$</span>}
                  <input
                    id="coupon-value" inputMode="decimal" className={cn("vp-field font-bold tabular-nums", f.type === "fixed" ? "!pl-12" : "!pr-10")} placeholder={f.type === "percentage" ? "10" : "30,00"}
                    value={f.value} onChange={(e) => set({ value: e.target.value.replace(/[^\d.,]/g, "") })} aria-invalid={!!showErr("value")} aria-describedby="coupon-value-hint"
                  />
                  {f.type === "percentage" && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-muted-foreground">%</span>}
                </div>
                <p id="coupon-value-hint" className={cn("mt-1.5 text-[12.5px] leading-snug", showErr("value") ? "font-medium text-destructive" : "text-muted-foreground")} role={showErr("value") ? "alert" : undefined}>
                  {showErr("value") ?? (f.type === "percentage" ? `Até ${PERCENT_MAX}%. O checkout cobra no mínimo R$ 0,01.` : "O checkout cobra no mínimo R$ 0,01.")}
                </p>
              </div>

              <div className="rounded-[16px] bg-accent px-4 py-3.5" aria-live="polite">
                {preview ? (
                  <>
                    <p className="text-[12.5px] font-medium text-accent-foreground/80">{product && product.price > 0 ? `Em ${product.name}` : "Exemplo com um produto de R$ 100,00"}</p>
                    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-accent-foreground">
                      <span className="text-[13.5px] text-accent-foreground/70 line-through tabular-nums">{formatCurrency(price)}</span>
                      <span className="vp-num text-[22px] font-extrabold tracking-[-0.03em]">{formatCurrency(preview.final)}</span>
                      <span className="text-[13.5px] font-semibold">o cliente economiza {formatCurrency(preview.discount)}</span>
                    </p>
                    {fixedTooBig && <p className="mt-1 text-[12.5px] text-accent-foreground/80">O desconto é maior que o preço. O checkout limita ele para sobrar R$ 0,01.</p>}
                  </>
                ) : (
                  <p className="text-[13.5px] text-accent-foreground/80">Preencha o desconto para ver quanto o cliente paga.</p>
                )}
              </div>
            </FormSection>

            <FormSection title="Onde vale">
              <div>
                <FieldLabel htmlFor="coupon-product">Produto</FieldLabel>
                <Select value={f.productId} onValueChange={(v) => set({ productId: v })}>
                  <SelectTrigger id="coupon-product" className="vp-r16 h-12"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" collisionPadding={16} className="z-[120] max-h-[280px]">
                    <SelectItem value="all">Todos os meus produtos</SelectItem>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.status === "inactive" ? " (pausado)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldHint>{products.length === 0 ? "Você ainda não tem produtos publicados. O cupom vale para todos que criar." : "Escolha um produto para limitar o cupom a ele."}</FieldHint>
              </div>
              <GroupBox>
                <ToggleRow title="Vale também nos order bumps" description="Estende o desconto às ofertas extras do checkout.">
                  <Switch checked={f.bumps} onCheckedChange={(v) => set({ bumps: v })} aria-label="Aplicar o cupom também nos order bumps" />
                </ToggleRow>
              </GroupBox>
            </FormSection>

            <FormSection title="Limites" subtitle="Opcional. Deixe em branco para o cupom valer sem limite.">
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
                <div>
                  <FieldLabel htmlFor="coupon-max">Quantos resgates</FieldLabel>
                  <input id="coupon-max" inputMode="numeric" className="vp-field tabular-nums" placeholder="Sem limite" value={f.maxUses} onChange={(e) => set({ maxUses: e.target.value.replace(/\D/g, "").slice(0, 7) })} aria-invalid={!!showErr("maxUses")} aria-describedby="coupon-max-hint" />
                  <p id="coupon-max-hint" className={cn("mt-1.5 text-[12.5px] leading-snug", showErr("maxUses") ? "font-medium text-destructive" : "text-muted-foreground")} role={showErr("maxUses") ? "alert" : undefined}>
                    {showErr("maxUses") ?? (editing && coupon ? `${coupon.current_uses} ${coupon.current_uses === 1 ? "resgate" : "resgates"} até agora.` : "Cada compra paga conta como 1.")}
                  </p>
                </div>
                <div>
                  <FieldLabel htmlFor="coupon-exp">Vale até</FieldLabel>
                  <input id="coupon-exp" type="date" className="vp-field" min={today} value={f.expires} onChange={(e) => set({ expires: e.target.value })} aria-invalid={!!showErr("expires")} aria-describedby="coupon-exp-hint" />
                  <p id="coupon-exp-hint" className={cn("mt-1.5 text-[12.5px] leading-snug", showErr("expires") ? "font-medium text-destructive" : "text-muted-foreground")} role={showErr("expires") ? "alert" : undefined}>
                    {showErr("expires") ?? "Vale até o fim desse dia (horário de Brasília)."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de validade">
                {EXPIRY_CHIPS.map((c) => {
                  const value = c.days === null ? "" : addDaysInput(c.days);
                  return <ChoiceChip key={c.label} active={f.expires === value} onClick={() => set({ expires: value })} className="!h-9 !px-3.5 !text-[13px]">{c.label}</ChoiceChip>;
                })}
              </div>
            </FormSection>
          </div>

          {serverError && !serverError.field && <p role="alert" className="border-t border-border bg-destructive/10 px-6 py-3 text-[13.5px] font-medium text-destructive sm:px-8">{serverError.message}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center" disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Salvando…</> : editing ? "Salvar alterações" : "Criar cupom"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
