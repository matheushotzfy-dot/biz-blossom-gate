/**
 * HOTZFY — Futuristic Landing Page
 * "Year 3000" holographic aesthetic. All motion is CSS/Framer, no external assets.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Shield, Zap, BarChart3, CreditCard, Users, CheckCircle2,
  Sparkles, Activity, QrCode, Wallet, Radio, Code2, Layers, Cpu,
  Lock, Fingerprint, ChevronDown, ArrowUpRight, Rocket, Globe2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";
import { HotzfyLogo } from "@/components/HotzfyLogo";

/* ═══════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════ */

const FAQ = [
  { q: "Preciso pagar mensalidade?", a: "Não. Zero mensalidade. Você paga apenas uma taxa por transação aprovada." },
  { q: "Quanto tempo para receber?", a: "Saques via PIX processados em até 1 dia útil, direto no seu painel." },
  { q: "Quais métodos de pagamento?", a: "PIX instantâneo, cartão em até 12x, boleto. Tudo no mesmo checkout." },
  { q: "Tem área de membros?", a: "Sim, com player profissional, liberação automática e experiência Netflix-style." },
  { q: "Sistema de afiliados?", a: "Integrado, com comissões configuráveis e pagamento automático." },
  { q: "É seguro?", a: "SSL, criptografia, antifraude com blacklist global, velocity checks e tokenização." },
];

const JSONLD = [
  { "@context": "https://schema.org", "@type": "Organization", name: "HOTZFY", url: "https://hotzfy.com.br" },
  { "@context": "https://schema.org", "@type": "WebSite", name: "HOTZFY", url: "https://hotzfy.com.br" },
  { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
];

const FEATURES = [
  { icon: QrCode, title: "Checkout Holográfico", desc: "PIX em 1.2s, cartão em 12x, boleto. UI que converte 3x mais.", tone: "emerald" },
  { icon: Shield, title: "Antifraude Neural", desc: "Blacklist global, velocity checks e tokenização em tempo real.", tone: "cyan" },
  { icon: BarChart3, title: "Analytics em Tempo Real", desc: "Dashboard cinematográfico com métricas ao vivo, sem delay.", tone: "violet" },
  { icon: Users, title: "Área de Membros Netflix", desc: "Player profissional, liberação automática, gamificação embutida.", tone: "emerald" },
  { icon: Wallet, title: "Saques em 1 dia útil", desc: "PIX direto, sem burocracia. Antecipação disponível.", tone: "cyan" },
  { icon: Code2, title: "API REST + Webhooks", desc: "sk_live_ + HMAC-SHA256. Integração em minutos.", tone: "violet" },
];

const METRICS = [
  { label: "TPV processado", value: "R$ 2.4B+", icon: Activity },
  { label: "Taxa de aprovação", value: "98.7%", icon: CheckCircle2 },
  { label: "Uptime", value: "99.99%", icon: Radio },
  { label: "Latência PIX", value: "1.2s", icon: Zap },
];

/* ═══════════════════════════════════════════════════════════════
   BACKGROUND FX
   ═══════════════════════════════════════════════════════════════ */

function HoloGrid() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(160_84%_39%/0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,hsl(190_95%_55%/0.08),transparent_50%),radial-gradient(ellipse_at_bottom_left,hsl(265_90%_65%/0.06),transparent_50%)]" />
      {/* animated grid */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(52,211,153,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.35) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          animation: "hzGridDrift 32s linear infinite",
        }}
      />
      {/* scan line */}
      <div
        className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
        style={{ animation: "hzScan 8s linear infinite", boxShadow: "0 0 24px rgba(52,211,153,0.6)" }}
      />
      {/* orbs */}
      <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px] animate-[hzFloat_18s_ease-in-out_infinite]" />
      <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[140px] animate-[hzFloat_22s_ease-in-out_infinite_reverse]" />
      <div className="absolute bottom-0 left-1/3 h-[450px] w-[450px] rounded-full bg-violet-500/8 blur-[130px] animate-[hzFloat_26s_ease-in-out_infinite]" />
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,hsl(var(--background))_100%)]" />
    </div>
  );
}

