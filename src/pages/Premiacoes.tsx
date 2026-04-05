/**
 * Premiações — Ultra-Premium Awards Trail
 * @module Premiacoes
 * @version 5.0.0 — Fintech Command Center Redesign
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Lock, CheckCircle2, Sparkles, Star, Crown, Gem, Zap, Gift, Target,
  Flame, Award, TrendingUp, Shield, ArrowUp, Rocket, ArrowUpRight, Eye,
  Percent, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

import braceletCard from "@/assets/awards/bracelet-card-10k.png";
import plaque10k from "@/assets/awards/plaque-10k.png";
import plaque100k from "@/assets/awards/plaque-100k.png";
import plaque250k from "@/assets/awards/plaque-250k.png";
import plaque500k from "@/assets/awards/plaque-500k.png";
import plaque1m from "@/assets/awards/plaque-1m.png";
import plaque5m from "@/assets/awards/plaque-5m.png";
import plaque10m from "@/assets/awards/plaque-10m.png";

/* ═══ Types & Data ═══ */
type Tone = "primary" | "info" | "warning" | "success" | "destructive";

const AWARDS = [
  { id: "10k", value: 10000, label: "R$ 10K", tier: "Primeiro Marco", title: "Kit Exclusivo HOTZFY", description: "Pulseira de couro premium + Cartão Black exclusivo HOTZFY. Você provou que tem o que é preciso.", motivation: "Essa é a prova de que você está no caminho certo. O primeiro passo sempre é o mais difícil — e você já deu.", image: braceletCard, icon: Zap, rewards: ["Pulseira HOTZFY Premium", "Cartão Black Exclusivo"], tone: "primary" as Tone },
  { id: "100k", value: 100000, label: "R$ 100K", tier: "Bronze", title: "Plaquinha Bronze", description: "Plaquinha de faturamento em mármore negro com detalhes dourados.", motivation: "100K é onde a brincadeira acaba e o jogo real começa. Você já é mais forte que 95% dos empreendedores.", image: plaque100k, icon: Star, rewards: ["Plaquinha Bronze em Mármore"], tone: "warning" as Tone },
  { id: "250k", value: 250000, label: "R$ 250K", tier: "Prata", title: "Plaquinha Prata", description: "Plaquinha em acabamento prata platinado. Você está no topo do mercado digital.", motivation: "Um quarto de milhão. Enquanto muitos sonham, você executa.", image: plaque250k, icon: Star, rewards: ["Plaquinha Prata Platinada"], tone: "info" as Tone },
  { id: "500k", value: 500000, label: "R$ 500K", tier: "Ouro", title: "Plaquinha Ouro", description: "Plaquinha banhada a ouro com detalhes em esmeralda. Meio milhão — marca de poucos.", motivation: "Meio milhão. Você não é mais um vendedor — é uma máquina de valor.", image: plaque500k, icon: Crown, rewards: ["Plaquinha Ouro 24K"], tone: "warning" as Tone },
  { id: "1m", value: 1000000, label: "R$ 1M", tier: "Diamante", title: "Plaquinha Diamante", description: "Plaquinha cravejada em diamante. 1 Milhão — você é uma lenda.", motivation: "1 MILHÃO. Você entrou no clube dos que transformam ideias em impérios.", image: plaque1m, icon: Gem, rewards: ["Plaquinha Diamante Cravejada"], tone: "info" as Tone },
  { id: "5m", value: 5000000, label: "R$ 5M", tier: "Elite", title: "Plaquinha Elite", description: "Plaquinha Rose Gold com diamantes negros. Apenas os melhores chegam aqui.", motivation: "5 MILHÕES. Você criou seu próprio nível. Respeito absoluto.", image: plaque5m, icon: Crown, rewards: ["Plaquinha Elite Rose Gold"], tone: "destructive" as Tone },
  { id: "10m", value: 10000000, label: "R$ 10M", tier: "Lenda", title: "Plaquinha Lenda", description: "Plaquinha com gemas preciosas multicoloridas. Você é uma LENDA imortal.", motivation: "10 MILHÕES. Seu nome será lembrado para sempre na história do digital.", image: plaque10m, icon: Sparkles, rewards: ["Plaquinha Lenda com Gemas"], tone: "primary" as Tone },
];

