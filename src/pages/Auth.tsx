/**
 * Auth — Login & Cadastro Ultra-Premium v7
 * @module Auth
 * @version 7.0.0
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Rocket, Eye, EyeOff, Zap, Shield, GraduationCap, BarChart2, CreditCard,
  Users, TrendingUp, CheckCircle2, ArrowRight, Sparkles, Lock,
  Star, Crown, Activity, Fingerprint, ChevronRight, Globe, Layers,
  Radio, Timer, Gem, Award,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Document helpers ─── */
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

/* ─── Password strength ─── */
function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++; if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++; if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++; if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score: 1, label: "Fraca", color: "bg-destructive", text: "text-destructive" };
  if (score <= 4) return { score: 2, label: "Média", color: "bg-warning", text: "text-warning" };
  return { score: 3, label: "Forte", color: "bg-success", text: "text-success" };
}

/* ─── Animated counter ─── */
function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: string; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const numMatch = target.match(/[\d.]+/);
  const num = numMatch ? parseFloat(numMatch[0]) : 0;
  useEffect(() => {
    const steps = 40; const step = num / steps; let cur = 0;
    const iv = setInterval(() => {
      cur += step;
      if (cur >= num) { setCount(num); clearInterval(iv); } else setCount(Math.floor(cur * 10) / 10);
    }, 40);
    return () => clearInterval(iv);
  }, [num]);
  const display = Number.isInteger(num) ? count.toFixed(0) : count.toFixed(1);
  return <>{prefix}{display}{suffix}</>;
}

