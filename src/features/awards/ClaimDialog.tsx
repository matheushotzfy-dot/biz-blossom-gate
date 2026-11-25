import { useEffect, useRef, useState } from "react";
import { Check, Gift, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHead, FieldHint, FieldLabel, FormSection, dialogShell } from "@/components/seller-ui/form";
import { Notice } from "@/components/seller-ui/studio";
import { cn } from "@/lib/utils";
import type { AwardItem } from "./awards-data";
import { CLAIM_SELECT, type RewardClaim } from "./awardMeta";
import {
  EMPTY_CLAIM, UF_LIST, claimErrorMessage, lookupCep, maskCep, maskDocument, maskPhone, normalizeClaim, validateClaim,
  type ClaimErrors, type ClaimForm,
} from "./claimForm";

interface ClaimDialogProps {
  award: AwardItem | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (claim: RewardClaim) => void;
  /** O banco já tinha um resgate desta peça: o pai recarrega a lista. */
  onConflict: () => void;
}

type CepState = "idle" | "loading" | "found" | "notfound" | "error";
const AUTO = ["shipping_street", "shipping_neighborhood", "shipping_city", "shipping_state"] as const;

/** Resgate em dois passos: endereço e revisão. Depois de enviado só o suporte altera, então a revisão é de verdade. */
export function ClaimDialog({ award, onOpenChange, onCreated, onConflict }: ClaimDialogProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const open = !!award;
  const shown = useRef<AwardItem | null>(null);
  if (award) shown.current = award;
  const a = award ?? shown.current;

  const [form, setForm] = useState<ClaimForm>(EMPTY_CLAIM);
  const [step, setStep] = useState<"form" | "review">("form");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cep, setCep] = useState<CepState>("idle");
  const busyRef = useRef(false);
  const lastCep = useRef("");
  const autoFilled = useRef<Set<string>>(new Set());

  // Cada abertura começa do zero, com o que o cadastro já tem.
  useEffect(() => {
    if (!open) return;
    const p = profile;
    setForm({
      ...EMPTY_CLAIM,
      recipient_name: p?.full_name?.trim() ?? "",
      phone: p?.phone ? maskPhone(p.phone) : "",
      shipping_zip: p?.zip_code ? maskCep(p.zip_code) : "",
      shipping_street: p?.street ?? "",
      shipping_number: p?.street_number ?? "",
      shipping_complement: p?.complement ?? "",
      shipping_neighborhood: p?.neighborhood ?? "",
      shipping_city: p?.city ?? "",
      shipping_state: (p?.state ?? "").toUpperCase(),
    });
    setStep("form"); setTouched(false); setError(null); setCep("idle"); setBusy(false);
    busyRef.current = false; autoFilled.current = new Set();
    lastCep.current = p?.zip_code ? maskCep(p.zip_code).replace(/\D/g, "") : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, award?.id]);

  const set = (key: keyof ClaimForm, value: string) => {
    autoFilled.current.delete(key);
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  // CEP completo: busca o endereço e preenche só o que está vazio ou foi preenchido pela própria busca.
  useEffect(() => {
    const digits = form.shipping_zip.replace(/\D/g, "");
    if (!open || digits.length !== 8 || digits === lastCep.current) { if (digits.length !== 8 && cep !== "idle") setCep("idle"); return; }
    lastCep.current = digits;
    const ctl = new AbortController();
    let stale = false;
    const timer = setTimeout(() => ctl.abort(), 6000);
    setCep("loading");
    lookupCep(digits, ctl.signal)
      .then((r) => {
        if (stale) return;
        if (!r) { setCep("notfound"); return; }
        setForm((f) => {
          const next = { ...f };
          const map: Record<(typeof AUTO)[number], string> = { shipping_street: r.street, shipping_neighborhood: r.neighborhood, shipping_city: r.city, shipping_state: r.state };
          for (const k of AUTO) {
            if (map[k] && (!f[k].trim() || autoFilled.current.has(k))) { next[k] = map[k]; autoFilled.current.add(k); }
          }
          return next;
        });
        setCep("found");
      })
      .catch(() => { if (!stale) setCep("error"); })
      .finally(() => clearTimeout(timer));
    return () => { stale = true; clearTimeout(timer); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.shipping_zip, open]);

  const errors: ClaimErrors = validateClaim(form);
  const err = (k: keyof ClaimForm) => (touched ? errors[k] : undefined);

  const review = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) {
      const first = (Object.keys(errors) as (keyof ClaimForm)[])[0];
      requestAnimationFrame(() => document.getElementById(`claim-${first}`)?.focus());
      return;
    }
    setStep("review");
  };

  const submit = async () => {
    if (!a || !user?.id || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    const { data, error: e } = await supabase
      .from("reward_claims")
      .insert({ user_id: user.id, tier_id: a.id, tier_label: a.title, tier_value: a.value, ...normalizeClaim(form) })
      .select(CLAIM_SELECT)
      .maybeSingle();
    busyRef.current = false; setBusy(false);
    if (e || !data) {
      const msg = claimErrorMessage(e);
      setError(msg);
      if (e?.message?.includes("reward_already_claimed")) onConflict();
      return;
    }
    onCreated(data as RewardClaim);
    onOpenChange(false);
    toast.success("Resgate registrado. Você acompanha o andamento em Seus resgates.");
  };

  const field = (k: keyof ClaimForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> & { hint?: string; mask?: (v: string) => string } = {}) => {
    const { hint, mask, className, ...rest } = props;
    const msg = err(k);
    return (
      <div className={className}>
        <FieldLabel htmlFor={`claim-${k}`}>{label}</FieldLabel>
        <input
          id={`claim-${k}`}
          className="vp-field"
          value={form[k]}
          onChange={(e) => set(k, mask ? mask(e.target.value) : e.target.value)}
          aria-invalid={!!msg}
          aria-describedby={`claim-${k}-hint`}
          {...rest}
        />
        <p id={`claim-${k}-hint`} role={msg ? "alert" : undefined} className={cn("mt-1.5 text-[12.5px] leading-snug", msg ? "font-medium text-destructive" : "text-muted-foreground")}>
          {msg ?? hint ?? " "}
        </p>
      </div>
    );
  };

  const n = normalizeClaim(form);
  const cepHint = cep === "loading" ? "Buscando o endereço…" : cep === "found" ? "Endereço preenchido. Confira e complete o número." : cep === "notfound" ? "CEP não encontrado. Preencha o endereço à mão." : cep === "error" ? "Não deu para buscar o CEP agora. Preencha à mão." : "Digite o CEP para preencher o endereço.";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className={cn(dialogShell, "flex max-h-[min(92dvh,860px)] w-[calc(100vw-1rem)] max-w-[600px] flex-col")}>
        <DialogHead
          icon={<Gift className="h-5 w-5" />}
          title={a ? `Resgatar ${a.title}` : "Resgatar peça"}
          subtitle={step === "form" ? "Para onde enviamos a sua peça." : "Revise antes de confirmar."}
        />

        {step === "form" ? (
          <form onSubmit={(e) => { e.preventDefault(); review(); }} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6 sm:px-8">
              <FormSection title="Quem recebe" subtitle="O nome que vai na entrega.">
                <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
                  {field("recipient_name", "Nome completo", { className: "sm:col-span-2", autoComplete: "name", maxLength: 120, placeholder: "Nome e sobrenome" })}
                  {field("phone", "Telefone com DDD", { autoComplete: "tel-national", inputMode: "tel", mask: maskPhone, placeholder: "(44) 99999-0000", hint: "Para a transportadora falar com você." })}
                  {field("document", "CPF ou CNPJ (opcional)", { inputMode: "numeric", mask: maskDocument, placeholder: "000.000.000-00", hint: "Ajuda na emissão do envio." })}
                </div>
              </FormSection>

              <FormSection title="Endereço de entrega" subtitle="Digite o CEP e conferimos o resto.">
                <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 sm:grid-cols-[repeat(6,minmax(0,1fr))]">
                  {field("shipping_zip", "CEP", { className: "sm:col-span-2", autoComplete: "postal-code", inputMode: "numeric", mask: maskCep, placeholder: "00000-000", hint: cepHint })}
                  {field("shipping_street", "Rua ou avenida", { className: "sm:col-span-4", autoComplete: "address-line1", maxLength: 160 })}
                  {field("shipping_number", "Número", { className: "sm:col-span-2", maxLength: 20, placeholder: "ou s/n", autoComplete: "off" })}
                  {field("shipping_complement", "Complemento", { className: "sm:col-span-4", maxLength: 80, placeholder: "Apto, bloco, sala (opcional)", autoComplete: "address-line2" })}
                  {field("shipping_neighborhood", "Bairro", { className: "sm:col-span-3", maxLength: 80 })}
                  {field("shipping_city", "Cidade", { className: "sm:col-span-2", maxLength: 80, autoComplete: "address-level2" })}
                  <div className="sm:col-span-1">
                    <FieldLabel htmlFor="claim-shipping_state">UF</FieldLabel>
                    <Select value={form.shipping_state} onValueChange={(v) => set("shipping_state", v)}>
                      <SelectTrigger id="claim-shipping_state" className="vp-r16 h-12" aria-invalid={!!err("shipping_state")} aria-describedby="claim-shipping_state-hint"><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent collisionPadding={16} className="max-h-72">
                        {UF_LIST.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p id="claim-shipping_state-hint" role={err("shipping_state") ? "alert" : undefined} className="mt-1.5 text-[12.5px] font-medium leading-snug text-destructive">{err("shipping_state") ?? " "}</p>
                  </div>
                </div>
                <FieldHint>Enviamos para endereços no Brasil.</FieldHint>
              </FormSection>
            </div>
            {error && <p role="alert" className="border-t border-border bg-destructive/10 px-6 py-3 text-[13.5px] font-medium text-destructive sm:px-8">{error}</p>}
            <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
              <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)}>Cancelar</button>
              <button type="submit" className="vp-cta !h-12 justify-center">Revisar pedido</button>
            </div>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
              <div className="flex items-center gap-4 rounded-[16px] bg-accent px-4 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Gift className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-accent-foreground">{a?.title}</p>
                  <p className="text-[13px] text-accent-foreground/80">{a?.rewards.length ? a.rewards.join(", ") : a?.tier}</p>
                </div>
              </div>
              <dl className="divide-y divide-border rounded-[16px] border border-border">
                {[
                  ["Quem recebe", n.recipient_name],
                  ["Telefone", n.phone],
                  ["CPF ou CNPJ", n.document ?? "Não informado"],
                  ["Endereço", `${n.shipping_street}, ${n.shipping_number}${n.shipping_complement ? `, ${n.shipping_complement}` : ""}`],
                  ["Bairro", n.shipping_neighborhood],
                  ["Cidade", `${n.shipping_city}/${n.shipping_state}`],
                  ["CEP", n.shipping_zip],
                ].map(([k, v]) => (
                  <div key={k} className="grid gap-0.5 px-4 py-3 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-[13.5px] text-muted-foreground">{k}</dt>
                    <dd className="break-words text-[14.5px] font-semibold text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
              <Notice icon={<MapPin className="h-4 w-4" />} tone="warn" title="Depois de enviar, só o suporte altera">
                Confira o endereço com calma. Se algo estiver errado depois, fale com o suporte antes do envio.
              </Notice>
            </div>
            {error && <p role="alert" className="border-t border-border bg-destructive/10 px-6 py-3 text-[13.5px] font-medium text-destructive sm:px-8">{error}</p>}
            <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
              <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => setStep("form")} disabled={busy}>Voltar e editar</button>
              <button type="button" className="vp-cta !h-12 justify-center" onClick={() => { void submit(); }} disabled={busy}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Registrando…</> : <><Check className="h-4 w-4" />Confirmar resgate</>}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
