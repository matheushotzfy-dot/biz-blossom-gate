import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck, AlertCircle, Lock, Sun, Moon, KeyRound, Activity, Fingerprint, Radio } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";

type Step = "credentials" | "2fa";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [tempToken, setTempToken] = useState("");
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const finishLogin = async (access_token: string, refresh_token: string) => {
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError) throw sessionError;
    toast.success("Bem-vindo ao painel administrativo!");
    navigate("/admin-matheus/dashboard");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setError("E-mail inválido."); return; }
    if (password.length < 6) { setError("Senha deve ter no mínimo 6 caracteres."); return; }

    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("admin-login", {
        body: { email: trimmedEmail, password },
      });
      if (fnError) throw new Error("Erro de conexão.");
      if (!data?.success) {
        setError(data?.locked ? "Muitas tentativas. Aguarde 15 minutos." : data?.error || "Credenciais inválidas ou acesso não autorizado.");
        return;
      }
      if (data.requires2FA) {
        setTempToken(data.temp_token);
        setStep("2fa");
        setPassword("");
        toast.info("Código enviado para o seu e-mail.");
        return;
      }
      await finishLogin(data.access_token, data.refresh_token);
    } catch {
      setError("Credenciais inválidas ou acesso não autorizado.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError("Digite os 6 dígitos."); return; }
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("admin-2fa-verify", {
        body: { temp_token: tempToken, code },
      });
      if (fnError) throw new Error("Erro de conexão.");
      if (!data?.success) {
        setError(data?.error || "Código incorreto.");
        return;
      }
      await finishLogin(data.access_token, data.refresh_token);
    } catch {
      setError("Não foi possível verificar o código.");
    } finally {
      setLoading(false);
      setCode("");
    }
  };

  const resetToStep1 = () => {
    setStep("credentials");
    setTempToken("");
    setCode("");
    setError("");
  };

  return (
    <div className="admin-frame min-h-screen af-bg grid lg:grid-cols-[1.15fr_1fr] relative">
      {/* Theme toggle (top-right, always visible) */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-30 h-9 w-9 rounded-md af-surface af-border af-text-2 border inline-flex items-center justify-center hover:opacity-80 transition-opacity"
        title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* ── LEFT · Brand / editorial panel ── */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r af-border af-bg-soft px-14 py-12">
        {/* Subtle grid + gradient wash — no glow, no glass */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.35) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at top left, hsl(0 0% 0%) 25%, transparent 75%)",
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md af-accent-bg flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <span className="text-[15px] font-semibold af-text tracking-tight">VENXPAY</span>
            <span className="ml-1 text-[10px] font-black uppercase tracking-[0.22em] af-muted-2 border af-border rounded px-1.5 py-0.5">Admin</span>
          </div>
        </div>

        <div className="relative max-w-[440px]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] af-muted-2 mb-4">Command Center</p>
          <h2 className="font-display text-[38px] leading-[1.05] font-black tracking-tight af-text">
            Operação em<br />tempo real,<br />
            <span className="af-text-2">sob controle absoluto.</span>
          </h2>
          <p className="mt-5 text-[13.5px] leading-relaxed af-muted max-w-[380px]">
            Painel restrito para gestão de sellers, transações, adquirentes e disputas.
            Cada acesso é auditado. Cada ação é imutável.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              { icon: Activity, label: "Métricas ao vivo · TPV / take rate / chargeback" },
              { icon: Fingerprint, label: "2FA obrigatório para admins e staff" },
              { icon: Radio, label: "Sessão isolada · rate limit no backend" },
            ].map((item) => (
              <li key={item.label} className="flex items-start gap-3 text-[12.5px] af-text-2">
                <span className="mt-0.5 h-6 w-6 shrink-0 rounded-md af-surface af-border border inline-flex items-center justify-center">
                  <item.icon className="h-3.5 w-3.5 af-muted" />
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-3 text-[10.5px] af-muted-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            Sistema operacional
          </span>
          <span className="af-muted-2">·</span>
          <span>Uptime 99.98% · 30d</span>
        </div>
      </aside>

      {/* ── RIGHT · Auth ── */}
      <main className="relative flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          {/* Mobile-only brand */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-6">
            <div className="h-9 w-9 rounded-md af-accent-bg flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <span className="text-[16px] font-semibold af-text tracking-tight">VENXPAY Admin</span>
          </div>

          <div className="mb-6">
            <p className="text-[10.5px] font-black uppercase tracking-[0.22em] af-muted-2 mb-2">
              {step === "credentials" ? "Autenticação" : "Verificação em duas etapas"}
            </p>
            <h1 className="font-display text-[26px] leading-[1.15] font-black tracking-tight af-text">
              {step === "credentials" ? "Entrar no painel" : "Confirme sua identidade"}
            </h1>
            <p className="mt-2 text-[13px] af-muted">
              {step === "credentials"
                ? "Use as credenciais administrativas emitidas pelo owner."
                : <>Enviamos um código de 6 dígitos para <span className="af-text-2 font-semibold">{email}</span>.</>}
            </p>
          </div>

          {step === "credentials" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-md px-3 py-2.5 text-[12.5px]"
                  style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.30)", color: "var(--as-danger)" }}>
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-[11px] af-text-2 font-semibold uppercase tracking-wider">E-mail</Label>
                <input
                  id="admin-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="admin@empresa.com"
                  className="af-input w-full h-11 rounded-md px-3 text-[14px] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-[11px] af-text-2 font-semibold uppercase tracking-wider">Senha</Label>
                <div className="relative">
                  <input
                    id="admin-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="af-input w-full h-11 rounded-md px-3 pr-10 text-[14px] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 af-muted-2 hover:af-text-3 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="af-accent-bg w-full h-11 text-[13.5px] font-semibold rounded-md shadow-none active:scale-100 transition-colors mt-2"
              >
                <Lock className="h-3.5 w-3.5 mr-2" />
                {loading ? "Autenticando..." : "Entrar no painel"}
              </Button>

              <p className="pt-3 text-center text-[11px] af-muted-2">
                Acesso restrito · Tentativas registradas · 2FA obrigatório
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-md px-3 py-2.5 text-[12.5px]"
                  style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.30)", color: "var(--as-danger)" }}>
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="admin-2fa-code" className="text-[11px] af-text-2 font-semibold uppercase tracking-wider">Código de 6 dígitos</Label>
                <input
                  id="admin-2fa-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  placeholder="000000"
                  autoFocus
                  className="af-input w-full h-14 rounded-md px-3 text-center text-[22px] font-mono tracking-[0.55em] focus:outline-none"
                />
                <p className="text-[11px] af-muted-2">Válido por 10 minutos · 5 tentativas.</p>
              </div>

              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="af-accent-bg w-full h-11 text-[13.5px] font-semibold rounded-md shadow-none active:scale-100 transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5 mr-2" />
                {loading ? "Verificando..." : "Confirmar código"}
              </Button>

              <button
                type="button"
                onClick={resetToStep1}
                className="w-full text-[12px] af-muted-2 hover:af-text-3 transition-colors"
              >
                ← Voltar ao login
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
