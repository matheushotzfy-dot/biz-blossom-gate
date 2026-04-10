/**
 * Gamificação — Ranking & Conquistas
 * @module Gamificacao
 * @version 3.0.0 — Ultra-Premium Redesign
 */

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 Trophy, Star, Crown, Gem, Zap, Flame, Target, Shield, Award, TrendingUp,
 CheckCircle2, Sparkles, Lock, ArrowUpRight, Percent, Users, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

const LEVELS = [
 { name: "Iniciante", min: 0, max: 999, icon: Zap, tone: "muted-foreground" as const },
 { name: "Explorador", min: 1000, max: 9999, icon: Target, tone: "info" as const },
 { name: "Guerreiro", min: 10000, max: 49999, icon: Shield, tone: "primary" as const },
 { name: "Mestre", min: 50000, max: 99999, icon: Star, tone: "warning" as const },
 { name: "Elite", min: 100000, max: 499999, icon: Crown, tone: "warning" as const },
 { name: "Diamante", min: 500000, max: 999999, icon: Gem, tone: "info" as const },
 { name: "Lenda", min: 1000000, max: Infinity, icon: Flame, tone: "destructive" as const },
];

const BADGES = [
 { id: "first_sale", label: "Primeira Venda", desc: "Realizou a primeira venda", icon: Zap, check: (s: Stats) => s.totalSales >= 1 },
 { id: "ten_sales", label: "10 Vendas", desc: "Atingiu 10 vendas aprovadas", icon: Target, check: (s: Stats) => s.totalSales >= 10 },
 { id: "hundred_sales", label: "100 Vendas", desc: "Atingiu 100 vendas aprovadas", icon: Star, check: (s: Stats) => s.totalSales >= 100 },
 { id: "first_product", label: "Criador", desc: "Criou o primeiro produto", icon: Award, check: (s: Stats) => s.products >= 1 },
 { id: "five_products", label: "Empreendedor", desc: "Tem 5+ produtos ativos", icon: Crown, check: (s: Stats) => s.products >= 5 },
 { id: "10k_revenue", label: "R$ 10K", desc: "Faturou R$ 10.000+", icon: TrendingUp, check: (s: Stats) => s.revenue >= 10000 },
 { id: "100k_revenue", label: "R$ 100K", desc: "Faturou R$ 100.000+", icon: Gem, check: (s: Stats) => s.revenue >= 100000 },
 { id: "1m_revenue", label: "R$ 1M", desc: "Faturou R$ 1.000.000+", icon: Flame, check: (s: Stats) => s.revenue >= 1000000 },
];

type Stats = { revenue: number; totalSales: number; products: number };

function getLevel(revenue: number) {
 return LEVELS.find((l) => revenue >= l.min && revenue <= l.max) || LEVELS[0];
}

function getNextLevel(revenue: number) {
 const idx = LEVELS.findIndex((l) => revenue >= l.min && revenue <= l.max);
 return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

const fmtCurrency = (v: number) =>
 v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`
 : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}K`
 : `R$ ${v.toLocaleString("pt-BR")}`;

/* ═══ GlowCard ═══ */
function GlowCard({ children, className, glowColor = "primary", delay = 0 }: {
 children: React.ReactNode; className?: string; glowColor?: string; delay?: number;
}) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay, ease }}
 className={cn("relative group rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden", className)}
 >
 <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[60px] pointer-events-none", `bg-${glowColor}/12`)} />
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
 <div className="relative z-10">{children}</div>
 </motion.div>
 );
}

/* ═══ KPI Tile ═══ */
function KpiTile({ label, value, icon: Icon, color = "primary", delay = 0, sub }: {
 label: string; value: string; icon: any; color?: string; delay?: number; sub?: string;
}) {
 return (
 <GlowCard glowColor={color} delay={delay} className="p-5 shimmer">
 <div className={cn("absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-500", `bg-${color}`)} />
 <div className="flex items-start justify-between mb-3">
 <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110", `bg-${color}/10 border-${color}/12 text-${color}`)}>
 <Icon className="h-4.5 w-4.5" />
 </div>
 </div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/35 mb-1.5">{label}</p>
 <span className="text-2xl font-heading tabular-nums tracking-tight text-foreground leading-none">{value}</span>
 {sub && <p className="text-[10px] text-muted-foreground/40 mt-1.5 font-display">{sub}</p>}
 </GlowCard>
 );
}

/* ═══ Progress Ring ═══ */
function ProgressRing({ value, max = 100, size = 100, strokeWidth = 6, color = "primary" }: {
 value: number; max?: number; size?: number; strokeWidth?: number; color?: string;
}) {
 const radius = (size - strokeWidth) / 2;
 const circumference = 2 * Math.PI * radius;
 const pct = Math.min(value / max, 1);
 return (
 <svg width={size} height={size} className="shrink-0 -rotate-90">
 <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted)/0.08)" strokeWidth={strokeWidth} />
 <motion.circle
 cx={size / 2} cy={size / 2} r={radius} fill="none"
 stroke={`hsl(var(--${color}))`} strokeWidth={strokeWidth}
 strokeLinecap="round"
 initial={{ strokeDashoffset: circumference }}
 animate={{ strokeDashoffset: circumference * (1 - pct) }}
 transition={{ duration: 1.5, ease }}
 strokeDasharray={circumference}
 />
 </svg>
 );
}

