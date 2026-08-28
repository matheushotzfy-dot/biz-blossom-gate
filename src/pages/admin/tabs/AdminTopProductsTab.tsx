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
import { cn, isApprovedTransaction } from "@/lib/utils";

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
      if (isApprovedTransaction(t.status)) {
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
      <FinanceiroHero
        eyebrow="Admin · Catálogo"
        title="Top Produtos"
        subtitle={`Ranking por faturamento · ${periodLabels[period]}`}
        status={{ tone: totalCbs > 0 ? "warning" : "success", label: `${totalSales} vendas · ${ranked.length} produtos`, pulse: false }}
      />

      <div className="flex items-center justify-end">
        <PremiumSegmented<Period>
          value={period}
          onChange={setPeriod}
          options={(["today", "week", "month", "all"] as Period[]).map(p => ({ value: p, label: periodLabels[p] }))}
        />
      </div>

      <PremiumMetricGrid cols={6}>
        <PremiumMetric icon={DollarSign} label="Faturamento" value={fmtCurrency(totalGross)} sub="volume bruto" tone="primary" />
        <PremiumMetric icon={ShoppingCart} label="Vendas" value={String(totalSales)} sub="aprovadas" tone="success" />
        <PremiumMetric icon={DollarSign} label="Ticket médio" value={fmtCurrency(avgTicketGlobal)} sub="por venda" tone="info" />
        <PremiumMetric icon={Package} label="Produtos vendidos" value={String(ranked.length)} sub="com pedidos" tone="neutral" />
        <PremiumMetric icon={RefreshCw} label="Reembolsos" value={String(totalRefunds)} sub="no período" tone={totalRefunds > 0 ? "warning" : "neutral"} />
        <PremiumMetric icon={AlertTriangle} label="Chargebacks" value={String(totalCbs)} sub="no período" tone={totalCbs > 0 ? "destructive" : "neutral"} />
      </PremiumMetricGrid>

      {/* Pódio */}
      {ranked.slice(0, 3).length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ranked.slice(0, 3).map((item, i) => {
            const Icon = podiumIcons[i];
            return (
              <div key={item.productId} className={cn(
                "relative overflow-hidden rounded-[24px] border bg-card p-5 transition-colors",
                i === 0 && "border-amber-500/40 hover:border-amber-500/60",
                i === 1 && "border-slate-400/40 hover:border-slate-400/60",
                i === 2 && "border-orange-500/40 hover:border-orange-500/60",
              )}>
                <div className="absolute right-4 top-4"><Icon className={cn("h-6 w-6", podiumColors[i])} /></div>
                <div className="mb-4 flex items-center gap-3">
                  {item.image_url ? <img src={item.image_url} alt="" className="h-12 w-12 rounded-xl border border-border/60 object-cover" /> :
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/30"><Package className="h-5 w-5 text-muted-foreground" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[9px] font-black uppercase tracking-[0.18em]", podiumColors[i])}>#{i + 1}</p>
                    <p className="truncate font-display text-sm font-black text-foreground">{item.name}</p>
                    <p className="truncate text-[10px] font-bold text-muted-foreground/70">{item.sellerName}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Row label="Faturamento" value={fmtCurrency(item.gross)} accent="primary" />
                  <Row label="Líquido" value={fmtCurrency(item.net)} />
                  <Row label="Vendas" value={String(item.completed)} />
                  <Row label="Ticket médio" value={fmtCurrency(item.avgTicket)} />
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

      <PremiumPanel icon={TrendingUp} eyebrow="Ranking" title={`Ranking Completo (${ranked.length})`}>
        {ranked.length === 0 ? (
          <PremiumEmpty icon={Package} title="Sem vendas no período" subtitle={`Nenhuma transação em ${periodLabels[period].toLowerCase()}`} />
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  {["#", "Produto", "Seller", "Vendas", "Faturamento", "Líquido", "Taxas", "Ticket", "Conv.", "Reemb.", "CB", "Buyers", "Share"].map(h => (
                    <th key={h} className={premiumTable.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((item, i) => (
                  <tr key={item.productId} className={premiumTable.row}>
                    <td className={premiumTable.td}><span className={cn("text-[11px] font-black tabular-nums", i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-muted-foreground")}>#{i + 1}</span></td>
                    <td className={premiumTable.td}>
                      <div className="flex items-center gap-2">
                        {item.image_url ? <img src={item.image_url} alt="" className="h-7 w-7 rounded-lg border border-border/60 object-cover" /> : <div className="h-7 w-7 rounded-lg border border-border/60 bg-muted/30" />}
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate text-[11px] font-bold text-foreground">{item.name}</p>
                          {item.classification === "black" && <span className="flex items-center gap-0.5 text-[9px] font-black text-destructive"><ShieldX className="h-2.5 w-2.5" />BLACK</span>}
                          {item.classification === "gray" && <span className="text-[9px] font-black text-warning">GRAY</span>}
                        </div>
                      </div>
                    </td>
                    <td className={premiumTable.td}>
                      <p className="max-w-[160px] truncate text-[11px] font-bold text-foreground/80">{item.sellerName}</p>
                      <p className="max-w-[160px] truncate text-[10px] text-muted-foreground/60">{item.sellerEmail}</p>
                    </td>
                    <td className={cn(premiumTable.td, "text-[11px] font-bold tabular-nums text-foreground")}>{item.completed}</td>
                    <td className={cn(premiumTable.td, "text-[11px] font-black tabular-nums text-primary")}>{fmtCurrency(item.gross)}</td>
                    <td className={cn(premiumTable.td, "text-[11px] font-bold tabular-nums text-success")}>{fmtCurrency(item.net)}</td>
                    <td className={cn(premiumTable.td, "text-[11px] tabular-nums text-muted-foreground")}>{fmtCurrency(item.fees)}</td>
                    <td className={cn(premiumTable.td, "text-[11px] font-bold tabular-nums text-info")}>{fmtCurrency(item.avgTicket)}</td>
                    <td className={cn(premiumTable.td, "text-[11px] font-bold tabular-nums text-foreground/80")}>{item.conversion.toFixed(1)}%</td>
                    <td className={premiumTable.td}><span className={cn("text-[11px] font-bold tabular-nums", item.refunded > 0 ? "text-warning" : "text-muted-foreground/40")}>{item.refunded}</span></td>
                    <td className={premiumTable.td}><span className={cn("text-[11px] font-bold tabular-nums", item.chargebacks > 0 ? "text-destructive" : "text-muted-foreground/40")}>{item.chargebacks}</span></td>
                    <td className={cn(premiumTable.td, "text-[11px] tabular-nums text-muted-foreground")}>{item.uniqueBuyers}</td>
                    <td className={premiumTable.td}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/40">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${totalGross > 0 ? Math.max((item.gross / totalGross) * 100, 1) : 0}%` }} />
                        </div>
                        <span className="w-10 text-right text-[10px] font-black tabular-nums text-muted-foreground">{totalGross > 0 ? ((item.gross / totalGross) * 100).toFixed(1) : "0.0"}%</span>
                      </div>
                    </td>
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


function Row({ label, value, accent }: { label: string; value: string; accent?: "primary" | "warning" | "destructive" }) {
  const c = accent === "primary" ? "text-primary" : accent === "warning" ? "text-warning" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex justify-between">
      <span className="text-[10px] text-muted-foreground uppercase font-bold">{label}</span>
      <span className={cn("text-xs font-bold tabular-nums", c)}>{value}</span>
    </div>
  );
}
