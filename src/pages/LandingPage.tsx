/**
 * HOTZFY — Landing Page Premium
 * Gateway de Pagamentos para Infoprodutos
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import {
  Rocket, ArrowRight, Shield, Zap, BarChart2, CreditCard, Users,
  CheckCircle2, Star, TrendingUp, Globe, Lock, ChevronRight,
  Play, Sparkles, Award, Crown, Activity, QrCode, Wallet,
  Smartphone, LineChart, Target, Gem, Eye, Timer, Heart,
  Gift, BadgeCheck, ArrowUpRight, ChevronDown, Fingerprint,
  BookOpen, Layers, Radio, Code2, RefreshCw, CircleDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import hotzfyLogo from "@/assets/hotzfy-logo.png";
import dashboardMockup from "@/assets/hero-dashboard-mockup.jpg";
import abstractGem from "@/assets/hero-abstract-gem.png";

/* ─── Animated counter ─── */
function Counter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let cur = 0;
    const steps = 50;
    const step = target / steps;
    const iv = setInterval(() => {
      cur += step;
      if (cur >= target) { setCount(target); clearInterval(iv); }
      else setCount(Math.floor(cur));
    }, 30);
    return () => clearInterval(iv);
  }, [inView, target]);
  return <span ref={ref}>{prefix}{Number.isInteger(target) ? count : count.toFixed(1)}{suffix}</span>;
}

/* ─── Floating particles ─── */
function Particles() {
  const particles = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: Math.random() * 3 + 1, dur: Math.random() * 20 + 12,
      delay: Math.random() * 10, opacity: Math.random() * 0.2 + 0.05,
    })), []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map(p => (
        <motion.div key={p.id}
          initial={{ x: `${p.x}%`, y: `${p.y}%`, opacity: 0 }}
          animate={{ y: [`${p.y}%`, `${p.y - 25}%`, `${p.y}%`], x: [`${p.x}%`, `${(p.x + 8) % 100}%`, `${p.x}%`], opacity: [0, p.opacity, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          className="absolute rounded-full bg-primary" style={{ width: p.size, height: p.size }}
        />
      ))}
    </div>
  );
}

/* ─── Section wrapper ─── */
function Section({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("relative py-24 md:py-32 px-4 md:px-8", className)}>
      <div className="max-w-7xl mx-auto relative z-10">{children}</div>
    </section>
  );
}

/* ─── Section header ─── */
function SectionHeader({ badge, title, subtitle, center = true }: { badge: string; title: React.ReactNode; subtitle: string; center?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={cn("mb-16", center && "text-center")}
    >
      <div className={cn("inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-[10px] font-bold text-primary uppercase tracking-[0.15em] mb-6 font-display", center && "mx-auto")}>
        <Sparkles className="h-3 w-3" />{badge}
      </div>
      <h2 className="text-3xl md:text-5xl font-display font-black tracking-[-0.04em] text-foreground leading-[1.1]">{title}</h2>
      <p className="text-base md:text-lg text-muted-foreground/60 mt-4 max-w-2xl font-display leading-relaxed mx-auto">{subtitle}</p>
    </motion.div>
  );
}