/* ═══ MAIN ═══ */
export default function Gamificacao() {
 const { user } = useAuth();
 const [stats, setStats] = useState<Stats>({ revenue: 0, totalSales: 0, products: 0 });

 useEffect(() => {
 if (!user?.id) return;
 Promise.all([
 supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed"),
 supabase.from("products").select("id").eq("user_id", user.id),
 ]).then(([txRes, prodRes]) => {
 const revenue = txRes.data?.reduce((s, t) => s + Number(t.net_amount), 0) ?? 0;
 setStats({ revenue, totalSales: txRes.data?.length ?? 0, products: prodRes.data?.length ?? 0 });
 });
 }, [user?.id]);

 const level = useMemo(() => getLevel(stats.revenue), [stats.revenue]);
 const nextLevel = useMemo(() => getNextLevel(stats.revenue), [stats.revenue]);
 const LevelIcon = level.icon;

 const progress = nextLevel
 ? Math.min(((stats.revenue - level.min) / (nextLevel.min - level.min)) * 100, 100)
 : 100;

 const unlockedBadges = useMemo(() => BADGES.filter((b) => b.check(stats)), [stats]);
 const currentLevelIdx = LEVELS.findIndex(l => l.name === level.name);

 return (
 <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
 {/* ═══ HERO ═══ */}
 <motion.section
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.6 }}
 className="relative mb-8 rounded-3xl p-6 sm:p-8 lg:p-10 border border-border/60 bg-card shadow-sm"
 >
 <div className="absolute -inset-16 pointer-events-none">
 <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
 <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-warning/6 rounded-full blur-[160px]" />
 <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
 </div>

 <div className="relative z-10">
 {/* Top bar */}
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
 <Award className="h-4.5 w-4.5 text-primary" />
 </div>
 <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Ranking & Conquistas</span>
 </div>
 <div className="flex items-center gap-2.5">
 <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm">
 <div className="relative">
 <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
 <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-success/40 animate-ping" />
 </div>
 <span className="text-[9px] font-heading uppercase tracking-[0.2em] text-success">{unlockedBadges.length}/{BADGES.length} Conquistas</span>
 </div>
 </div>
 </div>

 {/* Level Display with Ring */}
 <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
 <div className="relative">
 <ProgressRing value={progress} color="primary" size={110} strokeWidth={6} />
 <div className="absolute inset-0 flex items-center justify-center">
 <LevelIcon className="h-10 w-10 text-primary" />
 </div>
 </div>
 <div className="flex-1">
 <p className="text-[9px] font-heading uppercase tracking-[0.25em] text-muted-foreground/40 mb-1">Seu Nível</p>
 <h2 className="text-[36px] sm:text-[44px] md:text-[52px] font-heading tracking-[-0.04em] text-foreground leading-[0.9] drop-shadow-[0_0_20px_hsl(var(--primary)/0.12)]">
 {level.name}
 </h2>
 <p className="text-[12px] text-muted-foreground/40 mt-2 font-display">
 Faturamento: {fmtCurrency(stats.revenue)}
 </p>
 {nextLevel && (
 <div className="mt-3 flex items-center gap-2">
 <ArrowUpRight className="h-3 w-3 text-primary/50" />
 <span className="text-[10px] font-display text-muted-foreground/40">
 Faltam {fmtCurrency(nextLevel.min - stats.revenue)} para <span className="text-foreground/60 font-bold">{nextLevel.name}</span>
 </span>
 </div>
 )}
 </div>
 </div>
 </div>
 </motion.section>

 {/* ═══ KPIs ═══ */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
 <KpiTile label="Nível Atual" value={level.name} icon={Crown} color="primary" delay={0} sub={`${currentLevelIdx + 1}° de ${LEVELS.length}`} />
 <KpiTile label="Vendas" value={String(stats.totalSales)} icon={TrendingUp} color="success" delay={0.06} sub="aprovadas" />
 <KpiTile label="Produtos" value={String(stats.products)} icon={Package} color="warning" delay={0.12} sub="ativos" />
 <KpiTile label="Conquistas" value={`${unlockedBadges.length}/${BADGES.length}`} icon={Trophy} color="info" delay={0.18} sub="desbloqueadas" />
 </div>

 {/* ═══ Progress to Next Level ═══ */}
 {nextLevel && (
 <GlowCard glowColor="primary" delay={0.24} className="p-5 mb-8">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary")} />
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2.5">
 <div className="h-8 w-8 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
 <Flame className="h-3.5 w-3.5 text-primary" />
 </div>
 <span className="text-[11px] font-heading font-black text-foreground/70">Progresso para {nextLevel.name}</span>
 </div>
 <span className="text-sm font-heading font-bold tabular-nums text-primary">{progress.toFixed(1)}%</span>
 </div>
 <div className="h-2.5 rounded-full bg-muted/10 ring-1 ring-border/10 overflow-hidden">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${progress}%` }}
 transition={{ duration: 1.5, ease }}
 className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 relative"
 >
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
 </motion.div>
 </div>
 <p className="text-[10px] mt-2 text-muted-foreground/30 font-display">
 Faltam {fmtCurrency(nextLevel.min - stats.revenue)} para o nível {nextLevel.name}
 </p>
 </GlowCard>
 )}

 {/* ═══ CONQUISTAS ═══ */}
 <div className="mb-8">
 <div className="flex items-center gap-2.5 mb-5">
 <div className="h-8 w-8 rounded-xl bg-warning/8 ring-1 ring-warning/15 flex items-center justify-center">
 <Award className="h-4 w-4 text-warning" />
 </div>
 <div>
 <h3 className="text-[14px] font-heading font-black text-foreground">Conquistas</h3>
 <p className="text-[10px] text-muted-foreground/35">{unlockedBadges.length} de {BADGES.length} desbloqueadas</p>
 </div>
 </div>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {BADGES.map((badge, i) => {
 const unlocked = badge.check(stats);
 const BadgeIcon = badge.icon;
 return (
 <GlowCard
 key={badge.id}
 glowColor={unlocked ? "primary" : "muted-foreground"}
 delay={i * 0.04}
 className={cn(
 "text-center p-5 relative transition-all",
 !unlocked && "opacity-40 grayscale"
 )}
 >
 <div className={cn(
 "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
 unlocked ? "bg-primary" : "bg-muted-foreground/10"
 )} />
 <div className={cn(
 "mx-auto mb-3 h-14 w-14 rounded-2xl flex items-center justify-center ring-1 transition-all group-hover:scale-110",
 unlocked
 ? "bg-primary/10 ring-primary/15 text-primary"
 : "bg-muted/10 ring-border/10 text-muted-foreground/30"
 )}>
 {unlocked ? <BadgeIcon className="h-7 w-7" /> : <Lock className="h-5 w-5" />}
 </div>
 <p className="text-[13px] font-heading font-bold text-foreground">{badge.label}</p>
 <p className="text-[10px] text-muted-foreground/40 mt-1">{badge.desc}</p>
 {unlocked && (
 <div className="mt-3 inline-flex items-center gap-1 text-[9px] font-heading text-success bg-success/8 px-2.5 py-1 rounded-lg border border-success/10">
 <CheckCircle2 className="h-3 w-3" /> Desbloqueada
 </div>
 )}
 </GlowCard>
 );
 })}
 </div>
 </div>

 {/* ═══ NÍVEIS ═══ */}
 <div>
 <div className="flex items-center gap-2.5 mb-5">
 <div className="h-8 w-8 rounded-xl bg-info/8 ring-1 ring-info/15 flex items-center justify-center">
 <Crown className="h-4 w-4 text-info" />
 </div>
 <div>
 <h3 className="text-[14px] font-heading font-black text-foreground">Níveis do Sistema</h3>
 <p className="text-[10px] text-muted-foreground/35">Sua progressão por faturamento</p>
 </div>
 </div>

 <div className="space-y-2">
 {LEVELS.map((lvl, i) => {
 const Icon = lvl.icon;
 const isCurrentOrPast = stats.revenue >= lvl.min;
 const isCurrent = lvl.name === level.name;

 return (
 <GlowCard
 key={lvl.name}
 glowColor={isCurrentOrPast ? "primary" : "muted-foreground"}
 delay={i * 0.04}
 className={cn(
 "relative transition-all",
 !isCurrentOrPast && "opacity-40",
 isCurrent && "ring-1 ring-primary/15"
 )}
 >
 <div className={cn(
 "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
 isCurrentOrPast ? "bg-primary" : "bg-muted-foreground/10"
 )} />

 <div className="flex items-center gap-4 p-4 pl-5">
 <div className={cn(
 "h-11 w-11 rounded-xl flex items-center justify-center ring-1 shrink-0 transition-all",
 isCurrentOrPast
 ? "bg-primary/10 ring-primary/15 text-primary"
 : "bg-muted/10 ring-border/10 text-muted-foreground/20"
 )}>
 <Icon className="h-5 w-5" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className={cn("text-[13px] font-heading font-bold", isCurrentOrPast ? "text-foreground" : "text-muted-foreground/30")}>
 {lvl.name}
 </p>
 {isCurrent && (
 <span className="text-[8px] font-heading uppercase tracking-[0.15em] px-2 py-0.5 rounded-lg bg-primary/8 text-primary border border-primary/10">
 Atual
 </span>
 )}
 </div>
 <p className="text-[10px] text-muted-foreground/30 mt-0.5 truncate">
 A partir de {fmtCurrency(lvl.min)}
 {lvl.max < Infinity && ` — até ${fmtCurrency(lvl.max)}`}
 </p>
 </div>
 {isCurrentOrPast && (
 <div className="h-7 w-7 rounded-lg bg-success/8 flex items-center justify-center ring-1 ring-success/10 shrink-0">
 <CheckCircle2 className="h-3.5 w-3.5 text-success" />
 </div>
 )}
 </div>
 </GlowCard>
 );
 })}
 </div>
 </div>
 </div>
 );
}
