/**
 * Premiações — Billion-Dollar SaaS milestone ledger
 * @module Premiacoes
 * @version 10.0.0 — Premium redesign aligned with Minhas Vendas standard
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, Lock, CheckCircle2, Gift, Crown, Award, Target, ChevronRight,
  TrendingUp, Sparkles, Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";

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
    <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* HERO */}
      <FinanceiroHero
        eyebrow="PREMIAÇÕES"
        title="Trilha de Conquistas"
        subtitle="Recompensas físicas exclusivas desbloqueadas pelo seu faturamento líquido — do Kit HOTZFY à Plaquinha Lenda."
        status={
          nextAward
            ? { tone: "info", label: `Próximo: ${nextAward.tier} · ${fmtC(nextAward.value)}`, pulse: true }
            : { tone: "success", label: "Tier máximo atingido — Lenda", pulse: false }
        }
      />

      {/* KPI GRID */}
      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi
          label="Faturamento líquido"
          value={fmtC(revenue)}
          sub={fmtFull(revenue)}
          icon={TrendingUp}
          tone="success"
        />
        <FinanceiroKpi
          label="Conquistas"
          value={`${unlockedCount}/${AWARDS.length}`}
          sub={`${overallProgress.toFixed(0)}% da trilha`}
          icon={Trophy}
          tone="primary"
        />
        <FinanceiroKpi
          label="Tier atual"
          value={currentTier?.tier || "—"}
          sub={currentTier ? currentTier.title : "Sem tier desbloqueado"}
          icon={Award}
          tone="info"
        />
        <FinanceiroKpi
          label={nextAward ? "Falta para próximo" : "Status"}
          value={nextAward ? fmtC(remaining) : "Lenda"}
          sub={nextAward ? `${nextProgress.toFixed(1)}% concluído` : "Hall of Fame HOTZFY"}
          icon={nextAward ? Target : Crown}
          tone={nextAward ? "warning" : "success"}
        />
      </FinanceiroKpiGrid>

      {/* HERO STATUS PANEL */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden animate-fade-in stagger-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-border/50">
          {/* Revenue + tier */}
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.16em] mb-2">
                  Faturamento líquido total
                </p>
                <h2 className="font-display text-[36px] sm:text-[44px] font-black tracking-[-0.03em] text-foreground tabular-nums leading-none">
                  <AnimNum value={revenue} />
                </h2>
              </div>
              {currentTier && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success uppercase tracking-[0.12em] shrink-0">
                  <Crown className="h-3 w-3" />
                  Tier {currentTier.tier}
                </span>
              )}
            </div>

            {/* Overall progression */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">
                  Progressão geral
                </span>
                <span className="text-xs font-bold text-foreground tabular-nums">
                  {unlockedCount} <span className="text-muted-foreground/70 font-medium">de {AWARDS.length}</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary border border-border/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${Math.max(overallProgress, 2)}%` }}
                />
              </div>

              {/* Milestone bullets */}
              <div className="flex items-center justify-between mt-4">
                {AWARDS.map((a) => {
                  const done = revenue >= a.value;
                  return (
                    <div key={a.id} className="flex flex-col items-center gap-1.5">
                      <div className={cn(
                        "h-2.5 w-2.5 rounded-full border transition-colors",
                        done ? "bg-primary border-primary" : "bg-secondary border-border/60"
                      )} />
                      <span className={cn(
                        "text-[9px] font-bold tabular-nums",
                        done ? "text-primary" : "text-muted-foreground/50"
                      )}>{a.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Next milestone */}
          <div className="p-6 bg-secondary/40">
            {nextAward ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Target className="h-3.5 w-3.5 text-primary" strokeWidth={2.25} />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.16em]">
                    Próximo marco
                  </span>
                </div>
                <p className="font-display text-lg font-black text-foreground tracking-[-0.01em]">{nextAward.title}</p>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5 font-medium">
                  {nextAward.tier} · meta {fmtC(nextAward.value)}
                </p>

                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-muted-foreground tabular-nums font-bold">{fmtC(revenue)}</span>
                    <span className="text-xs font-black text-foreground tabular-nums">{nextProgress.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-card border border-border/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{ width: `${Math.max(nextProgress, 2)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3 font-medium">
                    Faltam <span className="font-black text-foreground tabular-nums">{fmtFull(remaining)}</span>
                  </p>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-start justify-center">
                <div className="h-10 w-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <p className="font-display text-lg font-black text-foreground tracking-[-0.01em]">Hall of Fame</p>
                <p className="text-[11px] text-muted-foreground/80 mt-1 font-medium">
                  Você atingiu o tier máximo — <span className="text-primary font-bold">Lenda HOTZFY</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MILESTONE LEDGER */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden animate-fade-in stagger-3">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
              <Flag className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-display font-black text-foreground tracking-[-0.01em]">Trilha de conquistas</h3>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">{AWARDS.length} marcos · clique para detalhes</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
            <Sparkles className="h-3 w-3" /> {unlockedCount}/{AWARDS.length} desbloqueados
          </span>
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
                    "w-full flex items-center gap-4 px-4 sm:px-5 py-3.5 text-left transition-colors",
                    "hover:bg-secondary/60",
                    isOpen && "bg-secondary/50",
                    isCurrent && !isOpen && "bg-primary/[0.04]"
                  )}
                >
                  {/* Index */}
                  <div className={cn(
                    "h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-[11px] font-black tabular-nums border",
                    done       ? "bg-success/10 border-success/20 text-success"
                    : isCurrent ? "bg-primary/10 border-primary/20 text-primary"
                                : "bg-secondary border-border/60 text-muted-foreground/60"
                  )}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : String(idx + 1).padStart(2, "0")}
                  </div>

                  {/* Image thumb */}
                  <div className={cn(
                    "h-12 w-12 rounded-lg shrink-0 overflow-hidden flex items-center justify-center border",
                    done ? "bg-secondary border-border/60" : "bg-secondary/60 border-border/40"
                  )}>
                    <img
                      src={award.image}
                      alt={award.title}
                      className={cn("h-10 w-10 object-contain", !done && "grayscale opacity-30")}
                    />
                  </div>

                  {/* Title block */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={cn(
                        "text-sm font-bold truncate font-display tracking-[-0.01em]",
                        done       ? "text-foreground"
                        : isCurrent ? "text-foreground"
                                    : "text-muted-foreground/70"
                      )}>
                        {award.title}
                      </h4>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded uppercase tracking-[0.12em] shrink-0">
                          <Target className="h-2.5 w-2.5" /> Em curso
                        </span>
                      )}
                      {done && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded uppercase tracking-[0.12em] shrink-0">
                          Desbloqueado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                      Tier <span className="text-foreground/80 font-bold">{award.tier}</span> · meta <span className="tabular-nums font-bold text-foreground/80">{fmtC(award.value)}</span>
                    </p>
                  </div>

                  {/* Progress (desktop) */}
                  <div className="hidden md:flex items-center gap-3 shrink-0 w-48">
                    <div className="flex-1 h-1.5 rounded-full bg-secondary border border-border/40 overflow-hidden">
                      <div className={cn(
                        "h-full transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        done       ? "bg-success"
                        : isCurrent ? "bg-primary"
                                    : "bg-muted-foreground/25"
                      )} style={{ width: `${Math.max(progress, 2)}%` }} />
                    </div>
                    <span className={cn(
                      "text-[11px] font-black tabular-nums w-10 text-right",
                      done       ? "text-success"
                      : isCurrent ? "text-foreground"
                                  : "text-muted-foreground/50"
                    )}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>

                  <ChevronRight className={cn(
                    "h-4 w-4 text-muted-foreground/50 transition-transform shrink-0",
                    isOpen && "rotate-90"
                  )} />
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-4 bg-secondary/30 border-t border-border/40">
                    <div className="flex flex-col md:flex-row gap-5">
                      <div className={cn(
                        "relative w-full md:w-52 h-44 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-border/60",
                        done ? "bg-card" : "bg-secondary/60"
                      )}>
                        <img
                          src={award.image}
                          alt={award.title}
                          className={cn("h-32 w-32 object-contain", !done && "grayscale opacity-25")}
                        />
                        {!done && (
                          <div className="absolute top-2 right-2 h-7 w-7 rounded-md bg-card border border-border/60 flex items-center justify-center">
                            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                        {done && (
                          <div className="absolute top-2 right-2 h-7 w-7 rounded-md bg-success/10 border border-success/20 flex items-center justify-center">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-4">
                        <p className="text-sm leading-relaxed text-foreground/85">
                          {award.description}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {award.rewards.map(r => (
                            <span key={r} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md bg-card border border-border/60 text-foreground">
                              <Gift className="h-3 w-3 text-primary" /> {r}
                            </span>
                          ))}
                        </div>

                        {!done && (
                          <div className="grid grid-cols-3 gap-px bg-border/40 rounded-lg overflow-hidden border border-border/40">
                            <div className="bg-card px-3 py-2.5">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em]">Atual</p>
                              <p className="text-sm font-display font-black text-foreground tabular-nums mt-0.5">{fmtC(revenue)}</p>
                            </div>
                            <div className="bg-card px-3 py-2.5">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em]">Meta</p>
                              <p className="text-sm font-display font-black text-foreground tabular-nums mt-0.5">{fmtC(award.value)}</p>
                            </div>
                            <div className="bg-card px-3 py-2.5">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em]">Faltam</p>
                              <p className="text-sm font-display font-black text-primary tabular-nums mt-0.5">{fmtC(award.value - revenue)}</p>
                            </div>
                          </div>
                        )}

                        {done && (
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-success/10 border border-success/20">
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            <p className="text-xs font-bold text-success">
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
