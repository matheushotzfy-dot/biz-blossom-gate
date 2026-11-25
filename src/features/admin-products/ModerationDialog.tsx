import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Loader2, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceChip, DialogBody, DialogError, DialogFoot, DialogHead, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { actionEffect, actionIsDanger, actionLabel, actionNeedsReason, checkReason, REASON_PRESETS, type ProductAction, type ProductLike } from "./productsModel";

export interface ModerationTarget { product: ProductLike & { id: string; name: string; seller_name: string }; action: ProductAction }

const ICON = { approve: CheckCircle2, review: ShieldAlert, deactivate: Ban, delete: Trash2, restore: RotateCcw } as const;

const SUCCESS: Record<ProductAction, (p: ProductLike) => string> = {
  approve: (p) => (p.status === "inactive" ? "Produto reativado. O checkout voltou a vender." : "Produto aprovado. O checkout já pode vender."),
  review: () => "Produto em revisão. Saiu do ar até você aprovar.",
  deactivate: () => "Produto desativado. Saiu do ar.",
  delete: () => "Produto excluído. Dá para restaurar em Apagados.",
  restore: () => "Produto restaurado como inativo.",
};

async function run(id: string, action: ProductAction, reason: string) {
  const { error } = action === "delete"
    ? await supabase.rpc("admin_delete_product" as never, { _id: id, _reason: reason } as never)
    : action === "restore"
      ? await supabase.rpc("admin_restore_product" as never, { _id: id, _reason: reason } as never)
      : await supabase.rpc("admin_set_product_status" as never, { _id: id, _status: action === "approve" ? "active" : action === "review" ? "pending_review" : "inactive", _reason: action === "approve" ? null : reason } as never);
  if (error) throw error;
}

/** Aprovar, pôr em revisão, desativar, excluir ou restaurar: motivo quando muda a vida do seller, senha de novo e registro na auditoria. */
export function ModerationDialog({ target, onClose, onDone }: { target: ModerationTarget | null; onClose: () => void; onDone?: (action: ProductAction) => void }) {
  // guarda o último alvo para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<ModerationTarget | null>(target);
  useEffect(() => { if (target) setLast(target); }, [target]);
  const t = target ?? last;
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("md")}>{t && <Body key={`${t.product.id}-${t.action}`} t={t} onClose={onClose} onDone={onDone} />}</DialogContent>
    </Dialog>
  );
}

function Body({ t, onClose, onDone }: { t: ModerationTarget; onClose: () => void; onDone?: (action: ProductAction) => void }) {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const { product, action } = t;
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const needsReason = actionNeedsReason(action);
  const danger = actionIsDanger(action);
  const label = actionLabel(action, product);
  const Icon = ICON[action];
  const presets = action === "approve" ? [] : REASON_PRESETS[action];
  const problem = needsReason ? checkReason(reason) : null;

  const m = useMutation({
    mutationFn: () => run(product.id, action, reason.trim()),
    onSuccess: () => {
      toast.success(SUCCESS[action](product));
      void qc.invalidateQueries({ queryKey: ["admin-products"] });
      void qc.invalidateQueries({ queryKey: ["admin-product-detail", product.id] });
      onDone?.(action);
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível concluir. Nada mudou.")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (problem) return;
    sensitive.confirm(`${label}: ${product.name}, de ${product.seller_name}. ${actionEffect(action, product)}`, async () => { await m.mutateAsync().catch(() => undefined); });
  };

  return (
    <>
      <DialogHead icon={<Icon className="h-5 w-5" />} title={`${label}?`} subtitle={`${product.name} · ${product.seller_name}`} />
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
        <DialogBody>
          <p className="text-[14px] leading-relaxed text-foreground/90">{actionEffect(action, product)}</p>
          {needsReason && (
            <div>
              <FieldLabel htmlFor="mod-reason" hint={action === "restore" ? "Fica no histórico do produto." : "O seller vê o motivo e ele fica no histórico do produto."}>Motivo</FieldLabel>
              {presets.length > 0 && (
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {presets.map((p) => <ChoiceChip key={p} active={reason === p} onClick={() => setReason(p)} className="!h-9 px-3.5 text-[13px]">{p}</ChoiceChip>)}
                </div>
              )}
              <textarea id="mod-reason" className="vp-field resize-none" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !!problem} />
              {touched && problem && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problem}</p>}
            </div>
          )}
        </DialogBody>
        {serverError && <DialogError>{serverError}</DialogError>}
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={m.isPending}>Cancelar</button>
          <button type="submit" className={cn("vp-cta", danger && "vp-cta-danger", "!h-12 justify-center sm:min-w-[170px]")} disabled={m.isPending}>
            {m.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : label}
          </button>
        </DialogFoot>
      </form>
      {sensitive.dialog}
    </>
  );
}
