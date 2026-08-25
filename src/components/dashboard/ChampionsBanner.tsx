import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { ArrowRight, Crown, Flag } from "lucide-react";

/**
 * Champions banner for the seller dashboard.
 * Reads the active revenue race leaderboard (real data) and renders a
 * technical podium with revenue bars, gap-to-leader and the seller's own rank.
 */

type Race = { id: string; title: string; ends_at: string };

type LeaderRow = {
  seller_id: string | null;
  seller_name: string;
  seller_avatar: string | null;
  revenue_cents: number;
  sales_count: number;
  rank_position: number;
};

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "—";

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff / 3600000) % 24),
    m: Math.floor((diff / 60000) % 60),
    s: Math.floor((diff / 1000) % 60),
    ended: diff === 0,
  };
}

export function ChampionsBanner({ hidden = false }: { hidden?: boolean }) {
  const { user } = useAuth();
  const [race, setRace] = useState<Race | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: races } = await supabase
          .from("revenue_races")
          .select("id,title,ends_at")
          .eq("is_active", true)
          .order("starts_at", { ascending: false })
          .limit(1);
        const active = (races || [])[0] as Race | undefined;
        if (!alive) return;
        if (!active) { setRace(null); setLoading(false); return; }
        setRace(active);
        const { data: lb } = await supabase.rpc("race_leaderboard", { _race_id: active.id });
        if (!alive) return;
        setLeaders((lb || []) as LeaderRow[]);
      } catch {
        if (alive) setLeaders([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const cd = useCountdown(race?.ends_at);
  const top3 = useMemo(() => leaders.slice(0, 3), [leaders]);
  const mine = useMemo(() => leaders.find((l) => l.seller_id === user?.id), [leaders, user?.id]);
  const topRevenue = leaders[0]?.revenue_cents || 0;
  const gap = mine && topRevenue > mine.revenue_cents ? topRevenue - mine.revenue_cents : 0;

  // Visual order: 2nd · 1st · 3rd
  const podium = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderRow[];

  const mask = (v: string) => (hidden ? "••••••" : v);

  return (
    <section className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-border/60 bg-card">
      {/* technical grid + emerald wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)/0.55) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.55) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(70% 100% at 70% 40%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(70% 100% at 70% 40%, black, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "radial-gradient(45% 75% at 88% 55%, hsl(var(--primary)/0.14), transparent 68%)" }}
      />

      <div className="relative grid gap-8 p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12 lg:px-12">
        {/* ── Left: copy + countdown ── */}
        <div className="min-w-0 space-y-4 text-center lg:text-left">
          <div className="flex items-center justify-center gap-2 lg:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              <Flag className="h-3 w-3" strokeWidth={2.5} />
              {race ? "Temporada ativa" : "Ranking"}
            </span>
            {race && (
              <span className="truncate text-[11px] font-medium text-muted-foreground/70">{race.title}</span>
            )}
          </div>

          <h2 className="font-display text-3xl font-extrabold uppercase italic leading-[0.9] tracking-[-0.045em] sm:text-4xl lg:text-5xl">
            Conheça os<br /><span className="text-primary">Campeões</span>
          </h2>

          <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">
            {leaders.length > 0
              ? "Ranking apurado em tempo real pelas vendas aprovadas da temporada."
              : "A corrida de faturamento começa quando a próxima temporada for aberta."}
          </p>

          {cd && !cd.ended && (
            <div className="flex items-center justify-center gap-2 lg:justify-start">
              {[
                { v: cd.d, l: "dias" },
                { v: cd.h, l: "hrs" },
                { v: cd.m, l: "min" },
                { v: cd.s, l: "seg" },
              ].map((u) => (
                <div key={u.l} className="min-w-[52px] rounded-xl border border-border/60 bg-background px-2.5 py-1.5">
                  <p className="font-display text-[17px] font-bold tabular-nums leading-none text-foreground">
                    {String(u.v).padStart(2, "0")}
                  </p>
                  <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">{u.l}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <Link
              to="/premiacoes?tab=corrida"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ver ranking completo <ArrowRight className="h-4 w-4" />
            </Link>
            {mine && (
              <span className="rounded-xl border border-border/60 bg-background px-3 py-2.5 text-[12px] font-semibold tabular-nums text-muted-foreground">
                Você está em <span className="text-foreground">#{mine.rank_position}</span>
                {gap > 0 && <> · faltam <span className="text-foreground">{mask(fmtBRL(gap))}</span></>}
              </span>
            )}
          </div>
        </div>

        {/* ── Right: podium with real revenue bars ── */}
        <div className="min-w-0">
          {loading ? (
            <div className="grid grid-cols-3 items-end gap-3">
              {[24, 36, 20].map((h, i) => (
                <div key={i} className="animate-pulse rounded-t-2xl border border-border/50 bg-muted/40" style={{ height: h * 4 }} />
              ))}
            </div>
          ) : podium.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-6 py-10 text-center">
              <p className="text-[13px] font-semibold text-foreground">Nenhum campeão ainda</p>
              <p className="mt-1 text-[12px] text-muted-foreground/70">O pódio aparece assim que as primeiras vendas forem aprovadas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 items-end gap-2.5 sm:gap-4">
              {podium.map((p) => {
                const isLeader = p.rank_position === 1;
                const pct = topRevenue > 0 ? Math.max(18, Math.round((p.revenue_cents / topRevenue) * 100)) : 18;
                const height = isLeader ? 176 : 96 + (pct / 100) * 48;
                return (
                  <div key={p.seller_id ?? p.seller_name} className="flex min-w-0 flex-col items-center">
                    {isLeader && (
                      <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/12 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-[0.14em] text-primary">
                        <Crown className="h-3 w-3" strokeWidth={2.5} /> Líder
                      </span>
                    )}
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[12px] font-bold",
                        isLeader ? "border-primary/40 bg-primary/12 text-primary" : "border-border/60 bg-muted/40 text-muted-foreground"
                      )}
                    >
                      {p.seller_avatar ? (
                        <img src={p.seller_avatar} alt={`Avatar de ${p.seller_name}`} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        initials(p.seller_name)
                      )}
                    </div>
                    <p className={cn("mt-2 max-w-full truncate text-[11.5px] font-bold", isLeader ? "text-foreground" : "text-muted-foreground")}>
                      {p.seller_name}
                    </p>
                    <p className="text-[11px] font-semibold tabular-nums text-primary">{mask(fmtBRL(p.revenue_cents))}</p>

                    <div
                      className={cn(
                        "relative mt-2.5 flex w-full items-start justify-center overflow-hidden rounded-t-2xl border-x border-t pt-3",
                        isLeader ? "border-primary/35 bg-primary/[0.07]" : "border-border/60 bg-muted/25"
                      )}
                      style={{ height }}
                    >
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 bottom-0 opacity-[0.5]"
                        style={{
                          height: `${pct}%`,
                          backgroundImage: `repeating-linear-gradient(180deg, hsl(var(--${isLeader ? "primary" : "muted-foreground"})/0.16) 0 1px, transparent 1px 7px)`,
                        }}
                      />
                      <span
                        className={cn(
                          "relative font-display font-black tabular-nums leading-none",
                          isLeader ? "text-3xl text-foreground/70 sm:text-5xl" : "text-xl text-muted-foreground/45 sm:text-2xl"
                        )}
                      >
                        {String(p.rank_position).padStart(2, "0")}
                      </span>
                      <span className="absolute inset-x-3 bottom-2 text-center text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/55 tabular-nums">
                        {p.sales_count} vendas
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ChampionsBanner;