function Particles() {
  const items = useMemo(
    () => Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: Math.random() * 2 + 0.6,
      d: Math.random() * 18 + 14,
      delay: Math.random() * 8,
      hue: ["#34d399", "#22d3ee", "#a78bfa"][i % 3],
    })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map(p => (
        <motion.span
          key={p.id}
          initial={{ x: `${p.x}vw`, y: `${p.y}%`, opacity: 0 }}
          animate={{ y: [`${p.y}%`, `${p.y - 30}%`, `${p.y}%`], opacity: [0, 0.7, 0] }}
          transition={{ duration: p.d, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          className="absolute rounded-full"
          style={{
            width: p.s, height: p.s, background: p.hue,
            boxShadow: `0 0 ${p.s * 6}px ${p.hue}`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NAV
   ═══════════════════════════════════════════════════════════════ */

function Nav() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        scrolled
          ? "backdrop-blur-2xl bg-background/60 border-b border-emerald-500/10"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 h-16">
        <HotzfyLogo size={30} withWordmark />
        <nav className="hidden md:flex items-center gap-8 text-[12px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition">Features</a>
          <a href="#metrics" className="hover:text-foreground transition">Live</a>
          <a href="#pricing" className="hover:text-foreground transition">Preços</a>
          <a href="#faq" className="hover:text-foreground transition">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/auth")}
            className="hidden sm:inline-flex h-9 px-3 rounded-lg text-[12px] font-display font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
          >
            Entrar
          </button>
          <button
            onClick={() => navigate("/auth")}
            className="group relative h-9 px-4 rounded-lg text-[12px] font-display font-black uppercase tracking-wider text-white overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500" />
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500" />
            <span className="absolute inset-[1px] rounded-[7px] bg-background/10 backdrop-blur-sm" />
            <span className="relative flex items-center gap-1.5">Começar <ArrowRight className="h-3.5 w-3.5" /></span>
          </button>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════ */

function HolographicDashboard() {
  return (
    <div className="relative w-full max-w-[720px] mx-auto perspective-[1400px]">
      <motion.div
        initial={{ opacity: 0, rotateX: 20, y: 60 }}
        animate={{ opacity: 1, rotateX: 12, y: 0 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        className="relative rounded-[28px] overflow-hidden border border-emerald-400/25"
        style={{
          transformStyle: "preserve-3d",
          background: "linear-gradient(180deg, rgba(11,15,20,0.85), rgba(11,15,20,0.7))",
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 0 0 1px rgba(52,211,153,0.15), 0 40px 120px -20px rgba(52,211,153,0.35), 0 20px 60px -20px rgba(34,211,238,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-400/10">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          <div className="ml-4 h-6 flex-1 rounded-md bg-white/[0.03] border border-white/5 flex items-center px-3 text-[10px] font-mono text-emerald-300/70">
            <Lock className="h-3 w-3 mr-2" /> app.hotzfy.com.br/dashboard
          </div>
        </div>

        {/* content */}
        <div className="p-6 grid grid-cols-3 gap-3">
          {[
            { l: "Faturamento hoje", v: "R$ 47.892", c: "+18.4%", tone: "emerald" },
            { l: "Vendas aprovadas", v: "312", c: "+27", tone: "cyan" },
            { l: "Ticket médio", v: "R$ 153", c: "+4.1%", tone: "violet" },
          ].map((k, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.15 }}
              className="rounded-2xl p-4 bg-white/[0.02] border border-white/5"
            >
              <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold">{k.l}</div>
              <div className="mt-1 text-xl font-black text-white font-display">{k.v}</div>
              <div className={cn(
                "text-[10px] mt-1 font-mono",
                k.tone === "emerald" && "text-emerald-400",
                k.tone === "cyan" && "text-cyan-400",
                k.tone === "violet" && "text-violet-400",
              )}>▲ {k.c}</div>
            </motion.div>
          ))}

          {/* chart */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
            className="col-span-3 rounded-2xl p-5 bg-white/[0.02] border border-white/5 h-52 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Faturamento — 24h</div>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> AO VIVO
              </div>
            </div>
            <svg viewBox="0 0 400 130" className="w-full h-[calc(100%-28px)]">
              <defs>
                <linearGradient id="lchart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d="M0,90 C40,80 60,60 100,55 C140,50 160,80 200,65 C240,50 260,25 300,30 C340,35 360,15 400,10 L400,130 L0,130 Z"
                fill="url(#lchart)"
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.6, delay: 1.4 }}
              />
              <motion.path
                d="M0,90 C40,80 60,60 100,55 C140,50 160,80 200,65 C240,50 260,25 300,30 C340,35 360,15 400,10"
                fill="none" stroke="#34d399" strokeWidth="2"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, delay: 1.4 }}
              />
              {[100, 200, 300, 400].map((x, i) => (
                <motion.circle
                  key={i} cx={x} cy={[55, 65, 30, 10][i]} r="3" fill="#34d399"
                  initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }}
                  transition={{ delay: 2 + i * 0.15, duration: 0.5 }}
                  style={{ filter: "drop-shadow(0 0 6px #34d399)" }}
                />
              ))}
            </svg>
          </motion.div>
        </div>

        {/* holographic sweep */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.05)_50%,transparent_60%)] animate-[hzSweep_6s_ease-in-out_infinite]" />
      </motion.div>

      {/* floating badges */}
      <motion.div
        initial={{ opacity: 0, x: -30, y: 20 }} animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.6 }}
        className="absolute -left-4 md:-left-16 top-1/3 rounded-2xl border border-emerald-400/30 bg-background/70 backdrop-blur-xl px-4 py-3 shadow-[0_20px_60px_-10px_rgba(52,211,153,0.4)]"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <QrCode className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-white/50 font-bold">PIX aprovado</div>
            <div className="text-sm font-black text-white font-display">R$ 297,00</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 30, y: -10 }} animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1.9 }}
        className="absolute -right-4 md:-right-12 -top-4 rounded-2xl border border-cyan-400/30 bg-background/70 backdrop-blur-xl px-4 py-3 shadow-[0_20px_60px_-10px_rgba(34,211,238,0.4)]"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Shield className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-white/50 font-bold">Antifraude</div>
            <div className="text-sm font-black text-white font-display">Score 0.02</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-28 pb-20 px-4 md:px-8 overflow-hidden">
      <Particles />
      <div className="max-w-7xl w-full mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/5 backdrop-blur-md text-[10px] font-display font-black uppercase tracking-[0.2em] text-emerald-300 mb-8"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Gateway do Futuro · Ao vivo
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="font-display font-black tracking-[-0.05em] leading-[0.95] text-5xl md:text-7xl lg:text-8xl"
        >
          <span className="block text-foreground">Pagamentos</span>
          <span className="block bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
            de outra era.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-8 max-w-2xl mx-auto text-base md:text-xl text-muted-foreground/80 font-display leading-relaxed"
        >
          Checkout holográfico, antifraude neural e saques em 1 dia útil.
          A infraestrutura que os infoprodutores do <span className="text-emerald-300 font-bold">ano 3000</span> já usam — hoje.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <button
            onClick={() => navigate("/auth")}
            className="group relative h-14 px-8 rounded-2xl overflow-hidden text-white font-display font-black uppercase tracking-wider text-sm"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500" />
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500" />
            <span className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-violet-500 opacity-40 blur-2xl group-hover:opacity-70 transition" />
            <span className="relative flex items-center gap-2">
              <Rocket className="h-4 w-4" /> Criar conta grátis <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
            </span>
          </button>
          <a
            href="#features"
            className="h-14 px-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md text-foreground/80 hover:text-foreground hover:border-emerald-400/30 hover:bg-emerald-500/5 transition flex items-center gap-2 font-display font-bold text-sm"
          >
            Ver como funciona <ChevronDown className="h-4 w-4" />
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono text-muted-foreground/60"
        >
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Zero mensalidade</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> PIX em 1.2s</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Saque em 1 dia útil</span>
        </motion.div>

        <div className="mt-24 md:mt-32">
          <HolographicDashboard />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   METRICS TICKER
   ═══════════════════════════════════════════════════════════════ */

