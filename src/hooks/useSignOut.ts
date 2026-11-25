import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sair da conta do painel. Limpa o cache de dados antes de voltar ao login, para que a
 * próxima conta aberta neste navegador não veja nada da anterior. Se o servidor não
 * responder, o aparelho sai do mesmo jeito (a sessão local é descartada).
 */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    try { await supabase.auth.signOut(); } catch { /* sem rede: a sessão local já foi descartada */ }
    queryClient.clear();
    navigate("/auth", { replace: true });
  }, [navigate, queryClient]);
}
