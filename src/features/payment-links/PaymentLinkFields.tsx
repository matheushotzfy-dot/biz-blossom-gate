import { Image as ImageIcon, X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentLinkDraft, PaymentLinkPermissions } from "./types";

interface PaymentLinkFieldsProps {
  draft: PaymentLinkDraft;
  permissions: PaymentLinkPermissions;
  coverPreview: string | null;
  fileInputRef: RefObject<HTMLInputElement>;
  onChange: (patch: Partial<PaymentLinkDraft>) => void;
  onPickFile: (file: File | null) => void;
  onClearCover: () => void;
}

function StepLabel({ number, children }: { number: number; children: ReactNode }) {
  return <h3 className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-xs font-bold text-primary">{number}</span>{children}</h3>;
}

export function PaymentLinkFields({ draft, permissions, coverPreview, fileInputRef, onChange, onPickFile, onClearCover }: PaymentLinkFieldsProps) {
  const methods = [
    { key: "accept_pix" as const, label: "PIX", detail: "Liberação imediata quando o processamento estiver ativo" },
    { key: "accept_card" as const, label: "Cartão", detail: "Disponível somente com autorização administrativa" },
    { key: "accept_boleto" as const, label: "Boleto", detail: "Desativado por padrão" },
  ];
  return <div className="grid gap-7 px-5 py-6 sm:px-8 lg:grid-cols-2">
    <section className="space-y-4" aria-labelledby="link-charge-heading">
      <div id="link-charge-heading"><StepLabel number={1}>O que você está cobrando</StepLabel></div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onPickFile(event.target.files?.[0] ?? null)} />
      {coverPreview ? <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border/60">
        <img src={coverPreview} alt="Prévia da capa" className="h-full w-full object-cover" />
        <Button type="button" variant="secondary" size="icon" onClick={onClearCover} className="absolute right-2 top-2 h-9 w-9 rounded-xl" aria-label="Remover capa"><X className="h-4 w-4" /></Button>
      </div> : <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-auto w-full aspect-[16/9] flex-col gap-2 rounded-2xl border-dashed text-muted-foreground">
        <ImageIcon className="h-6 w-6" /><span className="text-sm font-semibold">Adicionar capa</span><span className="text-xs font-normal">JPG, PNG ou WebP · até 4 MB</span>
      </Button>}
      <div><Label htmlFor="link-title">Título</Label><Input id="link-title" value={draft.title} onChange={(event) => onChange({ title: event.target.value })} maxLength={120} className="mt-1.5 h-11 rounded-xl" placeholder="Ex.: Consultoria Premium" /></div>
      <div><Label htmlFor="link-description">Descrição</Label><Textarea id="link-description" value={draft.description} onChange={(event) => onChange({ description: event.target.value })} maxLength={500} rows={3} className="mt-1.5 resize-none rounded-xl" placeholder="O que está incluído nesta cobrança" /></div>
      <div><Label htmlFor="link-amount">Valor</Label><div className="relative mt-1.5"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">R$</span><Input id="link-amount" inputMode="decimal" value={draft.amount} onChange={(event) => onChange({ amount: event.target.value })} className="h-16 rounded-2xl border-primary/40 bg-primary/[0.05] pl-12 text-2xl font-bold tabular-nums" placeholder="0,00" /></div></div>
      <div><Label htmlFor="link-slug">Endereço</Label><Input id="link-slug" value={draft.slug} onChange={(event) => onChange({ slug: event.target.value })} maxLength={60} className="mt-1.5 h-11 rounded-xl font-mono" placeholder="consultoria-premium" /></div>
    </section>
    <section className="space-y-4" aria-labelledby="link-rules-heading">
      <div id="link-rules-heading"><StepLabel number={2}>Regras e recebimento</StepLabel></div>
      <div className="divide-y divide-border/50 rounded-2xl border border-border/60 px-4">
        {methods.map((method) => <div key={method.key} className="flex items-center justify-between gap-4 py-3">
          <div><p className="text-sm font-semibold">{method.label}</p><p className="text-xs text-muted-foreground">{permissions[method.key] ? method.detail : "Bloqueado pelo administrador"}</p></div>
          <Switch disabled={!permissions[method.key]} checked={permissions[method.key] && draft[method.key]} onCheckedChange={(checked) => onChange({ [method.key]: checked })} aria-label={`Aceitar ${method.label}`} />
        </div>)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="link-limit">Limite de pagamentos</Label><Input id="link-limit" inputMode="numeric" value={draft.max_uses} onChange={(event) => onChange({ max_uses: event.target.value.replace(/\D/g, "") })} className="mt-1.5 h-11 rounded-xl" placeholder="Sem limite" /></div>
        <div><Label htmlFor="link-pix-expiration">Validade do PIX</Label><Input id="link-pix-expiration" type="number" min={5} max={1440} value={draft.pix_expiration_minutes} onChange={(event) => onChange({ pix_expiration_minutes: event.target.value })} className="mt-1.5 h-11 rounded-xl" /></div>
      </div>
      <div><Label htmlFor="link-expiration">Expirar o link em</Label><Input id="link-expiration" type="datetime-local" value={draft.expires_at} onChange={(event) => onChange({ expires_at: event.target.value })} className="mt-1.5 h-11 rounded-xl" /></div>
      <div><Label htmlFor="link-redirect">Redirecionamento após pagamento</Label><Input id="link-redirect" type="url" value={draft.redirect_url} onChange={(event) => onChange({ redirect_url: event.target.value })} className="mt-1.5 h-11 rounded-xl" placeholder="https://seusite.com/obrigado" /></div>
      <div><Label htmlFor="link-instructions">Instruções ao comprador</Label><Textarea id="link-instructions" value={draft.instructions} onChange={(event) => onChange({ instructions: event.target.value })} maxLength={1000} rows={4} className="mt-1.5 resize-none rounded-xl" placeholder="Informações exibidas antes do pagamento" /></div>
    </section>
  </div>;
}