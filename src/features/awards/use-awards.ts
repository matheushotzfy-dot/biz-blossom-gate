import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AWARDS } from "./awards-data";

export interface RewardClaim {
  id: string;
  tier_id: string;
  tier_label: string | null;
  status: string;
  created_at: string;
}

export function useAwards() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState(0);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed"),
      supabase.from("reward_claims").select("id, tier_id, tier_label, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]).then(([transactionsResult, claimsResult]) => {
      if (!active) return;
      setFailed(Boolean(transactionsResult.error || claimsResult.error));
      const total = (transactionsResult.data ?? []).reduce((sum, item) => sum + Number(item.net_amount ?? 0), 0);
      setRevenue(total);
      setClaims((claimsResult.data ?? []) as RewardClaim[]);
      setLoading(false);
    }).catch(() => {
      if (active) { setFailed(true); setLoading(false); }
    });
    return () => { active = false; };
  }, [user?.id]);

  const journey = useMemo(() => {
    const unlocked = AWARDS.filter((award) => revenue >= award.value).length;
    const next = AWARDS.find((award) => revenue < award.value) ?? AWARDS[AWARDS.length - 1];
    const targetProgress = Math.min((revenue / next.value) * 100, 100);
    return { unlocked, next, targetProgress };
  }, [revenue]);

  return { user, revenue, claims, setClaims, loading, failed, ...journey };
}