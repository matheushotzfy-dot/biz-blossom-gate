/**
 * Premiações — Ultra-Premium Awards Trail
 * @module Premiacoes
 * @version 6.0.0 — Cinematic Immersive Redesign
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
 Trophy, Lock, CheckCircle2, Sparkles, Star, Crown, Gem, Zap, Gift, Target,
 Flame, Award, TrendingUp, Shield, ArrowUp, Rocket, ArrowUpRight, Eye,
 Percent, Radio, ChevronRight, Medal,
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
 primary: { accent: "bg-primary", bg: "bg-primary/8", ring: "ring-primary/15", text: "text-primary", glow: "shadow-primary/15", gradient: "from-primary/15 to-primary/3" },
 info: { accent: "bg-info", bg: "bg-info/8", ring: "ring-info/15", text: "text-info", glow: "shadow-info/15", gradient: "from-info/15 to-info/3" },
 warning: { accent: "bg-warning", bg: "bg-warning/8", ring: "ring-warning/15", text: "text-warning", glow: "shadow-warning/15", gradient: "from-warning/15 to-warning/3" },
 success: { accent: "bg-success", bg: "bg-success/8", ring: "ring-success/15", text: "text-success", glow: "shadow-success/15", gradient: "from-success/15 to-success/3" },
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

/* ═══ Premium Award Card ═══ */
function AwardCard({ award, idx, unlocked, isCurrent, revenue }: {
 award: typeof AWARDS[0]; idx: number; unlocked: boolean; isCurrent: boolean; revenue: number;
}) {
 const t = TONE_MAP[award.tone];
 const Icon = award.icon;
 const progress = Math.min((revenue / award.value) * 100, 100);
 const [hovered, setHovered] = useState(false);

 return (
 <motion.div
 initial={{ opacity: 0, x: -24 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: idx * 0.06, duration: 0.5, ease }}
 className="relative flex gap-4 md:gap-5"
 onMouseEnter={() => setHovered(true)}
 onMouseLeave={() => setHovered(false)}
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
 animate={hovered && (unlocked || isCurrent) ? { y: -3 } : { y: 0 }}
 transition={{ duration: 0.25, ease }}
 className={cn(
 "flex-1 mb-2 relative rounded-2xl bg-card/95 ring-1 overflow-hidden p-5 md:p-6 transition-all duration-500",
 unlocked ? cn("ring-border/20 hover:ring-border/40 hover:shadow-lg", `hover:${t.glow}`) :
 isCurrent ? "ring-primary/15 shadow-md shadow-primary/8 hover:ring-primary/25" :
 "ring-border/10 opacity-40 hover:opacity-55"
 )}
 >
 {/* Accent bar */}
 <div className={cn(
 "absolute left-0 top-0 bottom-0 w-[3px] rounded-full transition-all duration-500",
 unlocked ? t.accent : isCurrent ? "bg-primary" : "bg-border/15"
 )} />

 {/* Ambient gradient */}
 {unlocked && <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30 pointer-events-none", t.gradient)} />}
 {isCurrent && <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />}

 <div className="relative z-10 flex flex-col lg:flex-row gap-5">
 {/* Award Image */}
 <div className={cn(
 "relative w-full lg:w-48 h-40 lg:h-auto shrink-0 flex items-center justify-center rounded-2xl overflow-hidden ring-1 transition-all duration-500",
 unlocked ? cn("bg-gradient-to-br ring-border/20", t.gradient) :
 isCurrent ? "bg-primary/5 ring-primary/10" :
 "bg-muted/5 ring-border/5"
 )}>
 <motion.img
 src={award.image}
 alt={award.title}
 className={cn(
 "h-full w-full object-contain max-h-36 lg:max-h-40 drop-shadow-xl transition-all duration-700",
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
 "text-[8px] font-display font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-lg ring-1",
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
 className="text-[8px] font-display font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-lg bg-primary/10 ring-1 ring-primary/20 text-primary inline-flex items-center gap-1"
 >
 <Rocket className="h-2.5 w-2.5" /> Próximo
 </motion.span>
 )}
 {unlocked && (
 <span className="text-[8px] font-display font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-lg bg-success/8 ring-1 ring-success/15 text-success">
 ✓ Conquistado
 </span>
 )}
 </div>
 <h3 className={cn(
 "text-base md:text-lg font-display font-black tracking-[-0.03em]",
 unlocked ? "text-foreground" : isCurrent ? "text-foreground/70" : "text-muted-foreground/20"
 )}>
 {award.title}
 </h3>
 </div>
 <span className={cn(
 "text-lg md:text-xl font-display font-black shrink-0 tabular-nums tracking-[-0.04em]",
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
 "text-[9px] font-display font-bold px-2.5 py-1 rounded-lg ring-1 inline-flex items-center gap-1.5",
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
 <span className={cn("text-[9px] font-display font-bold", isCurrent ? "text-primary/50" : "text-muted-foreground/10")}>Progresso</span>
 <span className={cn("text-[9px] font-display font-black tabular-nums", isCurrent ? "text-primary/60" : "text-muted-foreground/10")}>{progress.toFixed(1)}%</span>
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
 const [expandedSection, setExpandedSection] = useState<"awards" | null>("awards");

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

 return (
 <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative space-y-5">
 {/* Ambient */}
 <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
 <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-48 -right-48 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[200px]" />
 <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-warning/15 rounded-full blur-[180px]" />
 </div>

 {/* ═══ HERO ═══ */}
 <motion.section
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.6 }}
 className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 overflow-hidden"
 >
 {/* Top accent gradient */}
 <div className="h-1.5 bg-gradient-to-r from-primary via-warning/80 to-destructive/60" />
 
 {/* Mesh gradient */}
 <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-warning/[0.03] pointer-events-none" />
 <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

 <div className="relative z-10 p-6 md:p-8">
 {/* Top bar */}
 <div className="flex items-center justify-between mb-8">
 <div className="flex items-center gap-2.5">
 <motion.div
 whileHover={{ rotate: [0, -10, 10, 0] }}
 transition={{ duration: 0.6 }}
 className="h-9 w-9 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center shadow-lg shadow-primary/10"
 >
 <Trophy className="h-4 w-4 text-primary" />
 </motion.div>
 <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground/40">Trilha de Conquistas</span>
 </div>
 <div className="flex items-center gap-2.5">
 <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success/5 ring-1 ring-success/10">
 <div className="relative">
 <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
 <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-success/40 animate-ping" />
 </div>
 <span className="text-[9px] font-display font-bold text-success uppercase tracking-[0.15em]">{unlockedCount} Desbloqueadas</span>
 </div>
 <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/5 ring-1 ring-primary/10">
 <Sparkles className="h-3 w-3 text-primary" />
 <span className="text-[9px] font-display font-bold text-primary">{AWARDS.length} Marcos</span>
 </div>
 </div>
 </div>

 {/* Hero revenue display */}
 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ease }} className="flex flex-col md:flex-row items-start md:items-end gap-6">
 <div className="flex-1">
 <p className="text-[9px] font-display font-bold uppercase tracking-[0.25em] text-muted-foreground/35 mb-2">Faturamento Líquido Total</p>
 <div className="flex items-end gap-3">
 <h2 className="text-[40px] sm:text-[52px] md:text-[64px] font-display font-black tracking-[-0.04em] text-foreground leading-[0.9]">
 <AnimatedNumber value={revenue} formatter={fmtC} />
 </h2>
 {revenue > 0 && (
 <motion.span
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 className="inline-flex items-center gap-0.5 text-[9px] font-display font-bold text-success bg-success/6 px-2 py-0.5 rounded-md ring-1 ring-success/10 mb-2"
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

 {/* Next award preview — desktop */}
 {nextAward && (
 <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, ease }}
 className="hidden md:flex items-center gap-4 p-4 rounded-2xl bg-muted/5 ring-1 ring-border/10 shrink-0">
 <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/10 to-warning/5 flex items-center justify-center ring-1 ring-primary/10 overflow-hidden">
 <img src={nextAward.image} alt={nextAward.title} className="h-14 w-14 object-contain drop-shadow-lg" />
 </div>
 <div>
 <p className="text-[9px] font-display font-bold text-muted-foreground/30 uppercase tracking-[0.15em]">Próximo</p>
 <p className="text-[14px] font-display font-black text-foreground/70">{nextAward.title}</p>
 <p className="text-[10px] text-primary font-display font-bold tabular-nums">{nextAward.label}</p>
 </div>
 </motion.div>
 )}
 </motion.div>
 </div>
 </motion.section>

 {/* ═══ KPI Grid ═══ */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {[
 { label: "Faturamento", value: fmtC(revenue), icon: Flame, tone: "primary", sub: "receita líquida total" },
 { label: "Conquistas", value: `${unlockedCount}/${AWARDS.length}`, icon: Trophy, tone: "success", sub: `${unlockedCount} desbloqueadas` },
 { label: "Próximo Marco", value: nextAward ? nextAward.label : "✓", icon: Target, tone: "warning", sub: nextAward ? nextAward.tier : "Completo!" },
 { label: "Progresso", value: `${globalProgress.toFixed(0)}%`, icon: Percent, tone: "info", sub: nextAward ? `faltam ${fmtC(nextAward.value - revenue)}` : "lenda absoluta" },
 ].map((kpi, i) => (
 <motion.div
 key={kpi.label}
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.06, ease }}
 className={cn("relative group rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 overflow-hidden hover:ring-border/40 transition-all duration-300 hover:shadow-lg", `hover:shadow-${kpi.tone}/10`)}
 >
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", `bg-${kpi.tone}`)} />
 <div className={cn("absolute -top-12 -right-12 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[40px] pointer-events-none", `bg-${kpi.tone}/12`)} />
 <div className="relative z-10">
 <div className="flex items-center justify-between mb-3">
 <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center ring-1 transition-transform duration-300 group-hover:scale-110", `bg-${kpi.tone}/8 ring-${kpi.tone}/15`)}>
 <kpi.icon className={cn("h-4 w-4", `text-${kpi.tone}`)} />
 </div>
 <span className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">{kpi.label}</span>
 </div>
 <p className={cn("text-xl md:text-2xl font-display font-black tracking-[-0.04em]", `text-${kpi.tone}`)}>{kpi.value}</p>
 {kpi.sub && <p className="text-[9px] text-muted-foreground/30 mt-1 font-display">{kpi.sub}</p>}
 </div>
 </motion.div>
 ))}
 </div>

 {/* ═══ Global Progress Bar ═══ */}
 <motion.div
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.24, ease }}
 className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 overflow-hidden group"
 >
 <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-gradient-to-b from-primary to-warning" />
 <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-warning/[0.02] pointer-events-none" />

 <div className="relative z-10">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2.5">
 <div className="h-8 w-8 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
 <TrendingUp className="h-3.5 w-3.5 text-primary" />
 </div>
 <div>
 <span className="text-[11px] font-display font-black text-foreground/70 block">Progresso Geral</span>
 <span className="text-[9px] font-medium text-muted-foreground/35">{unlockedCount} de {AWARDS.length} marcos conquistados</span>
 </div>
 </div>
 <span className="text-lg font-display font-black text-primary tabular-nums">{((unlockedCount / AWARDS.length) * 100).toFixed(0)}%</span>
 </div>

 <div className="h-3 rounded-full bg-muted/10 ring-1 ring-border/8 overflow-hidden">
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
 className="flex flex-col items-center gap-1.5 group/dot cursor-default"
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
 "text-[7px] font-display font-bold tabular-nums hidden sm:block transition-all",
 unlocked ? at.text + "/60" : "text-muted-foreground/15",
 "group-hover/dot:text-foreground/60"
 )}>{a.label}</span>
 </motion.div>
 );
 })}
 </div>
 </div>
 </motion.div>

 {/* ═══ Awards Trail ═══ */}
 <div className="relative">
 {/* Section header */}
 <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }}
 className="flex items-center gap-2.5 mb-5">
 <div className="h-8 w-8 rounded-xl bg-warning/8 ring-1 ring-warning/15 flex items-center justify-center">
 <Medal className="h-3.5 w-3.5 text-warning" />
 </div>
 <div>
 <h3 className="text-[14px] font-display font-black text-foreground tracking-[-0.02em]">Conquistas & Premiações</h3>
 <p className="text-[10px] text-muted-foreground/35">Desbloqueie marcos com seu faturamento</p>
 </div>
 </motion.div>

 {/* Vertical line background */}
 <div className="absolute left-[23px] md:left-[27px] top-[72px] bottom-4 w-[2px] bg-border/8 rounded-full" />
 {/* Animated progress line */}
 <motion.div
 initial={{ height: 0 }}
 animate={{ height: unlockedCount === 0 ? "0%" : unlockedCount === AWARDS.length ? "100%" : `${((unlockedCount) / AWARDS.length) * 100}%` }}
 transition={{ duration: 2, delay: 0.5, ease }}
 className="absolute left-[23px] md:left-[27px] top-[72px] w-[2px] bg-gradient-to-b from-primary via-primary/60 to-primary/20 rounded-full shadow-sm shadow-primary/20"
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
 <motion.div
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: AWARDS.length * 0.07 + 0.4, ease }}
 className={cn(
 "flex-1 p-5 rounded-2xl bg-card/95 ring-1 overflow-hidden transition-all duration-500",
 unlockedCount === AWARDS.length
 ? "ring-primary/20 shadow-lg shadow-primary/10"
 : "ring-border/10 opacity-40"
 )}
 >
 <div className={cn(
 "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
 unlockedCount === AWARDS.length ? "bg-gradient-to-b from-primary to-warning" : "bg-border/10"
 )} />
 <div className="flex items-center gap-3 pl-2 relative z-10">
 {unlockedCount === AWARDS.length && (
 <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
 <Trophy className="h-6 w-6 text-primary" />
 </motion.div>
 )}
 <p className={cn(
 "text-sm font-display font-black",
 unlockedCount === AWARDS.length
 ? "text-transparent bg-clip-text bg-gradient-to-r from-primary to-warning"
 : "text-muted-foreground/15"
 )}>
 {unlockedCount === AWARDS.length
 ? "Todas as conquistas desbloqueadas — Você é uma Lenda!"
 : "Continue sua jornada para desbloquear todas as conquistas"}
 </p>
 </div>
 </motion.div>
 </motion.div>
 </div>
 </div>
 </div>
 );
}
