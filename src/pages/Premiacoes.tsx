/**
 * Premiações — Stone/MercadoPago-inspired clean layout
 * @module Premiacoes
 * @version 8.0.0
 */

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, Lock, CheckCircle2, Gift, Crown, Gem, Zap, Star, Sparkles,
  ArrowUpRight, Rocket, ChevronRight,
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
  { id: "10k", value: 10000, label: "R$ 10K", tier: "Primeiro Marco", title: "Kit Exclusivo HOTZFY", description: "Pulseira de couro premium + Cartão Black exclusivo HOTZFY.", motivation: "O primeiro passo sempre é o mais difícil — e você já deu.", image: braceletCard, icon: Zap, rewards: ["Pulseira Premium", "Cartão Black"] },
  { id: "100k", value: 100000, label: "R$ 100K", tier: "Bronze", title: "Plaquinha Bronze", description: "Plaquinha em mármore negro com detalhes dourados.", motivation: "100K é onde o jogo real começa.", image: plaque100k, icon: Star, rewards: ["Plaquinha Bronze"] },
  { id: "250k", value: 250000, label: "R$ 250K", tier: "Prata", title: "Plaquinha Prata", description: "Acabamento prata platinado. Topo do mercado digital.", motivation: "Um quarto de milhão. Você executa.", image: plaque250k, icon: Star, rewards: ["Plaquinha Prata"] },
  { id: "500k", value: 500000, label: "R$ 500K", tier: "Ouro", title: "Plaquinha Ouro", description: "Banhada a ouro com detalhes em esmeralda.", motivation: "Você não é mais um vendedor — é uma máquina.", image: plaque500k, icon: Crown, rewards: ["Plaquinha Ouro 24K"] },
  { id: "1m", value: 1000000, label: "R$ 1M", tier: "Diamante", title: "Plaquinha Diamante", description: "Cravejada em diamante. 1 Milhão.", motivation: "Você entrou no clube dos impérios.", image: plaque1m, icon: Gem, rewards: ["Plaquinha Diamante"] },
  { id: "5m", value: 5000000, label: "R$ 5M", tier: "Elite", title: "Plaquinha Elite", description: "Rose Gold com diamantes negros.", motivation: "Você criou seu próprio nível.", image: plaque5m, icon: Crown, rewards: ["Plaquinha Elite"] },
  { id: "10m", value: 10000000, label: "R$ 10M", tier: "Lenda", title: "Plaquinha Lenda", description: "Gemas preciosas multicoloridas. Imortal.", motivation: "Seu nome será lembrado para sempre.", image: plaque10m, icon: Sparkles, rewards: ["Plaquinha Lenda"] },
];

