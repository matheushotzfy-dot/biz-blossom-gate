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
import { HOLD_PRESETS, checkReason } from "./affiliatesModel";

/** `link` nulo = todos os links do afiliado. */
export interface HoldTarget { affiliate: { id: string; name: string }; link: { id: string; label: string } | null; hold: boolean }

/** Pausar um afiliado (ou um link dele) ou liberar de novo. Motivo, senha de novo e auditoria. */
export function HoldDialog({ target, onClose }: { target: HoldTarget | null; onClose: () => void }) {
  // guarda o último alvo para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<HoldTarget | null>(target);
  useEffect(() => { if (target) setLast(target); }, [target]);
  const t = target ?? last;
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("md")}>{t && <Body key={`${t.affiliate.id}-${t.link?.id ?? "all"}-${t.hold}`} t={t} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ t, onClose }: { t: HoldTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const { affiliate, link, hold } = t;
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const problem = checkReason(reason);
  const label = hold ? (link ? "Pausar link" : "Pausar afiliado") : (link ? "Liberar link" : "Liberar afiliado");

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_set_affiliate_hold" as never, { _affiliate_user_id: affiliate.id, _link_id: link?.id ?? null, _hold: hold, _reason: reason.trim() } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(hold ? (link ? "Link pausado. Ele já não conta vendas." : "Afiliado pausado. Os links já não contam vendas.") : "Liberado. O dono do produto decide quando reativar.");
      void qc.invalidateQueries({ queryKey: ["admin-affiliates"] });
      void qc.invalidateQueries({ queryKey: ["admin-affiliate-products"] });
      void qc.invalidateQueries({ queryKey: ["admin-affiliate-detail", affiliate.id] });
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível concluir. Nada mudou.")),
  });

  const effect = hold
    ? `${link ? "O link deixa" : "Os links deixam"} de contar na hora: o checkout não atribui mais a venda e nenhuma comissão é paga, nem nas vendas que já estavam em andamento. O afiliado vê o motivo, não reativa e não cria link novo. O dono do produto é avisado, sem o motivo.`
    : `${link ? "O link continua pausado" : "Os links continuam pausados"}: quem decide reativar é o dono do produto. O afiliado e o dono recebem um aviso.`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (problem) return;
    sensitive.confirm(`${label}: ${link ? link.label : affiliate.name}${link ? `, de ${affiliate.name}` : ""}. ${effect}`, async () => { await m.mutateAsync().catch(() => undefined); });
  };

  return (
    <>
      <DialogHead icon={hold ? <ShieldOff className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />} title={`${label}?`} subtitle={link ? `${link.label} · ${affiliate.name}` : affiliate.name} />
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
        <DialogBody>
          <p className="text-[14px] leading-relaxed text-foreground/90">{effect}</p>
          <div>
            <FieldLabel htmlFor="affiliate-hold-reason" hint={hold ? "O afiliado vê o motivo e ele fica no histórico." : "Fica no histórico do afiliado."}>Motivo</FieldLabel>
            {hold && (
              <div className="mb-2.5 flex flex-wrap gap-2">
                {HOLD_PRESETS.map((p) => <ChoiceChip key={p} active={reason === p} onClick={() => setReason(p)} className="!h-9 px-3.5 text-[13px]">{p}</ChoiceChip>)}
              </div>
            )}
            <textarea id="affiliate-hold-reason" className="vp-field resize-none" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !!problem} />
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
