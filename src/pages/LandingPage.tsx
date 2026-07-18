/**
 * HOTZFY — Futuristic Landing Page
 * "Year 3000" holographic aesthetic. All motion is CSS/Framer, no external assets.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, useSpring, useInView, useMotionValue, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Shield, Zap, BarChart3, CreditCard, Users, CheckCircle2,
  Sparkles, Activity, QrCode, Wallet, Radio, Code2, Layers, Cpu,
  Lock, Fingerprint, ChevronDown, ArrowUpRight, Rocket, Globe2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";
import { HotzfyLogo } from "@/components/HotzfyLogo";

/* Glitch text — used on the "de outra era" hero accent */
function GlitchText({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{children}</span>;
  return (
    <span className={cn("relative inline-block hz-glitch", className)} data-text={typeof children === "string" ? children : undefined}>
      {children}
    </span>
  );
}

/* Neural-net connected nodes — canvas, subtle, respects reduced motion */
function NeuralNet() {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0; let w = 0; let h = 0; let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    const count = Math.min(46, Math.floor((w * h) / 32000));
    const nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
    }));
    const step = () => {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140) {
            const alpha = (1 - Math.sqrt(d2) / 140) * 0.28;
            ctx.strokeStyle = `rgba(52,211,153,${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = "rgba(52,211,153,0.55)";
      for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2); ctx.fill(); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [reduce]);
  if (reduce) return null;
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-[0.35] mix-blend-screen"
      aria-hidden
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════ */

const FAQ = [
  { q: "Preciso pagar mensalidade?", a: "Não. Zero mensalidade. Você paga apenas uma taxa por transação aprovada." },
  { q: "Quanto tempo para receber?", a: "Saques via PIX processados em D+0" },
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
  { icon: QrCode, title: "Checkout Holográfico", desc: "PIX em 0.2s, cartão em 12x, boleto. Interface que converte 3x mais.", tone: "emerald" },
  { icon: Shield, title: "Antifraude Neural", desc: "Blacklist global, velocity checks e tokenização em tempo real.", tone: "cyan" },
  { icon: BarChart3, title: "Analytics em Tempo Real", desc: "Dashboard cinematográfico com métricas ao vivo, sem delay.", tone: "violet" },
  { icon: Users, title: "Área de Membros Netflix", desc: "Player profissional, liberação automática, gamificação embutida.", tone: "emerald" },
  { icon: Wallet, title: "Saques instantâneos", desc: "PIX direto, sem burocracia. Antecipação disponível.", tone: "cyan" },
  { icon: Code2, title: "API REST + Webhooks", desc: "sk_live_ + HMAC-SHA256. Integração em minutos.", tone: "violet" },
];

const METRICS = [
  { label: "TPV processado", prefix: "R$ ", to: 200, suffix: "M+", decimals: 0, icon: Activity },
  { label: "Taxa de aprovação", prefix: "", to: 98.7, suffix: "%", decimals: 1, icon: CheckCircle2 },
  { label: "Uptime", prefix: "", to: 99.99, suffix: "%", decimals: 2, icon: Radio },
  { label: "Latência PIX", prefix: "", to: 0.2, suffix: "s", decimals: 1, icon: Zap },
];

/* Animated count-up that fires when scrolled into view */
function CountUp({ to, decimals = 0, prefix = "", suffix = "", duration = 2 }: {
  to: number; decimals?: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const controls = animate(0, to, {
            duration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (v) => { 
              if (el) {
                const formatted = v.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                el.textContent = prefix + formatted + suffix; 
              }
            },
          });
          return () => controls.stop();
        }
      });
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, decimals, prefix, suffix, duration]);
  return <span ref={ref}>{prefix}0{decimals ? "." + "0".repeat(decimals) : ""}{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   BACKGROUND FX
   ═══════════════════════════════════════════════════════════════ */

function HoloGrid() {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const gridX = useSpring(useTransform(mx, [-0.5, 0.5], [-20, 20]), { stiffness: 40, damping: 20 });
  const gridY = useSpring(useTransform(my, [-0.5, 0.5], [-20, 20]), { stiffness: 40, damping: 20 });
  const { scrollY } = useScroll();
  const scrollDrift = useTransform(scrollY, [0, 2000], [0, 80]);
  useEffect(() => {
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my, reduce]);
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(160_84%_39%/0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,hsl(190_95%_55%/0.08),transparent_50%),radial-gradient(ellipse_at_bottom_left,hsl(265_90%_65%/0.06),transparent_50%)]" />
      {/* animated grid — parallax by mouse + scroll */}
      <motion.div
        className="absolute -inset-10 opacity-[0.14] will-change-transform"
        style={{
          x: gridX, y: useTransform([gridY, scrollDrift], ([a, b]: number[]) => a + b),
          backgroundImage:
            "linear-gradient(rgba(52,211,153,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.35) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          animation: reduce ? undefined : "hzGridDrift 32s linear infinite",
          transform: "perspective(1200px) rotateX(1deg)",
        }}
      />
      {/* scan line */}
      <div
        className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
        style={{ animation: reduce ? undefined : "hzScan 8s linear infinite", boxShadow: "0 0 24px rgba(52,211,153,0.6)" }}
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

/* Live PIX feed row — realistic streaming transactions */
const LIVE_TX = [
  { name: "Rafael M.", city: "SP", product: "Método Trader Elite", value: "R$ 1.997,00", ms: "0.18s" },
  { name: "Beatriz S.", city: "RJ", product: "Mentoria Growth 360", value: "R$ 497,00", ms: "0.21s" },
  { name: "Lucas P.", city: "MG", product: "Curso Copywriting Pro", value: "R$ 297,00", ms: "0.19s" },
  { name: "Amanda R.", city: "PR", product: "Formação Dropshipping", value: "R$ 1.297,00", ms: "0.22s" },
  { name: "Diego F.", city: "SC", product: "Método Emagrecer 30d", value: "R$ 197,00", ms: "0.17s" },
  { name: "Camila O.", city: "BA", product: "Consultoria Tráfego", value: "R$ 2.497,00", ms: "0.24s" },
  { name: "Thiago N.", city: "DF", product: "Bootcamp Full Stack", value: "R$ 897,00", ms: "0.20s" },
  { name: "Juliana V.", city: "GO", product: "Ebook Confeitaria Fit", value: "R$ 47,00", ms: "0.16s" },
];

function LiveTransactionRow({ tx, idx }: { tx: typeof LIVE_TX[number]; idx: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: 12, height: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 px-3 py-2 border-b border-white/[0.04] last:border-b-0"
    >
      <div className="relative">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/25 to-cyan-500/15 border border-emerald-400/25 flex items-center justify-center text-[10px] font-black text-emerald-300 font-display">
          {tx.name[0]}
        </div>
        {idx === 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0b0f14] animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-white/90 truncate">
          {tx.name} <span className="text-white/30 font-mono text-[9px]">· {tx.city}</span>
        </div>
        <div className="text-[9.5px] text-white/40 truncate font-mono">{tx.product}</div>
      </div>
      <div className="text-right">
        <div className="text-[11px] font-mono font-black text-emerald-300 tabular-nums">{tx.value}</div>
        <div className="text-[8.5px] font-mono text-white/35">PIX · {tx.ms}</div>
      </div>
    </motion.div>
  );
}

/* Tiny "cha-ching" synth — no assets, WebAudio only. Gated behind user click. */
function useCoinSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);
  const enable = useCallback(() => {
    if (ctxRef.current) { setEnabled(true); return; }
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ctxRef.current = new Ctx();
      setEnabled(true);
    } catch { /* ignore */ }
  }, []);
  const play = useCallback(() => {
    const ctx = ctxRef.current; if (!ctx || !enabled) return;
    const now = ctx.currentTime;
    // two-note bell + shimmer = "cha-ching"
    const notes = [
      { f: 1320, t: 0.00, d: 0.18, g: 0.14 },
      { f: 1760, t: 0.08, d: 0.35, g: 0.16 },
      { f: 2640, t: 0.10, d: 0.30, g: 0.08 },
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.0001, now + n.t);
      gain.gain.exponentialRampToValueAtTime(n.g, now + n.t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + n.t); osc.stop(now + n.t + n.d + 0.02);
    }
  }, [enabled]);
  const toggle = useCallback(() => {
    if (!ctxRef.current) { enable(); return; }
    setEnabled(v => !v);
  }, [enable]);
  return { enabled, toggle, play };
}

const SELLER_NAV = [
  { icon: BarChart3, label: "Dashboard", active: true },
  { icon: CreditCard, label: "Vendas" },
  { icon: Wallet, label: "Saques" },
  { icon: Users, label: "Afiliados" },
  { icon: Layers, label: "Produtos" },
  { icon: Shield, label: "Antifraude" },
  { icon: Code2, label: "API" },
];

function useAntiCollide(count: number) {
  // deterministic vertical stagger so notifications don't overlap
  return Array.from({ length: count }, (_, i) => 24 + i * 92);
}

function HolographicDashboard() {
  const reduce = useReducedMotion();
  const [feed, setFeed] = useState(LIVE_TX.slice(0, 5));
  const [notifs, setNotifs] = useState<Array<{ id: number; tx: typeof LIVE_TX[number] }>>([]);
  const [revenue, setRevenue] = useState(47892);
  const coin = useCoinSound();
  const nextIdRef = useRef(0);

  // Rotate live feed inside the dashboard
  useEffect(() => {
    if (reduce) return;
    let i = 5;
    const id = setInterval(() => {
      setFeed(prev => [LIVE_TX[i % LIVE_TX.length], ...prev].slice(0, 5));
      i++;
    }, 2600);
    return () => clearInterval(id);
  }, [reduce]);

  // Push side notifications + play coin
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const push = () => {
      const tx = LIVE_TX[i % LIVE_TX.length]; i++;
      const id = ++nextIdRef.current;
      setNotifs(prev => [{ id, tx }, ...prev].slice(0, 3));
      setRevenue(r => r + Number(tx.value.replace(/[^\d,]/g, "").replace(",", ".")));
      coin.play();
      setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== id)), 5200);
    };
    const id = setInterval(push, 3400);
    const kick = setTimeout(push, 1200);
    return () => { clearInterval(id); clearTimeout(kick); };
  }, [reduce, coin]);

  const slots = useAntiCollide(3);

  return (
    <div className="relative w-full max-w-[1080px] mx-auto">
      {/* ═══ MAIN APP WINDOW — flat, stable, no 3D tilt ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className="relative rounded-[20px] overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #0b0f14 0%, #070a0e 100%)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.06), 0 40px 120px -30px rgba(52,211,153,0.28), 0 20px 60px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* window chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05] bg-gradient-to-b from-white/[0.02] to-transparent">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="ml-4 h-6 flex-1 max-w-[360px] rounded-md bg-black/40 border border-white/[0.04] flex items-center px-2.5 text-[10px] font-mono text-white/50">
            <Lock className="h-3 w-3 mr-1.5 text-emerald-400/70" /> hotzfy.com.br/dashboard
          </div>
          <button
            onClick={coin.toggle}
            className={cn(
              "ml-auto flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider transition",
              coin.enabled
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80"
            )}
            aria-label="Ativar som de venda"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", coin.enabled ? "bg-emerald-400 animate-pulse" : "bg-white/30")} />
            {coin.enabled ? "Som ligado" : "Ativar som 🔔"}
          </button>
        </div>

        {/* app body: sidebar + main */}
        <div className="grid grid-cols-[184px_1fr] min-h-[520px]">
          {/* sidebar */}
          <aside className="border-r border-white/[0.04] bg-gradient-to-b from-white/[0.015] to-transparent p-3 flex flex-col gap-1">
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <HotzfyLogo size={22} animated={false} />
              <span className="text-[12px] font-display font-black text-white tracking-tight">HOTZFY</span>
            </div>
            {SELLER_NAV.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold transition",
                  item.active
                    ? "bg-emerald-500/[0.10] text-emerald-300 border border-emerald-400/20"
                    : "text-white/45 border border-transparent"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {item.active && <span className="ml-auto h-1 w-1 rounded-full bg-emerald-400" />}
              </div>
            ))}
            <div className="mt-auto pt-3 border-t border-white/[0.04]">
              <div className="rounded-lg bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-400/15 p-2.5">
                <div className="text-[8.5px] font-mono uppercase tracking-widest text-emerald-300/70 font-bold">Saldo disponível</div>
                <div className="mt-0.5 text-sm font-black text-white font-display tabular-nums">R$ 84.219</div>
                <div className="mt-1.5 text-[9px] rounded-md bg-emerald-500/20 text-emerald-300 font-bold uppercase text-center py-1 tracking-wider">Sacar PIX</div>
              </div>
            </div>
          </aside>

          {/* main content */}
          <main className="p-4 space-y-3">
            {/* greeting header */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-black tracking-[-0.02em] text-[15px] text-white leading-tight truncate">
                  Seja bem-vindo, <span className="text-emerald-300">Rafael</span>
                </div>
                <div className="text-[9.5px] text-white/40 mt-0.5">Que essa jornada seja leve, produtiva e cheia de conquistas!</div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                <div className="h-6 w-6 rounded-md bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center">
                  <Activity className="h-3 w-3 text-emerald-300" />
                </div>
                <div>
                  <div className="text-[8px] font-mono uppercase tracking-widest text-white/40 font-bold">Faturamento · hoje</div>
                  <div className="text-[11px] font-black text-white font-display tabular-nums">
                    R$ <CountUp to={revenue} decimals={0} duration={0.8} />
                  </div>
                </div>
              </div>
            </div>

            {/* mini ranking hero */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-cyan-500/[0.04] p-3 flex items-center gap-4">
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  <Sparkles className="h-2.5 w-2.5" /> Corrida de Faturamento
                </div>
                <div className="mt-1 font-display font-black text-[15px] text-white tracking-[-0.02em] leading-tight">
                  Conheça os <span className="text-emerald-300">CAMPEÕES</span>
                </div>
              </div>
              <div className="flex items-end gap-1.5">
                {[
                  { pos: "2", h: "h-8", tone: "from-slate-300 to-slate-500" },
                  { pos: "1", h: "h-11", tone: "from-yellow-300 to-amber-500" },
                  { pos: "3", h: "h-6", tone: "from-orange-400 to-orange-700" },
                ].map((p) => (
                  <div key={p.pos} className={cn("w-5 rounded-t-md bg-gradient-to-b flex items-start justify-center pt-0.5", p.h, p.tone)}>
                    <span className="font-display font-black text-[8px] text-black/70">{p.pos}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 KPI cards */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { l: "Ticket Médio", pre: "R$ ", to: 153, dec: 0, icon: BarChart3, tone: "emerald" as const, sub: "Média bruta" },
                { l: "Pedidos Pagos", pre: "", to: 312, dec: 0, icon: Zap, tone: "emerald" as const, sub: "Concluídas" },
                { l: "Saldo Pendente", pre: "R$ ", to: 8420, dec: 0, icon: Activity, tone: "cyan" as const, sub: "D+N liberar" },
                { l: "Faturamento", pre: "R$ ", to: revenue, dec: 0, icon: Wallet, tone: "emerald" as const, sub: "vs ontem +18%" },
              ].map((k, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.06 }}
                  className="relative rounded-xl p-2.5 bg-white/[0.02] border border-white/[0.05] overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[8.5px] uppercase tracking-wider text-white/40 font-bold">{k.l}</div>
                    <k.icon className={cn("h-3 w-3", k.tone === "emerald" ? "text-emerald-300" : "text-cyan-300")} />
                  </div>
                  <div className="mt-1 text-[13px] font-black text-white font-display tabular-nums leading-tight">
                    <CountUp to={k.to} decimals={k.dec} prefix={k.pre} duration={1.4} />
                  </div>
                  <div className="text-[8px] text-white/30 font-mono mt-0.5">{k.sub}</div>
                </motion.div>
              ))}
            </div>

            {/* chart + feed */}
            <div className="grid grid-cols-[1.35fr_1fr] gap-2">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                className="rounded-xl p-3 bg-white/[0.02] border border-white/[0.05] relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <div className="text-[10px] font-bold text-white/85 font-display">Faturamento</div>
                    <div className="text-[8.5px] font-mono text-white/35 uppercase tracking-wider">Últimas 24h · UTC-3</div>
                  </div>
                  <div className="flex gap-1">
                    {["24h", "7d", "30d"].map((t, i) => (
                      <span key={t} className={cn(
                        "text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded",
                        i === 0 ? "bg-emerald-500/15 text-emerald-300" : "text-white/30"
                      )}>{t}</span>
                    ))}
                  </div>
                </div>
                <svg viewBox="0 0 400 130" className="w-full h-[140px]">
                  <defs>
                    <linearGradient id="lchart" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                    </linearGradient>
                    <pattern id="chartgrid" width="50" height="26" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 26" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="400" height="130" fill="url(#chartgrid)" />
                  <motion.path
                    d="M0,90 C40,80 60,60 100,55 C140,50 160,80 200,65 C240,50 260,25 300,30 C340,35 360,15 400,10 L400,130 L0,130 Z"
                    fill="url(#lchart)"
                    initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.6, delay: 1.2 }}
                  />
                  <motion.path
                    d="M0,90 C40,80 60,60 100,55 C140,50 160,80 200,65 C240,50 260,25 300,30 C340,35 360,15 400,10"
                    fill="none" stroke="#34d399" strokeWidth="2"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, delay: 1.2 }}
                    style={{ filter: "drop-shadow(0 0 6px rgba(52,211,153,0.6))" }}
                  />
                </svg>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
                className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
                  <div className="text-[10px] font-bold text-white/85 font-display">Vendas ao vivo</div>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[8.5px] font-mono font-bold text-emerald-300 uppercase tracking-wider">Stream</span>
                  </div>
                </div>
                <div className="flex-1 relative">
                  <AnimatePresence initial={false}>
                    {feed.map((tx, i) => (
                      <LiveTransactionRow key={`${tx.name}-${tx.product}-${i}`} tx={tx} idx={i} />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </main>
        </div>
      </motion.div>

      {/* ═══ iOS-STYLE NOTIFICATION STACK — with HOTZFY logo as app icon ═══ */}
      <div className="pointer-events-none absolute right-0 md:-right-8 lg:-right-16 top-16 hidden md:flex flex-col gap-2.5 w-[300px] z-20">
        <AnimatePresence initial={false}>
          {notifs.map((n, idx) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, y: -30, scale: 0.85, filter: "blur(8px)" }}
              animate={{
                opacity: idx === 0 ? 1 : idx === 1 ? 0.78 : 0.55,
                y: 0,
                scale: idx === 0 ? 1 : idx === 1 ? 0.96 : 0.92,
                filter: "blur(0px)",
              }}
              exit={{ opacity: 0, x: 320, scale: 0.9, transition: { duration: 0.35 } }}
              transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.7 }}
              className="relative rounded-[22px] overflow-hidden"
              style={{
                background: "rgba(28, 28, 30, 0.72)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.08) inset, 0 0 0 0.5px rgba(255,255,255,0.12), 0 20px 40px -12px rgba(0,0,0,0.55)",
              }}
            >
              <div className="flex items-start gap-2.5 px-3.5 py-3">
                {/* app icon — HOTZFY logo in rounded-square (iOS app icon style) */}
                <div
                  className="shrink-0 h-[38px] w-[38px] rounded-[10px] flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #052e2b 0%, #0b0f14 100%)",
                    boxShadow: "0 0 0 0.5px rgba(52,211,153,0.35), 0 4px 10px -2px rgba(0,0,0,0.4)",
                  }}
                >
                  <HotzfyLogo size={26} animated={false} />
                </div>
                <div className="min-w-0 flex-1 pt-[1px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-white/95 tracking-tight leading-none">HOTZFY</span>
                    <span className="text-[10px] font-medium text-white/45 tracking-tight leading-none">agora</span>
                  </div>
                  <div className="mt-1 text-[12.5px] font-semibold text-white leading-snug tracking-[-0.01em]">
                    Nova venda aprovada
                  </div>
                  <div className="text-[11.5px] text-white/70 leading-snug tracking-[-0.005em]">
                    <span className="tabular-nums font-semibold text-emerald-300">+ {n.tx.value}</span>
                    <span className="text-white/50"> · {n.tx.name} · {n.tx.city}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}



function Hero() {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  const dashY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-center justify-center pt-28 pb-20 px-4 md:px-8 overflow-hidden">
      <Particles />
      <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-7xl w-full mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/5 backdrop-blur-md text-[10px] font-display font-black uppercase tracking-[0.2em] text-emerald-300 mb-8"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          FOCADO EM QUEM QUER ESCALAR DE VERDADE!
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="font-display font-black tracking-[-0.05em] leading-[0.95] text-5xl md:text-7xl lg:text-8xl"
        >
          <span className="block text-foreground">Pagamentos</span>
          <GlitchText className="block bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
            de outra era.
          </GlitchText>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-8 max-w-2xl mx-auto text-base md:text-xl text-muted-foreground/80 font-display leading-relaxed"
        >
          Checkout holográfico, antifraude neural e saques em 1 dia útil.
          A infraestrutura que os infoprodutores do <span className="text-emerald-300 font-bold">futuro</span> já usam — hoje.
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
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Alta Aprovação</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> PIX em 0.2s</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Saque em D+0</span>
        </motion.div>

        <motion.div style={{ y: dashY }} className="mt-24 md:mt-32">
          <HolographicDashboard />
        </motion.div>
      </motion.div>
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
                  <CountUp to={m.to} decimals={m.decimals} prefix={m.prefix} suffix={m.suffix} />
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
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // Layered 3D reveal: cards drift at different speeds like separating planes
  const yA = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const yB = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const yC = useTransform(scrollYProgress, [0, 1], [90, -90]);
  const lanes = [yA, yB, yC];
  return (
    <section id="features" ref={ref} className="relative py-24 md:py-32 px-4 md:px-8">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 [perspective:1400px]">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} style={reduce ? undefined : { y: lanes[i % 3] }} className="will-change-transform">
              <FeatureCard f={f} i={i} />
            </motion.div>
          ))}
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
  { name: "Marina Ribeiro", role: "CEO · Método Ascensão", quote: "Migrei do concorrente e faturei 3x no primeiro mês. Checkout com conversão absurda e o saque instantâneo mudou meu fluxo de caixa.", metric: "+312% conversão" },
  { name: "Rodrigo Vasques", role: "Fundador · Trader Elite", quote: "Adquirencia HOTZFY  reduziu 98% dos chargebacks/MEDS que eu tinha. Nunca vi um gateway tão preciso.", metric: "−98% chargeback" },
  { name: "Camila Nogueira", role: "Producer · Escola Digital", quote: "API brutal, docs impecáveis. Integrei em 5 minutos o que na outra plataforma levou 2 horas. Splits automáticos por coprodutor.", metric: "5m integração" },
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
    <footer className="relative border-t border-white/5 py-12 px-4 md:px-8 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(52,211,153,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.6) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
      <div className="relative max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <HotzfyLogo size={24} withWordmark />
        <div className="hidden">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Uptime 99.99% · ao vivo
        </div>
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
  // Global body has overflow:hidden for the app shell; the landing page needs
  // window scroll for parallax + IntersectionObserver reveals, so unlock while mounted.
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <Seo
        title="HOTZFY — Gateway de Pagamentos do Futuro para Infoprodutos"
        description="Checkout holográfico, antifraude neural, saques em 1 dia útil. Zero mensalidade. A infraestrutura de pagamentos dos infoprodutores do ano 3000."
        path="/"
        jsonLd={JSONLD}
      />

      {/* keyframes + reduced-motion guard */}
      <style>{`
        @keyframes hzGridDrift { 0% { transform: translate(0,0); } 100% { transform: translate(56px,56px); } }
        @keyframes hzScan { 0% { top: -2px; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100vh; opacity: 0; } }
        @keyframes hzFloat { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.05); } }
        @keyframes hzSweep { 0%, 100% { transform: translateX(-100%); } 50% { transform: translateX(100%); } }
        @keyframes hzMarquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes hzFloatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes hzGlitchA { 0%, 92%, 100% { transform: translate(0,0); opacity: 0; } 93% { transform: translate(-2px,1px); opacity: .9; } 96% { transform: translate(2px,-1px); opacity: .7; } 99% { transform: translate(-1px,0); opacity: .5; } }
        @keyframes hzGlitchB { 0%, 92%, 100% { transform: translate(0,0); opacity: 0; } 94% { transform: translate(2px,-1px); opacity: .8; } 97% { transform: translate(-2px,1px); opacity: .6; } }
        .hz-glitch { position: relative; }
        .hz-glitch::before, .hz-glitch::after {
          content: attr(data-text);
          position: absolute; inset: 0;
          background: inherit; -webkit-background-clip: text; background-clip: text; color: transparent;
          pointer-events: none;
        }
        .hz-glitch::before { text-shadow: 2px 0 rgba(34,211,238,.9); animation: hzGlitchA 5.5s infinite steps(1); mix-blend-mode: screen; }
        .hz-glitch::after { text-shadow: -2px 0 rgba(167,139,250,.9); animation: hzGlitchB 5.5s infinite steps(1); mix-blend-mode: screen; }
        @media (prefers-reduced-motion: reduce) {
          .hz-glitch::before, .hz-glitch::after { display: none; }
          *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
        }
      `}</style>

      <HoloGrid />
      <NeuralNet />
      <Nav />

      <main className="relative z-10">
        <Hero />
        <MetricsStrip />
        <LiveFeed />
        <Features />
        <Testimonials />
        <Pricing />
        <FaqSection />
        <FinalCTA />

      </main>
      <Footer />
    </div>
  );
}
