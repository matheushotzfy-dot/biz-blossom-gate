import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { sumPaged } from "@/features/awards/awardMeta";
import { RACE_STATUSES, type Leader, type Prize, type Race } from "./raceMeta";

export interface RaceData {
  race: Race | null;
  prizes: Prize[];
  leaders: Leader[];
  assetUrls: Record<string, string>;
}

const RACE_COLUMNS = "id,title,description,starts_at,ends_at,is_active,banner_url,logo_url";
const POLL_MS = 60_000;

const toNumber = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Corrida ativa, prêmios e ranking. Uma atualização que falha nunca apaga o que já está na tela:
 * `failed` só vale quando ainda não há dado nenhum; com dado, a falha vira `stale`.
 */
export function useRace(userId: string | null | undefined) {
  const [data, setData] = useState<RaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const run = useRef(0);

  const load = useCallback(async () => {
    const id = ++run.current;
    try {
      const { data: races, error: racesError } = await supabase
        .from("revenue_races")
        .select(RACE_COLUMNS)
        .eq("is_active", true)
        .order("starts_at", { ascending: false })
        .limit(1);
      if (racesError) throw racesError;
      const race = ((races ?? [])[0] as Race | undefined) ?? null;
      if (!race) {
        if (id !== run.current) return;
        setData({ race: null, prizes: [], leaders: [], assetUrls: {} });
        setError(false);
        setUpdatedAt(Date.now());
        return;
      }
      const [prizesRes, boardRes, assetsRes] = await Promise.all([
        supabase.from("revenue_race_prizes").select("id,title,description,image_url,min_revenue_cents,target_position,sort_order").eq("race_id", race.id).order("sort_order"),
        supabase.rpc("race_leaderboard", { _race_id: race.id }),
        supabase.functions.invoke("get-race-asset-urls", { method: "GET" }),
      ]);
      if (prizesRes.error) throw prizesRes.error;
      if (boardRes.error) throw boardRes.error;
      if (id !== run.current) return;
      const prizes = ((prizesRes.data ?? []) as Prize[]).map((p) => ({ ...p, min_revenue_cents: toNumber(p.min_revenue_cents) }));
      const leaders = ((boardRes.data ?? []) as Leader[])
        .map((l) => ({ ...l, revenue_cents: toNumber(l.revenue_cents), sales_count: toNumber(l.sales_count), rank_position: toNumber(l.rank_position) }))
        .sort((a, b) => a.rank_position - b.rank_position);
      const assets = !assetsRes.error && assetsRes.data?.race_id === race.id ? ((assetsRes.data.urls ?? {}) as Record<string, string>) : {};
      setData({ race, prizes, leaders, assetUrls: assets });
      setError(false);
      setUpdatedAt(Date.now());
    } catch {
      if (id === run.current) setError(true);
    } finally {
      if (id === run.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // O que o admin muda (temporada, prêmios, ajustes do ranking) chega aqui na hora; o resto, a cada minuto.
    const channel = supabase
      .channel(uniqueChannelName("race-live"))
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_races" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_race_prizes" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_race_overrides" }, () => void load())
      .subscribe();
    const poll = setInterval(() => { if (typeof document === "undefined" || document.visibilityState === "visible") void load(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      run.current += 1; // descarta respostas que ainda estão a caminho
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const retry = useCallback(() => { setLoading(true); void load(); }, [load]);

  // Fora dos 100 primeiros (ou sem posição) o ranking não traz o seu valor: busca o exato da temporada.
  const race = data?.race ?? null;
  const missing = !!data && !!userId && !data.leaders.some((l) => l.seller_id === userId);
  const [own, setOwn] = useState<{ cents: number; capped: boolean } | null>(null);
  const ownKey = race && missing ? `${race.id}|${race.starts_at}|${race.ends_at}|${updatedAt ?? 0}` : null;
  useEffect(() => {
    if (!ownKey || !race || !userId) { setOwn(null); return; }
    if (Date.parse(race.starts_at) > Date.now()) { setOwn(null); return; }
    let alive = true;
    sumPaged((from, to) =>
      supabase
        .from("transactions")
        .select("net_amount")
        .eq("user_id", userId)
        .in("status", [...RACE_STATUSES])
        .eq("is_simulated", false)
        .gte("created_at", race.starts_at)
        .lte("created_at", race.ends_at)
        .order("id")
        .range(from, to),
    )
      .then((r) => { if (alive) setOwn({ cents: Math.round(r.total * 100), capped: r.capped }); })
      .catch(() => { if (alive) setOwn(null); });
    return () => { alive = false; };
  }, [ownKey, race, userId]);

  return { data, loading, failed: error && !data, stale: error && !!data, retry, own, updatedAt };
}
