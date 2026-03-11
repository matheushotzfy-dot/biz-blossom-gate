import { useState, useMemo, useCallback } from "react";
import { Search, Download, Filter, ArrowUpDown, CreditCard, Smartphone, FileText, ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import { AdminPanel, PanelTitle, AdminKpi } from "./AdminOverviewTab";

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  fmtCurrency: (v: number) => string;
}

const PAGE_SIZE = 80;

const _dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const _dateCache = new Map<string, string>();
const fmtDateCached = (d: string) => {
  let v = _dateCache.get(d);
  if (!v) { v = _dateFmt.format(new Date(d)); _dateCache.set(d, v); }
  return v;
};

export default function AdminTransactionsTab({ transactions, profiles, products, fmtCurrency }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [sortField, setSortField] = useState<"date" | "amount">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Pre-index profiles and products for O(1) lookups
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.user_id, p.full_name || "—");
    return m;
  }, [profiles]);

  const productMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) m.set(p.id, p.name);
    return m;
  }, [products]);

  const getSellerName = (userId: string) => profileMap.get(userId) || "—";
  const getProductName = (productId: string | null) => (productId && productMap.get(productId)) || "—";

  const methodIcon = (m: string | null) => {
    if (m === "pix") return <Smartphone className="h-3 w-3 text-emerald-400" />;
    if (m === "credit_card") return <CreditCard className="h-3 w-3 text-blue-400" />;
    if (m === "boleto") return <FileText className="h-3 w-3 text-amber-400" />;
    return null;
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const result = transactions.filter(t => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (methodFilter !== "all" && t.payment_method !== methodFilter) return false;
      if (!search) return true;
      return t.customer_name?.toLowerCase().includes(s) || t.customer_email?.toLowerCase().includes(s) || t.id.includes(s) || getSellerName(t.user_id).toLowerCase().includes(s);
    });
    result.sort((a, b) => {
      if (sortField === "date") return sortAsc ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortAsc ? Number(a.amount) - Number(b.amount) : Number(b.amount) - Number(a.amount);
    });
    return result;
  }, [transactions, search, statusFilter, methodFilter, sortField, sortAsc, profileMap]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const loadMore = useCallback(() => setVisibleCount(c => c + PAGE_SIZE), []);

  const { completedCount, pendingCount, failedCount, todayCount, todayVolume } = useMemo(() => {
    const todayStr = new Date().toDateString();
    let completed = 0, pending = 0, failed = 0, todayN = 0, todayV = 0;
    for (const t of transactions) {
      if (t.status === "completed" || t.status === "approved") completed++;
      else if (t.status === "pending") pending++;
      else if (t.status === "failed" || t.status === "expired") failed++;
      if (new Date(t.created_at).toDateString() === todayStr) {
        todayN++;
        if (t.status === "completed" || t.status === "approved") todayV += Number(t.amount);
      }
    }
    return { completedCount: completed, pendingCount: pending, failedCount: failed, todayCount: todayN, todayVolume: todayV };
  }, [transactions]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <AdminKpi icon={<CreditCard className="h-5 w-5" />} label="Total Transações" value={String(transactions.length)} sub="Todas" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<Smartphone className="h-5 w-5" />} label="Aprovadas" value={String(completedCount)} sub={`${((completedCount / Math.max(transactions.length, 1)) * 100).toFixed(1)}% taxa`} gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<Filter className="h-5 w-5" />} label="Pendentes" value={String(pendingCount)} sub="Aguardando" gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" alert={pendingCount > 5} />
        <AdminKpi icon={<FileText className="h-5 w-5" />} label="Falhas/Expiradas" value={String(failedCount)} sub="Não concluídas" gradient="from-red-500 to-rose-600" glowColor="rgba(239,68,68,0.15)" />
        <AdminKpi icon={<Download className="h-5 w-5" />} label="Volume Hoje" value={fmtCurrency(todayVolume)} sub={`${todayCount} transações`} gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" highlight />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input placeholder="Buscar por cliente, vendedor, ID..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.12]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-10 bg-white/[0.04] border-white/[0.06] text-xs rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-[hsl(228,18%,8%)] border-white/[0.08]">
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="completed">Aprovada</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="failed">Falha</SelectItem>
            <SelectItem value="expired">Expirada</SelectItem>
            <SelectItem value="refunded">Reembolsada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[140px] h-10 bg-white/[0.04] border-white/[0.06] text-xs rounded-xl"><SelectValue placeholder="Método" /></SelectTrigger>
          <SelectContent className="bg-[hsl(228,18%,8%)] border-white/[0.08]">
            <SelectItem value="all">Todos métodos</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="credit_card">Cartão</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="h-10 text-[11px] text-muted-foreground hover:text-foreground gap-1.5"
          onClick={() => { setSortAsc(!sortAsc); }}>
          <ArrowUpDown className="h-3.5 w-3.5" /> {sortField === "date" ? "Data" : "Valor"}
        </Button>
      </div>

      {/* Table */}
      <AdminPanel>
        <PanelTitle color="blue" icon={<CreditCard className="h-4 w-4" />}>Transações ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">
              {["ID", "Cliente", "Vendedor", "Produto", "Método", "Valor Bruto", "Taxa", "Líquido", "Status", "Data"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {visibleItems.map(t => (
                <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 font-mono text-[10px] text-white/25">{t.id.slice(0, 8)}</td>
                  <td className="p-3"><div><p className="text-xs font-medium">{t.customer_name || "—"}</p><p className="text-[10px] text-white/25">{t.customer_email}</p></div></td>
                  <td className="p-3 text-xs text-white/50">{getSellerName(t.user_id)}</td>
                  <td className="p-3 text-xs text-white/40 max-w-[120px] truncate">{getProductName(t.product_id)}</td>
                  <td className="p-3"><div className="flex items-center gap-1.5">{methodIcon(t.payment_method)}<span className="text-[10px] text-white/40 uppercase">{t.payment_method || "—"}</span></div></td>
                  <td className="p-3 text-xs font-bold">{fmtCurrency(Number(t.amount))}</td>
                  <td className="p-3 text-xs text-amber-400">{fmtCurrency(Number(t.fee_amount))}</td>
                  <td className="p-3 text-xs text-emerald-400 font-bold">{fmtCurrency(Number(t.net_amount))}</td>
                  <td className="p-3"><StatusBadge status={t.status} /></td>
                  <td className="p-3 text-[10px] text-white/25">{fmtDateCached(t.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={10} className="p-10 text-center text-white/20 text-xs">Nenhuma transação</td></tr>}
            </tbody>
          </table>
          {visibleCount < filtered.length && (
            <div className="p-4 text-center">
              <Button variant="ghost" size="sm" onClick={loadMore} className="gap-2 text-xs text-white/30 hover:text-white/60">
                <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </div>
      </AdminPanel>
    </div>
  );
}
