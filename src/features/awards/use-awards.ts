import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/hooks/useAuth";
import { AWARDS, EMERALD_GLOW, glowFor, type AwardItem } from "./awards-data";
import { CLAIM_SELECT, nextAward, pieceState, sumPaged, type RewardClaim, type RevenuePage } from "./awardMeta";

export type { RewardClaim } from "./awardMeta";

export interface TierRow {
  id: string; title: string; tier: string; value: number; description: string;
  phrase: string; rewards: string[]; image_url: string | null; sort_order: number; is_active: boolean;
}

export interface AwardsErrors { revenue: boolean; tiers: boolean; claims: boolean }

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const compact = (v: number) =>
  v >= 1_000_000 ? `R$ ${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `R$ ${+(v / 1000).toFixed(0)}K` : `R$ ${v}`;

/**
 * Peças definidas no admin sobre as que acompanham o app (a arte e o texto padrão servem de reserva).
 * Tabela vazia = usa as padrão; todas desativadas = nenhuma peça (a tela explica).
 */
export function mergeTiers(rows: TierRow[] | null | undefined): AwardItem[] {
  if (!rows || rows.length === 0) return AWARDS;
  return rows
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || Number(a.value) - Number(b.value))
    .map((row, i) => {
      const base = AWARDS.find((a) => a.id === row.id);
      const value = Number(row.value);
      const custom = Boolean(row.image_url);
      return {
        id: row.id,
        value,
        label: compact(value),
        tier: row.tier || base?.tier || "",
        roman: ROMAN[i] ?? String(i + 1),
        title: row.title,
        description: row.description || base?.description || "",
        image: row.image_url || base?.image || null,
        custom,
        glow: base ? glowFor(base.id) : EMERALD_GLOW,
        rewards: row.rewards?.length ? row.rewards : base?.rewards ?? [],
        phrase: row.phrase || base?.phrase || "",
        reference: base?.reference ?? `VNX-${row.id.toUpperCase()}`,
        icon: base?.icon ?? Award,
      };
    });
}

async function loadRevenue(userId: string) {
  return sumPaged((from, to) =>
    supabase
      .from("transactions")
      .select("net_amount")
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("is_simulated", false)
      .order("id")
      .range(from, to) as unknown as PromiseLike<RevenuePage>,
  );
}

export function useAwards() {
  const { user } = useAuth();
  const userId = user?.id;
  const [revenue, setRevenue] = useState(0);
  const [revenueCapped, setRevenueCapped] = useState(false);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [tiers, setTiers] = useState<TierRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<AwardsErrors>({ revenue: false, tiers: false, claims: false });
  const run = useRef(0);

  const patchError = useCallback((key: keyof AwardsErrors, value: boolean) => setErrors((cur) => (cur[key] === value ? cur : { ...cur, [key]: value })), []);

  const reloadClaims = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from("reward_claims").select(CLAIM_SELECT).eq("user_id", userId).order("created_at", { ascending: false });
    if (error) { patchError("claims", true); return; }
    patchError("claims", false);
    setClaims((data ?? []) as RewardClaim[]);
  }, [userId, patchError]);

  const reloadTiers = useCallback(async () => {
    const { data, error } = await supabase.from("award_tiers").select("*");
    if (error) { patchError("tiers", true); return; }
    patchError("tiers", false);
    setTiers((data ?? []) as TierRow[]);
  }, [patchError]);

  const reloadRevenue = useCallback(async () => {
    if (!userId) return;
    try {
      const { total, capped } = await loadRevenue(userId);
      setRevenue(total);
      setRevenueCapped(capped);
      patchError("revenue", false);
    } catch {
      patchError("revenue", true);
    }
  }, [userId, patchError]);

  const load = useCallback(async () => {
    if (!userId) return;
    const mine = ++run.current;
    setLoading(true);
    await Promise.all([reloadRevenue(), reloadTiers(), reloadClaims()]);
    if (mine === run.current) setLoading(false);
  }, [userId, reloadRevenue, reloadTiers, reloadClaims]);

  useEffect(() => {
    if (!userId) return;
    void load();

    // Ao vivo: status e rastreio do admin, peças editadas e vendas novas aparecem sem recarregar.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(uniqueChannelName(`awards-${userId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_claims", filter: `user_id=eq.${userId}` }, () => { void reloadClaims(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "award_tiers" }, () => { void reloadTiers(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => { void reloadRevenue(); }, 2500);
      })
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [userId, load, reloadClaims, reloadTiers, reloadRevenue]);

  const awards = useMemo(() => mergeTiers(tiers), [tiers]);

  const journey = useMemo(() => {
    const unlocked = awards.filter((a) => revenue >= a.value).length;
    const next = nextAward(awards, revenue);
    const ready = awards.filter((a) => pieceState(a, revenue, claims).kind === "ready");
    return { unlocked, next, ready };
  }, [awards, revenue, claims]);

  return { user, revenue, revenueCapped, claims, setClaims, loading, errors, reload: load, awards, ...journey };
}
