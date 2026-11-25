import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { friendlyError } from "@/lib/friendlyError";
import { setClaim } from "./rewardsApi";
import { MESSAGE_MAX, trackingErrors, type ClaimDetail, type TrackingForm } from "./rewardsModel";

/** Dados da postagem. Serve para marcar como postado (primeira vez) e para corrigir o rastreio de um pedido já postado. */
export function TrackingDialog({ claim, open, onClose, onDone }: { claim: ClaimDetail; open: boolean; onClose: () => void; onDone: () => void }) {
  const editing = claim.status === "shipped";
  const [f, setF] = useState<TrackingForm>({ carrier: "", code: "", url: "", message: "" });
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setF({ carrier: claim.tracking_carrier ?? "", code: claim.tracking_code ?? "", url: claim.tracking_url ?? "", message: claim.message ?? "" });
    setTouched(false); setServerError(null);
  }, [open, claim.id, claim.tracking_carrier, claim.tracking_code, claim.tracking_url, claim.message]);

  const errors = trackingErrors(f);
  const set = (k: keyof TrackingForm) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => setClaim({ id: claim.id, status: "shipped", carrier: f.carrier, code: f.code, url: f.url, message: f.message }),
    onSuccess: () => { toast.success(editing ? "Rastreio atualizado." : "Pedido marcado como postado. O seller foi avisado."); onDone(); onClose(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível salvar. Nada mudou.")),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (Object.keys(errors).length > 0) return;
    save.mutate();
  };
  const err = (k: keyof TrackingForm) => (touched ? errors[k] ?? null : null);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
      <DialogContent className={dialogBox("md")}>
        <DialogHead icon={<Truck className="h-5 w-5" />} title={editing ? "Corrigir rastreio" : "Marcar como postado"}
          subtitle={editing ? "O seller vê o código novo na hora." : "O seller recebe um aviso com o código de rastreio."} />
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
          <DialogBody>
            <FormField id="trk-code" label="Código de rastreio" error={err("code")}>
              <input id="trk-code" className="vp-field tabular-nums" autoFocus autoComplete="off" maxLength={100} value={f.code} onChange={set("code")} aria-invalid={err("code") ? true : undefined} />
            </FormField>
            <FormField id="trk-carrier" label="Transportadora" hint="Opcional. Aparece junto do código." error={err("carrier")}>
              <input id="trk-carrier" className="vp-field" autoComplete="off" maxLength={60} placeholder="Correios, Jadlog…" value={f.carrier} onChange={set("carrier")} />
            </FormField>
            <FormField id="trk-url" label="Link de rastreio" hint="Opcional. O seller abre por aqui." error={err("url")}>
              <input id="trk-url" className="vp-field" autoComplete="off" inputMode="url" placeholder="https://" value={f.url} onChange={set("url")} aria-invalid={err("url") ? true : undefined} />
            </FormField>
            <FormField id="trk-msg" label="Mensagem para o seller" hint="Opcional. O seller lê na página de premiações." error={err("message")}>
              <textarea id="trk-msg" className="vp-field resize-none" rows={3} maxLength={MESSAGE_MAX} value={f.message} onChange={set("message")} />
            </FormField>
          </DialogBody>
          {serverError && <DialogError>{serverError}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={save.isPending}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[170px]" disabled={save.isPending}>
              {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : editing ? "Salvar rastreio" : "Marcar como postado"}
            </button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
