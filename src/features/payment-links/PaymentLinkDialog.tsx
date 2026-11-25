import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { parseBRL } from "@/components/seller-ui/money";
import { flattenZodErrors, paymentLinkFormSchema, type FieldErrors } from "@/lib/validation";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { PaymentLinkFields } from "./PaymentLinkFields";
import { emptyPaymentLinkDraft, paymentLinkToDraft, type PaymentLink, type PaymentLinkDraft, type PaymentLinkPermissions } from "./types";

interface PaymentLinkDialogProps {
  open: boolean;
  busy: boolean;
  permissions: PaymentLinkPermissions;
  editing: PaymentLink | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: PaymentLinkDraft, coverFile: File | null) => Promise<void>;
}

const slugifyLink = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export function PaymentLinkDialog({ open, busy, permissions, editing, onOpenChange, onSubmit }: PaymentLinkDialogProps) {
  const [draft, setDraft] = useState<PaymentLinkDraft>(() => emptyPaymentLinkDraft(permissions));
  const [errors, setErrors] = useState<FieldErrors<PaymentLinkDraft>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(editing ? paymentLinkToDraft(editing, permissions) : emptyPaymentLinkDraft(permissions));
    setErrors({}); setFailure(null);
    setCoverFile(null);
    setCoverPreview(editing?.cover_url ?? null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [editing, open, permissions]);

  useEffect(() => () => {
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const publicSlug = slugifyLink(draft.slug || draft.title) || "seu-link";
  const amount = useMemo(() => parseBRL(draft.amount), [draft.amount]);
  const methods = [draft.accept_pix && "Pix", draft.accept_card && "cartão", draft.accept_boleto && "boleto"].filter(Boolean).join(", ");

  const change = (patch: Partial<PaymentLinkDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setFailure(null);
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof PaymentLinkDraft)[]) delete next[key];
      if ("accept_card" in patch || "accept_boleto" in patch || "accept_pix" in patch) delete next.accept_pix;
      return next;
    });
  };

  const pickFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) { toast.error("Use uma imagem JPG, PNG ou WebP"); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("A capa deve ter no máximo 4 MB"); return; }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = paymentLinkFormSchema.safeParse({ ...draft, slug: publicSlug, amount });
    if (!parsed.success) {
      const found = flattenZodErrors(parsed.error) as FieldErrors<PaymentLinkDraft>;
      setErrors(found);
      // leva o olho para o primeiro campo com problema
      window.requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setFailure(null);
    try {
      await onSubmit({ ...draft, slug: publicSlug, amount: String(amount) }, coverFile);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Não foi possível salvar o link. Tente de novo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogBox("wide")}>
        <DialogHead
          icon={<Link2 className="h-5 w-5" />}
          title={editing ? "Editar link de pagamento" : "Novo link de pagamento"}
          subtitle={editing ? "Ajuste o valor, os métodos ou a validade do link." : "Defina o valor, escolha como receber e publique."}
          aside={
            <div className="vp-r16 max-w-[240px] bg-muted px-4 py-2">
              <p className="text-[12px] font-semibold text-muted-foreground">Endereço</p>
              <p className="truncate font-mono text-[13px] font-semibold text-foreground">/pl/{publicSlug}</p>
            </div>
          }
        />
        <form onSubmit={(event) => { void submit(event); }} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="!space-y-0">
            <div ref={bodyRef}>
              <PaymentLinkFields
                draft={draft} permissions={permissions} errors={errors} publicSlug={publicSlug}
                coverPreview={coverPreview} fileInputRef={fileInputRef} onChange={change} onPickFile={pickFile}
                onClearCover={() => { setCoverFile(null); setCoverPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              />
            </div>
          </DialogBody>
          {failure && <p role="alert" className="border-t border-border bg-destructive/10 px-6 py-3 text-[13.5px] font-medium text-destructive sm:px-8">{failure}</p>}
          <DialogFoot
            lead={
              <>
                <p className="truncate text-[15px] font-bold text-foreground">
                  {amount > 0 ? formatCurrency(amount) : "Defina o valor"}
                  <span className="font-medium text-muted-foreground">{methods ? `, recebendo por ${methods}` : ", nenhum método escolhido"}</span>
                </p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">As cobranças só começam a funcionar quando houver uma adquirente configurada.</p>
              </>
            }
          >
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="submit" disabled={busy} className="vp-cta !h-12 justify-center sm:min-w-[190px]">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Salvando…</> : editing ? "Salvar alterações" : "Publicar link"}
            </button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
