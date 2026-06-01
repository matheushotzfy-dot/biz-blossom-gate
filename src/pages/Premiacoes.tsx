/**
 * Premiações — alinhada ao padrão Saques
 * @module Premiacoes
 * @version 11.0.0
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, Lock, CheckCircle2, Gift, Crown, Award, Target, ChevronRight, Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

import braceletCard from "@/assets/awards/bracelet-card-10k.png";
import plaque100k from "@/assets/awards/plaque-100k.png";
import plaque250k from "@/assets/awards/plaque-250k.png";
import plaque500k from "@/assets/awards/plaque-500k.png";
import plaque1m from "@/assets/awards/plaque-1m.png";
import plaque5m from "@/assets/awards/plaque-5m.png";
import plaque10m from "@/assets/awards/plaque-10m.png";

const AWARDS = [
  { id: "10k",  value: 10_000,     label: "R$ 10K",  tier: "Iniciante", title: "Kit Exclusivo HOTZFY", description: "Pulseira de couro premium + Cartão Black exclusivo HOTZFY.", image: braceletCard, rewards: ["Pulseira Premium", "Cartão Black"] },
  { id: "100k", value: 100_000,    label: "R$ 100K", tier: "Bronze",    title: "Plaquinha Bronze",    description: "Plaquinha em mármore negro com detalhes dourados.",          image: plaque100k,   rewards: ["Plaquinha Bronze"] },
  { id: "250k", value: 250_000,    label: "R$ 250K", tier: "Prata",     title: "Plaquinha Prata",     description: "Acabamento prata platinado.",                                  image: plaque250k,   rewards: ["Plaquinha Prata"] },
  { id: "500k", value: 500_000,    label: "R$ 500K", tier: "Ouro",      title: "Plaquinha Ouro",      description: "Banhada a ouro com detalhes em esmeralda.",                    image: plaque500k,   rewards: ["Plaquinha Ouro 24K"] },
  { id: "1m",   value: 1_000_000,  label: "R$ 1M",   tier: "Diamante",  title: "Plaquinha Diamante",  description: "Cravejada em diamante. 1 Milhão.",                             image: plaque1m,     rewards: ["Plaquinha Diamante"] },
  { id: "5m",   value: 5_000_000,  label: "R$ 5M",   tier: "Elite",     title: "Plaquinha Elite",     description: "Rose Gold com diamantes negros.",                              image: plaque5m,     rewards: ["Plaquinha Elite"] },
  { id: "10m",  value: 10_000_000, label: "R$ 10M",  tier: "Lenda",     title: "Plaquinha Lenda",     description: "Gemas preciosas multicoloridas.",                              image: plaque10m,    rewards: ["Plaquinha Lenda"] },
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
      {/* Header — padrão Saques */}
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
            <Crown className="h-4 w-4 text-primary" strokeWidth={2.5} />
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Tier</span>
            <span className="text-sm font-black text-foreground tracking-tight">{currentTier.tier}</span>
          </div>
        )}
      </div>

      {/* KPI Cards — padrão Saques (4 cards grandes) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Trophy,  label: "Faturamento Líquido", value: fmtC(revenue),                  sub: fmtFull(revenue) },
          { icon: Award,   label: "Conquistas",          value: `${unlockedCount}/${AWARDS.length}`, sub: `${overallProgress.toFixed(0)}% da trilha` },
          { icon: Crown,   label: "Tier Atual",          value: currentTier?.tier || "—",       sub: currentTier?.title || "Sem tier" },
          { icon: Target,  label: nextAward ? "Falta para Próximo" : "Status", value: nextAward ? fmtC(remaining) : "Lenda", sub: nextAward ? `${nextProgress.toFixed(1)}% concluído` : "Hall of Fame" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card p-8 rounded-[24px] border border-border/60 shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-3">
                  <Icon size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em]">{card.label}</span>
                </div>
                <p className="text-3xl font-black text-foreground tabular-nums tracking-tighter">{card.value}</p>
                <p className="text-[10px] font-bold text-muted-foreground/70 tabular-nums uppercase mt-2 truncate">{card.sub}</p>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
                <Icon size={160} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Panel — Saldo + Próximo marco (estilo Saques) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border/40 flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Flag size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Progressão Geral</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Faturamento líquido total</p>
            </div>
          </div>
          <div className="p-8">
            <p className="font-display text-[44px] font-black tracking-tighter text-foreground tabular-nums leading-none">
              <AnimNum value={revenue} />
            </p>
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Trilha</span>
                <span className="text-xs font-black text-foreground tabular-nums">{unlockedCount}/{AWARDS.length}</span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 border border-border/40 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-[width] duration-700"
                  style={{ width: `${Math.max(overallProgress, 2)}%` }} />
              </div>
              <div className="flex items-center justify-between mt-4">
                {AWARDS.map((a) => {
                  const done = revenue >= a.value;
                  return (
                    <div key={a.id} className="flex flex-col items-center gap-1.5">
                      <div className={cn("h-2.5 w-2.5 rounded-full border",
                        done ? "bg-primary border-primary" : "bg-muted/60 border-border/60")} />
                      <span className={cn("text-[9px] font-black tabular-nums uppercase",
                        done ? "text-primary" : "text-muted-foreground/40")}>{a.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border/40 flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Target size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Próximo Marco</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Meta imediata</p>
            </div>
          </div>
          <div className="p-8">
            {nextAward ? (
              <>
                <p className="text-xl font-black text-foreground tracking-tight">{nextAward.title}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  {nextAward.tier} · {fmtC(nextAward.value)}
                </p>
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-muted-foreground tabular-nums">{fmtC(revenue)}</span>
                    <span className="text-sm font-black text-foreground tabular-nums">{nextProgress.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 border border-border/40 overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-700"
                      style={{ width: `${Math.max(nextProgress, 2)}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-4 font-medium">
                    Faltam <span className="font-black text-foreground tabular-nums">{fmtFull(remaining)}</span>
                  </p>
                </div>
              </>
            ) : (
              <div>
                <Crown className="h-10 w-10 text-primary mb-3" />
                <p className="text-xl font-black text-foreground tracking-tight">Hall of Fame</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Tier máximo — <span className="text-primary">Lenda HOTZFY</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ledger de marcos — formato tabela igual Saques */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Trophy size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Trilha de Conquistas</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{AWARDS.length} marcos · clique para detalhes</p>
          </div>
        </div>

        <div className="divide-y divide-border/40">
          {AWARDS.map((award, idx) => {
            const done = revenue >= award.value;
            const isCurrent = idx === currentIdx;
            const isOpen = selected === award.id;
            const progress = Math.min((revenue / award.value) * 100, 100);

            return (
              <div key={award.id}>
                <button
                  type="button"
                  onClick={() => setSelected(isOpen ? null : award.id)}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/20",
                    isOpen && "bg-muted/30",
                    isCurrent && !isOpen && "bg-primary/[0.03]"
                  )}
                >
                  <div className={cn(
                    "h-12 w-12 shrink-0 rounded-xl overflow-hidden flex items-center justify-center border",
                    done ? "bg-muted/30 border-border/60" : "bg-muted/20 border-border/40"
                  )}>
                    <img src={award.image} alt={award.title}
                      className={cn("h-10 w-10 object-contain", !done && "grayscale opacity-30")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={cn("text-sm font-black tracking-tight truncate",
                        done || isCurrent ? "text-foreground" : "text-muted-foreground/70")}>
                        {award.title}
                      </h4>
                      {isCurrent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-primary/10 text-primary border-primary/20">
                          Em curso
                        </span>
                      )}
                      {done && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          Desbloqueado
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground/70 mt-1 uppercase tracking-widest">
                      Tier {award.tier} · meta <span className="tabular-nums">{fmtC(award.value)}</span>
                    </p>
                  </div>

                  <div className="hidden md:flex items-center gap-3 shrink-0 w-48">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/40 border border-border/40 overflow-hidden">
                      <div className={cn("h-full transition-[width] duration-500",
                        done ? "bg-emerald-500" : isCurrent ? "bg-primary" : "bg-muted-foreground/25")}
                        style={{ width: `${Math.max(progress, 2)}%` }} />
                    </div>
                    <span className={cn("text-[11px] font-black tabular-nums w-10 text-right",
                      done ? "text-emerald-500" : isCurrent ? "text-foreground" : "text-muted-foreground/50")}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>

                  <ChevronRight className={cn(
                    "h-4 w-4 text-muted-foreground/50 transition-transform shrink-0",
                    isOpen && "rotate-90"
                  )} />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-2 bg-muted/10 border-t border-border/40">
                    <div className="flex flex-col md:flex-row gap-5">
                      <div className={cn(
                        "relative w-full md:w-52 h-44 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-border/60",
                        done ? "bg-card" : "bg-muted/30"
                      )}>
                        <img src={award.image} alt={award.title}
                          className={cn("h-32 w-32 object-contain", !done && "grayscale opacity-25")} />
                        {!done && (
                          <div className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-card border border-border/60 flex items-center justify-center">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-4">
                        <p className="text-sm leading-relaxed text-foreground/85">{award.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {award.rewards.map(r => (
                            <span key={r} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md bg-card border border-border/60 text-foreground">
                              <Gift className="h-3 w-3 text-primary" /> {r}
                            </span>
                          ))}
                        </div>

                        {!done && (
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: "Atual", value: fmtC(revenue), tone: "text-foreground" },
                              { label: "Meta",  value: fmtC(award.value), tone: "text-foreground" },
                              { label: "Faltam", value: fmtC(award.value - revenue), tone: "text-primary" },
                            ].map((s) => (
                              <div key={s.label} className="bg-card border border-border/60 rounded-xl px-4 py-3">
                                <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">{s.label}</p>
                                <p className={cn("text-lg font-black tabular-nums tracking-tight mt-1", s.tone)}>{s.value}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {done && (
                          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <p className="text-xs font-bold text-emerald-500">
                              Conquista desbloqueada — entre em contato com seu gerente para resgate.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
