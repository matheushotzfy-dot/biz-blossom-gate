import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

const STALE_TIME = 2 * 60 * 1000;

/**
 * Live ledger balance with shared cache + 15s refetch.
 * Replaces ad-hoc setInterval(fetchBalance, 15000) in Dashboard/Extrato.
 */
export function useLedgerBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ledger_balance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ledger_balance", { _user_id: user!.id });
      if (error) throw error;
      return Number(data ?? 0);
    },
    enabled: !!user?.id,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: false,
  });
}

type PixKey = {
  id: string;
  key_type: string;
  key_value: string;
  created_at: string;
  user_id?: string;
  key_value_masked?: string | null;
};
type CourseWithModules = Tables<"courses"> & {
  modules: Array<{ id: string; title: string; banner_url: string | null; lessons: Array<{ id: string }> }> | null;
};

export function useProducts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["products", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
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
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
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
      const { data, error } = await q;
      if (error) throw error;
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
      const { data, error } = await supabase.rpc("reveal_own_pix_keys");
      if (error) throw error;
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
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
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
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Tables<"coupons">[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useExpenses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user!.id)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return (data || []) as Tables<"expenses">[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useWebhooks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["webhooks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_configs_safe")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Tables<"webhook_configs_safe">[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useAppIntegrations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["app_integrations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_integrations_safe")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Tables<"app_integrations_safe">[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useDisputes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["disputes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disputes_seller")
        .select("*")
        .eq("seller_user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Tables<"disputes_seller">[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}


export function useCourses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["courses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, modules ( id, title, banner_url, lessons ( id ) )")
        .eq("user_id", user!.id)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as CourseWithModules[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useFees() {
  return useQuery({
    queryKey: ["fees"],
    queryFn: async () => {
      // `fees` é restrita a admins; sellers leem via RPC segura (nome + valor).
      const { data, error } = await supabase.rpc("get_platform_fees");
      if (error) throw error;
      return (data || []) as { name: string; value: number }[];
    },
    staleTime: 5 * 60 * 1000, // fees rarely change
  });
}

/** Prefetch all common data on layout mount — wrapped in useEffect to avoid work on every render */
export function usePrefetchDashboardData() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    qc.prefetchQuery({
      queryKey: ["products", uid],
      queryFn: async () => {
        const { data, error } = await supabase.from("products").select("*").eq("user_id", uid).is("deleted_at", null).order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as Tables<"products">[];
      },
      staleTime: STALE_TIME,
    });
    qc.prefetchQuery({
      queryKey: ["transactions", uid],
      queryFn: async () => {
        const { data, error } = await supabase.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as Tables<"transactions">[];
      },
      staleTime: STALE_TIME,
    });
    qc.prefetchQuery({
      queryKey: ["withdrawals", uid, 10],
      queryFn: async () => {
        const { data, error } = await supabase.from("withdrawals").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(10);
        if (error) throw error;
        return (data || []) as Tables<"withdrawals">[];
      },
      staleTime: STALE_TIME,
    });
    qc.prefetchQuery({
      queryKey: ["fees"],
      queryFn: async () => {
        const { data, error } = await supabase.from("fees").select("*").order("created_at");
        if (error) throw error;
        return (data || []) as Tables<"fees">[];
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [user?.id, qc]);
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useCallback((keys?: string[]) => {
    const invalidateKeys = keys || ["products", "transactions", "withdrawals", "pix_keys", "bank_accounts", "coupons", "expenses", "webhooks", "app_integrations", "courses", "fees", "ledger_balance"];
    invalidateKeys.forEach(k =>
      // exact:false matches both ["k"] and ["k", uid, ...] cache entries
      qc.invalidateQueries({ queryKey: [k], exact: false })
    );
  }, [qc, user?.id]);
}