function MetricsStrip() {
  return (
    <section id="metrics" className="relative py-16 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-[32px] border border-white/5 bg-gradient-to-r from-emerald-500/[0.04] via-cyan-500/[0.04] to-violet-500/[0.04] backdrop-blur-xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6">
            {METRICS.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center md:text-left"
              >
                <div className="inline-flex items-center gap-2 text-emerald-400 mb-2">
                  <m.icon className="h-4 w-4" />
                  <span className="text-[10px] font-mono uppercase tracking-wider">{m.label}</span>
                </div>
                <div className="text-3xl md:text-4xl font-black font-display bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                  {m.value}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FEATURES BENTO
   ═══════════════════════════════════════════════════════════════ */

function FeatureCard({ f, i }: { f: typeof FEATURES[0]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const tones: Record<string, { grad: string; glow: string; icon: string }> = {
    emerald: { grad: "from-emerald-500/20 to-emerald-500/0", glow: "shadow-emerald-500/20", icon: "text-emerald-400" },
    cyan: { grad: "from-cyan-500/20 to-cyan-500/0", glow: "shadow-cyan-500/20", icon: "text-cyan-400" },
    violet: { grad: "from-violet-500/20 to-violet-500/0", glow: "shadow-violet-500/20", icon: "text-violet-400" },
  };
  const t = tones[f.tone];

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 8, y: px * 8 });
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}
      className={cn(
        "group relative rounded-[28px] p-8 overflow-hidden border border-white/[0.06] bg-white/[0.015] backdrop-blur-xl",
        "hover:border-white/15 transition-colors duration-500",
        "hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)]",
        t.glow, "hover:" + t.glow
      )}
    >
      <div className={cn("absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-700", t.grad)} />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "20px 20px",
      }} />

      <div className="relative">
        <div className={cn("h-12 w-12 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500")}>
          <f.icon className={cn("h-5 w-5", t.icon)} />
        </div>
        <h3 className="text-xl font-display font-black text-foreground tracking-tight mb-2">{f.title}</h3>
        <p className="text-sm text-muted-foreground/70 leading-relaxed">{f.desc}</p>
      </div>
    </motion.div>
  );
}

