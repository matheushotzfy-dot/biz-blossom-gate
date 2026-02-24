import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, PiggyBank, Landmark, Users, ArrowDownToLine,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle, Sparkles, Zap,
  Shield, Globe, CreditCard, Package, BarChart3, Activity, Eye, Percent,
  ShieldAlert, RotateCcw,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";

interface Acquirer {
  id: string; name: string; slug: string; type: string; is_active: boolean;
}

interface Dispute {
  id: string; type: string; status: string; seller_user_id: string; amount: number;
}

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  withdrawals: Tables<"withdrawals">[];
  onWithdrawalAction: (id: string, action: "approved" | "rejected") => void;
  onUserStatus: (userId: string, status: string) => void;
  fmtCurrency: (v: number) => string;
}

export default function AdminOverviewTab({ transactions, profiles, products, withdrawals, onWithdrawalAction, onUserStatus, fmtCurrency }: Props) {
  const [acquirers, setAcquirers] = useState<Acquirer[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [chartFilter, setChartFilter] = useState<"total" | "black" | "white">("total");

  useEffect(() => {
    supabase.from("acquirers").select("*").then(({ data }) => { if (data) setAcquirers(data as Acquirer[]); });
    supabase.from("disputes").select("id,type,status,seller_user_id,amount").then(({ data }) => { if (data) setDisputes(data as Dispute[]); });
  }, []);

  const allTx = transactions;
  const approved = allTx.filter(t => t.status === "approved" || t.status === "completed");
  const totalVolume = approved.reduce((a, t) => a + Number(t.amount), 0);
  const totalFees = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const totalNet = approved.reduce((a, t) => a + Number(t.net_amount), 0);
  const pendingWd = withdrawals.filter(w => w.status === "pending");
  const pendingAmount = pendingWd.reduce((a, w) => a + Number(w.amount), 0);
  const conversionRate = allTx.length > 0 ? ((approved.length / allTx.length) * 100).toFixed(1) : "0.0";
  const approvedWd = withdrawals.filter(w => w.status === "approved");
  const totalWithdrawn = approvedWd.reduce((a, w) => a + Number(w.amount), 0);
  const totalWdFees = withdrawals.reduce((a, w) => a + Number(w.fee_amount), 0);

  // Compute fee split: percentage vs fixed
  const totalFeePercent = approved.reduce((a, t) => {
    const gross = Number(t.amount);
    const fee = Number(t.fee_amount);
    // Assume fixed = 2.50 for estimation
    const fixedPart = Math.min(2.50, fee);
    return a + (fee - fixedPart);
  }, 0);
  const totalFeeFixed = approved.length * 2.50;

  // Black / White seller segmentation
  const blackSellers = new Set(profiles.filter(p => p.seller_type === "black").map(p => p.user_id));
  const whiteSellers = new Set(profiles.filter(p => p.seller_type === "white").map(p => p.user_id));
  const unsetSellers = new Set(profiles.filter(p => p.seller_type == null).map(p => p.user_id));

  const getSellerType = (userId: string): string | null => {
    if (blackSellers.has(userId)) return "black";
    if (whiteSellers.has(userId)) return "white";
    return null;
  };

  const blackTx = approved.filter(t => blackSellers.has(t.user_id));
  const whiteTx = approved.filter(t => whiteSellers.has(t.user_id));
  const unsetTx = approved.filter(t => unsetSellers.has(t.user_id));

  const blackVolume = blackTx.reduce((a, t) => a + Number(t.amount), 0);
  const whiteVolume = whiteTx.reduce((a, t) => a + Number(t.amount), 0);
  const unsetVolume = unsetTx.reduce((a, t) => a + Number(t.amount), 0);
  const blackFees = blackTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const whiteFees = whiteTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const unsetFees = unsetTx.reduce((a, t) => a + Number(t.fee_amount), 0);

  // Conversion by segment
  const allBlackTx = allTx.filter(t => blackSellers.has(t.user_id));
  const allWhiteTx = allTx.filter(t => whiteSellers.has(t.user_id));
  const blackConversion = allBlackTx.length > 0 ? ((blackTx.length / allBlackTx.length) * 100).toFixed(1) : "0.0";
  const whiteConversion = allWhiteTx.length > 0 ? ((whiteTx.length / allWhiteTx.length) * 100).toFixed(1) : "0.0";

  // Disputes breakdown
  const medpixCount = disputes.filter(d => d.type === "medpix").length;
  const premedCount = disputes.filter(d => d.type === "pre_med_pix").length;
  const refundCount = disputes.filter(d => d.type === "refund").length;
  const openDisputes = disputes.filter(d => d.status === "open" || d.status === "in_review").length;

  // Acquirer breakdown (enhanced)
  const acquirerStats = acquirers.map(acq => {
    const sellersForAcq = profiles.filter(p => p.acquirer_id === acq.id);
    const sellerIds = new Set(sellersForAcq.map(p => p.user_id));
    const acqAllTx = allTx.filter(t => sellerIds.has(t.user_id));
    const acqApproved = acqAllTx.filter(t => t.status === "approved" || t.status === "completed");
    const acqWd = withdrawals.filter(w => sellerIds.has(w.user_id));
    const acqPendingWd = acqWd.filter(w => w.status === "pending");
    const acqApprovedWd = acqWd.filter(w => w.status === "approved");
    const acqDisputes = disputes.filter(d => sellerIds.has(d.seller_user_id));

    return {
      name: acq.name,
      type: acq.type,
      sellers: sellersForAcq.length,
      volume: acqApproved.reduce((a, t) => a + Number(t.amount), 0),
      fees: acqApproved.reduce((a, t) => a + Number(t.fee_amount), 0),
      txCount: acqAllTx.length,
      approvedCount: acqApproved.length,
      conversionRate: acqAllTx.length > 0 ? ((acqApproved.length / acqAllTx.length) * 100).toFixed(1) : "0.0",
      totalWithdrawn: acqApprovedWd.reduce((a, w) => a + Number(w.amount), 0),
      pendingWdAmount: acqPendingWd.reduce((a, w) => a + Number(w.amount), 0),
      pendingWdCount: acqPendingWd.length,
      wdFees: acqWd.reduce((a, w) => a + Number(w.fee_amount), 0),
      medpix: acqDisputes.filter(d => d.type === "medpix").length,
      premed: acqDisputes.filter(d => d.type === "pre_med_pix").length,
      refunds: acqDisputes.filter(d => d.type === "refund").length,
    };
  });

  // Per-seller ranking
  const clientMap = new Map<string, { userId: string; volume: number; fees: number; net: number; txCount: number; name: string; email: string; type: string | null }>();
  approved.forEach(t => {
    const existing = clientMap.get(t.user_id) || { userId: t.user_id, volume: 0, fees: 0, net: 0, txCount: 0, name: "", email: "", type: null };
    existing.volume += Number(t.amount); existing.fees += Number(t.fee_amount); existing.net += Number(t.net_amount); existing.txCount += 1;
    clientMap.set(t.user_id, existing);
  });
  clientMap.forEach((client, userId) => {
    const profile = profiles.find(p => p.user_id === userId);
    if (profile) { client.name = profile.full_name || "Sem nome"; client.email = profile.email || ""; client.type = profile.seller_type; }
  });
  const clientBreakdown = Array.from(clientMap.values()).sort((a, b) => b.volume - a.volume);

  const statusCounts = allTx.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["hsl(152,60%,45%)", "hsl(35,90%,55%)", "hsl(0,72%,51%)", "hsl(200,70%,50%)", "hsl(280,65%,55%)"];

  // 7-day chart with filter
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = approved.filter(t => new Date(t.created_at).toDateString() === d.toDateString());
    const dayBlack = dayTx.filter(t => blackSellers.has(t.user_id));
    const dayWhite = dayTx.filter(t => whiteSellers.has(t.user_id));
    return {
      name: dayStr,
      volume: dayTx.reduce((a, t) => a + Number(t.amount), 0),
      lucro: dayTx.reduce((a, t) => a + Number(t.fee_amount), 0),
      black: dayBlack.reduce((a, t) => a + Number(t.amount), 0),
      white: dayWhite.reduce((a, t) => a + Number(t.amount), 0),
    };
  });

  // Payment method breakdown
  const methodStats = approved.reduce((acc, t) => {
    const m = t.payment_method || "other";
    if (!acc[m]) acc[m] = { volume: 0, count: 0, total: 0 };
    acc[m].volume += Number(t.amount);
    acc[m].count += 1;
    acc[m].total = allTx.filter(tx => tx.payment_method === t.payment_method).length;
    return acc;
  }, {} as Record<string, { volume: number; count: number; total: number }>);

  const today = new Date();
  const todayTx = approved.filter(t => new Date(t.created_at).toDateString() === today.toDateString());
  const todayVolume = todayTx.reduce((a, t) => a + Number(t.amount), 0);
  const todayFees = todayTx.reduce((a, t) => a + Number(t.fee_amount), 0);

  // Withdrawal segmentation
  const blackWdPending = pendingWd.filter(w => blackSellers.has(w.user_id));
  const whiteWdPending = pendingWd.filter(w => whiteSellers.has(w.user_id));
  const unsetWdPending = pendingWd.filter(w => unsetSellers.has(w.user_id));

  const SellerTypeBadge = ({ type }: { type: string | null }) => {
    if (type === "black") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">B</span>;
    if (type === "white") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-slate-200/10 text-slate-400 border border-slate-500/20">W</span>;
    return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">?</span>;
  };

  // Chart data key based on filter
  const chartMainKey = chartFilter === "black" ? "black" : chartFilter === "white" ? "white" : "volume";
  const chartMainColor = chartFilter === "black" ? "hsl(0,0%,55%)" : chartFilter === "white" ? "hsl(210,20%,75%)" : "hsl(152,60%,45%)";
  const chartGradId = chartFilter === "black" ? "adBlackGrad" : chartFilter === "white" ? "adWhiteGrad" : "adVolGrad";

  return (
    <div className="space-y-5">
      {/* ═══ Row 1: Main KPIs ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <AdminKpi icon={<DollarSign className="h-5 w-5" />} label="Volume Total" value={fmtCurrency(totalVolume)} sub={`${approved.length} vendas aprovadas`} gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<PiggyBank className="h-5 w-5" />} label="Lucro Gateway" value={fmtCurrency(totalFees)} sub={`% ${fmtCurrency(totalFeePercent)} + Fixa ${fmtCurrency(totalFeeFixed)}`} gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" highlight />
        <AdminKpi icon={<Landmark className="h-5 w-5" />} label="Distribuído" value={fmtCurrency(totalNet)} sub="Líquido sellers" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<Percent className="h-5 w-5" />} label="Conversão Total" value={`${conversionRate}%`} sub={`${approved.length}/${allTx.length} tx`} gradient="from-cyan-500 to-teal-600" glowColor="rgba(6,182,212,0.15)" />
        <AdminKpi icon={<ArrowDownToLine className="h-5 w-5" />} label="Total Sacado" value={fmtCurrency(totalWithdrawn)} sub={`Taxas saque: ${fmtCurrency(totalWdFees)}`} gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" />
        <AdminKpi icon={<AlertTriangle className="h-5 w-5" />} label="Disputas" value={String(disputes.length)} sub={`${openDisputes} abertas`} gradient="from-orange-500 to-red-600" glowColor="rgba(249,115,22,0.15)" alert={openDisputes > 0} />
        <AdminKpi icon={<Zap className="h-5 w-5" />} label="Hoje" value={fmtCurrency(todayVolume)} sub={`Lucro: ${fmtCurrency(todayFees)}`} gradient="from-cyan-500 to-teal-600" glowColor="rgba(6,182,212,0.15)" />
        <AdminKpi icon={<ArrowDownToLine className="h-5 w-5" />} label="Saques Pendentes" value={fmtCurrency(pendingAmount)} sub={`${pendingWd.length} solicitações`} gradient="from-red-500 to-rose-600" glowColor="rgba(239,68,68,0.15)" alert={pendingWd.length > 0} />
      </div>

      {/* ═══ Row 2: Black vs White + Disputes ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900/60 to-zinc-800/20 border border-zinc-700/30 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-500/20 to-transparent" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-zinc-400" /><span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Black</span></div>
            <span className="text-[10px] text-zinc-500">{blackSellers.size} sellers • Conv: {blackConversion}%</span>
          </div>
          <p className="text-2xl font-black text-white">{fmtCurrency(blackVolume)}</p>
          <p className="text-xs text-zinc-500 mt-1">Lucro: <span className="text-amber-400 font-bold">{fmtCurrency(blackFees)}</span> • {blackTx.length} vendas</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-slate-100/[0.03] to-slate-200/[0.01] border border-slate-500/15 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-400/15 to-transparent" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-slate-400" /><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">White</span></div>
            <span className="text-[10px] text-slate-500">{whiteSellers.size} sellers • Conv: {whiteConversion}%</span>
          </div>
          <p className="text-2xl font-black text-white">{fmtCurrency(whiteVolume)}</p>
          <p className="text-xs text-slate-500 mt-1">Lucro: <span className="text-amber-400 font-bold">{fmtCurrency(whiteFees)}</span> • {whiteTx.length} vendas</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/[0.04] to-amber-500/[0.01] border border-amber-500/10 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/15 to-transparent" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-[10px] uppercase tracking-wider font-bold text-amber-500">Não Classificados</span></div>
            <span className="text-[10px] text-amber-600">{unsetSellers.size} sellers</span>
          </div>
          <p className="text-2xl font-black text-white">{fmtCurrency(unsetVolume)}</p>
          <p className="text-xs text-amber-600 mt-1">Lucro: <span className="text-amber-400 font-bold">{fmtCurrency(unsetFees)}</span> • {unsetTx.length} vendas</p>
        </div>
        {/* Disputes summary */}
        <div className="rounded-2xl bg-gradient-to-br from-red-500/[0.04] to-orange-500/[0.02] border border-red-500/10 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/15 to-transparent" />
          <div className="flex items-center gap-2 mb-3"><ShieldAlert className="h-4 w-4 text-red-400" /><span className="text-[10px] uppercase tracking-wider font-bold text-red-400">Disputas</span></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-black text-amber-400">{medpixCount}</p><p className="text-[9px] text-white/25">MedPix</p></div>
            <div><p className="text-lg font-black text-orange-400">{premedCount}</p><p className="text-[9px] text-white/25">Pre-Med</p></div>
            <div><p className="text-lg font-black text-red-400">{refundCount}</p><p className="text-[9px] text-white/25">Reembolso</p></div>
          </div>
        </div>
      </div>

      {/* ═══ Row 3: Chart with filter + Pie + Methods ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8">
          <AdminPanel>
            <div className="flex items-center justify-between mb-5">
              <PanelTitle color="emerald">Volume 7 dias</PanelTitle>
              <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
                {([
                  { id: "total" as const, label: "Total" },
                  { id: "black" as const, label: "Black" },
                  { id: "white" as const, label: "White" },
                ] as const).map(f => (
                  <button key={f.id} onClick={() => setChartFilter(f.id)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${chartFilter === f.id ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="adVolGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(152,60%,45%)" stopOpacity={0.2} /><stop offset="100%" stopColor="hsl(152,60%,45%)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="adBlackGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(0,0%,50%)" stopOpacity={0.15} /><stop offset="100%" stopColor="hsl(0,0%,50%)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="adWhiteGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(210,20%,70%)" stopOpacity={0.15} /><stop offset="100%" stopColor="hsl(210,20%,70%)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,15%,10%)" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(228,10%,25%)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(228,10%,25%)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(228,20%,6%)", border: "1px solid hsl(228,15%,12%)", borderRadius: "14px", fontSize: "11px", boxShadow: "0 25px 70px rgba(0,0,0,0.7)", color: "white" }} formatter={(value: number) => [fmtCurrency(value), chartFilter === "black" ? "Black" : chartFilter === "white" ? "White" : "Total"]} />
                <Area type="monotone" dataKey={chartMainKey} stroke={chartMainColor} fill={`url(#${chartGradId})`} strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="lucro" stroke="hsl(35,90%,55%)" fillOpacity={0.05} fill="hsl(35,90%,55%)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </AdminPanel>
        </div>
        <div className="lg:col-span-4 space-y-3">
          <AdminPanel>
            <PanelTitle color="blue">Status Transações</PanelTitle>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3} strokeWidth={0}>{pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: "hsl(228,20%,6%)", border: "1px solid hsl(228,15%,12%)", borderRadius: "12px", fontSize: "11px", color: "white" }} /></PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center mt-1">
                  {pieData.map((d, i) => (<div key={d.name} className="flex items-center gap-1 text-[9px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="capitalize text-white/40">{d.name}</span><span className="font-bold text-white">{d.value}</span></div>))}
                </div>
              </>
            ) : (<div className="flex items-center justify-center h-[160px] text-sm text-white/20">Sem dados</div>)}
          </AdminPanel>
          <AdminPanel>
            <PanelTitle color="violet">Métodos de Pagamento</PanelTitle>
            <div className="space-y-2.5 mt-3">
              {Object.entries(methodStats).sort((a, b) => b[1].volume - a[1].volume).map(([method, stats]) => {
                const pct = totalVolume > 0 ? (stats.volume / totalVolume) * 100 : 0;
                const labels: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto", other: "Outro" };
                const colors: Record<string, string> = { pix: "bg-emerald-500", credit_card: "bg-blue-500", boleto: "bg-amber-500", other: "bg-white/20" };
                return (
                  <div key={method}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-white/50 font-medium">{labels[method] || method}</span>
                      <span className="text-white/70 font-bold">{fmtCurrency(stats.volume)} ({pct.toFixed(1)}%) • {stats.count} vendas</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className={`h-full rounded-full ${colors[method] || "bg-white/20"} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminPanel>
        </div>
      </div>

      {/* ═══ Row 4: Acquirer breakdown (enhanced) ═══ */}
      {acquirerStats.length > 0 && (
        <AdminPanel>
          <PanelTitle color="blue" icon={<CreditCard className="h-4 w-4" />}>Detalhes por Adquirente</PanelTitle>
          <div className="space-y-4 mt-4">
            {acquirerStats.map(acq => (
              <div key={acq.name} className={`rounded-xl border p-5 ${acq.type === "black" ? "border-zinc-700/30 bg-zinc-900/30" : "border-slate-500/15 bg-slate-100/[0.02]"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${acq.type === "black" ? "bg-zinc-800 text-zinc-400" : "bg-slate-200/10 text-slate-400"}`}>{acq.type}</span>
                    <span className="text-sm font-bold">{acq.name}</span>
                    <span className="text-[10px] text-white/20">{acq.sellers} sellers</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  <MiniStat label="Volume" value={fmtCurrency(acq.volume)} />
                  <MiniStat label="Vendas" value={`${acq.approvedCount}/${acq.txCount}`} />
                  <MiniStat label="Conversão" value={`${acq.conversionRate}%`} />
                  <MiniStat label="Lucro Taxas" value={fmtCurrency(acq.fees)} highlight />
                  <MiniStat label="Sacado" value={fmtCurrency(acq.totalWithdrawn)} />
                  <MiniStat label="Saque Pend." value={`${fmtCurrency(acq.pendingWdAmount)} (${acq.pendingWdCount})`} alert={acq.pendingWdCount > 0} />
                  <MiniStat label="Taxa Saque" value={fmtCurrency(acq.wdFees)} />
                  <MiniStat label="Disputas" value={`M:${acq.medpix} P:${acq.premed} R:${acq.refunds}`} alert={acq.medpix + acq.premed + acq.refunds > 0} />
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>
      )}

      {/* ═══ Row 5: Pending Withdrawals segmented ═══ */}
      <AdminPanel>
        <div className="flex items-center justify-between mb-4">
          <PanelTitle color="amber" icon={<AlertTriangle className="h-4 w-4" />}>Saques Pendentes</PanelTitle>
          <div className="flex gap-3 text-[10px]">
            <span className="text-zinc-400">Black: <strong>{blackWdPending.length}</strong> ({fmtCurrency(blackWdPending.reduce((a, w) => a + Number(w.amount), 0))})</span>
            <span className="text-slate-400">White: <strong>{whiteWdPending.length}</strong> ({fmtCurrency(whiteWdPending.reduce((a, w) => a + Number(w.amount), 0))})</span>
            <span className="text-amber-400">N/C: <strong>{unsetWdPending.length}</strong> ({fmtCurrency(unsetWdPending.reduce((a, w) => a + Number(w.amount), 0))})</span>
            {pendingWd.length > 0 && <span className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full font-extrabold border border-red-500/20 animate-pulse">{pendingWd.length}</span>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">{["ID","Vendedor","Tipo","Valor","Taxa","Líquido","Status","Data","Ações"].map(h=>(<th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>))}</tr></thead>
            <tbody>
              {withdrawals.slice(0, 15).map(w => {
                const sellerProfile = profiles.find(p => p.user_id === w.user_id);
                const sellerType = sellerProfile?.seller_type || null;
                return (
                  <tr key={w.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${w.status === "pending" ? "bg-amber-500/[0.02]" : ""}`}>
                    <td className="p-3 font-mono text-[11px] text-white/30">{w.id.slice(0,8)}</td>
                    <td className="p-3 text-xs font-medium">{sellerProfile?.full_name || "—"}</td>
                    <td className="p-3"><SellerTypeBadge type={sellerType} /></td>
                    <td className="p-3 text-xs font-extrabold">R$ {Number(w.amount).toFixed(2)}</td>
                    <td className="p-3 text-xs text-amber-400">R$ {Number(w.fee_amount).toFixed(2)}</td>
                    <td className="p-3 text-xs text-emerald-400">R$ {Number(w.net_amount).toFixed(2)}</td>
                    <td className="p-3"><StatusBadge status={w.status} /></td>
                    <td className="p-3 text-[11px] text-white/30">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3">
                      {w.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-[11px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 gap-1 rounded-xl shadow-none" onClick={() => onWithdrawalAction(w.id, "approved")}><CheckCircle2 className="h-3 w-3" /> Aprovar</Button>
                          <Button size="sm" className="h-7 text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 gap-1 rounded-xl shadow-none" onClick={() => onWithdrawalAction(w.id, "rejected")}><XCircle className="h-3 w-3" /> Recusar</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {withdrawals.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-white/20 text-xs">Sem saques</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {/* ═══ Row 6: Seller Ranking ═══ */}
      <AdminPanel>
        <PanelTitle color="emerald" icon={<TrendingUp className="h-4 w-4" />}>Ranking de Vendedores</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">
              {["#", "Vendedor", "Tipo", "Tx", "Volume", "Taxa", "Líquido"].map((h, i) => (
                <th key={h} className={`${i >= 3 ? "text-right" : "text-left"} p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {clientBreakdown.slice(0, 15).map((c, idx) => (
                <tr key={c.userId} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 text-xs text-white/20 font-bold">{idx + 1}</td>
                  <td className="p-3"><div className="flex items-center gap-2"><div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold ${idx === 0 ? "bg-gradient-to-br from-amber-500/30 to-amber-500/10 text-amber-400" : "bg-gradient-to-br from-white/[0.06] to-white/[0.02] text-white/50"}`}>{(c.name || "?")[0].toUpperCase()}</div><div><p className="text-xs font-bold text-white">{c.name}</p><p className="text-[10px] text-white/25">{c.email}</p></div></div></td>
                  <td className="p-3"><SellerTypeBadge type={c.type} /></td>
                  <td className="p-3 text-right"><span className="text-xs font-bold bg-white/[0.04] px-2 py-1 rounded-lg">{c.txCount}</span></td>
                  <td className="p-3 text-xs font-extrabold text-right">{fmtCurrency(c.volume)}</td>
                  <td className="p-3 text-xs font-bold text-right text-amber-400">{fmtCurrency(c.fees)}</td>
                  <td className="p-3 text-xs font-bold text-right text-emerald-400">{fmtCurrency(c.net)}</td>
                </tr>
              ))}
              {clientBreakdown.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-white/20 text-xs">Sem vendas</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {/* ═══ Row 7: Quick Stats ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminPanel>
          <div className="flex items-center gap-2 mb-2"><Package className="h-4 w-4 text-violet-400" /><span className="text-[10px] uppercase tracking-wider font-bold text-white/30">Produtos</span></div>
          <p className="text-xl font-black">{products.length}</p>
          <p className="text-[10px] text-white/20 mt-1">{products.filter(p => p.status === "active").length} ativos • {products.filter(p => p.status === "blocked").length} bloqueados</p>
        </AdminPanel>
        <AdminPanel>
          <div className="flex items-center gap-2 mb-2"><Activity className="h-4 w-4 text-cyan-400" /><span className="text-[10px] uppercase tracking-wider font-bold text-white/30">Conversão</span></div>
          <p className="text-xl font-black text-emerald-400">{conversionRate}%</p>
          <p className="text-[10px] text-white/20 mt-1">{approved.length} de {allTx.length} transações</p>
        </AdminPanel>
        <AdminPanel>
          <div className="flex items-center gap-2 mb-2"><BarChart3 className="h-4 w-4 text-amber-400" /><span className="text-[10px] uppercase tracking-wider font-bold text-white/30">Ticket Médio</span></div>
          <p className="text-xl font-black">{fmtCurrency(approved.length > 0 ? totalVolume / approved.length : 0)}</p>
          <p className="text-[10px] text-white/20 mt-1">Por transação aprovada</p>
        </AdminPanel>
        <AdminPanel>
          <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-blue-400" /><span className="text-[10px] uppercase tracking-wider font-bold text-white/30">Sellers</span></div>
          <p className="text-xl font-black">{profiles.length}</p>
          <p className="text-[10px] text-white/20 mt-1">{blackSellers.size}B / {whiteSellers.size}W / {unsetSellers.size}?</p>
        </AdminPanel>
      </div>
    </div>
  );
}

// ═══════════════ Shared sub-components ═══════════════

export function AdminPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-[hsl(228,18%,6%)] rounded-2xl border border-white/[0.04] p-6 hover:border-white/[0.06] transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      {children}
    </div>
  );
}

export function PanelTitle({ children, color, icon }: { children: React.ReactNode; color: string; icon?: React.ReactNode }) {
  const colorMap: Record<string, string> = { emerald: "from-emerald-400 to-emerald-600", amber: "from-amber-400 to-amber-600", blue: "from-blue-400 to-blue-600", red: "from-red-400 to-red-600", violet: "from-violet-400 to-violet-600", zinc: "from-zinc-400 to-zinc-600", cyan: "from-cyan-400 to-cyan-600" };
  return (<h3 className="text-sm font-bold flex items-center gap-2.5 text-white"><span className={`w-1 h-5 bg-gradient-to-b ${colorMap[color] || colorMap.emerald} rounded-full`} />{icon}{children}</h3>);
}

export function AdminKpi({ icon, label, value, sub, gradient, glowColor, alert, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  gradient: string; glowColor: string; alert?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-[hsl(228,18%,6%)] rounded-2xl border p-5 group transition-all duration-500 hover:translate-y-[-2px] ${alert ? "border-red-500/20 hover:border-red-500/30" : "border-white/[0.04] hover:border-white/[0.08]"}`}>
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: `radial-gradient(circle, ${glowColor}, transparent)` }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] uppercase tracking-widest text-white/30 font-semibold">{label}</span>
          <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500`} style={{ boxShadow: `0 8px 25px ${glowColor}` }}>{icon}</div>
        </div>
        <p className={`text-xl font-extrabold tracking-tight ${highlight ? "text-amber-400" : "text-white"}`}>{value}</p>
        {sub && <p className="text-[10px] text-white/25 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight, alert }: { label: string; value: string; highlight?: boolean; alert?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xs font-bold ${highlight ? "text-amber-400" : alert ? "text-red-400" : "text-white/80"}`}>{value}</p>
    </div>
  );
}
