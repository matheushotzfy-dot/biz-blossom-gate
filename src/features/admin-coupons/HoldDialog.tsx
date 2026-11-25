import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlayCircle, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceChip, DialogBody, DialogError, DialogFoot, DialogHead, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { HOLD_PRESETS, checkReason } from "./couponsModel";

export interface HoldTarget { coupon: { id: string; code: string; seller_name: string }; hold: boolean }

/** Pausar um cupom (o seller não consegue reativar) ou liberá-lo de novo. Motivo, senha de novo e auditoria. */
export function HoldDialog({ target, onClose }: { target: HoldTarget | null; onClose: () => void }) {
  // guarda o último alvo para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<HoldTarget | null>(target);
  useEffect(() => { if (target) setLast(target); }, [target]);
  const t = target ?? last;
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("md")}>{t && <Body key={`${t.coupon.id}-${t.hold}`} t={t} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ t, onClose }: { t: HoldTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const { coupon, hold } = t;
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const problem = checkReason(reason);
  const label = hold ? "Pausar cupom" : "Liberar cupom";

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_set_coupon_hold" as never, { _id: coupon.id, _hold: hold, _reason: reason.trim() } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(hold ? "Cupom pausado. O checkout já recusa o código." : "Cupom liberado. O seller decide quando ativar.");
      void qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      void qc.invalidateQueries({ queryKey: ["admin-coupon-detail", coupon.id] });
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível concluir. Nada mudou.")),
  });

  const effect = hold
    ? "O checkout recusa o código na hora. Quem já gerou um Pix com ele continua com o desconto. O seller recebe o motivo e não consegue ativar de novo até você liberar."
    : "O cupom continua pausado: o seller decide quando ativar de novo. Ele recebe um aviso de que foi liberado.";

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (problem) return;
    sensitive.confirm(`${label}: ${coupon.code}, de ${coupon.seller_name}. ${effect}`, async () => { await m.mutateAsync().catch(() => undefined); });
  };

  return (
    <>
      <DialogHead icon={hold ? <ShieldOff className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />} title={`${label}?`} subtitle={`${coupon.code} · ${coupon.seller_name}`} />
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
        <DialogBody>
          <p className="text-[14px] leading-relaxed text-foreground/90">{effect}</p>
          <div>
            <FieldLabel htmlFor="coupon-hold-reason" hint={hold ? "O seller vê o motivo e ele fica no histórico do cupom." : "Fica no histórico do cupom."}>Motivo</FieldLabel>
            {hold && (
              <div className="mb-2.5 flex flex-wrap gap-2">
                {HOLD_PRESETS.map((p) => <ChoiceChip key={p} active={reason === p} onClick={() => setReason(p)} className="!h-9 px-3.5 text-[13px]">{p}</ChoiceChip>)}
              </div>
            )}
            <textarea id="coupon-hold-reason" className="vp-field resize-none" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !!problem} />
            {touched && problem && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problem}</p>}
          </div>
        </DialogBody>
        {serverError && <DialogError>{serverError}</DialogError>}
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={m.isPending}>Cancelar</button>
          <button type="submit" className={cn("vp-cta", hold && "vp-cta-danger", "!h-12 justify-center sm:min-w-[170px]")} disabled={m.isPending}>
            {m.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : label}
          </button>
        </DialogFoot>
      </form>
      {sensitive.dialog}
    </>
  );
}
