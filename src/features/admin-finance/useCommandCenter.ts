import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { commandCenterSchema } from "./commandCenterModel";
import { dateKey, overviewSchema } from "./overviewModel";

export function useCommandCenter(dateRange: { from: Date; to: Date }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-command-center", user?.id, dateRange.from.toISOString(), dateRange.to.toISOString()],
    enabled: Boolean(user), staleTime: 30000, refetchInterval: 60000,
    refetchIntervalInBackground: false, retry: 1,
    queryFn: async ({ signal }) => {
      const [operations, metrics] = await Promise.all([
        supabase.rpc("get_admin_command_center", { _from: dateRange.from.toISOString(), _to: dateRange.to.toISOString() }).abortSignal(signal),
        supabase.rpc("get_admin_overview_metrics", { _from: dateKey(dateRange.from), _to: dateKey(dateRange.to) }).abortSignal(signal),
      ]);
      if (operations.error) throw operations.error;
      if (metrics.error) throw metrics.error;
      return { operations: commandCenterSchema.parse(operations.data), metrics: overviewSchema.parse(metrics.data) };
    },
  });
}