import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/hooks/useAuth";

/**
 * Global realtime sync.
 * Subscribes to the current user's transactions, financial_ledger and withdrawals
 * and invalidates the related React Query caches so the UI updates live
 * (Dashboard, Vendas, Extrato, Saldo) without manual refresh.
 */
export function useRealtimeSync() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    const pendingKeys = new Set<string>();
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

    const flushInvalidations = () => {
      pendingKeys.forEach((key) => {
        void qc.invalidateQueries({ queryKey: [key, uid], exact: false });
      });
      pendingKeys.clear();
      invalidateTimer = null;
    };

    const invalidate = (keys: string[]) => {
      keys.forEach((key) => pendingKeys.add(key));
      if (invalidateTimer) return;
      invalidateTimer = setTimeout(flushInvalidations, 400);
    };


    const channel = supabase
      .channel(uniqueChannelName(`rt-user-${uid}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${uid}` },
        () => invalidate(["transactions", "ledger_balance", "dashboard_stats"])
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_ledger", filter: `user_id=eq.${uid}` },
        () => invalidate(["ledger_balance", "transactions", "dashboard_stats"])
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals", filter: `user_id=eq.${uid}` },
        () => invalidate(["withdrawals", "ledger_balance"])
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "disputes", filter: `seller_user_id=eq.${uid}` },
        () => invalidate(["disputes", "dashboard_stats"])
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          invalidate(["transactions", "ledger_balance", "dashboard_stats", "withdrawals", "disputes"]);
        }
      });

    return () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}

export function RealtimeSync() {
  useRealtimeSync();
  return null;
}
