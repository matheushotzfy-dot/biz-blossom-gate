import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, Download, CreditCard, Package, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, Panel, GlowPanel, PageTitle, KpiCard, EmptyState } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const _dateFmt = new Intl.DateTimeFormat("pt-BR");
const _dateCache = new Map<string, string>();
const fmtDateCached = (d: string) => {
  let v = _dateCache.get(d);
  if (!v) { v = _dateFmt.format(new Date(d)); _dateCache.set(d, v); }
  return v;
};

const PAGE_SIZE = 50;

export default function Extrato() {
  const { user } = useAuth();
  const { data: transactions = [] } = useTransactions();
  const { data: productsRaw = [] } = useProducts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const products = useMemo(() => productsRaw.map(p => ({ id: p.id, name: p.name })), [productsRaw]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, statusFilter, methodFilter, productFilter]);

  const productMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) map[p.id] = p.name;
    return map;
  }, [products]);

  const getProductName = (id: string | null) => (id && productMap[id]) || "—";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter((tx) => {
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      if (methodFilter !== "all" && tx.payment_method !== methodFilter) return false;
      if (productFilter !== "all" && tx.product_id !== productFilter) return false;
      if (!search) return true;
      return tx.customer_name?.toLowerCase().includes(q) || tx.customer_email?.toLowerCase().includes(q) || tx.id.includes(search);
    });
  }, [transactions, search, statusFilter, methodFilter, productFilter]);

  const { total, totalGross, completedCount } = useMemo(() => {
    let total = 0, totalGross = 0, completedCount = 0;
    for (const t of filtered) {
      total += Number(t.net_amount);
      totalGross += Number(t.amount);
      if (t.status === "completed") completedCount++;
    }
    return { total, totalGross, completedCount };
  }, [filtered]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const loadMore = useCallback(() => setVisibleCount((c) => c + PAGE_SIZE), []);

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={<FileText className="h-6 w-6" />} title="Extrato" subtitle="Histórico completo de transações" />
        <Button variant="outline" size="sm" className="gap-2 rounded-xl hidden md:flex border-border/50 hover:border-primary/20 hover:bg-primary/[0.02]">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Líquido" value={fmt(total)} icon={CreditCard} color="text-primary" bg="bg-primary/10" />
        <KpiCard label="Bruto" value={fmt(totalGross)} icon={Package} color="text-foreground" bg="bg-muted/40" />
        <KpiCard label="Aprovadas" value={String(completedCount)} icon={CreditCard} color="text-success" bg="bg-success/10" />
        <KpiCard label="Transações" value={String(filtered.length)} icon={FileText} color="text-info" bg="bg-info/10" />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <Input placeholder="Buscar nome, email ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl text-sm bg-card/80 backdrop-blur-sm border-border/50 focus:border-primary/30" />
        </div>
        {[
          { value: statusFilter, onChange: setStatusFilter, items: [["all","Todos"],["completed","Aprovado"],["pending","Pendente"],["failed","Falhou"],["refunded","Reembolso"],["chargeback","Chargeback"]], w: "w-[130px]" },
          { value: methodFilter, onChange: setMethodFilter, items: [["all","Todos"],["pix","PIX"],["credit_card","Cartão"],["boleto","Boleto"]], w: "w-[130px]" },
        ].map((f, i) => (
          <Select key={i} value={f.value} onValueChange={f.onChange}>
            <SelectTrigger className={`${f.w} rounded-xl text-sm border-border/50 bg-card/80 backdrop-blur-sm`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {f.items.map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
        {products.length > 0 && (
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[160px] rounded-xl text-sm border-border/50 bg-card/80 backdrop-blur-sm"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Panel className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-gradient-to-r from-muted/30 via-muted/10 to-muted/30">
                  {["ID", "Cliente", "Produto", "Valor", "Líquido", "Método", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 ? (
                  <tr><td colSpan={8}>
                    <EmptyState icon={<FileText className="h-7 w-7" />} title="Nenhuma transação encontrada" subtitle="Tente ajustar os filtros" />
                  </td></tr>
                ) : visibleItems.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/25 hover:bg-primary/[0.02] transition-all">
                    <td className="p-4 font-mono text-[11px] text-muted-foreground/50">{tx.id.slice(0, 8)}</td>
                    <td className="p-4">
                      <p className="text-foreground font-semibold text-[13px]">{tx.customer_name || "—"}</p>
                      {tx.customer_email && <p className="text-[10px] text-muted-foreground/40">{tx.customer_email}</p>}
                    </td>
                    <td className="p-4 text-[12px] text-muted-foreground/60 max-w-[140px] truncate">{getProductName(tx.product_id)}</td>
                    <td className="p-4 text-foreground/80 text-[13px] font-medium">{fmt(Number(tx.amount))}</td>
                    <td className="p-4 font-display font-black text-primary text-[14px]">{fmt(Number(tx.net_amount))}</td>
                    <td className="p-4">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-muted/30 border border-border/30 text-muted-foreground/60 uppercase tracking-wider">
                        {tx.payment_method === "credit_card" ? "Cartão" : tx.payment_method || "—"}
                      </span>
                    </td>
                    <td className="p-4"><StatusBadge status={tx.status} /></td>
                    <td className="p-4 text-muted-foreground/50 text-[12px] font-medium">{fmtDateCached(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleCount < filtered.length && (
            <div className="p-4 border-t border-border/20 text-center">
              <Button variant="ghost" size="sm" onClick={loadMore} className="gap-2 text-xs text-muted-foreground">
                <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </Panel>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {visibleItems.length === 0 ? (
          <EmptyState icon={<FileText className="h-7 w-7" />} title="Nenhuma transação" />
        ) : visibleItems.map((tx) => (
          <GlowPanel key={tx.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground font-semibold text-sm">{tx.customer_name || "Cliente"}</span>
              <StatusBadge status={tx.status} />
            </div>
            <p className="text-[11px] text-muted-foreground/50 mb-1.5 truncate">{getProductName(tx.product_id)}</p>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-foreground font-display font-black text-lg">{fmt(Number(tx.net_amount))}</span>
                <span className="text-[10px] text-muted-foreground/40 ml-2">de {fmt(Number(tx.amount))}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted/30 border border-border/20 text-muted-foreground/50 uppercase tracking-wider">
                {tx.payment_method === "credit_card" ? "Cartão" : tx.payment_method || "—"}
              </span>
              <span className="text-muted-foreground/30 text-[11px]">•</span>
              <span className="text-muted-foreground/50 text-[11px]">{fmtDateCached(tx.created_at)}</span>
            </div>
          </GlowPanel>
        ))}
        {visibleCount < filtered.length && (
          <Button variant="ghost" size="sm" onClick={loadMore} className="w-full gap-2 text-xs text-muted-foreground">
            <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
          </Button>
        )}
      </div>
    </PageShell>
  );
}
