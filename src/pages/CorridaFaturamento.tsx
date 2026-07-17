import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageShell, PageTitle, Panel, EmptyState } from "@/components/PageShell";
import { Flag, Trophy, Gift, Clock, TrendingUp, Crown, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Race = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  banner_url: string | null;
  logo_url: string | null;
};

type Prize = {
  id: string;
  race_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  min_revenue_cents: number;
  target_position: number | null;
  sort_order: number;
};

type LeaderRow = {
  seller_id: string | null;
  seller_name: string;
  seller_avatar: string | null;
  revenue_cents: number;
  sales_count: number;
  rank_position: number;
  is_manual?: boolean;
};

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s, ended: diff === 0 };
}

export default function CorridaFaturamento() {
  const { user } = useAuth();
  const [race, setRace] = useState<Race | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: races } = await supabase
        .from("revenue_races")
        .select("*")
        .eq("is_active", true)
        .order("starts_at", { ascending: false })
        .limit(1);
      const active = (races || [])[0] as Race | undefined;
      if (!active) { setRace(null); setLoading(false); return; }
      setRace(active);
      const [{ data: pr }, { data: lb }] = await Promise.all([
        supabase.from("revenue_race_prizes").select("*").eq("race_id", active.id).order("sort_order", { ascending: true }),
        supabase.rpc("race_leaderboard", { _race_id: active.id }),
      ]);
      setPrizes((pr || []) as Prize[]);
      setLeaders((lb || []) as LeaderRow[]);
      setLoading(false);
    })();
  }, []);

  const cd = useCountdown(race?.ends_at || new Date().toISOString());

  const mine = useMemo(() => leaders.find(l => l.seller_id === user?.id), [leaders, user?.id]);
  const nextPrize = useMemo(() => {
    if (!mine) return prizes[0];
    return prizes.find(p => p.min_revenue_cents > mine.revenue_cents) || null;
  }, [mine, prizes]);

  if (loading) {
    return (
      <PageShell>
        <PageTitle icon={<Flag className="h-6 w-6" />} title="Corrida de Faturamento" subtitle="Ranking e prêmios da temporada" />
        <div className="py-16 text-center text-sm text-muted-foreground">Carregando corrida...</div>
      </PageShell>
    );
  }

  if (!race) {
    return (
      <PageShell>
        <PageTitle icon={<Flag className="h-6 w-6" />} title="Corrida de Faturamento" subtitle="Ranking e prêmios da temporada" />
        <EmptyState
          icon={<Trophy className="h-10 w-10" />}
          title="Nenhuma corrida ativa"
          subtitle="Aguarde o admin abrir a próxima temporada. Você será notificado quando começar."
        />
      </PageShell>
    );
  }

  const top5 = leaders.slice(0, 5);
  const top3 = top5.slice(0, 3);
  const topRevenue = leaders[0]?.revenue_cents || 0;
  // Podium visual order: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderRow[];

  return (
    <PageShell>
      <PageTitle icon={<Flag className="h-6 w-6" />} title="Corrida de Faturamento" subtitle={race.title} />

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.08] mb-6">
        {race.banner_url && (
          <img src={race.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40"
          style={{ backgroundImage: "radial-gradient(50% 80% at 90% 50%, hsl(var(--primary)/0.25), transparent 60%)" }} />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 p-6 md:p-8">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
              <Flag className="h-3.5 w-3.5" /> Temporada Ativa
            </div>
            <h2 className="font-display font-black text-3xl md:text-5xl tracking-[-0.03em] leading-[0.95]">
              {race.title}
            </h2>
            {race.description && (
              <p className="text-muted-foreground text-sm max-w-xl">{race.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {format(new Date(race.starts_at), "dd/MM", { locale: ptBR })} — {format(new Date(race.ends_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              {!cd.ended && (
                <div className="flex items-center gap-1.5 text-primary font-bold tabular-nums">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Termina em {cd.d}d {String(cd.h).padStart(2, "0")}h {String(cd.m).padStart(2, "0")}m {String(cd.s).padStart(2, "0")}s
                </div>
              )}
            </div>
          </div>
          {race.logo_url && (
            <img src={race.logo_url} alt={race.title} className="h-24 w-24 md:h-32 md:w-32 object-contain shrink-0" />
          )}
        </div>
      </section>

      {/* ─── MY POSITION ─── */}
      {mine && (
        <Panel className="mb-6 border-primary/30 bg-primary/[0.03]">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="font-display font-black text-2xl text-primary tabular-nums">#{mine.rank_position}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Sua posição</p>
              <p className="font-display font-bold text-xl mt-0.5 tabular-nums">{fmtBRL(mine.revenue_cents)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{mine.sales_count} vendas aprovadas</p>
            </div>
            {nextPrize && (
              <div className="flex-1 min-w-0 md:border-l md:border-border/40 md:pl-4 w-full">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Próximo prêmio</p>
                <p className="font-bold text-sm mt-0.5 truncate">{nextPrize.title}</p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${Math.min(100, (mine.revenue_cents / nextPrize.min_revenue_cents) * 100)}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                  Faltam {fmtBRL(Math.max(0, nextPrize.min_revenue_cents - mine.revenue_cents))}
                </p>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* ─── TOP 3 CINEMATIC PODIUM ─── */}
      {top3.length > 0 && (
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-background via-card to-primary/[0.05] p-6 md:p-10 mb-6">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60"
            style={{ backgroundImage: "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary)/0.18), transparent 70%)" }} />
          <div className="relative">
            <div className="text-center mb-8">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                <Crown className="h-3.5 w-3.5" /> Top 3 · Campeões da Temporada
              </p>
              <h3 className="font-display font-black text-2xl md:text-3xl tracking-[-0.02em] mt-2">Pódio</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-6 items-end max-w-3xl mx-auto">
              {podiumOrder.map((l) => {
                const pos = l.rank_position;
                const isFirst = pos === 1;
                const isSecond = pos === 2;
                const Icon = isFirst ? Crown : isSecond ? Medal : Award;
                const height = isFirst ? "h-44 md:h-56" : isSecond ? "h-32 md:h-40" : "h-24 md:h-32";
                const iconTone = isFirst ? "text-yellow-400" : isSecond ? "text-slate-300" : "text-orange-400";
                const ringTone = isFirst ? "ring-yellow-400/60 shadow-[0_0_40px_-8px_rgba(250,204,21,0.5)]" : isSecond ? "ring-slate-300/40" : "ring-orange-400/40";
                const pedestalTone = isFirst
                  ? "bg-gradient-to-b from-yellow-400/25 via-yellow-500/10 to-yellow-600/5 border-yellow-400/40"
                  : isSecond
                  ? "bg-gradient-to-b from-slate-300/20 via-slate-400/10 to-slate-500/5 border-slate-300/30"
                  : "bg-gradient-to-b from-orange-400/20 via-orange-500/10 to-orange-600/5 border-orange-400/30";
                return (
                  <div key={String(l.seller_id) + pos} className="flex flex-col items-center">
                    <div className={cn(
                      "relative h-16 w-16 md:h-20 md:w-20 rounded-full ring-4 overflow-hidden bg-muted flex items-center justify-center mb-3",
                      ringTone
                    )}>
                      {l.seller_avatar
                        ? <img src={l.seller_avatar} alt="" className="h-full w-full object-cover" />
                        : <span className="font-display font-black text-2xl">{l.seller_name.charAt(0).toUpperCase()}</span>}
                      <div className={cn("absolute -top-1 -right-1 h-7 w-7 rounded-full bg-background border border-border flex items-center justify-center", iconTone)}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="font-bold text-sm md:text-base text-center truncate max-w-full">{l.seller_name}</p>
                    <p className="font-display font-black text-base md:text-lg tabular-nums text-primary mt-0.5">{fmtBRL(l.revenue_cents)}</p>
                    <p className="text-[10px] text-muted-foreground">{l.sales_count} vendas</p>
                    <div className={cn(
                      "mt-3 w-full rounded-t-2xl border border-b-0 flex items-start justify-center pt-4",
                      pedestalTone,
                      height
                    )}>
                      <span className="font-display font-black text-3xl md:text-5xl tabular-nums opacity-90">{pos}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── LEADERBOARD (Top 5) ─── */}
      <Panel className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Top 5 do Ranking
          </h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{leaders.length} participantes</span>
        </div>
        {top5.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma venda registrada ainda nesta corrida.</p>
        ) : (
          <div className="space-y-2">
            {top5.map(l => {
              const isMe = l.seller_id && l.seller_id === user?.id;
              const pct = topRevenue > 0 ? (l.revenue_cents / topRevenue) * 100 : 0;
              const isTop3 = l.rank_position <= 3;
              const posTone = l.rank_position === 1 ? "bg-yellow-400/15 text-yellow-500 border-yellow-400/40"
                : l.rank_position === 2 ? "bg-slate-300/15 text-slate-300 border-slate-300/40"
                : l.rank_position === 3 ? "bg-orange-400/15 text-orange-400 border-orange-400/40"
                : "bg-muted/60 text-muted-foreground border-border/40";
              return (
                <div key={String(l.seller_id) + l.rank_position} className={cn(
                  "relative overflow-hidden rounded-2xl border border-border/50 p-4 flex items-center gap-4 transition-colors",
                  isTop3 && "bg-gradient-to-r from-primary/[0.04] to-transparent",
                  isMe && "border-primary/50 bg-primary/[0.06]"
                )}>
                  <div className={cn("h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center font-display font-black text-lg tabular-nums", posTone)}>
                    {l.rank_position}
                  </div>
                  {l.seller_avatar
                    ? <img src={l.seller_avatar} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                    : <div className="h-10 w-10 rounded-full bg-muted text-sm font-bold flex items-center justify-center shrink-0">{l.seller_name.charAt(0).toUpperCase()}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("font-bold text-sm truncate", isMe && "text-primary")}>{l.seller_name}{isMe && " (você)"}</p>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${Math.max(6, pct)}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{l.sales_count} vendas · {pct.toFixed(1)}% do 1º</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-black text-base md:text-lg tabular-nums">{fmtBRL(l.revenue_cents)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Faturamento</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ─── PRIZES GRID ─── */}
      {prizes.length > 0 && (
        <Panel>
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" /> Prêmios
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {prizes.map(p => (
              <div key={p.id} className="rounded-2xl border border-border/40 bg-card overflow-hidden group hover:border-primary/40 transition-colors">
                {p.image_url ? (
                  <div className="aspect-video bg-muted/30 overflow-hidden">
                    <img src={p.image_url} alt={p.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <Gift className="h-10 w-10 text-primary/40" />
                  </div>
                )}
                <div className="p-4">
                  <p className="font-bold text-sm truncate">{p.title}</p>
                  {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Meta</span>
                    <span className="font-display font-bold text-primary tabular-nums">{fmtBRL(p.min_revenue_cents)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </PageShell>
  );
}
