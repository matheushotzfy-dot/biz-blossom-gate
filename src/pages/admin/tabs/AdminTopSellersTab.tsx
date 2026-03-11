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
    if (period === "today") {
      return d.toDateString() === now.toDateString();
    }
    if (period === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }
    if (period === "month") {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      return d >= monthAgo;
    }
    return true;
  };

  const approved = transactions.filter(t =>
    (t.status === "completed" || t.status === "approved") && filterByPeriod(t.created_at)
  );

  // Build seller rankings
  const sellerMap = new Map<string, {
    userId: string; name: string; email: string; gross: number; net: number;
    fees: number; txCount: number; sellerType: string | null; createdAt: string;
  }>();

  approved.forEach(t => {
    const existing = sellerMap.get(t.user_id) || {
      userId: t.user_id, name: "", email: "", gross: 0, net: 0, fees: 0,
      txCount: 0, sellerType: null, createdAt: "",
    };
    existing.gross += Number(t.amount);
    existing.net += Number(t.net_amount);
    existing.fees += Number(t.fee_amount);
    existing.txCount += 1;
    sellerMap.set(t.user_id, existing);
  });

  // Enrich with profile data
  sellerMap.forEach((seller, userId) => {
    const profile = profiles.find(p => p.user_id === userId);
    if (profile) {
      seller.name = profile.full_name || "Sem nome";
      seller.email = profile.email || "";
      seller.sellerType = (profile as any).seller_type || null;
      seller.createdAt = profile.created_at;
    }
  });

  const ranked = Array.from(sellerMap.values())
    .sort((a, b) => b.gross - a.gross);

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  const totalGross = ranked.reduce((a, s) => a + s.gross, 0);
  const totalFees = ranked.reduce((a, s) => a + s.fees, 0);
  const totalTx = ranked.reduce((a, s) => a + s.txCount, 0);

  const getRankIcon = (i: number) => {
    if (i === 0) return <Crown className="h-5 w-5 text-amber-400" />;
    if (i === 1) return <Medal className="h-5 w-5 text-slate-300" />;
    if (i === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-[11px] font-black text-white/20">#{i + 1}</span>;
  };

  const getRankGlow = (i: number) => {
    if (i === 0) return "from-amber-500/20 to-amber-500/5 border-amber-500/20 shadow-[0_0_40px_rgba(245,158,11,0.1)]";
    if (i === 1) return "from-slate-400/15 to-slate-400/5 border-slate-400/15";
    if (i === 2) return "from-amber-700/15 to-amber-700/5 border-amber-700/15";
    return "from-white/[0.03] to-white/[0.01] border-white/[0.04]";
  };

  const periodLabels: Record<Period, string> = {
    all: "Todo período", month: "Último mês", week: "Última semana", today: "Hoje",
  };

  const SellerTypeBadge = ({ type }: { type: string | null }) => {
    if (type === "black") return <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">BLK</span>;
    if (type === "white") return <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-200/10 text-slate-400 border border-slate-500/20">WHT</span>;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header with period filter */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">Top Sellers</h2>
            <p className="text-[11px] text-white/30">Ranking de vendedores por faturamento</p>
          </div>
        </div>
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {(["all", "month", "week", "today"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                period === p ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-white/30 hover:text-white/60"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] rounded-2xl border border-white/[0.06] p-4">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-500/[0.06] to-transparent rounded-bl-full" />
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Sellers Ativos</p>
          <p className="text-2xl font-black mt-1">{ranked.length}</p>
          <Users className="h-4 w-4 text-white/10 mt-2" />
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] rounded-2xl border border-white/[0.06] p-4">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-500/[0.06] to-transparent rounded-bl-full" />
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Volume Total</p>
          <p className="text-2xl font-black mt-1 text-emerald-400">{fmtCurrency(totalGross)}</p>
          <DollarSign className="h-4 w-4 text-white/10 mt-2" />
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] rounded-2xl border border-white/[0.06] p-4">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-500/[0.06] to-transparent rounded-bl-full" />
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Lucro Taxas</p>
          <p className="text-2xl font-black mt-1 text-amber-400">{fmtCurrency(totalFees)}</p>
          <Percent className="h-4 w-4 text-white/10 mt-2" />
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] rounded-2xl border border-white/[0.06] p-4">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-500/[0.06] to-transparent rounded-bl-full" />
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Total Transações</p>
          <p className="text-2xl font-black mt-1">{totalTx}</p>
          <BarChart3 className="h-4 w-4 text-white/10 mt-2" />
        </div>
      </div>

      {/* Podium - Top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((seller, i) => (
            <div
              key={seller.userId}
              className={`relative overflow-hidden bg-gradient-to-br ${getRankGlow(i)} rounded-2xl border p-5 transition-all duration-500 hover:scale-[1.01]`}
            >
              {i === 0 && (
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
              )}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${
                    i === 0 ? "from-amber-500/30 to-amber-600/10" :
                    i === 1 ? "from-slate-400/20 to-slate-400/5" :
                    "from-amber-700/20 to-amber-700/5"
                  } flex items-center justify-center text-sm font-black ${
                    i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : "text-amber-600"
                  }`}>
                    {seller.name[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-bold flex items-center gap-2">
                      {seller.name}
                      <SellerTypeBadge type={seller.sellerType} />
                    </p>
                    <p className="text-[10px] text-white/30 mt-0.5">{seller.email}</p>
                    {seller.createdAt && (
                      <p className="text-[9px] text-white/20 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-2.5 w-2.5" />
                        Desde {new Date(seller.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>
                {getRankIcon(i)}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Faturamento</span>
                  <span className="text-lg font-black text-emerald-400">{fmtCurrency(seller.gross)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Taxas Geradas</span>
                  <span className="text-sm font-bold text-amber-400">{fmtCurrency(seller.fees)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Vendas</span>
                  <span className="text-sm font-bold text-white/60">{seller.txCount}</span>
                </div>
                {/* Share bar */}
                <div className="mt-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-white/20 uppercase font-bold">Share do volume</span>
                    <span className="text-[9px] text-white/20 font-bold">
                      {totalGross > 0 ? ((seller.gross / totalGross) * 100).toFixed(1) : "0.0"}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        i === 0 ? "bg-gradient-to-r from-amber-400 to-amber-500" :
                        i === 1 ? "bg-gradient-to-r from-slate-400 to-slate-500" :
                        "bg-gradient-to-r from-amber-600 to-amber-700"
                      }`}
                      style={{ width: `${totalGross > 0 ? Math.max((seller.gross / totalGross) * 100, 2) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full ranking table */}
      <AdminPanel>
        <PanelTitle color="amber" icon={<TrendingUp className="h-4 w-4" />}>
          Ranking Completo ({ranked.length} sellers)
        </PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["#", "Vendedor", "Tipo", "Desde", "Transações", "Faturamento", "Receita Líq.", "Taxas Geradas", "Share"].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((seller, i) => (
                <tr key={seller.userId} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${i < 3 ? "bg-white/[0.01]" : ""}`}>
                  <td className="p-3">
                    <div className="flex items-center justify-center w-7 h-7">
                      {getRankIcon(i)}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${
                        i === 0 ? "from-amber-500/20 to-amber-500/5" :
                        i < 3 ? "from-slate-400/15 to-slate-400/5" :
                        "from-blue-500/15 to-blue-500/5"
                      } flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "text-amber-400" : i < 3 ? "text-slate-300" : "text-blue-400"
                      }`}>
                        {seller.name[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-xs font-bold">{seller.name}</p>
                        <p className="text-[10px] text-white/25">{seller.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><SellerTypeBadge type={seller.sellerType} /></td>
                  <td className="p-3 text-[10px] text-white/30 font-mono">
                    {seller.createdAt ? new Date(seller.createdAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="p-3 text-xs font-bold text-white/50">{seller.txCount}</td>
                  <td className="p-3 text-xs font-black text-emerald-400">{fmtCurrency(seller.gross)}</td>
                  <td className="p-3 text-xs font-bold text-blue-400">{fmtCurrency(seller.net)}</td>
                  <td className="p-3 text-xs font-bold text-amber-400">{fmtCurrency(seller.fees)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                          style={{ width: `${totalGross > 0 ? Math.max((seller.gross / totalGross) * 100, 1) : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-white/25 font-bold w-10 text-right">
                        {totalGross > 0 ? ((seller.gross / totalGross) * 100).toFixed(1) : "0.0"}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-white/20 text-xs">
                    Nenhuma venda no período selecionado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
