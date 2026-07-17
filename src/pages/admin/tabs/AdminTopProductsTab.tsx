import { useState, useMemo } from "react";
import {
  Package, TrendingUp, ShoppingCart, DollarSign, Crown, Medal, Award,
  RefreshCw, AlertTriangle, ShieldX,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import {
  PremiumPanel, PremiumMetric, PremiumMetricGrid, PremiumSegmented, PremiumEmpty, premiumTable,
} from "./AdminPremium";
import { cn } from "@/lib/utils";

interface Props {
  products: Tables<"products">[];
  profiles: Tables<"profiles">[];
  transactions: Tables<"transactions">[];
  fmtCurrency: (v: number) => string;
}

type Period = "today" | "week" | "month" | "all";

const periodLabels: Record<Period, string> = { today: "Hoje", week: "7 dias", month: "30 dias", all: "Tudo" };

export default function AdminTopProductsTab({ products, profiles, transactions, fmtCurrency }: Props) {
  const [period, setPeriod] = useState<Period>("today");

  const filteredTx = useMemo(() => {
    if (period === "all") return transactions;
    const now = new Date();
    const cutoff = new Date(now);
    if (period === "today") cutoff.setHours(0, 0, 0, 0);
    else if (period === "week") cutoff.setDate(now.getDate() - 7);
    else if (period === "month") cutoff.setDate(now.getDate() - 30);
    return transactions.filter(t => new Date(t.created_at) >= cutoff);
  }, [transactions, period]);

  const ranked = useMemo(() => {
    type Row = {
      productId: string; name: string; sellerId: string; sellerName: string; sellerEmail: string;
      price: number; image_url: string | null; classification: string;
      total: number; completed: number; pending: number; refunded: number; chargebacks: number; failed: number;
      gross: number; net: number; fees: number; refundedAmt: number; cbAmt: number;
      avgTicket: number; conversion: number;
      uniqueBuyers: number;
    };
    const map = new Map<string, Row>();
    const buyerSets = new Map<string, Set<string>>();
    for (const t of filteredTx) {
      if (!t.product_id) continue;
      const product = products.find(p => p.id === t.product_id);
      if (!product) continue;
      let row = map.get(t.product_id);
      if (!row) {
        const profile = profiles.find(p => p.user_id === product.user_id);
        row = {
          productId: t.product_id, name: product.name, sellerId: product.user_id,
          sellerName: profile?.full_name || profile?.email || "—",
          sellerEmail: profile?.email || "",
          price: Number(product.price), image_url: product.image_url, classification: product.classification || "white",
          total: 0, completed: 0, pending: 0, refunded: 0, chargebacks: 0, failed: 0,
          gross: 0, net: 0, fees: 0, refundedAmt: 0, cbAmt: 0,
          avgTicket: 0, conversion: 0, uniqueBuyers: 0,
        };
        map.set(t.product_id, row);
        buyerSets.set(t.product_id, new Set());
      }
      row.total += 1;
      if (t.customer_email) buyerSets.get(t.product_id)!.add(t.customer_email);
      if (t.status === "completed") {
        row.completed += 1; row.gross += Number(t.amount); row.net += Number(t.net_amount || 0); row.fees += Number(t.fee_amount || 0);
      } else if (t.status === "pending") row.pending += 1;
      else if (t.status === "refunded") { row.refunded += 1; row.refundedAmt += Number(t.amount); }
      else if (t.status === "chargeback") { row.chargebacks += 1; row.cbAmt += Number(t.amount); }
      else if (t.status === "failed" || t.status === "expired") row.failed += 1;
    }
    for (const [pid, row] of map) {
      row.avgTicket = row.completed > 0 ? row.gross / row.completed : 0;
      row.conversion = row.total > 0 ? (row.completed / row.total) * 100 : 0;
      row.uniqueBuyers = buyerSets.get(pid)?.size || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.gross - a.gross);
  }, [filteredTx, products, profiles]);

  const totalGross = ranked.reduce((a, p) => a + p.gross, 0);
  const totalSales = ranked.reduce((a, p) => a + p.completed, 0);
  const totalRefunds = ranked.reduce((a, p) => a + p.refunded, 0);
  const totalCbs = ranked.reduce((a, p) => a + p.chargebacks, 0);
  const avgTicketGlobal = totalSales > 0 ? totalGross / totalSales : 0;

  const podiumIcons = [Crown, Medal, Award];
  const podiumColors = ["text-amber-400", "text-slate-300", "text-orange-400"];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center"><Package className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">Top Produtos</h2>
            <p className="text-[11px] text-muted-foreground">Ranking por faturamento — vendas, reembolsos, chargebacks e métricas de conversão</p>
          </div>
        </div>
        <div className="flex gap-1 bg-muted/30 border border-border rounded-xl p-1">
          {(["today", "week", "month", "all"] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                period === p ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground")}>
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <AdminKpi icon={<DollarSign className="h-4 w-4" />} label="Faturamento" value={fmtCurrency(totalGross)} gradient="from-emerald-600 to-emerald-700" glowColor="rgba(52,211,153,0.2)" />
        <AdminKpi icon={<ShoppingCart className="h-4 w-4" />} label="Vendas" value={String(totalSales)} gradient="from-blue-600 to-blue-700" glowColor="rgba(59,130,246,0.2)" />
        <AdminKpi icon={<DollarSign className="h-4 w-4" />} label="Ticket Médio" value={fmtCurrency(avgTicketGlobal)} gradient="from-violet-600 to-violet-700" glowColor="rgba(139,92,246,0.2)" />
        <AdminKpi icon={<Package className="h-4 w-4" />} label="Produtos Vendidos" value={String(ranked.length)} gradient="from-indigo-600 to-indigo-700" glowColor="rgba(99,102,241,0.2)" />
        <AdminKpi icon={<RefreshCw className="h-4 w-4" />} label="Reembolsos" value={String(totalRefunds)} gradient="from-amber-600 to-orange-600" glowColor="rgba(245,158,11,0.2)" />
        <AdminKpi icon={<AlertTriangle className="h-4 w-4" />} label="Chargebacks" value={String(totalCbs)} gradient="from-red-600 to-red-700" glowColor="rgba(239,68,68,0.2)" />
      </div>

      {/* Pódio */}
      {ranked.slice(0, 3).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ranked.slice(0, 3).map((item, i) => {
            const Icon = podiumIcons[i];
            return (
              <div key={item.productId} className={cn(
                "relative overflow-hidden rounded-2xl border p-5 transition-all hover:scale-[1.01] bg-card/60",
                i === 0 && "border-amber-500/30",
                i === 1 && "border-slate-400/30",
                i === 2 && "border-orange-500/30",
              )}>
                <div className="absolute top-3 right-3"><Icon className={cn("h-6 w-6", podiumColors[i])} /></div>
                <div className="flex items-center gap-3 mb-4">
                  {item.image_url ? <img src={item.image_url} alt="" className="h-12 w-12 rounded-xl object-cover border border-border" /> :
                    <div className="h-12 w-12 rounded-xl bg-muted/30 flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[10px] font-black uppercase tracking-wider", podiumColors[i])}>#{i + 1}</p>
                    <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.sellerName}</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <Row label="Faturamento" value={fmtCurrency(item.gross)} accent="primary" />
                  <Row label="Líquido" value={fmtCurrency(item.net)} />
                  <Row label="Vendas" value={String(item.completed)} />
                  <Row label="Ticket Médio" value={fmtCurrency(item.avgTicket)} />
                  <Row label="Conversão" value={`${item.conversion.toFixed(1)}%`} />
                  <Row label="Compradores únicos" value={String(item.uniqueBuyers)} />
                  {item.refunded > 0 && <Row label="Reembolsos" value={String(item.refunded)} accent="warning" />}
                  {item.chargebacks > 0 && <Row label="Chargebacks" value={String(item.chargebacks)} accent="destructive" />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdminPanel>
        <PanelTitle color="emerald" icon={<TrendingUp className="h-4 w-4" />}>Ranking Completo ({ranked.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["#", "Produto", "Seller", "Vendas", "Faturamento", "Líquido", "Taxas", "Ticket", "Conv.", "Reemb.", "CB", "Buyers", "Share"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ranked.map((item, i) => (
                <tr key={item.productId} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", i < 3 && "bg-muted/10")}>
                  <td className="p-3"><span className={cn("text-xs font-black", i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-muted-foreground")}>#{i + 1}</span></td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {item.image_url ? <img src={item.image_url} alt="" className="h-7 w-7 rounded-lg object-cover border border-border" /> : <div className="h-7 w-7 rounded-lg bg-muted/30" />}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate max-w-[200px]">{item.name}</p>
                        {item.classification === "black" && <span className="text-[9px] text-red-400 font-bold flex items-center gap-0.5"><ShieldX className="h-2.5 w-2.5" />Black</span>}
                        {item.classification === "gray" && <span className="text-[9px] text-amber-400 font-bold">Gray</span>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><p className="text-xs text-muted-foreground truncate max-w-[140px]">{item.sellerName}</p><p className="text-[10px] text-muted-foreground/50 truncate max-w-[140px]">{item.sellerEmail}</p></td>
                  <td className="p-3 text-xs font-bold text-foreground">{item.completed}</td>
                  <td className="p-3 text-xs font-black text-primary tabular-nums">{fmtCurrency(item.gross)}</td>
                  <td className="p-3 text-xs font-bold text-emerald-400 tabular-nums">{fmtCurrency(item.net)}</td>
                  <td className="p-3 text-xs text-muted-foreground tabular-nums">{fmtCurrency(item.fees)}</td>
                  <td className="p-3 text-xs font-bold text-info tabular-nums">{fmtCurrency(item.avgTicket)}</td>
                  <td className="p-3 text-xs font-bold text-violet-400">{item.conversion.toFixed(1)}%</td>
                  <td className="p-3 text-xs font-bold"><span className={item.refunded > 0 ? "text-warning" : "text-muted-foreground/50"}>{item.refunded}</span></td>
                  <td className="p-3 text-xs font-bold"><span className={item.chargebacks > 0 ? "text-destructive" : "text-muted-foreground/50"}>{item.chargebacks}</span></td>
                  <td className="p-3 text-xs text-muted-foreground">{item.uniqueBuyers}</td>
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
              {ranked.length === 0 && <tr><td colSpan={13} className="p-12 text-center text-muted-foreground text-xs">Nenhuma venda no período {periodLabels[period].toLowerCase()}</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: "primary" | "warning" | "destructive" }) {
  const c = accent === "primary" ? "text-primary" : accent === "warning" ? "text-warning" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex justify-between">
      <span className="text-[10px] text-muted-foreground uppercase font-bold">{label}</span>
      <span className={cn("text-xs font-bold tabular-nums", c)}>{value}</span>
    </div>
  );
}
