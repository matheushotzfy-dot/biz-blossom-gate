import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { EMPTY_CLAIM, UF_LIST, lookupCep, maskCep, maskDocument, maskPhone, normalizeClaim, validateClaim, type ClaimForm } from "@/features/awards/claimForm";
import { friendlyError } from "@/lib/friendlyError";
import { callRpc } from "./rewardsApi";
import { reasonProblem, type ClaimDetail } from "./rewardsModel";

const fromClaim = (c: ClaimDetail): ClaimForm => ({
  recipient_name: c.recipient_name, phone: c.phone, document: c.document ?? "", shipping_zip: c.shipping_zip, shipping_street: c.shipping_street,
  shipping_number: c.shipping_number, shipping_complement: c.shipping_complement ?? "", shipping_neighborhood: c.shipping_neighborhood,
  shipping_city: c.shipping_city, shipping_state: c.shipping_state,
});

/** Corrige os dados de envio de um pedido que ainda não foi postado. O seller não edita depois de enviar; o motivo fica no histórico e ele é avisado. */
export function AddressDialog({ claim, open, onClose, onDone }: { claim: ClaimDetail; open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<ClaimForm>(EMPTY_CLAIM);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cepState, setCepState] = useState<"idle" | "busy" | "none" | "fail">("idle");

  useEffect(() => {
    if (!open) return;
    setF(fromClaim(claim)); setReason(""); setTouched(false); setServerError(null); setCepState("idle");
  }, [open, claim]);

  const errors = validateClaim(f);
  const reasonError = reasonProblem(reason);
  const set = <K extends keyof ClaimForm>(k: K, v: ClaimForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const err = (k: keyof ClaimForm) => (touched ? errors[k] ?? null : null);

  const findCep = async () => {
    setCepState("busy");
    try {
      const r = await lookupCep(f.shipping_zip);
      if (!r) { setCepState("none"); return; }
      setF((p) => ({ ...p, shipping_street: r.street || p.shipping_street, shipping_neighborhood: r.neighborhood || p.shipping_neighborhood, shipping_city: r.city || p.shipping_city, shipping_state: r.state || p.shipping_state }));
      setCepState("idle");
    } catch { setCepState("fail"); }
  };

  const save = useMutation({
    mutationFn: () => {
      const n = normalizeClaim(f);
      return callRpc("admin_update_reward_claim_shipping", {
        _id: claim.id, _recipient_name: n.recipient_name, _phone: n.phone, _document: n.document, _zip: n.shipping_zip, _street: n.shipping_street,
        _number: n.shipping_number, _complement: n.shipping_complement, _neighborhood: n.shipping_neighborhood, _city: n.shipping_city, _state: n.shipping_state, _reason: reason.trim(),
      });
    },
    onSuccess: () => { toast.success("Endereço corrigido. O seller foi avisado."); onDone(); onClose(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível corrigir o endereço. Nada mudou.")),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (Object.keys(errors).length > 0 || reasonError) return;
    save.mutate();
  };

  const zipDigits = f.shipping_zip.replace(/\D/g, "").length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
      <DialogContent className={dialogBox("lg")}>
        <DialogHead icon={<MapPin className="h-5 w-5" />} title="Corrigir endereço de envio" subtitle="Só dá para corrigir antes da postagem." />
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
          <DialogBody>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
              <FormField id="adr-name" label="Quem recebe" error={err("recipient_name")} className="sm:col-span-2">
                <input id="adr-name" className="vp-field" autoComplete="off" value={f.recipient_name} onChange={(e) => set("recipient_name", e.target.value)} aria-invalid={err("recipient_name") ? true : undefined} />
              </FormField>
              <FormField id="adr-phone" label="Telefone" error={err("phone")}>
                <input id="adr-phone" className="vp-field tabular-nums" inputMode="tel" autoComplete="off" value={f.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} aria-invalid={err("phone") ? true : undefined} />
              </FormField>
              <FormField id="adr-doc" label="CPF ou CNPJ" hint="Opcional." error={err("document")}>
                <input id="adr-doc" className="vp-field tabular-nums" inputMode="numeric" autoComplete="off" value={f.document} onChange={(e) => set("document", maskDocument(e.target.value))} aria-invalid={err("document") ? true : undefined} />
              </FormField>
              <FormField id="adr-zip" label="CEP" error={err("shipping_zip")}>
                <div className="flex items-center gap-2">
                  <input id="adr-zip" className="vp-field tabular-nums" inputMode="numeric" autoComplete="off" value={f.shipping_zip} onChange={(e) => set("shipping_zip", maskCep(e.target.value))} aria-invalid={err("shipping_zip") ? true : undefined} />
                  <button type="button" className="vp-ghost !h-12 shrink-0" disabled={zipDigits !== 8 || cepState === "busy"} onClick={() => void findCep()}>
                    {cepState === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </button>
                </div>
                {cepState === "none" && <p role="status" className="mt-1.5 text-[12.5px] text-muted-foreground">Esse CEP não existe. Confira os números.</p>}
                {cepState === "fail" && <p role="status" className="mt-1.5 text-[12.5px] text-muted-foreground">Não foi possível consultar o CEP agora. Preencha à mão.</p>}
              </FormField>
              <FormField id="adr-street" label="Rua" error={err("shipping_street")}>
                <input id="adr-street" className="vp-field" autoComplete="off" value={f.shipping_street} onChange={(e) => set("shipping_street", e.target.value)} aria-invalid={err("shipping_street") ? true : undefined} />
              </FormField>
              <FormField id="adr-number" label="Número" error={err("shipping_number")}>
                <input id="adr-number" className="vp-field" autoComplete="off" maxLength={20} value={f.shipping_number} onChange={(e) => set("shipping_number", e.target.value)} aria-invalid={err("shipping_number") ? true : undefined} />
              </FormField>
              <FormField id="adr-comp" label="Complemento" hint="Opcional.">
                <input id="adr-comp" className="vp-field" autoComplete="off" maxLength={80} value={f.shipping_complement} onChange={(e) => set("shipping_complement", e.target.value)} />
              </FormField>
              <FormField id="adr-hood" label="Bairro" error={err("shipping_neighborhood")}>
                <input id="adr-hood" className="vp-field" autoComplete="off" value={f.shipping_neighborhood} onChange={(e) => set("shipping_neighborhood", e.target.value)} aria-invalid={err("shipping_neighborhood") ? true : undefined} />
              </FormField>
              <FormField id="adr-city" label="Cidade" error={err("shipping_city")}>
                <input id="adr-city" className="vp-field" autoComplete="off" value={f.shipping_city} onChange={(e) => set("shipping_city", e.target.value)} aria-invalid={err("shipping_city") ? true : undefined} />
              </FormField>
              <FormField id="adr-uf" label="Estado" error={err("shipping_state")}>
                <Select value={f.shipping_state} onValueChange={(v) => set("shipping_state", v)}>
                  <SelectTrigger id="adr-uf" className="vp-r16 h-12" aria-invalid={!!err("shipping_state")}><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent collisionPadding={16} className="max-h-72">{UF_LIST.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField id="adr-reason" label="Motivo da correção" hint="Fica no histórico do pedido e o seller é avisado do que mudou." error={touched ? reasonError : null}>
              <textarea id="adr-reason" className="vp-field resize-none" rows={2} maxLength={300} placeholder="Ex.: o seller pediu para trocar o número da casa" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && reasonError ? true : undefined} />
            </FormField>
          </DialogBody>
          {serverError && <DialogError>{serverError}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={save.isPending}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[170px]" disabled={save.isPending}>
              {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : "Salvar endereço"}
            </button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
