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
  seller_id: string;
  seller_name: string;
  seller_avatar: string | null;
  revenue_cents: number;
  sales_count: number;
  rank_position: number;
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

  const top3 = leaders.slice(0, 3);
  const topRevenue = leaders[0]?.revenue_cents || 0;

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

      {/* ─── TOP 3 PODIUM ─── */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {top3.map((l, i) => {
            const Icon = i === 0 ? Crown : i === 1 ? Medal : Award;
            const tone = i === 0
              ? "from-yellow-400/20 to-amber-500/5 border-yellow-500/30"
              : i === 1
              ? "from-slate-300/20 to-slate-400/5 border-slate-400/30"
              : "from-orange-400/20 to-orange-600/5 border-orange-500/30";
            const iconTone = i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : "text-orange-500";
            return (
              <div key={l.seller_id} className={cn("rounded-2xl border p-5 bg-gradient-to-br", tone)}>
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-6 w-6", iconTone)} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    {i + 1}º Lugar
                  </span>
                </div>
                <p className="mt-3 font-bold text-base truncate">{l.seller_name}</p>
                <p className="font-display font-black text-2xl mt-1 tabular-nums">{fmtBRL(l.revenue_cents)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{l.sales_count} vendas</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── LEADERBOARD ─── */}
      <Panel className="mb-6">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> Ranking Completo
        </h3>
        {leaders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma venda registrada ainda nesta corrida.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20 text-xs text-muted-foreground">
                  <th className="text-left py-3 px-3 font-medium w-16">#</th>
                  <th className="text-left py-3 px-3 font-medium">Seller</th>
                  <th className="text-right py-3 px-3 font-medium">Faturamento</th>
                  <th className="text-right py-3 px-3 font-medium hidden sm:table-cell">Vendas</th>
                  <th className="text-right py-3 px-3 font-medium hidden md:table-cell">% do 1º</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map(l => {
                  const isMe = l.seller_id === user?.id;
                  const pct = topRevenue > 0 ? (l.revenue_cents / topRevenue) * 100 : 0;
                  return (
                    <tr key={l.seller_id} className={cn("border-b border-border/10 hover:bg-muted/5", isMe && "bg-primary/[0.04]")}>
                      <td className="py-3 px-3 font-bold tabular-nums">{l.rank_position}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {l.seller_avatar
                            ? <img src={l.seller_avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                            : <div className="h-7 w-7 rounded-full bg-muted text-[11px] font-bold flex items-center justify-center">{l.seller_name.charAt(0).toUpperCase()}</div>}
                          <span className={cn("font-medium truncate max-w-[180px]", isMe && "text-primary font-bold")}>
                            {l.seller_name}{isMe && " (você)"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-foreground tabular-nums">{fmtBRL(l.revenue_cents)}</td>
                      <td className="py-3 px-3 text-right text-muted-foreground tabular-nums hidden sm:table-cell">{l.sales_count}</td>
                      <td className="py-3 px-3 text-right text-muted-foreground tabular-nums hidden md:table-cell">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
