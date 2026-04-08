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
  Activity, Mail, Phone, User, FileText,
  Heart, Target, Zap, Globe, BadgeCheck, QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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

/* ─── Falling notification ─── */
const SALE_NAMES = ["Lucas M.", "Carla F.", "Thiago B.", "Juliana R.", "Felipe S.", "Amanda L.", "Bruno C.", "Isabela T.", "Marcos P.", "Fernanda A."];
const SALE_AMOUNTS = [97, 197, 297, 497, 697, 997, 1297, 1497, 47, 147];

function NotificationFeed() {
  const [notifications, setNotifications] = useState<{id: number; name: string; amount: number; time: string}[]>([]);
  const counterRef = useRef(0);
  const TIMES = ["agora", "1min", "2min", "3min", "5min"];

  useEffect(() => {
    const spawn = () => {
      counterRef.current++;
      const id = counterRef.current;
      setNotifications(prev => [
        { id, name: SALE_NAMES[id % SALE_NAMES.length], amount: SALE_AMOUNTS[id % SALE_AMOUNTS.length], time: TIMES[id % TIMES.length] },
        ...prev,
      ].slice(0, 3));
    };
    spawn();
    const interval = setInterval(spawn, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, x: 30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.9 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[hsl(160_15%_10%)] border border-[hsl(160_20%_16%)]"
          >
            <div className="h-8 w-8 rounded-lg bg-[hsl(160_60%_40%/0.12)] flex items-center justify-center shrink-0">
              <Zap className="h-3.5 w-3.5 text-[hsl(160_60%_50%)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[hsl(160_30%_75%)]">Venda aprovada</p>
              <p className="text-[9px] text-[hsl(160_15%_45%)]">{n.name} · <span className="font-bold text-[hsl(160_60%_50%)]">R$ {n.amount},00</span></p>
            </div>
            <span className="text-[8px] text-[hsl(160_10%_30%)] font-medium shrink-0">{n.time}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
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

  const inputCls = "h-12 rounded-xl border-[hsl(160_15%_20%)] bg-[hsl(180_10%_8%)] text-foreground placeholder:text-[hsl(160_10%_30%)] focus:border-[hsl(160_60%_40%)] focus:ring-1 focus:ring-[hsl(160_60%_40%/0.2)] transition-all text-[13px] font-medium";
  const labelCls = "text-[10px] font-bold text-[hsl(160_15%_45%)] uppercase tracking-[0.12em] mb-1.5 flex items-center gap-1.5";

  return (
    <div className="min-h-screen flex bg-[hsl(200_15%_5%)] text-foreground">

      {/* ═══ LEFT: Form Panel ═══ */}
      <div className="flex-1 relative overflow-y-auto">
        {/* ── Navbar ── */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 md:px-8 h-14 bg-[hsl(200_15%_5%/0.9)] backdrop-blur-xl border-b border-[hsl(160_10%_15%)]">
          <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="h-9 w-9 rounded-xl bg-[hsl(160_60%_40%)] flex items-center justify-center">
              <Rocket className="h-4 w-4 text-[hsl(200_15%_5%)]" />
            </div>
            <div>
              <span className="text-[14px] font-display font-black tracking-[-0.03em] text-foreground">HOTZFY</span>
              <div className="flex items-center gap-1">
                <div className="h-1 w-1 rounded-full bg-[hsl(160_60%_50%)]" />
                <span className="text-[8px] text-[hsl(160_15%_35%)] font-semibold tracking-wider uppercase">Plataforma de Infoprodutos</span>
              </div>
            </div>
          </a>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(160_60%_40%/0.08)] ring-1 ring-[hsl(160_60%_40%/0.15)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-[hsl(160_60%_50%)] opacity-60" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-[hsl(160_60%_50%)]" />
            </span>
            <span className="text-[8px] font-bold text-[hsl(160_60%_50%/0.8)] uppercase tracking-wider">Online</span>
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
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(160_60%_40%/0.08)] ring-1 ring-[hsl(160_60%_40%/0.12)] text-[9px] font-bold text-[hsl(160_60%_55%)] uppercase tracking-wider mb-4">
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
                      <>Bem-vindo de <span className="text-[hsl(160_60%_50%)]">volta</span></>
                    ) : step === 1 ? (
                      <>Seus <span className="text-[hsl(160_60%_50%)]">dados</span> pessoais</>
                    ) : step === 2 ? (
                      <>Contato e <span className="text-[hsl(160_60%_50%)]">documento</span></>
                    ) : step === 3 ? (
                      <>Proteja sua <span className="text-[hsl(160_60%_50%)]">conta</span></>
                    ) : (
                      <>Confirme e <span className="text-[hsl(160_60%_50%)]">comece</span></>
                    )}
                  </h1>
                  <p className="text-[12px] text-[hsl(160_10%_40%)] mt-1.5 leading-relaxed">
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
                          isActive ? "bg-[hsl(160_60%_40%/0.1)] ring-1 ring-[hsl(160_60%_40%/0.2)]" :
                          isDone ? "bg-[hsl(160_60%_40%/0.06)] ring-1 ring-[hsl(160_60%_40%/0.1)]" : "bg-[hsl(160_10%_10%)] ring-1 ring-[hsl(160_10%_15%)]"
                        )}>
                          <div className={cn(
                            "h-5 w-5 rounded-md flex items-center justify-center shrink-0",
                            isActive ? "bg-[hsl(160_60%_40%/0.15)] text-[hsl(160_60%_55%)]" :
                            isDone ? "bg-[hsl(160_60%_40%/0.1)] text-[hsl(160_60%_45%)]" : "bg-[hsl(160_10%_12%)] text-[hsl(160_10%_25%)]"
                          )}>
                            {isDone ? <CheckCircle2 className="h-3 w-3" /> : <StepIcon className="h-3 w-3" />}
                          </div>
                          <span className={cn(
                            "text-[8px] font-bold uppercase tracking-wider hidden sm:block",
                            isActive ? "text-[hsl(160_60%_55%)]" : isDone ? "text-[hsl(160_40%_40%)]" : "text-[hsl(160_10%_25%)]"
                          )}>{s.label}</span>
                        </div>
                        {idx < SIGNUP_STEPS.length - 1 && (
                          <div className={cn("h-px flex-1 mx-1", isDone ? "bg-[hsl(160_60%_40%/0.2)]" : "bg-[hsl(160_10%_12%)]")} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2.5 h-1 rounded-full bg-[hsl(160_10%_10%)] overflow-hidden">
                  <motion.div
                    animate={{ width: `${(step / 4) * 100}%` }}
                    transition={{ duration: 0.4 }}
                    className="h-full rounded-full bg-[hsl(160_60%_40%)]"
                  />
                </div>
              </div>
            )}

            {/* ── Card ── */}
            <div className="rounded-2xl border border-[hsl(160_10%_14%)] bg-[hsl(200_12%_7%)] shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
              <div className="p-6 md:p-7">
                {/* Mode toggle */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[hsl(180_8%_8%)] ring-1 ring-[hsl(160_10%_14%)] mb-5">
                  {[
                    { mode: true, label: "ENTRAR", icon: Lock },
                    { mode: false, label: "CRIAR CONTA", icon: User },
                  ].map(tab => (
                    <button key={tab.label} onClick={() => setIsLogin(tab.mode)}
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                        isLogin === tab.mode
                          ? "bg-[hsl(160_60%_40%)] text-[hsl(200_15%_5%)] shadow-sm"
                          : "text-[hsl(160_10%_35%)] hover:text-[hsl(160_15%_50%)]"
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
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="email" className={labelCls}><Mail className="h-3 w-3 text-[hsl(160_50%_40%)]" />E-mail</Label>
                          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="seu@email.com" className={inputCls} required />
                        </div>
                        <div>
                          <Label htmlFor="password" className={labelCls}><Lock className="h-3 w-3 text-[hsl(160_50%_40%)]" />Senha</Label>
                          <div className="relative">
                            <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                              placeholder="••••••••" className={cn(inputCls, "pr-12")} required minLength={8} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(160_10%_30%)] hover:text-[hsl(160_20%_50%)] transition-colors">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="pt-1">
                          <Button type="submit" disabled={loading}
                            className="w-full h-12 rounded-xl text-[13px] font-bold gap-2 bg-gradient-to-r from-[hsl(160_60%_40%)] to-[hsl(175_60%_38%)] text-[hsl(200_15%_5%)] hover:brightness-110 shadow-[0_8px_24px_rgba(16,185,129,0.25)] transition-all">
                            {loading ? (
                              <div className="h-5 w-5 border-2 border-[hsl(200_15%_5%/0.3)] border-t-[hsl(200_15%_5%)] rounded-full animate-spin" />
                            ) : (
                              <>Entrar na plataforma <ArrowRight className="h-4 w-4" /></>
                            )}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        {step === 1 && (
                          <>
                            <div>
                              <Label htmlFor="name" className={labelCls}><User className="h-3 w-3 text-[hsl(160_50%_40%)]" />Nome completo</Label>
                              <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)}
                                placeholder="Seu nome completo" className={inputCls} required />
                            </div>
                            <div>
                              <Label htmlFor="nickname" className={labelCls}><Heart className="h-3 w-3 text-[hsl(160_50%_40%)]" />Como quer ser chamado?</Label>
                              <Input id="nickname" value={nickname} onChange={e => setNickname(e.target.value)}
                                placeholder="Ex: João, Mari..." className={inputCls} required />
                            </div>
                          </>
                        )}

                        {step === 2 && (
                          <>
                            <div>
                              <Label htmlFor="email" className={labelCls}><Mail className="h-3 w-3 text-[hsl(160_50%_40%)]" />E-mail</Label>
                              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="seu@email.com" className={inputCls} required />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="document" className={labelCls}><FileText className="h-3 w-3 text-[hsl(160_50%_40%)]" />CPF ou CNPJ</Label>
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
                                <Label htmlFor="phone" className={labelCls}><Phone className="h-3 w-3 text-[hsl(160_50%_40%)]" />WhatsApp</Label>
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
                              <Label htmlFor="password" className={labelCls}><Lock className="h-3 w-3 text-[hsl(160_50%_40%)]" />Senha</Label>
                              <div className="relative">
                                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                                  placeholder="Mínimo 8 caracteres" className={cn(inputCls, "pr-12")} required minLength={8} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(160_10%_30%)] hover:text-[hsl(160_20%_50%)] transition-colors">
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              {password.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 flex gap-1">
                                      {[1,2,3].map(i => (
                                        <div key={i} className={cn("h-1 flex-1 rounded-full transition-all", i <= pwStrength.score ? pwStrength.color : "bg-[hsl(160_10%_12%)]")} />
                                      ))}
                                    </div>
                                    <span className={cn("text-[9px] font-bold uppercase tracking-wider", pwStrength.text)}>{pwStrength.label}</span>
                                  </div>
                                  <p className="text-[9px] text-[hsl(160_10%_30%)]">Maiúscula, minúscula, número. Mín. 8 caracteres.</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <Label htmlFor="confirmPassword" className={labelCls}><Shield className="h-3 w-3 text-[hsl(160_50%_40%)]" />Confirmar Senha</Label>
                              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="••••••••" className={cn(inputCls, confirmPassword && password !== confirmPassword && "border-destructive/50 ring-1 ring-destructive/15")} required minLength={8} />
                              {confirmPassword && password !== confirmPassword && (
                                <p className="text-[9px] text-destructive mt-1 font-medium flex items-center gap-1">
                                  <span className="h-1 w-1 rounded-full bg-destructive" />As senhas não coincidem
                                </p>
                              )}
                            </div>
                            <div>
                              <Label className={labelCls}><Target className="h-3 w-3 text-[hsl(160_50%_40%)]" />Onde conheceu a HOTZFY?</Label>
                              <Select value={referralSource} onValueChange={setReferralSource}>
                                <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione uma opção..." /></SelectTrigger>
                                <SelectContent className="rounded-xl border-[hsl(160_10%_14%)] bg-[hsl(200_12%_8%)]">
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
                            <div className="rounded-xl bg-[hsl(160_60%_40%/0.05)] ring-1 ring-[hsl(160_60%_40%/0.1)] p-4 space-y-2">
                              <p className="text-[10px] font-bold text-[hsl(160_60%_55%)] uppercase tracking-wider">Resumo do Cadastro</p>
                              {[
                                { label: "Nome", value: fullName },
                                { label: "Apelido", value: nickname },
                                { label: "E-mail", value: email },
                                { label: "Documento", value: document },
                                { label: "WhatsApp", value: phone },
                              ].map(item => (
                                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-[hsl(160_60%_40%/0.05)] last:border-0">
                                  <span className="text-[10px] text-[hsl(160_10%_35%)] font-medium">{item.label}</span>
                                  <span className="text-[11px] text-foreground/80 font-medium">{item.value || "—"}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(160_60%_40%/0.05)] ring-1 ring-[hsl(160_60%_40%/0.1)]">
                              <CheckCircle2 className="h-4 w-4 text-[hsl(160_60%_50%)] shrink-0" />
                              <p className="text-[10px] text-[hsl(160_40%_45%)] font-medium">Tudo pronto para criar sua conta!</p>
                            </div>
                          </div>
                        )}

                        {/* Nav buttons */}
                        <div className="flex gap-3 pt-1">
                          {step > 1 && (
                            <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}
                              className="flex-1 h-11 rounded-xl font-bold text-[12px] border-[hsl(160_10%_15%)] text-[hsl(160_15%_50%)] hover:bg-[hsl(160_10%_10%)]">
                              Voltar
                            </Button>
                          )}
                          {step < 4 ? (
                            <Button type="button" onClick={() => setStep(s => s + 1)} disabled={!canAdvanceStep(step)}
                              className="flex-1 h-11 rounded-xl text-[12px] font-bold gap-2 bg-gradient-to-r from-[hsl(160_60%_40%)] to-[hsl(175_60%_38%)] text-[hsl(200_15%_5%)] hover:brightness-110 shadow-[0_6px_20px_rgba(16,185,129,0.2)]">
                              Próximo <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button type="button" onClick={() => handleSubmit()} disabled={loading}
                              className="flex-1 h-12 rounded-xl text-[13px] font-bold gap-2 bg-gradient-to-r from-[hsl(160_60%_40%)] to-[hsl(175_60%_38%)] text-[hsl(200_15%_5%)] hover:brightness-110 shadow-[0_8px_24px_rgba(16,185,129,0.25)]">
                              {loading ? (
                                <div className="h-5 w-5 border-2 border-[hsl(200_15%_5%/0.3)] border-t-[hsl(200_15%_5%)] rounded-full animate-spin" />
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
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[hsl(160_10%_12%)]" /></div>
                  <div className="relative flex justify-center">
                    <span className="bg-[hsl(200_12%_7%)] px-3 text-[8px] font-bold uppercase tracking-wider text-[hsl(160_10%_25%)]">
                      {isLogin ? "ou crie uma conta" : "já possui conta?"}
                    </span>
                  </div>
                </div>

                <button onClick={() => setIsLogin(!isLogin)}
                  className="w-full h-10 rounded-xl border border-[hsl(160_10%_14%)] text-[11px] font-bold text-[hsl(160_10%_35%)] hover:text-[hsl(160_20%_55%)] hover:border-[hsl(160_20%_22%)] hover:bg-[hsl(160_10%_8%)] transition-all">
                  {isLogin ? "Criar conta grátis" : "Entrar na minha conta"}
                </button>

                {/* Trust badges */}
                {isLogin && (
                  <div className="mt-5 flex items-center justify-center gap-5 pt-4 border-t border-[hsl(160_10%_10%)]">
                    {[
                      { icon: Shield, label: "SSL 256-bit" },
                      { icon: Shield, label: "Anti-fraude" },
                      { icon: Lock, label: "Criptografado" },
                      { icon: CheckCircle2, label: "LGPD" },
                    ].map(b => (
                      <div key={b.label} className="flex items-center gap-1 text-[hsl(160_10%_28%)]">
                        <b.icon className="h-3 w-3" />
                        <span className="text-[7px] font-bold uppercase tracking-wider">{b.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-center text-[9px] text-[hsl(160_10%_28%)] leading-relaxed mt-4">
                  Ao continuar, você concorda com os{" "}
                  <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline hover:text-[hsl(160_30%_50%)] transition-colors">Termos de Uso</a> e{" "}
                  <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-[hsl(160_30%_50%)] transition-colors">Política de Privacidade</a>.
                </p>
              </div>
            </div>

            {/* Mobile stats */}
            <div className="lg:hidden mt-5 grid grid-cols-3 gap-2">
              {[
                { value: 10847, label: "Produtores", icon: Users, prefix: "", suffix: "" },
                { value: 52, label: "Milhões processados", icon: TrendingUp, prefix: "R$", suffix: "M" },
                { value: 99, label: "Uptime", icon: Activity, prefix: "", suffix: ".9%" },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl bg-[hsl(200_12%_8%)] ring-1 ring-[hsl(160_10%_14%)]">
                  <s.icon className="h-3.5 w-3.5 text-[hsl(160_50%_40%)] mx-auto mb-1" />
                  <p className="text-[14px] font-display font-black text-foreground tabular-nums">
                    <AnimatedCounter target={s.value} prefix={s.prefix} suffix={s.suffix} />
                  </p>
                  <p className="text-[7px] text-[hsl(160_10%_30%)] font-bold uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ RIGHT: Dashboard Preview Panel (Desktop) ═══ */}
      <div className="hidden lg:flex w-[50%] xl:w-[52%] relative overflow-hidden flex-col bg-[hsl(170_12%_6%)]">
        {/* BG */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[hsl(160_60%_30%/0.06)] blur-[150px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[hsl(200_50%_30%/0.04)] blur-[130px]" />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(160 20% 20% / 0.12) 0.5px, transparent 0)", backgroundSize: "32px 32px" }} />
        </div>

        <div className="relative z-10 h-full flex flex-col p-7 xl:p-9 gap-3.5 overflow-y-auto">

          {/* Title */}
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(160_60%_40%/0.08)] ring-1 ring-[hsl(160_60%_40%/0.15)] text-[9px] font-bold text-[hsl(160_60%_55%)] uppercase tracking-widest mb-2.5"
            >
              <Activity className="h-3 w-3" />
              Dashboard Preview
            </motion.div>
            <h2 className="text-[1.5rem] xl:text-[1.8rem] font-display font-black text-foreground leading-[1.08] tracking-[-0.04em]">
              Seu painel será <span className="text-[hsl(160_60%_50%)]">assim</span>
            </h2>
          </div>

          {/* 4 stats */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-4 gap-2">
            {[
              { value: 10847, label: "Produtores", icon: Users, prefix: "", suffix: "+" },
              { value: 52, label: "Processados", icon: TrendingUp, prefix: "R$", suffix: "M", format: true },
              { value: 284, label: "Vendas/hora", icon: Zap, prefix: "", suffix: "" },
              { value: 99, label: "Uptime", icon: Activity, prefix: "", suffix: ".9%" },
            ].map((stat) => (
              <div key={stat.label} className="p-2.5 rounded-xl bg-[hsl(160_12%_8%)] border border-[hsl(160_15%_14%)]">
                <stat.icon className="h-3 w-3 text-[hsl(160_50%_40%)] mb-1" />
                <p className="text-[15px] xl:text-[17px] font-display font-black text-foreground tabular-nums leading-none mb-0.5">
                  {stat.format ? <AnimatedCounter target={52} prefix="R$" suffix="M" duration={2500} /> : <AnimatedCounter target={stat.value} prefix={stat.prefix} suffix={stat.suffix} duration={2000} />}
                </p>
                <p className="text-[6px] text-[hsl(160_15%_30%)] font-bold uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Chart + Live feed */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="grid grid-cols-5 gap-2.5 flex-1 min-h-[140px]">
            {/* Chart */}
            <div className="col-span-3 rounded-xl bg-[hsl(160_12%_8%)] border border-[hsl(160_15%_14%)] p-3.5 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[7px] font-bold text-[hsl(160_15%_30%)] uppercase tracking-wider">Faturamento — Hoje</p>
                  <p className="text-[20px] xl:text-[24px] font-display font-black text-foreground tabular-nums leading-none mt-0.5">
                    R$ <AnimatedCounter target={12480} duration={3000} />
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[hsl(160_60%_40%/0.1)]">
                  <TrendingUp className="h-3 w-3 text-[hsl(160_60%_50%)]" />
                  <span className="text-[9px] font-bold text-[hsl(160_60%_50%)]">+23%</span>
                </div>
              </div>
              <div className="flex-1 flex items-end gap-[2px] min-h-[50px]">
                {[35,52,40,68,45,78,60,85,55,92,70,95,65,88,72,98,80,75,90,82,96,88,70,60].map((h, i) => (
                  <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }}
                    transition={{ delay: 0.5 + i * 0.025, duration: 0.35, ease: "easeOut" }}
                    className="flex-1 rounded-t-sm bg-[hsl(160_60%_40%)] opacity-50 hover:opacity-100 transition-opacity" style={{ minHeight: 2 }} />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {["00h","06h","12h","18h","23h"].map(t => <span key={t} className="text-[6px] text-[hsl(160_10%_25%)]">{t}</span>)}
              </div>
            </div>

            {/* Live feed */}
            <div className="col-span-2 rounded-xl bg-[hsl(160_12%_8%)] border border-[hsl(160_15%_14%)] p-3.5 flex flex-col">
              <p className="text-[7px] font-bold text-[hsl(160_15%_30%)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-[hsl(160_60%_50%)] opacity-60" /><span className="relative rounded-full h-1.5 w-1.5 bg-[hsl(160_60%_50%)]" /></span>
                Vendas ao vivo
              </p>
              <div className="flex-1 overflow-hidden"><NotificationFeed /></div>
            </div>
          </motion.div>

          {/* Payment methods */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="grid grid-cols-3 gap-2">
            {[
              { label: "PIX", pct: 68, value: "R$ 8.486", color: "hsl(160 60% 50%)" },
              { label: "Cartão", pct: 28, value: "R$ 3.494", color: "hsl(200 60% 50%)" },
              { label: "Boleto", pct: 4, value: "R$ 499", color: "hsl(40 60% 50%)" },
            ].map(m => (
              <div key={m.label} className="p-2.5 rounded-xl bg-[hsl(160_12%_8%)] border border-[hsl(160_15%_14%)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-bold text-[hsl(160_20%_45%)] uppercase tracking-wider">{m.label}</span>
                  <span className="text-[8px] font-bold text-foreground/70">{m.pct}%</span>
                </div>
                <div className="h-1 rounded-full bg-[hsl(160_10%_12%)] overflow-hidden mb-1">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${m.pct}%` }}
                    transition={{ delay: 0.75, duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full" style={{ backgroundColor: m.color }} />
                </div>
                <p className="text-[11px] font-display font-black text-foreground tabular-nums">{m.value}</p>
              </div>
            ))}
          </motion.div>

          {/* Pills + status */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
            <div className="flex flex-wrap gap-1 mb-2">
              {[
                { icon: CreditCard, label: "Checkout" }, { icon: GraduationCap, label: "Membros" },
                { icon: Shield, label: "Anti-fraude" }, { icon: QrCode, label: "PIX" },
                { icon: BarChart2, label: "Analytics" }, { icon: BadgeCheck, label: "Afiliados" },
                { icon: Globe, label: "Integrações" },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[hsl(160_12%_9%)] border border-[hsl(160_15%_14%)] text-[7px] font-bold text-[hsl(160_20%_40%)] uppercase tracking-wider">
                  <f.icon className="h-2.5 w-2.5 text-[hsl(160_50%_40%)]" />{f.label}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[hsl(160_12%_8%)] border border-[hsl(160_15%_14%)]">
              <span className="relative flex h-1.5 w-1.5 shrink-0"><span className="animate-ping absolute h-full w-full rounded-full bg-[hsl(160_60%_50%)] opacity-60" /><span className="relative rounded-full h-1.5 w-1.5 bg-[hsl(160_60%_50%)]" /></span>
              <span className="text-[9px] font-bold text-[hsl(160_30%_45%)]">Sistemas online</span>
              <span className="text-[hsl(160_15%_20%)]">·</span>
              <span className="text-[9px] text-[hsl(160_15%_30%)]">Checkout · Saque · API</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
