import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck, AlertCircle, Lock, Sun, Moon, KeyRound } from "lucide-react";
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
    <div className="admin-frame min-h-screen flex items-center justify-center af-bg-soft px-4 py-10 relative">
      {/* Theme toggle (top-right) */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 h-9 w-9 rounded-md af-surface af-border af-text-2 border inline-flex items-center justify-center hover:opacity-80 transition-opacity"
        title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-[400px]">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-md af-accent-bg flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <span className="text-[18px] font-semibold af-text tracking-tight">HOTZFY Admin</span>
        </div>

        {/* Card */}
        <div className="af-surface af-border border rounded-md shadow-sm">
          <div className="px-7 pt-7 pb-5 af-border-soft border-b">
            <h1 className="text-[17px] font-semibold af-text">
              {step === "credentials" ? "Acesso restrito" : "Verificação 2FA"}
            </h1>
            <p className="text-[13px] af-muted mt-1">
              {step === "credentials"
                ? "Entre com suas credenciais administrativas."
                : `Enviamos um código de 6 dígitos para ${email}.`}
            </p>
          </div>

          {step === "credentials" ? (
            <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-md px-3 py-2.5 text-[12.5px]"
                  style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.30)", color: "var(--as-danger)" }}>
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-[12.5px] af-text-2 font-medium">E-mail</Label>
                <input
                  id="admin-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="admin@empresa.com"
                  className="af-input w-full h-10 rounded-md px-3 text-[13.5px] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-[12.5px] af-text-2 font-medium">Senha</Label>
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
                    className="af-input w-full h-10 rounded-md px-3 pr-10 text-[13.5px] focus:outline-none"
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
                className="af-accent-bg w-full h-10 text-[13.5px] font-semibold rounded-md shadow-none active:scale-100 transition-colors"
              >
                <Lock className="h-3.5 w-3.5 mr-2" />
                {loading ? "Autenticando..." : "Entrar no painel"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="px-7 py-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-md px-3 py-2.5 text-[12.5px]"
                  style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.30)", color: "var(--as-danger)" }}>
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="admin-2fa-code" className="text-[12.5px] af-text-2 font-medium">Código de 6 dígitos</Label>
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
                  className="af-input w-full h-11 rounded-md px-3 text-center text-[18px] font-mono tracking-[0.5em] focus:outline-none"
                />
                <p className="text-[11px] af-muted-2">Válido por 10 minutos · 5 tentativas.</p>
              </div>

              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="af-accent-bg w-full h-10 text-[13.5px] font-semibold rounded-md shadow-none active:scale-100 transition-colors"
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

          <div className="px-7 py-3.5 af-border-soft border-t af-bg-soft rounded-b-md">
            <p className="text-[11.5px] af-muted text-center">Sessão protegida · Tentativas monitoradas · 2FA obrigatório</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mt-5 text-[11px] af-muted-2">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            SSL ativo
          </span>
          <span>·</span>
          <span>Rate limit no backend</span>
          <span>·</span>
          <span>v1.0</span>
        </div>
      </div>
    </div>
  );
}
