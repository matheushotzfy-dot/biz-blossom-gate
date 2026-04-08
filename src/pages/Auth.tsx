/**
 * Auth — Ultra-Premium Fintech Login/Signup
 * Inspired by Fruitfy but elevated with HOTZFY emerald identity
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
  Star, Activity, ChevronRight, Mail, Phone, User, FileText,
  Heart, Target, Zap, Globe, BadgeCheck, Sparkles, QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import authDashboardPreview from "@/assets/auth-dashboard-preview.jpg";

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

/* ─── Floating sale notification ─── */
function FloatingNotification({ name, amount, delay }: { name: string; amount: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/90 backdrop-blur-xl ring-1 ring-border/20 shadow-lg shadow-primary/5"
    >
      <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
        <Zap className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-foreground truncate">Venda aprovada ✓</p>
        <p className="text-[9px] text-muted-foreground/60">{name} · <span className="text-primary font-bold">{amount}</span></p>
      </div>
      <span className="text-[8px] text-muted-foreground/30 font-medium shrink-0">Agora</span>
    </motion.div>
  );
}

/* ─── Animated counter ─── */
function AnimCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { setStarted(true); } }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started) return;
    let cur = 0;
    const step = target / 40;
    const iv = setInterval(() => {
      cur += step;
      if (cur >= target) { setCount(target); clearInterval(iv); }
      else setCount(Math.floor(cur));
    }, 35);
    return () => clearInterval(iv);
  }, [started, target]);
  return <span ref={ref}>{count.toLocaleString("pt-BR")}{suffix}</span>;
}

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
  const navigate = useNavigate();

  const pwStrength = getPasswordStrength(password);

  useEffect(() => { setStep(1); }, [isLogin]);

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
          setLoginAttempts(prev => { const next = prev + 1; if (next >= 5) setLockoutUntil(Date.now() + 60000); return next; });
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
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: fullName, nickname, document_number: digits, document_type: digits.length === 11 ? "cpf" : "cnpj", phone: phone.replace(/\D/g, ""), referral_source: referralSource },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        toast.success("Conta criada com sucesso! Verifique seu e-mail para ativar a conta.");
        setIsLogin(true);
        setStep(1);
      }
    } catch (error: unknown) {
      const msg = (error as any)?.message || "";
      if (msg.includes("Invalid login")) toast.error("E-mail ou senha incorretos.");
      else if (msg.includes("already registered")) toast.error("Este e-mail já está cadastrado.");
      else if (msg.includes("Email not confirmed")) toast.error("Confirme seu e-mail antes de acessar.");
      else if (msg.includes("duplicate key") || msg.includes("unique")) toast.error("CPF/CNPJ, e-mail ou telefone já cadastrado em outra conta.");
      else toast.error("Instabilidade na rede. Tente novamente em instantes.");
    } finally { setLoading(false); }
  };

  const inputCls = "h-12 rounded-xl border-border/30 bg-muted/8 text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/15 transition-all text-[13px]";
  const labelCls = "text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em] mb-1.5 flex items-center gap-1.5";

  return (
    <div className="min-h-screen flex bg-background text-foreground">

      {/* ═══ LEFT: Form Panel ═══ */}
      <div className="flex-1 relative overflow-y-auto">
        {/* Subtle ambient */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -left-[30%] -top-[30%] h-[700px] w-[700px] rounded-full bg-primary/[0.03] blur-[200px]" />
          <div className="absolute -right-[20%] bottom-[-20%] h-[500px] w-[500px] rounded-full bg-info/[0.02] blur-[180px]" />
        </div>

        {/* ── Navbar ── */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 md:px-8 h-14 bg-background/80 backdrop-blur-xl border-b border-border/8">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-md shadow-primary/15">
              <Rocket className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="text-[14px] font-display font-black tracking-[-0.03em] text-foreground">HOTZFY</span>
              <div className="flex items-center gap-1">
                <div className="h-1 w-1 rounded-full bg-success" />
                <span className="text-[8px] text-muted-foreground/40 font-semibold tracking-wider uppercase">Plataforma de Infoprodutos</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/8 ring-1 ring-success/15">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-success opacity-60" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            <span className="text-[8px] font-bold text-success/80 uppercase tracking-wider">Online</span>
          </div>
        </div>

        {/* ── Form Content ── */}
        <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 pb-10 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-[440px]"
          >
            {/* Header */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 ring-1 ring-primary/12 text-[9px] font-bold text-primary uppercase tracking-wider mb-4">
                <CheckCircle2 className="h-3 w-3" />
                {isLogin ? "Acesse sua conta" : `Etapa ${step} de 4`}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={isLogin ? "login" : `signup-${step}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="text-[26px] sm:text-[30px] font-display font-black tracking-[-0.04em] text-foreground leading-[1.1]">
                    {isLogin ? (
                      <>Bem-vindo de <span className="text-primary">volta</span></>
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
                  <p className="text-[12px] text-muted-foreground/50 mt-1.5 leading-relaxed">
                    {isLogin ? "Entre no seu painel e acompanhe seus resultados" :
                     step === 1 ? "Preencha seus dados pessoais para criar sua conta" :
                     step === 2 ? "Precisamos do seu contato e documento para verificação" :
                     step === 3 ? "Crie uma senha forte e nos diga como nos encontrou" :
                     "Revise seus dados e finalize o cadastro"}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Stepper (signup only) */}
            {!isLogin && (
              <div className="mb-6">
                <div className="flex items-center gap-1">
                  {SIGNUP_STEPS.map((s, idx) => {
                    const StepIcon = s.icon;
                    const isActive = step === s.id;
                    const isDone = step > s.id;
                    return (
                      <div key={s.id} className="flex items-center flex-1">
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all",
                          isActive ? "bg-primary/10 ring-1 ring-primary/20" :
                          isDone ? "bg-success/8 ring-1 ring-success/15" : "bg-muted/5 ring-1 ring-border/10"
                        )}>
                          <div className={cn(
                            "h-5 w-5 rounded-md flex items-center justify-center shrink-0",
                            isActive ? "bg-primary/15 text-primary" :
                            isDone ? "bg-success/15 text-success" : "bg-muted/10 text-muted-foreground/25"
                          )}>
                            {isDone ? <CheckCircle2 className="h-3 w-3" /> : <StepIcon className="h-3 w-3" />}
                          </div>
                          <span className={cn(
                            "text-[8px] font-bold uppercase tracking-wider hidden sm:block",
                            isActive ? "text-primary" : isDone ? "text-success/60" : "text-muted-foreground/25"
                          )}>{s.label}</span>
                        </div>
                        {idx < SIGNUP_STEPS.length - 1 && (
                          <div className={cn("h-px flex-1 mx-1", isDone ? "bg-success/20" : "bg-border/10")} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2.5 h-1 rounded-full bg-muted/10 overflow-hidden">
                  <motion.div
                    animate={{ width: `${(step / 4) * 100}%` }}
                    transition={{ duration: 0.4 }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
              </div>
            )}

            {/* ── Card ── */}
            <div className="rounded-2xl border border-border/15 bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
              <div className="p-6 md:p-7">
                {/* Mode toggle */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/8 ring-1 ring-border/10 mb-5">
                  {[
                    { mode: true, label: "Entrar", icon: Lock },
                    { mode: false, label: "Criar Conta", icon: User },
                  ].map(tab => (
                    <button key={tab.label} onClick={() => setIsLogin(tab.mode)}
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                        isLogin === tab.mode
                          ? "bg-primary/12 text-primary ring-1 ring-primary/15"
                          : "text-muted-foreground/30 hover:text-muted-foreground/50"
                      )}>
                      <tab.icon className="h-3.5 w-3.5" />{tab.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={isLogin ? "login-form" : `signup-form-${step}`}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isLogin ? (
                      /* ═══ LOGIN ═══ */
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="email" className={labelCls}><Mail className="h-3 w-3 text-primary/50" />E-mail</Label>
                          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="seu@email.com" className={inputCls} required />
                        </div>
                        <div>
                          <Label htmlFor="password" className={labelCls}><Lock className="h-3 w-3 text-primary/50" />Senha</Label>
                          <div className="relative">
                            <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                              placeholder="••••••••" className={cn(inputCls, "pr-12")} required minLength={8} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="pt-1">
                          <Button type="submit" disabled={loading}
                            className="w-full gradient-primary text-primary-foreground font-bold h-12 rounded-xl text-[13px] shadow-md shadow-primary/15 gap-2">
                            {loading ? (
                              <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            ) : (
                              <>Entrar na plataforma <ArrowRight className="h-4 w-4" /></>
                            )}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      /* ═══ SIGNUP STEPS ═══ */
                      <div className="space-y-4">
                        {step === 1 && (
                          <>
                            <div>
                              <Label htmlFor="name" className={labelCls}><User className="h-3 w-3 text-primary/50" />Nome completo</Label>
                              <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)}
                                placeholder="Seu nome completo" className={inputCls} required />
                            </div>
                            <div>
                              <Label htmlFor="nickname" className={labelCls}><Heart className="h-3 w-3 text-primary/50" />Como quer ser chamado?</Label>
                              <Input id="nickname" value={nickname} onChange={e => setNickname(e.target.value)}
                                placeholder="Ex: João, Mari..." className={inputCls} required />
                            </div>
                          </>
                        )}

                        {step === 2 && (
                          <>
                            <div>
                              <Label htmlFor="email" className={labelCls}><Mail className="h-3 w-3 text-info/60" />E-mail</Label>
                              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="seu@email.com" className={inputCls} required />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="document" className={labelCls}><FileText className="h-3 w-3 text-info/60" />CPF ou CNPJ</Label>
                                <Input id="document" value={document} onChange={e => handleDocumentChange(e.target.value)}
                                  placeholder="000.000.000-00" inputMode="numeric" autoComplete="off"
                                  className={cn(inputCls, documentError && "border-destructive/50 ring-1 ring-destructive/15")} required />
                                {documentError && (
                                  <p className="text-[9px] text-destructive mt-1 font-medium flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-destructive" />{documentError}
                                  </p>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="phone" className={labelCls}><Phone className="h-3 w-3 text-info/60" />WhatsApp</Label>
                                <Input id="phone" value={phone}
                                  onChange={e => { const d = e.target.value.replace(/\D/g, "").slice(0, 11); let f = d; if (d.length > 2) f = `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length > 7) f = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; setPhone(f); }}
                                  placeholder="(11) 99999-9999" inputMode="tel" className={inputCls} required />
                              </div>
                            </div>
                          </>
                        )}

                        {step === 3 && (
                          <>
                            <div>
                              <Label htmlFor="password" className={labelCls}><Lock className="h-3 w-3 text-warning/60" />Senha</Label>
                              <div className="relative">
                                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                                  placeholder="Mínimo 8 caracteres" className={cn(inputCls, "pr-12")} required minLength={8} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors">
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              {password.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 flex gap-1">
                                      {[1,2,3].map(i => (
                                        <div key={i} className={cn("h-1 flex-1 rounded-full transition-all", i <= pwStrength.score ? pwStrength.color : "bg-muted/15")} />
                                      ))}
                                    </div>
                                    <span className={cn("text-[9px] font-bold uppercase tracking-wider", pwStrength.text)}>{pwStrength.label}</span>
                                  </div>
                                  <p className="text-[9px] text-muted-foreground/30">Maiúscula, minúscula, número. Mín. 8 caracteres.</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <Label htmlFor="confirmPassword" className={labelCls}><Shield className="h-3 w-3 text-warning/60" />Confirmar Senha</Label>
                              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="••••••••" className={cn(inputCls, confirmPassword && password !== confirmPassword && "border-destructive/50 ring-1 ring-destructive/15")} required minLength={8} />
                              {confirmPassword && password !== confirmPassword && (
                                <p className="text-[9px] text-destructive mt-1 font-medium flex items-center gap-1">
                                  <span className="h-1 w-1 rounded-full bg-destructive" />As senhas não coincidem
                                </p>
                              )}
                            </div>
                            <div>
                              <Label className={labelCls}><Target className="h-3 w-3 text-warning/60" />Onde conheceu a HOTZFY?</Label>
                              <Select value={referralSource} onValueChange={setReferralSource}>
                                <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione uma opção..." /></SelectTrigger>
                                <SelectContent className="rounded-xl border-border/20 bg-popover/95 backdrop-blur-xl">
                                  {[
                                    { value: "instagram", label: "Instagram" },
                                    { value: "indicacao", label: "Indicação de amigo" },
                                    { value: "youtube", label: "YouTube" },
                                    { value: "pesquisa", label: "Pesquisa (Google)" },
                                    { value: "tiktok", label: "TikTok" },
                                    { value: "outro", label: "Outro" },
                                  ].map(v => (
                                    <SelectItem key={v.value} value={v.value} className="rounded-lg">{v.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}

                        {step === 4 && (
                          <div className="space-y-3">
                            <div className="rounded-xl bg-primary/5 ring-1 ring-primary/10 p-4 space-y-2">
                              <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Resumo do Cadastro</p>
                              {[
                                { label: "Nome", value: fullName },
                                { label: "Apelido", value: nickname },
                                { label: "E-mail", value: email },
                                { label: "Documento", value: document },
                                { label: "WhatsApp", value: phone },
                              ].map(item => (
                                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-primary/5 last:border-0">
                                  <span className="text-[10px] text-muted-foreground/40 font-medium">{item.label}</span>
                                  <span className="text-[11px] text-foreground/70 font-medium">{item.value || "—"}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/5 ring-1 ring-success/10">
                              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                              <p className="text-[10px] text-success/70 font-medium">Tudo pronto para criar sua conta!</p>
                            </div>
                          </div>
                        )}

                        {/* Nav buttons */}
                        <div className="flex gap-3 pt-1">
                          {step > 1 && (
                            <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}
                              className="flex-1 h-11 rounded-xl font-bold text-[12px] border-border/15">
                              Voltar
                            </Button>
                          )}
                          {step < 4 ? (
                            <Button type="button" onClick={() => setStep(s => s + 1)} disabled={!canAdvanceStep(step)}
                              className="flex-1 gradient-primary text-primary-foreground font-bold h-11 rounded-xl text-[12px] shadow-md shadow-primary/10 gap-2">
                              Próximo <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button type="button" onClick={() => handleSubmit()} disabled={loading}
                              className="flex-1 gradient-primary text-primary-foreground font-bold h-12 rounded-xl text-[13px] shadow-primary/15 gap-2">
                              {loading ? (
                                <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                              ) : (
                                <>Criar conta grátis <ArrowRight className="h-4 w-4" /></>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Divider */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/8" /></div>
                  <div className="relative flex justify-center">
                    <span className="bg-card/80 px-3 text-[8px] font-bold uppercase tracking-wider text-muted-foreground/20">
                      {isLogin ? "ou crie uma conta" : "já possui conta?"}
                    </span>
                  </div>
                </div>

                <button onClick={() => setIsLogin(!isLogin)}
                  className="w-full h-10 rounded-xl border border-border/12 text-[11px] font-bold text-muted-foreground/35 hover:text-foreground/60 hover:border-border/25 transition-all">
                  {isLogin ? "Criar conta grátis" : "Entrar na minha conta"}
                </button>

                {/* Trust badges */}
                {isLogin && (
                  <div className="mt-5 flex items-center justify-center gap-5 pt-4 border-t border-border/6">
                    {[
                      { icon: Shield, label: "SSL 256-bit" },
                      { icon: Shield, label: "Anti-fraude" },
                      { icon: Lock, label: "Criptografado" },
                      { icon: CheckCircle2, label: "LGPD" },
                    ].map(b => (
                      <div key={b.label} className="flex items-center gap-1 text-muted-foreground/15">
                        <b.icon className="h-3 w-3" />
                        <span className="text-[7px] font-bold uppercase tracking-wider">{b.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-center text-[9px] text-muted-foreground/20 leading-relaxed mt-4">
                  Ao continuar, você concorda com os{" "}
                  <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/40 transition-colors">Termos de Uso</a> e{" "}
                  <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/40 transition-colors">Política de Privacidade</a>.
                </p>
              </div>
            </div>

            {/* Mobile stats */}
            <div className="lg:hidden mt-5 grid grid-cols-3 gap-2">
              {[
                { value: "10K+", label: "Produtores", icon: Users },
                { value: "R$50M+", label: "Processados", icon: TrendingUp },
                { value: "99.9%", label: "Uptime", icon: Activity },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl bg-card/30 ring-1 ring-border/8">
                  <s.icon className="h-3.5 w-3.5 text-primary/30 mx-auto mb-1" />
                  <p className="text-[14px] font-display font-black text-foreground tabular-nums">{s.value}</p>
                  <p className="text-[7px] text-muted-foreground/30 font-bold uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ RIGHT: Premium Visual Panel (Desktop) ═══ */}
      <div className="hidden lg:flex w-[52%] xl:w-[55%] relative overflow-hidden">
        {/* Background mesh gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-[10%] left-[20%] h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[180px]" />
          <div className="absolute bottom-[5%] right-[10%] h-[400px] w-[400px] rounded-full bg-info/[0.05] blur-[160px]" />
          <div className="absolute top-[60%] left-[50%] h-[300px] w-[300px] rounded-full bg-primary/[0.04] blur-[140px]" />
        </div>

        {/* Grid pattern overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 xl:px-16 py-12">
          {/* Top badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 ring-1 ring-primary/15 text-[10px] font-bold text-primary uppercase tracking-widest">
              <Sparkles className="h-3.5 w-3.5" />
              A plataforma que mais cresce no Brasil
            </div>
          </motion.div>

          {/* Main headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <h2 className="text-[2.6rem] xl:text-[3.2rem] font-display font-black text-foreground leading-[1.02] tracking-[-0.04em] mb-4">
              Venda sem limites,<br />
              <span className="text-primary">lucre sem fronteiras</span>
            </h2>
            <p className="text-[14px] xl:text-[15px] text-muted-foreground/50 leading-[1.8] max-w-[480px] mb-8">
              Checkout otimizado, área de membros estilo Netflix, anti-fraude integrado 
              e as menores taxas do mercado. Tudo em uma única plataforma.
            </p>
          </motion.div>

          {/* Dashboard preview image */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-8"
          >
            <div className="rounded-2xl overflow-hidden ring-1 ring-border/20 shadow-2xl shadow-primary/10">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-card/90 border-b border-border/15">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 mx-3">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-muted/10 ring-1 ring-border/10 max-w-[280px]">
                    <Lock className="h-2.5 w-2.5 text-success/50" />
                    <span className="text-[9px] text-muted-foreground/40 font-mono">app.hotzfy.com/dashboard</span>
                  </div>
                </div>
              </div>
              <img
                src={authDashboardPreview}
                alt="Dashboard HOTZFY - Painel de controle"
                className="w-full h-auto"
                width={1280}
                height={960}
              />
            </div>

            {/* Floating sale notifications */}
            <div className="absolute -right-4 top-[15%] w-[240px]">
              <FloatingNotification name="Maria S." amount="R$ 497,00" delay={0.8} />
            </div>
            <div className="absolute -left-4 bottom-[25%] w-[240px]">
              <FloatingNotification name="Pedro L." amount="R$ 1.297,00" delay={1.4} />
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="grid grid-cols-4 gap-3 mb-8"
          >
            {[
              { value: 10000, suffix: "+", label: "Produtores ativos", icon: Users },
              { value: 50, suffix: "M+", label: "Processados", icon: TrendingUp },
              { value: 99, suffix: ".9%", label: "Uptime garantido", icon: Activity },
              { value: 150, suffix: "+", label: "Integrações", icon: Globe },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-3 rounded-xl bg-card/30 ring-1 ring-border/10 backdrop-blur-sm hover:ring-primary/15 transition-all group">
                <stat.icon className="h-4 w-4 text-primary/40 mx-auto mb-2 group-hover:text-primary/60 transition-colors" />
                <p className="text-[18px] xl:text-[20px] font-display font-black text-foreground tabular-nums leading-none">
                  <AnimCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-[8px] text-muted-foreground/35 font-bold uppercase tracking-wider mt-1.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Features grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="grid grid-cols-2 gap-2.5 mb-8"
          >
            {[
              { icon: CreditCard, title: "Checkout de Alta Conversão", desc: "PIX, Cartão e Boleto com 1-click" },
              { icon: GraduationCap, title: "Área de Membros Netflix", desc: "Entregue cursos e conteúdos premium" },
              { icon: BarChart2, title: "Analytics em Tempo Real", desc: "Métricas completas das suas vendas" },
              { icon: Shield, title: "Anti-fraude Integrado", desc: "Blacklist e velocity check" },
              { icon: QrCode, title: "PIX Instantâneo", desc: "Receba em segundos no PIX" },
              { icon: BadgeCheck, title: "Afiliados & Coprodução", desc: "Escale com parceiros e afiliados" },
            ].map((f) => (
              <div key={f.title}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-card/20 ring-1 ring-border/8 hover:ring-primary/15 hover:bg-card/30 transition-all group cursor-default">
                <div className="h-9 w-9 rounded-lg bg-primary/8 ring-1 ring-primary/12 flex items-center justify-center shrink-0 group-hover:bg-primary/12 transition-colors">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-foreground tracking-[-0.01em] leading-tight">{f.title}</p>
                  <p className="text-[9px] text-muted-foreground/35 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Testimonials */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.5 }}
            className="grid grid-cols-2 gap-3"
          >
            {[
              { name: "Rafael S.", role: "Infoprodutor", revenue: "R$120K/mês", quote: "Migrei e minhas vendas triplicaram no primeiro mês." },
              { name: "Amanda C.", role: "Mentora", revenue: "R$85K/mês", quote: "Melhor checkout do mercado. Conversão disparou!" },
            ].map((t) => (
              <div key={t.name} className="p-4 rounded-xl bg-card/20 ring-1 ring-border/8 hover:ring-border/15 transition-all">
                <div className="flex items-center gap-0.5 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-2.5 w-2.5 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/45 leading-[1.7] italic mb-3">"{t.quote}"</p>
                <div className="flex items-center gap-2.5 pt-2.5 border-t border-border/6">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/10">
                    <span className="text-[8px] font-bold text-primary">{t.name.split(" ").map(n => n[0]).join("")}</span>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-foreground">{t.name}</p>
                    <p className="text-[7px] text-muted-foreground/30">{t.role} · {t.revenue}</p>
                  </div>
                  <div className="ml-auto">
                    <BadgeCheck className="h-3.5 w-3.5 text-primary/30" />
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Bottom status */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3, duration: 0.5 }}
            className="mt-6 flex items-center gap-2 px-3 py-2 rounded-xl bg-card/15 ring-1 ring-border/6"
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute h-full w-full rounded-full bg-success opacity-60" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            <p className="text-[9px] text-muted-foreground/35 font-medium truncate">Sistemas 100% operacionais — checkout, saques e área de membros funcionando</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