function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-6">
            <Cpu className="h-3 w-3" /> Stack
          </div>
          <h2 className="text-4xl md:text-6xl font-display font-black tracking-[-0.04em] leading-[1.05]">
            Um sistema.<br />
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">Todas as camadas.</span>
          </h2>
          <p className="mt-6 text-base md:text-lg text-muted-foreground/70 max-w-2xl mx-auto">
            De checkout a área de membros, tudo integrado. Sem gambiarra, sem plugins, sem taxas escondidas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} i={i} />)}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRICING
   ═══════════════════════════════════════════════════════════════ */

function Pricing() {
  const navigate = useNavigate();
  const plans = [
    { name: "PIX", pct: "3.99%", desc: "por transação aprovada", features: ["Aprovação em 1.2s", "Sem taxa fixa", "Saque em 1 dia útil"], glow: "from-emerald-500 to-emerald-500/0" },
    { name: "Cartão", pct: "5.99%", desc: "+ R$ 0,49 por venda", features: ["Parcelamento em 12x", "Antecipação disponível", "Antifraude incluído"], glow: "from-cyan-500 to-cyan-500/0", popular: true },
    { name: "Boleto", pct: "R$ 2,99", desc: "por transação aprovada", features: ["Sem chargeback", "Sem análise de risco", "Baixa automática"], glow: "from-violet-500 to-violet-500/0" },
  ];
  return (
    <section id="pricing" className="relative py-24 md:py-32 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-6">
            <Sparkles className="h-3 w-3" /> Zero mensalidade
          </div>
          <h2 className="text-4xl md:text-6xl font-display font-black tracking-[-0.04em] leading-[1.05]">
            Você só paga<br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">quando vende.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8 }}
              className={cn(
                "relative rounded-[32px] p-8 border overflow-hidden backdrop-blur-xl",
                p.popular
                  ? "border-emerald-400/40 bg-gradient-to-b from-emerald-500/[0.08] to-transparent shadow-[0_40px_100px_-20px_rgba(52,211,153,0.35)]"
                  : "border-white/[0.08] bg-white/[0.015] hover:border-white/15"
              )}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-[9px] font-black uppercase tracking-widest">
                  Mais usado
                </div>
              )}
              <div className={cn("absolute -top-32 -right-32 h-72 w-72 rounded-full blur-3xl opacity-30 bg-gradient-to-br", p.glow)} />
              <div className="relative">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{p.name}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-5xl font-black font-display text-foreground">{p.pct}</span>
                </div>
                <div className="text-xs text-muted-foreground/60 mt-1 font-mono">{p.desc}</div>

                <ul className="mt-8 space-y-3">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/80">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate("/auth")}
                  className={cn(
                    "mt-8 w-full h-11 rounded-xl font-display font-black uppercase tracking-wider text-xs transition-all",
                    p.popular
                      ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-emerald-500/30"
                      : "bg-white/5 border border-white/10 text-foreground hover:bg-white/10"
                  )}
                >
                  Começar agora
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FAQ
   ═══════════════════════════════════════════════════════════════ */

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative py-24 md:py-32 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-6">
            <Fingerprint className="h-3 w-3" /> FAQ
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-black tracking-[-0.04em]">Dúvidas frequentes</h2>
        </div>

        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl border overflow-hidden backdrop-blur-xl transition-colors",
                open === i ? "border-emerald-400/30 bg-emerald-500/[0.04]" : "border-white/[0.06] bg-white/[0.015] hover:border-white/15"
              )}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
              >
                <span className="font-display font-bold text-foreground text-[15px]">{f.q}</span>
                <ChevronDown className={cn("h-4 w-4 text-emerald-400 transition-transform", open === i && "rotate-180")} />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-5 text-sm text-muted-foreground/80 leading-relaxed">{f.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CTA
   ═══════════════════════════════════════════════════════════════ */

