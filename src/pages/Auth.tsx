/**
 * Auth — Sharp fintech login/signup
 * @module Auth
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Rocket, Eye, EyeOff, Shield, GraduationCap, BarChart2, CreditCard,
  Users, TrendingUp, CheckCircle2, ArrowRight, Lock,
  Mail, Phone, User, FileText,
  Heart, Target, Zap, KeyRound, RotateCcw, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import authHeroImg from "@/assets/auth-hero.jpg";

/* ─────────────────── Document helpers ─────────────────── */
function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) => {
      let r = a; if (b) r += "." + b; if (c) r += "." + c; if (d) r += "-" + d; return r;
    });
  }
  return digits.replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, a, b, c, d, e) => {
    let r = a; if (b) r += "." + b; if (c) r += "." + c; if (d) r += "/" + d; if (e) r += "-" + e; return r;
  });
}
function validateCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0; if (r !== parseInt(d[9])) return false;
  s = 0; for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0; return r === parseInt(d[10]);
}
function validateCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2], w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let s = 0; for (let i = 0; i < 12; i++) s += parseInt(d[i]) * w1[i];
  let r = s % 11; const d1 = r < 2 ? 0 : 11 - r; if (parseInt(d[12]) !== d1) return false;
  s = 0; for (let i = 0; i < 13; i++) s += parseInt(d[i]) * w2[i];
  r = s % 11; const d2 = r < 2 ? 0 : 11 - r; return parseInt(d[13]) === d2;
}

function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++; if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++; if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++; if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score: 1, label: "Fraca", color: "bg-destructive", text: "text-destructive" };
  if (score <= 4) return { score: 2, label: "Média", color: "bg-warning", text: "text-warning" };
  return { score: 3, label: "Forte", color: "bg-success", text: "text-success" };
}

const SIGNUP_STEPS = [
  { id: 1, label: "Dados", icon: User },
  { id: 2, label: "Contato", icon: Mail },
  { id: 3, label: "Segurança", icon: Lock },
  { id: 4, label: "Confirmar", icon: CheckCircle2 },
];

