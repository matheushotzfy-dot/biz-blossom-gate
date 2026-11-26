import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, Moon, ShieldAlert, Sun } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { useTheme } from "@/hooks/useTheme";
import {
  describeLoginFailure,
  validateLoginFields,
  type LoginFieldErrors,
} from "@/lib/adminLoginErrors";

type Step = "credentials" | "code";

interface FormProblem {
  message: string;
  locked: boolean;
}

function ProblemAlert({ problem }: { problem: FormProblem }) {
  const Icon = problem.locked ? ShieldAlert : AlertCircle;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md px-3 py-2.5 text-[13px] leading-snug"
      style={{
        background: "var(--as-danger-bg)",
        border: "1px solid color-mix(in srgb, var(--as-danger) 35%, transparent)",
        color: "var(--as-danger)",
      }}
    >
      <Icon className="mt-px h-4 w-4 shrink-0" aria-hidden />
      <span>{problem.message}</span>
    </div>
  );
}

function FieldMessage({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="text-[12.5px] font-medium" style={{ color: "var(--as-danger)" }}>
      {children}
    </p>
  );
}

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [step, setStep] = useState<Step>("credentials");
  const [tempToken, setTempToken] = useState("");
  const [code, setCode] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const finishLogin = async (accessToken: string, refreshToken: string, role?: string) => {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    if (role === "employee") {
      toast.success("Bem-vindo ao painel da equipe.");
      navigate("/gerentes/dashboard");
      return;
    }
    toast.success("Bem-vindo ao painel administrativo.");
    navigate("/admin-matheus/dashboard");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const cleanEmail = email.trim().toLowerCase();
    const invalid = validateLoginFields(cleanEmail, password);
    setFieldErrors(invalid);
    setProblem(null);
    if (invalid.email) { emailRef.current?.focus(); return; }
    if (invalid.password) { passwordRef.current?.focus(); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-login", {
        body: { email: cleanEmail, password },
      });
      if (error) {
        const failure = await describeLoginFailure(error);
        setProblem({ message: failure.message, locked: failure.locked });
        if (!failure.locked) passwordRef.current?.select();
        return;
      }
      if (!data?.success) {
        setProblem({ message: typeof data?.error === "string" ? data.error : "Não foi possível entrar.", locked: data?.locked === true });
        return;
      }
      if (data.requires2FA) {
        setTempToken(data.temp_token);
        setStep("code");
        setPassword("");
        toast.info("Enviamos um código para o seu e-mail.");
        return;
      }
      try {
        await finishLogin(data.access_token, data.refresh_token, data.role);
      } catch {
        setProblem({ message: "A senha está certa, mas não foi possível abrir a sessão. Tente de novo.", locked: false });
      }
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep("credentials");
    setTempToken("");
    setCode("");
    setProblem(null);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!/^\d{6}$/.test(code)) { setProblem({ message: "Digite os 6 dígitos do código.", locked: false }); return; }
    setLoading(true);
    setProblem(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-2fa-verify", {
        body: { temp_token: tempToken, code },
      });
      if (error || !data?.success) {
        const failure = error
          ? await describeLoginFailure(error, "Código incorreto.")
          : { message: typeof data?.error === "string" ? data.error : "Código incorreto.", locked: false, restart: false };
        if (failure.restart) { goBack(); }
        setProblem({ message: failure.message, locked: failure.locked });
        setCode("");
        return;
      }
      try {
        await finishLogin(data.access_token, data.refresh_token, data.role);
      } catch {
        setProblem({ message: "O código está certo, mas não foi possível abrir a sessão. Tente de novo.", locked: false });
      }
    } finally {
      setLoading(false);
    }
  };

  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState("CapsLock"));
  };

  const dark = theme === "dark";

  return (
    <div className="admin-frame flex min-h-[100dvh] flex-col">
      <Helmet>
        <title>Administração · Vemprapay</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <div className="flex items-center gap-3">
          <VenxpayLogo size={30} withWordmark className="text-[17px]" />
          <span aria-hidden className="h-5 w-px af-border border-l" />
          <span className="text-[13.5px] font-semibold af-muted">Administração</span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
          title={dark ? "Tema claro" : "Tema escuro"}
          className="inline-flex h-9 w-9 items-center justify-center border af-border af-surface af-text-2 transition-opacity hover:opacity-80"
        >
          {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
        </button>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-[clamp(24px,12vh,128px)]">
        <div className="w-full max-w-[420px]">
          <div className="mb-6">
            <h1 className="text-[28px] font-extrabold leading-[1.15] af-text">
              {step === "credentials" ? "Entrar no painel" : "Digite o código"}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed af-muted">
              {step === "credentials"
                ? "Acesso restrito à equipe. Use o e-mail e a senha da sua conta de administração."
                : <>Enviamos um código de 6 dígitos para <span className="font-semibold af-text-2">{email.trim().toLowerCase()}</span>. Ele vale por 10 minutos.</>}
            </p>
          </div>

          <div className="rounded-[12px] border af-border af-surface p-6 sm:p-7">
            {step === "credentials" ? (
              <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={loading}>
                {problem && <ProblemAlert problem={problem} />}

                <div className="space-y-1.5">
                  <Label htmlFor="admin-email" className="text-[13px] font-semibold af-text-2">E-mail</Label>
                  <input
                    ref={emailRef}
                    id="admin-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined })); }}
                    readOnly={loading}
                    autoFocus
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="voce@empresa.com"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "admin-email-error" : undefined}
                    className="af-input h-11 w-full rounded-md px-3 text-[14px] focus:outline-none"
                  />
                  <FieldMessage id="admin-email-error">{fieldErrors.email}</FieldMessage>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-password" className="text-[13px] font-semibold af-text-2">Senha</Label>
                  <div className="relative">
                    <input
                      ref={passwordRef}
                      id="admin-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined })); }}
                      onKeyDown={checkCaps}
                      onKeyUp={checkCaps}
                      onBlur={() => setCapsLock(false)}
                      readOnly={loading}
                      autoComplete="current-password"
                      placeholder="Sua senha"
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={[fieldErrors.password ? "admin-password-error" : "", capsLock ? "admin-caps" : ""].filter(Boolean).join(" ") || undefined}
                      className="af-input h-11 w-full rounded-md px-3 pr-11 text-[14px] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
                      className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center af-muted transition-colors hover:af-text"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                  <FieldMessage id="admin-password-error">{fieldErrors.password}</FieldMessage>
                  {capsLock && (
                    <p id="admin-caps" className="text-[12.5px] font-medium" style={{ color: "var(--as-warning)" }}>
                      Caps Lock está ligado.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="af-accent-bg mt-1 h-11 w-full rounded-md text-[14px] font-semibold shadow-none"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Lock className="mr-2 h-4 w-4" aria-hidden />}
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} noValidate className="space-y-4" aria-busy={loading}>
                {problem && <ProblemAlert problem={problem} />}

                <div className="space-y-1.5">
                  <Label htmlFor="admin-code" className="text-[13px] font-semibold af-text-2">Código de 6 dígitos</Label>
                  <input
                    id="admin-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    readOnly={loading}
                    autoFocus
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="af-input h-14 w-full rounded-md px-3 text-center font-mono text-[22px] focus:outline-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="af-accent-bg h-11 w-full rounded-md text-[14px] font-semibold shadow-none"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  {loading ? "Conferindo…" : "Confirmar"}
                </Button>

                <button
                  type="button"
                  onClick={goBack}
                  className="mx-auto flex items-center gap-1.5 text-[13px] af-muted transition-colors hover:af-text"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Voltar para o e-mail e a senha
                </button>
              </form>
            )}
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[12.5px] af-muted">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            As tentativas de entrada ficam registradas.
          </p>
        </div>
      </main>
    </div>
  );
}
