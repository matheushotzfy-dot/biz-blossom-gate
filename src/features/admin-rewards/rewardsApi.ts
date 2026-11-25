import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const REWARDS_KEY = ["admin-rewards"] as const;
export const LIST_KEY = [...REWARDS_KEY, "list"] as const;
export const DETAIL_KEY = [...REWARDS_KEY, "detail"] as const;
export const TIERS_KEY = [...REWARDS_KEY, "tiers"] as const;

/** Chama uma função do banco e lança o erro (a tela mostra a mensagem em português). */
export async function callRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(name as never, (args ?? {}) as never);
  if (error) throw error;
  return data;
}

export function useRefreshRewards() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: LIST_KEY });
    void qc.invalidateQueries({ queryKey: DETAIL_KEY });
    void qc.invalidateQueries({ queryKey: TIERS_KEY });
  };
}

/** Os dados que o seller vê (pedidos, peças) mudam junto: quem está com a página aberta atualiza sozinho pelo realtime. */
export interface SetClaimArgs { id: string; status?: string; carrier?: string | null; code?: string | null; url?: string | null; message?: string | null }

export const setClaim = (a: SetClaimArgs) =>
  callRpc("admin_set_reward_claim", {
    _id: a.id, _status: a.status ?? null, _carrier: a.carrier ?? null, _code: a.code ?? null, _url: a.url ?? null, _message: a.message ?? null,
  });
