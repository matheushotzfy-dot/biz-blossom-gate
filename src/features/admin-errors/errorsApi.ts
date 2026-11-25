import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/friendlyError";

export const ERRORS_KEY = ["admin-errors"] as const;
export const ERROR_DETAIL_KEY = ["admin-error-detail"] as const;

/** Chama uma função do banco e lança o erro (a tela mostra a mensagem em português). */
export async function callRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(name as never, (args ?? {}) as never);
  if (error) throw error;
  return data;
}

export function useRefreshErrors() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ERRORS_KEY });
    void qc.invalidateQueries({ queryKey: ERROR_DETAIL_KEY });
  };
}

/** Resolver ou reabrir um erro. Não pede senha: é só marcar que alguém olhou (não apaga nada). */
export function useSetResolved() {
  const refresh = useRefreshErrors();
  return useMutation({
    mutationFn: async (v: { id: string; resolved: boolean }) => {
      await callRpc("admin_set_error_resolved", { _id: v.id, _resolved: v.resolved });
      return v.resolved;
    },
    onSuccess: (resolved) => {
      toast.success(resolved ? "Erro marcado como resolvido." : "Erro reaberto.");
      refresh();
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível atualizar o erro. Nada mudou.")),
  });
}
