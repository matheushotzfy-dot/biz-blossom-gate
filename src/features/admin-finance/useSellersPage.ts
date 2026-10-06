import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { dateKey } from "./overviewModel";
import { sellersPageSchema, type SellerFilters } from "./sellersModel";

export function useSellersPage(range: { from: Date; to: Date }, filters: SellerFilters, enabled: boolean) {
  const { user } = useAuth();
  const from = dateKey(range.from), to = dateKey(range.to);
  return useQuery({
    queryKey: ["admin-sellers-page", user?.id, from, to, filters], enabled: enabled && Boolean(user), staleTime: 30000, retry: 1,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("get_admin_sellers_page", {
        _from: from, _to: to, _page: filters.page, _search: filters.search, _state: filters.state,
        _risk: filters.risk, _sort: filters.sort, _selling_only: filters.sellingOnly,
      }).abortSignal(signal);
      if (error) throw error;
      return sellersPageSchema.parse(data);
    },
  });
}