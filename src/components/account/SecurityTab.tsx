import { useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Notice } from "@/components/seller-ui/studio";
import { formatDayTime, passwordChangeError, passwordChecks, passwordProblem } from "./accountMeta";
import { Field, PanelHead } from "./parts";

const RULES: { key: keyof ReturnType<typeof passwordChecks>; label: string }[] = [
  { key: "length", label: "8 caracteres ou mais" },
  { key: "upper", label: "Uma letra maiúscula" },
  { key: "lower", label: "Uma letra minúscula" },
  { key: "digit", label: "Um número" },
];

function PasswordInput({ show, onToggle, ...rest }: { show: boolean; onToggle: () => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <div className="relative">
      <input {...rest} type={show ? "text" : "password"} className="vp-field" style={{ paddingRight: 52 }} maxLength={72} />
      <button type="button" onClick={onToggle} aria-label={show ? "Esconder a senha" : "Mostrar a senha"} aria-pressed={show} className="vp-ghost absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 !border-0 !bg-transparent !p-0 text-muted-foreground">
        {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

/** Aba Segurança: trocar a senha e desconectar outros aparelhos. Tudo passa pelo login do próprio usuário. */
export function SecurityTab() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [shown, setShown] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [others, setOthers] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const checks = passwordChecks(next);
  const issue = passwordProblem(current, next, again);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setTouched(true);
    if (issue) { setProblem(null); return; }
    const email = user?.email;
    if (!email) { setProblem("Sua sessão expirou. Entre de novo para trocar a senha."); return; }
    setBusy(true); setProblem(null);
    try {
      // Confere a senha atual antes de trocar: quem pegou o computador aberto não consegue trocar a senha.
      const login = await supabase.auth.signInWithPassword({ email, password: current });
      if (login.error) throw login.error;
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      try { await supabase.auth.signOut({ scope: "others" }); } catch { /* a senha já mudou; os outros aparelhos expiram sozinhos */ }
      setCurrent(""); setNext(""); setAgain(""); setTouched(false); setShown(false);
      toast.success("Senha alterada. Os outros aparelhos foram desconectados.");
    } catch (err) {
      setProblem(passwordChangeError(err));
    } finally {
      setBusy(false);
    }
  };

  const leaveOthers = async () => {
    if (leaving) return;
    setLeaving(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setLeaving(false); setOthers(false);
    if (error) toast.error("Não foi possível desconectar agora. Tente de novo.");
    else toast.success("Os outros aparelhos foram desconectados");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="vp-sheet p-5 sm:p-7" aria-labelledby="account-password">
        <PanelHead id="account-password" title="Trocar a senha" subtitle="Pedimos a senha atual antes de trocar. Ao terminar, os outros aparelhos saem da sua conta." />
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field id="account-current-password" label="Senha atual">
            {(a) => <PasswordInput {...a} show={shown} onToggle={() => setShown((s) => !s)} autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setProblem(null); }} />}
          </Field>
          <Field id="account-new-password" label="Nova senha">
            {(a) => <PasswordInput {...a} show={shown} onToggle={() => setShown((s) => !s)} autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setProblem(null); }} />}
          </Field>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5" aria-label="Regras da nova senha">
            {RULES.map((r) => (
              <li key={r.key} className={cn("flex items-center gap-2 text-[13.5px]", checks[r.key] ? "font-semibold text-foreground" : "text-muted-foreground")}>
                <span className={cn("grid shrink-0 place-items-center rounded-full", checks[r.key] ? "bg-primary text-primary-foreground" : "bg-muted")} style={{ width: 18, height: 18 }} aria-hidden>{checks[r.key] && <Check className="h-3 w-3" strokeWidth={3.5} />}</span>
                {r.label}<span className="sr-only">{checks[r.key] ? ", ok" : ", falta"}</span>
              </li>
            ))}
          </ul>
          <Field id="account-repeat-password" label="Repita a nova senha">
            {(a) => <PasswordInput {...a} show={shown} onToggle={() => setShown((s) => !s)} autoComplete="new-password" value={again} onChange={(e) => { setAgain(e.target.value); setProblem(null); }} />}
          </Field>

          {(problem || (touched && issue)) && <p role="alert" className="rounded-[16px] bg-destructive/10 px-4 py-3 text-[14px] font-medium text-destructive">{problem ?? issue}</p>}

          <button type="submit" disabled={busy || !current || !next || !again} className="vp-cta h-12 px-6">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy ? "Trocando" : "Trocar senha"}
          </button>
        </form>
      </section>

      <section className="vp-sheet p-5 sm:p-7" aria-labelledby="account-access">
        <PanelHead id="account-access" title="Acesso à conta" subtitle="Veja quando você entrou e saia de aparelhos que não são seus." />
        <dl className="divide-y divide-border overflow-hidden rounded-[16px] border border-border">
          <div className="bg-card px-4 py-3.5"><dt className="text-[13px] text-muted-foreground">Você entrou como</dt><dd className="mt-0.5 break-all text-[15px] font-semibold text-foreground">{user?.email ?? "—"}</dd></div>
          <div className="bg-card px-4 py-3.5"><dt className="text-[13px] text-muted-foreground">Último acesso registrado</dt><dd className="mt-0.5 text-[15px] font-semibold text-foreground">{formatDayTime(profile?.last_login_at)}</dd></div>
        </dl>
        <Notice tone="info" className="mt-5" title="Perdeu o celular ou usou um computador público?">
          Desconecte os outros aparelhos. Este continua conectado, mas todos os outros precisam entrar de novo.
        </Notice>
        <button type="button" className="vp-ghost mt-4 h-11 px-5" onClick={() => setOthers(true)}><LogOut className="h-4 w-4" aria-hidden />Sair dos outros aparelhos</button>
      </section>

      <AlertDialog open={others} onOpenChange={(o) => !leaving && setOthers(o)}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Sair dos outros aparelhos?</AlertDialogTitle>
            <AlertDialogDescription>Todo aparelho conectado à sua conta, menos este, vai pedir o login de novo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving} className="vp-ghost m-0 h-11">Manter conectados</AlertDialogCancel>
            <AlertDialogAction disabled={leaving} onClick={(e) => { e.preventDefault(); void leaveOthers(); }} className="vp-cta h-11">{leaving ? "Saindo" : "Sair dos outros"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
