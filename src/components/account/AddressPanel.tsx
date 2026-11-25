import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceChip } from "@/components/seller-ui/form";
import { Notice } from "@/components/seller-ui/studio";
import { StatusPill } from "@/components/seller-ui/tx";
import { lookupCep } from "@/features/awards/claimForm";
import { cn } from "@/lib/utils";
import { EMPTY_ADDRESS, SEM_NUMERO, UFS, addressFrom, cepDigits, formatCep, hasAddress, normalizeAddress, profileSaveError, sameAddress, validateAddress, type AddressForm } from "./accountMeta";
import { Field, PanelHead } from "./parts";

type CepState = "idle" | "loading" | "found" | "notfound" | "error";
const AUTO = ["street", "neighborhood", "city", "state"] as const;
const ORDER: (keyof AddressForm)[] = ["zip_code", "street", "street_number", "city", "state"];
const FIELD_ID: Record<keyof AddressForm, string> = {
  zip_code: "account-cep", street: "account-street", street_number: "account-number", complement: "account-complement", neighborhood: "account-neighborhood", city: "account-city", state: "account-state",
};
const CEP_NOTE: Record<CepState, string | undefined> = {
  idle: "Digitando o CEP, preenchemos rua, bairro e cidade.",
  loading: "Buscando o endereço…",
  found: "Encontramos o endereço. Confira e informe o número.",
  notfound: "Não achamos esse CEP. Preencha o endereço na mão.",
  error: "Não deu para buscar o CEP agora. Preencha o endereço na mão.",
  };