const fmtC = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`
    : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}K`
    : `R$ ${v.toLocaleString("pt-BR")}`;

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
  return <>{fmtC(d)}</>;
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

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-20 px-4 md:px-6 space-y-8 pt-2">

      {/* ═══ Hero — revenue + progress ═══ */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Faturamento líquido</p>
        <div className="flex items-end gap-3">
          <h1 className="text-[42px] sm:text-[56px] font-heading font-black tracking-tighter text-foreground leading-none">
            <AnimNum value={revenue} />
          </h1>
          {revenue > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success mb-1.5">
              <ArrowUpRight className="h-3 w-3" /> ativo
            </span>
          )}
        </div>
        {nextAward && (
          <p className="text-sm text-muted-foreground mt-1">
            Próximo: <span className="font-semibold text-foreground">{nextAward.title}</span> em {nextAward.label}
          </p>
        )}

        {/* Inline progress */}
        <div className="pt-4 max-w-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground">{unlockedCount} de {AWARDS.length} conquistas</span>
            <span className="text-[11px] font-semibold text-foreground tabular-nums">{((unlockedCount / AWARDS.length) * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(unlockedCount / AWARDS.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* ═══ Milestone dots ═══ */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
        {AWARDS.map((a, i) => {
          const done = revenue >= a.value;
          const isCurrent = i === currentIdx;
          return (
            <button
              key={a.id}
              onClick={() => setSelected(selected === a.id ? null : a.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap shrink-0",
                done ? "bg-foreground text-background" :
                  isCurrent ? "bg-primary/10 text-primary" :
                  "bg-muted/15 text-muted-foreground/50 hover:bg-muted/25",
                selected === a.id && "ring-2 ring-primary/30"
              )}
            >
              {done ? <CheckCircle2 className="h-3 w-3" /> : isCurrent ? <Rocket className="h-3 w-3" /> : null}
              {a.label}
            </button>
          );
        })}
      </div>

      {/* ═══ Awards List ═══ */}
      <div className="space-y-px rounded-2xl overflow-hidden border border-border/50">
        {AWARDS.map((award, idx) => {
          const done = revenue >= award.value;
          const isCurrent = idx === currentIdx;
          const isOpen = selected === award.id;
          const progress = Math.min((revenue / award.value) * 100, 100);
          const Icon = award.icon;

          return (
            <div key={award.id}>
              {/* Row */}
              <button
                type="button"
                onClick={() => setSelected(isOpen ? null : award.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-4 text-left transition-colors",
                  done ? "bg-card hover:bg-accent/30" :
                    isCurrent ? "bg-card hover:bg-accent/30" :
                    "bg-card/60 hover:bg-accent/20",
                  isOpen && "bg-accent/20"
                )}
              >
                {/* Image thumb */}
                <div className={cn(
                  "h-12 w-12 rounded-xl shrink-0 overflow-hidden flex items-center justify-center",
                  done ? "bg-muted/20" : "bg-muted/10"
                )}>
                  <img
                    src={award.image}
                    alt={award.title}
                    className={cn("h-10 w-10 object-contain", !done && "grayscale opacity-30")}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={cn(
                      "text-sm font-semibold truncate",
                      done ? "text-foreground" : isCurrent ? "text-foreground" : "text-muted-foreground/40"
                    )}>
                      {award.title}
                    </h3>
                    {done && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
                    {isCurrent && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/8 px-1.5 py-0.5 rounded shrink-0">
                        Próximo
                      </span>
                    )}
                  </div>
                  <p className={cn("text-xs", done ? "text-muted-foreground" : "text-muted-foreground/30")}>
                    {award.tier} · {award.label}
                  </p>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-3 shrink-0">
                  {!done && (
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                        <div className={cn("h-full rounded-full", isCurrent ? "bg-primary" : "bg-muted-foreground/10")} style={{ width: `${progress}%` }} />
                      </div>
                      <span className={cn("text-[10px] font-medium tabular-nums w-8 text-right", isCurrent ? "text-foreground" : "text-muted-foreground/25")}>
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                  )}
                  {done && !isOpen && <span className="text-[10px] text-muted-foreground hidden sm:block">Ver detalhes</span>}
                  <ChevronRight className={cn(
                    "h-4 w-4 text-muted-foreground/30 transition-transform",
                    isOpen && "rotate-90"
                  )} />
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className={cn("px-5 pb-5 pt-1", done ? "bg-accent/10" : "bg-accent/5")}>
                  <div className="flex flex-col md:flex-row gap-5 pl-16">
                    {/* Large image */}
                    <div className={cn(
                      "w-full md:w-56 h-44 rounded-xl overflow-hidden flex items-center justify-center shrink-0",
                      done ? "bg-muted/15" : "bg-muted/8"
                    )}>
                      <img
                        src={award.image}
                        alt={award.title}
                        className={cn("h-36 w-36 object-contain", !done && "grayscale opacity-25")}
                      />
                      {!done && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="h-5 w-5 text-muted-foreground/20" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-3">
                      <p className={cn("text-sm leading-relaxed", done ? "text-foreground/80" : "text-muted-foreground/50")}>
                        {award.description}
                      </p>

                      {/* Rewards */}
                      <div className="flex flex-wrap gap-2">
                        {award.rewards.map(r => (
                          <span key={r} className={cn(
                            "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg",
                            done ? "bg-foreground/5 text-foreground/70" : "bg-muted/10 text-muted-foreground/30"
                          )}>
                            <Gift className="h-3 w-3" /> {r}
                          </span>
                        ))}
                      </div>

                      {done ? (
                        <p className="text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-3 mt-2">
                          "{award.motivation}"
                        </p>
                      ) : (
                        <div className="space-y-1.5 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">Progresso</span>
                            <span className="text-[11px] font-semibold tabular-nums text-foreground">{progress.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
                            <div className={cn("h-full rounded-full", isCurrent ? "bg-primary" : "bg-muted-foreground/15")} style={{ width: `${progress}%` }} />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Faltam <span className="font-semibold text-foreground">{fmtC(award.value - revenue)}</span>
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

      {/* ═══ Final CTA ═══ */}
      <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-card border border-border/50">
        <div className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
          unlockedCount === AWARDS.length ? "bg-primary/10 text-primary" : "bg-muted/15 text-muted-foreground/30"
        )}>
          <Crown className="h-5 w-5" />
        </div>
        <p className={cn(
          "text-sm font-medium flex-1",
          unlockedCount === AWARDS.length ? "text-foreground" : "text-muted-foreground/50"
        )}>
          {unlockedCount === AWARDS.length
            ? "Todas as conquistas desbloqueadas — Você é uma Lenda!"
            : "Continue vendendo para desbloquear todas as conquistas"}
        </p>
        {unlockedCount === AWARDS.length && <Trophy className="h-5 w-5 text-primary shrink-0" />}
      </div>
    </div>
  );
}
