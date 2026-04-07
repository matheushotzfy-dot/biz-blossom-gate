/**
 * Auth — Enterprise Fintech Auth v10
 * @module Auth
 * @version 10.0.0 — Cinematic Premium
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Rocket, Eye, EyeOff, Shield, GraduationCap, BarChart2, CreditCard,
  Users, TrendingUp, CheckCircle2, ArrowRight, Sparkles, Lock,
  Star, Crown, Activity, Fingerprint, ChevronRight, Gem,
  Zap, Globe, Award, Play, Mail, Phone, User, FileText,
  Heart, Target, Layers, MousePointerClick,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

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

/* ─────────────────── Password strength ─────────────────── */
function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++; if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++; if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++; if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score: 1, label: "Fraca", color: "bg-destructive", text: "text-destructive" };
  if (score <= 4) return { score: 2, label: "Média", color: "bg-warning", text: "text-warning" };
  return { score: 3, label: "Forte", color: "bg-success", text: "text-success" };
}

/* ═══════════════════ SIGNUP STEPS ═══════════════════ */
const SIGNUP_STEPS = [
  { id: 1, label: "Dados Pessoais", icon: User },
  { id: 2, label: "Contato", icon: Mail },
  { id: 3, label: "Segurança", icon: Lock },
  { id: 4, label: "Finalizar", icon: CheckCircle2 },
];

