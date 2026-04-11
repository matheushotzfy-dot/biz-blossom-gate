/**
 * Premiações — Flat Professional Awards Trail
 * @module Premiacoes
 * @version 7.0.0 — Clean Fintech Redesign
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, Lock, CheckCircle2, Sparkles, Star, Crown, Gem, Zap, Gift, Target,
  Flame, Award, TrendingUp, ArrowUp, Rocket, ArrowUpRight,
  Percent, Medal,
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

const TONE_STYLES: Record<Tone, { bg: string; text: string; border: string; badgeBg: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary", border: "border-t-primary", badgeBg: "bg-primary/10" },
  info: { bg: "bg-info/10", text: "text-info", border: "border-t-info", badgeBg: "bg-info/10" },
  warning: { bg: "bg-warning/10", text: "text-warning", border: "border-t-warning", badgeBg: "bg-warning/10" },
  success: { bg: "bg-success/10", text: "text-success", border: "border-t-success", badgeBg: "bg-success/10" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive", border: "border-t-destructive", badgeBg: "bg-destructive/10" },
};

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

/* ═══ Award Card ═══ */
function AwardCard({ award, idx, unlocked, isCurrent, revenue }: {
  award: typeof AWARDS[0]; idx: number; unlocked: boolean; isCurrent: boolean; revenue: number;
}) {
  const t = TONE_STYLES[award.tone];
  const Icon = award.icon;
  const progress = Math.min((revenue / award.value) * 100, 100);

  return (
    <div className="relative flex gap-4 md:gap-5">
      {/* Timeline Node */}
      <div className="relative z-10 shrink-0 flex flex-col items-center pt-5">
        <div className={cn(
          "h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center border transition-all",
          unlocked ? cn(t.bg, t.text, "border-current/20") :
            isCurrent ? "bg-primary/10 text-primary border-primary/30" :
            "bg-muted/20 border-border/40 text-muted-foreground/25"
        )}>
          {unlocked ? <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6" /> :
            isCurrent ? <Icon className="h-5 w-5 md:h-6 md:w-6" /> :
            <Lock className="h-4 w-4 md:h-5 md:w-5" />}
        </div>
      </div>

      {/* Card Body */}
      <div className={cn(
        "flex-1 mb-2 rounded-2xl border bg-card shadow-sm overflow-hidden p-5 md:p-6 transition-all border-t-2",
        unlocked ? cn("border-border/60", t.border) :
          isCurrent ? "border-border/60 border-t-primary" :
          "border-border/40 opacity-50"
      )}>
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Award Image */}
          <div className={cn(
            "relative w-full lg:w-48 h-40 lg:h-auto shrink-0 flex items-center justify-center rounded-xl overflow-hidden border",
            unlocked ? cn("border-border/40", t.bg) :
              isCurrent ? "bg-muted/10 border-border/30" :
              "bg-muted/10 border-border/20"
          )}>
            <img
              src={award.image}
              alt={award.title}
              className={cn(
                "h-full w-full object-contain max-h-36 lg:max-h-40 transition-all",
                unlocked ? "" : "grayscale opacity-40"
              )}
            />
            {!unlocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                <div className={cn(
                  "h-10 w-10 rounded-xl border flex items-center justify-center",
                  isCurrent ? "bg-primary/10 border-primary/20" : "bg-card border-border/40"
                )}>
                  <Lock className={cn("h-4 w-4", isCurrent ? "text-primary/60" : "text-muted-foreground/30")} />
                </div>
              </div>
            )}
            {unlocked && (
              <div className="absolute top-2.5 right-2.5">
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", t.bg)}>
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
                    "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full",
                    unlocked ? cn(t.badgeBg, t.text) :
                      isCurrent ? "bg-primary/10 text-primary" :
                      "bg-muted/30 text-muted-foreground/30"
                  )}>
                    {award.tier}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary inline-flex items-center gap-1">
                      <Rocket className="h-2.5 w-2.5" /> Próximo
                    </span>
                  )}
                  {unlocked && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-success/10 text-success">
                      ✓ Conquistado
                    </span>
                  )}
                </div>
                <h3 className={cn(
                  "text-base md:text-lg font-heading font-black tracking-tight",
                  unlocked ? "text-foreground" : isCurrent ? "text-foreground/70" : "text-muted-foreground/25"
                )}>
                  {award.title}
                </h3>
              </div>
              <span className={cn(
                "text-lg md:text-xl font-heading font-black shrink-0 tabular-nums",
                unlocked ? t.text : isCurrent ? "text-foreground/40" : "text-muted-foreground/15"
              )}>
                {award.label}
              </span>
            </div>

            <p className={cn(
              "text-xs leading-relaxed mb-4",
              unlocked ? "text-muted-foreground" : isCurrent ? "text-muted-foreground/50" : "text-muted-foreground/15"
            )}>
              {award.description}
            </p>

            {/* Rewards chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {award.rewards.map((r) => (
                <span
                  key={r}
                  className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5",
                    unlocked ? cn(t.badgeBg, t.text, "border-current/15") :
                      isCurrent ? "bg-primary/5 border-primary/10 text-primary/40" :
                      "bg-muted/10 border-border/20 text-muted-foreground/15"
                  )}
                >
                  <Gift className="h-2.5 w-2.5" /> {r}
                </span>
              ))}
            </div>

            {/* Status / Progress */}
            {unlocked ? (
              <div className={cn("rounded-xl px-4 py-3.5 border", t.badgeBg, "border-current/10")}>
                <p className={cn("text-[11px] font-medium italic leading-relaxed", t.text)}>
                  "{award.motivation}"
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn("text-[10px] font-bold", isCurrent ? "text-muted-foreground" : "text-muted-foreground/15")}>Progresso</span>
                  <span className={cn("text-[10px] font-bold tabular-nums", isCurrent ? "text-primary" : "text-muted-foreground/15")}>{progress.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      isCurrent ? "bg-primary" : "bg-muted-foreground/10"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowUp className={cn("h-2.5 w-2.5", isCurrent ? "text-muted-foreground" : "text-muted-foreground/10")} />
                  <p className={cn("text-[10px] font-medium", isCurrent ? "text-muted-foreground" : "text-muted-foreground/10")}>
                    Faltam {fmtC(award.value - revenue)} para desbloquear
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-20 px-4 md:px-6 space-y-5">

      {/* ═══ HERO ═══ */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm border-t-2 border-t-primary overflow-hidden">
        <div className="p-6 md:p-8">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trilha de Conquistas</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/15">
                <div className="relative">
                  <div className="h-2 w-2 rounded-full bg-success" />
                  <div className="absolute inset-0 h-2 w-2 rounded-full bg-success/40 animate-ping" />
                </div>
                <span className="text-[10px] font-bold text-success uppercase tracking-wider">{unlockedCount} Desbloqueadas</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/15">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-bold text-primary">{AWARDS.length} Marcos</span>
              </div>
            </div>
          </div>

          {/* Hero revenue display */}
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Faturamento Líquido Total</p>
              <div className="flex items-end gap-3">
                <h2 className="text-[40px] sm:text-[52px] md:text-[64px] font-heading font-black tracking-tighter text-foreground leading-[0.9]">
                  <AnimatedNumber value={revenue} formatter={fmtC} />
                </h2>
                {revenue > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/15 mb-2">
                    <ArrowUpRight className="h-2.5 w-2.5" />
                    ativo
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {nextAward ? `Próximo marco: ${nextAward.label} — ${nextAward.tier}` : "Todas as conquistas desbloqueadas!"}
              </p>
            </div>

            {/* Next award preview — desktop */}
            {nextAward && (
              <div className="hidden md:flex items-center gap-4 p-4 rounded-xl bg-muted/15 border border-border/40 shrink-0">
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/15 overflow-hidden">
                  <img src={nextAward.image} alt={nextAward.title} className="h-14 w-14 object-contain" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Próximo</p>
                  <p className="text-sm font-heading font-black text-foreground">{nextAward.title}</p>
                  <p className="text-xs text-primary font-bold tabular-nums">{nextAward.label}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ KPI Grid ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Faturamento", value: fmtC(revenue), icon: Flame, tone: "primary" as Tone, sub: "receita líquida total" },
          { label: "Conquistas", value: `${unlockedCount}/${AWARDS.length}`, icon: Trophy, tone: "success" as Tone, sub: `${unlockedCount} desbloqueadas` },
          { label: "Próximo Marco", value: nextAward ? nextAward.label : "✓", icon: Target, tone: "warning" as Tone, sub: nextAward ? nextAward.tier : "Completo!" },
          { label: "Progresso", value: `${globalProgress.toFixed(0)}%`, icon: Percent, tone: "info" as Tone, sub: nextAward ? `faltam ${fmtC(nextAward.value - revenue)}` : "lenda absoluta" },
        ].map((kpi) => {
          const kt = TONE_STYLES[kpi.tone];
          return (
            <div key={kpi.label} className={cn("rounded-2xl border border-border/60 bg-card shadow-sm border-t-2 p-5", kt.border)}>
              <div className="flex items-center justify-between mb-3">
                <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", kt.bg)}>
                  <kpi.icon className={cn("h-4 w-4", kt.text)} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              </div>
              <p className="text-xl md:text-2xl font-heading font-black text-foreground tabular-nums">{kpi.value}</p>
              {kpi.sub && <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* ═══ Global Progress Bar ═══ */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm border-t-2 border-t-primary p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-heading font-black text-foreground block">Progresso Geral</span>
              <span className="text-xs text-muted-foreground">{unlockedCount} de {AWARDS.length} marcos conquistados</span>
            </div>
          </div>
          <span className="text-lg font-heading font-black text-primary tabular-nums">{((unlockedCount / AWARDS.length) * 100).toFixed(0)}%</span>
        </div>

        <div className="h-3 rounded-full bg-muted/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000"
            style={{ width: `${(unlockedCount / AWARDS.length) * 100}%` }}
          />
        </div>

        {/* Mini milestones */}
        <div className="flex justify-between mt-3.5 px-1">
          {AWARDS.map((a) => {
            const done = revenue >= a.value;
            const at = TONE_STYLES[a.tone];
            return (
              <div key={a.id} className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  "h-3.5 w-3.5 rounded-full border transition-all",
                  done ? cn(at.bg, "border-current/20", at.text) :
                    a.id === nextAward?.id ? "bg-primary/30 border-primary/30" :
                    "bg-muted/20 border-border/30"
                )} />
                <span className={cn(
                  "text-[8px] font-bold tabular-nums hidden sm:block",
                  done ? "text-muted-foreground" : "text-muted-foreground/25"
                )}>{a.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Awards Trail ═══ */}
      <div className="relative">
        {/* Section header */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center">
            <Medal className="h-4 w-4 text-warning" />
          </div>
          <div>
            <h3 className="text-sm font-heading font-black text-foreground">Conquistas & Premiações</h3>
            <p className="text-xs text-muted-foreground">Desbloqueie marcos com seu faturamento</p>
          </div>
        </div>

        {/* Vertical line background */}
        <div className="absolute left-[23px] md:left-[27px] top-[72px] bottom-4 w-[2px] bg-border/20 rounded-full" />
        {/* Animated progress line */}
        <div
          className="absolute left-[23px] md:left-[27px] top-[72px] w-[2px] bg-primary rounded-full transition-all duration-1000"
          style={{ height: unlockedCount === 0 ? "0%" : unlockedCount === AWARDS.length ? "100%" : `${((unlockedCount) / AWARDS.length) * 100}%` }}
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
          <div className="relative flex gap-4 md:gap-5">
            <div className="relative z-10 shrink-0 flex flex-col items-center pt-4">
              <div className={cn(
                "h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center border transition-all",
                unlockedCount === AWARDS.length
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted/20 border-border/30 text-muted-foreground/15"
              )}>
                <Crown className="h-5 w-5 md:h-6 md:w-6" />
              </div>
            </div>
            <div className={cn(
              "flex-1 p-5 rounded-2xl border bg-card shadow-sm border-t-2 transition-all",
              unlockedCount === AWARDS.length
                ? "border-border/60 border-t-primary"
                : "border-border/30 opacity-50"
            )}>
              <div className="flex items-center gap-3">
                {unlockedCount === AWARDS.length && <Trophy className="h-6 w-6 text-primary" />}
                <p className={cn(
                  "text-sm font-heading font-black",
                  unlockedCount === AWARDS.length ? "text-primary" : "text-muted-foreground/20"
                )}>
                  {unlockedCount === AWARDS.length
                    ? "Todas as conquistas desbloqueadas — Você é uma Lenda!"
                    : "Continue sua jornada para desbloquear todas as conquistas"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
