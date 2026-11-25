import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, PlayCircle, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceChip, DialogBody, DialogError, DialogFoot, DialogHead, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { CANCEL_PRESETS, HOLD_PRESETS, checkReason } from "./subscriptionsModel";

export type ActionTarget =
  | { kind: "plan"; plan: { id: string; name: string; seller_name: string }; hold: boolean }
  | { kind: "cancel"; sub: { id: string; label: string; plan_name: string } };

/** Pausar/liberar um plano ou cancelar uma assinatura. Motivo, senha de novo e auditoria. */
export function ActionDialog({ target, onClose }: { target: ActionTarget | null; onClose: () => void }) {
  // guarda o último alvo para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<ActionTarget | null>(target);
  useEffect(() => { if (target) setLast(target); }, [target]);
  const t = target ?? last;
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("md")}>{t && <Body key={t.kind === "plan" ? `p-${t.plan.id}-${t.hold}` : `s-${t.sub.id}`} t={t} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ t, onClose }: { t: ActionTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const problem = checkReason(reason);

  const cancel = t.kind === "cancel";
  const hold = t.kind === "plan" ? t.hold : true;
  const label = cancel ? "Cancelar assinatura" : hold ? "Pausar plano" : "Liberar plano";
  const subject = t.kind === "plan" ? t.plan.name : t.sub.label;
  const presets = cancel ? CANCEL_PRESETS : hold ? HOLD_PRESETS : [];

  const effect = t.kind === "cancel"
    ? "A assinatura é encerrada e as cobranças futuras e atrasadas deixam de valer. Um Pix que já foi gerado não é desfeito e nenhum valor é devolvido. Não dá para reativar por aqui. O seller é avisado com o motivo; o assinante, se tiver conta, também é avisado, sem o motivo."
    : hold
      ? "O plano sai do ar e o seller não consegue reativar nem apagar. As assinaturas que já existem continuam como estão."
      : "O plano continua pausado: quem decide reativar é o seller. Ele recebe um aviso.";

  const m = useMutation({
    mutationFn: async () => {
      const { error } = t.kind === "cancel"
        ? await supabase.rpc("admin_cancel_subscription" as never, { _id: t.sub.id, _reason: reason.trim() } as never)
        : await supabase.rpc("admin_set_plan_hold" as never, { _plan_id: t.plan.id, _hold: t.hold, _reason: reason.trim() } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(cancel ? "Assinatura cancelada." : hold ? "Plano pausado. O seller não reativa sozinho." : "Plano liberado. O seller decide quando reativar.");
      void qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      void qc.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
      void qc.invalidateQueries({ queryKey: ["admin-subscription-detail"] });
      void qc.invalidateQueries({ queryKey: ["admin-subscription-plan-detail"] });
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível concluir. Nada mudou.")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (problem) return;
    const who = t.kind === "plan" ? `, de ${t.plan.seller_name}` : `, no plano ${t.sub.plan_name}`;
    sensitive.confirm(`${label}: ${subject}${who}. ${effect}`, async () => { await m.mutateAsync().catch(() => undefined); });
  };

  const Icon = cancel ? Ban : hold ? ShieldOff : PlayCircle;
  return (
    <>
      <DialogHead icon={<Icon className="h-5 w-5" />} title={`${label}?`} subtitle={subject} />
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
        <DialogBody>
          <p className="text-[14px] leading-relaxed text-foreground/90">{effect}</p>
          <div>
            <FieldLabel htmlFor="subscription-action-reason" hint={cancel ? "Fica no histórico da assinatura e o seller vê." : hold ? "Aparece para o seller e fica no histórico do plano." : "Fica no histórico do plano."}>Motivo</FieldLabel>
            {presets.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-2">
                {presets.map((p) => <ChoiceChip key={p} active={reason === p} onClick={() => setReason(p)} className="!h-9 px-3.5 text-[13px]">{p}</ChoiceChip>)}
              </div>
            )}
            <textarea id="subscription-action-reason" className="vp-field resize-none" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !!problem} />
            {touched && problem && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problem}</p>}
          </div>
        </DialogBody>
        {serverError && <DialogError>{serverError}</DialogError>}
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={m.isPending}>Voltar</button>
          <button type="submit" className={cn("vp-cta", hold && "vp-cta-danger", "!h-12 justify-center sm:min-w-[190px]")} disabled={m.isPending}>
            {m.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : label}
          </button>
        </DialogFoot>
      </form>
      {sensitive.dialog}
    </>
  );
}
