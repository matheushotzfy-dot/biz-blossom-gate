/**
 * MemberAuth — Área de Membros Login/Signup Ultra-Premium
 * @module MemberAuth
 * @version 2.0.0
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Lock, Mail, GraduationCap, ArrowRight, Shield, Sparkles, BookOpen, Play, Award, CheckCircle2, Fingerprint, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Floating orbs ─── */
function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ y: [0, -35, 0], x: [0, 18, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-48 -top-48 h-[550px] w-[550px] rounded-full bg-primary/[0.05] blur-[170px]"
      />
      <motion.div
        animate={{ y: [0, 25, 0], x: [0, -12, 0], scale: [1, 1.18, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute -right-36 bottom-[-80px] h-[450px] w-[450px] rounded-full bg-info/[0.04] blur-[150px]"
      />
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "48px 48px"
      }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background)/0.7)_85%)]" />
    </div>
  );
}

/* ─── Feature item ─── */
function FeatureItem({ icon: Icon, title, desc, tone, delay }: {
  icon: React.ElementType; title: string; desc: string; tone: string; delay: number;
}) {
  const cfg: Record<string, { bg: string; text: string; accent: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", accent: "border-l-primary/40" },
    info: { bg: "bg-info/10", text: "text-info", accent: "border-l-info/40" },
    warning: { bg: "bg-warning/10", text: "text-warning", accent: "border-l-warning/40" },
    success: { bg: "bg-success/10", text: "text-success", accent: "border-l-success/40" },
  };
  const t = cfg[tone] || cfg.primary;
  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, delay: 0.5 + delay * 0.12, ease: [0.22, 0.61, 0.36, 1] }}
      whileHover={{ x: 5 }}
      className={cn(
        "group flex items-center gap-3.5 p-3.5 rounded-2xl cursor-default border-l-[3px]",
        "bg-card/30 backdrop-blur-xl border border-border/15",
        "hover:bg-card/45 hover:border-border/30 hover:shadow-lg transition-all duration-300",
        t.accent
      )}
    >
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110", t.bg)}>
        <Icon className={cn("h-4 w-4", t.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-display font-bold text-foreground tracking-[-0.02em]">{title}</p>
        <p className="text-[9px] text-muted-foreground/50 mt-0.5">{desc}</p>
      </div>
    </motion.div>
  );
}

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
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-2xl shadow-primary/10">
            <GraduationCap className="h-7 w-7 text-primary/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      </div>
    );
  }

  const inputCls = "h-12 rounded-xl border-border/20 bg-muted/15 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 focus:bg-muted/25 transition-all duration-300 font-display text-sm";

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">

      {/* ─── LEFT: Form ─── */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden">
        <FloatingOrbs />

        {/* Sticky header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="sticky top-0 z-20 flex items-center justify-between p-4 md:px-6"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/50 flex items-center justify-center shadow-lg shadow-primary/20">
              <GraduationCap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-display font-black tracking-[-0.04em] text-foreground">Área de Membros</span>
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
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[420px] relative z-10"
          >
            {/* Welcome */}
            <div className="mb-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 text-[9px] font-bold text-primary uppercase tracking-[0.12em] mb-4 font-display"
              >
                <BookOpen className="h-3 w-3" />
                Acesso Exclusivo
              </motion.div>
              <h1 className="text-2xl font-display font-black tracking-[-0.04em] text-foreground leading-[1.1]">
                {mode === "login" ? "Acesse seus cursos" : "Crie sua conta"}
              </h1>
              <p className="text-sm text-muted-foreground/50 mt-2 font-display">
                {mode === "login" ? "Entre para acessar seus conteúdos exclusivos" : "Cadastre-se para começar a aprender"}
              </p>
            </div>

            {/* Card */}
            <div className="relative rounded-3xl border border-border/20 bg-card/50 backdrop-blur-2xl shadow-[0_20px_80px_hsl(var(--foreground)/0.06)]">
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className="absolute left-0 top-10 bottom-10 w-px bg-gradient-to-b from-primary/20 via-primary/5 to-transparent" />
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/[0.02] via-transparent to-info/[0.01]" />

              <div className="relative z-[1] p-6 md:p-8">
                {/* Mode toggle */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/12 border border-border/10 mb-7">
                  <button
                    onClick={() => setMode("login")}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold uppercase tracking-[0.08em] transition-all duration-300 flex items-center justify-center gap-2",
                      mode === "login"
                        ? "bg-primary/15 text-primary shadow-lg shadow-primary/10 border border-primary/20"
                        : "text-muted-foreground/35 hover:text-muted-foreground/55 hover:bg-muted/8"
                    )}
                  >
                    <Lock className="h-3.5 w-3.5" />Entrar
                  </button>
                  <button
                    onClick={() => setMode("register")}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold uppercase tracking-[0.08em] transition-all duration-300 flex items-center justify-center gap-2",
                      mode === "register"
                        ? "bg-info/15 text-info shadow-lg shadow-info/10 border border-info/20"
                        : "text-muted-foreground/35 hover:text-muted-foreground/55 hover:bg-muted/8"
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />Criar Conta
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-1.5 block">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/25" />
                          <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            className={cn(inputCls, "pl-10 w-full")}
                            readOnly={!!emailParam}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-1.5 block">
                          {mode === "register" ? "Crie sua senha" : "Senha"}
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/25" />
                          <input
                            type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                            placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                            className={cn(inputCls, "pl-10 pr-12 w-full")}
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-1">
                        <button type="submit" disabled={loading}
                          className="w-full h-12 rounded-xl gradient-primary text-primary-foreground text-sm font-display font-bold shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.985] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden">
                          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary-foreground/15 to-transparent" />
                          </div>
                          <span className="relative z-[1] flex items-center gap-2">
                            {loading ? (
                              <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            ) : (
                              <>
                                {mode === "register" ? "Criar Conta" : "Entrar"}
                                <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </span>
                        </button>
                      </div>
                    </form>

                    {/* Divider */}
                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/10" /></div>
                      <div className="relative flex justify-center">
                        <span className="bg-card/60 backdrop-blur-sm px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground/25 font-display">
                          {mode === "login" ? "primeira vez?" : "já tem conta?"}
                        </span>
                      </div>
                    </div>

                    <button onClick={() => setMode(mode === "login" ? "register" : "login")}
                      className="w-full h-10 rounded-xl border border-border/15 text-[12px] font-bold font-display text-muted-foreground/50 hover:text-foreground/70 hover:border-border/30 hover:bg-muted/10 transition-all duration-300">
                      {mode === "login" ? "Criar conta" : "Fazer login"}
                    </button>
                  </motion.div>
                </AnimatePresence>

                {/* Trust badges */}
                {mode === "login" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="mt-6 flex items-center justify-center gap-5 pt-5 border-t border-border/8">
                    {[{ icon: Shield, label: "SSL 256-bit" }, { icon: Fingerprint, label: "Seguro" }, { icon: Lock, label: "Encrypted" }, { icon: CheckCircle2, label: "LGPD" }].map((b, i) => (
                      <motion.div key={b.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.08 }}
                        className="flex items-center gap-1.5 text-muted-foreground/20">
                        <b.icon className="h-3 w-3" /><span className="text-[7px] font-bold uppercase tracking-[0.12em] font-display">{b.label}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Mobile feature cards */}
            <div className="lg:hidden mt-6 grid grid-cols-3 gap-2.5">
              {[{ icon: Play, label: "Aulas HD" }, { icon: Award, label: "Certificado" }, { icon: BookOpen, label: "Material" }].map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                  className="text-center p-3 rounded-2xl bg-card/25 backdrop-blur-sm border border-border/10 flex flex-col items-center gap-1.5"
                >
                  <s.icon className="h-4 w-4 text-primary/50" />
                  <p className="text-[8px] text-muted-foreground/40 font-bold uppercase tracking-[0.12em] font-display">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── RIGHT: Features (Desktop) ─── */}
      <div className="hidden lg:flex flex-1 relative overflow-y-auto overflow-x-hidden border-l border-border/8">
        <FloatingOrbs />
        <div className="pointer-events-none absolute inset-0 opacity-[0.006]" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 3px)",
        }} />

        <div className="flex-1 flex items-center justify-center p-10 xl:p-14 py-20 min-h-full">
          <div className="max-w-[360px] relative z-10">
            <motion.div initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-[10px] font-bold mb-7 shadow-lg shadow-primary/5 tracking-wide font-display">
              <GraduationCap className="h-3 w-3" />Conteúdo Premium
            </motion.div>

            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
              className="text-3xl xl:text-[2.5rem] font-display font-black mb-4 text-foreground leading-[1.06] tracking-[-0.045em]">
              Aprenda com os{" "}
              <span className="text-gradient relative inline-block">
                melhores
                <motion.div className="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-primary via-primary/50 to-transparent"
                  initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.9 }} />
              </span>
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
              className="text-[13px] text-muted-foreground/50 mb-8 leading-[1.75] max-w-[340px] font-display">
              Acesse cursos completos, materiais exclusivos e certificados reconhecidos pelo mercado.
            </motion.p>

            <div className="space-y-2.5">
              <FeatureItem icon={Play} title="Aulas em Alta Definição" desc="Conteúdo gravado com qualidade profissional" tone="primary" delay={0} />
              <FeatureItem icon={BookOpen} title="Material Complementar" desc="PDFs, planilhas e recursos exclusivos" tone="info" delay={1} />
              <FeatureItem icon={Award} title="Certificado de Conclusão" desc="Certificado digital reconhecido" tone="warning" delay={2} />
              <FeatureItem icon={Shield} title="Acesso Vitalício" desc="Seus cursos ficam disponíveis para sempre" tone="success" delay={3} />
            </div>

            {/* Testimonial */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}
              className="mt-8 p-5 rounded-2xl bg-card/25 backdrop-blur-xl border border-border/10">
              <div className="flex items-center gap-1 mb-2.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-warning text-warning" />)}
              </div>
              <p className="text-[12px] text-muted-foreground/55 leading-[1.75] italic font-display">
                "O conteúdo é incrível e a plataforma é muito fácil de usar. Recomendo!"
              </p>
              <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-border/8">
                <div className="h-8 w-8 rounded-full bg-info/10 flex items-center justify-center ring-1 ring-info/10">
                  <span className="text-[10px] font-bold text-info font-display">MC</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-foreground font-display">Mariana C.</p>
                  <p className="text-[9px] text-muted-foreground/35 font-display">Aluna · 12 cursos concluídos</p>
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
