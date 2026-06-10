import { useState } from "react";
import { Trophy, Crown, Medal, TrendingUp, Users, DollarSign, Percent, BarChart3, Calendar, Target } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented, premiumTable } from "./AdminPremium";
import { cn } from "@/lib/utils";

interface Props { profiles: Tables<"profiles">[]; transactions: Tables<"transactions">[]; fmtCurrency: (v: number) => string; }
type Period = "all" | "month" | "week" | "today";

export default function AdminTopSellersTab({ profiles, transactions, fmtCurrency }: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const now = new Date();
  const filterByPeriod = (date: string) => {
    const d = new Date(date);
    if (period === "today") return d.toDateString() === now.toDateString();
    if (period === "week") { const w = new Date(now); w.setDate(w.getDate() - 7); return d >= w; }
    if (period === "month") { const m = new Date(now); m.setMonth(m.getMonth() - 1); return d >= m; }
    return true;
  };

  const approved = transactions.filter(t => (t.status === "completed" || t.status === "approved") && filterByPeriod(t.created_at));
  const sellerMap = new Map<string, { userId: string; name: string; email: string; gross: number; net: number; fees: number; txCount: number; sellerType: string | null; createdAt: string; }>();
  approved.forEach(t => {
    const existing = sellerMap.get(t.user_id) || { userId: t.user_id, name: "", email: "", gross: 0, net: 0, fees: 0, txCount: 0, sellerType: null, createdAt: "" };
    existing.gross += Number(t.amount); existing.net += Number(t.net_amount); existing.fees += Number(t.fee_amount); existing.txCount += 1;
    sellerMap.set(t.user_id, existing);
  });
  sellerMap.forEach((seller, userId) => {
    const profile = profiles.find(p => p.user_id === userId);
    if (profile) { seller.name = profile.full_name || "Sem nome"; seller.email = profile.email || ""; seller.sellerType = (profile as any).seller_type || null; seller.createdAt = profile.created_at; }
  });
  const ranked = Array.from(sellerMap.values()).sort((a, b) => b.gross - a.gross);
  const totalGross = ranked.reduce((a, s) => a + s.gross, 0);
  const totalFees = ranked.reduce((a, s) => a + s.fees, 0);
  const totalTx = ranked.reduce((a, s) => a + s.txCount, 0);
  const top3 = ranked.slice(0, 3);

  const rankIcon = (i: number) => i === 0 ? <Crown className="h-5 w-5 text-warning" /> : i === 1 ? <Medal className="h-5 w-5 text-muted-foreground" /> : i === 2 ? <Medal className="h-5 w-5 text-primary" /> : <span className="font-mono text-[11px] font-black text-muted-foreground">#{i + 1}</span>;
  const typeBadge = (type: string | null) => type === "black" ? "BLACK" : type === "white" ? "WHITE" : "SEM TIPO";

  return <div className="space-y-6 animate-fade-in">
    <FinanceiroHero eyebrow="Ranking Comercial" title="Top Sellers" subtitle="Leaderboard financeiro por TPV, lucro, share de volume e consistência operacional." status={{ tone: "warning", label: "Performance", pulse: true }} actions={<PremiumSegmented value={period} onChange={setPeriod} options={[{ value: "today", label: "Hoje" }, { value: "week", label: "7d" }, { value: "month", label: "30d" }, { value: "all", label: "Tudo" }]} />} />

    <PremiumMetricGrid cols={4}>
      <PremiumMetric icon={Users} label="Sellers Ativos" value={String(ranked.length)} sub="com venda no período" tone="neutral" />
      <PremiumMetric icon={DollarSign} label="Volume Total" value={fmtCurrency(totalGross)} sub="TPV aprovado" tone="success" />
      <PremiumMetric icon={Percent} label="Lucro Taxas" value={fmtCurrency(totalFees)} sub="take rate gerado" tone="primary" />
      <PremiumMetric icon={BarChart3} label="Transações" value={String(totalTx)} sub="vendas aprovadas" tone="info" />
    </PremiumMetricGrid>

    {top3.length > 0 && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {top3.map((seller, i) => <div key={seller.userId} className={cn("relative overflow-hidden rounded-[24px] border bg-card p-6 transition-colors hover:border-primary/30", i === 0 ? "border-warning/30" : "border-border/60")}>
        <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-lg font-black", i === 0 ? "border-warning/20 bg-warning/10 text-warning" : "border-border/60 bg-muted/30 text-foreground")}>{seller.name[0]?.toUpperCase() || "?"}</div><div className="min-w-0"><p className="truncate text-sm font-black text-foreground">{seller.name}</p><p className="truncate text-[11px] font-bold text-muted-foreground">{seller.email}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">{typeBadge(seller.sellerType)}</p></div></div>{rankIcon(i)}</div>
        <div className="mt-6 space-y-3"><div className="flex items-baseline justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Faturamento</span><span className="font-display text-xl font-black text-primary tabular-nums">{fmtCurrency(seller.gross)}</span></div><div className="flex items-baseline justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Taxas</span><span className="text-sm font-black text-success tabular-nums">{fmtCurrency(seller.fees)}</span></div><div><div className="mb-1 flex justify-between text-[9px] font-black uppercase tracking-wider text-muted-foreground"><span>Share</span><span>{totalGross > 0 ? ((seller.gross / totalGross) * 100).toFixed(1) : "0.0"}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted/50"><div className="h-full rounded-full bg-primary transition-all duration-1000" style={{ width: `${totalGross > 0 ? Math.max((seller.gross / totalGross) * 100, 2) : 0}%` }} /></div></div></div>
      </div>)}
    </div>}

    <PremiumPanel title={`Ranking Completo (${ranked.length})`} eyebrow="Sellers por faturamento" icon={TrendingUp}>
      <div className={premiumTable.wrapper}><table className={premiumTable.table}><thead><tr className={premiumTable.headRow}>{["#", "Vendedor", "Tipo", "Desde", "Vendas", "Faturamento", "Receita Líq.", "Taxas", "Share"].map(h => <th key={h} className={premiumTable.th}>{h}</th>)}</tr></thead><tbody>{ranked.map((seller, i) => <tr key={seller.userId} className={premiumTable.row}><td className={premiumTable.td}>{rankIcon(i)}</td><td className={premiumTable.td}><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{seller.name[0]?.toUpperCase() || "?"}</div><div><p className="text-xs font-black text-foreground">{seller.name}</p><p className="text-[10px] font-bold text-muted-foreground">{seller.email}</p></div></div></td><td className={premiumTable.td}><span className="rounded-full border border-border/60 bg-muted/30 px-2 py-1 text-[9px] font-black text-muted-foreground">{typeBadge(seller.sellerType)}</span></td><td className={premiumTable.td}><span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground"><Calendar className="h-3 w-3" />{seller.createdAt ? new Date(seller.createdAt).toLocaleDateString("pt-BR") : "—"}</span></td><td className={premiumTable.td}><span className="text-xs font-black text-foreground">{seller.txCount}</span></td><td className={premiumTable.td}><span className="text-xs font-black text-primary tabular-nums">{fmtCurrency(seller.gross)}</span></td><td className={premiumTable.td}><span className="text-xs font-black text-info tabular-nums">{fmtCurrency(seller.net)}</span></td><td className={premiumTable.td}><span className="text-xs font-black text-success tabular-nums">{fmtCurrency(seller.fees)}</span></td><td className={premiumTable.td}><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-muted/50"><div className="h-full rounded-full bg-primary" style={{ width: `${totalGross > 0 ? Math.max((seller.gross / totalGross) * 100, 1) : 0}%` }} /></div><span className="w-10 text-right text-[10px] font-black text-muted-foreground">{totalGross > 0 ? ((seller.gross / totalGross) * 100).toFixed(1) : "0.0"}%</span></div></td></tr>)}{ranked.length === 0 && <tr><td colSpan={9} className="py-16 text-center text-xs font-bold text-muted-foreground">Nenhuma venda no período selecionado</td></tr>}</tbody></table></div>
    </PremiumPanel>
  </div>;
}