const TONE_MAP: Record<Tone, { accent: string; bg: string; ring: string; text: string; glow: string; gradient: string }> = {
  primary:     { accent: "bg-primary",     bg: "bg-primary/8",     ring: "ring-primary/15",     text: "text-primary",     glow: "shadow-primary/15", gradient: "from-primary/15 to-primary/3" },
  info:        { accent: "bg-info",        bg: "bg-info/8",        ring: "ring-info/15",        text: "text-info",        glow: "shadow-info/15", gradient: "from-info/15 to-info/3" },
  warning:     { accent: "bg-warning",     bg: "bg-warning/8",     ring: "ring-warning/15",     text: "text-warning",     glow: "shadow-warning/15", gradient: "from-warning/15 to-warning/3" },
  success:     { accent: "bg-success",     bg: "bg-success/8",     ring: "ring-success/15",     text: "text-success",     glow: "shadow-success/15", gradient: "from-success/15 to-success/3" },
  destructive: { accent: "bg-destructive", bg: "bg-destructive/8", ring: "ring-destructive/15", text: "text-destructive", glow: "shadow-destructive/15", gradient: "from-destructive/15 to-destructive/3" },
};

const ease = [0.16, 1, 0.3, 1] as const;

const fmtC = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`
  : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}K`
  : `R$ ${v.toLocaleString("pt-BR")}`;

