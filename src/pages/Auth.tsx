/**
 * Auth — Login & Cadastro Ultra-Premium v5
 * @module Auth
 * @version 5.0.0
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
  Star, Crown, Activity, Wifi, Fingerprint, Globe,
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
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rem = (sum * 10) % 11; if (rem === 10) rem = 0;
  if (rem !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rem = (sum * 10) % 11; if (rem === 10) rem = 0;
  return rem === parseInt(digits[10]);
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2], w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * w1[i];
  let rem = sum % 11; const d1 = rem < 2 ? 0 : 11 - rem;
  if (parseInt(digits[12]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * w2[i];
  rem = sum % 11; const d2 = rem < 2 ? 0 : 11 - rem;
  return parseInt(digits[13]) === d2;
}

/* ─── Password strength ─── */
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score: 1, label: "Fraca", color: "bg-destructive" };
  if (score <= 4) return { score: 2, label: "Média", color: "bg-warning" };
  return { score: 3, label: "Forte", color: "bg-success" };
}

/* ─── Animated counter ─── */
function AnimatedCounter({ target, suffix = "" }: { target: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const numMatch = target.match(/[\d.]+/);
  const prefix = target.replace(/[\d.]+.*/, "");
  const num = numMatch ? parseFloat(numMatch[0]) : 0;

  useEffect(() => {
    const duration = 1800;
    const steps = 40;
    const step = num / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += step;
      if (current >= num) { setCount(num); clearInterval(interval); }
      else setCount(Math.floor(current * 10) / 10);
    }, duration / steps);
    return () => clearInterval(interval);
  }, [num]);

  const display = num >= 1000 ? count.toFixed(0) : (Number.isInteger(num) ? count.toFixed(0) : count.toFixed(1));
  return <>{prefix}{display}{suffix}</>;
}

/* ─── Animated background ─── */
function PremiumBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Animated orbs */}
      <motion.div
        animate={{ y: [0, -40, 0], x: [0, 20, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full bg-primary/[0.06] blur-[180px]"
      />
      <motion.div
        animate={{ y: [0, 30, 0], x: [0, -15, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-info/[0.05] blur-[160px]"
      />
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, 10, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute bottom-[-120px] left-1/4 h-[400px] w-[400px] rounded-full bg-success/[0.04] blur-[140px]"
      />
      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "44px 44px"
      }} />
      {/* Radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_80%)]" />
      {/* Noise */}
      <div className="absolute inset-0 opacity-[0.012]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
      }} />
    </div>
  );
}

