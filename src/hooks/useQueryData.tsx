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

/**
 * Lista de transações do usuário.
 * IMPORTANTE: contas com alto volume (100k+ vendas) não podem baixar tudo para o
 * navegador — a query é limitada às mais recentes e os totais agregados vêm da RPC
 * `get_seller_dashboard_stats` (cálculo no servidor).
 */
export function useTransactions(limit = 500) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transactions", user?.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as Tables<"transactions">[];
    },
    enabled: !!user?.id,
    staleTime: 15 * 1000,
    refetchInterval: 45 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Monta o filtro de busca da lista de vendas.
 * - UUID completo -> igualdade direta (usa a PK).
 * - Prefixo hexadecimal (ex.: "4b2a" colado do início do ID) -> range na PK,
 *   já que um prefixo de UUID define um intervalo contíguo na ordenação uuid.
 * - Qualquer termo -> ilike em id externo, nome e e-mail do cliente.
 */
export function buildTransactionSearchFilter(rawTerm: string): string {
  const safe = rawTerm.replace(/[%,()]/g, "").trim();
  const clauses: string[] = [];

  const hex = safe.replace(/-/g, "").toLowerCase();
  if (/^[0-9a-f]{2,32}$/.test(hex)) {
    const lo = hex.padEnd(32, "0");
    const hi = hex.padEnd(32, "f");
    const fmt = (h: string) =>
      `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    clauses.push(`and(id.gte.${fmt(lo)},id.lte.${fmt(hi)})`);
  }

  clauses.push(
    `external_id.ilike.%${safe}%`,
    `customer_name.ilike.%${safe}%`,
    `customer_email.ilike.%${safe}%`,
  );

  return clauses.join(",");
}

export type TransactionsPageParams = {
  from: Date;
  to: Date;
  page: number;
  pageSize: number;
  search?: string;
};

/**
 * Página de transações do seller resolvida no servidor (filtro por período + busca).
 * Evita divergência entre a lista e os agregados: ambos passam a olhar a mesma janela
 * de datas, sem o teto de 500 linhas no cliente.
 */
export function useTransactionsPage({ from, to, page, pageSize, search }: TransactionsPageParams) {
  const { user } = useAuth();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const term = (search ?? "").trim();

  return useQuery({
    queryKey: ["transactions_page", user?.id, fromIso, toIso, page, pageSize, term],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      let query = supabase
        .from("transactions")
        .select("*", { count: "exact" })
        .eq("user_id", user!.id)
        .gte("created_at", fromIso)
        .lte("created_at", toIso);

      if (term) {
        if (UUID_RE.test(term)) {
          query = query.eq("id", term);
        } else {
          const safe = term.replace(/[%,()]/g, "");
          query = query.or(`customer_name.ilike.%${safe}%,customer_email.ilike.%${safe}%`);
        }
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      return { rows: (data || []) as Tables<"transactions">[], total: count ?? 0 };
    },
    enabled: !!user?.id,
    staleTime: 15 * 1000,
    refetchInterval: 45 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });
}

/**
 * Exportação do período sem teto de linhas: pagina no servidor (keyset por
 * created_at + id) até esgotar o período. Suporta contas com milhões de vendas.
 */
export async function fetchTransactionsForExport(
  userId: string,
  from: Date,
  to: Date,
  onProgress?: (loaded: number) => void,
): Promise<Tables<"transactions">[]> {
  const CHUNK = 1000;
  const out: Tables<"transactions">[] = [];
  let cursor = to.toISOString();
  let guardId: string | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", from.toISOString())
      .lte("created_at", cursor)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(CHUNK);

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as Tables<"transactions">[];
    // Remove sobreposição do cursor (mesmo timestamp em páginas consecutivas).
    const fresh = guardId ? rows.filter((r) => r.id !== guardId) : rows;
    const seen = new Set(out.map((r) => r.id));
    for (const r of fresh) if (!seen.has(r.id)) out.push(r);

    onProgress?.(out.length);
    if (rows.length < CHUNK) break;

    const last = rows[rows.length - 1];
    if (!last?.created_at || last.created_at === cursor && last.id === guardId) break;
    cursor = last.created_at;
    guardId = last.id;
  }

  return out;
}

/** Receita líquida aprovada por produto (agregada no servidor). */
export function useProductRevenue() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["product_revenue", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_product_revenue");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: { product_id: string; net_revenue: number }) => {
        map[r.product_id] = Number(r.net_revenue) || 0;
      });
      return map;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
}

/** Receita líquida e quantidade aprovada de um mês (`YYYY-MM`), agregadas no servidor. */
export function useMonthRevenue(month: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["month_revenue", user?.id, month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_month_revenue", { _month: month });
      if (error) throw error;
      const r = (data ?? {}) as { revenue?: number | string; count?: number | string };
      return { revenue: Number(r.revenue ?? 0), count: Number(r.count ?? 0) };
    },
    enabled: !!user?.id && /^\d{4}-\d{2}$/.test(month),
    staleTime: 60 * 1000,
  });
}

export type AnticipationSummary = {
  retained_total: number;
  eligible_count: number;
  calc_count: number;
  calc_total: number;
  calc_fee: number;
  calc_net: number;
};

/** Resumo de antecipação calculado no servidor (sem baixar transações). */
export function useAnticipationSummary(maxDays: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["anticipation_summary", user?.id, maxDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_anticipation_summary", { _max_days: maxDays });
      if (error) throw error;
      const r = (data ?? {}) as Partial<Record<keyof AnticipationSummary, number | string>>;
      const n = (v: number | string | undefined) => Number(v ?? 0);
      return {
        retained_total: n(r.retained_total),
        eligible_count: n(r.eligible_count),
        calc_count: n(r.calc_count),
        calc_total: n(r.calc_total),
        calc_fee: n(r.calc_fee),
        calc_net: n(r.calc_net),
      } as AnticipationSummary;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}


export type DashboardBucket = "hour" | "day" | "month";

export type DashboardStats = {
  current: {
    total_count: number;
    approved_count: number;
    revenue: number;
    net_revenue: number;
    unique_customers: number;
    chargeback_count: number;
    pix_total: number; pix_approved: number;
    card_total: number; card_approved: number;
    boleto_total: number; boleto_approved: number;
  };
  previous: { approved_count: number; revenue: number };
  series: Array<{ bucket: string; revenue: number; count: number }>;
  global: { pending_balance: number; received_today: number; disputed_amount: number };
};

/**
 * Agregados do dashboard calculados no banco (suporta centenas de milhares de vendas).
 */
export function useDashboardStats(from: Date, to: Date, bucket: DashboardBucket) {
  const { user } = useAuth();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery({
    queryKey: ["dashboard_stats", user?.id, fromIso, toIso, bucket],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_dashboard_stats", {
        _from: fromIso,
        _to: toIso,
        _bucket: bucket,
      });
      if (error) throw error;
      return data as unknown as DashboardStats;
    },
    enabled: !!user?.id,
    staleTime: 10 * 1000,
    refetchInterval: 45 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
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
        const { data, error } = await supabase.rpc("get_platform_fees");
        if (error) throw error;
        return (data || []) as { name: string; value: number }[];
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