/* ═══ Animated Number ═══ */
function AnimatedNumber({ value, formatter }: { value: number; formatter: (v: number) => string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 1000;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{formatter(display)}</>;
}

/* ═══ Sparkline ═══ */
function Sparkline({ data, color = "primary" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 72; const h = 24;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  const fillPoints = `0,${h} ${points} ${w},${h}`;
  const id = `sp-${color}-${data.length}`;
  return (
    <svg width={w} height={h} className="shrink-0 opacity-50" viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(var(--${color}))`} stopOpacity={0.3} />
          <stop offset="100%" stopColor={`hsl(var(--${color}))`} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={`hsl(var(--${color}))`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══ GlowCard ═══ */
function GlowCard({ children, className, glowColor = "primary", delay = 0 }: {
  children: React.ReactNode; className?: string; glowColor?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease }}
      className={cn("relative group rounded-2xl glass-panel overflow-hidden card-premium", className)}
    >
      <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[60px] pointer-events-none", `bg-${glowColor}/12`)} />
      <div className={cn("absolute -bottom-16 -left-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-1000 blur-[40px] pointer-events-none", `bg-${glowColor}/6`)} />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
      <div className={cn("absolute bottom-0 left-[10%] right-[10%] h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700", `bg-gradient-to-r from-transparent via-${glowColor}/20 to-transparent`)} />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/* ═══ KPI Tile (same pattern as Vendas) ═══ */
function KpiTile({ label, value, icon: Icon, color = "primary", delay = 0, sparkData, sub }: {
  label: string; value: string; icon: any; color?: string; delay?: number; sparkData?: number[]; sub?: string;
}) {
  return (
    <GlowCard glowColor={color} delay={delay} className="p-5 shimmer">
      <div className={cn("absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-500", `bg-${color}`)} />
      <div className="flex items-start justify-between mb-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg", `bg-${color}/10 border-${color}/12 text-${color} group-hover:bg-${color}/15`)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={color} />}
      </div>
      <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/35 mb-1.5">{label}</p>
      <span className="text-2xl font-heading tabular-nums tracking-tight text-foreground leading-none">{value}</span>
      {sub && <p className="text-[10px] text-muted-foreground/40 mt-1.5 font-display">{sub}</p>}
    </GlowCard>
  );
}

/* ═══ Premium Award Card ═══ */
function AwardCard({ award, idx, unlocked, isCurrent, revenue }: {
  award: typeof AWARDS[0]; idx: number; unlocked: boolean; isCurrent: boolean; revenue: number;
}) {
  const t = TONE_MAP[award.tone];
  const Icon = award.icon;
  const progress = Math.min((revenue / award.value) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.06, duration: 0.5, ease }}
      className="relative flex gap-4 md:gap-5"
    >
      {/* Timeline Node */}
      <div className="relative z-10 shrink-0 flex flex-col items-center pt-5">
        <motion.div
          whileHover={{ scale: 1.12 }}
          className={cn(
            "h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center ring-1 transition-all duration-500",
            unlocked ? cn(t.bg, t.ring, t.text, `shadow-md ${t.glow}`) :
            isCurrent ? "bg-primary/10 ring-primary/20 text-primary shadow-md shadow-primary/10" :
            "bg-muted/5 ring-border/10 text-muted-foreground/15"
          )}
        >
          {unlocked ? <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6" /> :
           isCurrent ? <Icon className="h-5 w-5 md:h-6 md:w-6 animate-pulse" /> :
           <Lock className="h-4 w-4 md:h-5 md:w-5" />}
        </motion.div>
      </div>

      {/* Card Body */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.25, ease }}
        className={cn(
          "flex-1 mb-2 relative rounded-2xl glass-panel card-premium overflow-hidden p-5 transition-all duration-500",
          unlocked ? cn("hover:shadow-lg", `hover:${t.glow}`) :
          isCurrent ? "ring-1 ring-primary/15 shadow-md shadow-primary/8" :
          "opacity-40 hover:opacity-60"
        )}
      >
        {/* Accent bar */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] rounded-full transition-all duration-500",
          unlocked ? t.accent : isCurrent ? "bg-primary" : "bg-border/15"
        )} />

        {/* Ambient gradient */}
        {unlocked && <div className={cn("absolute inset-0 bg-gradient-to-br opacity-20 pointer-events-none", t.gradient)} />}
        {isCurrent && <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />}

        <div className="relative z-10 flex flex-col lg:flex-row gap-5">
          {/* Award Image */}
          <div className={cn(
            "relative w-full lg:w-44 h-36 lg:h-auto shrink-0 flex items-center justify-center rounded-xl overflow-hidden ring-1 transition-all duration-500",
            unlocked ? cn("bg-gradient-to-br ring-border/20", t.gradient) :
            isCurrent ? "bg-primary/5 ring-primary/10" :
            "bg-muted/5 ring-border/5"
          )}>
            <motion.img
              src={award.image}
              alt={award.title}
              className={cn(
                "h-full w-full object-contain max-h-32 lg:max-h-36 drop-shadow-xl transition-all duration-700",
                unlocked ? "hover:scale-110" : "grayscale opacity-40"
              )}
              whileHover={unlocked ? { rotate: [0, -2, 2, 0] } : undefined}
              transition={{ duration: 0.6 }}
            />
            {!unlocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-[3px]">
                <div className={cn(
                  "h-10 w-10 rounded-xl backdrop-blur-sm ring-1 flex items-center justify-center",
                  isCurrent ? "bg-primary/10 ring-primary/15" : "bg-card/60 ring-border/10"
                )}>
                  <Lock className={cn("h-4 w-4", isCurrent ? "text-primary/50" : "text-muted-foreground/20")} />
                </div>
              </div>
            )}
            {unlocked && (
              <div className="absolute top-2.5 right-2.5">
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center ring-1 backdrop-blur-sm", t.bg, t.ring)}>
                  <CheckCircle2 className={cn("h-3.5 w-3.5", t.text)} />
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={cn(
                    "text-[8px] font-heading font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-lg ring-1",
                    unlocked ? cn(t.bg, t.ring, t.text) :
                    isCurrent ? "bg-primary/8 ring-primary/15 text-primary" :
                    "bg-muted/5 ring-border/8 text-muted-foreground/15"
                  )}>
                    {award.tier}
                  </span>
                  {isCurrent && (
                    <motion.span
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-[8px] font-heading font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-lg bg-primary/10 ring-1 ring-primary/20 text-primary inline-flex items-center gap-1"
                    >
                      <Rocket className="h-2.5 w-2.5" /> Próximo
                    </motion.span>
                  )}
                  {unlocked && (
                    <span className="text-[8px] font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-lg bg-success/8 ring-1 ring-success/15 text-success">
                      ✓ Conquistado
                    </span>
                  )}
                </div>
                <h3 className={cn(
                  "text-base md:text-lg font-heading font-black tracking-[-0.03em]",
                  unlocked ? "text-foreground" : isCurrent ? "text-foreground/70" : "text-muted-foreground/20"
                )}>
                  {award.title}
                </h3>
              </div>
              <span className={cn(
                "text-lg md:text-xl font-heading font-black shrink-0 tabular-nums tracking-[-0.04em]",
                unlocked ? t.text : isCurrent ? "text-foreground/40" : "text-muted-foreground/10"
              )}>
                {award.label}
              </span>
            </div>

            <p className={cn(
              "text-[11px] leading-relaxed mb-4 font-medium",
              unlocked ? "text-muted-foreground/60" : isCurrent ? "text-muted-foreground/40" : "text-muted-foreground/12"
            )}>
              {award.description}
            </p>

            {/* Rewards chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {award.rewards.map((r) => (
                <span
                  key={r}
                  className={cn(
                    "text-[9px] font-heading font-bold px-2.5 py-1 rounded-lg ring-1 inline-flex items-center gap-1.5",
                    unlocked ? cn(t.bg, t.ring, t.text) :
                    isCurrent ? "bg-primary/5 ring-primary/8 text-primary/40" :
                    "bg-muted/3 ring-border/5 text-muted-foreground/10"
                  )}
                >
                  <Gift className="h-2.5 w-2.5" /> {r}
                </span>
              ))}
            </div>

            {/* Status / Progress */}
            {unlocked ? (
              <div className={cn("rounded-xl px-4 py-3.5 ring-1 bg-gradient-to-r", t.gradient, t.ring)}>
                <p className={cn("text-[10px] font-display font-semibold italic leading-relaxed", t.text)}>
                  "{award.motivation}"
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn("text-[9px] font-heading font-bold", isCurrent ? "text-primary/50" : "text-muted-foreground/10")}>Progresso</span>
                  <span className={cn("text-[9px] font-heading font-black tabular-nums", isCurrent ? "text-primary/60" : "text-muted-foreground/10")}>{progress.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/8 ring-1 ring-border/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.4, delay: idx * 0.1, ease }}
                    className={cn(
                      "h-full rounded-full relative overflow-hidden",
                      isCurrent ? "bg-gradient-to-r from-primary/50 to-primary/30" : "bg-muted-foreground/5"
                    )}
                  >
                    {isCurrent && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />}
                  </motion.div>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowUp className={cn("h-2.5 w-2.5", isCurrent ? "text-primary/30" : "text-muted-foreground/8")} />
                  <p className={cn("text-[9px] font-display font-semibold", isCurrent ? "text-muted-foreground/35" : "text-muted-foreground/8")}>
                    Faltam {fmtC(award.value - revenue)} para desbloquear
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══ MAIN PAGE ═══ */
export default function Premiacoes() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("transactions")
      .select("net_amount")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .then(({ data }) => {
        if (data) setRevenue(data.reduce((s, t) => s + Number(t.net_amount), 0));
      });
  }, [user?.id]);

  const currentTierIdx = AWARDS.findIndex((a) => revenue < a.value);
  const unlockedCount = AWARDS.filter((a) => revenue >= a.value).length;
  const nextAward = currentTierIdx >= 0 ? AWARDS[currentTierIdx] : null;
  const globalProgress = nextAward ? Math.min((revenue / nextAward.value) * 100, 100) : 100;

  // Generate mock sparkline data from revenue
  const sparkRevenue = useMemo(() => {
    const base = revenue * 0.6;
    return Array.from({ length: 7 }, (_, i) => base + (revenue - base) * (i / 6) + Math.random() * revenue * 0.05);
  }, [revenue]);

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
      {/* Dot grid background */}
      <div className="fixed inset-0 dot-grid opacity-30 pointer-events-none z-0" />

      {/* ═══ HERO — Mesh Gradient (same as Vendas) ═══ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative mb-8 rounded-3xl p-6 sm:p-8 lg:p-10 mesh-gradient-hero noise-overlay scan-line"
      >
        {/* Floating blobs */}
        <div className="absolute -inset-16 pointer-events-none">
          <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
          <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-warning/6 rounded-full blur-[160px]" />
          <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        </div>

        <div className="relative z-10">
          {/* Top bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.6 }}
                className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center glow-primary"
              >
                <Trophy className="h-4.5 w-4.5 text-primary" />
              </motion.div>
              <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Trilha de Conquistas</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm">
                <div className="relative">
                  <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-success/40 animate-ping" />
                </div>
                <span className="text-[9px] font-heading uppercase tracking-[0.2em] text-success">{unlockedCount} Desbloqueadas</span>
              </div>
              <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 backdrop-blur-sm">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[9px] font-heading uppercase tracking-[0.2em] text-primary">{AWARDS.length} Marcos</span>
              </div>
            </div>
          </div>

          {/* Hero revenue display */}
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6 mb-4">
            <div>
              <p className="text-[9px] font-heading uppercase tracking-[0.25em] text-muted-foreground/40 mb-2">Faturamento Líquido Total</p>
              <div className="flex items-end gap-3">
                <h2 className="text-[40px] sm:text-[52px] md:text-[64px] font-heading tracking-[-0.04em] text-foreground leading-[0.9] drop-shadow-[0_0_30px_hsl(var(--primary)/0.12)]">
                  <AnimatedNumber value={revenue} formatter={fmtC} />
                </h2>
                {revenue > 0 && (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-0.5 text-[9px] font-heading font-bold text-success bg-success/6 px-2 py-0.5 rounded-md border border-success/10 mb-2"
                  >
                    <ArrowUpRight className="h-2.5 w-2.5" />
                    ativo
                  </motion.span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/40 mt-2 font-display">
                {nextAward ? `Próximo marco: ${nextAward.label} — ${nextAward.tier}` : "Todas as conquistas desbloqueadas!"}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══ KPI Grid (same pattern as Vendas) ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiTile label="Faturamento" value={fmtC(revenue)} icon={Flame} color="primary" delay={0} sparkData={sparkRevenue} sub="receita líquida total" />
        <KpiTile label="Conquistas" value={`${unlockedCount}/${AWARDS.length}`} icon={Trophy} color="success" delay={0.06} sub={`${unlockedCount} desbloqueadas`} />
        <KpiTile label="Próximo Marco" value={nextAward ? nextAward.label : "✓"} icon={Target} color="warning" delay={0.12} sub={nextAward ? nextAward.tier : "Completo!"} />
        <KpiTile label="Progresso" value={`${globalProgress.toFixed(0)}%`} icon={Percent} color="info" delay={0.18} sub={nextAward ? `faltam ${fmtC(nextAward.value - revenue)}` : "lenda absoluta"} />
      </div>

      {/* ═══ Global Progress Bar ═══ */}
      <GlowCard glowColor="primary" delay={0.24} className="p-5 mb-6">
        <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-gradient-to-b from-primary to-warning")} />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <span className="text-[11px] font-heading font-black text-foreground/70 block">Progresso Geral</span>
              <span className="text-[9px] font-medium text-muted-foreground/35">{unlockedCount} de {AWARDS.length} marcos conquistados</span>
            </div>
          </div>
          <span className="text-lg font-heading font-black text-primary tabular-nums">{((unlockedCount / AWARDS.length) * 100).toFixed(0)}%</span>
        </div>

        <div className="h-3 rounded-full bg-muted/10 ring-1 ring-border/10 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(unlockedCount / AWARDS.length) * 100}%` }}
            transition={{ duration: 1.8, ease }}
            className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 relative shadow-md shadow-primary/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
          </motion.div>
        </div>

        {/* Mini milestones */}
        <div className="flex justify-between mt-3.5 px-1">
          {AWARDS.map((a, idx) => {
            const unlocked = revenue >= a.value;
            const at = TONE_MAP[a.tone];
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + idx * 0.06, ease }}
                className="flex flex-col items-center gap-1.5 group cursor-default"
              >
                <motion.div
                  whileHover={{ scale: 1.3 }}
                  className={cn(
                    "h-3.5 w-3.5 rounded-full ring-1 transition-all duration-500",
                    unlocked ? cn(at.accent, at.ring, `shadow-sm ${at.glow}`) :
                    idx === currentTierIdx ? "bg-primary/30 ring-primary/20 animate-pulse" :
                    "bg-muted/8 ring-border/8"
                  )}
                />
                <span className={cn(
                  "text-[7px] font-heading font-bold tabular-nums hidden sm:block transition-all",
                  unlocked ? at.text + "/60" : "text-muted-foreground/15",
                  "group-hover:text-foreground/60"
                )}>{a.label}</span>
              </motion.div>
            );
          })}
        </div>
      </GlowCard>

      {/* ═══ Awards Trail ═══ */}
      <div className="relative">
        {/* Vertical line background */}
        <div className="absolute left-[23px] md:left-[27px] top-4 bottom-4 w-[2px] bg-border/8 rounded-full" />
        {/* Animated progress line */}
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: unlockedCount === 0 ? "0%" : unlockedCount === AWARDS.length ? "100%" : `${((unlockedCount) / AWARDS.length) * 100}%` }}
          transition={{ duration: 2, delay: 0.5, ease }}
          className="absolute left-[23px] md:left-[27px] top-4 w-[2px] bg-gradient-to-b from-primary via-primary/60 to-primary/20 rounded-full shadow-sm shadow-primary/20"
        />

        <div className="space-y-2">
          {AWARDS.map((award, idx) => {
            const unlocked = revenue >= award.value;
            const isCurrent = idx === currentTierIdx;
            return (
              <AwardCard
                key={award.id}
                award={award}
                idx={idx}
                unlocked={unlocked}
                isCurrent={isCurrent}
                revenue={revenue}
              />
            );
          })}

          {/* Final Node */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: AWARDS.length * 0.07 + 0.3 }}
            className="relative flex gap-4 md:gap-5"
          >
            <div className="relative z-10 shrink-0 flex flex-col items-center pt-4">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 360 }}
                transition={{ duration: 0.6 }}
                className={cn(
                  "h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center ring-1 transition-all",
                  unlockedCount === AWARDS.length
                    ? "bg-primary/10 ring-primary/20 text-primary shadow-lg shadow-primary/15"
                    : "bg-muted/5 ring-border/8 text-muted-foreground/10"
                )}
              >
                <Crown className="h-5 w-5 md:h-6 md:w-6" />
              </motion.div>
            </div>
            <GlowCard
              glowColor="primary"
              className={cn(
                "flex-1 p-5 transition-all duration-500",
                unlockedCount === AWARDS.length
                  ? "shadow-lg shadow-primary/10"
                  : "opacity-40"
              )}
            >
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
                unlockedCount === AWARDS.length ? "bg-gradient-to-b from-primary to-warning" : "bg-border/10"
              )} />
              <div className="flex items-center gap-3 pl-2">
                {unlockedCount === AWARDS.length && (
                  <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Trophy className="h-6 w-6 text-primary" />
                  </motion.div>
                )}
                <p className={cn(
                  "text-sm font-heading font-black",
                  unlockedCount === AWARDS.length
                    ? "text-transparent bg-clip-text bg-gradient-to-r from-primary to-warning"
                    : "text-muted-foreground/15"
                )}>
                  {unlockedCount === AWARDS.length
                    ? "Todas as conquistas desbloqueadas — Você é uma Lenda!"
                    : "Continue sua jornada para desbloquear todas as conquistas"}
                </p>
              </div>
            </GlowCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
