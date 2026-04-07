/**
 * Auth — Login & Cadastro Surreal Premium v8
 * @module Auth
 * @version 8.0.0
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
  BookOpen, Play, Radio, Zap, Globe, Award,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";

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

/* ─────────────────── Animated counter ─────────────────── */
function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: string; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const numMatch = target.match(/[\d.]+/);
  const num = numMatch ? parseFloat(numMatch[0]) : 0;
  useEffect(() => {
    const steps = 45; const step = num / steps; let cur = 0;
    const iv = setInterval(() => {
      cur += step;
      if (cur >= num) { setCount(num); clearInterval(iv); } else setCount(Math.floor(cur * 10) / 10);
    }, 35);
    return () => clearInterval(iv);
  }, [num]);
  const display = Number.isInteger(num) ? count.toFixed(0) : count.toFixed(1);
  return <>{prefix}{display}{suffix}</>;
}

/* ─────────────────── Floating particles ─────────────────── */
function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 8,
      opacity: Math.random() * 0.3 + 0.05,
    })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}%`, y: `${p.y}%`, opacity: 0 }}
          animate={{
            y: [`${p.y}%`, `${p.y - 30}%`, `${p.y}%`],
            x: [`${p.x}%`, `${(p.x + 10) % 100}%`, `${p.x}%`],
            opacity: [0, p.opacity, 0],
          }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          className="absolute rounded-full bg-primary"
          style={{ width: p.size, height: p.size }}
        />
      ))}
    </div>
  );
}

/* ─────────────────── Ambient background ─────────────────── */
function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Mesh gradient orbs */}
      <motion.div
        animate={{ y: [0, -50, 0], x: [0, 25, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-[20%] -top-[20%] h-[700px] w-[700px] rounded-full bg-primary/[0.06] blur-[200px]"
      />
      <motion.div
        animate={{ y: [0, 35, 0], x: [0, -20, 0], scale: [1, 1.25, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute -right-[15%] bottom-[-20%] h-[600px] w-[600px] rounded-full bg-info/[0.05] blur-[180px]"
      />
      <motion.div
        animate={{ y: [0, -25, 0], x: [0, 15, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute left-[40%] top-[30%] h-[400px] w-[400px] rounded-full bg-primary/[0.03] blur-[150px]"
      />
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.012]" style={{
        backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "56px 56px"
      }} />
      {/* Radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background)/0.75)_90%)]" />

      <FloatingParticles />
    </div>
  );
}

/* ─────────────────── Animated gradient border card ─────────────────── */
function GlowCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 150, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 150, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const gradientBg = useTransform(
    [springX, springY],
    ([x, y]) => `radial-gradient(400px circle at ${x}px ${y}px, hsl(var(--primary) / 0.12), transparent 60%)`
  );

  return (
    <div ref={cardRef} onMouseMove={handleMouseMove} className={cn("relative group", className)}>
      {/* Animated border glow */}
      <div className="absolute -inset-px rounded-[25px] bg-gradient-to-br from-primary/20 via-border/15 to-info/15 opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
      {/* Inner card */}
      <div className="relative rounded-3xl border border-border/15 bg-card/70 backdrop-blur-2xl shadow-[0_24px_80px_hsl(var(--foreground)/0.08)] overflow-hidden">
        {/* Mouse-follow glow */}
        <motion.div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: gradientBg }} />
        {/* Static decorative elements */}
        <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <div className="absolute left-0 top-12 bottom-12 w-px bg-gradient-to-b from-primary/20 via-primary/5 to-transparent" />
        <div className="absolute right-0 top-12 bottom-12 w-px bg-gradient-to-b from-transparent via-info/5 to-info/15" />
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/[0.02] via-transparent to-info/[0.01]" />
        {/* Content */}
        <div className="relative z-[1]">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────── Feature card ─────────────────── */
function FeatureCard({ icon: Icon, title, desc, tone, delay }: {
  icon: React.ElementType; title: string; desc: string; tone: string; delay: number;
}) {
  const cfg: Record<string, { bg: string; iconText: string; accent: string; glow: string }> = {
    primary: { bg: "bg-primary/10", iconText: "text-primary", accent: "border-l-primary/40", glow: "group-hover:shadow-primary/15" },
    info: { bg: "bg-info/10", iconText: "text-info", accent: "border-l-info/40", glow: "group-hover:shadow-info/15" },
    warning: { bg: "bg-warning/10", iconText: "text-warning", accent: "border-l-warning/40", glow: "group-hover:shadow-warning/15" },
    success: { bg: "bg-success/10", iconText: "text-success", accent: "border-l-success/40", glow: "group-hover:shadow-success/15" },
  };
  const t = cfg[tone] || cfg.primary;
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.4 + delay * 0.12, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ x: 6, scale: 1.015 }}
      className={cn(
        "group flex items-center gap-4 p-4 rounded-2xl cursor-default border-l-[3px]",
        "bg-card/25 backdrop-blur-xl border border-border/12",
        "hover:bg-card/45 hover:border-border/25 transition-all duration-300",
        t.accent, t.glow, "hover:shadow-xl"
      )}
    >
      <motion.div
        whileHover={{ rotate: 8, scale: 1.15 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300", t.bg)}
      >
        <Icon className={cn("h-[18px] w-[18px]", t.iconText)} />
      </motion.div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-display font-bold text-foreground tracking-[-0.02em]">{title}</p>
        <p className="text-[10px] text-muted-foreground/45 mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/8 group-hover:text-muted-foreground/35 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
    </motion.div>
  );
}

/* ─────────────────── Platform status indicator ─────────────────── */
function PlatformStatus() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/20 backdrop-blur-xl border border-border/10">
      <div className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </div>
      <p className="text-[10px] text-muted-foreground/50 font-medium font-display truncate">
        Plataforma online — checkout e saques funcionando normalmente
      </p>
      <span className="text-[7px] font-bold text-success/50 uppercase tracking-[0.15em] font-display shrink-0">online</span>
    </div>
  );
}

/* ─────────────────── Typing effect ─────────────────── */
function TypingTitle({ texts }: { texts: string[] }) {
  const [textIdx, setTextIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const currentText = texts[textIdx];

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (charIdx < currentText.length) {
          setCharIdx(c => c + 1);
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (charIdx > 0) {
          setCharIdx(c => c - 1);
        } else {
          setIsDeleting(false);
          setTextIdx(i => (i + 1) % texts.length);
        }
      }
    }, isDeleting ? 30 : 60);
    return () => clearTimeout(timeout);
  }, [charIdx, isDeleting, currentText, texts]);

  return (
    <span className="text-gradient relative inline-block">
      {currentText.slice(0, charIdx)}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
        className="inline-block w-[2px] h-[1em] bg-primary ml-0.5 align-text-bottom rounded-full"
      />
    </span>
  );
}

/* ─────────────────── Stat card ─────────────────── */
function StatCard({ target, suffix, label, icon: Icon, prefix = "", delay }: {
  target: string; suffix: string; label: string; icon: React.ElementType; prefix?: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3, scale: 1.03 }}
      className="text-center p-4 rounded-2xl bg-card/20 backdrop-blur-xl border border-border/10 hover:border-primary/15 hover:bg-card/35 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group cursor-default"
    >
      <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/12 transition-colors">
        <Icon className="h-3.5 w-3.5 text-primary/50 group-hover:text-primary/70 transition-colors" />
      </div>
      <p className="text-[18px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">
        <AnimatedCounter target={target} suffix={suffix} prefix={prefix} />
      </p>
      <p className="text-[7px] text-muted-foreground/35 font-bold uppercase tracking-[0.15em] mt-0.5 font-display">{label}</p>
    </motion.div>
  );
}

/* ═══════════════════ MAIN AUTH COMPONENT ═══════════════════ */
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
      }
    } catch (error: unknown) {
      const msg = (error as any)?.message || "";
      if (msg.includes("Invalid login")) toast.error("E-mail ou senha incorretos.");
      else if (msg.includes("already registered")) toast.error("Este e-mail já está cadastrado.");
      else if (msg.includes("Email not confirmed")) toast.error("Confirme seu e-mail antes de acessar.");
      else toast.error("Instabilidade na rede. Tente novamente em instantes.");
    } finally { setLoading(false); }
  };

  const inputCls = "h-12 rounded-xl border-border/40 bg-background/60 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-background/80 transition-all duration-300 font-display text-sm";
  const labelCls = "text-[11px] font-bold text-foreground/60 uppercase tracking-[0.12em] mb-1.5 block font-display";

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">

      {/* ═══ LEFT: Form Panel ═══ */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden">
        <AmbientBackground />

        {/* Sticky navbar */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="sticky top-0 z-20 flex items-center justify-between p-4 md:px-7 backdrop-blur-xl bg-background/50 border-b border-border/5"
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 12, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25 ring-1 ring-primary/15"
            >
              <Rocket className="h-4 w-4 text-primary-foreground" />
            </motion.div>
            <div>
              <span className="text-sm font-display font-black tracking-[-0.04em] text-foreground">HOTZFY</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                <span className="text-[7px] text-muted-foreground/35 font-bold tracking-[0.12em] uppercase font-display">Plataforma de Infoprodutos</span>
              </div>
            </div>
          </div>
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/5 backdrop-blur-2xl border border-success/15"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            <span className="text-[8px] font-bold text-success uppercase tracking-[0.15em] font-display">Online</span>
          </motion.div>
        </motion.div>

        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 pb-10 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="w-full max-w-[440px] relative z-10"
          >
            {/* Welcome hero */}
            <div className="mb-7">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/12 text-[9px] font-bold text-primary uppercase tracking-[0.12em] mb-5 font-display shadow-lg shadow-primary/5"
              >
                <Gem className="h-3 w-3" />
                Plataforma #1 de Infoprodutos
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.7 }}
                className="text-[26px] sm:text-[30px] md:text-[34px] font-display font-black tracking-[-0.045em] text-foreground leading-[1.12]"
              >
                {isLogin ? (
                  <>Bem-vindo de <span className="text-gradient">volta</span></>
                ) : (
                  <>Comece a <span className="text-gradient">vender</span> hoje</>
                )}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="text-[13px] text-muted-foreground/60 mt-2.5 font-display leading-relaxed"
              >
                {isLogin ? "Acesse seu painel e acompanhe seus resultados" : "Crie sua conta e lance seu primeiro infoproduto"}
              </motion.p>
            </div>

            {/* Auth Card */}
            <GlowCard>
              <div className="p-6 md:p-8">
                {/* Mode toggle */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-muted/10 border border-border/8 mb-7">
                  {[
                    { mode: true, label: "Entrar", icon: Lock, activeBg: "bg-primary/12", activeText: "text-primary", activeBorder: "border-primary/20", activeShadow: "shadow-primary/10" },
                    { mode: false, label: "Criar Conta", icon: Sparkles, activeBg: "bg-info/12", activeText: "text-info", activeBorder: "border-info/20", activeShadow: "shadow-info/10" },
                  ].map(tab => (
                    <motion.button
                      key={tab.label}
                      onClick={() => setIsLogin(tab.mode)}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold uppercase tracking-[0.08em] transition-all duration-300 flex items-center justify-center gap-2",
                        isLogin === tab.mode
                          ? cn(tab.activeBg, tab.activeText, "shadow-lg border", tab.activeBorder, tab.activeShadow)
                          : "text-muted-foreground/30 hover:text-muted-foreground/50 hover:bg-muted/6"
                      )}
                    >
                      <tab.icon className="h-3.5 w-3.5" />{tab.label}
                    </motion.button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={isLogin ? "login" : "signup"}
                    initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {!isLogin && (
                        <>
                          <div>
                            <Label htmlFor="name" className={labelCls}>Nome completo</Label>
                            <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome completo"
                              className={cn(inputCls, focusedField === "name" && "shadow-md shadow-primary/5")}
                              onFocus={() => setFocusedField("name")} onBlur={() => setFocusedField(null)} required={!isLogin} />
                          </div>
                          <div>
                            <Label htmlFor="nickname" className={labelCls}>Como quer ser chamado?</Label>
                            <Input id="nickname" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Ex: João, Mari..."
                              className={cn(inputCls, focusedField === "nickname" && "shadow-md shadow-primary/5")}
                              onFocus={() => setFocusedField("nickname")} onBlur={() => setFocusedField(null)} required={!isLogin} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="document" className={labelCls}>CPF ou CNPJ</Label>
                              <Input id="document" value={document} onChange={e => handleDocumentChange(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" autoComplete="off"
                                className={cn(inputCls, documentError && "border-destructive/50 ring-1 ring-destructive/20", focusedField === "document" && "shadow-md shadow-primary/5")}
                                onFocus={() => setFocusedField("document")} onBlur={() => setFocusedField(null)} required={!isLogin} />
                              {documentError && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[9px] text-destructive mt-1 font-medium font-display">{documentError}</motion.p>}
                            </div>
                            <div>
                              <Label htmlFor="phone" className={labelCls}>WhatsApp</Label>
                              <Input id="phone" value={phone}
                                onChange={e => { const d = e.target.value.replace(/\D/g, "").slice(0, 11); let f = d; if (d.length > 2) f = `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length > 7) f = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; setPhone(f); }}
                                placeholder="(11) 99999-9999" inputMode="tel"
                                className={cn(inputCls, focusedField === "phone" && "shadow-md shadow-primary/5")}
                                onFocus={() => setFocusedField("phone")} onBlur={() => setFocusedField(null)} required={!isLogin} />
                            </div>
                          </div>
                        </>
                      )}

                      <div>
                        <Label htmlFor="email" className={labelCls}>E-mail</Label>
                        <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
                          className={cn(inputCls, focusedField === "email" && "shadow-md shadow-primary/5")}
                          onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)} required />
                      </div>

                      <div>
                        <Label htmlFor="password" className={labelCls}>Senha</Label>
                        <div className="relative">
                          <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                            className={cn(inputCls, "pr-12", focusedField === "password" && "shadow-md shadow-primary/5")}
                            onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField(null)} required minLength={8} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/20 hover:text-foreground/50 transition-colors duration-200">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {!isLogin && password.length > 0 && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2.5 space-y-1.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 flex gap-1">
                                {[1,2,3].map(i => (
                                  <motion.div key={i}
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: i <= pwStrength.score ? 1 : 0.3, opacity: i <= pwStrength.score ? 1 : 0.3 }}
                                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                    className={cn("h-1.5 flex-1 rounded-full origin-left", i <= pwStrength.score ? pwStrength.color : "bg-muted/12")}
                                  />
                                ))}
                              </div>
                              <span className={cn("text-[9px] font-bold uppercase tracking-wider font-display", pwStrength.text)}>{pwStrength.label}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/25 font-display">Mín. 8 caracteres, maiúscula, minúscula e número</p>
                          </motion.div>
                        )}
                      </div>

                      {!isLogin && (
                        <>
                          <div>
                            <Label htmlFor="confirmPassword" className={labelCls}>Confirmar Senha</Label>
                            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••"
                              className={cn(inputCls, confirmPassword && password !== confirmPassword && "border-destructive/50 ring-1 ring-destructive/20")} required={!isLogin} minLength={6} />
                            {confirmPassword && password !== confirmPassword && (
                              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[9px] text-destructive mt-1 font-medium font-display">As senhas não coincidem</motion.p>
                            )}
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

                      <div className="pt-2">
                        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }}>
                          <Button type="submit" disabled={loading}
                            className={cn("w-full gradient-primary text-primary-foreground font-display font-bold h-13 rounded-xl text-sm",
                              "shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/35",
                              "transition-all duration-200 gap-2 relative overflow-hidden h-[52px]")}>
                            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                              <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary-foreground/15 to-transparent" />
                            </div>
                            <span className="relative z-[1] flex items-center gap-2 text-[13px]">
                              {loading ? <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                : <>{isLogin ? "Entrar na plataforma" : "Criar conta grátis"}<ArrowRight className="h-4 w-4" /></>}
                            </span>
                          </Button>
                        </motion.div>
                      </div>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/8" /></div>
                      <div className="relative flex justify-center">
                        <span className="bg-card/70 backdrop-blur-sm px-4 text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/20 font-display">{isLogin ? "ou crie uma conta" : "já possui conta?"}</span>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setIsLogin(!isLogin)}
                      className="w-full h-11 rounded-xl border border-border/12 text-[12px] font-bold font-display text-muted-foreground/45 hover:text-foreground/70 hover:border-border/25 hover:bg-muted/8 transition-all duration-300"
                    >
                      {isLogin ? "Cadastre-se grátis" : "Entrar na minha conta"}
                    </motion.button>

                    <p className="text-center text-[9px] text-muted-foreground/20 leading-relaxed mt-4 font-display">
                      Ao continuar, você concorda com os{" "}
                      <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/40 transition-colors">Termos de Uso</a> e{" "}
                      <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/40 transition-colors">Política de Privacidade</a>.
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* Trust badges */}
                {isLogin && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                    className="mt-7 flex items-center justify-center gap-5 pt-5 border-t border-border/6">
                    {[{ icon: Shield, label: "SSL 256-bit" }, { icon: Fingerprint, label: "2FA Ready" }, { icon: Lock, label: "Encrypted" }, { icon: CheckCircle2, label: "LGPD" }].map((b, i) => (
                      <motion.div key={b.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.08 }}
                        className="flex items-center gap-1.5 text-muted-foreground/15 hover:text-muted-foreground/30 transition-colors cursor-default group">
                        <b.icon className="h-3 w-3 group-hover:text-primary/40 transition-colors" /><span className="text-[7px] font-bold uppercase tracking-[0.12em] font-display">{b.label}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </GlowCard>

            {/* Mobile social proof */}
            <div className="lg:hidden mt-6 grid grid-cols-3 gap-2.5">
              {[{ value: "10K+", label: "Produtores" }, { value: "R$50M+", label: "Processados" }, { value: "99.9%", label: "Uptime" }].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.08 }}
                  className="text-center p-3 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/12"
                >
                  <p className="text-[15px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">{s.value}</p>
                  <p className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-[0.12em] font-display mt-0.5">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ RIGHT: Features Panel (Desktop) ═══ */}
      <div className="hidden lg:flex flex-1 relative overflow-y-auto overflow-x-hidden border-l border-border/6">
        <AmbientBackground />

        <div className="flex-1 flex items-center justify-center p-10 xl:p-14 py-20 min-h-full">
          <div className="max-w-[390px] relative z-10">
            {/* Badge */}
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 180, damping: 18 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/12 text-primary text-[10px] font-bold mb-8 shadow-xl shadow-primary/5 tracking-wide font-display">
              <Crown className="h-3.5 w-3.5" />Plataforma Completa
            </motion.div>

            {/* Hero title with typing effect */}
            <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
              className="text-[2rem] xl:text-[2.6rem] font-display font-black mb-5 text-foreground leading-[1.04] tracking-[-0.05em]">
              Tudo para{" "}
              <TypingTitle texts={["vender online", "escalar vendas", "faturar alto", "crescer rápido"]} />
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="text-[13px] text-muted-foreground/45 mb-9 leading-[1.8] max-w-[350px] font-display">
              Checkout otimizado, área de membros, processamento de pagamentos e ferramentas avançadas para escalar seu negócio digital.
            </motion.p>

            {/* Features */}
            <div className="space-y-2.5">
              <FeatureCard icon={CreditCard} title="Checkout de Alta Conversão" desc="PIX, Cartão e Boleto com 1-click" tone="primary" delay={0} />
              <FeatureCard icon={GraduationCap} title="Área de Membros Netflix" desc="Entregue cursos e conteúdos premium" tone="info" delay={1} />
              <FeatureCard icon={BarChart2} title="Analytics em Tempo Real" desc="Métricas completas das suas vendas" tone="warning" delay={2} />
              <FeatureCard icon={Shield} title="Anti-fraude Integrado" desc="Blacklist, velocity check e proteção" tone="success" delay={3} />
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              <StatCard target="10" suffix="K+" label="Produtores" icon={Users} delay={1.1} />
              <StatCard target="50" suffix="M+" label="Processados" icon={TrendingUp} prefix="R$" delay={1.2} />
              <StatCard target="99.9" suffix="%" label="Uptime" icon={Activity} delay={1.3} />
            </div>

            {/* Platform status */}
            <div className="mt-5">
              <PlatformStatus />
            </div>

            {/* Testimonial */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 0.6 }}
              className="mt-5 p-5 rounded-2xl bg-card/20 backdrop-blur-xl border border-border/8 hover:border-border/18 transition-all duration-300 group">
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.7 + i * 0.06 }}>
                    <Star className="h-3 w-3 fill-warning text-warning" />
                  </motion.div>
                ))}
                <span className="text-[9px] text-muted-foreground/25 ml-2 font-bold font-display">5.0</span>
              </div>
              <p className="text-[12px] text-muted-foreground/50 leading-[1.8] italic font-display">
                "Migrei de outra plataforma e minhas vendas triplicaram no primeiro mês. A melhor decisão que tomei para o meu negócio!"
              </p>
              <div className="flex items-center gap-3 mt-4 pt-3.5 border-t border-border/6">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/15 to-info/10 flex items-center justify-center ring-1 ring-primary/10"
                >
                  <span className="text-[10px] font-bold text-primary font-display">RS</span>
                </motion.div>
                <div>
                  <p className="text-[11px] font-bold text-foreground font-display">Rafael S.</p>
                  <p className="text-[9px] text-muted-foreground/30 font-display">Infoprodutor · R$120K/mês</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success/40" />
                  <span className="text-[7px] text-success/40 font-bold uppercase tracking-wider font-display">Verificado</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
