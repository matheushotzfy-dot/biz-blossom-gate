/**
 * Auth — Login & Cadastro Ultra-Premium
 * @module Auth
 * @version 4.0.0
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Rocket, Eye, EyeOff, Zap, Shield, GraduationCap, BarChart2, CreditCard,
  Users, TrendingUp, CheckCircle2, ArrowRight, Sparkles, Lock, Globe,
  Star, Award, Gem, Crown,
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
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let rem = sum % 11; const d1 = rem < 2 ? 0 : 11 - rem;
  if (parseInt(digits[12]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  rem = sum % 11; const d2 = rem < 2 ? 0 : 11 - rem;
  return parseInt(digits[13]) === d2;
}

/* ─── Animated floating orbs ─── */
function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[150px]"
      />
      <motion.div
        animate={{ y: [0, 20, 0], x: [0, -10, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-info/[0.06] blur-[130px]"
      />
      <motion.div
        animate={{ y: [0, -15, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute bottom-[-100px] left-1/3 h-[350px] w-[350px] rounded-full bg-primary/[0.05] blur-[120px]"
      />
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "48px 48px"
      }} />
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
      }} />
    </div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({ icon: Icon, title, desc, tone, delay }: {
  icon: React.ElementType; title: string; desc: string; tone: string; delay: number;
}) {
  const toneConfig: Record<string, { bg: string; text: string; glow: string }> = {
    primary: { bg: "bg-primary/10 ring-primary/20", text: "text-primary", glow: "shadow-primary/10" },
    info: { bg: "bg-info/10 ring-info/20", text: "text-info", glow: "shadow-info/10" },
    warning: { bg: "bg-warning/10 ring-warning/20", text: "text-warning", glow: "shadow-warning/10" },
    success: { bg: "bg-success/10 ring-success/20", text: "text-success", glow: "shadow-success/10" },
  };
  const t = toneConfig[tone] || toneConfig.primary;
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 + delay * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "group flex items-center gap-4 p-4 rounded-2xl",
        "bg-card/40 backdrop-blur-2xl border border-border/30",
        "hover:border-border/50 hover:bg-card/55 transition-all duration-400",
        `hover:shadow-xl ${t.glow}`
      )}
    >
      <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center ring-1 shrink-0 transition-transform duration-300 group-hover:scale-105", t.bg)}>
        <Icon className={cn("h-5 w-5", t.text)} />
      </div>
      <div>
        <p className="text-[14px] font-display font-bold text-foreground tracking-[-0.02em]">{title}</p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ─── Stat card ─── */
function StatCard({ value, label, icon: Icon, delay }: { value: string; label: string; icon: React.ElementType; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8 + delay * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="text-center p-4 rounded-2xl bg-card/30 backdrop-blur-xl border border-border/20 hover:border-border/40 transition-all duration-300"
    >
      <Icon className="h-4 w-4 mx-auto mb-2 text-primary/60" />
      <p className="text-[18px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">{value}</p>
      <p className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-[0.15em] mt-0.5">{label}</p>
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

  const inputCls = "h-12 rounded-xl border-border/30 bg-card/40 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all duration-200";
  const labelCls = "text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.14em] mb-1.5 block";

  return (
    <div className="min-h-screen flex bg-background text-foreground overflow-y-auto">

      {/* ─── LEFT: Form ─── */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
        <FloatingOrbs />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[440px] relative z-10"
        >
          {/* Brand Header */}
          <div className="flex items-center gap-3.5 mb-8">
            <motion.div
              initial={{ scale: 0.5, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 200 }}
              className="h-13 w-13 rounded-2xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary/25 ring-1 ring-primary/20"
            >
              <Rocket className="h-6 w-6 text-primary-foreground" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-display font-black tracking-[-0.04em] text-foreground">HOTZFY</h1>
              <p className="text-[11px] text-muted-foreground/50 font-medium tracking-wide">Plataforma de Infoprodutos</p>
            </div>
          </div>

          {/* Card */}
          <div className="relative rounded-3xl border border-border/40 bg-card/60 backdrop-blur-2xl p-6 md:p-8 shadow-[0_8px_40px_hsl(var(--foreground)/0.08),0_1px_4px_hsl(var(--foreground)/0.04)]">
            {/* Gradient overlay */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/[0.04] via-transparent to-info/[0.02]" />
            {/* Top accent line */}
            <div className="absolute top-0 left-8 right-8 h-[2px] rounded-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            <div className="relative z-[1]">
              {/* Mode indicator */}
              <div className="flex items-center gap-2 mb-5">
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-300",
                  isLogin
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-info/10 text-info border border-info/20"
                )}>
                  {isLogin ? <Lock className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                  {isLogin ? "Login Seguro" : "Nova Conta"}
                </div>
              </div>

              <h2 className="text-xl md:text-2xl font-display font-black tracking-[-0.03em] mb-1.5 text-foreground leading-tight">
                {isLogin ? "Bem-vindo de volta!" : "Comece a vender hoje"}
              </h2>
              <p className="text-[13px] text-muted-foreground/60 mb-7 leading-relaxed">
                {isLogin ? "Acesse seu painel e acompanhe seus resultados" : "Crie sua conta e lance seu primeiro infoproduto"}
              </p>

              <AnimatePresence mode="wait">
                <motion.form
                  key={isLogin ? "login" : "signup"}
                  initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
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
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground/60 transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {!isLogin && <p className="text-[9px] text-muted-foreground/35 mt-1.5 leading-relaxed">Mín. 8 caracteres, maiúscula, minúscula e número</p>}
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
                          <SelectContent className="rounded-xl border-border/30 bg-card/95 backdrop-blur-2xl">
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
                  <Button
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "w-full gradient-primary text-primary-foreground font-bold h-12 rounded-xl text-sm",
                      "shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30",
                      "hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200 gap-2",
                      "relative overflow-hidden"
                    )}
                  >
                    {/* Shimmer effect */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent" />
                    </div>
                    <span className="relative z-[1] flex items-center gap-2">
                      {loading ? (
                        <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      ) : (
                        <>
                          {isLogin ? "Entrar na plataforma" : "Criar conta grátis"}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </span>
                  </Button>
                </motion.form>
              </AnimatePresence>

              {/* Toggle + Legal */}
              <div className="mt-6 text-center space-y-3">
                <button onClick={() => setIsLogin(!isLogin)} className="text-[13px] text-primary hover:text-primary/80 font-bold transition-colors group">
                  {isLogin ? (
                    <span>Não tem conta? <span className="underline underline-offset-2 group-hover:underline-offset-4 transition-all">Cadastre-se grátis</span></span>
                  ) : (
                    <span>Já tem conta? <span className="underline underline-offset-2 group-hover:underline-offset-4 transition-all">Entrar</span></span>
                  )}
                </button>
                <p className="text-[10px] text-muted-foreground/35 leading-relaxed">
                  Ao continuar, você concorda com os{" "}
                  <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/50 transition-colors">Termos de Uso</a> e{" "}
                  <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/50 transition-colors">Política de Privacidade</a>.
                </p>
              </div>

              {/* Trust badges */}
              {isLogin && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 flex items-center justify-center gap-5 pt-5 border-t border-border/15"
                >
                  {[
                    { icon: Shield, label: "SSL Seguro" },
                    { icon: Zap, label: "Acesso Rápido" },
                    { icon: Lock, label: "Criptografia" },
                    { icon: CheckCircle2, label: "LGPD" },
                  ].map(b => (
                    <div key={b.label} className="flex items-center gap-1.5 text-muted-foreground/25">
                      <b.icon className="h-3 w-3" />
                      <span className="text-[8px] font-bold uppercase tracking-[0.15em]">{b.label}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {/* Mobile-only social proof */}
          <div className="lg:hidden mt-6 grid grid-cols-3 gap-2">
            {[
              { value: "10K+", label: "Produtores" },
              { value: "R$50M+", label: "Processados" },
              { value: "99.9%", label: "Uptime" },
            ].map(s => (
              <div key={s.label} className="text-center p-3 rounded-xl bg-card/30 backdrop-blur-sm border border-border/15">
                <p className="text-[14px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">{s.value}</p>
                <p className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-[0.12em]">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── RIGHT: Features (Desktop only) ─── */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden">
        <FloatingOrbs />

        {/* Scan-line overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 3px)",
        }} />

        <div className="max-w-sm relative z-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold mb-8 shadow-lg shadow-primary/5 tracking-wide"
          >
            <Crown className="h-3.5 w-3.5" />
            Plataforma #1 de Infoprodutos
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-4xl xl:text-[42px] font-display font-black mb-5 text-foreground leading-[1.08] tracking-[-0.04em]"
          >
            Tudo que você precisa para{" "}
            <span className="text-gradient">vender online</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-[15px] text-muted-foreground/60 mb-10 leading-[1.7] max-w-[340px]"
          >
            Checkout otimizado, área de membros, processamento de pagamentos e ferramentas avançadas de analytics.
          </motion.p>

          {/* Feature cards */}
          <div className="space-y-3">
            <FeatureCard icon={CreditCard} title="Checkout de Alta Conversão" desc="PIX, Cartão e Boleto com 1-click" tone="primary" delay={0} />
            <FeatureCard icon={GraduationCap} title="Área de Membros Netflix" desc="Entregue cursos e conteúdos premium" tone="info" delay={1} />
            <FeatureCard icon={BarChart2} title="Analytics em Tempo Real" desc="Métricas completas das suas vendas" tone="warning" delay={2} />
            <FeatureCard icon={Shield} title="Anti-fraude Integrado" desc="Blacklist, velocity check e proteção total" tone="success" delay={3} />
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-3">
            <StatCard value="10K+" label="Produtores" icon={Users} delay={0} />
            <StatCard value="R$50M+" label="Processados" icon={TrendingUp} delay={1} />
            <StatCard value="99.9%" label="Uptime" icon={Zap} delay={2} />
          </div>

          {/* Testimonial micro-card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="mt-6 p-4 rounded-2xl bg-card/30 backdrop-blur-xl border border-border/20"
          >
            <div className="flex items-center gap-2 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-warning text-warning" />
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground/70 leading-relaxed italic">
              "Migrei de outra plataforma e minhas vendas triplicaram no primeiro mês. A melhor decisão que tomei!"
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">RS</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-foreground">Rafael S.</p>
                <p className="text-[9px] text-muted-foreground/40">Infoprodutor · R$120K/mês</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
