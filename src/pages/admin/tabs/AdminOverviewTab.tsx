import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, Users, TrendingUp, CheckCircle2, XCircle,
  CreditCard, Package, Activity, Percent, ShieldAlert, RotateCcw, Lock,
  Eye, Radio, AlertCircle, UserCheck, Flame, Wallet, CalendarDays,
  Clock3, Hourglass, UserPlus, ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line,
} from "recharts";
import KycReviewDialog from "@/components/admin/KycReviewDialog";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import React from "react";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import {
  PremiumPanel, PremiumMetric, PremiumMetricGrid, PremiumSegmented, premiumTable,
} from "./AdminPremium";

interface Dispute {
  id: string; type: string; status: string; seller_user_id: string;
  amount: number; created_at: string; transaction_id: string | null;
}

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

type Tone = "primary" | "success" | "warning" | "destructive" | "info" | "neutral";

/* ═════════════════════════════════════════════════════════════
   PREMIUM KIT — soft surfaces, generous radius, semantic tokens
   Inspired by AdminTopSellersTab. Works in light + dark via the
   admin-shell token cascade.
   ═════════════════════════════════════════════════════════════ */

const TONE_TEXT: Record<Tone, string> = {
  primary:     "text-primary",
  success:     "text-success",
  warning:     "text-warning",
  destructive: "text-destructive",
  info:        "text-info",
  neutral:     "text-foreground",
};
const TONE_PILL: Record<Tone, string> = {
  primary:     "bg-primary/10 text-primary border-primary/20",
  success:     "bg-success/10 text-success border-success/20",
  warning:     "bg-warning/10 text-warning border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  info:        "bg-info/10 text-info border-info/20",
  neutral:     "bg-muted/40 text-muted-foreground border-border/60",
};
const TONE_BAR: Record<Tone, string> = {
  primary:     "bg-primary",
  success:     "bg-success",
  warning:     "bg-warning",
  destructive: "bg-destructive",
  info:        "bg-info",
  neutral:     "bg-muted-foreground",
};

function Pill({ tone = "neutral", children, className }: {
  tone?: Tone; children: React.ReactNode; className?: string;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[9.5px] font-black uppercase tracking-wider",
      TONE_PILL[tone], className,
    )}>
      {children}
    </span>
  );
}

