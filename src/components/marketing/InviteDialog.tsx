import { useEffect, useMemo, useState } from "react";
import { Handshake, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHead, FieldHint, FieldLabel, FormSection, dialogShell } from "@/components/seller-ui/form";
import { cn, formatCurrency } from "@/lib/utils";
import { SPLIT_DEFAULT, SPLIT_MAX, SPLIT_MIN, cleanEmail, isValidEmail, parseSplit, partnerShare } from "./coproMeta";

export interface InviteProduct { id: string; name: string; price: number }
export interface InviteValues { productId: string; email: string; split: number }
export interface InviteSaveResult { ok: boolean; message?: string }

export interface InviteTarget {
  mode: "create" | "edit";
  productId?: string;
  email?: string;
  split?: number;
}

export function InviteDialog({ target, products, ownEmail, onOpenChange, onSave }: {
  target: InviteTarget | null;
  /** Produtos que ainda podem receber um convite. */
  products: InviteProduct[];
  ownEmail: string;
  onOpenChange: (open: boolean) => void;
  onSave: (values: InviteValues) => Promise<InviteSaveResult>;
}) {
  const [productId, setProductId] = useState("");
  const [email, setEmail] = useState("");
  const [split, setSplit] = useState(String(SPLIT_DEFAULT));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setProductId(target.productId ?? ""); setEmail(target.email ?? ""); setSplit(String(target.split ?? SPLIT_DEFAULT));
      setTouched(false); setBusy(false); setError(null);
    }
  }, [target]);

  const edit = target?.mode === "edit";
  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const pct = parseSplit(split);
  const mail = cleanEmail(email);
  const emailMsg = !mail ? "Informe o e-mail do parceiro." : !isValidEmail(mail) ? "Esse e-mail parece incompleto." : mail === cleanEmail(ownEmail) ? "Você não pode convidar o seu próprio e-mail." : null;
  const productMsg = !productId ? "Escolha o produto." : null;
  const splitMsg = pct === null ? `Use um número inteiro entre ${SPLIT_MIN}% e ${SPLIT_MAX}%.` : null;
  const valid = !emailMsg && !productMsg && !splitMsg;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || busy || pct === null) return;
    setBusy(true); setError(null);
    try {
      const res = await onSave({ productId, email: mail, split: pct });
      if (!res.ok) setError(res.message || "Não foi possível salvar. Tente de novo.");
    } finally { setBusy(false); }
  };

  const example = 100;
  const partner = pct === null ? 0 : partnerShare(example, pct);

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className={cn(dialogShell, "flex max-h-[min(92dvh,780px)] w-[calc(100vw-1rem)] max-w-[560px] flex-col")}>
        <DialogHead icon={<Handshake className="h-5 w-5" />} title={edit ? "Alterar divisão" : "Nova coprodução"} subtitle={edit ? "Só dá para mudar enquanto o convite não foi aceito." : "Divida o valor das vendas de um produto com outro produtor."} />
        <form onSubmit={(e) => { void submit(e); }} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6 sm:px-8">
            <FormSection title="Parceria" subtitle="Quem entra e em qual produto.">
              <div>
                <FieldLabel htmlFor="co-product">Produto</FieldLabel>
                {edit ? (
                  <p id="co-product" className="vp-field flex items-center !bg-muted/60 font-semibold">{product?.name ?? "Produto"}</p>
                ) : (
                  <Select value={productId} onValueChange={(v) => { setProductId(v); setError(null); }}>
                    <SelectTrigger id="co-product" className="vp-r16 h-12" aria-invalid={touched && !!productMsg}><SelectValue placeholder={products.length === 0 ? "Nenhum produto disponível" : "Escolha um produto"} /></SelectTrigger>
                    <SelectContent collisionPadding={16} className="max-h-72">
                      {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.price > 0 ? `, ${formatCurrency(p.price)}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {touched && productMsg && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{productMsg}</p>}
                {!edit && products.length === 0 && <FieldHint>Todos os seus produtos já têm uma coprodução em andamento ou ainda são rascunho.</FieldHint>}
              </div>
              <div>
                <FieldLabel htmlFor="co-email">E-mail do parceiro</FieldLabel>
                <input id="co-email" type="email" autoComplete="off" inputMode="email" className="vp-field disabled:opacity-70" disabled={edit} value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="parceiro@email.com" aria-invalid={touched && !!emailMsg} aria-describedby="co-email-hint" />
                <p id="co-email-hint" role={touched && emailMsg ? "alert" : undefined} className={cn("mt-1.5 text-[12.5px] leading-snug", touched && emailMsg ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {touched && emailMsg ? emailMsg : "O parceiro vê o convite em Coproduções ao entrar com este e-mail. Ainda não enviamos aviso por e-mail."}
                </p>
              </div>
            </FormSection>

            <FormSection title="Divisão" subtitle="Quanto de cada venda vai para o parceiro.">
              <div>
                <FieldLabel htmlFor="co-split">Porcentagem do parceiro</FieldLabel>
                <div className="relative max-w-[220px]">
                  <input id="co-split" inputMode="numeric" className="vp-field !pr-10 font-bold tabular-nums" value={split} onChange={(e) => { setSplit(e.target.value.replace(/\D/g, "").slice(0, 2)); setError(null); }} aria-invalid={touched && !!splitMsg} aria-describedby="co-split-hint" />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-muted-foreground">%</span>
                </div>
                <p id="co-split-hint" role={touched && splitMsg ? "alert" : undefined} className={cn("mt-1.5 text-[12.5px] leading-snug", touched && splitMsg ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {touched && splitMsg ? splitMsg : `De ${SPLIT_MIN}% a ${SPLIT_MAX}%.`}
                </p>
              </div>
              <div className="rounded-[16px] bg-accent px-4 py-3.5" aria-live="polite">
                <p className="text-[12.5px] font-medium text-accent-foreground/80">A cada {formatCurrency(example)} líquidos de uma venda</p>
                {pct !== null ? (
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-4 text-accent-foreground">
                    <span><span className="vp-num text-[22px] font-extrabold tracking-[-0.03em]">{formatCurrency(example - partner)}</span> <span className="text-[13.5px] font-semibold">ficam com você</span></span>
                    <span><span className="vp-num text-[22px] font-extrabold tracking-[-0.03em]">{formatCurrency(partner)}</span> <span className="text-[13.5px] font-semibold">para o parceiro</span></span>
                  </p>
                ) : <p className="mt-0.5 text-[13.5px] text-accent-foreground/80">Informe a porcentagem para ver a divisão.</p>}
                {product && product.price > 0 && pct !== null && <p className="mt-1.5 text-[12.5px] text-accent-foreground/80">No preço de {formatCurrency(product.price)}, o parceiro recebe até {formatCurrency(partnerShare(product.price, pct))} por venda, antes das taxas.</p>}
              </div>
              <FieldHint>A divisão é calculada sobre o valor líquido, depois das taxas, e cai para o parceiro no momento em que o pagamento é aprovado. Se o produto também tem afiliados, a comissão deles nunca passa do que sobra depois da parte do parceiro.</FieldHint>
            </FormSection>
          </div>

          {error && <p role="alert" className="border-t border-border bg-destructive/10 px-6 py-3 text-[13.5px] font-medium text-destructive sm:px-8">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center" disabled={busy || (!edit && products.length === 0)}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Salvando…</> : edit ? "Salvar divisão" : "Criar convite"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