/* ─── Feature Bento Card ─── */
function BentoCard({ icon: Icon, title, desc, tone, delay, large }: {
  icon: React.ElementType; title: string; desc: string; tone: string; delay: number; large?: boolean;
}) {
  const colors: Record<string, { bg: string; icon: string; border: string; glow: string }> = {
    primary: { bg: "bg-primary/8", icon: "text-primary", border: "border-l-primary/30", glow: "group-hover:shadow-primary/10" },
    info: { bg: "bg-info/8", icon: "text-info", border: "border-l-info/30", glow: "group-hover:shadow-info/10" },
    warning: { bg: "bg-warning/8", icon: "text-warning", border: "border-l-warning/30", glow: "group-hover:shadow-warning/10" },
    success: { bg: "bg-success/8", icon: "text-success", border: "border-l-success/30", glow: "group-hover:shadow-success/10" },
  };
  const t = colors[tone] || colors.primary;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: delay * 0.08, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={cn(
        "group relative p-6 md:p-8 rounded-3xl border-l-[3px] cursor-default",
        "bg-card/40 backdrop-blur-xl border border-border/10",
        "hover:bg-card/60 hover:border-border/20 transition-all duration-500",
        t.border, t.glow, "hover:shadow-2xl",
        large && "md:col-span-2"
      )}
    >
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/[0.02] via-transparent to-info/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-[1]">
        <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center mb-5", t.bg)}>
          <Icon className={cn("h-5 w-5", t.icon)} />
        </div>
        <h3 className="text-lg font-display font-bold text-foreground tracking-[-0.02em] mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground/50 leading-relaxed font-display">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ─── Pricing Card ─── */
function PricingCard({ name, price, desc, features, popular, delay }: {
  name: string; price: string; desc: string; features: string[]; popular?: boolean; delay: number;
}) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: delay * 0.1 }}
      whileHover={{ y: -6, scale: 1.02 }}
      className={cn(
        "relative rounded-3xl p-8 transition-all duration-500",
        popular
          ? "bg-gradient-to-br from-primary/15 via-card/80 to-info/10 border-2 border-primary/30 shadow-2xl shadow-primary/10"
          : "bg-card/40 backdrop-blur-xl border border-border/15 hover:border-primary/15 hover:shadow-xl"
      )}
    >
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gradient-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.15em] font-display shadow-lg shadow-primary/25">
          Mais Popular
        </div>
      )}
      <div className="mb-6">
        <h3 className="text-lg font-display font-bold text-foreground">{name}</h3>
        <p className="text-xs text-muted-foreground/50 mt-1 font-display">{desc}</p>
      </div>
      <div className="mb-6">
        <span className="text-4xl font-display font-black text-foreground tracking-[-0.04em]">{price}</span>
        <span className="text-sm text-muted-foreground/40 font-display ml-1">por venda</span>
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-sm text-muted-foreground/60 font-display">{f}</span>
          </li>
        ))}
      </ul>
      <Button
        onClick={() => navigate("/auth")}
        className={cn(
          "w-full h-12 rounded-xl font-display font-bold text-sm transition-all duration-300",
          popular
            ? "gradient-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35"
            : "bg-card border border-border/20 text-foreground hover:bg-primary/10 hover:border-primary/20"
        )}
      >
        Começar agora <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </motion.div>
  );
}


/* ─── Live Status ─── */
function LiveStatus() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
      className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-card/30 backdrop-blur-xl border border-border/10 shadow-lg">
      <div className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </div>
      <span className="text-[11px] text-muted-foreground/50 font-display font-medium">Plataforma online — todos os sistemas operacionais</span>
    </motion.div>
  );
}