function FinalCTA() {
  const navigate = useNavigate();
  return (
    <section className="relative py-24 md:py-32 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="relative rounded-[40px] overflow-hidden border border-emerald-400/25 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-violet-500/10 backdrop-blur-2xl p-12 md:p-20 text-center">
          <div className="absolute inset-0 opacity-[0.08]" style={{
            backgroundImage: "linear-gradient(rgba(52,211,153,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          }} />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-emerald-500/30 blur-[100px]" />

          <div className="relative">
            <HotzfyLogo size={56} className="mx-auto mb-8" />
            <h2 className="text-4xl md:text-6xl font-display font-black tracking-[-0.04em] leading-[1.05]">
              Seu próximo checkout <br />
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">é do futuro.</span>
            </h2>
            <p className="mt-6 text-base md:text-lg text-muted-foreground/80 max-w-xl mx-auto">
              Criar conta é grátis. Zero mensalidade. Comece a vender em menos de 5 minutos.
            </p>
            <button
              onClick={() => navigate("/auth")}
              className="group relative mt-10 h-14 px-10 rounded-2xl overflow-hidden text-white font-display font-black uppercase tracking-wider text-sm inline-flex items-center gap-2"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500" />
              <span className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-violet-500 opacity-50 blur-2xl group-hover:opacity-90 transition" />
              <span className="relative flex items-center gap-2">
                Ativar HOTZFY <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIVE FEED — animated sales ticker
   ═══════════════════════════════════════════════════════════════ */

const LIVE_FEED = [
  { name: "Rafaela M.", product: "Método Renda Digital", value: "R$ 497", city: "SP" },
  { name: "Carlos H.", product: "Curso Trader Pro", value: "R$ 1.997", city: "RJ" },
  { name: "Juliana P.", product: "Mentoria E-commerce", value: "R$ 2.497", city: "MG" },
  { name: "Diego S.", product: "Combo Marketing", value: "R$ 897", city: "PR" },
  { name: "Ana C.", product: "Fórmula Instagram", value: "R$ 397", city: "BA" },
  { name: "Pedro L.", product: "Master Copywriter", value: "R$ 1.497", city: "SC" },
  { name: "Isabela F.", product: "Kit Designer 360", value: "R$ 697", city: "DF" },
  { name: "Thiago A.", product: "Curso IA Aplicada", value: "R$ 1.297", city: "CE" },
];

function LiveFeed() {
  const loop = [...LIVE_FEED, ...LIVE_FEED];
  return (
    <section className="relative py-24 md:py-28 px-4 md:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          Ao vivo · agora
        </div>
        <h2 className="text-4xl md:text-6xl font-display font-black tracking-[-0.04em] leading-[1.05]">
          Vendas acontecendo <br />
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">enquanto você lê isso.</span>
        </h2>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-48 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-48 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        <div className="flex gap-4 py-2" style={{ width: "max-content", animation: "hzMarquee 40s linear infinite" }}>
          {loop.map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              className="min-w-[300px] rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-5 py-4 flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-400/20 flex items-center justify-center text-emerald-300 font-black font-display">
                {item.name[0]}
              </div>
              <div className="flex-1 text-left">
                <p className="text-[13px] font-semibold text-foreground/90 truncate">{item.name} · <span className="text-muted-foreground/70 font-normal">{item.city}</span></p>
                <p className="text-[11px] text-muted-foreground/60 truncate">{item.product}</p>
              </div>
              <div className="font-mono text-emerald-300 font-black text-sm">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════════════════════════════ */

const TESTIMONIALS = [
  { name: "Marina Ribeiro", role: "CEO · Método Ascensão", quote: "Migrei do concorrente e faturei 3x no primeiro mês. Checkout com conversão absurda e o saque em 1 dia mudou meu fluxo de caixa.", metric: "+312% conversão" },
  { name: "Rodrigo Vasques", role: "Fundador · Trader Elite", quote: "A antifraude neural bloqueou 98% dos chargebacks que eu tinha. Nunca vi um gateway tão preciso. Suporte responde em minutos.", metric: "−98% chargeback" },
  { name: "Camila Nogueira", role: "Producer · Escola Digital", quote: "API brutal, docs impecáveis. Integrei em 2 horas o que na outra plataforma levou 3 semanas. Splits automáticos por coprodutor.", metric: "2h integração" },
];

function Testimonials() {
  return (
    <section className="relative py-24 md:py-32 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-400/20 bg-violet-500/5 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300 mb-6">
            <Users className="h-3 w-3" /> Prova social
          </div>
          <h2 className="text-4xl md:text-6xl font-display font-black tracking-[-0.04em] leading-[1.05]">
            Quem opera com a HOTZFY <br />
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">não volta atrás.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="relative rounded-[28px] p-8 border border-white/[0.06] bg-white/[0.015] backdrop-blur-xl overflow-hidden group hover:border-white/15 transition-colors"
            >
              <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-700" />
              <div className="relative">
                <div className="flex gap-0.5 mb-4 text-emerald-400">
                  {[0,1,2,3,4].map((s) => <span key={s} className="text-lg leading-none">★</span>)}
                </div>
                <p className="text-[15px] leading-relaxed text-foreground/85 mb-6">"{t.quote}"</p>
                <div className="flex items-center justify-between pt-5 border-t border-white/5">
                  <div>
                    <p className="text-sm font-black font-display text-foreground">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground/60">{t.role}</p>
                  </div>
                  <div className="rounded-full border border-emerald-400/20 bg-emerald-500/5 px-3 py-1 text-[10px] font-mono font-bold text-emerald-300">
                    {t.metric}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════ */

function Footer() {

  return (
    <footer className="relative border-t border-white/5 py-12 px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <HotzfyLogo size={24} withWordmark />
        <div className="flex items-center gap-6 text-[11px] font-mono text-muted-foreground/60">
          <a href="/termos-de-uso" className="hover:text-foreground transition">Termos</a>
          <a href="/politica-de-privacidade" className="hover:text-foreground transition">Privacidade</a>
          <a href="/status" className="hover:text-foreground transition">Status</a>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
          © {new Date().getFullYear()} HOTZFY · Pagamentos do futuro
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT
   ═══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <Seo
        title="HOTZFY — Gateway de Pagamentos do Futuro para Infoprodutos"
        description="Checkout holográfico, antifraude neural, saques em 1 dia útil. Zero mensalidade. A infraestrutura de pagamentos dos infoprodutores do ano 3000."
        path="/"
        jsonLd={JSONLD}
      />

      {/* keyframes injected once */}
      <style>{`
        @keyframes hzGridDrift { 0% { transform: translate(0,0); } 100% { transform: translate(56px,56px); } }
        @keyframes hzScan { 0% { top: -2px; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100vh; opacity: 0; } }
        @keyframes hzFloat { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.05); } }
        @keyframes hzSweep { 0%, 100% { transform: translateX(-100%); } 50% { transform: translateX(100%); } }
      `}</style>

      <HoloGrid />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <MetricsStrip />
        <Features />
        <Pricing />
        <FaqSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
