import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, PiggyBank, Landmark, Users, ArrowDownToLine,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle, Zap,
  Shield, Globe, CreditCard, Package, BarChart3, Activity, Percent,
  ShieldAlert, RotateCcw, Clock, Smartphone, FileText, Lock,
  TrendingDown, Eye, Radio, Server, Wifi, WifiOff, AlertCircle,
  UserCheck, UserX, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
} from "recharts";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Dispute { id: string; type: string; status: string; seller_user_id: string; amount: number; created_at: string; }

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  withdrawals: Tables<"withdrawals">[];
  onWithdrawalAction: (id: string, action: "approved" | "rejected") => void;
  onUserStatus: (userId: string, status: string) => void;
  fmtCurrency: (v: number) => string;
  isEmployee?: boolean;
  dateRange?: { from: Date; to: Date };
}

/* ═══ Custom Tooltip ═══ */
function ChartTooltip({ active, payload, label, fmtCurrency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0C0C12]/95 backdrop-blur-xl px-3.5 py-2.5 shadow-2xl shadow-black/60">
      <p className="text-[10px] text-white/30 font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-[11px] font-bold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.value > 100 ? fmtCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

/* ═══ Stagger animation ═══ */
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function AdminOverviewTab({ transactions, profiles, products, withdrawals, onWithdrawalAction, onUserStatus, fmtCurrency, isEmployee = false, dateRange }: Props) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [realtimeTx, setRealtimeTx] = useState<Tables<"transactions">[]>([]);
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d">("7d");
  const [fraudLogs, setFraudLogs] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("disputes").select("id,type,status,seller_user_id,amount,created_at"),
      supabase.from("fraud_logs").select("*").order("created_at", { ascending: false }).limit(20),
    ]).then(([dRes, fRes]) => {
      if (dRes.data) setDisputes(dRes.data as Dispute[]);
      if (fRes.data) setFraudLogs(fRes.data);
    });
  }, []);

  useEffect(() => {
    setRealtimeTx(transactions.slice(0, 25));
    const channel = supabase
      .channel("admin-god-mode-tx")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        setRealtimeTx(prev => [payload.new as Tables<"transactions">, ...prev].slice(0, 25));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" }, (payload) => {
        setRealtimeTx(prev => prev.map(t => t.id === (payload.new as any).id ? payload.new as Tables<"transactions"> : t));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [transactions]);

  const allTx = transactions;
  const approved = useMemo(() => allTx.filter(t => t.status === "approved" || t.status === "completed"), [allTx]);

  // ═══ DATE RANGE FILTERING ═══
  const filteredTx = useMemo(() => {
    if (!dateRange) return allTx;
    return allTx.filter(t => {
      const d = new Date(t.created_at);
      return d >= dateRange.from && d <= dateRange.to;
    });
  }, [allTx, dateRange]);

  const filteredApproved = useMemo(() => filteredTx.filter(t => t.status === "approved" || t.status === "completed"), [filteredTx]);

  const today = new Date();
  const todayStr = today.toDateString();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const todayTx = useMemo(() => approved.filter(t => new Date(t.created_at).toDateString() === todayStr), [approved, todayStr]);
  const monthTx = useMemo(() => approved.filter(t => new Date(t.created_at) >= thisMonthStart), [approved, thisMonthStart]);

  // Use filtered data for main KPIs
  const tpvToday = todayTx.reduce((a, t) => a + Number(t.amount), 0);
  const tpvMonth = monthTx.reduce((a, t) => a + Number(t.amount), 0);
  const totalVolume = filteredApproved.reduce((a, t) => a + Number(t.amount), 0);

  const takeRateToday = todayTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const takeRateMonth = monthTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const takeRateTotal = filteredApproved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const takeRatePct = totalVolume > 0 ? ((takeRateTotal / totalVolume) * 100).toFixed(2) : "0.00";

  const filteredWithdrawals = useMemo(() => {
    if (!dateRange) return withdrawals;
    return withdrawals.filter(w => {
      const d = new Date(w.created_at);
      return d >= dateRange.from && d <= dateRange.to;
    });
  }, [withdrawals, dateRange]);

  const totalWithdrawn = filteredWithdrawals.filter(w => w.status === "approved").reduce((a, w) => a + Number(w.amount), 0);
  const pendingWd = withdrawals.filter(w => w.status === "pending");
  const pendingWdAmount = pendingWd.reduce((a, w) => a + Number(w.amount), 0);

  const totalRetained = filteredApproved.filter(t => !t.retention_released && Number(t.retained_amount) > 0)
    .reduce((a, t) => a + Number(t.retained_amount), 0);

  const totalNet = filteredApproved.reduce((a, t) => a + Number(t.net_amount), 0);

  const chargebackTx = filteredTx.filter(t => t.status === "chargeback");
  const chargebackRate = filteredApproved.length > 0 ? ((chargebackTx.length / filteredApproved.length) * 100) : 0;
  const chargebackAlert = chargebackRate > 1;

  const activeSellersToday = new Set(todayTx.map(t => t.user_id)).size;
  const conversionRate = filteredTx.length > 0 ? ((filteredApproved.length / filteredTx.length) * 100).toFixed(1) : "0.0";
  const ticketMedio = filteredApproved.length > 0 ? totalVolume / filteredApproved.length : 0;

  const methodApproval = useMemo(() => {
    const methods: Record<string, { total: number; approved: number; volume: number }> = {};
    filteredTx.forEach(t => {
      const m = t.payment_method || "other";
      if (!methods[m]) methods[m] = { total: 0, approved: 0, volume: 0 };
      methods[m].total++;
      if (t.status === "approved" || t.status === "completed") {
        methods[m].approved++;
        methods[m].volume += Number(t.amount);
      }
    });
    return Object.entries(methods).map(([method, stats]) => ({
      method: method === "pix" ? "PIX" : method === "credit_card" ? "Cartão" : method === "boleto" ? "Boleto" : method,
      total: stats.total, approved: stats.approved, volume: stats.volume,
      rate: stats.total > 0 ? ((stats.approved / stats.total) * 100) : 0,
    }));
  }, [filteredTx]);

  const days = chartPeriod === "7d" ? 7 : 30;
  const chartData = useMemo(() => Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = approved.filter(t => new Date(t.created_at).toDateString() === d.toDateString());
    return {
      name: dayStr,
      tpv: dayTx.reduce((a, t) => a + Number(t.amount), 0),
      takeRate: dayTx.reduce((a, t) => a + Number(t.fee_amount), 0),
      vendas: dayTx.length,
    };
  }), [approved, days]);

  // Chargeback/refund trend (last 7 days)
  const refundTrend = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = allTx.filter(t => new Date(t.created_at).toDateString() === d.toDateString());
    return {
      name: dayStr,
      chargebacks: dayTx.filter(t => t.status === "chargeback").length,
      refunds: dayTx.filter(t => t.status === "refunded").length,
    };
  }), [allTx]);

  // KYC pending
  const kycPending = profiles.filter(p => p.account_status === "pending_review" || p.account_status === "pending");
  // High-value pending withdrawals
  const highValueWd = pendingWd.filter(w => Number(w.amount) >= 5000);

  const statusColorMap: Record<string, string> = {
    completed: "text-emerald-400", approved: "text-emerald-400", pending: "text-amber-400",
    failed: "text-red-400", expired: "text-white/20", refunded: "text-blue-400", chargeback: "text-red-500",
  };
  const statusLabelMap: Record<string, string> = {
    completed: "Pago", approved: "Pago", pending: "Pendente",
    failed: "Recusado", expired: "Expirado", refunded: "Estornado", chargeback: "CB",
  };

  const openDisputes = disputes.filter(d => d.status === "open" || d.status === "in_review").length;

  if (isEmployee) {
    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <HeroKpi icon={<Users className="h-5 w-5" />} label="Sellers" value={String(profiles.length)} sub="Total cadastrados" gradient="from-blue-500 to-indigo-600" />
          <HeroKpi icon={<Package className="h-5 w-5" />} label="Produtos" value={String(products.length)} sub={`${products.filter(p => p.status === "active").length} ativos`} gradient="from-violet-500 to-purple-600" />
          <HeroKpi icon={<CreditCard className="h-5 w-5" />} label="Transações" value={String(allTx.length)} sub={`${approved.length} aprovadas`} gradient="from-emerald-500 to-teal-600" />
          <HeroKpi icon={<Percent className="h-5 w-5" />} label="Conversão" value={`${conversionRate}%`} sub={`${approved.length}/${allTx.length}`} gradient="from-amber-500 to-orange-600" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      {/* ═══ 1. HERO METRICS — 4 Massive KPIs ═══ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeroKpi
          icon={<PiggyBank className="h-6 w-6" />}
          label="Lucro da Plataforma"
          value={fmtCurrency(takeRateTotal)}
          sub={`${takeRatePct}% `}
          gradient="from-indigo-500 to-violet-600"
          metallic
        />
        <HeroKpi
          icon={<Globe className="h-6 w-6" />}
          label="TPV Período"
          value={fmtCurrency(totalVolume)}
          sub={`${filteredApproved.length} transações aprovadas`}
          gradient="from-emerald-400 to-teal-600"
        />
        <HeroKpi
          icon={<Users className="h-6 w-6" />}
          label="Sellers Ativos Hoje"
          value={String(activeSellersToday)}
          sub={`de ${profiles.length} cadastrados`}
          gradient="from-blue-500 to-cyan-600"
        />
        <HeroKpi
          icon={<ShieldAlert className="h-6 w-6" />}
          label="Taxa Chargeback"
          value={`${chargebackRate.toFixed(2)}%`}
          sub={`${chargebackTx.length} chargebacks`}
          gradient={chargebackAlert ? "from-red-500 to-rose-600" : "from-emerald-500 to-green-600"}
          alert={chargebackAlert}
          pulse={chargebackAlert}
        />
      </motion.div>

      {/* ═══ 2. SECONDARY KPIs ═══ */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <GlassKpi label="TPV Hoje" value={fmtCurrency(tpvToday)} icon={<DollarSign className="h-3.5 w-3.5" />} iconColor="text-emerald-400" />
        <GlassKpi label="TPV Mensal" value={fmtCurrency(tpvMonth)} icon={<BarChart3 className="h-3.5 w-3.5" />} iconColor="text-blue-400" />
        <GlassKpi label="Take Rate Hoje" value={fmtCurrency(takeRateToday)} icon={<TrendingUp className="h-3.5 w-3.5" />} iconColor="text-amber-400" />
        <GlassKpi label="Saldo Retido" value={fmtCurrency(totalRetained)} icon={<Lock className="h-3.5 w-3.5" />} iconColor="text-violet-400" />
        <GlassKpi label="Vol. Sacado" value={fmtCurrency(totalWithdrawn)} icon={<ArrowDownToLine className="h-3.5 w-3.5" />} iconColor="text-blue-400" />
        <GlassKpi label="Ticket Médio" value={fmtCurrency(ticketMedio)} icon={<CreditCard className="h-3.5 w-3.5" />} iconColor="text-white/60" />
      </motion.div>

      {/* ═══ 3. VOLUME CHART + ACQUIRER ROUTING + REALTIME FEED ═══ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Volume Chart */}
        <GlassPanel className="xl:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <GlassPanelTitle color="indigo">Volume & Take Rate</GlassPanelTitle>
            <div className="flex gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5">
              {(["7d", "30d"] as const).map(f => (
                <button key={f} onClick={() => setChartPeriod(f)}
                  className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold transition-all", chartPeriod === f ? "bg-indigo-500/15 text-indigo-400" : "text-white/20 hover:text-white/50")}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tpvGradGod2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.12)" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.12)" fontSize={9} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip fmtCurrency={fmtCurrency} />} />
              <Area type="monotone" dataKey="tpv" stroke="#6366f1" fill="url(#tpvGradGod2)" strokeWidth={2} dot={false} name="TPV" />
              <Area type="monotone" dataKey="takeRate" stroke="#f59e0b" fillOpacity={0} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Take Rate" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassPanel>

        {/* Acquirer Routing Performance */}
        <GlassPanel className="flex flex-col max-h-[380px]">
          <GlassPanelTitle color="cyan" icon={<Server className="h-3.5 w-3.5" />}>Performance Adquirentes</GlassPanelTitle>
          <div className="space-y-3 mt-4 flex-1 overflow-y-auto">
            {methodApproval.sort((a, b) => b.volume - a.volume).map(m => {
              const isHealthy = m.rate >= 85;
              const isWarning = m.rate >= 60 && m.rate < 85;
              return (
                <div key={m.method}>
                  <div className="flex justify-between items-center text-[11px] mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full", isHealthy ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" : isWarning ? "bg-amber-400" : "bg-red-400 animate-pulse")} />
                      <span className="font-semibold text-white/80">{m.method}</span>
                    </div>
                    <span className={cn("font-black", isHealthy ? "text-emerald-400" : isWarning ? "text-amber-400" : "text-red-400")}>
                      {m.rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700",
                        isHealthy ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                          : isWarning ? "bg-gradient-to-r from-amber-500 to-amber-400"
                            : "bg-gradient-to-r from-red-500 to-red-400"
                      )}
                      style={{ width: `${m.rate}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-white/20 mt-1">
                    <span>{fmtCurrency(m.volume)}</span>
                    <span>{m.approved}/{m.total} tx</span>
                  </div>
                </div>
              );
            })}
            {/* Routing Status */}
            <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-1.5">
              <div className="flex items-center gap-2 text-[10px]">
                <Wifi className="h-3 w-3 text-emerald-400" />
                <span className="text-white/40 font-medium">Roteamento Inteligente</span>
                <span className="ml-auto text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">ATIVO</span>
              </div>
              {methodApproval.filter(m => m.rate < 70).map(m => (
                <div key={m.method} className="flex items-center gap-2 text-[9px] text-amber-400/70">
                  <AlertCircle className="h-2.5 w-2.5" />
                  <span>{m.method}: Latência Alta — Roteando alternativa</span>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>

        {/* Realtime Feed */}
        <GlassPanel className="overflow-hidden flex flex-col max-h-[380px]">
          <GlassPanelTitle color="red" icon={<Radio className="h-3.5 w-3.5 text-red-400 animate-pulse" />}>{""}</GlassPanelTitle>
          <div className="flex-1 overflow-y-auto mt-3 space-y-1 pr-1">
            {realtimeTx.map(t => (
              <div key={t.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all">
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                  t.status === "completed" || t.status === "approved" ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" :
                    t.status === "pending" ? "bg-amber-400 animate-pulse" : "bg-red-400"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/80 truncate">{fmtCurrency(Number(t.amount))}</span>
                    <span className={cn("text-[9px] font-bold uppercase", statusColorMap[t.status] || "text-white/20")}>
                      {statusLabelMap[t.status] || t.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-white/20 truncate">{t.customer_name || "Anônimo"}</span>
                    <span className="text-[9px] text-white/10">•</span>
                    <span className="text-[9px] text-white/20 uppercase">{t.payment_method || "—"}</span>
                    <span className="text-[9px] text-white/10">•</span>
                    <span className="text-[9px] text-white/20">{new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              </div>
            ))}
            {realtimeTx.length === 0 && (
              <div className="flex items-center justify-center h-32 text-sm text-white/10">Aguardando transações...</div>
            )}
          </div>
        </GlassPanel>
      </motion.div>

      {/* ═══ 4. RISK RADAR (Bento Box) ═══ */}
      <motion.div variants={fadeUp}>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/15 mb-3">Compliance & Risco</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* Live Fraud Feed */}
          <GlassPanel className="lg:col-span-1 max-h-[340px] overflow-hidden flex flex-col">
            <GlassPanelTitle color="red" icon={<ShieldAlert className="h-3.5 w-3.5" />}>Bloqueios Anti-Fraude</GlassPanelTitle>
            <div className="flex-1 overflow-y-auto mt-3 space-y-1.5 pr-1">
              {fraudLogs.length > 0 ? fraudLogs.slice(0, 12).map((f: any) => (
                <div key={f.id} className="p-2.5 rounded-xl bg-red-500/[0.03] border border-red-500/10 hover:bg-red-500/[0.06] transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    <span className="text-[10px] font-bold text-red-300 truncate">{f.block_reason || "Blocked"}</span>
                    <span className="ml-auto text-[8px] text-white/15">{new Date(f.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {f.block_type && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">{f.block_type}</span>}
                    {f.matched_type && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">{f.matched_type}</span>}
                    {f.customer_email && <span className="text-[8px] text-white/20 truncate">{f.customer_email}</span>}
                  </div>
                </div>
              )) : (
                <div className="flex items-center justify-center h-24 text-[11px] text-white/15">Nenhum bloqueio recente</div>
              )}
            </div>
          </GlassPanel>

          {/* Refund/Chargeback Trend */}
          <GlassPanel className="lg:col-span-1">
            <GlassPanelTitle color="amber" icon={<RotateCcw className="h-3.5 w-3.5" />}>Devoluções (7d)</GlassPanelTitle>
            <ResponsiveContainer width="100%" height={200} className="mt-3">
              <LineChart data={refundTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.1)" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.1)" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip fmtCurrency={fmtCurrency} />} />
                <Line type="monotone" dataKey="chargebacks" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} name="Chargebacks" />
                <Line type="monotone" dataKey="refunds" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} name="Reembolsos" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-[9px]"><span className="h-2 w-2 rounded-full bg-red-500" /><span className="text-white/30">Chargebacks</span></div>
              <div className="flex items-center gap-1.5 text-[9px]"><span className="h-2 w-2 rounded-full bg-amber-500" /><span className="text-white/30">Reembolsos</span></div>
            </div>
          </GlassPanel>

          {/* Risk Alerts */}
          <GlassPanel>
            <GlassPanelTitle color="violet" icon={<AlertTriangle className="h-3.5 w-3.5" />}>Alertas de Risco</GlassPanelTitle>
            <div className="space-y-3 mt-4">
              <RiskAlert
                label="Taxa Chargeback"
                value={`${chargebackRate.toFixed(2)}%`}
                threshold="< 1%"
                alert={chargebackAlert}
              />
              <RiskAlert
                label="Disputas Abertas"
                value={String(openDisputes)}
                threshold="< 5"
                alert={openDisputes > 5}
              />
              <RiskAlert
                label="Saques Pendentes"
                value={fmtCurrency(pendingWdAmount)}
                threshold={`${pendingWd.length} na fila`}
                alert={pendingWd.length > 10}
              />
              <RiskAlert
                label="Sellers Sem KYC"
                value={String(kycPending.length)}
                threshold="Aguardando aprovação"
                alert={kycPending.length > 0}
              />
            </div>
          </GlassPanel>
        </div>
      </motion.div>

      {/* ═══ 5. OPERATIONS: KYC + HIGH-VALUE WITHDRAWALS ═══ */}
      <motion.div variants={fadeUp}>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/15 mb-3">Fila Operacional</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* KYC Queue */}
          <GlassPanel>
            <div className="flex items-center justify-between mb-3">
              <GlassPanelTitle color="blue" icon={<UserCheck className="h-3.5 w-3.5" />}>
                Aprovações KYC Pendentes ({kycPending.length})
              </GlassPanelTitle>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {kycPending.slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all group">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-white/80 truncate">{p.full_name || "Sem nome"}</p>
                    <p className="text-[10px] text-white/25 truncate">{p.email}</p>
                    <p className="text-[9px] text-white/15 font-mono mt-0.5">{p.document_number || "Sem documento"}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" className="h-7 text-[9px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 gap-1 rounded-lg shadow-none font-bold"
                      onClick={() => onUserStatus(p.user_id, "approved")}>
                      <CheckCircle2 className="h-3 w-3" /> Aprovar
                    </Button>
                    <Button size="sm" className="h-7 text-[9px] bg-white/[0.03] text-white/30 hover:text-white/60 hover:bg-white/[0.06] border border-white/[0.06] gap-1 rounded-lg shadow-none font-bold"
                      onClick={() => {
                        window.open(`mailto:${p.email || ""}?subject=Verificação KYC - Documentação Pendente`, "_blank");
                        toast.info(`Abrindo análise de ${p.full_name || p.email || "seller"}`, { description: `Doc: ${p.document_number || "Não informado"} | Tipo: ${p.seller_type || "N/A"}` });
                      }}>
                      <Eye className="h-3 w-3" /> Analisar
                    </Button>
                  </div>
                </div>
              ))}
              {kycPending.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-white/10">
                  <CheckCircle2 className="h-6 w-6 mb-2" />
                  <p className="text-[11px]">Nenhum KYC pendente</p>
                </div>
              )}
            </div>
          </GlassPanel>

          {/* High-Value Withdrawals */}
          <GlassPanel>
            <div className="flex items-center justify-between mb-3">
              <GlassPanelTitle color="amber" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                Saques em Revisão ({highValueWd.length + pendingWd.filter(w => {
                  const p = profiles.find(pr => pr.user_id === w.user_id);
                  const days = p ? (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24) : 999;
                  return days < 30;
                }).length})
              </GlassPanelTitle>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {pendingWd.slice(0, 10).map(w => {
                const sp = profiles.find(p => p.user_id === w.user_id);
                const isNew = sp ? (Date.now() - new Date(sp.created_at).getTime()) / (1000 * 60 * 60 * 24) < 30 : false;
                const isHigh = Number(w.amount) >= 5000;
                if (!isNew && !isHigh) return null;
                return (
                  <div key={w.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-bold text-white/80">{fmtCurrency(Number(w.amount))}</p>
                         {isHigh && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">ALTO</span>}
                         {isNew && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">NOVO</span>}
                      </div>
                      <p className="text-[10px] text-white/25 truncate">{sp?.full_name || "—"} • {sp?.email || ""}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" className="h-7 text-[9px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 gap-1 rounded-lg shadow-none font-bold"
                        onClick={() => onWithdrawalAction(w.id, "approved")}>
                        <CheckCircle2 className="h-3 w-3" /> Aprovar
                      </Button>
                      <Button size="sm" className="h-7 text-[9px] bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 gap-1 rounded-lg shadow-none font-bold"
                        onClick={() => onWithdrawalAction(w.id, "rejected")}>
                        <XCircle className="h-3 w-3" /> Recusar
                      </Button>
                    </div>
                  </div>
                );
              })}
              {pendingWd.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-white/10">
                  <CheckCircle2 className="h-6 w-6 mb-2" />
                  <p className="text-[11px]">Nenhum saque pendente</p>
                </div>
              )}
            </div>
          </GlassPanel>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   SHARED COMPONENTS (exported for other tabs)
   ═══════════════════════════════════════════════ */

/* ── Hero KPI Card ── */
function HeroKpi({ icon, label, value, sub, gradient, metallic, alert, pulse }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  gradient: string; metallic?: boolean; alert?: boolean; pulse?: boolean;
}) {
  return (
    <motion.div variants={fadeUp} className="relative group">
      <div className={cn(
        "relative rounded-2xl p-6 overflow-hidden transition-all duration-300",
        "bg-gradient-to-b from-white/[0.04] to-white/[0.015] backdrop-blur-2xl border border-white/[0.07]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.35)]",
        "hover:border-white/[0.14] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_16px_48px_rgba(0,0,0,0.45)]",
        "hover:-translate-y-0.5",
        alert && "border-red-500/25 ring-1 ring-red-500/15",
        pulse && "animate-pulse"
      )}>
        {/* Gradient glow */}
        <div className={cn("absolute -top-20 -right-20 h-48 w-48 rounded-full blur-[80px] opacity-20 group-hover:opacity-35 transition-opacity duration-500 bg-gradient-to-br", gradient)} />
        {/* Bottom accent line */}
        <div className={cn("absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r opacity-20", gradient)} />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/25">{label}</span>
            <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg ring-1 ring-white/[0.12]", gradient)}>
              {icon}
            </div>
          </div>
          <p className={cn(
            "text-[32px] font-extrabold tracking-tight leading-none",
            metallic
              ? "bg-gradient-to-r from-white via-indigo-200 to-white bg-clip-text text-transparent"
              : alert ? "text-red-400" : "text-white"
          )}>
            {value}
          </p>
          {sub && <p className="text-[11px] text-white/25 mt-2 font-medium">{sub}</p>}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Glass KPI (smaller) ── */
function GlassKpi({ label, value, icon, iconColor }: {
  label: string; value: string; icon: React.ReactNode; iconColor?: string;
}) {
  return (
    <div className="rounded-xl bg-gradient-to-b from-white/[0.035] to-white/[0.015] backdrop-blur-2xl border border-white/[0.06] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:border-white/[0.1] transition-all group">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 font-bold">{label}</span>
        <div className={cn("h-7 w-7 rounded-lg bg-white/[0.05] flex items-center justify-center border border-white/[0.04]", iconColor || "text-white/30")}>
          {icon}
        </div>
      </div>
      <p className="text-lg font-extrabold tracking-tight text-white">{value}</p>
    </div>
  );
}

/* ── Glass Panel ── */
export function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-2xl bg-gradient-to-b from-white/[0.035] to-white/[0.01] backdrop-blur-2xl border border-white/[0.06] p-5",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_24px_rgba(0,0,0,0.25)]",
      "hover:border-white/[0.09] transition-all duration-300",
      className
    )}>
      {children}
    </div>
  );
}

/* ── Glass Panel Title ── */
export function GlassPanelTitle({ children, color, icon }: { children: React.ReactNode; color: string; icon?: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.6)]",
    emerald: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]",
    amber: "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]",
    blue: "bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.6)]",
    red: "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.6)]",
    violet: "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.6)]",
    cyan: "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]",
    zinc: "bg-zinc-400/40",
  };
  const textColorMap: Record<string, string> = {
    indigo: "text-indigo-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
    red: "text-red-400",
    violet: "text-violet-400",
    cyan: "text-cyan-400",
    zinc: "text-zinc-400",
  };
  return (
    <h3 className="text-[13px] font-bold flex items-center gap-2.5 text-white/85">
      <span className={cn("w-1 h-4 rounded-full", colorMap[color] || colorMap.indigo)} />
      {icon && <span className={textColorMap[color] || "text-indigo-400"}>{icon}</span>}
      {children}
    </h3>
  );
}

/* ── Risk Alert Row ── */
function RiskAlert({ label, value, threshold, alert }: { label: string; value: string; threshold: string; alert: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between p-3.5 rounded-xl transition-all",
      alert ? "bg-red-500/[0.06] border border-red-500/15" : "bg-white/[0.025] border border-white/[0.05]"
    )}>
      <div>
        <p className="text-[11px] font-semibold text-white/65">{label}</p>
        <p className="text-[9px] text-white/25 mt-0.5">{threshold}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <span className={cn("text-sm font-black", alert ? "text-red-400" : "text-emerald-400")}>{value}</span>
        {alert ? (
          <span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/50" />
        )}
      </div>
    </div>
  );
}

/* ── Legacy exports (backward compat with other tabs) ── */
export { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle };
export function AdminKpi({ icon, label, value, sub, alert, highlight, iconColor, gradient, glowColor }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  alert?: boolean; highlight?: boolean; iconColor?: string;
  gradient?: string; glowColor?: string;
}) {
  return (
    <div className={cn(
      "rounded-xl bg-gradient-to-b from-white/[0.04] to-white/[0.015] backdrop-blur-2xl border border-white/[0.07] p-4",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_16px_rgba(0,0,0,0.2)]",
      "hover:border-white/[0.1] transition-all duration-300",
      alert && "border-amber-500/20 ring-1 ring-amber-500/10"
    )}
      style={{ boxShadow: highlight && glowColor ? `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 35px ${glowColor}` : undefined }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-bold">{label}</span>
        {gradient ? (
          <div className={cn("h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-md ring-1 ring-white/[0.12]", gradient)}>{icon}</div>
        ) : (
          <div className={cn("h-9 w-9 rounded-lg bg-white/[0.05] flex items-center justify-center ring-1 ring-white/[0.05]", iconColor || "text-white/30")}>{icon}</div>
        )}
      </div>
      <p className={cn("text-xl font-extrabold tracking-tight text-white", highlight && "text-amber-400")}>{value}</p>
      {sub && <p className="text-[10px] text-white/25 mt-1.5 font-medium">{sub}</p>}
    </div>
  );
}
