import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Crown, Flag, Gift, Medal, Award, Trophy, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Race = { id: string; title: string; description: string | null; starts_at: string; ends_at: string; is_active: boolean; banner_url: string | null; logo_url: string | null };
type Prize = { id: string; title: string; description: string | null; image_url: string | null; min_revenue_cents: number; target_position: number | null; sort_order: number };
type LeaderRow = { seller_id: string | null; seller_name: string; seller_avatar: string | null; revenue_cents: number; sales_count: number; rank_position: number };

const fmtBRL = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const POS_ICON = [Crown, Medal, Award];

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Math.max(0, (target ? new Date(target).getTime() : now) - now);
  return { d: Math.floor(diff / 864e5), h: Math.floor((diff / 36e5) % 24), m: Math.floor((diff / 6e4) % 60), s: Math.floor((diff / 1e3) % 60), ended: diff === 0 };
}

function Avatar({ row, size = "h-10 w-10" }: { row: LeaderRow; size?: string }) {
  return row.seller_avatar
    ? <img src={row.seller_avatar} alt="" className={cn(size, "shrink-0 rounded-full object-cover")} />
    : <span className={cn(size, "grid shrink-0 place-items-center rounded-full bg-muted font-display font-bold text-foreground")}>{row.seller_name.charAt(0).toUpperCase()}</span>;
}

