import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformPauses { payments: boolean; withdrawals: boolean }

/** Lê o que o banco devolve; qualquer coisa diferente de `true` conta como liberado. */
export function parsePauses(raw: unknown): PlatformPauses {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return { payments: r.payments === true, withdrawals: r.withdrawals === true };
}

/**
 * Pausas de emergência que a equipe liga no admin (Ferramentas). Serve só para avisar com antecedência:
 * quem barra de verdade é o banco, então uma falha aqui deixa tudo "liberado" na tela sem abrir brecha.
 */
export function usePlatformPauses(): PlatformPauses {
  const q = useQuery({
    queryKey: ["platform-pauses"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_pauses" as never);
      if (error) throw error;
      return parsePauses(data);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  return q.data ?? { payments: false, withdrawals: false };
}
