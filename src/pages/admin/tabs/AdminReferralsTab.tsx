import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Search, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumPanel, PremiumEmpty, premiumTable } from "./AdminPremium";
import type { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  profiles?: Tables<"profiles">[];
  fmtCurrency: (v: number) => string;
}

type Referral = Tables<"referrals">;
const PAGE_SIZE = 50;
const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  qualified: "Qualificado",
  paid: "Pago",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
};
const STATUS_TONE: Record<string, string> = {
  pending: "border-warning/20 bg-warning/10 text-warning",
  qualified: "border-info/20 bg-info/10 text-info",
  paid: "border-success/20 bg-success/10 text-success",
  rejected: "border-destructive/20 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted/30 text-muted-foreground",
};

export default function AdminReferralsTab({ profiles = [], fmtCurrency }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Referral[]>([]);
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
    let query = supabase.from("referrals").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (debouncedSearch) query = query.ilike("referred_email", `%${debouncedSearch}%`);
    const { data, error: err, count } = await query.range(from, to);
    if (err) { setError(err.message); setLoading(false); return; }
    setItems(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const userLabel = (userId: string | null) => {
    if (!userId) return "—";
    const p = profileMap.get(userId);
    return p ? (p.full_name || p.email || userId.slice(0, 8)) : userId.slice(0, 8) + "…";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Crescimento"
        title="Indicações"
        subtitle="Listagem de indicações realizadas pelos vendedores da plataforma."
        status={{ tone: "info", label: `${total} indicação(ões)`, pulse: false }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por e-mail indicado..."
            className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 bg-muted/30 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary/30"
        >
          <option value="all">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="qualified">Qualificado</option>
          <option value="paid">Pago</option>
          <option value="rejected">Rejeitado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Erro ao carregar indicações: {error}</span>
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/10">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      )}

      <PremiumPanel
        eyebrow="Indicações"
        title={`Resultados · ${total}`}
        icon={Gift}
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
          <PremiumEmpty icon={Gift} title="Nenhuma indicação encontrada" subtitle="Ajuste os filtros ou aguarde novas indicações." />
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  <th className={premiumTable.th}>Indicador</th>
                  <th className={premiumTable.th}>E-mail indicado</th>
                  <th className={premiumTable.th}>Usuário indicado</th>
                  <th className={premiumTable.th}>Recompensa</th>
                  <th className={premiumTable.th}>Status</th>
                  <th className={premiumTable.th}>Pago em</th>
                  <th className={premiumTable.th}>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className={premiumTable.row}>
                    <td className={premiumTable.td}><span className="font-semibold text-foreground">{userLabel(r.referrer_user_id)}</span></td>
                    <td className={premiumTable.td}><span className="text-muted-foreground">{r.referred_email}</span></td>
                    <td className={premiumTable.td}><span className="text-foreground/80">{userLabel(r.referred_user_id)}</span></td>
                    <td className={premiumTable.td}><span className="font-semibold text-foreground tabular-nums">{fmtCurrency(Number(r.reward_amount))}</span></td>
                    <td className={premiumTable.td}>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${STATUS_TONE[r.status] || "border-border bg-muted/30 text-muted-foreground"}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className={premiumTable.td}><span className="text-muted-foreground">{r.paid_at ? dateFmt.format(new Date(r.paid_at)) : "—"}</span></td>
                    <td className={premiumTable.td}><span className="text-muted-foreground">{dateFmt.format(new Date(r.created_at))}</span></td>
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
