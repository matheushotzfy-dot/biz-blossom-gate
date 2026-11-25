import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Person = Pick<Tables<"profiles">, "user_id" | "full_name" | "email" | "created_at" | "seller_type">;
const MAX_LOOKUP = 100;

/**
 * Nomes de contas para as telas do admin. O painel só carrega os perfis mais novos;
 * quem não estiver na lista é buscado sob demanda (até 100 por vez) em vez de aparecer como "—".
 */
export function usePeople(loaded: Tables<"profiles">[], wantedIds: (string | null | undefined)[]) {
  const known = useMemo(() => new Map<string, Person>(loaded.map((p) => [p.user_id, p])), [loaded]);
  const missing = useMemo(() => {
    const need = new Set<string>();
    for (const id of wantedIds) if (id && !known.has(id)) need.add(id);
    return [...need].sort().slice(0, MAX_LOOKUP);
  }, [wantedIds, known]);
  const extra = useQuery({
    queryKey: ["people-lookup", missing.join(",")],
    enabled: missing.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email, created_at, seller_type").in("user_id", missing);
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });
  const people = useMemo(() => {
    const m = new Map(known);
    for (const p of extra.data ?? []) m.set(p.user_id, p);
    return m;
  }, [known, extra.data]);
  const nameOf = useCallback((id: string | null | undefined) => {
    if (!id) return "—";
    const p = people.get(id);
    return p?.full_name || p?.email || `Conta ${id.slice(0, 8)}`;
  }, [people]);
  const emailOf = useCallback((id: string) => people.get(id)?.email || "", [people]);
  const createdAtOf = useCallback((id: string) => people.get(id)?.created_at, [people]);
  return { people, nameOf, emailOf, createdAtOf, lookupFailed: extra.isError, retry: () => void extra.refetch() };
}
