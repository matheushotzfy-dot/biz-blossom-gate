import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Moon, ShieldAlert, Sun } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { useTheme } from "@/hooks/useTheme";
import { describeLoginFailure, validateLoginFields, type LoginFieldErrors } from "@/lib/adminLoginErrors";

interface FormProblem { message: string; locked: boolean }

/**
 * Entrada do painel da equipe (gerentes e funcionários), pela função `manager-login`. Ela responde 4xx/5xx com
 * `{ success:false, error, locked? }`; o corpo vem em `error.context` e é lido por `describeLoginFailure` (antes
 * qualquer falha, inclusive o bloqueio de 15 minutos, virava "credenciais inválidas").
 */
export default function ManagerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const clean = email.trim().toLowerCase();
    const invalid = validateLoginFields(clean, password);
    setFieldErrors(invalid);
    setProblem(null);
    if (invalid.email) { emailRef.current?.focus(); return; }
    if (invalid.password) { passwordRef.current?.focus(); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manager-login", { body: { email: clean, password } });
      if (error) {
        const failure = await describeLoginFailure(error);
        setProblem({ message: failure.message, locked: failure.locked });
        if (!failure.locked) passwordRef.current?.select();
        return;
      }
      if (!data?.success || !data.access_token) {
        setProblem({ message: typeof data?.error === "string" ? data.error : "Não foi possível entrar.", locked: data?.locked === true });
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (sessionError) { setProblem({ message: "A senha está certa, mas não foi possível abrir a sessão. Tente de novo.", locked: false }); return; }
      setPassword("");
      toast.success("Bem-vindo ao painel da equipe.");
      navigate("/gerentes/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState("CapsLock"));
  const Icon = problem?.locked ? ShieldAlert : AlertCircle;

  return (
    <div className="admin-frame flex min-h-[100dvh] flex-col">
      <Helmet>
        <title>Equipe · Vemprapay</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <header className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <div className="flex items-center gap-3">
          <VenxpayLogo size={30} withWordmark className="text-[17px]" />
          <span aria-hidden className="h-5 w-px af-border border-l" />
          <span className="text-[13.5px] font-semibold af-muted">Equipe</span>
        </div>
        <button type="button" onClick={toggleTheme} aria-label={dark ? "Usar tema claro" : "Usar tema escuro"} title={dark ? "Tema claro" : "Tema escuro"}
          className="inline-flex h-9 w-9 items-center justify-center border af-border af-surface af-text-2 transition-opacity hover:opacity-80">
          {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
        </button>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-[clamp(24px,12vh,128px)]">
        <div className="w-full max-w-[420px]">
          <div className="mb-6">
            <h1 className="text-[28px] font-extrabold leading-[1.15] af-text">Painel da equipe</h1>
            <p className="mt-2 text-[14px] leading-relaxed af-muted">Para gerentes e funcionários. Use o e-mail e a senha que o dono criou para você.</p>
          </div>
          <div className="rounded-[12px] border af-border af-surface p-6 sm:p-7">
            <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4" aria-busy={loading}>
              {problem && (
                <div role="alert" className="flex items-start gap-2.5 rounded-md px-3 py-2.5 text-[13px] leading-snug"
                  style={{ background: "var(--as-danger-bg)", border: "1px solid color-mix(in srgb, var(--as-danger) 35%, transparent)", color: "var(--as-danger)" }}>
                  <Icon className="mt-px h-4 w-4 shrink-0" aria-hidden /><span>{problem.message}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="staff-email" className="text-[13px] font-semibold af-text-2">E-mail</Label>
                <input ref={emailRef} id="staff-email" name="email" type="email" value={email} readOnly={loading} autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false}
                  onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined })); }}
                  placeholder="voce@empresa.com" aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? "staff-email-error" : undefined}
                  className="af-input h-11 w-full rounded-md px-3 text-[14px] focus:outline-none" />
                {fieldErrors.email && <p id="staff-email-error" className="text-[12.5px] font-medium" style={{ color: "var(--as-danger)" }}>{fieldErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-password" className="text-[13px] font-semibold af-text-2">Senha</Label>
                <div className="relative">
                  <input ref={passwordRef} id="staff-password" name="password" type={show ? "text" : "password"} value={password} readOnly={loading} autoComplete="current-password"
                    onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined })); }}
                    onKeyDown={checkCaps} onKeyUp={checkCaps} onBlur={() => setCaps(false)} placeholder="Sua senha"
                    aria-invalid={!!fieldErrors.password} aria-describedby={[fieldErrors.password ? "staff-password-error" : "", caps ? "staff-caps" : ""].filter(Boolean).join(" ") || undefined}
                    className="af-input h-11 w-full rounded-md px-3 pr-11 text-[14px] focus:outline-none" />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show}
                    className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center af-muted transition-colors hover:af-text">
                    {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  </button>
                </div>
                {fieldErrors.password && <p id="staff-password-error" className="text-[12.5px] font-medium" style={{ color: "var(--as-danger)" }}>{fieldErrors.password}</p>}
                {caps && <p id="staff-caps" className="text-[12.5px] font-medium" style={{ color: "var(--as-warning)" }}>Caps Lock está ligado.</p>}
              </div>
              <Button type="submit" disabled={loading} className="af-accent-bg mt-1 h-11 w-full rounded-md text-[14px] font-semibold shadow-none">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Lock className="mr-2 h-4 w-4" aria-hidden />}
                {loading ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          </div>
          <p className="mt-5 text-center text-[12.5px] leading-relaxed af-muted">
            As tentativas de entrada ficam registradas e 5 senhas erradas em 15 minutos pausam o acesso. Esqueceu a senha? Peça ao dono para criar uma nova.
          </p>
        </div>
      </main>
    </div>
  );
}