/* ═══════════════════ MAIN AUTH COMPONENT ═══════════════════ */
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

  // Reset step when switching modes
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

  const inputCls = "h-12 rounded-2xl border-border/20 bg-muted/5 text-foreground placeholder:text-muted-foreground/25 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 focus:bg-muted/8 transition-all duration-300 font-display text-[13px] shadow-sm";
  const labelCls = "text-[10px] font-bold text-foreground/50 uppercase tracking-[0.15em] mb-2 flex items-center gap-1.5 font-display";

  return (
    <div className="min-h-screen flex bg-background text-foreground overflow-hidden">

      {/* ═══ LEFT: Form Panel ═══ */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden">
        {/* Ambient */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
          <motion.div animate={{ y: [0, -40, 0], x: [0, 20, 0], scale: [1, 1.15, 1] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-[25%] -top-[25%] h-[800px] w-[800px] rounded-full bg-primary/[0.04] blur-[250px]" />
          <motion.div animate={{ y: [0, 30, 0], x: [0, -15, 0], scale: [1, 1.2, 1] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 4 }}
            className="absolute -right-[20%] bottom-[-25%] h-[700px] w-[700px] rounded-full bg-info/[0.03] blur-[220px]" />
          <div className="absolute inset-0 opacity-[0.008]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        </div>

        {/* ── Navbar ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ease }}
          className="sticky top-0 z-20 flex items-center justify-between px-5 md:px-8 h-16 backdrop-blur-2xl bg-background/60 border-b border-border/5">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: 8, scale: 1.05 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-primary/10">
              <Rocket className="h-4.5 w-4.5 text-primary-foreground" />
            </motion.div>
            <div>
              <span className="text-[15px] font-display font-black tracking-[-0.04em] text-foreground">HOTZFY</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-success animate-pulse" />
                <span className="text-[8px] text-muted-foreground/30 font-bold tracking-[0.15em] uppercase font-display">Plataforma de Infoprodutos</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/5 border border-success/10">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            <span className="text-[8px] font-bold text-success uppercase tracking-[0.15em] font-display">Online</span>
          </div>
        </motion.div>

        {/* ── Form Content ── */}
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 pb-12 md:px-8">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="w-full max-w-[460px] relative z-10">

            {/* ── Header ── */}
            <div className="mb-8">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 20 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/6 border border-primary/10 text-[9px] font-bold text-primary uppercase tracking-[0.12em] mb-5 font-display">
                <Gem className="h-3 w-3" />
                {isLogin ? "Acesse sua conta" : `Etapa ${step} de 4`}
              </motion.div>

              <AnimatePresence mode="wait">
                <motion.div key={isLogin ? "login-header" : `signup-header-${step}`}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease }}>
                  <h1 className="text-[28px] sm:text-[32px] font-display font-black tracking-[-0.045em] text-foreground leading-[1.1]">
                    {isLogin ? (
                      <>Bem-vindo de <span className="text-gradient">volta</span></>
                    ) : step === 1 ? (
                      <>Vamos começar com seus <span className="text-gradient">dados</span></>
                    ) : step === 2 ? (
                      <>Como podemos te <span className="text-gradient">contatar</span>?</>
                    ) : step === 3 ? (
                      <>Proteja sua <span className="text-gradient">conta</span></>
                    ) : (
                      <>Tudo pronto para <span className="text-gradient">começar</span>!</>
                    )}
                  </h1>
                  <p className="text-[13px] text-muted-foreground/50 mt-2 font-display leading-relaxed">
                    {isLogin ? "Entre no seu painel e acompanhe seus resultados" :
                     step === 1 ? "Preencha seus dados pessoais para criar sua conta" :
                     step === 2 ? "Precisamos do seu contato e documento para verificação" :
                     step === 3 ? "Crie uma senha forte e nos diga como nos encontrou" :
                     "Revise seus dados e crie sua conta"}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Stepper (signup only) ── */}
            {!isLogin && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ease }}
                className="mb-7">
                <div className="flex items-center gap-1">
                  {SIGNUP_STEPS.map((s, idx) => {
                    const StepIcon = s.icon;
                    const isActive = step === s.id;
                    const isDone = step > s.id;
                    return (
                      <div key={s.id} className="flex items-center flex-1">
                        <motion.div
                          animate={{ scale: isActive ? 1 : 0.9 }}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-300 cursor-default",
                            isActive ? "bg-primary/10 ring-1 ring-primary/20" :
                            isDone ? "bg-success/8 ring-1 ring-success/15" : "bg-muted/5 ring-1 ring-border/8"
                          )}>
                          <div className={cn(
                            "h-6 w-6 rounded-lg flex items-center justify-center shrink-0 transition-all",
                            isActive ? "bg-primary/15 text-primary" :
                            isDone ? "bg-success/15 text-success" : "bg-muted/10 text-muted-foreground/20"
                          )}>
                            {isDone ? <CheckCircle2 className="h-3 w-3" /> : <StepIcon className="h-3 w-3" />}
                          </div>
                          <span className={cn(
                            "text-[8px] font-display font-bold uppercase tracking-[0.1em] hidden sm:block",
                            isActive ? "text-primary" : isDone ? "text-success/60" : "text-muted-foreground/20"
                          )}>{s.label}</span>
                        </motion.div>
                        {idx < SIGNUP_STEPS.length - 1 && (
                          <div className={cn("h-px flex-1 mx-1 transition-colors", isDone ? "bg-success/20" : "bg-border/8")} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-1 rounded-full bg-muted/8 overflow-hidden">
                  <motion.div animate={{ width: `${(step / 4) * 100}%` }} transition={{ duration: 0.5, ease }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ boxShadow: "0 0 12px hsl(var(--primary) / 0.3)" }} />
                </div>
              </motion.div>
            )}

            {/* ── Card ── */}
            <div className="relative">
              <div className="absolute -inset-px rounded-[28px] bg-gradient-to-br from-primary/15 via-border/10 to-info/10 opacity-50" />
              <div className="relative rounded-[27px] border border-border/10 bg-card/60 backdrop-blur-2xl shadow-[0_20px_60px_hsl(var(--foreground)/0.06)] overflow-hidden">
                <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                <div className="p-6 md:p-8">

                  {/* Mode toggle (Login/Signup) */}
                  <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/6 border border-border/6 mb-6">
                    {[
                      { mode: true, label: "Entrar", icon: Lock },
                      { mode: false, label: "Criar Conta", icon: Sparkles },
                    ].map(tab => (
                      <motion.button key={tab.label} onClick={() => setIsLogin(tab.mode)} whileTap={{ scale: 0.97 }}
                        className={cn(
                          "flex-1 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold uppercase tracking-[0.08em] transition-all duration-300 flex items-center justify-center gap-2",
                          isLogin === tab.mode
                            ? "bg-primary/10 text-primary shadow-md border border-primary/15"
                            : "text-muted-foreground/25 hover:text-muted-foreground/40"
                        )}>
                        <tab.icon className="h-3.5 w-3.5" />{tab.label}
                      </motion.button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div key={isLogin ? "login" : `signup-${step}`}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.25, ease }}>

                      {isLogin ? (
                        /* ═══ LOGIN FORM ═══ */
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <Label htmlFor="email" className={labelCls}><Mail className="h-3 w-3 text-primary/40" />E-mail</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                              placeholder="seu@email.com" className={inputCls} required />
                          </div>
                          <div>
                            <Label htmlFor="password" className={labelCls}><Lock className="h-3 w-3 text-primary/40" />Senha</Label>
                            <div className="relative">
                              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••" className={cn(inputCls, "pr-12")} required minLength={8} />
                              <button type="button" onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/15 hover:text-foreground/40 transition-colors">
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="pt-1">
                            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }}>
                              <Button type="submit" disabled={loading}
                                className="w-full gradient-primary text-primary-foreground font-display font-bold h-[52px] rounded-2xl text-[13px] shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all gap-2 relative overflow-hidden">
                                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent" />
                                </div>
                                <span className="relative z-[1] flex items-center gap-2">
                                  {loading ? <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                    : <>Entrar na plataforma <ArrowRight className="h-4 w-4" /></>}
                                </span>
                              </Button>
                            </motion.div>
                          </div>
                        </form>
                      ) : (
                        /* ═══ SIGNUP STEPS ═══ */
                        <div className="space-y-4">
                          {step === 1 && (
                            <>
                              <div>
                                <Label htmlFor="name" className={labelCls}><User className="h-3 w-3 text-primary/40" />Nome completo</Label>
                                <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)}
                                  placeholder="Seu nome completo" className={inputCls} required />
                              </div>
                              <div>
                                <Label htmlFor="nickname" className={labelCls}><Heart className="h-3 w-3 text-primary/40" />Como quer ser chamado?</Label>
                                <Input id="nickname" value={nickname} onChange={e => setNickname(e.target.value)}
                                  placeholder="Ex: João, Mari..." className={inputCls} required />
                              </div>
                            </>
                          )}

                          {step === 2 && (
                            <>
                              <div>
                                <Label htmlFor="email" className={labelCls}><Mail className="h-3 w-3 text-info/50" />E-mail</Label>
                                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                                  placeholder="seu@email.com" className={inputCls} required />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor="document" className={labelCls}><FileText className="h-3 w-3 text-info/50" />CPF ou CNPJ</Label>
                                  <Input id="document" value={document} onChange={e => handleDocumentChange(e.target.value)}
                                    placeholder="000.000.000-00" inputMode="numeric" autoComplete="off"
                                    className={cn(inputCls, documentError && "border-destructive/40 ring-1 ring-destructive/15")} required />
                                  {documentError && (
                                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                      className="text-[9px] text-destructive mt-1.5 font-medium font-display flex items-center gap-1">
                                      <span className="h-1 w-1 rounded-full bg-destructive" />{documentError}
                                    </motion.p>
                                  )}
                                </div>
                                <div>
                                  <Label htmlFor="phone" className={labelCls}><Phone className="h-3 w-3 text-info/50" />WhatsApp</Label>
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
                                <Label htmlFor="password" className={labelCls}><Lock className="h-3 w-3 text-warning/50" />Senha</Label>
                                <div className="relative">
                                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                                    placeholder="Mínimo 8 caracteres" className={cn(inputCls, "pr-12")} required minLength={8} />
                                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/15 hover:text-foreground/40 transition-colors">
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                                {password.length > 0 && (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2.5 space-y-1.5">
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex-1 flex gap-1">
                                        {[1,2,3].map(i => (
                                          <motion.div key={i} initial={{ scaleX: 0 }}
                                            animate={{ scaleX: i <= pwStrength.score ? 1 : 0.3, opacity: i <= pwStrength.score ? 1 : 0.3 }}
                                            transition={{ duration: 0.5, ease }}
                                            className={cn("h-1.5 flex-1 rounded-full origin-left", i <= pwStrength.score ? pwStrength.color : "bg-muted/10")} />
                                        ))}
                                      </div>
                                      <span className={cn("text-[9px] font-bold uppercase tracking-wider font-display", pwStrength.text)}>{pwStrength.label}</span>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground/20 font-display">Maiúscula, minúscula, número. Mín. 8 caracteres.</p>
                                  </motion.div>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="confirmPassword" className={labelCls}><Shield className="h-3 w-3 text-warning/50" />Confirmar Senha</Label>
                                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                  placeholder="••••••••" className={cn(inputCls, confirmPassword && password !== confirmPassword && "border-destructive/40 ring-1 ring-destructive/15")} required minLength={8} />
                                {confirmPassword && password !== confirmPassword && (
                                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                    className="text-[9px] text-destructive mt-1.5 font-medium font-display flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-destructive" />As senhas não coincidem
                                  </motion.p>
                                )}
                              </div>
                              <div>
                                <Label className={labelCls}><Target className="h-3 w-3 text-warning/50" />Onde conheceu a HOTZFY?</Label>
                                <Select value={referralSource} onValueChange={setReferralSource}>
                                  <SelectTrigger className={cn(inputCls, "mt-0")}><SelectValue placeholder="Selecione uma opção..." /></SelectTrigger>
                                  <SelectContent className="rounded-2xl border-border/15 bg-popover/95 backdrop-blur-2xl">
                                    {[
                                      { value: "instagram", label: "Instagram" },
                                      { value: "indicacao", label: "Indicação de amigo" },
                                      { value: "youtube", label: "YouTube" },
                                      { value: "pesquisa", label: "Pesquisa (Google)" },
                                      { value: "tiktok", label: "TikTok" },
                                      { value: "outro", label: "Outro" },
                                    ].map(v => (
                                      <SelectItem key={v.value} value={v.value} className="rounded-xl">{v.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}

                          {step === 4 && (
                            <div className="space-y-3">
                              <div className="rounded-2xl bg-primary/5 ring-1 ring-primary/10 p-4 space-y-2.5">
                                <p className="text-[10px] font-display font-black text-primary uppercase tracking-[0.15em]">Resumo do Cadastro</p>
                                {[
                                  { label: "Nome", value: fullName },
                                  { label: "Apelido", value: nickname },
                                  { label: "E-mail", value: email },
                                  { label: "Documento", value: document },
                                  { label: "WhatsApp", value: phone },
                                ].map(item => (
                                  <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-primary/5 last:border-0">
                                    <span className="text-[10px] text-muted-foreground/40 font-display font-bold">{item.label}</span>
                                    <span className="text-[11px] text-foreground/70 font-medium font-display">{item.value || "—"}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 p-3 rounded-xl bg-success/5 ring-1 ring-success/10">
                                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                                <p className="text-[10px] text-success/70 font-medium font-display">Todos os dados preenchidos. Pronto para criar sua conta!</p>
                              </div>
                            </div>
                          )}

                          {/* Navigation buttons */}
                          <div className="flex gap-3 pt-2">
                            {step > 1 && (
                              <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}
                                className="flex-1 h-[48px] rounded-2xl font-display font-bold text-[12px] border-border/15 hover:bg-muted/8">
                                Voltar
                              </Button>
                            )}
                            {step < 4 ? (
                              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} className="flex-1">
                                <Button type="button" onClick={() => setStep(s => s + 1)} disabled={!canAdvanceStep(step)}
                                  className="w-full gradient-primary text-primary-foreground font-display font-bold h-[48px] rounded-2xl text-[12px] shadow-lg shadow-primary/15 gap-2 relative overflow-hidden">
                                  Próximo <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              </motion.div>
                            ) : (
                              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} className="flex-1">
                                <Button type="button" onClick={() => handleSubmit()} disabled={loading}
                                  className="w-full gradient-primary text-primary-foreground font-display font-bold h-[52px] rounded-2xl text-[13px] shadow-xl shadow-primary/20 gap-2 relative overflow-hidden">
                                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent" />
                                  </div>
                                  <span className="relative z-[1] flex items-center gap-2">
                                    {loading ? <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                      : <>Criar conta grátis <Sparkles className="h-4 w-4" /></>}
                                  </span>
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Divider + switch */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/6" /></div>
                    <div className="relative flex justify-center">
                      <span className="bg-card/70 backdrop-blur-sm px-4 text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/15 font-display">
                        {isLogin ? "ou crie uma conta" : "já possui conta?"}
                      </span>
                    </div>
                  </div>

                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => setIsLogin(!isLogin)}
                    className="w-full h-11 rounded-2xl border border-border/10 text-[12px] font-bold font-display text-muted-foreground/35 hover:text-foreground/60 hover:border-border/20 hover:bg-muted/6 transition-all duration-300">
                    {isLogin ? "Criar conta grátis" : "Entrar na minha conta"}
                  </motion.button>

                  {/* Trust badges (login) */}
                  {isLogin && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                      className="mt-6 flex items-center justify-center gap-5 pt-5 border-t border-border/5">
                      {[{ icon: Shield, label: "SSL 256-bit" }, { icon: Fingerprint, label: "Anti-fraude" }, { icon: Lock, label: "Criptografado" }, { icon: CheckCircle2, label: "LGPD" }].map((b, i) => (
                        <motion.div key={b.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.06 }}
                          className="flex items-center gap-1 text-muted-foreground/12 hover:text-muted-foreground/25 transition-colors cursor-default group">
                          <b.icon className="h-3 w-3 group-hover:text-primary/30 transition-colors" /><span className="text-[7px] font-bold uppercase tracking-[0.12em] font-display">{b.label}</span>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  <p className="text-center text-[9px] text-muted-foreground/15 leading-relaxed mt-4 font-display">
                    Ao continuar, você concorda com os{" "}
                    <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/30 transition-colors">Termos de Uso</a> e{" "}
                    <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/30 transition-colors">Política de Privacidade</a>.
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile social proof */}
            <div className="lg:hidden mt-6 grid grid-cols-3 gap-2">
              {[{ value: "10K+", label: "Produtores", icon: Users }, { value: "R$50M+", label: "Processados", icon: TrendingUp }, { value: "99.9%", label: "Uptime", icon: Activity }].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.06 }}
                  className="text-center p-3 rounded-2xl bg-card/25 backdrop-blur-sm border border-border/8">
                  <s.icon className="h-3.5 w-3.5 text-primary/30 mx-auto mb-1.5" />
                  <p className="text-[14px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">{s.value}</p>
                  <p className="text-[7px] text-muted-foreground/30 font-bold uppercase tracking-[0.12em] font-display mt-0.5">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ RIGHT: Features Panel (Desktop) ═══ */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden border-l border-border/5">
        {/* Ambient bg */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div animate={{ y: [0, -40, 0], scale: [1, 1.15, 1] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-[20%] -top-[20%] h-[700px] w-[700px] rounded-full bg-primary/[0.05] blur-[200px]" />
          <motion.div animate={{ y: [0, 30, 0], x: [0, -20, 0] }} transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 5 }}
            className="absolute -right-[15%] bottom-[-20%] h-[600px] w-[600px] rounded-full bg-info/[0.04] blur-[180px]" />
          <div className="absolute inset-0 opacity-[0.008]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        </div>

        <div className="flex-1 flex items-center justify-center p-10 xl:p-14">
          <div className="max-w-[380px] relative z-10">
            {/* Badge */}
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 180, damping: 18 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/6 border border-primary/10 text-primary text-[9px] font-bold mb-8 tracking-[0.12em] uppercase font-display">
              <Crown className="h-3.5 w-3.5" />Plataforma Completa
            </motion.div>

            {/* Hero */}
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7 }}
              className="text-[2.2rem] xl:text-[2.6rem] font-display font-black mb-4 text-foreground leading-[1.04] tracking-[-0.05em]">
              Tudo para <span className="text-gradient">vender</span> online
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
              className="text-[13px] text-muted-foreground/40 mb-8 leading-[1.8] max-w-[340px] font-display">
              Checkout otimizado, área de membros, pagamentos e ferramentas avançadas para escalar seu negócio digital.
            </motion.p>

            {/* Features */}
            <div className="space-y-2.5">
              {[
                { icon: CreditCard, title: "Checkout de Alta Conversão", desc: "PIX, Cartão e Boleto com 1-click", tone: "primary" },
                { icon: GraduationCap, title: "Área de Membros Netflix", desc: "Entregue cursos e conteúdos premium", tone: "info" },
                { icon: BarChart2, title: "Analytics em Tempo Real", desc: "Métricas completas das suas vendas", tone: "warning" },
                { icon: Shield, title: "Anti-fraude Integrado", desc: "Blacklist, velocity check e proteção", tone: "success" },
              ].map((f, i) => {
                const toneMap: Record<string, string> = { primary: "bg-primary/8 text-primary border-l-primary/30", info: "bg-info/8 text-info border-l-info/30", warning: "bg-warning/8 text-warning border-l-warning/30", success: "bg-success/8 text-success border-l-success/30" };
                const iconBg: Record<string, string> = { primary: "bg-primary/10 text-primary", info: "bg-info/10 text-info", warning: "bg-warning/10 text-warning", success: "bg-success/10 text-success" };
                return (
                  <motion.div key={f.title} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1, ease }}
                    whileHover={{ x: 4, scale: 1.01 }}
                    className={cn("flex items-center gap-3.5 p-4 rounded-2xl border-l-[3px] bg-card/20 backdrop-blur-xl border border-border/8 hover:bg-card/35 hover:border-border/18 transition-all duration-300 cursor-default group", `border-l-${f.tone}/30`)}>
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", iconBg[f.tone])}>
                      <f.icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-display font-bold text-foreground tracking-[-0.02em]">{f.title}</p>
                      <p className="text-[10px] text-muted-foreground/35 mt-0.5">{f.desc}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/5 group-hover:text-muted-foreground/25 group-hover:translate-x-1 transition-all shrink-0" />
                  </motion.div>
                );
              })}
            </div>

            {/* Stats */}
            <div className="mt-7 grid grid-cols-3 gap-2.5">
              {[{ value: "10K+", label: "Produtores", icon: Users }, { value: "R$50M+", label: "Processados", icon: TrendingUp }, { value: "99.9%", label: "Uptime", icon: Activity }].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 + i * 0.08 }}
                  whileHover={{ y: -2, scale: 1.02 }}
                  className="text-center p-3.5 rounded-2xl bg-card/15 backdrop-blur-xl border border-border/8 hover:border-primary/12 hover:bg-card/25 transition-all duration-300 cursor-default group">
                  <s.icon className="h-3.5 w-3.5 text-primary/30 mx-auto mb-1.5 group-hover:text-primary/50 transition-colors" />
                  <p className="text-[16px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">{s.value}</p>
                  <p className="text-[7px] text-muted-foreground/25 font-bold uppercase tracking-[0.15em] font-display mt-0.5">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Testimonial */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}
              className="mt-5 p-5 rounded-2xl bg-card/15 backdrop-blur-xl border border-border/6 hover:border-border/15 transition-all duration-300 group">
              <div className="flex items-center gap-1 mb-2.5">
                {[...Array(5)].map((_, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.5 + i * 0.05 }}>
                    <Star className="h-3 w-3 fill-warning text-warning" />
                  </motion.div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/40 leading-[1.8] italic font-display">
                "Migrei de outra plataforma e minhas vendas triplicaram no primeiro mês. A melhor decisão!"
              </p>
              <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-border/5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/12 to-info/8 flex items-center justify-center ring-1 ring-primary/8">
                  <span className="text-[9px] font-bold text-primary font-display">RS</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-foreground font-display">Rafael S.</p>
                  <p className="text-[8px] text-muted-foreground/25 font-display">Infoprodutor · R$120K/mês</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success/30" />
                  <span className="text-[7px] text-success/30 font-bold uppercase tracking-wider font-display">Verificado</span>
                </div>
              </div>
            </motion.div>

            {/* Status */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}
              className="mt-4 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-card/15 border border-border/6">
              <div className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
              </div>
              <p className="text-[9px] text-muted-foreground/35 font-medium font-display truncate">Sistemas online — checkout e saques funcionando</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
