import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, BadgeCheck, Banknote, Loader2, XCircle, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceChip, DialogBody, DialogError, DialogFoot, DialogHead, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { brl } from "@/features/admin-finance/types";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { OUTCOME, checkReason, type Outcome } from "./referralsModel";

export interface ActionTarget { id: string; outcome: Outcome; referred_email: string; referrer_name: string; reward: number }

const ICON: Record<Outcome, LucideIcon> = { qualified: BadgeCheck, paid: Banknote, rejected: XCircle, cancelled: Ban };
const DONE: Record<Outcome, string> = {
  qualified: "Indicação qualificada. O seller foi avisado.",
  paid: "Pagamento registrado. O seller foi avisado.",
  rejected: "Indicação recusada. O seller foi avisado.",
  cancelled: "Indicação cancelada. O seller foi avisado.",
};

/** Qualificar, registrar o pagamento, recusar ou cancelar uma indicação. Motivo, senha de novo e auditoria. */
export function ActionDialog({ target, onClose }: { target: ActionTarget | null; onClose: () => void }) {
  // guarda o último alvo para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<ActionTarget | null>(target);
  useEffect(() => { if (target) setLast(target); }, [target]);
  const t = target ?? last;
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("md")}>{t && <Body key={`${t.id}-${t.outcome}`} t={t} onClose={onClose} />}</DialogContent>
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
  const copy = OUTCOME[t.outcome];
  const danger = t.outcome === "rejected" || t.outcome === "cancelled";

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_set_referral_status" as never, { _id: t.id, _status: t.outcome, _reason: reason.trim() } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(DONE[t.outcome]);
      void qc.invalidateQueries({ queryKey: ["admin-referrals"] });
      void qc.invalidateQueries({ queryKey: ["admin-referral-detail"] });
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível concluir. Nada mudou.")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (problem) return;
    sensitive.confirm(`${copy.title}: ${t.referred_email}, indicado por ${t.referrer_name}. ${copy.effect}`, async () => { await m.mutateAsync().catch(() => undefined); });
  };

  const Icon = ICON[t.outcome];
  return (
    <>
      <DialogHead icon={<Icon className="h-5 w-5" />} title={`${copy.title}?`} subtitle={`${t.referred_email} · ${brl(t.reward)}`} />
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
        <DialogBody>
          <p className="text-[14px] leading-relaxed text-foreground/90">{copy.effect}</p>
          <div>
            <FieldLabel htmlFor="referral-action-reason" hint={copy.hint}>Motivo</FieldLabel>
            <div className="mb-2.5 flex flex-wrap gap-2">
              {copy.presets.map((p) => <ChoiceChip key={p} active={reason === p} onClick={() => setReason(p)} className="!h-9 px-3.5 text-[13px]">{p}</ChoiceChip>)}
            </div>
            <textarea id="referral-action-reason" className="vp-field resize-none" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !!problem} />
            {touched && problem && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problem}</p>}
          </div>
        </DialogBody>
        {serverError && <DialogError>{serverError}</DialogError>}
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={m.isPending}>Voltar</button>
          <button type="submit" className={cn("vp-cta", danger && "vp-cta-danger", "!h-12 justify-center sm:min-w-[190px]")} disabled={m.isPending}>
            {m.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : copy.cta}
          </button>
        </DialogFoot>
      </form>
      {sensitive.dialog}
    </>
  );
}
