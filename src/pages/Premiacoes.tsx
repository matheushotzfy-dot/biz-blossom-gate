/**
 * Premiações — Trilha cinematográfica HOTZFY
 * @module Premiacoes
 * @version 12.0.0 — Serpentine trail with poetic milestones
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, Lock, CheckCircle2, Gift, Crown, Target, Sparkles, Flame,
  Gem, Star, Award, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

import braceletCard from "@/assets/awards/bracelet-card-10k.png";
import plaque100k from "@/assets/awards/plaque-100k.png";
import plaque250k from "@/assets/awards/plaque-250k.png";
import plaque500k from "@/assets/awards/plaque-500k.png";
import plaque1m from "@/assets/awards/plaque-1m.png";
import plaque5m from "@/assets/awards/plaque-5m.png";
import plaque10m from "@/assets/awards/plaque-10m.png";

type Award = {
  id: string; value: number; label: string; tier: string; title: string;
  description: string; image: string; rewards: string[];
  phrase: string; accent: string; icon: typeof Trophy;
};

const AWARDS: Award[] = [
  { id: "10k",  value: 10_000,     label: "R$ 10K",  tier: "Iniciante", title: "Kit Exclusivo HOTZFY", description: "Pulseira de couro premium + Cartão Black exclusivo HOTZFY.", image: braceletCard, rewards: ["Pulseira Premium", "Cartão Black HOTZFY"], phrase: "Toda jornada bilionária começa com a primeira venda.", accent: "text-orange-400", icon: Flame },
  { id: "100k", value: 100_000,    label: "R$ 100K", tier: "Bronze",    title: "Plaquinha Bronze",     description: "Plaquinha em mármore negro com detalhes dourados.",          image: plaque100k,   rewards: ["Plaquinha Bronze"], phrase: "Bronze não é metal — é a prova de que você começou.", accent: "text-amber-600", icon: Award },
  { id: "250k", value: 250_000,    label: "R$ 250K", tier: "Prata",     title: "Plaquinha Prata",      description: "Acabamento prata platinado.",                                  image: plaque250k,   rewards: ["Plaquinha Prata Platinada"], phrase: "Prata pesa porque foi merecida.", accent: "text-slate-300", icon: Star },
  { id: "500k", value: 500_000,    label: "R$ 500K", tier: "Ouro",      title: "Plaquinha Ouro 24K",   description: "Banhada a ouro 24K com detalhes em esmeralda.",                image: plaque500k,   rewards: ["Plaquinha Ouro 24K"], phrase: "Ouro não brilha sozinho. Você fez ele brilhar.", accent: "text-yellow-500", icon: Crown },
  { id: "1m",   value: 1_000_000,  label: "R$ 1M",   tier: "Diamante",  title: "Plaquinha Diamante",   description: "Cravejada em diamante. O marco de 1 Milhão.",                  image: plaque1m,     rewards: ["Plaquinha Diamante", "Convite Hotzfy Inner Circle"], phrase: "Diamante é carbono que resistiu à pressão.", accent: "text-cyan-400", icon: Gem },
  { id: "5m",   value: 5_000_000,  label: "R$ 5M",   tier: "Elite",     title: "Plaquinha Elite",      description: "Rose Gold com diamantes negros.",                              image: plaque5m,     rewards: ["Plaquinha Elite Rose Gold", "Jantar privado com a fundação"], phrase: "Elite não é título — é hábito.", accent: "text-rose-400", icon: Sparkles },
  { id: "10m",  value: 10_000_000, label: "R$ 10M",  tier: "Lenda",     title: "Plaquinha Lenda",      description: "Gemas preciosas multicoloridas, peça única numerada.",         image: plaque10m,    rewards: ["Plaquinha Lenda numerada", "Hall of Fame HOTZFY"], phrase: "Lendas não morrem. Faturam.", accent: "text-violet-400", icon: Trophy },
];

const fmtC = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1).replace(".", ",")}M`
  : v >= 1_000   ? `R$ ${(v / 1_000).toFixed(0)}K`
  : `R$ ${v.toLocaleString("pt-BR")}`;

const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

function AnimNum({ value }: { value: number }) {
  const [d, setD] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current; prev.current = value;
    if (from === value) return;
    const s = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - s) / 900, 1);
      setD(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{fmtFull(d)}</>;
}

export default function Premiacoes() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("transactions").select("net_amount")
      .eq("user_id", user.id).eq("status", "completed")
      .then(({ data }) => { if (data) setRevenue(data.reduce((s, t) => s + Number(t.net_amount), 0)); });
  }, [user?.id]);

  const { currentIdx, unlockedCount, nextAward, currentTier, overallProgress, nextProgress, remaining } = useMemo(() => {
    const currentIdx = AWARDS.findIndex((a) => revenue < a.value);
    const unlockedCount = AWARDS.filter((a) => revenue >= a.value).length;
    const nextAward = currentIdx >= 0 ? AWARDS[currentIdx] : null;
    const currentTier = unlockedCount > 0 ? AWARDS[unlockedCount - 1] : null;
    const overallProgress = (unlockedCount / AWARDS.length) * 100;
    const nextProgress = nextAward ? Math.min((revenue / nextAward.value) * 100, 100) : 100;
    const remaining = nextAward ? nextAward.value - revenue : 0;
    return { currentIdx, unlockedCount, nextAward, currentTier, overallProgress, nextProgress, remaining };
  }, [revenue]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">Premiações</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-primary" />
            Trilha de conquistas físicas HOTZFY
          </p>
        </div>
        {currentTier && (
          <div className="inline-flex items-center gap-2 bg-card border border-border/60 px-4 h-11 rounded-xl">
            <currentTier.icon className={cn("h-4 w-4", currentTier.accent)} strokeWidth={2.5} />
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Tier Atual</span>
            <span className="text-sm font-black text-foreground tracking-tight">{currentTier.tier}</span>
          </div>
        )}
      </div>

      {/* HERO — Faturamento + Próximo marco lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* Revenue card */}
        <div className="bg-card p-8 rounded-[24px] border border-border/60 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-muted-foreground/60 mb-4">
              <Trophy size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.15em]">Faturamento Líquido Total</span>
            </div>
            <p className="font-display text-[52px] font-black text-foreground tabular-nums tracking-tighter leading-none">
              <AnimNum value={revenue} />
            </p>

            {/* Trail of milestone dots */}
            <div className="mt-8 relative">
              <div className="h-[3px] rounded-full bg-muted/40 border border-border/40 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-[width] duration-1000"
                  style={{ width: `${Math.max(overallProgress, 2)}%` }} />
              </div>
              <div className="flex items-center justify-between mt-3">
                {AWARDS.map((a) => {
                  const done = revenue >= a.value;
                  const Icon = a.icon;
                  return (
                    <div key={a.id} className="flex flex-col items-center gap-1.5">
                      <div className={cn(
                        "h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        done ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border/60 text-muted-foreground/40"
                      )}>
                        <Icon size={11} strokeWidth={2.5} />
                      </div>
                      <span className={cn("text-[9px] font-black tabular-nums uppercase tracking-widest",
                        done ? "text-foreground" : "text-muted-foreground/40")}>{a.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="absolute right-[-30px] bottom-[-30px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
            <Trophy size={200} />
          </div>
        </div>

        {/* Next milestone */}
        <div className="bg-card p-8 rounded-[24px] border border-border/60 shadow-sm relative overflow-hidden">
          {nextAward ? (
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center gap-2 text-muted-foreground/60 mb-4">
                <Target size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.15em]">Próximo Marco</span>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-20 w-20 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src={nextAward.image} alt={nextAward.title} className="h-16 w-16 object-contain grayscale opacity-50" />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", nextAward.accent)}>{nextAward.tier}</p>
                  <p className="text-xl font-black text-foreground tracking-tight mt-0.5 leading-tight">{nextAward.title}</p>
                  <p className="text-[11px] font-bold text-muted-foreground tabular-nums mt-1">meta {fmtC(nextAward.value)}</p>
                </div>
              </div>

              <div className="mt-auto pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Progresso</span>
                  <span className="text-2xl font-black text-foreground tabular-nums tracking-tight">{nextProgress.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 border border-border/40 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-700"
                    style={{ width: `${Math.max(nextProgress, 2)}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 font-bold uppercase tracking-widest">
                  Faltam <span className="font-black text-foreground tabular-nums normal-case">{fmtFull(remaining)}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="relative z-10 h-full flex flex-col items-start justify-center">
              <Crown className="h-12 w-12 text-violet-400 mb-3" />
              <p className="text-2xl font-black text-foreground tracking-tight">Hall of Fame</p>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-2">
                Você é <span className="text-violet-400">Lenda HOTZFY</span>
              </p>
            </div>
          )}
          {nextAward && (
            <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.04] rotate-[-15deg]">
              <nextAward.icon size={160} />
            </div>
          )}
        </div>
      </div>

      {/* TRILHA SERPENTEADA — vertical com cards alternados */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Trophy size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none uppercase">A Trilha</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                {unlockedCount}/{AWARDS.length} marcos desbloqueados
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/60">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {overallProgress.toFixed(0)}% da jornada
            </span>
          </div>
        </div>

        <div className="relative px-4 sm:px-8 py-10">
          {/* Rail vertical central */}
          <div className="absolute left-8 sm:left-1/2 top-0 bottom-0 w-[2px] bg-border/40 -translate-x-1/2" />
          <div
            className="absolute left-8 sm:left-1/2 top-0 w-[2px] bg-primary -translate-x-1/2 transition-[height] duration-1000"
            style={{ height: `${overallProgress}%` }}
          />

          <div className="space-y-10 relative">
            {AWARDS.map((award, idx) => {
              const done = revenue >= award.value;
              const isCurrent = idx === currentIdx;
              const isOpen = selected === award.id;
              const progress = Math.min((revenue / award.value) * 100, 100);
              const Icon = award.icon;
              const onLeft = idx % 2 === 0;

              return (
                <div
                  key={award.id}
                  className={cn(
                    "relative flex items-start gap-6",
                    "pl-20 sm:pl-0",
                    onLeft ? "sm:flex-row" : "sm:flex-row-reverse"
                  )}
                >
                  {/* Node central */}
                  <div className={cn(
                    "absolute left-8 sm:left-1/2 top-3 -translate-x-1/2 z-10",
                    "h-12 w-12 rounded-2xl border-2 flex items-center justify-center transition-all",
                    done
                      ? "bg-primary border-primary text-primary-foreground"
                      : isCurrent
                      ? "bg-card border-primary text-primary"
                      : "bg-card border-border/60 text-muted-foreground/40"
                  )}>
                    {done ? <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
                          : <Icon className="h-5 w-5" strokeWidth={2.25} />}
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-2xl border-2 border-primary animate-ping opacity-50" />
                    )}
                  </div>

                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => setSelected(isOpen ? null : award.id)}
                    className={cn(
                      "w-full sm:w-[calc(50%-2.5rem)] text-left rounded-2xl border bg-card transition-all overflow-hidden",
                      done
                        ? "border-border/60 hover:border-primary/40"
                        : isCurrent
                        ? "border-primary/40 bg-primary/[0.02]"
                        : "border-border/40 opacity-70 hover:opacity-100",
                      isOpen && "border-primary/60"
                    )}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "h-16 w-16 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden",
                          done ? "bg-muted/30 border-border/60" : "bg-muted/20 border-border/40"
                        )}>
                          <img src={award.image} alt={award.title}
                            className={cn("h-14 w-14 object-contain", !done && "grayscale opacity-30")} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-[0.18em]",
                              done ? award.accent : "text-muted-foreground/50"
                            )}>{award.tier}</span>
                            <span className="text-[10px] font-black tabular-nums text-muted-foreground/40">·</span>
                            <span className="text-[10px] font-black tabular-nums uppercase tracking-widest text-muted-foreground/70">
                              {fmtC(award.value)}
                            </span>
                            {done && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                Desbloqueado
                              </span>
                            )}
                            {isCurrent && !done && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                                Em curso
                              </span>
                            )}
                          </div>
                          <h3 className={cn(
                            "text-base font-black tracking-tight mt-1.5",
                            done || isCurrent ? "text-foreground" : "text-muted-foreground/80"
                          )}>{award.title}</h3>
                        </div>
                      </div>

                      {/* Phrase — só aparece quando desbloqueado ou em curso */}
                      {(done || isCurrent) && (
                        <div className="mt-4 pl-4 border-l-2 border-primary/30">
                          <div className="flex items-start gap-2">
                            <Quote className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
                            <p className={cn(
                              "text-[12px] leading-relaxed italic",
                              done ? "text-foreground/80" : "text-muted-foreground"
                            )}>
                              {award.phrase}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Progress for current */}
                      {isCurrent && !done && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Progresso</span>
                            <span className="text-xs font-black text-foreground tabular-nums">{progress.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/40 border border-border/40 overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-[width] duration-700"
                              style={{ width: `${Math.max(progress, 2)}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="px-5 pb-5 pt-3 border-t border-border/40 bg-muted/10 space-y-4">
                        <p className="text-sm text-foreground/80 leading-relaxed">{award.description}</p>

                        <div className="flex flex-wrap gap-2">
                          {award.rewards.map(r => (
                            <span key={r} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md bg-card border border-border/60 text-foreground">
                              <Gift className="h-3 w-3 text-primary" /> {r}
                            </span>
                          ))}
                        </div>

                        {!done && (
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: "Atual", value: fmtC(revenue) },
                              { label: "Meta",  value: fmtC(award.value) },
                              { label: "Faltam", value: fmtC(award.value - revenue), accent: true },
                            ].map((s) => (
                              <div key={s.label} className="bg-card border border-border/60 rounded-lg px-3 py-2">
                                <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">{s.label}</p>
                                <p className={cn("text-sm font-black tabular-nums tracking-tight mt-0.5",
                                  s.accent ? "text-primary" : "text-foreground")}>{s.value}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {done && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">
                              Resgate disponível — fale com seu gerente
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}

            {/* Final crown — Hall of Fame */}
            <div className="relative flex justify-center pt-4">
              <div className={cn(
                "h-14 w-14 rounded-2xl border-2 flex items-center justify-center relative z-10",
                revenue >= AWARDS[AWARDS.length - 1].value
                  ? "bg-violet-500/10 border-violet-400 text-violet-400"
                  : "bg-card border-border/60 text-muted-foreground/40"
              )}>
                <Crown className="h-6 w-6" strokeWidth={2.25} />
              </div>
            </div>
            <p className="text-center text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/60 -mt-6">
              Hall of Fame HOTZFY
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
