import { useQueryClient } from "@tanstack/react-query";
import { callRpc } from "@/features/admin-race/raceApi";

export { callRpc };

export const GOALS_KEY = ["admin-goals"] as const;
export const LIST_KEY = [...GOALS_KEY, "list"] as const;
export const DETAIL_KEY = [...GOALS_KEY, "detail"] as const;

export function useRefreshGoals() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: LIST_KEY });
    void qc.invalidateQueries({ queryKey: DETAIL_KEY });
  };
}
