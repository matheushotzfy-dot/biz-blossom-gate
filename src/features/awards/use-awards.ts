import { useCallback, useEffect, useMemo, useState } from "react";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/hooks/useAuth";
import { AWARDS, type AwardItem } from "./awards-data";

export interface RewardClaim {
  id: string;
  tier_id: string;
  tier_label: string | null;
  status: string;
  created_at: string;
  tracking_code?: string | null;
  tracking_url?: string | null;
  tracking_carrier?: string | null;
  admin_notes?: string | null;
}

interface TierRow {
  id: string; title: string; tier: string; value: number; description: string;
  phrase: string; rewards: string[]; image_url: string | null; sort_order: number; is_active: boolean;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const compact = (v: number) =>
  v >= 1_000_000 ? `R$ ${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `R$ ${+(v / 1000).toFixed(0)}K` : `R$ ${v}`;

/** Admin-managed tiers merged over the bundled defaults (defaults keep art + copy as fallback). */
function mergeTiers(rows: TierRow[]): AwardItem[] {
  if (!rows.length) return AWARDS;
  return rows
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.value - b.value)
    .map((row, i) => {
      const base = AWARDS.find((a) => a.id === row.id);
      return {
        id: row.id,
        value: Number(row.value),
        label: compact(Number(row.value)),
        tier: row.tier || base?.tier || "",
        roman: ROMAN[i] ?? String(i + 1),
        title: row.title,
        description: row.description || base?.description || "",
        image: row.image_url || base?.image || AWARDS[Math.min(i, AWARDS.length - 1)].image,
        rewards: row.rewards?.length ? row.rewards : base?.rewards ?? [],
        phrase: row.phrase || base?.phrase || "",
        reference: base?.reference ?? `VNX-${row.id.toUpperCase()}`,
        icon: base?.icon ?? Award,
      };
    });
}

export function useAwards() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState(0);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadClaims = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("reward_claims")
      .select("id, tier_id, tier_label, status, created_at, tracking_code, tracking_url, tracking_carrier, admin_notes")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setClaims((data ?? []) as RewardClaim[]);
  }, [user?.id]);

  const load = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    setFailed(false);
    return Promise.all([
      supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed").eq("is_simulated", false),
      supabase.from("award_tiers").select("*"),
      loadClaims(),
    ]).then(([tx, tierRes]) => {
      setFailed(Boolean(tx.error));
      setRevenue((tx.data ?? []).reduce((s, t) => s + Number(t.net_amount ?? 0), 0));
      setTiers((tierRes.data ?? []) as TierRow[]);
      setLoading(false);
    }).catch(() => { setFailed(true); setLoading(false); });
  }, [user?.id, loadClaims]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void load();

    // Live: admin status/tracking changes and tier edits show up without reload.
    const channel = supabase
      .channel(uniqueChannelName(`awards-${user.id}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_claims", filter: `user_id=eq.${user.id}` }, () => { void loadClaims(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "award_tiers" }, async () => {
        const { data } = await supabase.from("award_tiers").select("*");
        setTiers((data ?? []) as TierRow[]);
      })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [user?.id, loadClaims, load]);

  const awards = useMemo(() => mergeTiers(tiers), [tiers]);

  const journey = useMemo(() => {
    const unlocked = awards.filter((a) => revenue >= a.value).length;
    const next = awards.find((a) => revenue < a.value) ?? awards[awards.length - 1];
    const targetProgress = Math.min((revenue / next.value) * 100, 100);
    return { unlocked, next, targetProgress };
  }, [revenue, awards]);

  return { user, revenue, claims, setClaims, loading, failed, reload: load, awards, ...journey };
}