export default function CorridaFaturamento() {
  const { user } = useAuth();
  const reduce = useReducedMotion();
  const [race, setRace] = useState<Race | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(false);
    const { data: races, error: racesError } = await supabase.from("revenue_races").select("*").eq("is_active", true).order("starts_at", { ascending: false }).limit(1);
    if (racesError) { setError(true); setLoading(false); return; }
    const active = (races ?? [])[0] as Race | undefined;
    setRace(active ?? null);
    if (active) {
      const [{ data: pr, error: prError }, { data: lb, error: lbError }, assetsRes] = await Promise.all([
        supabase.from("revenue_race_prizes").select("*").eq("race_id", active.id).order("sort_order"),
        supabase.rpc("race_leaderboard", { _race_id: active.id }),
        supabase.functions.invoke("get-race-asset-urls", { method: "GET" }),
      ]);
      if (prError || lbError) { setError(true); setLoading(false); return; }
      setPrizes((pr ?? []) as Prize[]);
      setLeaders((lb ?? []) as LeaderRow[]);
      if (!assetsRes.error && assetsRes.data?.race_id === active.id) setAssetUrls(assetsRes.data.urls ?? {});
    } else {
      setAssetUrls({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    // Anything the admin changes (race, prizes, ranking adjustments) refreshes here live.
    const ch = supabase.channel("race-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_races" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_race_prizes" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_race_overrides" }, () => void load())
      .subscribe();
    const t = setInterval(() => void load(), 60_000);
    return () => { clearInterval(t); void supabase.removeChannel(ch); };
  }, [load]);

  const cd = useCountdown(race?.ends_at);
  const mine = useMemo(() => leaders.find((l) => l.seller_id === user?.id), [leaders, user?.id]);

  if (loading) return <div className="grid gap-4"><div className="h-56 animate-pulse rounded-xl border border-border bg-card" /><div className="h-80 animate-pulse rounded-xl border border-border bg-card" /></div>;

  if (error) return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-6 py-14 text-center text-destructive">
      <p className="text-sm font-semibold">Não foi possível carregar a corrida de faturamento.</p>
      <button
        onClick={() => { setLoading(true); void load(); }}
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20"
      >
        Tentar de novo
      </button>
    </div>
  );

  if (!race) return (
    <section className="grid place-items-center rounded-xl border border-border bg-card px-6 py-24 text-center">
      <Flag className="h-10 w-10 text-primary" />
      <h2 className="mt-4 font-display text-2xl font-bold text-foreground">Nenhuma corrida ativa</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Aguarde a próxima temporada. Assim que ela for aberta, ranking e prêmios aparecem aqui automaticamente.</p>
    </section>
  );

  const top3 = leaders.slice(0, 3);
  const podium = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderRow[];
  const topRevenue = leaders[0]?.revenue_cents || 1;
  const total = new Date(race.ends_at).getTime() - new Date(race.starts_at).getTime();
  const elapsed = Math.min(Math.max((Date.now() - new Date(race.starts_at).getTime()) / total, 0), 1) * 100;
  const mineVisible = mine && mine.rank_position <= 10;

  return (
    <div className="grid gap-4 pb-14">
      {/* HERO */}
      <section className="relative isolate overflow-hidden rounded-xl border border-border bg-card">
        {(assetUrls.banner || race.banner_url) && <img src={assetUrls.banner || race.banner_url || ""} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-20" />}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_100%_0%,hsl(var(--primary)/0.14),transparent_60%)]" />
        <div className="grid gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> {cd.ended ? "Temporada encerrada" : "Temporada ao vivo"}
            </p>
            <div className="mt-3 flex items-center gap-4">
              {(assetUrls.logo || race.logo_url) && <img src={assetUrls.logo || race.logo_url || ""} alt="" className="h-14 w-14 shrink-0 object-contain" />}
              <h1 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-[2.6rem]">{race.title}</h1>
            </div>
            {race.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-6 text-muted-foreground">{race.description}</p>}
            <div className="mt-5 max-w-xl">
              <div className="flex justify-between font-mono text-[10px] uppercase text-muted-foreground">
                <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{format(new Date(race.starts_at), "dd MMM", { locale: ptBR })}</span>
                <span>{format(new Date(race.ends_at), "dd MMM yyyy · HH:mm", { locale: ptBR })}</span>
              </div>
              <div className="mt-2 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${elapsed}%` }} /></div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-border bg-border">
            {([["Dias", cd.d], ["Horas", cd.h], ["Min", cd.m], ["Seg", cd.s]] as const).map(([k, v]) => (
              <div key={k} className="min-w-[68px] bg-background px-3 py-3 text-center">
                <p className="font-display text-2xl font-bold tabular-nums text-foreground">{String(v).padStart(2, "0")}</p>
                <p className="font-mono text-[9px] uppercase text-muted-foreground">{k}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        {/* PODIUM */}
        <section className="rounded-xl border border-border bg-card px-5 py-6 sm:px-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Top 3 da temporada</p>
              <h2 className="mt-1 font-display text-lg font-bold text-foreground">Pódio</h2>
            </div>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{leaders.length} participantes</span>
          </div>
          {podium.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Nenhuma venda registrada ainda nesta corrida.</p>
          ) : (
            <div className="mx-auto mt-8 grid max-w-2xl grid-cols-3 items-end gap-3 sm:gap-5">
              {podium.map((l) => {
                const first = l.rank_position === 1;
                const Icon = POS_ICON[l.rank_position - 1] ?? Award;
                return (
                  <motion.div key={`${l.seller_id}-${l.rank_position}`} initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: first ? 0.15 : 0.05 }} className="flex min-w-0 flex-col items-center">
                    <div className={cn("relative rounded-full p-[2px]", first ? "bg-primary" : "bg-border")}>
                      <Avatar row={l} size={first ? "h-20 w-20 text-2xl" : "h-14 w-14 text-lg"} />
                      <span className={cn("absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full border border-border bg-background", first ? "text-primary" : "text-muted-foreground")}><Icon className="h-3.5 w-3.5" /></span>
                    </div>
                    <p className="mt-3 max-w-full truncate text-sm font-semibold text-foreground">{l.seller_name}</p>
                    <p className={cn("font-display text-sm font-bold tabular-nums sm:text-base", first ? "text-primary" : "text-foreground")}>{fmtBRL(l.revenue_cents)}</p>
                    <div className={cn("mt-3 flex w-full items-start justify-center rounded-t-lg border border-b-0 pt-3", first ? "h-40 border-primary/40 bg-primary/10" : l.rank_position === 2 ? "h-28 border-border bg-muted/60" : "h-20 border-border bg-muted/40")}>
                      <span className={cn("font-display text-3xl font-bold tabular-nums sm:text-4xl", first ? "text-primary" : "text-muted-foreground")}>{l.rank_position}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* RANKING */}
        <section className="rounded-xl border border-border bg-card px-5 py-6 sm:px-6">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Classificação</p>
          <h2 className="mt-1 font-display text-lg font-bold text-foreground">Top 10</h2>
          <ol className="mt-4">
            {leaders.slice(0, 10).map((l) => {
              const me = l.seller_id === user?.id;
              return (
                <li key={`${l.seller_id}-${l.rank_position}`} className={cn("flex items-center gap-3 border-t border-border py-2.5 first:border-t-0", me && "-mx-3 rounded-md border-transparent bg-primary/10 px-3")}>
                  <span className={cn("w-6 text-right font-mono text-xs tabular-nums", l.rank_position <= 3 ? "text-primary" : "text-muted-foreground")}>{l.rank_position}</span>
                  <Avatar row={l} size="h-8 w-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{l.seller_name}{me && <span className="text-primary"> · você</span>}</p>
                    <div className="mt-1 h-0.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(4, (l.revenue_cents / topRevenue) * 100)}%` }} /></div>
                  </div>
                  <span className="font-numbers text-sm font-semibold tabular-nums text-foreground">{fmtBRL(l.revenue_cents)}</span>
                </li>
              );
            })}
            {leaders.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">Ranking vazio por enquanto.</li>}
          </ol>
          {mine && !mineVisible && (
            <div className="mt-3 flex items-center gap-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2.5">
              <span className="font-mono text-xs text-primary">#{mine.rank_position}</span>
              <span className="flex-1 text-sm font-medium text-foreground">Sua posição</span>
              <span className="font-numbers text-sm font-semibold tabular-nums">{fmtBRL(mine.revenue_cents)}</span>
            </div>
          )}
          {!mine && <p className="mt-3 text-xs text-muted-foreground">Faça sua primeira venda na temporada para entrar no ranking.</p>}
        </section>
      </div>

      {/* PRIZES */}
      {prizes.length > 0 && (
        <section className="rounded-xl border border-border bg-card px-5 py-6 sm:px-8">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Definidos pela VENXPAY</p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-bold text-foreground"><Gift className="h-4 w-4 text-primary" />Prêmios da temporada</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {prizes.map((p) => {
              const reached = mine ? (p.target_position ? mine.rank_position <= p.target_position : mine.revenue_cents >= p.min_revenue_cents) : false;
              return (
                <article key={p.id} className={cn("group overflow-hidden rounded-lg border bg-background transition-[border-color,transform] duration-200 hover:-translate-y-0.5", reached ? "border-primary/50" : "border-border hover:border-primary/40")}>
                  <div className="aspect-video overflow-hidden bg-muted">
                    {p.image_url ? <img src={p.image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center"><Trophy className="h-9 w-9 text-primary/50" /></div>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground">{p.title}</p>
                      {reached && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 font-mono text-[9px] uppercase text-primary-foreground">Garantido</span>}
                    </div>
                    {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                    <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
                      <Target className="h-3 w-3 text-primary" />
                      {p.target_position ? `Top ${p.target_position} no ranking` : `Meta ${fmtBRL(p.min_revenue_cents)}`}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
