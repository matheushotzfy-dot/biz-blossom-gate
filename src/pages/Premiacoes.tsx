/**
 * Premiações — Premium milestone ledger
 * @module Premiacoes
 * @version 9.0.0
 */

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, Lock, CheckCircle2, Gift, Crown, Award, Target, ChevronRight,
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
  { id: "10k", value: 10000, label: "R$ 10K", tier: "Iniciante", title: "Kit Exclusivo HOTZFY", description: "Pulseira de couro premium + Cartão Black exclusivo HOTZFY.", image: braceletCard, rewards: ["Pulseira Premium", "Cartão Black"] },
  { id: "100k", value: 100000, label: "R$ 100K", tier: "Bronze", title: "Plaquinha Bronze", description: "Plaquinha em mármore negro com detalhes dourados.", image: plaque100k, rewards: ["Plaquinha Bronze"] },
  { id: "250k", value: 250000, label: "R$ 250K", tier: "Prata", title: "Plaquinha Prata", description: "Acabamento prata platinado.", image: plaque250k, rewards: ["Plaquinha Prata"] },
  { id: "500k", value: 500000, label: "R$ 500K", tier: "Ouro", title: "Plaquinha Ouro", description: "Banhada a ouro com detalhes em esmeralda.", image: plaque500k, rewards: ["Plaquinha Ouro 24K"] },
  { id: "1m", value: 1000000, label: "R$ 1M", tier: "Diamante", title: "Plaquinha Diamante", description: "Cravejada em diamante. 1 Milhão.", image: plaque1m, rewards: ["Plaquinha Diamante"] },
  { id: "5m", value: 5000000, label: "R$ 5M", tier: "Elite", title: "Plaquinha Elite", description: "Rose Gold com diamantes negros.", image: plaque5m, rewards: ["Plaquinha Elite"] },
  { id: "10m", value: 10000000, label: "R$ 10M", tier: "Lenda", title: "Plaquinha Lenda", description: "Gemas preciosas multicoloridas.", image: plaque10m, rewards: ["Plaquinha Lenda"] },
];