/* ═══ FAQ Item ═══ */
function FaqItem({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: delay * 0.08 }}
      className="border-b border-border/8 last:border-0"
    >
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left group">
        <span className="text-sm font-display font-semibold text-foreground group-hover:text-primary transition-colors pr-4">{q}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground/30 transition-transform duration-300 shrink-0", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden">
            <p className="text-sm text-muted-foreground/50 pb-5 leading-relaxed font-display">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════ LANDING PAGE ═══════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const headerBg = useTransform(scrollYProgress, [0, 0.05], [0, 1]);
  const [scrolled, setScrolled] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close mobile nav on scroll
  useEffect(() => {
    if (mobileNav) {
      const close = () => setMobileNav(false);
      window.addEventListener("scroll", close, { passive: true, once: true });
      return () => window.removeEventListener("scroll", close);
    }
  }, [mobileNav]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ═══ NAVBAR ═══ */}
      <motion.nav className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        scrolled || mobileNav ? "bg-background/80 backdrop-blur-2xl border-b border-border/10 shadow-lg shadow-black/5" : "bg-transparent"
      )}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 h-14 md:h-20">
          <div className="flex items-center gap-2.5">
            <motion.img src={hotzfyLogo} alt="HOTZFY" className="h-7 w-7 md:h-9 md:w-9" whileHover={{ rotate: 12, scale: 1.1 }} />
            <span className="text-sm md:text-lg font-display font-black tracking-[-0.04em] text-foreground">HOTZFY</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Recursos", href: "#recursos" },
              { label: "Preços", href: "#precos" },
              { label: "Depoimentos", href: "#depoimentos" },
              { label: "FAQ", href: "#faq" },
            ].map(link => (
              <a key={link.href} href={link.href} className="text-sm text-muted-foreground/50 hover:text-foreground font-display font-medium transition-colors duration-200">{link.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")} className="hidden sm:inline-flex text-sm font-display font-semibold text-muted-foreground/60 hover:text-foreground">
              Entrar
            </Button>
            <Button onClick={() => navigate("/auth")} className="gradient-primary text-primary-foreground font-display font-bold text-xs md:text-sm h-9 md:h-10 px-4 md:px-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              Criar conta <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
            {/* Mobile hamburger */}
            <button onClick={() => setMobileNav(!mobileNav)} className="md:hidden h-9 w-9 rounded-xl bg-card/40 flex items-center justify-center border border-border/15">
              {mobileNav
                ? <span className="text-foreground text-lg leading-none">✕</span>
                : <span className="flex flex-col gap-1 items-center"><span className="block w-4 h-0.5 bg-foreground rounded" /><span className="block w-4 h-0.5 bg-foreground rounded" /><span className="block w-3 h-0.5 bg-foreground rounded" /></span>}
            </button>
          </div>
        </div>
        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileNav && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden overflow-hidden bg-background/95 backdrop-blur-2xl border-t border-border/10"
            >
              <div className="px-4 py-4 space-y-1">
                {[
                  { label: "Recursos", href: "#recursos" },
                  { label: "Preços", href: "#precos" },
                  { label: "Depoimentos", href: "#depoimentos" },
                  { label: "FAQ", href: "#faq" },
                ].map(link => (
                  <a key={link.href} href={link.href} onClick={() => setMobileNav(false)} className="block px-4 py-3 rounded-xl text-sm font-display font-semibold text-muted-foreground/60 hover:text-foreground hover:bg-card/40 transition-all">{link.label}</a>
                ))}
                <button onClick={() => { setMobileNav(false); navigate("/auth"); }} className="block w-full text-left px-4 py-3 rounded-xl text-sm font-display font-semibold text-primary hover:bg-primary/5 transition-all sm:hidden">
                  Entrar na conta
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[100dvh] flex items-center pt-16 md:pt-20 overflow-hidden">
        {/* Background effects */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div animate={{ y: [0, -40, 0], x: [0, 20, 0], scale: [1, 1.15, 1] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-[25%] -top-[15%] h-[800px] w-[800px] rounded-full bg-primary/[0.07] blur-[250px]" />
          <motion.div animate={{ y: [0, 30, 0], x: [0, -15, 0], scale: [1, 1.2, 1] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 5 }}
            className="absolute -right-[20%] bottom-[10%] h-[600px] w-[600px] rounded-full bg-info/[0.05] blur-[200px]" />
          <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 8 }}
            className="absolute left-[50%] top-[40%] h-[500px] w-[500px] rounded-full bg-primary/[0.03] blur-[180px]" />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background)/0.8)_80%)]" />
          <Particles />
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 w-full py-10 md:py-0">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left column */}
            <div>
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-[10px] font-bold text-primary uppercase tracking-[0.15em] mb-8 font-display shadow-lg shadow-primary/5">
                <Gem className="h-3 w-3" />
                Gateway #1 para Infoprodutos no Brasil
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.8 }}
                className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-display font-black tracking-[-0.045em] text-foreground leading-[1.08] mb-5 md:mb-6">
                Venda seus{" "}
                <span className="text-gradient">infoprodutos</span>{" "}
                sem limites
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                className="text-base md:text-xl text-muted-foreground/55 font-display leading-relaxed mb-6 md:mb-8 max-w-lg">
                Plataforma completa de pagamentos com checkout inteligente, área de membros, e as menores taxas do mercado.
              </motion.p>

              {/* Stats row */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
                className="grid grid-cols-3 gap-3 md:flex md:flex-wrap md:gap-10 mb-8 md:mb-10">
                {[
                  { value: 99.9, suffix: "%", label: "Uptime", icon: Activity },
                  { value: 1.99, suffix: "%", label: "Taxa PIX", icon: QrCode },
                  { value: 50, suffix: "K+", label: "Vendas/mês", icon: TrendingUp },
                ].map((stat, i) => (
                  <div key={i} className="flex flex-col md:flex-row items-center md:items-center gap-1.5 md:gap-3">
                    <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-primary/8 flex items-center justify-center">
                      <stat.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    </div>
                    <div className="text-center md:text-left">
                      <p className="text-base md:text-xl font-display font-black text-foreground tracking-[-0.03em] tabular-nums">
                        <Counter target={stat.value} suffix={stat.suffix} />
                      </p>
                      <p className="text-[8px] md:text-[9px] text-muted-foreground/35 font-bold uppercase tracking-[0.12em] font-display">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* CTA buttons */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
                className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-6 md:mb-8">
                <Button onClick={() => navigate("/auth")} size="lg"
                  className="gradient-primary text-primary-foreground font-display font-bold text-sm md:text-base h-12 md:h-14 px-6 md:px-8 rounded-2xl shadow-2xl shadow-primary/25 hover:shadow-[0_20px_60px] hover:shadow-primary/35 transition-all duration-300 relative overflow-hidden group w-full sm:w-auto">
                  <div className="absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  </div>
                  <span className="relative flex items-center gap-2">Começar gratuitamente <ArrowRight className="h-5 w-5" /></span>
                </Button>
                <Button variant="ghost" size="lg" onClick={() => {
                  const el = document.getElementById("recursos");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                  className="h-14 px-6 rounded-2xl text-base font-display font-semibold text-muted-foreground/50 hover:text-foreground border border-border/10 hover:border-border/20 hover:bg-card/30 transition-all">
                  <Play className="h-4 w-4 mr-2" /> Conhecer recursos
                </Button>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
                <LiveStatus />
              </motion.div>
            </div>

            {/* Right column — Dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, x: 60, rotateY: 8 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative hidden lg:block"
            >
              {/* Glow behind */}
              <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-primary/15 via-transparent to-info/10 blur-3xl opacity-50" />
              {/* Floating gem */}
              <motion.img src={abstractGem} alt="" aria-hidden className="absolute -top-16 -right-12 w-32 h-32 z-20 opacity-60"
                animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                loading="lazy" width={800} height={800} />
              {/* Main mockup */}
              <div className="relative rounded-3xl overflow-hidden border border-border/15 shadow-[0_40px_100px_rgba(0,0,0,0.15)]">
                <img src={dashboardMockup} alt="HOTZFY Dashboard" className="w-full h-auto" width={1920} height={1080} />
                {/* Glass overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
              </div>
              {/* Floating metric cards */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -left-8 top-1/3 p-4 rounded-2xl bg-card/80 backdrop-blur-xl border border-border/15 shadow-2xl z-20"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/40 font-display font-bold uppercase tracking-wider">Hoje</p>
                    <p className="text-lg font-display font-black text-foreground tabular-nums">R$ 12.450</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -right-6 bottom-1/4 p-3 rounded-2xl bg-card/80 backdrop-blur-xl border border-border/15 shadow-2xl z-20"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground/40 font-display font-bold uppercase tracking-wider">Aprovação</p>
                    <p className="text-base font-display font-black text-primary tabular-nums">98.7%</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF BAR ═══ */}
      <Section className="py-12 md:py-16 border-y border-border/5">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
            {[
              { number: "2K+", label: "produtores ativos" },
              { number: "R$ 50M+", label: "processados" },
              { number: "99.9%", label: "uptime" },
              { number: "<2s", label: "tempo de saque PIX" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card/20 border border-border/8">
                <span className="text-lg font-display font-black text-primary tabular-nums">{item.number}</span>
                <span className="text-[10px] text-muted-foreground/40 font-display font-medium uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* ═══ FEATURES BENTO GRID ═══ */}
      <Section id="recursos">
        <SectionHeader
          badge="Recursos"
          title={<>Tudo que você precisa para <span className="text-gradient">escalar vendas</span></>}
          subtitle="Uma plataforma completa com checkout inteligente, área de membros, e ferramentas de otimização integradas."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <BentoCard icon={QrCode} title="PIX Instantâneo" desc="QR Code gerado em segundos. Taxa de apenas 1.99% por transação aprovada. Confirmação automática via webhook." tone="primary" delay={0} />
          <BentoCard icon={CreditCard} title="Cartão de Crédito" desc="Aceite em até 12x com parcelamento inteligente. Antifraude integrado e tokenização de cartões." tone="info" delay={1} />
          <BentoCard icon={Shield} title="Checkout Seguro" desc="Certificado SSL, validação PCI-DSS e proteção contra chargebacks com sistema antifraude avançado." tone="success" delay={2} />
          <BentoCard icon={BookOpen} title="Área de Membros" desc="Entregue cursos, e-books e conteúdos exclusivos. Player integrado com liberação automática por módulo." tone="warning" delay={3} large />
          <BentoCard icon={LineChart} title="Analytics Completo" desc="Dashboard em tempo real com métricas de conversão, funil de vendas, mapa de calor e relatórios exportáveis." tone="info" delay={4} />
          <BentoCard icon={Target} title="Funil de Vendas" desc="Order bumps, upsells pós-pagamento e recuperação automática de vendas abandonadas via WhatsApp." tone="primary" delay={5} />
          <BentoCard icon={Users} title="Programa de Afiliados" desc="Convide afiliados, defina comissões e acompanhe vendas em tempo real. Pagamento automático e transparente." tone="success" delay={6} />
          <BentoCard icon={Code2} title="API & Webhooks" desc="Integre com qualquer plataforma via API REST completa. Webhooks em tempo real para automações." tone="warning" delay={7} large />
          <BentoCard icon={Smartphone} title="Mobile First" desc="Checkout otimizado para mobile com design responsivo e carregamento ultra-rápido em qualquer dispositivo." tone="info" delay={8} />
        </div>
      </Section>

      {/* ═══ HOW IT WORKS ═══ */}
      <Section className="bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent">
        <SectionHeader
          badge="Como funciona"
          title={<>Comece a vender em <span className="text-gradient">3 passos</span></>}
          subtitle="Crie sua conta, cadastre seu produto e compartilhe seu link. É simples assim."
        />
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: "01", icon: Rocket, title: "Crie sua conta", desc: "Cadastro gratuito em menos de 2 minutos. Sem mensalidades, sem taxas escondidas." },
            { step: "02", icon: Layers, title: "Cadastre seu produto", desc: "Configure preço, checkout personalizado, área de membros e automações." },
            { step: "03", icon: CircleDollarSign, title: "Receba pagamentos", desc: "Compartilhe seu link e receba via PIX, cartão ou boleto. Saque quando quiser." },
          ].map((item, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="relative text-center group"
            >
              {/* Step number */}
              <div className="text-[80px] font-display font-black text-primary/[0.06] leading-none mb-[-30px] relative z-0">{item.step}</div>
              <div className="relative z-10">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-display font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground/50 font-display leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
              {/* Connector line */}
              {i < 2 && <div className="hidden md:block absolute top-[52px] left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gradient-to-r from-primary/15 to-primary/5" />}
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ═══ PRICING ═══ */}
      <Section id="precos">
        <SectionHeader
          badge="Preços transparentes"
          title={<>Taxas justas, sem <span className="text-gradient">surpresas</span></>}
          subtitle="Sem mensalidades. Você só paga quando vende. Simples assim."
        />
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <PricingCard name="PIX" price="1,99%" desc="Ideal para vendas rápidas"
            features={["QR Code instantâneo", "Confirmação automática", "Saque em 1 dia útil", "Dashboard completo", "Suporte por e-mail"]}
            delay={0} />
          <PricingCard name="Completo" price="4,99%" desc="Todos os métodos de pagamento"
            features={["PIX + Cartão + Boleto", "Parcelamento até 12x", "Antifraude integrado", "Área de membros inclusa", "Afiliados + Webhooks", "Suporte prioritário", "API completa"]}
            popular delay={1} />
          <PricingCard name="Enterprise" price="Custom" desc="Para grandes operações"
            features={["Taxas negociáveis", "Account manager dedicado", "SLA garantido 99.99%", "Integração white-label", "Relatórios avançados", "Suporte 24/7"]}
            delay={2} />
        </div>
      </Section>

      {/* ═══ WHY HOTZFY ═══ */}
      <Section id="depoimentos" className="bg-gradient-to-b from-transparent via-primary/[0.015] to-transparent">
        <SectionHeader
          badge="Por que a HOTZFY?"
          title={<>Feita para quem <span className="text-gradient">leva a sério</span></>}
          subtitle="Cada detalhe pensado para infoprodutores que querem performance real."
        />
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Checkout que converte", desc: "Timer de escassez, order bumps, social proof e recuperação automática. Cada segundo do checkout foi otimizado para maximizar sua taxa de aprovação.", tone: "primary" },
            { icon: Lock, title: "Segurança nível bancário", desc: "Antifraude com velocity checks, blacklist global, tokenização PCI-DSS e monitoramento 24/7. Seu dinheiro protegido.", tone: "success" },
            { icon: LineChart, title: "Dados em tempo real", desc: "Dashboard com métricas ao vivo, gráficos de conversão por método de pagamento, churn rate e funil completo. Decisões baseadas em dados.", tone: "info" },
          ].map((item, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="rounded-3xl bg-card/40 backdrop-blur-xl border border-border/10 p-6 md:p-8 hover:border-primary/15 hover:shadow-xl transition-all duration-500 group"
            >
              <div className={`h-12 w-12 rounded-2xl bg-${item.tone}/8 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                <item.icon className={`h-5 w-5 text-${item.tone}`} />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-3">{item.title}</h3>
              <p className="text-sm text-muted-foreground/50 leading-relaxed font-display">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ═══ NUMBERS ═══ */}
      <Section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: 2000, suffix: "+", label: "Produtores ativos", icon: Users },
            { value: 50, suffix: "M+", label: "Processado (R$)", icon: CircleDollarSign },
            { value: 99, suffix: ".9%", label: "Uptime garantido", icon: Activity },
            { value: 4, suffix: ".9★", label: "Avaliação média", icon: Star },
          ].map((stat, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-6 rounded-3xl bg-card/30 backdrop-blur-xl border border-border/8 hover:border-primary/15 hover:shadow-xl transition-all duration-500"
            >
              <div className="h-12 w-12 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-3xl md:text-4xl font-display font-black text-foreground tracking-[-0.04em] tabular-nums">
                <Counter target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-[10px] text-muted-foreground/35 font-bold uppercase tracking-[0.12em] mt-1 font-display">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ═══ FAQ ═══ */}
      <Section id="faq" className="bg-gradient-to-b from-transparent via-primary/[0.01] to-transparent">
        <SectionHeader
          badge="Perguntas frequentes"
          title={<>Tire suas <span className="text-gradient">dúvidas</span></>}
          subtitle="Tudo o que você precisa saber antes de começar."
        />
        <div className="max-w-3xl mx-auto bg-card/30 backdrop-blur-xl rounded-3xl border border-border/10 p-6 md:p-10">
          <FaqItem q="Preciso pagar mensalidade?" a="Não! A HOTZFY não cobra mensalidades. Você só paga uma taxa por transação aprovada. Sem custos fixos ou surpresas." delay={0} />
          <FaqItem q="Quanto tempo leva para receber o dinheiro?" a="Saques via PIX são processados em até 1 dia útil. Você pode sacar a qualquer momento diretamente pelo painel." delay={1} />
          <FaqItem q="Posso aceitar PIX e cartão de crédito?" a="Sim! Oferecemos PIX instantâneo, cartão de crédito em até 12x e boleto bancário. Todos os métodos integrados no mesmo checkout." delay={2} />
          <FaqItem q="Tem área de membros?" a="Sim! Nossa área de membros integrada permite entregar cursos, módulos e aulas com liberação automática e player de vídeo profissional." delay={3} />
          <FaqItem q="Posso ter afiliados vendendo meus produtos?" a="Claro! O sistema de afiliados é integrado, com comissões configuráveis, dashboard exclusivo para afiliados e pagamento automático." delay={4} />
          <FaqItem q="A plataforma é segura?" a="100%. Utilizamos criptografia de ponta, certificados SSL, antifraude avançado com blacklist global, velocity checks e tokenização de dados sensíveis." delay={5} />
        </div>
      </Section>

      {/* ═══ FINAL CTA ═══ */}
      <Section className="pb-32">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative text-center"
        >
          {/* Background glow */}
          <div className="absolute inset-0 -m-20 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_70%)]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-[0.15em] mb-8 font-display">
              <Crown className="h-3 w-3" /> Comece agora mesmo
            </div>
            <h2 className="text-4xl md:text-6xl font-display font-black tracking-[-0.045em] text-foreground leading-[1.08] mb-6">
              Pronto para <span className="text-gradient">escalar</span>?
            </h2>
            <p className="text-lg text-muted-foreground/50 font-display mb-10 max-w-xl mx-auto leading-relaxed">
              Junte-se a milhares de infoprodutores que já faturam mais com a HOTZFY. Cadastro gratuito, sem mensalidades.
            </p>
            <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={() => navigate("/auth")} size="lg"
                className="gradient-primary text-primary-foreground font-display font-bold text-lg h-16 px-12 rounded-2xl shadow-2xl shadow-primary/30 hover:shadow-[0_24px_80px] hover:shadow-primary/40 transition-all duration-500 relative overflow-hidden group">
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                </div>
                <span className="relative flex items-center gap-3">
                  Criar conta grátis <ArrowRight className="h-5 w-5" />
                </span>
              </Button>
            </motion.div>
            <p className="text-xs text-muted-foreground/25 mt-6 font-display">
              Sem cartão de crédito • Sem mensalidades • Cancele quando quiser
            </p>
          </div>
        </motion.div>
      </Section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border/8 bg-card/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
          <div className="grid md:grid-cols-4 gap-8 md:gap-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={hotzfyLogo} alt="HOTZFY" className="h-8 w-8" loading="lazy" width={512} height={512} />
                <span className="text-base font-display font-black tracking-[-0.03em] text-foreground">HOTZFY</span>
              </div>
              <p className="text-xs text-muted-foreground/40 font-display leading-relaxed">
                Plataforma completa de pagamentos para infoprodutores. Venda mais, com menos taxas.
              </p>
            </div>
            {[
              { title: "Produto", links: [{ label: "Recursos", href: "#recursos" }, { label: "Preços", href: "#precos" }, { label: "API Docs", href: "#" }, { label: "Status", href: "/status" }] },
              { title: "Empresa", links: [{ label: "Sobre", href: "#" }, { label: "Contato", href: "#" }, { label: "Suporte", href: "#" }] },
              { title: "Legal", links: [{ label: "Termos de Uso", href: "/termos-de-uso" }, { label: "Privacidade", href: "/politica-de-privacidade" }] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-[0.15em] mb-4 font-display">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(link => (
                    <li key={link.label}>
                      <a href={link.href} className="text-sm text-muted-foreground/50 hover:text-foreground font-display transition-colors duration-200">{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-border/5 mt-10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[10px] text-muted-foreground/25 font-display">
              © {new Date().getFullYear()} HOTZFY. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[9px] text-success/60 font-bold font-display uppercase tracking-[0.12em]">Todos os sistemas operacionais</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
