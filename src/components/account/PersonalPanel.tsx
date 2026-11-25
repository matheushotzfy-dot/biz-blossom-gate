import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { formatPhone, onlyDigits, profileSaveError, validateFullName, validateNickname, validatePhone } from "./accountMeta";
import { Field, LockedInput, PanelHead } from "./parts";

/**
 * Nome, e-mail e telefone vêm do cadastro: o banco só deixa preencher o que está vazio e nunca troca o e-mail.
 * O apelido é o único campo que sempre pode mudar.
 */
export function PersonalPanel() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nick, setNick] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const nameLocked = !!profile?.full_name?.trim();
  const phoneLocked = !!profile?.phone?.trim();

  // Só inicia uma vez por perfil carregado: digitar não pode ser sobrescrito por uma atualização em segundo plano.
  const [seeded, setSeeded] = useState<string | null>(null);
  useEffect(() => {
    if (!profile || seeded === profile.user_id) return;
    setName(profile.full_name ?? ""); setPhone(formatPhone(profile.phone ?? "")); setNick(profile.nickname ?? "");
    setSeeded(profile.user_id);
  }, [profile, seeded]);

  const errors = useMemo(() => ({
    name: nameLocked ? null : validateFullName(name),
    phone: phoneLocked ? null : validatePhone(phone),
    nick: validateNickname(nick),
  }), [name, phone, nick, nameLocked, phoneLocked]);

  const changes = useMemo(() => {
    const out: TablesUpdate<"profiles"> = {};
    if (!nameLocked && name.trim()) out.full_name = name.trim().replace(/\s+/g, " ");
    if (!phoneLocked && onlyDigits(phone)) out.phone = onlyDigits(phone);
    if (nick.trim() !== (profile?.nickname ?? "")) out.nickname = nick.trim();
    return out;
  }, [name, phone, nick, nameLocked, phoneLocked, profile?.nickname]);
  const dirty = Object.keys(changes).length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id || busy || !dirty) return;
    setTouched(true);
    const bad = (changes.full_name !== undefined && errors.name) || (changes.phone !== undefined && errors.phone) || (changes.nickname !== undefined && errors.nick);
    if (bad) {
      const first = changes.full_name !== undefined && errors.name ? "account-name" : changes.phone !== undefined && errors.phone ? "account-phone" : "account-nick";
      requestAnimationFrame(() => document.getElementById(first)?.focus());
      return;
    }
    setBusy(true); setProblem(null);
    const { error } = await supabase.from("profiles").update(changes).eq("user_id", user.id);
    setBusy(false);
    if (error) { setProblem(profileSaveError(error)); return; }
    updateProfile(changes);
    setTouched(false);
    toast.success("Dados salvos");
  };

  const show = (k: "name" | "phone" | "nick", included: boolean) => (touched && included ? errors[k] ?? undefined : undefined);
  const allLocked = nameLocked && phoneLocked;

  return (
    <section className="vp-sheet p-5 sm:p-7" aria-labelledby="account-personal">
      <PanelHead id="account-personal" title="Dados pessoais" subtitle={allLocked ? "Nome, e-mail e telefone vêm do seu cadastro e ficam travados por segurança. Só o apelido muda." : "Preencha o que falta. Depois de salvo, nome e telefone só mudam com o suporte."} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="account-name" label="Nome completo" locked={nameLocked} error={show("name", changes.full_name !== undefined)}>
          {(a) => nameLocked
            ? <LockedInput {...a} value={profile?.full_name ?? ""} />
            : <input {...a} className="vp-field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Como está no seu documento" />}
        </Field>
        <Field id="account-email" label="E-mail" locked hint="É o e-mail do seu login. Para trocar, fale com o suporte.">
          {(a) => <LockedInput {...a} value={profile?.email || user?.email || ""} />}
        </Field>
        <Field id="account-phone" label="Telefone" locked={phoneLocked} error={show("phone", changes.phone !== undefined)} hint={phoneLocked ? undefined : "Com DDD. Não dá para repetir um telefone de outra conta."}>
          {(a) => phoneLocked
            ? <LockedInput {...a} value={formatPhone(profile?.phone ?? "")} />
            : <input {...a} className="vp-field" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(44) 99999-0000" />}
        </Field>
        <Field id="account-nick" label="Apelido" error={show("nick", changes.nickname !== undefined)} hint="Como a plataforma chama você. Pode mudar quando quiser.">
          {(a) => <input {...a} className="vp-field" autoComplete="nickname" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={30} placeholder="Ex.: Lu" />}
        </Field>

        {problem && <p role="alert" className="rounded-[16px] bg-destructive/10 px-4 py-3 text-[14px] font-medium text-destructive">{problem}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="submit" disabled={busy || !dirty} className="vp-cta h-12 px-6">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy ? "Salvando" : "Salvar alterações"}
          </button>
          {!dirty && !busy && <span className="text-[13.5px] text-muted-foreground">Nada mudou ainda.</span>}
          {allLocked && <Link to="/suporte" className="text-[13.5px] font-semibold text-primary underline-offset-2 hover:underline">Pedir mudança ao suporte</Link>}
        </div>
      </form>
    </section>
  );
}