/* Tooltip — solid card, rounded, no glow */
type ChartTipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
  fmtCurrency: (n: number) => string;
};
function ChartTip({ active, payload, label, fmtCurrency }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm pointer-events-none">
      {label && (
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </span>
            <span className="font-bold tabular-nums text-foreground">
              {typeof p.value === "number" && p.value > 100 ? fmtCurrency(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   COMPONENT
   ═════════════════════════════════════════════════════════════ */

export default function AdminOverviewTab({
  transactions, profiles, products, withdrawals,
  onWithdrawalAction, onUserStatus, fmtCurrency,
  isEmployee = false, dateRange, onNavigate,
}: Props) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [realtimeTx, setRealtimeTx] = useState<Tables<"transactions">[]>([]);
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d">("7d");
  const [fraudLogs, setFraudLogs] = useState<Tables<"fraud_logs">[]>([]);
  const [kycReview, setKycReview] = useState<Tables<"profiles"> | null>(null);

  const handleKycApprove = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({
      account_status: "approved", kyc_rejection_reason: null,
    }).eq("user_id", userId);
    if (error) { toast.error("Erro ao aprovar KYC"); return; }
    toast.success("KYC aprovado!");
    onUserStatus(userId, "approved");
  };

  const handleKycReject = async (userId: string, reason: string) => {
    const { error } = await supabase.from("profiles").update({
      account_status: "rejected", kyc_rejection_reason: reason,
    }).eq("user_id", userId);
    if (error) { toast.error("Erro ao recusar KYC"); return; }
    toast.success("KYC recusado");
    onUserStatus(userId, "rejected");
  };

  useEffect(() => {
    Promise.all([
      supabase.from("disputes").select("id,type,status,seller_user_id,amount,created_at,transaction_id"),
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
        setRealtimeTx(prev => prev.map(t => t.id === (payload.new as Tables<"transactions">).id ? payload.new as Tables<"transactions"> : t));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [transactions]);

  /* ── Computations (preserved verbatim) ── */
  const allTx = transactions;
  const approved = useMemo(() => allTx.filter(t => t.status === "approved" || t.status === "completed"), [allTx]);
  const filteredTx = useMemo(() => {
    if (!dateRange) return allTx;
    return allTx.filter(t => { const d = new Date(t.created_at); return d >= dateRange.from && d <= dateRange.to; });
  }, [allTx, dateRange]);
  const filteredApproved = useMemo(() => filteredTx.filter(t => t.status === "approved" || t.status === "completed"), [filteredTx]);

  // Fuso São Paulo (America/Sao_Paulo) — normaliza "hoje" para o dia comercial brasileiro
  const spDayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const spMonthKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(d);
  const today = new Date();
  const todayStr = spDayKey(today);
  const thisMonthKey = spMonthKey(today);
  const todayTx = useMemo(() => approved.filter(t => spDayKey(new Date(t.created_at)) === todayStr), [approved, todayStr]);
  const monthTx = useMemo(() => approved.filter(t => spMonthKey(new Date(t.created_at)) === thisMonthKey), [approved, thisMonthKey]);

  const tpvToday = todayTx.reduce((a, t) => a + Number(t.amount), 0);
  const tpvMonth = monthTx.reduce((a, t) => a + Number(t.amount), 0);
  const totalVolume = filteredApproved.reduce((a, t) => a + Number(t.amount), 0);
  const takeRateToday = todayTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const takeRateTotal = filteredApproved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const takeRatePct = totalVolume > 0 ? ((takeRateTotal / totalVolume) * 100).toFixed(2) : "0.00";

  const pendingWd = withdrawals.filter(w => w.status === "pending");
  const pendingWdAmount = pendingWd.reduce((a, w) => a + Number(w.amount), 0);
  const totalRetained = filteredApproved
    .filter(t => !t.retention_released && Number(t.retained_amount) > 0)
    .reduce((a, t) => a + Number(t.retained_amount), 0);

  const chargebackTx = filteredTx.filter(t => t.status === "chargeback");
  const chargebackRate = filteredApproved.length > 0 ? ((chargebackTx.length / filteredApproved.length) * 100) : 0;
  const chargebackAlert = chargebackRate > 1;

  const activeSellersToday = new Set(todayTx.map(t => t.user_id)).size;
  const conversionRate = filteredTx.length > 0 ? ((filteredApproved.length / filteredTx.length) * 100).toFixed(1) : "0.0";
  const ticketMedio = filteredApproved.length > 0 ? totalVolume / filteredApproved.length : 0;

  const last30Start = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; }, []);
  const last30Tx = useMemo(() => approved.filter(t => new Date(t.created_at) >= last30Start), [approved, last30Start]);
  const profit30d = last30Tx.reduce((a, t) => a + Number(t.fee_amount), 0);

  const pendingMeds = useMemo(() => disputes.filter(d => d.status === "open" || d.status === "in_review"), [disputes]);
  const pendingMedsAmount = pendingMeds.reduce((a, d) => a + Number(d.amount), 0);

  const methodApproval = useMemo(() => {
    const methods: Record<string, { total: number; approved: number; volume: number }> = {};
    filteredTx.forEach(t => {
      const m = t.payment_method || "other";
      if (!methods[m]) methods[m] = { total: 0, approved: 0, volume: 0 };
      methods[m].total++;
      if (t.status === "approved" || t.status === "completed") {
        methods[m].approved++; methods[m].volume += Number(t.amount);
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

  const kycPending = profiles.filter(p => p.account_status === "pending_review" || p.account_status === "pending");
  const highValueWd = pendingWd.filter(w => Number(w.amount) >= 5000);
  const newUsersInRange = useMemo(() => profiles.filter(p => {
    if (!dateRange) return new Date(p.created_at).toDateString() === todayStr;
    const d = new Date(p.created_at); return d >= dateRange.from && d <= dateRange.to;
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

  const statusLabelMap: Record<string, string> = {
    completed: "Pago", approved: "Pago", pending: "Pendente",
    failed: "Recusado", expired: "Expirado", refunded: "Estornado", chargeback: "CB",
  };
  const statusToneMap: Record<string, Tone> = {
    completed: "success", approved: "success", pending: "warning",
    failed: "destructive", expired: "neutral", refunded: "info", chargeback: "destructive",
  };

  const openDisputes = disputes.filter(d => d.status === "open" || d.status === "in_review").length;

  /* ── Employee view ── */
  if (isEmployee) {
    return (
      <div className="space-y-6 animate-fade-in">
        <FinanceiroHero
          eyebrow="Painel Staff"
          title="Visão geral"
          subtitle="Acesso restrito a operações autorizadas."
          status={{ tone: "info", label: "Staff", pulse: true }}
        />
        <PremiumMetricGrid cols={4}>
          <PremiumMetric icon={Users} label="Sellers" value={String(profiles.length)} sub="Cadastrados" tone="primary" />
          <PremiumMetric icon={Package} label="Produtos" value={String(products.length)} sub={`${products.filter(p => p.status === "active").length} ativos`} tone="info" />
          <PremiumMetric icon={CreditCard} label="Transações" value={String(allTx.length)} sub={`${approved.length} aprovadas`} tone="success" />
          <PremiumMetric icon={Percent} label="Conversão" value={`${conversionRate}%`} sub={`${approved.length}/${allTx.length}`} tone="warning" />
        </PremiumMetricGrid>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════════
     ADMIN VIEW
     ═════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Hero (matches seller Financeiro aesthetic) ── */}
      <FinanceiroHero
        eyebrow="Admin · Command Center"
        title="Visão Geral"
        subtitle={`Operação em tempo real · ${rangeLabel}`}
        status={{ tone: chargebackAlert ? "destructive" : "success", label: chargebackAlert ? "Alerta de risco" : "Tudo sob controle", pulse: true }}
      />

      {/* ── Hero KPI strip · 1px divider grid ── */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 lg:grid-cols-6">
        <HeroBigStat label="Volume no período" value={fmtCurrency(totalVolume)} sub={`${filteredApproved.length}/${filteredTx.length} tx`} tone="primary" wide />
        <HeroBigStat label="Lucro líquido" value={fmtCurrency(takeRateTotal)} sub={`Take ${takeRatePct}%`} tone="success" />
        <HeroBigStat label="Ticket médio" value={fmtCurrency(ticketMedio)} sub="por venda" tone="info" />
        <HeroBigStat label="Conversão" value={`${conversionRate}%`} sub="aprovação geral" tone="warning" />
        <HeroBigStat label="Chargeback" value={`${chargebackRate.toFixed(2)}%`} sub="meta < 1%" tone={chargebackAlert ? "destructive" : "neutral"} />
      </div>

      {/* ── Pulse chart ── */}
      <PremiumPanel
        title="Pulso de Volume"
        eyebrow={chartPeriod === "7d" ? "Últimos 7 dias" : "Últimos 30 dias"}
        icon={Activity}
        action={
          <PremiumSegmented<"7d" | "30d">
            value={chartPeriod}
            onChange={setChartPeriod}
            options={[{ value: "7d", label: "7d" }, { value: "30d", label: "30d" }]}
          />
        }
      >
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}
                     tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip cursor={{ stroke: "hsl(var(--border))" }} content={<ChartTip fmtCurrency={fmtCurrency} />} />
              <Area type="monotone" dataKey="tpv" name="TPV" stroke="hsl(var(--primary))" strokeWidth={2.5}
                    fill="url(#heroSpark)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </PremiumPanel>

      {/* ── KPI Grid (clickable, with tactile hover) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpi icon={Flame}        label="Movimentado Hoje"  value={fmtCurrency(tpvToday)}        sub={`${todayTx.length} vendas aprovadas`} tone={todayTx.length > 0 ? "success" : "neutral"} onClick={() => onNavigate?.("transactions")} />
        <DashboardKpi icon={DollarSign}   label="Lucro Hoje"         value={fmtCurrency(takeRateToday)}   sub={`${activeSellersToday} sellers venderam`} tone="primary" onClick={() => onNavigate?.("transactions")} />
        <DashboardKpi icon={Hourglass}    label="Saques Pendentes"   value={fmtCurrency(pendingWdAmount)} sub={`${pendingWd.length} solicitações · ${highValueWd.length} altos`} tone={pendingWd.length > 5 ? "warning" : "neutral"} onClick={() => onNavigate?.("withdrawals")} />
        <DashboardKpi icon={UserPlus}     label="Novos Usuários"     value={String(newUsersInRange.length)} sub="cadastros no período" tone="info" onClick={() => onNavigate?.("sellers")} />
        <DashboardKpi icon={TrendingUp}   label="Lucro · 30 dias"    value={fmtCurrency(profit30d)}       sub={`${last30Tx.length} vendas · take ${takeRatePct}%`} tone="success" onClick={() => onNavigate?.("transactions")} />
        <DashboardKpi icon={AlertCircle}  label="MEDs Pendentes"     value={String(pendingMeds.length)}   sub={pendingMeds.length > 0 ? `${fmtCurrency(pendingMedsAmount)} em disputa` : "Nenhum em aberto"} tone={pendingMeds.length > 0 ? "destructive" : "neutral"} onClick={() => onNavigate?.("medpix")} />
        <DashboardKpi icon={UserCheck}    label="Aprovações KYC"     value={String(kycPending.length)}    sub="aguardando análise" tone={kycPending.length > 0 ? "warning" : "neutral"} onClick={() => onNavigate?.("sellers")} />
        <DashboardKpi icon={Lock}         label="Saldo Retido"       value={fmtCurrency(totalRetained)}   sub="aguardando liberação" tone="warning" onClick={() => onNavigate?.("transactions")} />
      </div>

      {/* ── Hourly + Methods ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <PremiumPanel title="Movimento por horário" eyebrow={rangeLabel} icon={Clock3}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hourlyData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={1} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}
                       tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }} content={<ChartTip fmtCurrency={fmtCurrency} />} />
                <Bar dataKey="tpv" name="TPV" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </PremiumPanel>
        </div>

        <PremiumPanel title="Métodos de Pagamento" icon={CreditCard}>
          <div className="space-y-4">
            {methodApproval.sort((a, b) => b.volume - a.volume).map(m => {
              const tone: Tone = m.rate >= 85 ? "success" : m.rate >= 60 ? "warning" : "destructive";
              return (
                <div key={m.method}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-black text-foreground">{m.method}</span>
                    <span className={cn("font-black tabular-nums", TONE_TEXT[tone])}>{m.rate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                    <div className={cn("h-full rounded-full transition-all duration-500", TONE_BAR[tone])}
                         style={{ width: `${Math.max(m.rate, 2)}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] font-bold text-muted-foreground tabular-nums">
                    <span>{fmtCurrency(m.volume)}</span>
                    <span>{m.approved}/{m.total} tx</span>
                  </div>
                </div>
              );
            })}
            {methodApproval.length === 0 && (
              <p className="py-8 text-center text-xs font-bold text-muted-foreground">Sem dados no período</p>
            )}
          </div>
        </PremiumPanel>
      </div>

      {/* ── Volume chart + Refund trend ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <PremiumPanel
          title="Volume & Take Rate"
          icon={TrendingUp}
          action={
            <PremiumSegmented<"7d" | "30d">
              value={chartPeriod}
              onChange={setChartPeriod}
              options={[{ value: "7d", label: "7d" }, { value: "30d", label: "30d" }]}
            />
          }
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="tpvArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}
                     tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} content={<ChartTip fmtCurrency={fmtCurrency} />} />
              <Area type="monotone" dataKey="tpv" name="TPV" stroke="hsl(var(--success))" strokeWidth={2.5}
                    fill="url(#tpvArea)" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="takeRate" name="Take Rate" stroke="hsl(var(--warning))" fillOpacity={0}
                    strokeWidth={1.75} strokeDasharray="4 2" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </PremiumPanel>

        <PremiumPanel title="Devoluções · 7 dias" icon={RotateCcw}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={refundTrend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ stroke: "hsl(var(--border))" }} content={<ChartTip fmtCurrency={fmtCurrency} />} />
              <Line type="monotone" dataKey="chargebacks" name="Chargebacks" stroke="hsl(var(--destructive))"
                    strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--destructive))" }} isAnimationActive={false} />
              <Line type="monotone" dataKey="refunds" name="Reembolsos" stroke="hsl(var(--warning))"
                    strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--warning))" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center gap-5 border-t border-border/40 pt-3 text-[10.5px] font-bold">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <span className="text-muted-foreground">Chargebacks</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              <span className="text-muted-foreground">Reembolsos</span>
            </span>
          </div>
        </PremiumPanel>
      </div>

      {/* ── Live activity + Risk alerts ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <PremiumPanel
            title="Atividade ao vivo"
            icon={Radio}
            eyebrow={`${realtimeTx.length} eventos em tempo real`}
          >
            <div className={premiumTable.wrapper}>
              <table className={premiumTable.table}>
                <thead>
                  <tr className={premiumTable.headRow}>
                    <th className={premiumTable.th}>Status</th>
                    <th className={premiumTable.th}>Cliente</th>
                    <th className={premiumTable.th}>Método</th>
                    <th className={cn(premiumTable.th, "text-right")}>Valor</th>
                    <th className={cn(premiumTable.th, "text-right")}>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {realtimeTx.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-xs font-bold text-muted-foreground">Aguardando transações…</td></tr>
                  )}
                  {realtimeTx.slice(0, 8).map(t => {
                    const tone = statusToneMap[t.status] || "neutral";
                    return (
                      <tr key={t.id} className={premiumTable.row}>
                        <td className={premiumTable.td}><Pill tone={tone}>{statusLabelMap[t.status] || t.status}</Pill></td>
                        <td className={cn(premiumTable.td, "max-w-[180px] truncate text-xs font-bold text-foreground")}>
                          {t.customer_name || "Anônimo"}
                        </td>
                        <td className={cn(premiumTable.td, "text-[10.5px] font-bold uppercase text-muted-foreground")}>
                          {t.payment_method || "—"}
                        </td>
                        <td className={cn(premiumTable.td, "text-right text-xs font-black text-foreground tabular-nums")}>
                          {fmtCurrency(Number(t.amount))}
                        </td>
                        <td className={cn(premiumTable.td, "text-right text-[10.5px] font-bold text-muted-foreground tabular-nums")}>
                          {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PremiumPanel>
        </div>

        <PremiumPanel title="Alertas de Risco" icon={ShieldAlert}>
          <div className="space-y-2.5">
            <RiskRow label="Taxa de Chargeback" value={`${chargebackRate.toFixed(2)}%`} threshold="Meta < 1%" alert={chargebackAlert} />
            <RiskRow label="Disputas Abertas" value={String(openDisputes)} threshold="Meta < 5" alert={openDisputes > 5} />
            <RiskRow label="Saques Pendentes" value={fmtCurrency(pendingWdAmount)} threshold={`${pendingWd.length} na fila`} alert={pendingWd.length > 10} />
            <RiskRow label="KYC Pendente" value={String(kycPending.length)} threshold="aguardando aprovação" alert={kycPending.length > 0} />
          </div>
        </PremiumPanel>
      </div>

      {/* ── KYC queue + Pending withdrawals ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PremiumPanel
          title={`Aprovações KYC (${kycPending.length})`}
          icon={UserCheck}
          action={onNavigate && (
            <button onClick={() => onNavigate("sellers")}
                    className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-primary hover:underline">
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        >
          {kycPending.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
                <CheckCircle2 className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-xs font-bold">Nenhum KYC pendente</p>
            </div>
          ) : (
            <div className="max-h-[340px] overflow-y-auto -mx-2">
              {kycPending.slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/30">
                  <button type="button" onClick={() => setKycReview(p)} className="flex-1 min-w-0 text-left">
                    <p className="truncate text-xs font-black text-foreground">{p.full_name || "Sem nome"}</p>
                    <p className="truncate text-[10.5px] font-bold text-muted-foreground">{p.email}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">
                      {p.document_number || "Sem documento"}
                    </p>
                  </button>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => handleKycApprove(p.user_id)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-success/30 bg-success/10 px-2.5 text-[10.5px] font-black text-success hover:bg-success/15">
                      <CheckCircle2 className="h-3 w-3" /> Aprovar
                    </button>
                    <button onClick={() => setKycReview(p)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-warning/30 bg-warning/10 px-2.5 text-[10.5px] font-black text-warning hover:bg-warning/15">
                      <Eye className="h-3 w-3" /> Analisar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PremiumPanel>

        <PremiumPanel
          title={`Saques em revisão (${pendingWd.length})`}
          icon={Wallet}
          action={onNavigate && (
            <button onClick={() => onNavigate("withdrawals")}
                    className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-primary hover:underline">
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        >
          {pendingWd.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
                <CheckCircle2 className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-xs font-bold">Nenhum saque pendente</p>
            </div>
          ) : (
            <div className="max-h-[340px] overflow-y-auto -mx-2">
              {pendingWd.slice(0, 10).map(w => {
                const sp = profiles.find(p => p.user_id === w.user_id);
                const isNew = sp ? (Date.now() - new Date(sp.created_at).getTime()) / (1000 * 60 * 60 * 24) < 30 : false;
                const isHigh = Number(w.amount) >= 5000;
                return (
                  <div key={w.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-display text-sm font-black text-foreground tabular-nums">
                          {fmtCurrency(Number(w.amount))}
                        </span>
                        {isHigh && <Pill tone="warning">Alto</Pill>}
                        {isNew && <Pill tone="info">Novo</Pill>}
                      </div>
                      <p className="truncate text-[10.5px] font-bold text-muted-foreground">
                        {sp?.full_name || "—"} · {sp?.email || ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => onWithdrawalAction(w.id, "approved")}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-success/30 bg-success/10 px-2.5 text-[10.5px] font-black text-success hover:bg-success/15">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </button>
                      <button onClick={() => onWithdrawalAction(w.id, "rejected")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PremiumPanel>
      </div>

      {/* ── MEDs ── */}
      <PremiumPanel
        title={`MEDs Pendentes (${pendingMeds.length})`}
        icon={AlertCircle}
        action={onNavigate && (
          <button onClick={() => onNavigate("medpix")}
                  className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-primary hover:underline">
            Ver todos <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      >
        {pendingMeds.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
              <CheckCircle2 className="h-5 w-5 opacity-50" />
            </div>
            <p className="text-xs font-bold">Nenhum MED em aberto</p>
          </div>
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  <th className={premiumTable.th}>Valor</th>
                  <th className={premiumTable.th}>Tipo</th>
                  <th className={premiumTable.th}>Status</th>
                  <th className={premiumTable.th}>Seller</th>
                  <th className={premiumTable.th}>TX</th>
                </tr>
              </thead>
              <tbody>
                {pendingMeds.slice(0, 10).map(d => {
                  const tx = transactions.find(t => t.id === d.transaction_id);
                  const seller = profiles.find(p => p.user_id === d.seller_user_id);
                  return (
                    <tr key={d.id} className={cn(premiumTable.row, "cursor-pointer")}
                        onClick={() => onNavigate?.("medpix")}>
                      <td className={cn(premiumTable.td, "font-display text-sm font-black text-foreground tabular-nums")}>
                        {fmtCurrency(Number(d.amount))}
                      </td>
                      <td className={premiumTable.td}>
                        <Pill tone="destructive">{d.type === "medpix" ? "MED" : d.type === "pre_med_pix" ? "Pre-MED" : "Reemb"}</Pill>
                      </td>
                      <td className={premiumTable.td}>
                        <Pill tone="warning">{d.status === "open" ? "Aberto" : "Em análise"}</Pill>
                      </td>
                      <td className={cn(premiumTable.td, "max-w-[200px] truncate text-xs font-bold text-foreground")}>
                        {seller?.full_name || "—"}
                      </td>
                      <td className={cn(premiumTable.td, "font-mono text-[10.5px] text-muted-foreground")}>
                        {d.transaction_id?.slice(0, 8) || "—"} · {tx?.payment_method || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumPanel>

      {/* ── Fraud blocks ── */}
      <PremiumPanel title="Bloqueios Anti-Fraude" icon={ShieldAlert}>
        {fraudLogs.length > 0 ? (
          <div className="grid max-h-[320px] grid-cols-1 gap-2.5 overflow-y-auto md:grid-cols-2">
            {fraudLogs.slice(0, 20).map((f) => (
              <div key={f.id} className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  <span className="truncate text-xs font-black text-destructive">
                    {f.block_reason || "Blocked"}
                  </span>
                  <span className="ml-auto text-[10px] font-bold text-muted-foreground tabular-nums">
                    {new Date(f.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {f.block_type && <Pill tone="destructive">{f.block_type}</Pill>}
                  {f.matched_type && <Pill tone="warning">{f.matched_type}</Pill>}
                  {f.customer_email && (
                    <span className="truncate text-[10.5px] font-bold text-muted-foreground">
                      {f.customer_email}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-xs font-bold text-muted-foreground">Nenhum bloqueio recente</p>
        )}
      </PremiumPanel>

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

/* ─── Subcomponents ───────────────────────────────────────── */

function HeroStat({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="bg-card p-3.5">
      <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">{label}</p>
      <p className={cn("mt-2 font-display text-[17px] font-black tabular-nums leading-none tracking-tight", TONE_TEXT[tone])}>
        {value}
      </p>
    </div>
  );
}

function HeroBigStat({ label, value, sub, tone, wide }: {
  label: string; value: string; sub?: string; tone: Tone; wide?: boolean;
}) {
  return (
    <div className={cn(
      "group relative bg-card p-4 sm:p-5 transition-colors hover:bg-muted/20",
      wide && "lg:col-span-2",
    )}>
      <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">{label}</p>
      <p className={cn(
        "mt-2.5 font-display font-black leading-none tracking-tight tabular-nums break-words",
        wide ? "text-[28px] sm:text-[36px]" : "text-[20px] sm:text-[24px]",
        TONE_TEXT[tone],
      )}>
        {value}
      </p>
      {sub && <p className="mt-2 text-[10.5px] font-bold text-muted-foreground/75 truncate">{sub}</p>}
      <span className={cn("absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100", TONE_BAR[tone])} />
    </div>
  );
}

function PulseStat({ icon: Icon, label, value, tone }: {
  icon: LucideIcon; label: string; value: string; tone: Tone;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon className={cn("h-3 w-3 shrink-0", TONE_TEXT[tone])} strokeWidth={2.4} />
        <span className="truncate text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span>
      </span>
      <span className={cn("shrink-0 text-xs font-black tabular-nums", TONE_TEXT[tone])}>{value}</span>
    </div>
  );
}

function CommandMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-primary px-3 py-2.5">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary-foreground/70">{label}</p>
      <p className="mt-1 font-display text-lg font-black leading-none text-primary-foreground tabular-nums">{value}</p>
    </div>
  );
}

function DashboardKpi({ icon: Icon, label, value, sub, tone, onClick }: {
  icon: LucideIcon; label: string; value: string; sub?: string; tone: Tone; onClick?: () => void;
}) {
  const isInteractive = typeof onClick === "function";
  const Tag = (isInteractive ? "button" : "div") as React.ElementType;
  return (
    <Tag
      type={isInteractive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "admin-card group relative overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-left transition-all duration-300",
        isInteractive && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
          <p className={cn("mt-3 break-words font-display text-[25px] font-black leading-none tracking-tight tabular-nums", TONE_TEXT[tone])}>{value}</p>
          {sub && <p className="mt-2 truncate text-[11px] font-bold text-muted-foreground/75">{sub}</p>}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", TONE_PILL[tone])}>
          <Icon className="h-5 w-5" strokeWidth={2.35} />
        </div>
      </div>
      <Icon className="pointer-events-none absolute -bottom-6 -right-4 h-24 w-24 rotate-[-12deg] text-foreground/[0.03] transition-transform duration-500 group-hover:scale-110" strokeWidth={1.4} />
      <span className={cn("absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100", TONE_BAR[tone])} />
      {isInteractive && (
        <ArrowUpRight className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground/40 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
      )}
    </Tag>
  );
}

function RiskRow({ label, value, threshold, alert }: {
  label: string; value: string; threshold: string; alert: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors",
      alert ? "border-destructive/25 bg-destructive/5" : "border-border/60 bg-muted/20",
    )}>
      <div className="min-w-0">
        <p className="text-xs font-black text-foreground">{label}</p>
        <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">{threshold}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn(
          "font-display text-sm font-black tabular-nums",
          alert ? "text-destructive" : "text-success",
        )}>
          {value}
        </span>
        {alert
          ? <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
          : <CheckCircle2 className="h-4 w-4 text-success" />}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   PUBLIC API — backward-compatible exports for other admin tabs.
   Now rendered in the Premium aesthetic (soft borders, generous
   radius, semantic tokens — works in light & dark).
   ═════════════════════════════════════════════════════════════ */

export function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "admin-card overflow-hidden rounded-[24px] border border-border/60 bg-card p-5",
      className,
    )}>
      {children}
    </div>
  );
}

export function GlassPanelTitle({ children, color, icon }: {
  children: React.ReactNode; color: string; icon?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    emerald: "hsl(var(--success))", green: "hsl(var(--success))", teal: "hsl(var(--info))",
    blue: "hsl(var(--info))", cyan: "hsl(var(--info))", indigo: "hsl(var(--primary))",
    violet: "hsl(var(--primary))", amber: "hsl(var(--warning))", red: "hsl(var(--destructive))",
    zinc: "hsl(var(--muted-foreground))",
  };
  const c = colorMap[color] || "hsl(var(--primary))";
  return (
    <h3 className="mb-4 flex items-center gap-2 border-b border-border/40 pb-3 font-display text-sm font-black uppercase tracking-tight text-foreground">
      <span className="h-4 w-[3px] rounded-full" style={{ background: c }} />
      {icon && <span style={{ color: c }} className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      {children}
    </h3>
  );
}

export { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle };

export function AdminKpi({ icon, label, value, sub, alert, highlight, gradient }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  alert?: boolean; highlight?: boolean; iconColor?: string;
  gradient?: string; glowColor?: string;
}) {
  const tone: Tone =
    alert ? "destructive" :
    highlight ? "warning" :
    gradient?.includes("emerald") || gradient?.includes("green") ? "success" :
    gradient?.includes("amber") || gradient?.includes("orange") || gradient?.includes("yellow") ? "warning" :
    gradient?.includes("red") || gradient?.includes("rose") || gradient?.includes("pink") ? "destructive" :
    gradient?.includes("blue") || gradient?.includes("cyan") || gradient?.includes("sky") || gradient?.includes("teal") ? "info" :
    gradient?.includes("violet") || gradient?.includes("indigo") || gradient?.includes("purple") ? "primary" :
    "neutral";
  return (
    <div className="admin-card group relative overflow-hidden rounded-[24px] border border-border/60 bg-card p-5 hover:border-primary/35">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/70 leading-tight">
            {label}
          </p>
          <p className={cn(
            "mt-3 break-words font-display text-2xl font-black leading-none tracking-tight tabular-nums",
            TONE_TEXT[tone],
          )}>
            {value}
          </p>
          {sub && <p className="mt-2 truncate text-[11px] font-bold text-muted-foreground/70">{sub}</p>}
        </div>
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          TONE_PILL[tone],
        )}>
          <span className="[&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        </div>
      </div>
    </div>
  );
}
