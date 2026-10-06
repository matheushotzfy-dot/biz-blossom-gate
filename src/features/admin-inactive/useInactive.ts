import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { inactiveSchema, type InactiveFilters } from "./model";
export function useInactive(filters: InactiveFilters) {
 const { user } = useAuth();
 return useQuery({ queryKey: ["admin-inactive", user?.id, filters], enabled: Boolean(user), staleTime: 30000, retry: 1,
 queryFn: async ({ signal }) => { const { data, error } = await supabase.rpc("get_admin_inactive_sellers_page", { _days: filters.days, _page: filters.page, _search: filters.search, _sort: filters.sort }).abortSignal(signal); if (error) throw error; return inactiveSchema.parse(data); } });
}
