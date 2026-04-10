import { useState } from "react";
import {
 Trophy, Crown, Medal, TrendingUp, ArrowUpRight,
 Zap, BarChart3, Users, DollarSign, Percent, Calendar,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle } from "./AdminOverviewTab";

interface Props {
 profiles: Tables<"profiles">[];
 transactions: Tables<"transactions">[];
 fmtCurrency: (v: number) => string;
}

type Period = "all" | "month" | "week" | "today";

export default function AdminTopSellersTab({ profiles, transactions, fmtCurrency }: Props) {
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
 const top3 = ranked.slice(0, 3);
 const totalGross = ranked.reduce((a, s) => a + s.gross, 0);
 const totalFees = ranked.reduce((a, s) => a + s.fees, 0);
 const totalTx = ranked.reduce((a, s) => a + s.txCount, 0);

 const getRankIcon = (i: number) => {
 if (i === 0) return <Crown className="h-5 w-5 text-amber-500" />;
 if (i === 1) return <Medal className="h-5 w-5 text-muted-foreground" />;
 if (i === 2) return <Medal className="h-5 w-5 text-amber-700" />;
 return <span className="text-[11px] font-black text-muted-foreground">#{i + 1}</span>;
 };

 const getRankGlow = (i: number) => {
 if (i === 0) return "from-amber-500/20 to-amber-500/5 border-amber-500/20";
 if (i === 1) return "from-muted/30 to-muted/10 border-border";
 if (i === 2) return "from-amber-700/15 to-amber-700/5 border-amber-700/15";
 return "from-muted/30 to-muted/10 border-border";
 };

 const periodLabels: Record<Period, string> = { all: "Todo período", month: "Último mês", week: "Última semana", today: "Hoje" };

 const SellerTypeBadge = ({ type }: { type: string | null }) => {
 if (type === "black") return <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-muted text-muted-foreground border border-border">BLK</span>;
 if (type === "white") return <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-secondary text-secondary-foreground border border-border">WHT</span>;
 return null;
 };

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between flex-wrap gap-4">
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center"><Trophy className="h-5 w-5 text-amber-500" /></div>
 <div>
 <h2 className="text-lg font-black tracking-tight text-foreground">Top Sellers</h2>
 <p className="text-[11px] text-muted-foreground">Ranking de vendedores por faturamento</p>
 </div>
 </div>
 <div className="flex gap-1 bg-muted/30 border border-border rounded-xl p-1">
 {(["all", "month", "week", "today"] as Period[]).map(p => (
 <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${period === p ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-muted-foreground hover:text-foreground"}`}>{periodLabels[p]}</button>
 ))}
 </div>
 </div>

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 <div className="rounded-2xl bg-card border border-border p-4">
 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Sellers Ativos</p>
 <p className="text-2xl font-black mt-1 text-foreground">{ranked.length}</p>
 <Users className="h-4 w-4 text-muted-foreground/30 mt-2" />
 </div>
 <div className="rounded-2xl bg-card border border-border p-4">
 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Volume Total</p>
 <p className="text-2xl font-black mt-1 text-primary">{fmtCurrency(totalGross)}</p>
 <DollarSign className="h-4 w-4 text-muted-foreground/30 mt-2" />
 </div>
 <div className="rounded-2xl bg-card border border-border p-4">
 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Lucro Taxas</p>
 <p className="text-2xl font-black mt-1 text-amber-500">{fmtCurrency(totalFees)}</p>
 <Percent className="h-4 w-4 text-muted-foreground/30 mt-2" />
 </div>
 <div className="rounded-2xl bg-card border border-border p-4">
 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total Transações</p>
 <p className="text-2xl font-black mt-1 text-foreground">{totalTx}</p>
 <BarChart3 className="h-4 w-4 text-muted-foreground/30 mt-2" />
 </div>
 </div>

 {top3.length > 0 && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {top3.map((seller, i) => (
 <div key={seller.userId} className={`relative overflow-hidden bg-gradient-to-br ${getRankGlow(i)} rounded-2xl border p-5 transition-all duration-500 hover:scale-[1.01]`}>
 {i === 0 && <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />}
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${i === 0 ? "from-amber-500/30 to-amber-600/10" : i === 1 ? "from-muted/40 to-muted/10" : "from-amber-700/20 to-amber-700/5"} flex items-center justify-center text-sm font-black ${i === 0 ? "text-amber-500" : i === 1 ? "text-muted-foreground" : "text-amber-700"}`}>
 {seller.name[0]?.toUpperCase() || "?"}
 </div>
 <div>
 <p className="text-sm font-bold text-foreground flex items-center gap-2">{seller.name} <SellerTypeBadge type={seller.sellerType} /></p>
 <p className="text-[10px] text-muted-foreground mt-0.5">{seller.email}</p>
 {seller.createdAt && <p className="text-[9px] text-muted-foreground/50 flex items-center gap-1 mt-0.5"><Calendar className="h-2.5 w-2.5" /> Desde {new Date(seller.createdAt).toLocaleDateString("pt-BR")}</p>}
 </div>
 </div>
 {getRankIcon(i)}
 </div>
 <div className="space-y-2">
 <div className="flex justify-between items-baseline"><span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Faturamento</span><span className="text-lg font-black text-primary">{fmtCurrency(seller.gross)}</span></div>
 <div className="flex justify-between items-baseline"><span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Taxas Geradas</span><span className="text-sm font-bold text-amber-500">{fmtCurrency(seller.fees)}</span></div>
 <div className="flex justify-between items-baseline"><span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Vendas</span><span className="text-sm font-bold text-foreground/60">{seller.txCount}</span></div>
 <div className="mt-3">
 <div className="flex justify-between mb-1"><span className="text-[9px] text-muted-foreground/50 uppercase font-bold">Share do volume</span><span className="text-[9px] text-muted-foreground/50 font-bold">{totalGross > 0 ? ((seller.gross / totalGross) * 100).toFixed(1) : "0.0"}%</span></div>
 <div className="w-full h-1.5 rounded-full bg-muted/30 overflow-hidden">
 <div className={`h-full rounded-full transition-all duration-1000 ${i === 0 ? "bg-gradient-to-r from-amber-400 to-amber-500" : i === 1 ? "bg-gradient-to-r from-muted-foreground/40 to-muted-foreground/60" : "bg-gradient-to-r from-amber-600 to-amber-700"}`} style={{ width: `${totalGross > 0 ? Math.max((seller.gross / totalGross) * 100, 2) : 0}%` }} />
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}

 <AdminPanel>
 <PanelTitle color="amber" icon={<TrendingUp className="h-4 w-4" />}>Ranking Completo ({ranked.length} sellers)</PanelTitle>
 <div className="overflow-x-auto mt-4">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border">
 {["#", "Vendedor", "Tipo", "Desde", "Transações", "Faturamento", "Receita Líq.", "Taxas Geradas", "Share"].map(h => (
 <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {ranked.map((seller, i) => (
 <tr key={seller.userId} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i < 3 ? "bg-muted/10" : ""}`}>
 <td className="p-3"><div className="flex items-center justify-center w-7 h-7">{getRankIcon(i)}</div></td>
 <td className="p-3">
 <div className="flex items-center gap-2.5">
 <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${i === 0 ? "from-amber-500/20 to-amber-500/5" : i < 3 ? "from-muted/30 to-muted/10" : "from-info/15 to-info/5"} flex items-center justify-center text-xs font-bold ${i === 0 ? "text-amber-500" : i < 3 ? "text-muted-foreground" : "text-info"}`}>{seller.name[0]?.toUpperCase() || "?"}</div>
 <div><p className="text-xs font-bold text-foreground">{seller.name}</p><p className="text-[10px] text-muted-foreground">{seller.email}</p></div>
 </div>
 </td>
 <td className="p-3"><SellerTypeBadge type={seller.sellerType} /></td>
 <td className="p-3 text-[10px] text-muted-foreground font-mono">{seller.createdAt ? new Date(seller.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
 <td className="p-3 text-xs font-bold text-muted-foreground">{seller.txCount}</td>
 <td className="p-3 text-xs font-black text-primary">{fmtCurrency(seller.gross)}</td>
 <td className="p-3 text-xs font-bold text-info">{fmtCurrency(seller.net)}</td>
 <td className="p-3 text-xs font-bold text-amber-500">{fmtCurrency(seller.fees)}</td>
 <td className="p-3">
 <div className="flex items-center gap-2">
 <div className="w-16 h-1.5 rounded-full bg-muted/30 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70" style={{ width: `${totalGross > 0 ? Math.max((seller.gross / totalGross) * 100, 1) : 0}%` }} /></div>
 <span className="text-[10px] text-muted-foreground font-bold w-10 text-right">{totalGross > 0 ? ((seller.gross / totalGross) * 100).toFixed(1) : "0.0"}%</span>
 </div>
 </td>
 </tr>
 ))}
 {ranked.length === 0 && <tr><td colSpan={9} className="p-12 text-center text-muted-foreground text-xs">Nenhuma venda no período selecionado</td></tr>}
 </tbody>
 </table>
 </div>
 </AdminPanel>
 </div>
 );
}
