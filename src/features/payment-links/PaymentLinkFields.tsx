import { Barcode, CreditCard, ImagePlus, QrCode, X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { Switch } from "@/components/ui/switch";
import { FieldHint, FieldLabel, FormSection, GroupBox, ToggleRow } from "@/components/seller-ui/form";
import { maskBRL } from "@/components/seller-ui/money";
import type { FieldErrors } from "@/lib/validation";
import type { PaymentLinkDraft, PaymentLinkPermissions } from "./types";

interface PaymentLinkFieldsProps {
  draft: PaymentLinkDraft;
  permissions: PaymentLinkPermissions;
  errors: FieldErrors<PaymentLinkDraft>;
  /** Endereço público já normalizado (mostrado no campo "Endereço"). */
  publicSlug: string;
  coverPreview: string | null;
  fileInputRef: RefObject<HTMLInputElement>;
  onChange: (patch: Partial<PaymentLinkDraft>) => void;
  onPickFile: (file: File | null) => void;
  onClearCover: () => void;
}

const METHODS = [
  { key: "accept_pix" as const, label: "Pix", detail: "QR Code e copia e cola", icon: <QrCode className="h-5 w-5" /> },
  { key: "accept_card" as const, label: "Cartão", detail: "Cartão de crédito", icon: <CreditCard className="h-5 w-5" /> },
  { key: "accept_boleto" as const, label: "Boleto", detail: "Boleto bancário", icon: <Barcode className="h-5 w-5" /> },
];

function Err({ id, children }: { id: string; children?: string }) {
  return children ? <p id={id} role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{children}</p> : null;
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {error ? <Err id={`${id}-err`}>{error}</Err> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

export function PaymentLinkFields({ draft, permissions, errors, publicSlug, coverPreview, fileInputRef, onChange, onPickFile, onClearCover }: PaymentLinkFieldsProps) {
  const invalid = (k: keyof PaymentLinkDraft) => (errors[k] ? true : undefined);
  const describedBy = (k: keyof PaymentLinkDraft, id: string) => (errors[k] ? `${id}-err` : undefined);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-9 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
      <FormSection title="O que você está cobrando" subtitle="É o que a pessoa vê ao abrir o link.">
        <Field id="link-title" label="Título" error={errors.title}>
          <input id="link-title" className="vp-field" value={draft.title} onChange={(e) => onChange({ title: e.target.value })} maxLength={120} placeholder="Ex.: Consultoria premium" aria-invalid={invalid("title")} aria-describedby={describedBy("title", "link-title")} autoComplete="off" />
        </Field>


        <Field id="link-amount" label="Valor" error={errors.amount}>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">R$</span>
            <input id="link-amount" className="vp-field vp-field-lg" type="text" inputMode="numeric" autoComplete="off" value={draft.amount} onChange={(e) => onChange({ amount: maskBRL(e.target.value) })} placeholder="0,00" aria-invalid={invalid("amount")} aria-describedby={describedBy("amount", "link-amount")} />
          </div>
        </Field>


        <Field id="link-description" label="Descrição" hint="Opcional. Diga o que está incluído nesta cobrança.">
          <textarea id="link-description" className="vp-field resize-none" rows={3} value={draft.description} onChange={(e) => onChange({ description: e.target.value })} maxLength={500} placeholder="Ex.: Uma hora de consultoria por videochamada." />
        </Field>


        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
        {coverPreview ? (
          <div className="relative aspect-[16/7] overflow-hidden rounded-[16px]">
            <img src={coverPreview} alt="Prévia da capa" className="h-full w-full object-cover" />
            <button type="button" onClick={onClearCover} aria-label="Remover capa" className="vp-orb absolute right-2.5 top-2.5 !h-9 !w-9 bg-card/90 backdrop-blur"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="vp-r16 flex aspect-[16/7] w-full flex-col items-center justify-center gap-1.5 border border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ImagePlus className="h-6 w-6" />
            <span className="text-[14px] font-semibold text-foreground">Adicionar capa</span>
            <span className="text-[12.5px]">JPG, PNG ou WebP, até 4 MB</span>
          </button>
        )}


        <Field id="link-slug" label="Endereço do link" error={errors.slug} hint={`vemprapay.com/pl/${publicSlug}`}>
          <input id="link-slug" className="vp-field font-mono !text-[14px]" value={draft.slug} onChange={(e) => onChange({ slug: e.target.value })} maxLength={60} placeholder="consultoria-premium" spellCheck={false} autoComplete="off" aria-invalid={invalid("slug")} aria-describedby={describedBy("slug", "link-slug")} />
        </Field>
      </FormSection>

      <FormSection title="Como receber" subtitle="Só aparecem como ativos os métodos liberados para a sua conta.">
        <div>
          <GroupBox>
            {METHODS.map((m) => {
              const allowed = permissions[m.key];
              return (
                <ToggleRow key={m.key} icon={m.icon} tone={allowed ? "accent" : "muted"} title={m.label} description={allowed ? m.detail : "Ainda não liberado para a sua conta"}>
                  <Switch disabled={!allowed} checked={allowed && draft[m.key]} onCheckedChange={(checked) => onChange({ [m.key]: checked })} aria-label={`Aceitar ${m.label}`} />
                </ToggleRow>
              );
            })}
          </GroupBox>
          <Err id="link-methods-err">{errors.accept_pix}</Err>
        </div>

        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
          <Field id="link-limit" label="Limite de pagamentos" error={errors.max_uses} hint="Vazio = sem limite">
            <input id="link-limit" className="vp-field" inputMode="numeric" value={draft.max_uses} onChange={(e) => onChange({ max_uses: e.target.value.replace(/\D/g, "") })} placeholder="Sem limite" aria-invalid={invalid("max_uses")} aria-describedby={describedBy("max_uses", "link-limit")} />
          </Field>
          <Field id="link-pix-expiration" label="Validade do Pix" error={errors.pix_expiration_minutes} hint="Em minutos (5 a 1440)">
            <input id="link-pix-expiration" className="vp-field" type="number" min={5} max={1440} inputMode="numeric" value={draft.pix_expiration_minutes} onChange={(e) => onChange({ pix_expiration_minutes: e.target.value })} aria-invalid={invalid("pix_expiration_minutes")} aria-describedby={describedBy("pix_expiration_minutes", "link-pix-expiration")} />
          </Field>
        </div>

        <Field id="link-expiration" label="O link deixa de valer em" error={errors.expires_at} hint="Opcional. Depois dessa data ninguém consegue pagar.">
          <input id="link-expiration" className="vp-field" type="datetime-local" value={draft.expires_at} onChange={(e) => onChange({ expires_at: e.target.value })} aria-invalid={invalid("expires_at")} aria-describedby={describedBy("expires_at", "link-expiration")} />
        </Field>

        <Field id="link-redirect" label="Para onde levar depois de pagar" error={errors.redirect_url} hint="Opcional. Se vazio, mostramos a confirmação da Vemprapay.">
          <input id="link-redirect" className="vp-field" type="url" inputMode="url" autoComplete="off" spellCheck={false} value={draft.redirect_url} onChange={(e) => onChange({ redirect_url: e.target.value })} placeholder="https://seusite.com/obrigado" aria-invalid={invalid("redirect_url")} aria-describedby={describedBy("redirect_url", "link-redirect")} />
        </Field>

        <Field id="link-instructions" label="Instruções para quem vai pagar" hint="Opcional. Aparece antes do pagamento.">
          <textarea id="link-instructions" className="vp-field resize-none" rows={3} value={draft.instructions} onChange={(e) => onChange({ instructions: e.target.value })} maxLength={1000} placeholder="Ex.: Envie o comprovante para o WhatsApp depois de pagar." />
        </Field>
      </FormSection>
    </div>
  );
}
