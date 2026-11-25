import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SUPPORT_KEY = ["admin-support"] as const;
export const LIST_KEY = [...SUPPORT_KEY, "list"] as const;
export const TICKET_KEY = [...SUPPORT_KEY, "ticket"] as const;

/** Chama uma função do banco e lança o erro (a tela mostra a mensagem em português). */
export async function callRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(name as never, (args ?? {}) as never);
  if (error) throw error;
  return data;
}

export function useRefreshSupport() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: LIST_KEY });
    void qc.invalidateQueries({ queryKey: TICKET_KEY });
  };
}