/* ─── Floating orbs ─── */
function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ y: [0, -40, 0], x: [0, 20, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full bg-primary/[0.05] blur-[180px]"
      />
      <motion.div
        animate={{ y: [0, 30, 0], x: [0, -15, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute -right-36 bottom-[-100px] h-[500px] w-[500px] rounded-full bg-info/[0.04] blur-[160px]"
      />
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute left-1/2 top-1/4 h-[300px] w-[300px] rounded-full bg-primary/[0.025] blur-[120px]"
      />
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "48px 48px"
      }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background)/0.7)_85%)]" />
    </div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({ icon: Icon, title, desc, tone, delay }: {
  icon: React.ElementType; title: string; desc: string; tone: string; delay: number;
}) {
  const cfg: Record<string, { bg: string; iconText: string; accent: string; glow: string }> = {
    primary: { bg: "bg-primary/10", iconText: "text-primary", accent: "border-l-primary/40", glow: "group-hover:shadow-primary/10" },
    info: { bg: "bg-info/10", iconText: "text-info", accent: "border-l-info/40", glow: "group-hover:shadow-info/10" },
    warning: { bg: "bg-warning/10", iconText: "text-warning", accent: "border-l-warning/40", glow: "group-hover:shadow-warning/10" },
    success: { bg: "bg-success/10", iconText: "text-success", accent: "border-l-success/40", glow: "group-hover:shadow-success/10" },
  };
  const t = cfg[tone] || cfg.primary;
  return (
    <motion.div
      initial={{ opacity: 0, x: 36 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, delay: 0.5 + delay * 0.12, ease: [0.22, 0.61, 0.36, 1] }}
      whileHover={{ x: 5, scale: 1.01 }}
      className={cn(
        "group flex items-center gap-4 p-4 rounded-2xl cursor-default border-l-[3px]",
        "bg-card/30 backdrop-blur-xl border border-border/15",
        "hover:bg-card/50 hover:border-border/30 transition-all duration-300",
        t.accent, t.glow, "hover:shadow-xl"
      )}
    >
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3", t.bg)}>
        <Icon className={cn("h-[18px] w-[18px]", t.iconText)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-display font-bold text-foreground tracking-[-0.02em]">{title}</p>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/10 group-hover:text-muted-foreground/40 group-hover:translate-x-0.5 transition-all shrink-0" />
    </motion.div>
  );
}

/* ─── Live activity ticker ─── */
function LiveTicker() {
  const messages = [
    "🎯 João acabou de vender R$ 497,00",
    "🚀 Maria lançou um novo curso",
    "💰 Pedro sacou R$ 2.300,00",
    "📈 Ana bateu 100 vendas hoje",
    "🔥 Lucas criou novo checkout",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setIdx(p => (p + 1) % messages.length), 4000);
    return () => clearInterval(iv);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.8 }}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card/25 backdrop-blur-xl border border-border/10"
    >
      <div className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-[10px] text-muted-foreground/50 font-medium truncate"
        >
          {messages[idx]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Main ─── */
export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
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

  const handleDocumentChange = (value: string) => {
    const formatted = formatDocument(value);
    setDocument(formatted);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 11) setDocumentError(validateCPF(digits) ? "" : "CPF inválido");
    else if (digits.length === 14) setDocumentError(validateCNPJ(digits) ? "" : "CNPJ inválido");
    else setDocumentError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Conta criada com sucesso! Verifique seu e-mail para ativar a conta.");
        setIsLogin(true);
      }
    } catch (error: unknown) {
      const msg = (error as any)?.message || "";
      if (msg.includes("Invalid login")) toast.error("E-mail ou senha incorretos.");
      else if (msg.includes("already registered")) toast.error("Este e-mail já está cadastrado.");
      else if (msg.includes("Email not confirmed")) toast.error("Confirme seu e-mail antes de acessar.");
      else toast.error("Instabilidade na rede. Tente novamente em instantes.");
    } finally { setLoading(false); }
  };

  const inputCls = "h-12 rounded-xl border-border/20 bg-muted/15 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-muted/25 transition-all duration-300 font-display text-sm";
  const labelCls = "text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-1.5 block font-display";

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">

      {/* ─── LEFT: Form ─── */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden">
        <FloatingOrbs />

        {/* Sticky top bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="sticky top-0 z-20 flex items-center justify-between p-4 md:px-6"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Rocket className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-display font-black tracking-[-0.04em] text-foreground">HOTZFY</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/30 backdrop-blur-2xl border border-border/15">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            <span className="text-[8px] font-bold text-success/80 uppercase tracking-[0.15em]">Online</span>
          </div>
        </motion.div>

        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 pb-10 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[440px] relative z-10"
          >
            {/* Welcome section */}
            <div className="mb-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 text-[9px] font-bold text-primary uppercase tracking-[0.12em] mb-4"
              >
                <Gem className="h-3 w-3" />
                Plataforma #1 de Infoprodutos
              </motion.div>
              <h1 className="text-2xl md:text-3xl font-display font-black tracking-[-0.045em] text-foreground leading-[1.1]">
                {isLogin ? "Bem-vindo de volta" : "Comece a vender hoje"}
              </h1>
              <p className="text-sm text-muted-foreground/50 mt-2 font-display">
                {isLogin ? "Acesse seu painel e acompanhe seus resultados" : "Crie sua conta e lance seu primeiro infoproduto"}
              </p>
            </div>

            {/* Card */}
            <div className="relative rounded-3xl border border-border/20 bg-card/50 backdrop-blur-2xl shadow-[0_20px_80px_hsl(var(--foreground)/0.06)]">
              {/* Decorative gradient accents */}
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className="absolute left-0 top-10 bottom-10 w-px bg-gradient-to-b from-primary/20 via-primary/5 to-transparent" />
              <div className="absolute right-0 top-10 bottom-10 w-px bg-gradient-to-b from-transparent via-primary/5 to-primary/10" />
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/[0.02] via-transparent to-info/[0.01]" />

              <div className="relative z-[1] p-6 md:p-8">
                {/* Mode toggle pills */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/12 border border-border/10 mb-7">
                  <button
                    onClick={() => setIsLogin(true)}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold uppercase tracking-[0.08em] transition-all duration-300 flex items-center justify-center gap-2",
                      isLogin
                        ? "bg-primary/15 text-primary shadow-lg shadow-primary/10 border border-primary/20"
                        : "text-muted-foreground/35 hover:text-muted-foreground/55 hover:bg-muted/8"
                    )}
                  >
                    <Lock className="h-3.5 w-3.5" />Entrar
                  </button>
                  <button
                    onClick={() => setIsLogin(false)}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold uppercase tracking-[0.08em] transition-all duration-300 flex items-center justify-center gap-2",
                      !isLogin
                        ? "bg-info/15 text-info shadow-lg shadow-info/10 border border-info/20"
                        : "text-muted-foreground/35 hover:text-muted-foreground/55 hover:bg-muted/8"
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />Criar Conta
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={isLogin ? "login" : "signup"}
                    initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {!isLogin && (
                        <>
                          <div>
                            <Label htmlFor="name" className={labelCls}>Nome completo</Label>
                            <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome completo" className={inputCls} required={!isLogin} />
                          </div>
                          <div>
                            <Label htmlFor="nickname" className={labelCls}>Como quer ser chamado?</Label>
                            <Input id="nickname" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Ex: João, Mari..." className={inputCls} required={!isLogin} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="document" className={labelCls}>CPF ou CNPJ</Label>
                              <Input id="document" value={document} onChange={e => handleDocumentChange(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" autoComplete="off"
                                className={cn(inputCls, documentError && "border-destructive/50 ring-1 ring-destructive/20")} required={!isLogin} />
                              {documentError && <p className="text-[9px] text-destructive mt-1 font-medium font-display">{documentError}</p>}
                            </div>
                            <div>
                              <Label htmlFor="phone" className={labelCls}>WhatsApp</Label>
                              <Input id="phone" value={phone}
                                onChange={e => { const d = e.target.value.replace(/\D/g, "").slice(0, 11); let f = d; if (d.length > 2) f = `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length > 7) f = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; setPhone(f); }}
                                placeholder="(11) 99999-9999" inputMode="tel" className={inputCls} required={!isLogin} />
                            </div>
                          </div>
                        </>
                      )}

                      <div>
                        <Label htmlFor="email" className={labelCls}>E-mail</Label>
                        <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} required />
                      </div>

                      <div>
                        <Label htmlFor="password" className={labelCls}>Senha</Label>
                        <div className="relative">
                          <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={cn(inputCls, "pr-12")} required minLength={8} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/25 hover:text-foreground/50 transition-colors duration-200">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {!isLogin && password.length > 0 && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2.5 space-y-1.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 flex gap-1">
                                {[1,2,3].map(i => (
                                  <motion.div
                                    key={i}
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: i <= pwStrength.score ? 1 : 0.3 }}
                                    className={cn("h-1.5 flex-1 rounded-full transition-all duration-500 origin-left", i <= pwStrength.score ? pwStrength.color : "bg-muted/15")}
                                  />
                                ))}
                              </div>
                              <span className={cn("text-[9px] font-bold uppercase tracking-wider font-display", pwStrength.text)}>{pwStrength.label}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/30 font-display">Mín. 8 caracteres, maiúscula, minúscula e número</p>
                          </motion.div>
                        )}
                      </div>

                      {!isLogin && (
                        <>
                          <div>
                            <Label htmlFor="confirmPassword" className={labelCls}>Confirmar Senha</Label>
                            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••"
                              className={cn(inputCls, confirmPassword && password !== confirmPassword && "border-destructive/50 ring-1 ring-destructive/20")} required={!isLogin} minLength={6} />
                            {confirmPassword && password !== confirmPassword && <p className="text-[9px] text-destructive mt-1 font-medium font-display">As senhas não coincidem</p>}
                          </div>
                          <div>
                            <Label className={labelCls}>Onde conheceu a plataforma?</Label>
                            <Select value={referralSource} onValueChange={setReferralSource}>
                              <SelectTrigger className={cn(inputCls, "mt-0")}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent className="rounded-xl border-border/20 bg-popover/95 backdrop-blur-2xl">
                                {["instagram","indicacao","youtube","pesquisa","tiktok","outro"].map(v => (
                                  <SelectItem key={v} value={v}>{v === "indicacao" ? "Indicação" : v === "pesquisa" ? "Pesquisa (Google)" : v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <div className="pt-1">
                        <Button type="submit" disabled={loading}
                          className={cn("w-full gradient-primary text-primary-foreground font-display font-bold h-12 rounded-xl text-sm",
                            "shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30",
                            "hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.985] transition-all duration-200 gap-2 relative overflow-hidden")}>
                          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary-foreground/15 to-transparent" />
                          </div>
                          <span className="relative z-[1] flex items-center gap-2">
                            {loading ? <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                              : <>{isLogin ? "Entrar na plataforma" : "Criar conta grátis"}<ArrowRight className="h-4 w-4" /></>}
                          </span>
                        </Button>
                      </div>
                    </form>

                    {/* Divider */}
                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/10" /></div>
                      <div className="relative flex justify-center">
                        <span className="bg-card/60 backdrop-blur-sm px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground/25 font-display">{isLogin ? "ou crie uma conta" : "já possui conta?"}</span>
                      </div>
                    </div>

                    <button onClick={() => setIsLogin(!isLogin)}
                      className="w-full h-10 rounded-xl border border-border/15 text-[12px] font-bold font-display text-muted-foreground/50 hover:text-foreground/70 hover:border-border/30 hover:bg-muted/10 transition-all duration-300">
                      {isLogin ? "Cadastre-se grátis" : "Entrar na minha conta"}
                    </button>

                    <p className="text-center text-[9px] text-muted-foreground/25 leading-relaxed mt-4 font-display">
                      Ao continuar, você concorda com os{" "}
                      <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/40 transition-colors">Termos de Uso</a> e{" "}
                      <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/40 transition-colors">Política de Privacidade</a>.
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* Trust badges — login only */}
                {isLogin && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="mt-6 flex items-center justify-center gap-5 pt-5 border-t border-border/8">
                    {[{ icon: Shield, label: "SSL 256-bit" }, { icon: Fingerprint, label: "2FA Ready" }, { icon: Lock, label: "Encrypted" }, { icon: CheckCircle2, label: "LGPD" }].map((b, i) => (
                      <motion.div key={b.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.08 }}
                        className="flex items-center gap-1.5 text-muted-foreground/20 hover:text-muted-foreground/35 transition-colors cursor-default">
                        <b.icon className="h-3 w-3" /><span className="text-[7px] font-bold uppercase tracking-[0.12em] font-display">{b.label}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Mobile social proof */}
            <div className="lg:hidden mt-6 grid grid-cols-3 gap-2.5">
              {[{ value: "10K+", label: "Produtores" }, { value: "R$50M+", label: "Processados" }, { value: "99.9%", label: "Uptime" }].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                  className="text-center p-3 rounded-2xl bg-card/25 backdrop-blur-sm border border-border/10"
                >
                  <p className="text-[14px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">{s.value}</p>
                  <p className="text-[7px] text-muted-foreground/30 font-bold uppercase tracking-[0.12em] font-display mt-0.5">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── RIGHT: Features (Desktop) ─── */}
      <div className="hidden lg:flex flex-1 relative overflow-y-auto overflow-x-hidden border-l border-border/8">
        <FloatingOrbs />
        {/* Scan-lines */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.006]" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 3px)",
        }} />

        <div className="flex-1 flex items-center justify-center p-10 xl:p-14 py-20 min-h-full">
          <div className="max-w-[380px] relative z-10">
            {/* Badge */}
            <motion.div initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-[10px] font-bold mb-7 shadow-lg shadow-primary/5 tracking-wide font-display">
              <Crown className="h-3 w-3" />Plataforma #1 de Infoprodutos
            </motion.div>

            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
              className="text-3xl xl:text-[2.5rem] font-display font-black mb-4 text-foreground leading-[1.06] tracking-[-0.045em]">
              Tudo que você precisa para{" "}
              <span className="text-gradient relative inline-block">
                vender online
                <motion.div className="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-primary via-primary/50 to-transparent"
                  initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.9 }} />
              </span>
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
              className="text-[13px] text-muted-foreground/50 mb-8 leading-[1.75] max-w-[340px] font-display">
              Checkout otimizado, área de membros, processamento de pagamentos e ferramentas avançadas para escalar seu negócio digital.
            </motion.p>

            <div className="space-y-2.5">
              <FeatureCard icon={CreditCard} title="Checkout de Alta Conversão" desc="PIX, Cartão e Boleto com 1-click" tone="primary" delay={0} />
              <FeatureCard icon={GraduationCap} title="Área de Membros Netflix" desc="Entregue cursos e conteúdos premium" tone="info" delay={1} />
              <FeatureCard icon={BarChart2} title="Analytics em Tempo Real" desc="Métricas completas das suas vendas" tone="warning" delay={2} />
              <FeatureCard icon={Shield} title="Anti-fraude Integrado" desc="Blacklist, velocity check e proteção" tone="success" delay={3} />
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[{ target: "10", suffix: "K+", label: "Produtores", icon: Users },
                { target: "50", suffix: "M+", label: "Processados", icon: TrendingUp, prefix: "R$" },
                { target: "99.9", suffix: "%", label: "Uptime", icon: Activity }].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.1 + i * 0.1 }}
                  className="text-center p-4 rounded-2xl bg-card/25 backdrop-blur-xl border border-border/10 hover:border-border/25 hover:bg-card/35 transition-all duration-300 group">
                  <s.icon className="h-3.5 w-3.5 mx-auto mb-2 text-primary/40 group-hover:text-primary/60 transition-colors" />
                  <p className="text-[17px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">
                    <AnimatedCounter target={s.target} suffix={s.suffix} prefix={s.prefix || ""} />
                  </p>
                  <p className="text-[7px] text-muted-foreground/35 font-bold uppercase tracking-[0.15em] mt-0.5 font-display">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Live ticker */}
            <div className="mt-5">
              <LiveTicker />
            </div>

            {/* Testimonial */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}
              className="mt-5 p-5 rounded-2xl bg-card/25 backdrop-blur-xl border border-border/10 hover:border-border/20 transition-all duration-300">
              <div className="flex items-center gap-1 mb-2.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-warning text-warning" />)}
                <span className="text-[9px] text-muted-foreground/30 ml-1.5 font-bold font-display">5.0</span>
              </div>
              <p className="text-[12px] text-muted-foreground/55 leading-[1.75] italic font-display">
                "Migrei de outra plataforma e minhas vendas triplicaram no primeiro mês. A melhor decisão que tomei!"
              </p>
              <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-border/8">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/10">
                  <span className="text-[10px] font-bold text-primary font-display">RS</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-foreground font-display">Rafael S.</p>
                  <p className="text-[9px] text-muted-foreground/35 font-display">Infoprodutor · R$120K/mês</p>
                </div>
                <CheckCircle2 className="h-3.5 w-3.5 text-success/40 ml-auto" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
