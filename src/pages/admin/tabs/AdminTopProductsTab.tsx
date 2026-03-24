import { useState } from "react";
import {
  Package, TrendingUp, ShoppingCart, DollarSign, Percent, BarChart3, Calendar,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle, AdminKpi } from "./AdminOverviewTab";

interface Props {
  products: Tables<"products">[];
  profiles: Tables<"profiles">[];
  transactions: Tables<"transactions">[];
  fmtCurrency: (v: number) => string;
}

type Period = "all" | "month" | "week" | "today";

export default function AdminTopProductsTab({ products, profiles, transactions, fmtCurrency }: Props) {
  const [period, setPeriod] = useState<Period>("all");

  const now = new Date();
  const filterByPeriod = (date: string) => {
    if (period === "all") return true;
    const d = new Date(date);
    if (period === "today") return d.toDateString() === now.toDateString();
    if (period === "week") { const w = new Date(now); w.setDate(w.getDate() - 7); return d >= w; }
    if (period === "month") { const m = new Date(now); m.setMonth(m.getMonth() - 1); return d >= m; }
    return true;
  };

  const filteredTx = transactions.filter(t => filterByPeriod(t.created_at));
  const approved = filteredTx.filter(t => t.status === "completed" || t.status === "approved");

  const productMap = new Map<string, { productId: string; name: string; sellerId: string; sellerName: string; gross: number; txCount: number; totalTx: number; avgTicket: number; conversion: number; }>();
  const allTxByProduct = new Map<string, number>();
  filteredTx.forEach(t => { if (t.product_id) allTxByProduct.set(t.product_id, (allTxByProduct.get(t.product_id) || 0) + 1); });

  approved.forEach(t => {
    if (!t.product_id) return;
    const existing = productMap.get(t.product_id) || { productId: t.product_id, name: "", sellerId: t.user_id, sellerName: "", gross: 0, txCount: 0, totalTx: 0, avgTicket: 0, conversion: 0 };
    existing.gross += Number(t.amount);
    existing.txCount += 1;
    productMap.set(t.product_id, existing);
  });

  productMap.forEach((item, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) { item.name = product.name; item.sellerId = product.user_id; }
    const profile = profiles.find(p => p.user_id === item.sellerId);
    if (profile) item.sellerName = profile.full_name || profile.email || "Sem nome";
    item.totalTx = allTxByProduct.get(productId) || item.txCount;
    item.avgTicket = item.txCount > 0 ? item.gross / item.txCount : 0;
    item.conversion = item.totalTx > 0 ? (item.txCount / item.totalTx) * 100 : 0;
  });

  const ranked = Array.from(productMap.values()).sort((a, b) => b.gross - a.gross);
  const totalGross = ranked.reduce((a, p) => a + p.gross, 0);
  const totalSales = ranked.reduce((a, p) => a + p.txCount, 0);
  const avgTicketGlobal = totalSales > 0 ? totalGross / totalSales : 0;
  const periodLabels: Record<Period, string> = { all: "Todo período", month: "Último mês", week: "Última semana", today: "Hoje" };

  const getRankBg = (i: number) => {
    if (i === 0) return "from-primary/20 to-primary/5 border-primary/20";
    if (i === 1) return "from-info/15 to-info/5 border-info/15";
    if (i === 2) return "from-violet-500/15 to-violet-500/5 border-violet-500/15";
    return "from-muted/30 to-muted/10 border-border";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">Top Produtos</h2>
            <p className="text-[11px] text-muted-foreground">Ranking de produtos por faturamento</p>
          </div>
        </div>
        <div className="flex gap-1 bg-muted/30 border border-border rounded-xl p-1">
          {(["all", "month", "week", "today"] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                period === p ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
              }`}>{periodLabels[p]}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <AdminKpi icon={<Package className="h-4 w-4" />} label="Produtos Vendidos" value={String(ranked.length)} gradient="from-emerald-600 to-emerald-700" glowColor="rgba(52,211,153,0.2)" />
        <AdminKpi icon={<ShoppingCart className="h-4 w-4" />} label="Total Vendas" value={String(totalSales)} gradient="from-blue-600 to-blue-700" glowColor="rgba(59,130,246,0.2)" />
        <AdminKpi icon={<DollarSign className="h-4 w-4" />} label="Ticket Médio" value={fmtCurrency(avgTicketGlobal)} gradient="from-violet-600 to-violet-700" glowColor="rgba(139,92,246,0.2)" />
      </div>

      {ranked.slice(0, 3).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ranked.slice(0, 3).map((item, i) => (
            <div key={item.productId} className={`relative overflow-hidden bg-gradient-to-br ${getRankBg(i)} rounded-2xl border p-5 transition-all hover:scale-[1.01]`}>
              {i === 0 && <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />}
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg font-black ${
                  i === 0 ? "bg-primary/20 text-primary" : i === 1 ? "bg-info/20 text-info" : "bg-violet-500/20 text-violet-500"
                }`}>#{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.sellerName}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-[10px] text-muted-foreground uppercase font-bold">Faturamento</span><span className="text-lg font-black text-primary">{fmtCurrency(item.gross)}</span></div>
                <div className="flex justify-between"><span className="text-[10px] text-muted-foreground uppercase font-bold">Vendas</span><span className="text-sm font-bold text-foreground/60">{item.txCount}</span></div>
                <div className="flex justify-between"><span className="text-[10px] text-muted-foreground uppercase font-bold">Ticket Médio</span><span className="text-sm font-bold text-info">{fmtCurrency(item.avgTicket)}</span></div>
                <div className="flex justify-between"><span className="text-[10px] text-muted-foreground uppercase font-bold">Conversão</span><span className="text-sm font-bold text-violet-500">{item.conversion.toFixed(1)}%</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminPanel>
        <PanelTitle color="emerald" icon={<TrendingUp className="h-4 w-4" />}>Ranking Completo ({ranked.length} produtos)</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["#", "Produto", "Vendedor", "Vendas", "Faturamento", "Ticket Médio", "Conversão", "Share"].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((item, i) => (
                <tr key={item.productId} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i < 3 ? "bg-muted/10" : ""}`}>
                  <td className="p-3"><span className={`text-xs font-black ${i === 0 ? "text-primary" : i === 1 ? "text-info" : i === 2 ? "text-violet-500" : "text-muted-foreground"}`}>#{i + 1}</span></td>
                  <td className="p-3"><p className="text-xs font-bold text-foreground truncate max-w-[200px]">{item.name}</p></td>
                  <td className="p-3 text-xs text-muted-foreground truncate max-w-[150px]">{item.sellerName}</td>
                  <td className="p-3 text-xs font-bold text-muted-foreground">{item.txCount}</td>
                  <td className="p-3 text-xs font-black text-primary">{fmtCurrency(item.gross)}</td>
                  <td className="p-3 text-xs font-bold text-info">{fmtCurrency(item.avgTicket)}</td>
                  <td className="p-3 text-xs font-bold text-violet-500">{item.conversion.toFixed(1)}%</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70" style={{ width: `${totalGross > 0 ? Math.max((item.gross / totalGross) * 100, 1) : 0}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-bold w-10 text-right">{totalGross > 0 ? ((item.gross / totalGross) * 100).toFixed(1) : "0.0"}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {ranked.length === 0 && (<tr><td colSpan={8} className="p-12 text-center text-muted-foreground text-xs">Nenhuma venda no período selecionado</td></tr>)}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