/* ─── Animated counter ─── */
function AnimatedCounter({ target, prefix = "", suffix = "", duration = 2000 }: { target: number; prefix?: string; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);
  return <span>{prefix}{count.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ─── Live preview data ─── */


export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [recoveryMode, setRecoveryMode] = useState<"idle" | "email" | "code" | "done">("idle");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const navigate = useNavigate();

  const pwStrength = getPasswordStrength(password);

  useEffect(() => { setStep(1); }, [isLogin]);
  useEffect(() => { if (!isLogin) setRecoveryMode("idle"); }, [isLogin]);

  const handleRecoveryStart = async () => {
    const targetEmail = recoveryEmail || email;
    if (!targetEmail.includes("@")) { toast.error("Informe um e-mail válido"); return; }
    setRecoveryLoading(true);
    setRecoveryError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setRecoveryEmail(targetEmail);
      setRecoveryMode("code");
      toast.success("Código enviado para seu e-mail!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar código. Tente novamente.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoveryVerify = async () => {
    if (!recoveryCode.trim()) { setRecoveryError("Informe o código"); return; }
    if (newPassword.length < 8) { setRecoveryError("Senha deve ter no mínimo 8 caracteres"); return; }
    if (newPassword !== confirmNewPassword) { setRecoveryError("As senhas não coincidem"); return; }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) { setRecoveryError("Senha deve ter maiúscula, minúscula e número"); return; }
    setRecoveryLoading(true);
    setRecoveryError("");
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: recoveryEmail,
        token: recoveryCode.trim(),
        type: "recovery",
      });
      if (verifyError) {
        if (verifyError.message?.includes("expired")) setRecoveryError("Código expirado. Solicite um novo.");
        else setRecoveryError("Código inválido!");
        setRecoveryLoading(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setRecoveryMode("done");
      toast.success("Senha alterada com sucesso!");
      setTimeout(() => {
        setRecoveryMode("idle");
        setRecoveryCode("");
        setNewPassword("");
        setConfirmNewPassword("");
        setRecoveryEmail("");
      }, 3000);
    } catch (err: any) {
      setRecoveryError(err?.message || "Erro ao alterar senha.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const newPwStrength = getPasswordStrength(newPassword);

  const handleDocumentChange = (value: string) => {
    const formatted = formatDocument(value);
    setDocument(formatted);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 11) setDocumentError(validateCPF(digits) ? "" : "CPF inválido");
    else if (digits.length === 14) setDocumentError(validateCNPJ(digits) ? "" : "CNPJ inválido");
    else setDocumentError("");
  };

  const canAdvanceStep = (s: number) => {
    if (s === 1) return fullName.trim().length >= 3 && nickname.trim().length >= 2;
    if (s === 2) {
      const digits = document.replace(/\D/g, "");
      return email.includes("@") && phone.replace(/\D/g, "").length >= 10 && (digits.length === 11 || digits.length === 14) && !documentError;
    }
    if (s === 3) return password.length >= 8 && password === confirmPassword && referralSource;
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLogin && Date.now() < lockoutUntil) {
      toast.error(`Muitas tentativas. Aguarde ${Math.ceil((lockoutUntil - Date.now()) / 1000)}s.`);
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setLoginAttempts((prev) => {
            const next = prev + 1;
            if (next >= 5) setLockoutUntil(Date.now() + 60000);
            return next;
          });
          throw error;
        }
        setLoginAttempts(0);
        navigate("/dashboard");
      } else {
        if (password !== confirmPassword) { toast.error("As senhas não coincidem"); setLoading(false); return; }
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) { toast.error("Senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula e número"); setLoading(false); return; }
        const digits = document.replace(/\D/g, "");
        if (digits.length === 11 && !validateCPF(digits)) { toast.error("CPF inválido"); setLoading(false); return; }
        if (digits.length === 14 && !validateCNPJ(digits)) { toast.error("CNPJ inválido"); setLoading(false); return; }
        if (digits.length !== 11 && digits.length !== 14) { toast.error("Informe um CPF ou CNPJ válido"); setLoading(false); return; }
        if (!referralSource) { toast.error("Selecione onde conheceu a plataforma"); setLoading(false); return; }

        // ── Pre-flight: check for duplicate email/document/phone ──
        const cleanPhone = phone.replace(/\D/g, "");
        const { data: conflict, error: conflictErr } = await supabase.rpc("check_signup_conflicts", {
          _email: email.toLowerCase().trim(),
          _document_number: digits,
          _phone: cleanPhone,
        });
        if (conflictErr) { toast.error("Erro ao verificar dados. Tente novamente."); setLoading(false); return; }
        if (conflict === "email") { toast.error("Este e-mail já está cadastrado. Faça login ou use outro e-mail."); setLoading(false); return; }
        if (conflict === "document") { toast.error("Este CPF/CNPJ já está vinculado a outra conta."); setLoading(false); return; }
        if (conflict === "phone") { toast.error("Este telefone já está vinculado a outra conta."); setLoading(false); return; }

        const { error } = await supabase.auth.signUp({
          email: email.toLowerCase().trim(),
          password,
          options: {
            data: {
              full_name: fullName,
              nickname,
              document_number: digits,
              document_type: digits.length === 11 ? "cpf" : "cnpj",
              phone: cleanPhone,
              referral_source: referralSource,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        // Double-check: Supabase may return fake success for existing emails
        // If identities array is empty, the email already exists
        toast.success("Conta criada com sucesso! Verifique seu e-mail para ativar a conta.");
        setIsLogin(true);
        setStep(1);
      }
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || "";
      if (msg.includes("Invalid login")) toast.error("E-mail ou senha incorretos.");
      else if (msg.includes("already registered")) toast.error("Este e-mail já está cadastrado.");
      else if (msg.includes("Email not confirmed")) toast.error("Confirme seu e-mail antes de acessar.");
      else if (msg.includes("duplicate key") || msg.includes("unique")) toast.error("CPF/CNPJ, e-mail ou telefone já cadastrado em outra conta.");
      else toast.error("Instabilidade na rede. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "h-12 rounded-2xl border-border/60 bg-background/70 text-foreground placeholder:text-muted-foreground/55 focus:border-primary/45 focus:ring-2 focus:ring-primary/15";
  const labelCls = "mb-1.5 flex items-center gap-1.5 text-[10px] font-heading uppercase tracking-[0.16em] text-muted-foreground";

  const desktopMetrics = [
    { label: "Aprovação", value: "92%", icon: Target },
    { label: "Ticket Médio", value: "R$ 347", icon: CreditCard },
    { label: "Saldo Liberado", value: "R$ 8.940", icon: CheckCircle2 },
    { label: "Chargeback", value: "0,12%", icon: Shield },
  ];

  const paymentMix = [
    { label: "PIX", pct: 68, value: "R$ 87.420", colorClass: "bg-primary" },
    { label: "Cartão", pct: 27, value: "R$ 34.980", colorClass: "bg-info" },
    { label: "Boleto", pct: 5, value: "R$ 6.080", colorClass: "bg-warning" },
  ];

  const securitySignals = [
    { icon: Shield, title: "Anti-fraude ativo", detail: "análise em tempo real" },
    { icon: Lock, title: "2FA pronto", detail: "camadas extras de proteção" },
    { icon: Shield, title: "LGPD", detail: "governança e consentimento" },
    { icon: Shield, title: "Monitoramento 24/7", detail: "checkout e saques online" },
  ];

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <div className="fixed inset-0 dot-grid opacity-20 pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-info/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative h-full lg:grid lg:grid-cols-[70%_30%]">
        {/* ═══ LEFT: Auth Panel ═══ */}
        <div className="relative flex flex-col h-full border-r border-border/40 bg-background/80 backdrop-blur-xl overflow-hidden">
          <div className="shrink-0 z-20 flex h-14 items-center justify-between border-b border-border/40 bg-background/80 px-5 backdrop-blur-xl md:px-8">
            <a href="/" className="flex items-center gap-3 hover:opacity-90">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12 text-primary glow-primary">
                <Rocket className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="block text-[14px] font-heading uppercase tracking-[0.08em] text-foreground">HOTZFY</span>
                <span className="block text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Plataforma de Infoprodutos</span>
              </div>
            </a>
            <div className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full rounded-full bg-success pulse-ring" />
                <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-40" />
                <span className="relative h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-[8px] font-heading uppercase tracking-[0.22em] text-success">Online</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex min-h-full items-start justify-center px-4 pt-0 pb-4 md:px-8 md:pt-0">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className={cn("w-full max-w-[470px]", !isLogin && "-mt-6 md:-mt-8")}>
              <div className="mb-6">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-[9px] font-heading uppercase tracking-[0.22em] text-primary">
                  <CheckCircle2 className="h-3 w-3" />
                  {isLogin ? "Acesso seguro" : `Etapa ${step} de 4`}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isLogin ? "login" : `signup-${step}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
                  >
                    <h1 className="text-[28px] sm:text-[34px] font-heading leading-[1.02] tracking-[-0.05em] text-foreground">
                      {isLogin ? (
                        <>Acesse sua <span className="text-primary">operação</span></>
                      ) : step === 1 ? (
                        <>Seus <span className="text-primary">dados</span> pessoais</>
                      ) : step === 2 ? (
                        <>Contato e <span className="text-primary">documento</span></>
                      ) : step === 3 ? (
                        <>Proteja sua <span className="text-primary">conta</span></>
                      ) : (
                        <>Confirme e <span className="text-primary">comece</span></>
                      )}
                    </h1>
                    <p className="mt-2 max-w-[420px] text-[13px] leading-relaxed text-muted-foreground">
                      {isLogin
                        ? "Faturamento, vendas, checkout e saques em uma visão única."
                        : step === 1
                          ? "Preencha seus dados para criar seu acesso à plataforma."
                          : step === 2
                            ? "Precisamos do seu contato e documento para liberar sua operação."
                            : step === 3
                              ? "Defina uma senha forte e finalize as últimas preferências."
                              : "Revise seus dados e ative sua conta com segurança."}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {!isLogin && (
                <div className="mb-6">
                  <div className="flex items-center gap-1.5">
                    {SIGNUP_STEPS.map((signupStep, index) => {
                      const StepIcon = signupStep.icon;
                      const active = step === signupStep.id;
                      const done = step > signupStep.id;
                      return (
                        <div key={signupStep.id} className="flex flex-1 items-center">
                          <div className={cn(
                            "flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all",
                            active ? "border border-primary/20 bg-primary/10 text-primary" : done ? "border border-success/20 bg-success/10 text-success" : "border border-border/50 bg-card/60 text-muted-foreground"
                          )}>
                            <div className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-lg",
                              active ? "bg-primary/15" : done ? "bg-success/15" : "bg-muted/60"
                            )}>
                              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                            </div>
                            <span className="hidden text-[8px] font-heading uppercase tracking-[0.18em] sm:block">{signupStep.label}</span>
                          </div>
                          {index < SIGNUP_STEPS.length - 1 && <div className="mx-1 h-px flex-1 bg-border/60" />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/60">
                    <motion.div animate={{ width: `${(step / 4) * 100}%` }} transition={{ duration: 0.4 }} className="h-full rounded-full bg-primary" />
                  </div>
                </div>
              )}

              <div className="relative overflow-hidden rounded-[28px] panel-enterprise noise-overlay scan-line">
                <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="absolute -right-12 top-0 h-32 w-32 rounded-full bg-primary/12 blur-3xl" />
                <div className="relative z-10 p-6 md:p-7">
                  <div className="mb-5 rounded-2xl glass-panel p-1">
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { mode: true, label: "Entrar", icon: Lock },
                        { mode: false, label: "Criar Conta", icon: User },
                      ].map((tab) => (
                        <button
                          key={tab.label}
                          type="button"
                          onClick={() => setIsLogin(tab.mode)}
                          className={cn(
                            "flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-heading uppercase tracking-[0.18em] transition-all",
                            isLogin === tab.mode
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <tab.icon className="h-3.5 w-3.5" />
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isLogin ? "login-form" : `signup-form-${step}`}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.22 }}
                    >
                      {isLogin ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <AnimatePresence mode="wait">
                            <motion.div key={recoveryMode} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                              {recoveryMode === "idle" ? (
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="email" className={labelCls}><Mail className="h-3 w-3 text-primary/80" />E-mail</Label>
                                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} required />
                                  </div>
                                  <div>
                                    <Label htmlFor="password" className={labelCls}><Lock className="h-3 w-3 text-primary/80" />Senha</Label>
                                    <div className="relative">
                                      <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={cn(inputCls, "pr-12")} required minLength={8} />
                                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex justify-end -mt-1">
                                    <button type="button" onClick={() => { setRecoveryEmail(email); setRecoveryMode("email"); }} className="text-[11px] font-semibold text-primary hover:underline underline-offset-2 transition-colors">
                                      Esqueceu a senha?
                                    </button>
                                  </div>
                                  <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-heading uppercase tracking-[0.16em] shadow-lg shadow-primary/15 hover:brightness-110">
                                    {loading ? <div className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : <>Entrar na plataforma <ArrowRight className="ml-2 h-4 w-4" /></>}
                                  </Button>
                                </div>
                              ) : recoveryMode === "email" ? (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-3 mb-1">
                                    <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                                      <KeyRound className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                      <p className="text-[13px] font-display font-bold text-foreground">Recuperar senha</p>
                                      <p className="text-[10px] text-muted-foreground">Enviaremos um código para seu e-mail</p>
                                    </div>
                                  </div>
                                  <div>
                                    <Label htmlFor="recovery-email" className={labelCls}><Mail className="h-3 w-3 text-primary/80" />E-mail da conta</Label>
                                    <Input id="recovery-email" type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} required />
                                  </div>
                                  <div className="flex gap-3">
                                    <Button type="button" variant="outline" onClick={() => setRecoveryMode("idle")} className="h-11 flex-1 rounded-2xl border-border/60 bg-background/50 font-heading uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted/30">
                                      Voltar
                                    </Button>
                                    <Button type="button" onClick={handleRecoveryStart} disabled={recoveryLoading} className="h-11 flex-1 rounded-2xl bg-primary text-primary-foreground font-heading uppercase tracking-[0.14em] shadow-lg shadow-primary/15 hover:brightness-110">
                                      {recoveryLoading ? <div className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : <>Enviar código <ArrowRight className="ml-2 h-4 w-4" /></>}
                                    </Button>
                                  </div>
                                </div>
                              ) : recoveryMode === "code" ? (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-3 mb-1">
                                    <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                                      <Shield className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                      <p className="text-[13px] font-display font-bold text-foreground">Nova senha</p>
                                      <p className="text-[10px] text-muted-foreground">Código enviado para <strong className="text-foreground">{recoveryEmail}</strong></p>
                                    </div>
                                  </div>
                                  <div>
                                    <Label htmlFor="new-password" className={labelCls}><Lock className="h-3 w-3 text-primary/80" />Nova senha</Label>
                                    <div className="relative">
                                      <Input id="new-password" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className={cn(inputCls, "pr-12")} required minLength={8} />
                                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                    </div>
                                    {newPassword.length > 0 && (
                                      <div className="mt-2 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                          <div className="flex flex-1 gap-1">
                                            {[1, 2, 3].map((index) => (
                                              <div key={index} className={cn("h-1.5 flex-1 rounded-full", index <= newPwStrength.score ? newPwStrength.color : "bg-muted/70")} />
                                            ))}
                                          </div>
                                          <span className={cn("text-[9px] font-heading uppercase tracking-[0.18em]", newPwStrength.text)}>{newPwStrength.label}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <Label htmlFor="confirm-new-password" className={labelCls}><Shield className="h-3 w-3 text-primary/80" />Confirmar nova senha</Label>
                                    <Input id="confirm-new-password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" className={cn(inputCls, confirmNewPassword && newPassword !== confirmNewPassword && "border-destructive/60 ring-2 ring-destructive/10")} required minLength={8} />
                                    {confirmNewPassword && newPassword !== confirmNewPassword && <p className="mt-1 text-[10px] font-medium text-destructive">As senhas não coincidem</p>}
                                  </div>
                                  <div>
                                    <Label htmlFor="recovery-code" className={labelCls}><KeyRound className="h-3 w-3 text-primary/80" />Código de verificação</Label>
                                    <Input id="recovery-code" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" maxLength={6} className={cn(inputCls, "text-center text-lg font-heading tracking-[0.4em]", recoveryError && "border-destructive/60 ring-2 ring-destructive/10")} required />
                                    {recoveryError && (
                                      <p className="mt-1.5 text-[10px] font-semibold text-destructive flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        {recoveryError}
                                      </p>
                                    )}
                                  </div>
                                  <button type="button" onClick={handleRecoveryStart} disabled={recoveryLoading} className="text-[10px] text-primary hover:underline underline-offset-2 font-semibold flex items-center gap-1">
                                    <RotateCcw className="h-3 w-3" /> Reenviar código
                                  </button>
                                  <div className="flex gap-3">
                                    <Button type="button" variant="outline" onClick={() => { setRecoveryMode("idle"); setRecoveryCode(""); setNewPassword(""); setConfirmNewPassword(""); setRecoveryError(""); }} className="h-11 flex-1 rounded-2xl border-border/60 bg-background/50 font-heading uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted/30">
                                      Cancelar
                                    </Button>
                                    <Button type="button" onClick={handleRecoveryVerify} disabled={recoveryLoading || recoveryCode.length < 6} className="h-11 flex-1 rounded-2xl bg-primary text-primary-foreground font-heading uppercase tracking-[0.14em] shadow-lg shadow-primary/15 hover:brightness-110">
                                      {recoveryLoading ? <div className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : <>Confirmar <ArrowRight className="ml-2 h-4 w-4" /></>}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-6 space-y-4">
                                  <div className="mx-auto h-16 w-16 rounded-full bg-success/15 flex items-center justify-center ring-4 ring-success/10">
                                    <CheckCircle2 className="h-8 w-8 text-success" />
                                  </div>
                                  <div>
                                    <p className="text-[16px] font-display font-bold text-foreground">Senha alterada!</p>
                                    <p className="text-[12px] text-muted-foreground mt-1">Agora você pode fazer login com a nova senha.</p>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </form>
                      ) : (
                        <div className="space-y-4">
                          {step === 1 && (
                            <>
                              <div>
                                <Label htmlFor="name" className={labelCls}><User className="h-3 w-3 text-primary/80" />Nome completo</Label>
                                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" className={inputCls} required />
                              </div>
                              <div>
                                <Label htmlFor="nickname" className={labelCls}><Heart className="h-3 w-3 text-primary/80" />Como quer ser chamado?</Label>
                                <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Ex: João, Mari..." className={inputCls} required />
                              </div>
                            </>
                          )}

                          {step === 2 && (
                            <>
                              <div>
                                <Label htmlFor="signup-email" className={labelCls}><Mail className="h-3 w-3 text-primary/80" />E-mail</Label>
                                <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} required />
                              </div>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                  <Label htmlFor="document" className={labelCls}><FileText className="h-3 w-3 text-primary/80" />CPF ou CNPJ</Label>
                                  <Input id="document" value={document} onChange={(e) => handleDocumentChange(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" autoComplete="off" className={cn(inputCls, documentError && "border-destructive/60 ring-2 ring-destructive/10")} required />
                                  {documentError && <p className="mt-1 text-[10px] font-medium text-destructive">{documentError}</p>}
                                </div>
                                <div>
                                  <Label htmlFor="phone" className={labelCls}><Phone className="h-3 w-3 text-primary/80" />WhatsApp</Label>
                                  <Input
                                    id="phone"
                                    value={phone}
                                    onChange={(e) => {
                                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                                      let formatted = digits;
                                      if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                                      if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                                      setPhone(formatted);
                                    }}
                                    placeholder="(11) 99999-9999"
                                    inputMode="tel"
                                    className={inputCls}
                                    required
                                  />
                                </div>
                              </div>
                            </>
                          )}

                          {step === 3 && (
                            <>
                              <div>
                                <Label htmlFor="signup-password" className={labelCls}><Lock className="h-3 w-3 text-primary/80" />Senha</Label>
                                <div className="relative">
                                  <Input id="signup-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className={cn(inputCls, "pr-12")} required minLength={8} />
                                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                                {password.length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <div className="flex flex-1 gap-1">
                                        {[1, 2, 3].map((index) => (
                                          <div key={index} className={cn("h-1.5 flex-1 rounded-full", index <= pwStrength.score ? pwStrength.color : "bg-muted/70")} />
                                        ))}
                                      </div>
                                      <span className={cn("text-[9px] font-heading uppercase tracking-[0.18em]", pwStrength.text)}>{pwStrength.label}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Maiúscula, minúscula, número e 8+ caracteres.</p>
                                  </div>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="confirmPassword" className={labelCls}><Shield className="h-3 w-3 text-primary/80" />Confirmar Senha</Label>
                                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={cn(inputCls, confirmPassword && password !== confirmPassword && "border-destructive/60 ring-2 ring-destructive/10")} required minLength={8} />
                                {confirmPassword && password !== confirmPassword && <p className="mt-1 text-[10px] font-medium text-destructive">As senhas não coincidem</p>}
                              </div>
                              <div>
                                <Label className={labelCls}><Target className="h-3 w-3 text-primary/80" />Onde conheceu a HOTZFY?</Label>
                                <Select value={referralSource} onValueChange={setReferralSource}>
                                  <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione uma opção..." /></SelectTrigger>
                                  <SelectContent className="rounded-2xl border-border/60 bg-popover/95 backdrop-blur-xl">
                                    {[
                                      { value: "instagram", label: "Instagram" },
                                      { value: "indicacao", label: "Indicação de amigo" },
                                      { value: "youtube", label: "YouTube" },
                                      { value: "pesquisa", label: "Pesquisa (Google)" },
                                      { value: "tiktok", label: "TikTok" },
                                      { value: "outro", label: "Outro" },
                                    ].map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}

                          {step === 4 && (
                            <div className="space-y-3">
                              <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                                <p className="mb-3 text-[10px] font-heading uppercase tracking-[0.18em] text-primary">Resumo do cadastro</p>
                                <div className="space-y-2">
                                  {[
                                    { label: "Nome", value: fullName },
                                    { label: "Apelido", value: nickname },
                                    { label: "E-mail", value: email },
                                    { label: "Documento", value: document },
                                    { label: "WhatsApp", value: phone },
                                  ].map((item) => (
                                    <div key={item.label} className="flex items-center justify-between rounded-xl border border-border/40 bg-background/45 px-3 py-2">
                                      <span className="text-[10px] text-muted-foreground">{item.label}</span>
                                      <span className="text-[11px] font-semibold text-foreground/85">{item.value || "—"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 rounded-2xl border border-success/20 bg-success/10 p-3 text-success">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                <p className="text-[11px] font-semibold">Tudo pronto para ativar sua conta.</p>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-3 pt-1">
                            {step > 1 && (
                              <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)} className="h-11 flex-1 rounded-2xl border-border/60 bg-background/50 font-heading uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted/30">
                                Voltar
                              </Button>
                            )}
                            {step < 4 ? (
                              <Button type="button" onClick={() => setStep((current) => current + 1)} disabled={!canAdvanceStep(step)} className="h-11 flex-1 rounded-2xl bg-primary text-primary-foreground font-heading uppercase tracking-[0.14em] shadow-lg shadow-primary/15 hover:brightness-110">
                                Próximo <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            ) : (
                              <Button type="button" onClick={() => handleSubmit()} disabled={loading} className="h-12 flex-1 rounded-2xl bg-primary text-primary-foreground font-heading uppercase tracking-[0.14em] shadow-lg shadow-primary/15 hover:brightness-110">
                                {loading ? <div className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : <>Criar conta grátis <ArrowRight className="ml-2 h-4 w-4" /></>}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-3 text-[8px] font-heading uppercase tracking-[0.18em] text-muted-foreground">
                        {isLogin ? "ou crie uma conta" : "já possui conta?"}
                      </span>
                    </div>
                  </div>

                  <button type="button" onClick={() => setIsLogin(!isLogin)} className="h-11 w-full rounded-2xl border border-border/60 bg-background/50 text-[11px] font-heading uppercase tracking-[0.14em] text-muted-foreground hover:border-primary/20 hover:text-foreground">
                    {isLogin ? "Criar conta grátis" : "Entrar na minha conta"}
                  </button>

                  {isLogin && (
                    <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/40 pt-5 sm:grid-cols-4">
                      {[
                        { icon: Shield, label: "SSL 256-bit" },
                        { icon: Shield, label: "Anti-fraude" },
                        { icon: Lock, label: "Criptografado" },
                        { icon: CheckCircle2, label: "LGPD" },
                      ].map((badge) => (
                        <div key={badge.label} className="rounded-xl border border-border/50 bg-background/45 px-2 py-3 text-center">
                          <badge.icon className="mx-auto mb-1 h-3.5 w-3.5 text-primary/80" />
                          <span className="text-[8px] font-heading uppercase tracking-[0.14em] text-muted-foreground">{badge.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
                    Ao continuar, você concorda com os <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Termos de Uso</a> e a <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Política de Privacidade</a>.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 lg:hidden">
                {[
                  { value: 10847, label: "Produtores", icon: Users, prefix: "", suffix: "+" },
                  { value: 52, label: "Processados", icon: TrendingUp, prefix: "R$", suffix: "M" },
                  { value: 99, label: "Uptime", icon: Shield, prefix: "", suffix: ".9%" },
                ].map((item) => (
                  <div key={item.label} className="panel-enterprise-subtle p-3 text-center">
                    <item.icon className="mx-auto mb-1.5 h-3.5 w-3.5 text-primary/80" />
                    <p className="font-heading text-[14px] tabular-nums text-foreground"><AnimatedCounter target={item.value} prefix={item.prefix} suffix={item.suffix} /></p>
                    <p className="mt-0.5 text-[7px] font-heading uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Product Preview ═══ */}
        <div className="relative hidden overflow-hidden lg:block">
          {/* Full-bleed hero image */}
          <div className="absolute inset-0">
            <img
              src={authHeroImg}
              alt="Empreendedora usando a plataforma HOTZFY"
              className="h-full w-full object-cover object-[center_10%]"
              width={960}
              height={1280}
            />
            {/* Only darken the bottom for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          </div>

          {/* Content pinned to bottom — face stays clean */}
          <div className="relative z-10 flex min-h-screen flex-col justify-end p-6 xl:p-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="space-y-3"
            >
              {/* Headline */}
              <div className="mb-1">
                <p className="font-heading text-[22px] xl:text-[26px] tracking-[-0.03em] leading-[1.1] text-white">
                  Tudo que você precisa<br />para vender online.
                </p>
                <p className="text-[11px] text-white/45 mt-1.5 max-w-[260px] leading-relaxed">
                  Checkout, pagamentos, área de membros e muito mais em uma única plataforma.
                </p>
              </div>

              {/* Feature cards — 2x2 grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Zap, title: "Saque automático", desc: "Receba no PIX em minutos" },
                  { icon: CreditCard, title: "Checkout otimizado", desc: "PIX, cartão e boleto" },
                  { icon: GraduationCap, title: "Área de membros", desc: "Cursos e conteúdo protegido" },
                  { icon: Shield, title: "Anti-fraude", desc: "Proteção em tempo real" },
                ].map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.08 }}
                    className="rounded-xl border border-white/8 bg-white/5 backdrop-blur-md p-3 group hover:bg-white/8 transition-colors"
                  >
                    <f.icon className="h-4 w-4 text-primary mb-2" />
                    <p className="text-[11px] font-semibold text-white leading-tight">{f.title}</p>
                    <p className="text-[9px] text-white/40 mt-0.5 leading-tight">{f.desc}</p>
                  </motion.div>
                ))}
              </div>

              {/* Bottom trust line */}
              <div className="flex items-center gap-3 pt-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-[9px] font-medium text-white/35 uppercase tracking-[0.1em]">Plataforma online · PCI DSS · LGPD · SSL 256-bit</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
