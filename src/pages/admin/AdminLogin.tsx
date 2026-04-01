import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, Eye, EyeOff, Lock, AlertTriangle, Fingerprint, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // 2FA state
  const [step, setStep] = useState<"login" | "2fa">("login");
  const [tempToken, setTempToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first OTP input
  useEffect(() => {
    if (step === "2fa") {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("E-mail inválido.");
      return;
    }
    if (password.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("admin-login", {
        body: { email: trimmedEmail, password },
      });

      if (fnError) throw new Error("Erro de conexão.");

      if (!data?.success) {
        setError(data?.error || "Credenciais inválidas ou acesso não autorizado.");
        if (data?.locked) {
          setError("Muitas tentativas. Aguarde 15 minutos.");
        }
        return;
      }

      if (data.requires2FA) {
        setTempToken(data.tempToken);
        setMaskedEmail(data.maskedEmail);
        setStep("2fa");
        toast.info("Código de verificação enviado!");
        // DEV: auto-fill OTP for testing
        if (data._devOtp) {
          const digits = String(data._devOtp).split("");
          setOtpDigits(digits);
        }
        return;
      }

      // Direct login (fallback if 2FA not enabled)
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw sessionError;
      toast.success("Bem-vindo ao painel administrativo!");
      navigate("/admin-matheus/dashboard");
    } catch {
      setError("Credenciais inválidas ou acesso não autorizado.");
    } finally {
      setLoading(false);
      setPassword("");
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Paste handling
      const chars = value.replace(/\D/g, "").split("").slice(0, 6);
      const newDigits = [...otpDigits];
      chars.forEach((c, i) => {
        if (index + i < 6) newDigits[index + i] = c;
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(index + chars.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d?$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setError("Digite o código completo de 6 dígitos.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("admin-2fa-verify", {
        body: { action: "verify", code, tempToken },
      });

      if (fnError) throw new Error("Erro de conexão.");

      if (!data?.success) {
        setError(data?.error || "Código inválido.");
        setOtpDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw sessionError;

      // Log successful attempt
      toast.success("Bem-vindo ao painel administrativo!");
      navigate("/admin-matheus/dashboard");
    } catch {
      setError("Erro ao verificar código.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("login");
    setOtpDigits(["", "", "", "", "", ""]);
    setError("");
    setTempToken("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(135deg,#050505_0%,#080810_50%,#050508_100%)]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-900/[0.06] rounded-full blur-[150px]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 0.5px, transparent 0)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative w-full max-w-[420px] p-6 animate-slide-up">
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-5">
            <div className="h-20 w-20 rounded-[22px] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_20px_60px_rgba(99,102,241,0.2)]">
              {step === "login" ? (
                <Flame className="h-10 w-10 text-white" />
              ) : (
                <ShieldCheck className="h-10 w-10 text-white" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-indigo-500 flex items-center justify-center border-4 border-[#050505]">
              <Fingerprint className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
          <h1 className="text-[26px] font-bold text-white tracking-tight">
            {step === "login" ? "HOTZFY Admin" : "Verificação 2FA"}
          </h1>
          <p className="text-[13px] text-white/30 mt-1 font-medium">
            {step === "login"
              ? "Painel de Controle Administrativo"
              : `Código enviado para ${maskedEmail}`}
          </p>
        </div>

        <div className="bg-[#0A0A10] rounded-3xl border border-white/[0.06] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
          {error && (
            <div className="flex items-center gap-2.5 bg-red-500/8 border border-red-500/15 rounded-2xl p-4 mb-6 text-[13px] text-red-400 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {step === "login" ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-[11px] text-white/40 uppercase tracking-[0.12em] font-semibold">E-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-2 bg-white/[0.03] border-white/[0.06] h-[52px] text-white placeholder:text-white/15 rounded-2xl text-[14px] focus:border-indigo-500/40 focus:ring-indigo-500/10 transition-all" placeholder="admin@empresa.com" />
              </div>
              <div>
                <Label className="text-[11px] text-white/40 uppercase tracking-[0.12em] font-semibold">Senha</Label>
                <div className="relative mt-2">
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required minLength={6} className="bg-white/[0.03] border-white/[0.06] h-[52px] text-white placeholder:text-white/15 pr-12 rounded-2xl text-[14px] focus:border-indigo-500/40 focus:ring-indigo-500/10 transition-all" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-[52px] bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 text-white font-semibold rounded-2xl shadow-[0_10px_40px_rgba(99,102,241,0.25)] hover:shadow-[0_15px_50px_rgba(99,102,241,0.35)] transition-all duration-300 text-[14px]" disabled={loading}>
                <Lock className="h-4 w-4 mr-2" />
                {loading ? "Autenticando..." : "Acessar Painel"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify2FA} className="space-y-6">
              <div>
                <Label className="text-[11px] text-white/40 uppercase tracking-[0.12em] font-semibold text-center block mb-4">
                  Código de 6 dígitos
                </Label>
                <div className="flex gap-2.5 justify-center">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 text-center text-xl font-bold text-white bg-white/[0.04] border border-white/[0.08] rounded-xl focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  ))}
                </div>
                <p className="text-[11px] text-white/20 text-center mt-3">
                  O código expira em 5 minutos
                </p>
              </div>

              <Button type="submit" className="w-full h-[52px] bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 text-white font-semibold rounded-2xl shadow-[0_10px_40px_rgba(99,102,241,0.25)] transition-all duration-300 text-[14px]" disabled={loading}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                {loading ? "Verificando..." : "Verificar Código"}
              </Button>

              <button
                type="button"
                onClick={handleBack}
                className="flex items-center justify-center gap-2 w-full text-[13px] text-white/30 hover:text-white/50 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao login
              </button>
            </form>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 mt-8">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.8)]" />
            <span className="text-[10px] text-white/20 font-medium">SSL Ativo</span>
          </div>
          <span className="text-white/10">•</span>
          <span className="text-[10px] text-white/20 font-medium">2FA Obrigatório</span>
          <span className="text-white/10">•</span>
          <span className="text-[10px] text-white/20 font-medium">Acessos monitorados</span>
        </div>
      </div>
    </div>
  );
}
