import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

    const invalidate = (keys: string[]) => {
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k, uid] }));
    };

    const channel = supabase
      .channel(`rt-user-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${uid}` },
        () => invalidate(["transactions", "ledger_balance"])
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_ledger", filter: `user_id=eq.${uid}` },
        () => invalidate(["ledger_balance", "transactions"])
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals", filter: `user_id=eq.${uid}` },
        () => invalidate(["withdrawals", "ledger_balance"])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}

export function RealtimeSync() {
  useRealtimeSync();
  return null;
}
