/**
 * MemberAuth — Área de Membros Login/Signup Surreal Premium
 * @module MemberAuth
 * @version 3.0.0
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Lock, Mail, GraduationCap, ArrowRight, Shield, Sparkles, BookOpen, Play, Award, CheckCircle2, Fingerprint, Star, Crown, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";

/* ─── Floating particles ─── */
function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 8,
      opacity: Math.random() * 0.25 + 0.05,
    })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}%`, y: `${p.y}%`, opacity: 0 }}
          animate={{
            y: [`${p.y}%`, `${p.y - 25}%`, `${p.y}%`],
            x: [`${p.x}%`, `${(p.x + 8) % 100}%`, `${p.x}%`],
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

/* ─── Ambient background ─── */
function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ y: [0, -40, 0], x: [0, 20, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-[20%] -top-[20%] h-[600px] w-[600px] rounded-full bg-primary/[0.05] blur-[180px]"
      />
      <motion.div
        animate={{ y: [0, 30, 0], x: [0, -15, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute -right-[15%] bottom-[-15%] h-[500px] w-[500px] rounded-full bg-info/[0.04] blur-[160px]"
      />
      <motion.div
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute left-[40%] top-[35%] h-[350px] w-[350px] rounded-full bg-primary/[0.025] blur-[140px]"
      />
      <div className="absolute inset-0 opacity-[0.012]" style={{
        backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "48px 48px"
      }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background)/0.75)_90%)]" />
      <FloatingParticles />
    </div>
  );
}

/* ─── Glow card with mouse-follow ─── */
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
    ([x, y]) => `radial-gradient(350px circle at ${x}px ${y}px, hsl(var(--primary) / 0.1), transparent 60%)`
  );

  return (
    <div ref={cardRef} onMouseMove={handleMouseMove} className={cn("relative group", className)}>
      <div className="absolute -inset-px rounded-[25px] bg-gradient-to-br from-primary/18 via-border/12 to-info/12 opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative rounded-3xl border border-border/10 bg-card/55 backdrop-blur-2xl shadow-[0_24px_80px_hsl(var(--foreground)/0.06)] overflow-hidden">
        <motion.div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: gradientBg }} />
        <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <div className="absolute left-0 top-12 bottom-12 w-px bg-gradient-to-b from-primary/18 via-primary/5 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/[0.02] via-transparent to-info/[0.01]" />
        <div className="relative z-[1]">{children}</div>
      </div>
    </div>
  );
}

/* ─── Feature card ─── */
function FeatureItem({ icon: Icon, title, desc, tone, delay }: {
  icon: React.ElementType; title: string; desc: string; tone: string; delay: number;
}) {
  const cfg: Record<string, { bg: string; text: string; accent: string; glow: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", accent: "border-l-primary/40", glow: "group-hover:shadow-primary/15" },
    info: { bg: "bg-info/10", text: "text-info", accent: "border-l-info/40", glow: "group-hover:shadow-info/15" },
    warning: { bg: "bg-warning/10", text: "text-warning", accent: "border-l-warning/40", glow: "group-hover:shadow-warning/15" },
    success: { bg: "bg-success/10", text: "text-success", accent: "border-l-success/40", glow: "group-hover:shadow-success/15" },
  };
  const t = cfg[tone] || cfg.primary;
  return (
    <motion.div
      initial={{ opacity: 0, x: 36 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, delay: 0.4 + delay * 0.12, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ x: 6, scale: 1.015 }}
      className={cn(
        "group flex items-center gap-3.5 p-4 rounded-2xl cursor-default border-l-[3px]",
        "bg-card/25 backdrop-blur-xl border border-border/12",
        "hover:bg-card/45 hover:border-border/25 hover:shadow-xl transition-all duration-300",
        t.accent, t.glow
      )}
    >
      <motion.div
        whileHover={{ rotate: 8, scale: 1.15 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", t.bg)}
      >
        <Icon className={cn("h-[18px] w-[18px]", t.text)} />
      </motion.div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-display font-bold text-foreground tracking-[-0.02em]">{title}</p>
        <p className="text-[10px] text-muted-foreground/45 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ═══════════ MAIN ═══════════ */
export default function MemberAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/membros-area", { replace: true });
      setCheckingSession(false);
    });
  }, [navigate]);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Preencha todos os campos"); return; }
    if (password.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
    setLoading(true);

    if (mode === "register") {
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Este email já possui conta. Faça login.");
          setMode("login");
        } else {
          toast.error("Erro ao criar conta. Tente novamente.");
        }
        setLoading(false);
        return;
      }
      if (signUpData?.user && !signUpData.session) {
        toast.success("Conta criada! Verifique seu e-mail para ativar.");
        setMode("login");
        setLoading(false);
        return;
      }
      toast.success("Conta criada! Redirecionando...");
      navigate("/membros-area", { replace: true });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login")) {
          toast.error("Email ou senha incorretos");
        } else {
          toast.error(error.message);
        }
        setLoading(false);
        return;
      }
      navigate("/membros-area", { replace: true });
    }
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-2xl border-2 border-primary/20 border-t-primary"
          />
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-2xl shadow-primary/10">
            <GraduationCap className="h-7 w-7 text-primary/60" />
          </div>
        </div>
      </div>
    );
  }

  const inputCls = "h-12 rounded-xl border-border/20 bg-muted/12 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/25 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-muted/20 transition-all duration-300 font-display text-sm";

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">

      {/* ═══ LEFT: Form ═══ */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden">
        <AmbientBackground />

        {/* Sticky header */}
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
              className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/50 flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-primary/15"
            >
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </motion.div>
            <div>
              <span className="text-sm font-display font-black tracking-[-0.04em] text-foreground">Área de Membros</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                <span className="text-[7px] text-muted-foreground/35 font-bold tracking-[0.12em] uppercase font-display">Conteúdo Exclusivo</span>
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
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="w-full max-w-[420px] relative z-10"
          >
            {/* Welcome */}
            <div className="mb-7">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/12 text-[9px] font-bold text-primary uppercase tracking-[0.12em] mb-5 font-display shadow-lg shadow-primary/5"
              >
                <BookOpen className="h-3 w-3" />
                Acesso Exclusivo
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.7 }}
                className="text-[28px] font-display font-black tracking-[-0.045em] text-foreground leading-[1.08]"
              >
                {mode === "login" ? (
                  <>Acesse seus <span className="text-gradient">cursos</span></>
                ) : (
                  <>Crie sua <span className="text-gradient">conta</span></>
                )}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="text-sm text-muted-foreground/50 mt-2.5 font-display"
              >
                {mode === "login" ? "Entre para acessar seus conteúdos exclusivos" : "Cadastre-se para começar a aprender"}
              </motion.p>
            </div>

            {/* Card */}
            <GlowCard>
              <div className="p-6 md:p-8">
                {/* Mode toggle */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-muted/10 border border-border/8 mb-7">
                  {[
                    { key: "login" as const, label: "Entrar", icon: Lock, activeBg: "bg-primary/12", activeText: "text-primary", activeBorder: "border-primary/20", activeShadow: "shadow-primary/10" },
                    { key: "register" as const, label: "Criar Conta", icon: Sparkles, activeBg: "bg-info/12", activeText: "text-info", activeBorder: "border-info/20", activeShadow: "shadow-info/10" },
                  ].map(tab => (
                    <motion.button
                      key={tab.key}
                      onClick={() => setMode(tab.key)}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold uppercase tracking-[0.08em] transition-all duration-300 flex items-center justify-center gap-2",
                        mode === tab.key
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
                    key={mode}
                    initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-1.5 block">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/20" />
                          <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            className={cn(inputCls, "pl-10 w-full", focusedField === "email" && "shadow-md shadow-primary/5")}
                            onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)}
                            readOnly={!!emailParam}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-1.5 block">
                          {mode === "register" ? "Crie sua senha" : "Senha"}
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/20" />
                          <input
                            type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                            placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                            className={cn(inputCls, "pl-10 pr-12 w-full", focusedField === "password" && "shadow-md shadow-primary/5")}
                            onFocus={() => setFocusedField("password")} onBlur={() => setFocusedField(null)}
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }}>
                          <button type="submit" disabled={loading}
                            className="w-full h-[52px] rounded-xl gradient-primary text-primary-foreground text-[13px] font-display font-bold shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/35 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden">
                            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                              <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary-foreground/15 to-transparent" />
                            </div>
                            <span className="relative z-[1] flex items-center gap-2">
                              {loading ? (
                                <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                              ) : (
                                <>
                                  {mode === "register" ? "Criar Conta" : "Entrar"}
                                  <ArrowRight className="h-4 w-4" />
                                </>
                              )}
                            </span>
                          </button>
                        </motion.div>
                      </div>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/8" /></div>
                      <div className="relative flex justify-center">
                        <span className="bg-card/70 backdrop-blur-sm px-4 text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/20 font-display">
                          {mode === "login" ? "primeira vez?" : "já tem conta?"}
                        </span>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setMode(mode === "login" ? "register" : "login")}
                      className="w-full h-11 rounded-xl border border-border/12 text-[12px] font-bold font-display text-muted-foreground/45 hover:text-foreground/70 hover:border-border/25 hover:bg-muted/8 transition-all duration-300"
                    >
                      {mode === "login" ? "Criar conta" : "Fazer login"}
                    </motion.button>
                  </motion.div>
                </AnimatePresence>

                {/* Trust badges */}
                {mode === "login" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                    className="mt-7 flex items-center justify-center gap-5 pt-5 border-t border-border/6">
                    {[{ icon: Shield, label: "SSL 256-bit" }, { icon: Fingerprint, label: "Seguro" }, { icon: Lock, label: "Encrypted" }, { icon: CheckCircle2, label: "LGPD" }].map((b, i) => (
                      <motion.div key={b.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.08 }}
                        className="flex items-center gap-1.5 text-muted-foreground/15 hover:text-muted-foreground/30 transition-colors cursor-default group">
                        <b.icon className="h-3 w-3 group-hover:text-primary/40 transition-colors" /><span className="text-[7px] font-bold uppercase tracking-[0.12em] font-display">{b.label}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </GlowCard>

            {/* Mobile feature chips */}
            <div className="lg:hidden mt-6 grid grid-cols-3 gap-2.5">
              {[{ icon: Play, label: "Aulas HD" }, { icon: Award, label: "Certificado" }, { icon: BookOpen, label: "Material" }].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.08 }}
                  className="text-center p-3 rounded-2xl bg-card/20 backdrop-blur-sm border border-border/8 flex flex-col items-center gap-1.5 hover:border-primary/12 transition-all duration-300"
                >
                  <s.icon className="h-4 w-4 text-primary/45" />
                  <p className="text-[8px] text-muted-foreground/35 font-bold uppercase tracking-[0.12em] font-display">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ RIGHT: Features (Desktop) ═══ */}
      <div className="hidden lg:flex flex-1 relative overflow-y-auto overflow-x-hidden border-l border-border/6">
        <AmbientBackground />

        <div className="flex-1 flex items-center justify-center p-10 xl:p-14 py-20 min-h-full">
          <div className="max-w-[370px] relative z-10">
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 180, damping: 18 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/12 text-primary text-[10px] font-bold mb-8 shadow-xl shadow-primary/5 tracking-wide font-display">
              <GraduationCap className="h-3.5 w-3.5" />Conteúdo Premium
            </motion.div>

            <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
              className="text-[2rem] xl:text-[2.5rem] font-display font-black mb-5 text-foreground leading-[1.04] tracking-[-0.05em]">
              Aprenda com os{" "}
              <span className="text-gradient relative inline-block">
                melhores
                <motion.div className="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-primary via-primary/50 to-transparent"
                  initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.9 }} />
              </span>
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="text-[13px] text-muted-foreground/45 mb-9 leading-[1.8] max-w-[340px] font-display">
              Acesse cursos completos, materiais exclusivos e certificados reconhecidos pelo mercado.
            </motion.p>

            <div className="space-y-2.5">
              <FeatureItem icon={Play} title="Aulas em Alta Definição" desc="Conteúdo gravado com qualidade profissional" tone="primary" delay={0} />
              <FeatureItem icon={BookOpen} title="Material Complementar" desc="PDFs, planilhas e recursos exclusivos" tone="info" delay={1} />
              <FeatureItem icon={Award} title="Certificado de Conclusão" desc="Certificado digital reconhecido" tone="warning" delay={2} />
              <FeatureItem icon={Shield} title="Acesso Vitalício" desc="Seus cursos ficam disponíveis para sempre" tone="success" delay={3} />
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[{ icon: Users, value: "5K+", label: "Alunos" }, { icon: Play, value: "200+", label: "Aulas" }, { icon: Star, value: "4.9", label: "Avaliação" }].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 + i * 0.1 }}
                  whileHover={{ y: -3, scale: 1.03 }}
                  className="text-center p-4 rounded-2xl bg-card/20 backdrop-blur-xl border border-border/8 hover:border-primary/15 hover:bg-card/35 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group cursor-default"
                >
                  <s.icon className="h-3.5 w-3.5 mx-auto mb-2 text-primary/40 group-hover:text-primary/60 transition-colors" />
                  <p className="text-[17px] font-display font-black text-foreground tracking-[-0.03em] tabular-nums">{s.value}</p>
                  <p className="text-[7px] text-muted-foreground/35 font-bold uppercase tracking-[0.15em] mt-0.5 font-display">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Testimonial */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5, duration: 0.6 }}
              className="mt-6 p-5 rounded-2xl bg-card/20 backdrop-blur-xl border border-border/8 hover:border-border/18 transition-all duration-300">
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.6 + i * 0.06 }}>
                    <Star className="h-3 w-3 fill-warning text-warning" />
                  </motion.div>
                ))}
              </div>
              <p className="text-[12px] text-muted-foreground/50 leading-[1.8] italic font-display">
                "O conteúdo é incrível e a plataforma é muito fácil de usar. Melhor investimento que fiz na minha carreira!"
              </p>
              <div className="flex items-center gap-3 mt-4 pt-3.5 border-t border-border/6">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="h-9 w-9 rounded-full bg-gradient-to-br from-info/15 to-primary/10 flex items-center justify-center ring-1 ring-info/10"
                >
                  <span className="text-[10px] font-bold text-info font-display">MC</span>
                </motion.div>
                <div>
                  <p className="text-[11px] font-bold text-foreground font-display">Mariana C.</p>
                  <p className="text-[9px] text-muted-foreground/30 font-display">Aluna · 12 cursos concluídos</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success/40" />
                  <span className="text-[7px] text-success/40 font-bold uppercase tracking-wider font-display">Verificada</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