export function AddressPanel({ spotlight, onSpotlightDone }: { spotlight: boolean; onSpotlightDone: () => void }) {
  const { user } = useAuth();
  const { profile, updateProfile, refresh } = useProfile();
  const root = useRef<HTMLElement>(null);
  const autoFilled = useRef<Set<string>>(new Set());
  const lastCep = useRef("");
  const flashTimer = useRef<number>();
  const [form, setForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [seeded, setSeeded] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [cep, setCep] = useState<CepState>("idle");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const locked = !!profile?.address_locked;
  const saved = addressFrom(profile);
  const complete = hasAddress(profile);
  const dirty = !sameAddress(form, saved);
  const errors = validateAddress(form);

  useEffect(() => {
    if (!profile || seeded === profile.user_id) return;
    const a = addressFrom(profile);
    lastCep.current = cepDigits(a.zip_code);
    setForm(a); setSeeded(profile.user_id);
  }, [profile, seeded]);

  // Chegou por "Preencher endereço" (saques): leva até aqui, destaca e já põe o cursor no primeiro campo.
  useEffect(() => {
    if (!spotlight || !profile) return;
    const t = window.setTimeout(() => {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      root.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      if (!locked) {
        setFlash(true);
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(false), 4500);
        if (!complete) window.setTimeout(() => document.getElementById(FIELD_ID.zip_code)?.focus({ preventScroll: true }), 450);
      }
      onSpotlightDone();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotlight, !!profile]);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  // CEP completo: busca o endereço e preenche só o que está vazio ou veio de uma busca anterior.
  useEffect(() => {
    if (locked) return;
    const d = cepDigits(form.zip_code);
    if (d.length !== 8 || d === lastCep.current) { if (d.length !== 8 && cep !== "idle") setCep("idle"); return; }
    lastCep.current = d;
    const ctl = new AbortController();
    let stale = false;
    const timer = window.setTimeout(() => ctl.abort(), 6000);
    setCep("loading");
    lookupCep(d, ctl.signal)
      .then((r) => {
        if (stale) return;
        if (!r) { setCep("notfound"); return; }
        setForm((f) => {
          const next = { ...f };
          for (const k of AUTO) if (r[k] && (!f[k].trim() || autoFilled.current.has(k))) { next[k] = r[k]; autoFilled.current.add(k); }
          return next;
        });
        setCep("found");
        window.setTimeout(() => document.getElementById(FIELD_ID.street_number)?.focus({ preventScroll: true }), 60);
      })
      .catch(() => { if (!stale) setCep("error"); })
      .finally(() => window.clearTimeout(timer));
    return () => { stale = true; window.clearTimeout(timer); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.zip_code, locked]);

  const set = (key: keyof AddressForm, value: string) => {
    autoFilled.current.delete(key);
    setForm((f) => ({ ...f, [key]: value }));
    setProblem(null);
  };
  const err = (k: keyof AddressForm) => (touched ? errors[k] : undefined);
  const semNumero = form.street_number === SEM_NUMERO;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id || busy || locked) return;
    setTouched(true);
    const first = ORDER.find((k) => errors[k]);
    if (first) { requestAnimationFrame(() => document.getElementById(FIELD_ID[first])?.focus()); return; }
    setBusy(true); setProblem(null);
    const next = normalizeAddress(form);
    // Sem `address_locked` de propósito: o banco só deixa o time travar o endereço.
    const { error } = await supabase.from("profiles").update(next).eq("user_id", user.id);
    setBusy(false);
    if (error) {
      setProblem(profileSaveError(error, "Não foi possível salvar o endereço agora."));
      if (error.hint === "address_locked") void refresh();
      return;
    }
    updateProfile(next);
    setForm(next); setTouched(false);
    toast.success(complete ? "Endereço atualizado" : "Endereço salvo. Os saques já podem ser pedidos.");
  };

  const cepNote = cep === "idle" ? (err("zip_code") ? undefined : CEP_NOTE.idle) : CEP_NOTE[cep];

  return (
    <section ref={root} className={cn("vp-sheet p-5 transition-shadow sm:p-7", flash && "va-flash")} aria-labelledby="account-address">
      <PanelHead
        id="account-address"
        title="Endereço"
        subtitle="Necessário para pedir saques. Também já vem preenchido nos seus pedidos de prêmios."
        aside={locked ? <StatusPill tone="ok" label="Confirmado" /> : complete ? <StatusPill tone="ok" label="Preenchido" /> : <StatusPill tone="wait" label="Falta preencher" />}
      />

      {locked ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-[16px] bg-border sm:grid-cols-2">
            {([["CEP", saved.zip_code], ["Rua", saved.street], ["Número", saved.street_number], ["Complemento", saved.complement || "—"], ["Bairro", saved.neighborhood || "—"], ["Cidade e estado", `${saved.city} / ${saved.state}`]] as const).map(([k, v]) => (
              <div key={k} className="bg-card px-4 py-3.5"><dt className="text-[13px] text-muted-foreground">{k}</dt><dd className="mt-0.5 break-words text-[15px] font-semibold text-foreground">{v}</dd></div>
            ))}
          </dl>
          <Notice tone="info" icon={<Lock className="h-[18px] w-[18px]" />} title="Endereço confirmado">
            Ele está travado para proteger a sua conta. Para alterar, <Link to="/suporte" className="font-semibold text-primary underline-offset-2 hover:underline">fale com o suporte</Link>.
          </Notice>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {!complete && (
            <Notice tone="warn" icon={<AlertTriangle className="h-[18px] w-[18px]" />} title="Falta o seu endereço">
              Sem ele não dá para pedir saques. Leva menos de um minuto.
            </Notice>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <Field id={FIELD_ID.zip_code} label="CEP" error={err("zip_code")} hint={cepNote}>
                {(a) => (
                  <div className="relative">
                    <input {...a} className="vp-field tabular-nums" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={form.zip_code} onChange={(e) => set("zip_code", formatCep(e.target.value))} />
                    {cep === "loading" && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" aria-hidden />}
                  </div>
                )}
              </Field>
              <span className="sr-only" aria-live="polite">{cep === "loading" ? "Buscando o endereço" : cep === "found" ? "Endereço encontrado" : ""}</span>
            </div>
            <div className="sm:col-span-8">
              <Field id={FIELD_ID.street} label="Rua ou avenida" error={err("street")}>
                {(a) => <input {...a} className="vp-field" autoComplete="address-line1" value={form.street} onChange={(e) => set("street", e.target.value)} maxLength={120} placeholder="Avenida Brasil" />}
              </Field>
            </div>

            <div className="sm:col-span-4">
              <Field id={FIELD_ID.street_number} label="Número" error={err("street_number")}>
                {(a) => (
                  <div className="space-y-2">
                    <input {...a} className="vp-field tabular-nums" readOnly={semNumero} value={semNumero ? "Sem número" : form.street_number} onChange={(e) => set("street_number", e.target.value)} maxLength={10} placeholder="100" />
                    <ChoiceChip active={semNumero} onClick={() => set("street_number", semNumero ? "" : SEM_NUMERO)} className="!h-9 text-[13px]">Sem número</ChoiceChip>
                  </div>
                )}
              </Field>
            </div>
            <div className="sm:col-span-8">
              <Field id={FIELD_ID.complement} label="Complemento" optional error={err("complement")}>
                {(a) => <input {...a} className="vp-field" autoComplete="address-line2" value={form.complement} onChange={(e) => set("complement", e.target.value)} maxLength={60} placeholder="Apto 42, sala 3" />}
              </Field>
            </div>

            <div className="sm:col-span-5">
              <Field id={FIELD_ID.neighborhood} label="Bairro" optional>
                {(a) => <input {...a} className="vp-field" value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} maxLength={80} placeholder="Zona 01" />}
              </Field>
            </div>
            <div className="sm:col-span-5">
              <Field id={FIELD_ID.city} label="Cidade" error={err("city")}>
                {(a) => <input {...a} className="vp-field" autoComplete="address-level2" value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} placeholder="Maringá" />}
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id={FIELD_ID.state} label="Estado" error={err("state")}>
                {(a) => (
                  <Select value={form.state} onValueChange={(v) => set("state", v)}>
                    <SelectTrigger id={a.id} aria-invalid={a["aria-invalid"]} aria-describedby={a["aria-describedby"]} className="vp-r16 h-12"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent collisionPadding={16} className="max-h-72">{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </Field>
            </div>
          </div>

          {problem && <p role="alert" className="rounded-[16px] bg-destructive/10 px-4 py-3 text-[14px] font-medium text-destructive">{problem}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || !dirty} className="vp-cta h-12 px-6">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy ? "Salvando" : "Salvar endereço"}
            </button>
            {!dirty && !busy && complete && <span className="text-[13.5px] text-muted-foreground">Seu endereço está salvo.</span>}
          </div>
        </form>
      )}
    </section>
  );
}
