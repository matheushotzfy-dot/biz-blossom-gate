import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const NOTIFS_KEY = ["admin-notifications"] as const;
export const BATCH_KEY = ["admin-notification-batch"] as const;
export const AUDIENCES_KEY = ["admin-notification-audiences"] as const;

/** Chama uma função do banco e lança o erro (a tela mostra a mensagem em português). */
export async function callRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(name as never, (args ?? {}) as never);
  if (error) throw error;
  return data;
}

export function useRefreshNotifications() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: NOTIFS_KEY });
    void qc.invalidateQueries({ queryKey: BATCH_KEY });
    void qc.invalidateQueries({ queryKey: AUDIENCES_KEY });
  };
}
