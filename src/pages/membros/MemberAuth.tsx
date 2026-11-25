/**
 * Entrada do aluno: entrar, criar conta (com o e-mail da compra) e recuperar a senha por código.
 * O login passa pela função `gated-login` (limite de tentativas por e-mail); a recuperação reaproveita
 * `password-reset-request` + código de 6 dígitos, o mesmo fluxo do painel.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { useMemberSkin } from "@/hooks/useMemberSkin";
import { friendlyError } from "@/lib/friendlyError";

type Mode = "login" | "register" | "recover-email" | "recover-code";

const HOME = "/membros-area";
const input =
  "h-12 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-[16px] text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60";
const label = "mb-1.5 block text-[14px] font-semibold text-foreground";
const primaryBtn =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15.5px] font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60";
const linkBtn = "font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded";

/** Mesma regra de senha do painel: 8+ caracteres com maiúscula, minúscula e número. */
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_HINT = "Use 8 ou mais caracteres, com letra maiúscula, minúscula e número.";
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function PasswordField({ id, value, onChange, autoComplete, disabled, describedBy, labelText = "Senha" }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; disabled?: boolean; describedBy?: string; labelText?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={label}>{labelText}</label>
      <div className="relative">
        <input
          id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete} disabled={disabled} aria-describedby={describedBy} className={`${input} pr-12`}
        />
        <button
          type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show}
          className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {show ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export default function MemberAuth() {
  useMemberSkin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("modo") === "criar" ? "register" : "login");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(true);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) navigate(HOME, { replace: true });
      else setChecking(false);
    });
    return () => { alive = false; };
  }, [navigate]);

  const go = (next: Mode) => {
    setMode(next); setError(""); setNotice(""); setPassword(""); setConfirm(""); setCode("");
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const fail = (msg: string) => { setError(msg); setBusy(false); };

  const login = async () => {
    const { data, error: err } = await supabase.functions.invoke("gated-login", {
      body: { email: email.toLowerCase().trim(), password, scope: "member" },
    });
    if (err || !data?.success) return fail(data?.error || "E-mail ou senha incorretos.");
    const { error: sessionErr } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (sessionErr) return fail(friendlyError(sessionErr));
    navigate(HOME, { replace: true });
  };

  const register = async () => {
    if (!PASSWORD_RE.test(password)) return fail(PASSWORD_HINT);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: `${window.location.origin}${HOME}`, data: { full_name: name.trim() } },
    });
    if (err) {
      if (/already|registered/i.test(err.message)) { setMode("login"); setPassword(""); return fail("Este e-mail já tem conta. Entre com sua senha."); }
      if (/password|weak|pwned/i.test(err.message)) return fail("Escolha uma senha mais forte. " + PASSWORD_HINT);
      return fail(friendlyError(err, "Não foi possível criar a conta. Tente de novo."));
    }
    // E-mail já cadastrado: o Supabase devolve um usuário sem identidades em vez de erro.
    if (data.user && (data.user.identities?.length ?? 1) === 0) { setMode("login"); setPassword(""); return fail("Este e-mail já tem conta. Entre com sua senha."); }
    if (data.session) { navigate(HOME, { replace: true }); return; }
    setMode("login"); setPassword(""); setBusy(false);
    setNotice("Conta criada. Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, é só entrar.");
  };

  const requestCode = async () => {
    // Resposta sempre genérica: não revela se o e-mail tem conta.
    await supabase.functions.invoke("password-reset-request", { body: { email: email.trim(), redirectTo: `${window.location.origin}${HOME}/login` } }).catch(() => undefined);
    setMode("recover-code"); setBusy(false);
    setNotice("Se este e-mail tiver conta, enviamos um código de 6 dígitos. Ele vale por pouco tempo.");
  };

  const resetPassword = async () => {
    if (!PASSWORD_RE.test(password)) return fail(PASSWORD_HINT);
    if (password !== confirm) return fail("As senhas não são iguais.");
    const { error: vErr } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "recovery" });
    if (vErr) return fail(/expired/i.test(vErr.message) ? "O código expirou. Peça um novo." : "Código incorreto. Confira o e-mail e tente de novo.");
    const { error: uErr } = await supabase.auth.updateUser({ password });
    if (uErr) return fail(/different|same/i.test(uErr.message) ? "Escolha uma senha diferente da anterior." : friendlyError(uErr));
    await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
    navigate(HOME, { replace: true });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(""); setNotice("");
    if (!isEmail(email.trim())) return fail("Informe um e-mail válido.");
    if (mode === "register" && name.trim().length < 2) return fail("Informe seu nome.");
    if (mode === "login" && !password) return fail("Informe sua senha.");
    if (mode === "recover-code" && !/^\d{6,8}$/.test(code.trim())) return fail("Digite o código que chegou no seu e-mail.");
    setBusy(true);
    try {
      if (mode === "login") await login();
      else if (mode === "register") await register();
      else if (mode === "recover-email") await requestCode();
      else await resetPassword();
    } catch {
      fail("Sem conexão. Confira a internet e tente de novo.");
    }
  };

  if (checking) {
    return <div className="grid min-h-dvh place-items-center bg-background" role="status" aria-label="Carregando"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden /></div>;
  }

  const copy: Record<Mode, { title: string; sub: string; cta: string }> = {
    login: { title: "Entrar", sub: "Acesse seus cursos com o e-mail da compra.", cta: "Entrar" },
    register: { title: "Criar conta", sub: "Use o mesmo e-mail da compra para liberar seus cursos.", cta: "Criar conta" },
    "recover-email": { title: "Recuperar senha", sub: "Informe o e-mail da sua conta para receber um código.", cta: "Enviar código" },
    "recover-code": { title: "Nova senha", sub: "Digite o código do e-mail e escolha uma nova senha.", cta: "Salvar nova senha" },
  };
  const c = copy[mode];

  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      <Seo title="Área de membros — Entrar" description="Entre para assistir às aulas, baixar materiais e acompanhar seu progresso." path="/membros-area/login" noindex />
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-5 py-10">
        <div className="mb-8 flex items-center gap-2.5">
          <VenxpayLogo size={32} />
          <span className="text-[17px] font-extrabold tracking-[-0.02em]">Área de membros</span>
        </div>

        <h1 ref={headingRef} tabIndex={-1} className="text-[32px] font-extrabold leading-tight tracking-[-0.03em] outline-none">{c.title}</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-muted-foreground">{c.sub}</p>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4" aria-busy={busy}>
          {mode === "register" && (
            <div>
              <label htmlFor="ma-name" className={label}>Nome</label>
              <input id="ma-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={busy} className={input} />
            </div>
          )}

          <div>
            <label htmlFor="ma-email" className={label}>E-mail</label>
            <input
              id="ma-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" autoCapitalize="none" spellCheck={false} disabled={busy || mode === "recover-code"} className={input}
            />
          </div>

          {mode === "recover-code" && (
            <div>
              <label htmlFor="ma-code" className={label}>Código</label>
              <input id="ma-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} disabled={busy} className={`${input} tracking-[0.3em]`} />
            </div>
          )}

          {(mode === "login" || mode === "register" || mode === "recover-code") && (
            <PasswordField
              id="ma-pass" value={password} onChange={setPassword} disabled={busy}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              describedBy={mode === "login" ? undefined : "ma-pass-hint"}
              labelText={mode === "recover-code" ? "Nova senha" : "Senha"}
            />
          )}
          {mode !== "login" && mode !== "recover-email" && <p id="ma-pass-hint" className="-mt-2 text-[13.5px] text-muted-foreground">{PASSWORD_HINT}</p>}
          {mode === "recover-code" && <PasswordField id="ma-confirm" value={confirm} onChange={setConfirm} disabled={busy} autoComplete="new-password" labelText="Repita a nova senha" />}

          {mode === "login" && (
            <div className="text-right text-[14px]">
              <button type="button" onClick={() => go("recover-email")} className={linkBtn}>Esqueci minha senha</button>
            </div>
          )}

          <div aria-live="polite" className="empty:hidden">
            {error && <p role="alert" className="rounded-[14px] bg-destructive/15 px-4 py-3 text-[14.5px] font-medium text-destructive-foreground">{error}</p>}
            {!error && notice && <p className="rounded-[14px] bg-primary/15 px-4 py-3 text-[14.5px] font-medium text-foreground">{notice}</p>}
          </div>

          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy && <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" aria-hidden />}
            {c.cta}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-[14.5px] text-muted-foreground">
          {mode === "login" && <p>Primeiro acesso? <button type="button" onClick={() => go("register")} className={linkBtn}>Crie sua conta</button></p>}
          {mode === "register" && <p>Já tem conta? <button type="button" onClick={() => go("login")} className={linkBtn}>Entrar</button></p>}
          {(mode === "recover-email" || mode === "recover-code") && <p><button type="button" onClick={() => go("login")} className={linkBtn}>Voltar para entrar</button></p>}
          {mode === "recover-code" && <p><button type="button" onClick={() => go("recover-email")} className={linkBtn}>Pedir um novo código</button></p>}
        </div>

        <p className="mt-10 text-center text-[13px] text-muted-foreground/80">
          <Link to="/" className="hover:text-foreground">Voltar ao site</Link>
        </p>
      </div>
    </div>
  );
}
