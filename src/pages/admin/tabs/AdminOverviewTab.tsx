import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, Users, ArrowDownToLine,
  TrendingUp, CheckCircle2, XCircle,
  CreditCard, Package, BarChart3, Activity, Percent,
  ShieldAlert, RotateCcw, Lock, Eye, Radio,
  AlertCircle, UserCheck, Flame, Wallet, Target,
  CalendarDays, Clock3, Hourglass, UserPlus, Gauge,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid, type KpiTone } from "@/components/financeiro/FinanceiroHero";
import KycReviewDialog from "@/components/admin/KycReviewDialog";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import React from "react";

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
  onNavigate?: (tabId: string) => void;
}

/* ── Premium Recharts Tooltip — semantic tokens ── */
function ChartTooltip({ active, payload, label, fmtCurrency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pointer-events-none select-none rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      {label && <p className="mb-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.16em]">{label}</p>}
      <div className="space-y-1">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
              <span className="text-muted-foreground font-medium">{p.name}</span>
            </div>
            <span className="font-black tabular-nums text-foreground">
              {typeof p.value === "number" && p.value > 100 ? fmtCurrency(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Card primitive — exactly the Financeiro pattern ── */
function Panel({ children, className, title, icon, action, tone = "neutral" }: {
  children: React.ReactNode; className?: string;
  title?: string; icon?: React.ReactNode; action?: React.ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const toneAccent = {
    neutral:     "before:bg-transparent",
    primary:     "before:bg-primary",
    success:     "before:bg-success",
    warning:     "before:bg-warning",
    destructive: "before:bg-destructive",
    info:        "before:bg-info",
  }[tone];
  const toneIcon = {
    neutral:     "text-muted-foreground",
    primary:     "text-primary",
    success:     "text-success",
    warning:     "text-warning",
    destructive: "text-destructive",
    info:        "text-info",
  }[tone];
  return (
    <div className={cn(
      "relative rounded-[24px] border border-border/60 bg-card overflow-hidden flex flex-col transition-colors hover:border-primary/20",
      "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px]",
      toneAccent,
      className
    )}>
      {(title || icon) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            {icon && <span className={toneIcon}>{icon}</span>}
            <h3 className="text-[12px] font-black uppercase tracking-[0.16em] text-foreground/90">{title}</h3>
          </div>
          {action}
        </div>
      )}
      <div className="p-5 flex-1">{children}</div>
    </div>
  );
}

function StatusDot({ tone, pulse }: { tone: "success" | "warning" | "destructive" | "info" | "neutral"; pulse?: boolean }) {
  const cls = { success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", info: "bg-info", neutral: "bg-muted-foreground" }[tone];
  return <span className={cn("h-1.5 w-1.5 rounded-full", cls, pulse && "animate-pulse")} />;
}


export default function AdminOverviewTab({ transactions, profiles, products, withdrawals, onWithdrawalAction, onUserStatus, fmtCurrency, isEmployee = false, dateRange, onNavigate }: Props) {
 const [disputes, setDisputes] = useState<Dispute[]>([]);
 const [realtimeTx, setRealtimeTx] = useState<Tables<"transactions">[]>([]);
 const [chartPeriod, setChartPeriod] = useState<"7d" | "30d">("7d");
 const [fraudLogs, setFraudLogs] = useState<any[]>([]);
 const [kycReview, setKycReview] = useState<Tables<"profiles"> | null>(null);

 const handleKycApprove = async (userId: string) => {
   const { error } = await supabase.from("profiles").update({
     account_status: "approved",
     kyc_rejection_reason: null,
   } as any).eq("user_id", userId);
   if (error) { toast.error("Erro ao aprovar KYC"); return; }
   toast.success("KYC aprovado!");
   onUserStatus(userId, "approved");
 };

 const handleKycReject = async (userId: string, reason: string) => {
   const { error } = await supabase.from("profiles").update({
     account_status: "rejected",
     kyc_rejection_reason: reason,
   } as any).eq("user_id", userId);
   if (error) { toast.error("Erro ao recusar KYC"); return; }
   toast.success("KYC recusado");
   onUserStatus(userId, "rejected");
 };



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

 // Lucro últimos 30 dias (fixo, independente do dateRange)
 const last30Start = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; }, []);
 const last30Tx = useMemo(() => approved.filter(t => new Date(t.created_at) >= last30Start), [approved, last30Start]);
 const profit30d = last30Tx.reduce((a, t) => a + Number(t.fee_amount), 0);

 // MEDs pendentes para o card
 const pendingMeds = useMemo(
   () => disputes.filter(d => d.status === "open" || d.status === "in_review"),
   [disputes]
 );
 const pendingMedsAmount = pendingMeds.reduce((a, d) => a + Number(d.amount), 0);

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

  /* ── Sparkline data (last 14 days, per metric) ── */
  const sparkSeries = useMemo(() => {
    const buckets = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      const key = d.toDateString();
      const txs = approved.filter(t => new Date(t.created_at).toDateString() === key);
      const all = allTx.filter(t => new Date(t.created_at).toDateString() === key);
      return {
        vendas: txs.length,
        tpv: txs.reduce((a, t) => a + Number(t.amount), 0),
        conv: all.length > 0 ? (txs.length / all.length) * 100 : 0,
        cb: all.filter(t => t.status === "chargeback").length,
      };
    });
    return {
      vendas: buckets.map(b => ({ v: b.vendas })),
      conv: buckets.map(b => ({ v: b.conv })),
      cb: buckets.map(b => ({ v: b.cb })),
      tpv: buckets.map(b => ({ v: b.tpv })),
    };
  }, [approved, allTx]);

 const kycPending = profiles.filter(p => p.account_status === "pending_review" || p.account_status === "pending");
 const highValueWd = pendingWd.filter(w => Number(w.amount) >= 5000);
 const newUsersInRange = useMemo(() => profiles.filter(p => {
  if (!dateRange) return new Date(p.created_at).toDateString() === todayStr;
  const d = new Date(p.created_at);
  return d >= dateRange.from && d <= dateRange.to;
 }), [profiles, dateRange, todayStr]);
 const rangeLabel = useMemo(() => {
  if (!dateRange) return "Período selecionado";
  const sameDay = dateRange.from.toDateString() === dateRange.to.toDateString();
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return sameDay ? `${fmt(dateRange.from)} · por horário` : `${fmt(dateRange.from)} → ${fmt(dateRange.to)}`;
 }, [dateRange]);
 const hourlyData = useMemo(() => Array.from({ length: 24 }, (_, hour) => {
  const txs = filteredApproved.filter(t => new Date(t.created_at).getHours() === hour);
  return {
    hour: `${String(hour).padStart(2, "0")}h`,
    tpv: txs.reduce((a, t) => a + Number(t.amount), 0),
    lucro: txs.reduce((a, t) => a + Number(t.fee_amount), 0),
    vendas: txs.length,
  };
 }), [filteredApproved]);

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
      <div className="space-y-5 animate-fade-in">
        <FinanceiroHero
          eyebrow="Painel Staff"
          title="Visão geral"
          subtitle="Acesso restrito a operações autorizadas."
        />
        <FinanceiroKpiGrid cols={4}>
          <FinanceiroKpi label="Sellers" value={String(profiles.length)} sub="Cadastrados" icon={Users} tone="primary" />
          <FinanceiroKpi label="Produtos" value={String(products.length)} sub={`${products.filter(p => p.status === "active").length} ativos`} icon={Package} tone="info" />
          <FinanceiroKpi label="Transações" value={String(allTx.length)} sub={`${approved.length} aprovadas`} icon={CreditCard} tone="success" />
          <FinanceiroKpi label="Conversão" value={`${conversionRate}%`} sub={`${approved.length}/${allTx.length}`} icon={Percent} tone="warning" />
        </FinanceiroKpiGrid>
      </div>
    );
  }

  const heroKpis: { label: string; value: string; sub: string; icon: any; tone: KpiTone; spark: { v: number }[]; nav?: string }[] = [
    { label: "Movimentado Hoje", value: fmtCurrency(tpvToday), sub: `${todayTx.length} vendas aprovadas`, icon: Flame, tone: todayTx.length > 0 ? "success" : "neutral", spark: sparkSeries.tpv, nav: "transactions" },
    { label: "Lucro Hoje", value: fmtCurrency(takeRateToday), sub: `${activeSellersToday} sellers venderam`, icon: DollarSign, tone: "primary", spark: sparkSeries.tpv, nav: "transactions" },
    { label: "Saques Pendentes", value: fmtCurrency(pendingWdAmount), sub: `${pendingWd.length} solicitações · ${highValueWd.length} altos`, icon: Hourglass, tone: pendingWd.length > 5 ? "warning" : "neutral", spark: sparkSeries.vendas, nav: "withdrawals" },
    { label: "Novos Usuários", value: String(newUsersInRange.length), sub: "cadastros no período", icon: UserPlus, tone: "info", spark: sparkSeries.vendas, nav: "sellers" },
    { label: "Lucro Últimos 30 Dias", value: fmtCurrency(profit30d), sub: `${last30Tx.length} vendas · ${takeRatePct}% take rate`, icon: TrendingUp, tone: "success", spark: sparkSeries.tpv, nav: "analytics" },
    { label: "MEDs Pendentes", value: String(pendingMeds.length), sub: pendingMeds.length > 0 ? `${fmtCurrency(pendingMedsAmount)} em disputa` : "Nenhum em aberto", icon: AlertCircle, tone: pendingMeds.length > 0 ? "destructive" : "neutral", spark: sparkSeries.cb, nav: "medpix" },
    { label: "Aprovações KYC", value: String(kycPending.length), sub: "usuários aguardando análise", icon: UserCheck, tone: kycPending.length > 0 ? "warning" : "neutral", spark: sparkSeries.vendas, nav: "sellers" },
    { label: "Saldo Retido", value: fmtCurrency(totalRetained), sub: "aguardando liberação", icon: Lock, tone: "warning", spark: sparkSeries.tpv, nav: "transactions" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Command Center Hero ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-24 h-[420px] w-[640px] rounded-full opacity-40" style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent 70%)" }} />
          <div className="absolute -bottom-40 -right-32 h-[420px] w-[640px] rounded-full opacity-30" style={{ background: "radial-gradient(closest-side, hsl(var(--success) / 0.18), transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-0">
          <div className="p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-border/60">
            <div className="flex items-center gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[9.5px] font-black uppercase tracking-[0.22em] text-success">Live</span>
              </span>
              <span className="text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">Plataforma · Command Center</span>
            </div>
            <h1 className="font-display text-[32px] sm:text-[52px] lg:text-[64px] font-black leading-[0.92] tracking-[-0.035em] text-foreground tabular-nums">
              {fmtCurrency(totalVolume)}
            </h1>
            <p className="mt-3 text-[12px] sm:text-[13px] text-muted-foreground/85 leading-relaxed max-w-2xl">
              Volume movimentado no período · {rangeLabel}
            </p>

            <div className="mt-6 grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-border/60 bg-border/40">
              <HeroStat label="Lucro" value={fmtCurrency(takeRateTotal)} accent="text-success" />
              <HeroStat label="Take Rate" value={`${takeRatePct}%`} accent="text-primary" />
              <HeroStat label="Ticket Médio" value={fmtCurrency(ticketMedio)} accent="text-info" />
            </div>
          </div>

          <div className="p-6 sm:p-8 flex flex-col justify-between gap-5">
            <div>
              <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/70 mb-3">Pulso 14 dias</p>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={sparkSeries.tpv.map((p, i) => ({ ...p, name: i }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#heroSpark)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <PulseBadge icon={Activity} label="Conversão" value={`${conversionRate}%`} tone="success" />
              <PulseBadge icon={CheckCircle2} label="Aprovadas" value={String(filteredApproved.length)} tone="primary" />
              <PulseBadge icon={ShieldAlert} label="Chargeback" value={`${chargebackRate.toFixed(2)}%`} tone={chargebackAlert ? "destructive" : "neutral"} />
              <PulseBadge icon={Users} label="Sellers Ativos" value={String(activeSellersToday)} tone="info" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Premium KPI Grid with sparklines ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {heroKpis.map((k, i) => <MetricCard key={i} {...k} onClick={k.nav && onNavigate ? () => onNavigate(k.nav!) : undefined} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          className="xl:col-span-3"
          title="Movimento por horário"
          icon={<Clock3 className="h-3.5 w-3.5" />}
          tone="primary"
          action={<span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{rangeLabel}</span>}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
              <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={1} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip cursor={{ fill: "hsl(var(--primary) / 0.08)" }} content={<ChartTooltip fmtCurrency={fmtCurrency} />} />
              <Bar dataKey="tpv" name="TPV" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={900} />
              <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={1100} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          className="xl:col-span-2"
          title="Volume & Take Rate"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          tone="success"
          action={
            <div className="flex gap-0.5 bg-muted/30 border border-border/40 rounded-md p-0.5">
              {(["7d", "30d"] as const).map(f => (
                <button key={f} onClick={() => setChartPeriod(f)}
                  className={cn(
                    "px-2.5 py-1 rounded text-[10px] font-bold transition-colors",
                    chartPeriod === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}>{f}</button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="tpvArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3, strokeWidth: 1 }} content={<ChartTooltip fmtCurrency={fmtCurrency} />} />
              <Area type="monotone" dataKey="tpv" name="TPV" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#tpvArea)" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="takeRate" name="Take Rate" stroke="hsl(var(--warning))" fillOpacity={0} strokeWidth={1.5} strokeDasharray="4 2" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Métodos de Pagamento" icon={<CreditCard className="h-3.5 w-3.5" />} tone="info">
          <div className="space-y-3.5">
            {methodApproval.sort((a, b) => b.volume - a.volume).map(m => {
              const tone: "success" | "warning" | "destructive" = m.rate >= 85 ? "success" : m.rate >= 60 ? "warning" : "destructive";
              const barCls = { success: "bg-success", warning: "bg-warning", destructive: "bg-destructive" }[tone];
              const txtCls = { success: "text-success", warning: "text-warning", destructive: "text-destructive" }[tone];
              return (
                <div key={m.method}>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <StatusDot tone={tone} />
                      <span className="font-semibold text-foreground/85">{m.method}</span>
                    </div>
                    <span className={cn("font-black tabular-nums", txtCls)}>{m.rate.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div className={cn("h-full transition-all duration-500", barCls)} style={{ width: `${m.rate}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground/70 mt-1 tabular-nums">
                    <span>{fmtCurrency(m.volume)}</span>
                    <span>{m.approved}/{m.total} tx</span>
                  </div>
                </div>
              );
            })}
            {methodApproval.length === 0 && <div className="text-center text-[11px] text-muted-foreground py-6">Sem dados no período</div>}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Atividade ao vivo" icon={<Radio className="h-3.5 w-3.5 text-destructive animate-pulse" />} tone="destructive" className="max-h-[420px]">
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            {realtimeTx.length === 0 && <div className="text-center text-[11px] text-muted-foreground py-8">Aguardando transações...</div>}
            {realtimeTx.map(t => {
              const isOk = t.status === "completed" || t.status === "approved";
              const isPending = t.status === "pending";
              const tone: "success" | "warning" | "destructive" = isOk ? "success" : isPending ? "warning" : "destructive";
              return (
                <div key={t.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
                  <StatusDot tone={tone} pulse={isPending} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[12px] font-bold text-foreground tabular-nums">{fmtCurrency(Number(t.amount))}</span>
                      <span className={cn("text-[8px] font-bold uppercase tracking-widest",
                        tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive")}>
                        {statusLabelMap[t.status] || t.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/80">
                      <span className="truncate max-w-[120px]">{t.customer_name || "Anônimo"}</span>
                      <span>·</span>
                      <span className="uppercase">{t.payment_method || "—"}</span>
                      <span className="ml-auto tabular-nums">{new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Devoluções · 7 dias" icon={<RotateCcw className="h-3.5 w-3.5" />} tone="warning">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={refundTrend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ stroke: "hsl(var(--border))" }} content={<ChartTooltip fmtCurrency={fmtCurrency} />} />
              <Line type="monotone" dataKey="chargebacks" name="Chargebacks" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 2.5, fill: "hsl(var(--destructive))" }} isAnimationActive={false} />
              <Line type="monotone" dataKey="refunds" name="Reembolsos" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 2.5, fill: "hsl(var(--warning))" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-[10px]"><StatusDot tone="destructive" /><span className="text-muted-foreground">Chargebacks</span></div>
            <div className="flex items-center gap-1.5 text-[10px]"><StatusDot tone="warning" /><span className="text-muted-foreground">Reembolsos</span></div>
          </div>
        </Panel>

        <Panel title="Alertas de Risco" icon={<ShieldAlert className="h-3.5 w-3.5" />} tone="destructive">
          <div className="space-y-2">
            <RiskRow label="Taxa de Chargeback" value={`${chargebackRate.toFixed(2)}%`} threshold="< 1%" alert={chargebackAlert} />
            <RiskRow label="Disputas Abertas" value={String(openDisputes)} threshold="< 5" alert={openDisputes > 5} />
            <RiskRow label="Saques Pendentes" value={fmtCurrency(pendingWdAmount)} threshold={`${pendingWd.length} na fila`} alert={pendingWd.length > 10} />
            <RiskRow label="KYC Pendente" value={String(kycPending.length)} threshold="aguardando aprovação" alert={kycPending.length > 0} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`Aprovações KYC (${kycPending.length})`} icon={<UserCheck className="h-3.5 w-3.5" />} tone={kycPending.length > 0 ? "warning" : "neutral"}>
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {kycPending.slice(0, 10).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setKycReview(p)}
                className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/40 hover:border-warning/40 hover:bg-warning/5 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-foreground truncate">{p.full_name || "Sem nome"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                  <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">{p.document_number || "Sem documento"}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => { e.stopPropagation(); handleKycApprove(p.user_id); }}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[10px] font-bold border border-success/30 text-success hover:bg-success/10 transition-colors"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Aprovar
                  </span>
                  <span
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[10px] font-bold border border-warning/30 text-warning bg-warning/5 group-hover:bg-warning/15 transition-colors"
                  >
                    <Eye className="h-3 w-3" /> Analisar
                  </span>
                </div>
              </button>
            ))}
            {kycPending.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50">
                <CheckCircle2 className="h-6 w-6 mb-2" />
                <p className="text-[11px]">Nenhum KYC pendente</p>
              </div>
            )}
          </div>
        </Panel>


        <Panel title={`Saques em revisão (${pendingWd.length})`} icon={<Wallet className="h-3.5 w-3.5" />} tone={pendingWd.length > 0 ? "info" : "neutral"}>
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {pendingWd.slice(0, 10).map(w => {
              const sp = profiles.find(p => p.user_id === w.user_id);
              const isNew = sp ? (Date.now() - new Date(sp.created_at).getTime()) / (1000 * 60 * 60 * 24) < 30 : false;
              const isHigh = Number(w.amount) >= 5000;
              return (
                <div key={w.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-bold text-foreground tabular-nums">{fmtCurrency(Number(w.amount))}</p>
                      {isHigh && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/25">ALTO</span>}
                      {isNew && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/25">NOVO</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{sp?.full_name || "—"} · {sp?.email || ""}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-success/30 text-success hover:bg-success/10 hover:text-success" onClick={() => onWithdrawalAction(w.id, "approved")}>
                      <CheckCircle2 className="h-3 w-3" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onWithdrawalAction(w.id, "rejected")}>
                      <XCircle className="h-3 w-3" /> Recusar
                    </Button>
                  </div>
                </div>
              );
            })}
            {pendingWd.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50">
                <CheckCircle2 className="h-6 w-6 mb-2" />
                <p className="text-[11px]">Nenhum saque pendente</p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Bloqueios Anti-Fraude" icon={<ShieldAlert className="h-3.5 w-3.5 text-destructive" />} tone="destructive">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
          {fraudLogs.length > 0 ? fraudLogs.slice(0, 20).map((f: any) => (
            <div key={f.id} className="px-3 py-2 rounded-lg border border-destructive/20 bg-destructive/5">
              <div className="flex items-center gap-2 mb-1">
                <StatusDot tone="destructive" />
                <span className="text-[11px] font-bold text-destructive truncate">{f.block_reason || "Blocked"}</span>
                <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">{new Date(f.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {f.block_type && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">{f.block_type}</span>}
                {f.matched_type && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">{f.matched_type}</span>}
                {f.customer_email && <span className="text-[9px] text-muted-foreground truncate">{f.customer_email}</span>}
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-8 text-[11px] text-muted-foreground">Nenhum bloqueio recente</div>
          )}
        </div>
      </Panel>

      <KycReviewDialog
        profile={kycReview}
        open={!!kycReview}
        onClose={() => setKycReview(null)}
        onApprove={handleKycApprove}
        onReject={handleKycReject}
      />
    </div>
  );
}

/* ── Hero internals ── */
function HeroStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-card px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
      <p className={cn("mt-1 font-display text-[15px] sm:text-[17px] font-black tabular-nums leading-none", accent)}>{value}</p>
    </div>
  );
}

function PulseBadge({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "success" | "primary" | "info" | "warning" | "destructive" | "neutral" }) {
  const t = {
    success: "text-success border-success/25 bg-success/5",
    primary: "text-primary border-primary/25 bg-primary/5",
    info: "text-info border-info/25 bg-info/5",
    warning: "text-warning border-warning/25 bg-warning/5",
    destructive: "text-destructive border-destructive/25 bg-destructive/5",
    neutral: "text-muted-foreground border-border bg-muted/20",
  }[tone];
  return (
    <div className={cn("flex items-center justify-between rounded-xl border px-3 py-2.5", t)}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
        <span className="text-[10px] font-bold uppercase tracking-wider truncate">{label}</span>
      </div>
      <span className="text-[12px] font-black tabular-nums shrink-0">{value}</span>
    </div>
  );
}

/* ── Metric Card with sparkline ── */
function MetricCard({ label, value, sub, icon: Icon, tone, spark, onClick }: { label: string; value: string; sub?: string; icon: any; tone: KpiTone; spark: { v: number }[]; onClick?: () => void }) {
  const toneText: Record<KpiTone, string> = {
    success: "text-success", info: "text-info", warning: "text-warning",
    neutral: "text-foreground", destructive: "text-destructive", primary: "text-primary",
  };
  const toneStroke: Record<KpiTone, string> = {
    success: "hsl(var(--success))", info: "hsl(var(--info))", warning: "hsl(var(--warning))",
    neutral: "hsl(var(--muted-foreground))", destructive: "hsl(var(--destructive))", primary: "hsl(var(--primary))",
  };
  const toneBg: Record<KpiTone, string> = {
    success: "bg-success/10 text-success", info: "bg-info/10 text-info", warning: "bg-warning/10 text-warning",
    neutral: "bg-muted/40 text-muted-foreground", destructive: "bg-destructive/10 text-destructive", primary: "bg-primary/10 text-primary",
  };
  const toneRail: Record<KpiTone, string> = {
    success: "bg-success", info: "bg-info", warning: "bg-warning",
    neutral: "bg-border", destructive: "bg-destructive", primary: "bg-primary",
  };
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 text-left w-full",
        onClick && "cursor-pointer hover:-translate-y-0.5"
      )}
    >
      <div className={cn("absolute top-0 left-0 right-0 h-[2px]", toneRail[tone])} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9.5px] font-black uppercase tracking-[0.18em] text-muted-foreground/70 truncate">{label}</p>
          <p className={cn("mt-2 font-display text-[22px] sm:text-[24px] font-black leading-none tabular-nums tracking-tight break-all", toneText[tone])}>{value}</p>
          {sub && <p className="mt-2 text-[10.5px] text-muted-foreground/75 truncate">{sub}</p>}
        </div>
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", toneBg[tone])}>
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
      </div>
      <div className="mt-3 -mx-1 h-10 opacity-90 group-hover:opacity-100 transition-opacity">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={toneStroke[tone]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={toneStroke[tone]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={toneStroke[tone]} strokeWidth={1.75} fill={`url(#spark-${label.replace(/\s/g, "")})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Comp>
  );
}


/* ── Risk Row (Financeiro style) ── */
function RiskRow({ label, value, threshold, alert }: { label: string; value: string; threshold: string; alert: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors",
      alert ? "bg-destructive/5 border-destructive/25" : "bg-muted/20 border-border/40"
    )}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-foreground/85">{label}</p>
        <p className="text-[9px] text-muted-foreground/70 mt-0.5">{threshold}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn("text-[13px] font-black tabular-nums", alert ? "text-destructive" : "text-success")}>{value}</span>
        {alert
          ? <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
          : <CheckCircle2 className="h-3.5 w-3.5 text-success/70" />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
 SHARED COMPONENTS (exported for other tabs)
 ═══════════════════════════════════════════════ */

/* ── Hero KPI Card ── */
function HeroKpi({ icon, label, value, sub, gradient, metallic, alert }: {
 icon: React.ReactNode; label: string; value: string; sub?: string;
 gradient: string; metallic?: boolean; alert?: boolean; pulse?: boolean;
}) {
 return (
 <div className="relative group">
 <div className={cn(
 "relative isolate overflow-hidden rounded-2xl border p-5 sm:p-6 transition-all duration-300",
 "border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02]",
 "shadow-[0_16px_48px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]",
 "hover:border-white/[0.14] hover:shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_0_1px_rgba(16,185,129,0.1)]",
 alert && "border-red-500/25 ring-1 ring-red-500/10"
 )}>
 <div className={cn("absolute -top-20 -right-20 h-48 w-48 rounded-full blur-[80px] opacity-[0.18] group-hover:opacity-[0.28] transition-opacity duration-700 bg-gradient-to-br", gradient)} />
 <div className={cn("absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r opacity-25", gradient)} />

 <div className="relative z-10">
 <div className="mb-3 sm:mb-4 flex items-center justify-between">
 <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/35">{label}</span>
 <div className={cn("h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg ring-1 ring-white/[0.15]", gradient)}>
 {icon}
 </div>
 </div>
 <p className={cn(
 "text-[26px] sm:text-[32px] font-extrabold leading-none tracking-[-0.02em]",
 metallic ? "bg-gradient-to-r from-white via-emerald-200 to-white bg-clip-text text-transparent" : alert ? "text-red-400" : "text-white"
 )} style={{ fontFamily: "'Space Grotesk', monospace", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
 {value}
 </p>
 {sub && <p className="mt-2 sm:mt-2.5 text-[11px] font-medium text-white/40">{sub}</p>}
 </div>
 </div>
 </div>
 );
}

/* ── Glass KPI (smaller) ── */
function GlassKpi({ label, value, icon, iconColor }: {
 label: string; value: string; icon: React.ReactNode; iconColor?: string;
}) {
 return (
 <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-3.5 sm:p-4 shadow-[0_10px_24px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:border-white/[0.12] group">
 <div className="mb-2 sm:mb-2.5 flex items-center justify-between">
 <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-white/30">{label}</span>
 <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05]", iconColor || "text-white/40")}>{icon}</div>
 </div>
 <p className="text-base sm:text-lg font-extrabold tracking-tight text-white/95" style={{ fontFamily: "'Space Grotesk', monospace", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>{value}</p>
 </div>
 );
}

/* ═══════════════════════════════════════════════
 SHARED ADMIN KIT — Billion-Dollar SaaS / Seller-pattern
 Semantic tokens only. Used across all admin tabs.
 ═══════════════════════════════════════════════ */

const ACCENT_MAP: Record<string, { stripe: string; text: string; bg: string }> = {
  emerald: { stripe: "bg-success",        text: "text-success",        bg: "bg-success/10" },
  green:   { stripe: "bg-success",        text: "text-success",        bg: "bg-success/10" },
  teal:    { stripe: "bg-info",           text: "text-info",           bg: "bg-info/10" },
  blue:    { stripe: "bg-info",           text: "text-info",           bg: "bg-info/10" },
  cyan:    { stripe: "bg-info",           text: "text-info",           bg: "bg-info/10" },
  indigo:  { stripe: "bg-primary",        text: "text-primary",        bg: "bg-primary/10" },
  violet:  { stripe: "bg-primary",        text: "text-primary",        bg: "bg-primary/10" },
  amber:   { stripe: "bg-warning",        text: "text-warning",        bg: "bg-warning/10" },
  red:     { stripe: "bg-destructive",    text: "text-destructive",    bg: "bg-destructive/10" },
  zinc:    { stripe: "bg-muted-foreground/40", text: "text-muted-foreground", bg: "bg-muted/40" },
};

/* ── Panel: semantic, sharp 1px border ── */
export function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "relative rounded-2xl border border-border/60 bg-card p-5 overflow-hidden transition-colors hover:border-primary/20",
      className
    )}>
      {children}
    </div>
  );
}

/* ── Panel section title — accent stripe + icon + uppercase label ── */
export function GlassPanelTitle({ children, color, icon }: { children: React.ReactNode; color: string; icon?: React.ReactNode }) {
  const c = ACCENT_MAP[color] || ACCENT_MAP.emerald;
  return (
    <h3 className="flex items-center gap-2.5 text-[12px] font-black uppercase tracking-[0.16em] text-foreground/90">
      <span className={cn("h-4 w-[3px] rounded-full", c.stripe)} />
      {icon && <span className={c.text}>{icon}</span>}
      {children}
    </h3>
  );
}

/* ── Risk Alert Row ── */
function RiskAlert({ label, value, threshold, alert }: { label: string; value: string; threshold: string; alert: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors",
      alert ? "bg-destructive/5 border-destructive/25" : "bg-muted/20 border-border/40"
    )}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-foreground/85">{label}</p>
        <p className="text-[9px] text-muted-foreground/70 mt-0.5">{threshold}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn("text-[13px] font-black tabular-nums", alert ? "text-destructive" : "text-success")}>{value}</span>
        {alert
          ? <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
          : <CheckCircle2 className="h-3.5 w-3.5 text-success/70" />}
      </div>
    </div>
  );
}

/* ── Legacy aliases ── */
export { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle };

/* ── Admin KPI — premium, semantic, 1px borders, tabular nums ── */
export function AdminKpi({ icon, label, value, sub, alert, highlight, iconColor, gradient, glowColor }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  alert?: boolean; highlight?: boolean; iconColor?: string;
  gradient?: string; glowColor?: string;
}) {
  // Map legacy `gradient` like "from-emerald-500 to-..." to a semantic tone
  const tone = gradient?.includes("emerald") || gradient?.includes("green") ? "success"
    : gradient?.includes("amber") || gradient?.includes("orange") || gradient?.includes("yellow") ? "warning"
    : gradient?.includes("red") || gradient?.includes("rose") || gradient?.includes("pink") ? "destructive"
    : gradient?.includes("blue") || gradient?.includes("cyan") || gradient?.includes("sky") || gradient?.includes("teal") ? "info"
    : gradient?.includes("violet") || gradient?.includes("indigo") || gradient?.includes("purple") ? "primary"
    : "neutral";
  const toneText: Record<string, string> = {
    success: "text-success", info: "text-info", warning: "text-warning",
    destructive: "text-destructive", primary: "text-primary", neutral: "text-foreground",
  };
  const toneIcon: Record<string, string> = {
    success: "bg-success/10 text-success", info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning", destructive: "bg-destructive/10 text-destructive",
    primary: "bg-primary/10 text-primary", neutral: "bg-secondary text-muted-foreground",
  };
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-border/60 bg-card px-4 py-4 sm:px-5 sm:py-5",
      "transition-colors hover:border-primary/25",
      "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px]",
      tone === "success" && "before:bg-success",
      tone === "info" && "before:bg-info",
      tone === "warning" && "before:bg-warning",
      tone === "destructive" && "before:bg-destructive",
      tone === "primary" && "before:bg-primary",
      tone === "neutral" && "before:bg-transparent",
      alert && "border-destructive/40 before:bg-destructive",
      highlight && "border-warning/40 before:bg-warning",
    )}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80 leading-tight break-words">{label}</span>
        <div className={cn(
          "h-7 w-7 sm:h-8 sm:w-8 rounded-md flex items-center justify-center shrink-0",
          toneIcon[tone]
        )}>
          <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        </div>
      </div>
      <p className={cn(
        "font-display text-[20px] sm:text-[24px] font-black leading-none tracking-tight tabular-nums break-all",
        toneText[tone],
        alert && "text-destructive",
        highlight && "text-warning",
      )}>{value}</p>
      {sub && <p className="mt-2 text-[10px] sm:text-[11px] text-muted-foreground/70 font-medium truncate">{sub}</p>}
    </div>
  );
}
