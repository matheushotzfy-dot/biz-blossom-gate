import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { analyticsSchema, type AnalyticsFilters } from "./analyticsModel";
import { dateKey, overviewSchema } from "./overviewModel";

export function useAnalytics(range: { from: Date; to: Date }, filters: AnalyticsFilters) {
  const { user } = useAuth();
  const from = dateKey(range.from), to = dateKey(range.to);
  const details = useQuery({
    queryKey: ["admin-analytics-detail", user?.id, from, to, filters], enabled: Boolean(user), staleTime: 60000, retry: 1,
    queryFn: async ({ signal }) => {
      const res = await supabase.rpc("get_admin_analytics_detail", { _from: from, _to: to, _page: filters.page, _search: filters.search, _selling_only: filters.sellingOnly, _sort: filters.sort }).abortSignal(signal);
      if (res.error) throw res.error;
      return analyticsSchema.parse(res.data);
    },
  });
  const overview = useQuery({
    queryKey: ["admin-analytics-overview", user?.id, from, to], enabled: Boolean(user), staleTime: 60000, retry: 1,
    queryFn: async ({ signal }) => {
      const res = await supabase.rpc("get_admin_overview_metrics", { _from: from, _to: to }).abortSignal(signal);
      if (res.error) throw res.error;
      return overviewSchema.parse(res.data);
    },
  });
  return { details, overview };
}