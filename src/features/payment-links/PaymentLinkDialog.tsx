import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { paymentLinkFormSchema } from "@/lib/validation";
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

const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const parseAmount = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));

export function PaymentLinkDialog({ open, busy, permissions, editing, onOpenChange, onSubmit }: PaymentLinkDialogProps) {
  const [draft, setDraft] = useState<PaymentLinkDraft>(() => emptyPaymentLinkDraft(permissions));
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(editing ? paymentLinkToDraft(editing, permissions) : emptyPaymentLinkDraft(permissions));
    setCoverFile(null);
    setCoverPreview(editing?.cover_url ?? null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [editing, open, permissions]);

  useEffect(() => () => {
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const publicSlug = slugify(draft.slug || draft.title) || "seu-link";
  const amount = useMemo(() => parseAmount(draft.amount), [draft.amount]);
  const selectedMethods = [draft.accept_pix && "PIX", draft.accept_card && "cartão", draft.accept_boleto && "boleto"].filter(Boolean).join(", ");

  const pickFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) { toast.error("Use uma imagem JPG, PNG ou WebP"); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("A capa deve ter no máximo 4 MB"); return; }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = { ...draft, slug: publicSlug, amount };
    const parsed = paymentLinkFormSchema.safeParse(normalized);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Revise os campos do link"); return; }
    await onSubmit({ ...draft, slug: publicSlug, amount: String(amount) }, coverFile);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex w-[calc(100vw-1rem)] max-w-[920px] max-h-[94vh] flex-col gap-0 overflow-hidden rounded-[28px] border border-border bg-card p-0">
      <DialogHeader className="flex-row items-center gap-4 space-y-0 border-b border-border px-5 py-5 text-left sm:px-8">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Link2 className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><DialogTitle className="text-[20px] font-extrabold tracking-[-0.03em]">{editing ? "Editar link de pagamento" : "Novo link de pagamento"}</DialogTitle><DialogDescription className="mt-1 text-[14px]">Defina o valor, escolha como receber e revise antes de publicar.</DialogDescription></div>
        <div className="mr-8 hidden max-w-[260px] rounded-full border border-border bg-background px-4 py-2 sm:block"><p className="text-[12px] text-muted-foreground">Endereço do link</p><p className="truncate font-mono text-[13px] font-semibold">/pl/{publicSlug}</p></div>
      </DialogHeader>
      <form onSubmit={(event) => { void submit(event).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar o link")); }} className="min-h-0 overflow-y-auto">
        <PaymentLinkFields draft={draft} permissions={permissions} coverPreview={coverPreview} fileInputRef={fileInputRef} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} onPickFile={pickFile} onClearCover={() => { setCoverFile(null); setCoverPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} />
        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-muted/40 px-5 py-5 sm:flex-row sm:items-center sm:px-8">
          <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-bold text-foreground">{amount > 0 ? formatCurrency(amount) : "Defina o valor"}<span className="font-medium text-muted-foreground">{selectedMethods ? `, recebendo por ${selectedMethods}` : ", nenhum método escolhido"}</span></p><p className="mt-0.5 text-[13px] text-warning">As cobranças ficam indisponíveis até uma adquirente ser configurada.</p></div>
          <button type="submit" disabled={busy} className="vp-cta !h-12 w-full sm:w-auto sm:min-w-[220px]">{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando…</> : editing ? "Salvar alterações" : "Publicar link"}</button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}