import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

// Shared staleTime — data stays "fresh" for 2 min, no refetch on navigation
const STALE_TIME = 2 * 60 * 1000;

type PixKey = { id: string; key_type: string; key_value: string; created_at: string; user_id: string };

export function useProducts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["products", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data || []) as Tables<"products">[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data || []) as Tables<"transactions">[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useWithdrawals(limit?: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["withdrawals", user?.id, limit],
    queryFn: async () => {
      let q = supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data } = await q;
      return (data || []) as Tables<"withdrawals">[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function usePixKeys() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pix_keys", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pix_keys")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      return (data || []) as PixKey[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useBankAccounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bank_accounts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      return (data || []) as Tables<"bank_accounts">[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useCoupons() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coupons", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as Tables<"coupons">[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

/** Prefetch all common data on layout mount */
export function usePrefetchDashboardData() {
  const { user } = useAuth();
  const qc = useQueryClient();

  if (user?.id) {
    qc.prefetchQuery({
      queryKey: ["products", user.id],
      queryFn: async () => {
        const { data } = await supabase.from("products").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        return (data || []) as Tables<"products">[];
      },
      staleTime: STALE_TIME,
    });
    qc.prefetchQuery({
      queryKey: ["transactions", user.id],
      queryFn: async () => {
        const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        return (data || []) as Tables<"transactions">[];
      },
      staleTime: STALE_TIME,
    });
    qc.prefetchQuery({
      queryKey: ["withdrawals", user.id, 10],
      queryFn: async () => {
        const { data } = await supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
        return (data || []) as Tables<"withdrawals">[];
      },
      staleTime: STALE_TIME,
    });
    qc.prefetchQuery({
      queryKey: ["pix_keys", user.id],
      queryFn: async () => {
        const { data } = await supabase.from("pix_keys").select("*").eq("user_id", user.id).order("created_at");
        return (data || []) as PixKey[];
      },
      staleTime: STALE_TIME,
    });
    qc.prefetchQuery({
      queryKey: ["bank_accounts", user.id],
      queryFn: async () => {
        const { data } = await supabase.from("bank_accounts").select("*").eq("user_id", user.id).order("created_at");
        return (data || []) as Tables<"bank_accounts">[];
      },
      staleTime: STALE_TIME,
    });
  }
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return (keys?: string[]) => {
    const invalidateKeys = keys || ["products", "transactions", "withdrawals", "pix_keys", "bank_accounts", "coupons"];
    invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  };
}