/* ─── Live status indicator ─── */
function LiveStatus() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.5 }}
      className="absolute top-4 right-4 md:top-6 md:right-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/40 backdrop-blur-xl border border-border/20 z-20"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      <span className="text-[9px] font-bold text-success uppercase tracking-[0.12em]">Online</span>
    </motion.div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({ icon: Icon, title, desc, tone, delay }: {
  icon: React.ElementType; title: string; desc: string; tone: string; delay: number;
}) {
  const cfg: Record<string, { bg: string; text: string; border: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/15 hover:border-primary/30" },
    info: { bg: "bg-info/10", text: "text-info", border: "border-info/15 hover:border-info/30" },
    warning: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/15 hover:border-warning/30" },
    success: { bg: "bg-success/10", text: "text-success", border: "border-success/15 hover:border-success/30" },
  };
  const t = cfg[tone] || cfg.primary;
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.4 + delay * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ x: 4, scale: 1.01 }}
      className={cn(
        "group flex items-center gap-4 p-4 rounded-2xl cursor-default",
        "bg-card/35 backdrop-blur-2xl border transition-all duration-400",
        "hover:bg-card/50 hover:shadow-xl hover:shadow-primary/5",
        t.border,
      )}
    >
      <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg", t.bg)}>
        <Icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", t.text)} />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-display font-bold text-foreground tracking-[-0.02em]">{title}</p>
        <p className="text-[11px] text-muted-foreground/55 mt-0.5 leading-relaxed">{desc}</p>
      </div>
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
  const [focusedField, setFocusedField] = useState<string | null>(null);
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
      const secsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
      toast.error(`Muitas tentativas. Aguarde ${secsLeft}s.`);
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
        const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!PASSWORD_REGEX.test(password)) { toast.error("Senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula e número"); setLoading(false); return; }
        const digits = document.replace(/\D/g, "");
        if (digits.length === 11 && !validateCPF(digits)) { toast.error("CPF inválido"); setLoading(false); return; }
        if (digits.length === 14 && !validateCNPJ(digits)) { toast.error("CNPJ inválido"); setLoading(false); return; }
        if (digits.length !== 11 && digits.length !== 14) { toast.error("Informe um CPF ou CNPJ válido"); setLoading(false); return; }
        if (!referralSource) { toast.error("Selecione onde conheceu a plataforma"); setLoading(false); return; }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: {
              full_name: fullName, nickname, document_number: digits,
              document_type: digits.length === 11 ? "cpf" : "cnpj",
              phone: phone.replace(/\D/g, ""), referral_source: referralSource,
            },
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

  const inputCls = "h-12 rounded-xl border-border/25 bg-card/30 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-card/50 transition-all duration-250";
  const labelCls = "text-[10px] font-bold text-muted-foreground/45 uppercase tracking-[0.15em] mb-1.5 block";

  return (
    <div className="min-h-screen flex bg-background text-foreground overflow-y-auto relative">
      <LiveStatus />

      {/* ─── LEFT: Form ─── */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
        <PremiumBackground />

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[440px] relative z-10"
        >
          {/* Brand */}
          <div className="flex items-center gap-3.5 mb-8">
            <motion.div
              initial={{ scale: 0.3, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 180, damping: 14 }}
              className="relative h-13 w-13 rounded-2xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary/30 ring-1 ring-primary/20"
            >
              <Rocket className="h-6 w-6 text-primary-foreground" />
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-2xl ring-2 ring-primary/20 animate-ping opacity-20" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-display font-black tracking-[-0.04em] text-foreground">HOTZFY</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                <p className="text-[10px] text-muted-foreground/45 font-semibold tracking-[0.08em]">Plataforma de Infoprodutos</p>
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="relative rounded-3xl border border-border/35 bg-card/50 backdrop-blur-2xl shadow-[0_12px_48px_hsl(var(--foreground)/0.08),0_2px_8px_hsl(var(--foreground)/0.04)]">
            {/* Gradient overlays */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/[0.035] via-transparent to-info/[0.02]" />
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-t from-card/20 to-transparent" />
            {/* Top accent line */}
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            {/* Side accent */}
            <div className="absolute left-0 top-8 bottom-8 w-[2px] rounded-full bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />

            <div className="relative z-[1] p-6 md:p-8">
              {/* Mode toggle pills */}
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={() => setIsLogin(true)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] transition-all duration-300",
                    isLogin
                      ? "bg-primary/15 text-primary border border-primary/25 shadow-lg shadow-primary/10"
                      : "text-muted-foreground/40 hover:text-muted-foreground/60 border border-transparent"
                  )}
                >
                  <Lock className="h-3 w-3 inline mr-1.5 -mt-0.5" />Entrar
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] transition-all duration-300",
                    !isLogin
                      ? "bg-info/15 text-info border border-info/25 shadow-lg shadow-info/10"
                      : "text-muted-foreground/40 hover:text-muted-foreground/60 border border-transparent"
                  )}
                >
                  <Sparkles className="h-3 w-3 inline mr-1.5 -mt-0.5" />Criar Conta
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={isLogin ? "login" : "signup"}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <h2 className="text-xl md:text-2xl font-display font-black tracking-[-0.03em] mb-1.5 text-foreground leading-tight">
                    {isLogin ? "Bem-vindo de volta!" : "Comece a vender hoje"}
                  </h2>
                  <p className="text-[13px] text-muted-foreground/55 mb-6 leading-relaxed">
                    {isLogin ? "Acesse seu painel e acompanhe seus resultados" : "Crie sua conta e lance seu primeiro infoproduto"}
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    {!isLogin && (
                      <>
                        <div>
                          <Label htmlFor="name" className={labelCls}>Nome completo</Label>
                          <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome completo" className={inputCls} required={!isLogin} onFocus={() => setFocusedField("name")} onBlur={() => setFocusedField(null)} />
                        </div>
                        <div>
                          <Label htmlFor="nickname" className={labelCls}>Como quer ser chamado?</Label>
                          <Input id="nickname" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Ex: João, Mari..." className={inputCls} required={!isLogin} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="document" className={labelCls}>CPF ou CNPJ</Label>
                            <Input
                              id="document" value={document} onChange={e => handleDocumentChange(e.target.value)}
                              placeholder="000.000.000-00" inputMode="numeric" autoComplete="off"
                              className={cn(inputCls, documentError && "border-destructive/50 ring-1 ring-destructive/20")}
                              required={!isLogin}
                            />
                            {documentError && <p className="text-[10px] text-destructive mt-1 font-medium">{documentError}</p>}
                          </div>
                          <div>
                            <Label htmlFor="phone" className={labelCls}>WhatsApp</Label>
                            <Input
                              id="phone" value={phone}
                              onChange={e => {
                                const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                                let formatted = digits;
                                if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                                if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                                setPhone(formatted);
                              }}
                              placeholder="(11) 99999-9999" inputMode="tel" className={inputCls} required={!isLogin}
                            />
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
                        <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={cn(inputCls, "pr-11")} required minLength={8} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/25 hover:text-foreground/50 transition-colors">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {/* Password strength bar */}
                      {!isLogin && password.length > 0 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex gap-1">
                              {[1, 2, 3].map(i => (
                                <div key={i} className={cn("h-1 flex-1 rounded-full transition-all duration-300", i <= pwStrength.score ? pwStrength.color : "bg-muted/30")} />
                              ))}
                            </div>
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider",
                              pwStrength.score === 1 ? "text-destructive" : pwStrength.score === 2 ? "text-warning" : "text-success"
                            )}>{pwStrength.label}</span>
                          </div>
                          <p className="text-[9px] text-muted-foreground/30 mt-1">Mín. 8 caracteres, maiúscula, minúscula e número</p>
                        </motion.div>
                      )}
                    </div>
                    {!isLogin && (
                      <>
                        <div>
                          <Label htmlFor="confirmPassword" className={labelCls}>Confirmar Senha</Label>
                          <Input
                            id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className={cn(inputCls, confirmPassword && password !== confirmPassword && "border-destructive/50 ring-1 ring-destructive/20")}
                            required={!isLogin} minLength={6}
                          />
                          {confirmPassword && password !== confirmPassword && <p className="text-[10px] text-destructive mt-1 font-medium">As senhas não coincidem</p>}
                        </div>
                        <div>
                          <Label className={labelCls}>Onde conheceu a plataforma?</Label>
                          <Select value={referralSource} onValueChange={setReferralSource}>
                            <SelectTrigger className={cn(inputCls, "mt-0")}>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/25 bg-card/95 backdrop-blur-2xl">
                              <SelectItem value="instagram">Instagram</SelectItem>
                              <SelectItem value="indicacao">Indicação</SelectItem>
                              <SelectItem value="youtube">YouTube</SelectItem>
                              <SelectItem value="pesquisa">Pesquisa (Google)</SelectItem>
                              <SelectItem value="tiktok">TikTok</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* Submit */}
                    <div className="pt-1">
                      <Button
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "w-full gradient-primary text-primary-foreground font-bold h-13 rounded-xl text-sm",
                          "shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/35",
                          "hover:-translate-y-[2px] active:translate-y-0 transition-all duration-200 gap-2",
                          "relative overflow-hidden"
                        )}
                      >
                        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary-foreground/15 to-transparent" />
                        </div>
                        <span className="relative z-[1] flex items-center gap-2">
                          {loading ? (
                            <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          ) : (
                            <>
                              {isLogin ? "Entrar na plataforma" : "Criar conta grátis"}
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </span>
                      </Button>
                    </div>
                  </form>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/15" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-card/50 backdrop-blur-sm px-3 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/30">
                        {isLogin ? "ou crie uma conta" : "já possui conta?"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className={cn(
                      "w-full h-11 rounded-xl border text-[13px] font-bold transition-all duration-300",
                      "border-border/25 text-muted-foreground/60 hover:text-foreground hover:border-border/50 hover:bg-card/40"
                    )}
                  >
                    {isLogin ? "Cadastre-se grátis" : "Entrar na minha conta"}
                  </button>

                  <p className="text-center text-[9px] text-muted-foreground/30 leading-relaxed mt-4">
                    Ao continuar, você concorda com os{" "}
                    <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/40 transition-colors">Termos de Uso</a> e{" "}
                    <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/40 transition-colors">Política de Privacidade</a>.
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Trust badges */}
              {isLogin && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6 flex items-center justify-center gap-4 pt-5 border-t border-border/10"
                >
                  {[
                    { icon: Shield, label: "SSL 256-bit" },
                    { icon: Fingerprint, label: "2FA Ready" },
                    { icon: Lock, label: "Encrypted" },
                    { icon: CheckCircle2, label: "LGPD" },
                  ].map((b, i) => (
                    <motion.div
                      key={b.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + i * 0.08 }}
                      className="flex items-center gap-1.5 text-muted-foreground/20"
                    >
                      <b.icon className="h-3 w-3" />
                      <span className="text-[7px] font-bold uppercase tracking-[0.15em]">{b.label}</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {/* Mobile social proof */}
          <div className="lg:hidden mt-6 grid grid-cols-3 gap-2">
            {[
              { value: "10K+", label: "Produtores" },
              { value: "R$50M+", label: "Processados" },
              { value: "99.9%", label: "Uptime" },
            ].map(s => (
              <div key={s.label} className="text-center p-3 rounded-xl bg-card/25 backdrop-blur-sm border border-border/10">
                <p className="text-[14px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">{s.value}</p>
                <p className="text-[8px] text-muted-foreground/35 font-bold uppercase tracking-[0.12em]">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── RIGHT: Features (Desktop) ─── */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden">
        <PremiumBackground />

        {/* Scan-lines */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.012]" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 3px)",
        }} />

        <div className="max-w-[380px] relative z-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold mb-8 shadow-lg shadow-primary/5 tracking-wide"
          >
            <Crown className="h-3.5 w-3.5" />
            Plataforma #1 de Infoprodutos
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-4xl xl:text-[44px] font-display font-black mb-5 text-foreground leading-[1.06] tracking-[-0.045em]"
          >
            Tudo que você
            <br />precisa para{" "}
            <span className="text-gradient relative">
              vender online
              <motion.div
                className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-primary via-primary/60 to-transparent"
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.9 }}
              />
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-[15px] text-muted-foreground/55 mb-10 leading-[1.75] max-w-[340px]"
          >
            Checkout otimizado, área de membros, processamento de pagamentos e ferramentas avançadas de analytics.
          </motion.p>

          {/* Feature cards */}
          <div className="space-y-2.5">
            <FeatureCard icon={CreditCard} title="Checkout de Alta Conversão" desc="PIX, Cartão e Boleto com 1-click" tone="primary" delay={0} />
            <FeatureCard icon={GraduationCap} title="Área de Membros Netflix" desc="Entregue cursos e conteúdos premium" tone="info" delay={1} />
            <FeatureCard icon={BarChart2} title="Analytics em Tempo Real" desc="Métricas completas das suas vendas" tone="warning" delay={2} />
            <FeatureCard icon={Shield} title="Anti-fraude Integrado" desc="Blacklist, velocity check e proteção total" tone="success" delay={3} />
          </div>

          {/* Animated stats */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { target: "10", suffix: "K+", label: "Produtores", icon: Users },
              { target: "50", suffix: "M+", label: "Processados", icon: TrendingUp, prefix: "R$" },
              { target: "99.9", suffix: "%", label: "Uptime", icon: Activity },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1 + i * 0.12 }}
                className="text-center p-4 rounded-2xl bg-card/25 backdrop-blur-xl border border-border/15 hover:border-border/30 hover:bg-card/35 transition-all duration-300"
              >
                <s.icon className="h-4 w-4 mx-auto mb-2 text-primary/50" />
                <p className="text-[18px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">
                  {s.prefix || ""}<AnimatedCounter target={s.target} suffix={s.suffix} />
                </p>
                <p className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-[0.15em] mt-0.5">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            className="mt-6 p-5 rounded-2xl bg-card/25 backdrop-blur-xl border border-border/15 hover:border-border/25 transition-all duration-300"
          >
            <div className="flex items-center gap-1 mb-2.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-warning text-warning" />
              ))}
              <span className="text-[9px] text-muted-foreground/30 ml-1 font-bold">5.0</span>
            </div>
            <p className="text-[12px] text-muted-foreground/65 leading-[1.7] italic">
              "Migrei de outra plataforma e minhas vendas triplicaram no primeiro mês. A melhor decisão que tomei!"
            </p>
            <div className="flex items-center gap-2.5 mt-3.5 pt-3 border-t border-border/10">
              <div className="h-8 w-8 rounded-full bg-primary/12 flex items-center justify-center ring-1 ring-primary/15">
                <span className="text-[10px] font-bold text-primary">RS</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-foreground">Rafael S.</p>
                <p className="text-[9px] text-muted-foreground/35">Infoprodutor · R$120K/mês</p>
              </div>
              <div className="ml-auto">
                <CheckCircle2 className="h-4 w-4 text-success/50" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
