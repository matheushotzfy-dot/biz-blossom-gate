import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw as RefreshIcon, Search, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumPanel, PremiumEmpty, premiumTable } from "./AdminPremium";
import type { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  profiles?: Tables<"profiles">[];
  fmtCurrency: (v: number) => string;
}

type Subscription = Tables<"subscriptions">;
const PAGE_SIZE = 50;
const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Em teste",
  past_due: "Inadimplente",
  canceled: "Cancelada",
  cancelled: "Cancelada",
  paused: "Pausada",
  expired: "Expirada",
};
const STATUS_TONE: Record<string, string> = {
  active: "border-success/20 bg-success/10 text-success",
  trialing: "border-info/20 bg-info/10 text-info",
  past_due: "border-warning/20 bg-warning/10 text-warning",
  canceled: "border-destructive/20 bg-destructive/10 text-destructive",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
  paused: "border-border bg-muted/30 text-muted-foreground",
  expired: "border-border bg-muted/30 text-muted-foreground",
};

export default function AdminSubscriptionsTab({ profiles = [], fmtCurrency }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(0); }, 300);
    return () => window.clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(0); }, [statusFilter]);

  const profileMap = useMemo(() => {
    const m = new Map<string, Tables<"profiles">>();
    for (const p of profiles) m.set(p.user_id, p);
    return m;
  }, [profiles]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase.from("subscriptions").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (debouncedSearch) {
      query = query.or(`subscriber_email.ilike.%${debouncedSearch}%,subscriber_name.ilike.%${debouncedSearch}%`);
    }
    const { data, error: err, count } = await query.range(from, to);
    if (err) { setError(err.message); setLoading(false); return; }
    setItems(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sellerLabel = (userId: string) => {
    const p = profileMap.get(userId);
    return p ? (p.full_name || p.email || userId.slice(0, 8)) : userId.slice(0, 8) + "…";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Receita Recorrente"
        title="Assinaturas"
        subtitle="Listagem de assinaturas ativas e históricas na plataforma."
        status={{ tone: "info", label: `${total} assinatura(s)`, pulse: false }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por assinante (nome ou e-mail)..."
            className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 bg-muted/30 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary/30"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativa</option>
          <option value="trialing">Em teste</option>
          <option value="past_due">Inadimplente</option>
          <option value="paused">Pausada</option>
          <option value="canceled">Cancelada</option>
          <option value="expired">Expirada</option>
        </select>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Erro ao carregar assinaturas: {error}</span>
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/10">
            <RefreshIcon className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      )}

      <PremiumPanel
        eyebrow="Assinaturas"
        title={`Resultados · ${total}`}
        icon={RefreshIcon}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-40 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-40 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <PremiumEmpty icon={RefreshIcon} title="Nenhuma assinatura encontrada" subtitle="Ajuste os filtros para ver mais resultados." />
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  <th className={premiumTable.th}>Assinante</th>
                  <th className={premiumTable.th}>Vendedor</th>
                  <th className={premiumTable.th}>Status</th>
                  <th className={premiumTable.th}>Ciclos</th>
                  <th className={premiumTable.th}>Próxima cobrança</th>
                  <th className={premiumTable.th}>Último pagamento</th>
                  <th className={premiumTable.th}>Criada em</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className={premiumTable.row}>
                    <td className={premiumTable.td}>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{s.subscriber_name || "—"}</span>
                        <span className="text-[11px] text-muted-foreground">{s.subscriber_email}</span>
                      </div>
                    </td>
                    <td className={premiumTable.td}><span className="text-foreground/80">{sellerLabel(s.seller_user_id)}</span></td>
                    <td className={premiumTable.td}>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${STATUS_TONE[s.status] || "border-border bg-muted/30 text-muted-foreground"}`}>
                        {STATUS_LABEL[s.status] || s.status}
                      </span>
                    </td>
                    <td className={premiumTable.td}><span className="text-muted-foreground tabular-nums">{s.completed_cycles}{s.max_cycles ? ` / ${s.max_cycles}` : ""}</span></td>
                    <td className={premiumTable.td}><span className="text-muted-foreground">{s.next_charge_at ? dateFmt.format(new Date(s.next_charge_at)) : "—"}</span></td>
                    <td className={premiumTable.td}><span className="text-muted-foreground">{s.last_payment_at ? dateFmt.format(new Date(s.last_payment_at)) : "—"}</span></td>
                    <td className={premiumTable.td}><span className="text-muted-foreground">{dateFmt.format(new Date(s.created_at))}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumPanel>
    </div>
  );
}