const fmtC = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1).replace(".", ",")}M`
    : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}K`
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

  const currentIdx = AWARDS.findIndex((a) => revenue < a.value);
  const unlockedCount = AWARDS.filter((a) => revenue >= a.value).length;
  const nextAward = currentIdx >= 0 ? AWARDS[currentIdx] : null;
  const currentTier = unlockedCount > 0 ? AWARDS[unlockedCount - 1] : null;
  const overallProgress = (unlockedCount / AWARDS.length) * 100;
  const nextProgress = nextAward ? Math.min((revenue / nextAward.value) * 100, 100) : 100;
  const remaining = nextAward ? nextAward.value - revenue : 0;

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-20 px-4 md:px-6 pt-2">

      {/* ═══ Header ═══ */}
      <div className="flex items-center gap-3.5 mb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-border">
          <Trophy className="h-5 w-5 text-primary" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-[22px]">
            Premiações
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conquistas desbloqueadas pelo seu faturamento líquido
          </p>
        </div>
      </div>

      {/* ═══ Status Panel ═══ */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Revenue + tier */}
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Faturamento líquido</p>
                <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-foreground tabular-nums leading-none mt-2">
                  <AnimNum value={revenue} />
                </h2>
              </div>
              {currentTier && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-success/15 bg-success/8 px-3 py-1.5 text-[11px] font-bold text-success shrink-0">
                  <Award className="h-3.5 w-3.5" />
                  Tier atual: {currentTier.tier}
                </div>
              )}
            </div>

            {/* Overall progression */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-foreground">Progressão geral</span>
                <span className="text-[11px] font-bold text-foreground tabular-nums">
                  {unlockedCount} <span className="text-muted-foreground font-medium">de {AWARDS.length}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${overallProgress}%` }} />
              </div>
            </div>
          </div>

          {/* Next milestone */}
          <div className="p-6 bg-secondary/30">
            {nextAward ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Próximo marco</p>
                </div>
                <p className="text-base font-bold text-foreground">{nextAward.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {nextAward.tier} · meta de {fmtC(nextAward.value)}
                </p>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-muted-foreground tabular-nums">{fmtC(revenue)}</span>
                    <span className="text-[11px] font-bold text-foreground tabular-nums">{nextProgress.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${nextProgress}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Faltam <span className="font-bold text-foreground tabular-nums">{fmtFull(remaining)}</span>
                  </p>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-start justify-center">
                <Crown className="h-6 w-6 text-primary mb-2" />
                <p className="text-base font-bold text-foreground">Todas as conquistas desbloqueadas</p>
                <p className="text-[11px] text-muted-foreground mt-1">Você atingiu o tier máximo — Lenda HOTZFY.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Milestone Ledger ═══ */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-foreground">Trilha de conquistas</h3>
          <span className="text-[11px] text-muted-foreground">{AWARDS.length} marcos</span>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
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
                    "w-full flex items-center gap-4 px-4 sm:px-5 py-3.5 text-left transition-colors",
                    "hover:bg-accent/30",
                    isOpen && "bg-accent/20",
                    isCurrent && !isOpen && "bg-primary/[0.02]"
                  )}
                >
                  {/* Index */}
                  <div className={cn(
                    "h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-[11px] font-bold tabular-nums border",
                    done ? "bg-success/10 border-success/20 text-success"
                      : isCurrent ? "bg-primary/10 border-primary/20 text-primary"
                      : "bg-muted border-border text-muted-foreground/60"
                  )}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : String(idx + 1).padStart(2, "0")}
                  </div>

                  {/* Image thumb */}
                  <div className={cn(
                    "h-11 w-11 rounded-lg shrink-0 overflow-hidden flex items-center justify-center border border-border/60",
                    done ? "bg-secondary" : "bg-muted/40"
                  )}>
                    <img
                      src={award.image}
                      alt={award.title}
                      className={cn("h-9 w-9 object-contain", !done && "grayscale opacity-30")}
                    />
                  </div>

                  {/* Title block */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={cn(
                        "text-sm font-bold truncate",
                        done ? "text-foreground" : isCurrent ? "text-foreground" : "text-muted-foreground/70"
                      )}>
                        {award.title}
                      </h4>
                      {isCurrent && (
                        <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                          Em curso
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {award.tier} · meta {fmtC(award.value)}
                    </p>
                  </div>

                  {/* Progress (desktop) */}
                  <div className="hidden md:flex items-center gap-3 shrink-0 w-44">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div className={cn(
                        "h-full transition-all duration-500",
                        done ? "bg-success" : isCurrent ? "bg-primary" : "bg-muted-foreground/20"
                      )} style={{ width: `${progress}%` }} />
                    </div>
                    <span className={cn(
                      "text-[11px] font-bold tabular-nums w-10 text-right",
                      done ? "text-success" : isCurrent ? "text-foreground" : "text-muted-foreground/50"
                    )}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>

                  <ChevronRight className={cn(
                    "h-4 w-4 text-muted-foreground/40 transition-transform shrink-0",
                    isOpen && "rotate-90"
                  )} />
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 bg-secondary/20 border-t border-border">
                    <div className="flex flex-col md:flex-row gap-5 pt-4">
                      <div className={cn(
                        "relative w-full md:w-48 h-40 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-border",
                        done ? "bg-card" : "bg-muted/30"
                      )}>
                        <img
                          src={award.image}
                          alt={award.title}
                          className={cn("h-32 w-32 object-contain", !done && "grayscale opacity-25")}
                        />
                        {!done && (
                          <div className="absolute top-2 right-2 h-6 w-6 rounded-md bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center">
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-3">
                        <p className="text-sm leading-relaxed text-foreground/80">
                          {award.description}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {award.rewards.map(r => (
                            <span key={r} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-card border border-border text-foreground">
                              <Gift className="h-3 w-3 text-primary" /> {r}
                            </span>
                          ))}
                        </div>

                        {!done && (
                          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Atual</p>
                              <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">{fmtC(revenue)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Meta</p>
                              <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">{fmtC(award.value)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Faltam</p>
                              <p className="text-sm font-bold text-primary tabular-nums mt-0.5">{fmtC(award.value - revenue)}</p>
                            </div>
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
