import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, Users, ArrowDownToLine, TrendingUp, CheckCircle2, XCircle,
  CreditCard, Package, Activity, Percent, ShieldAlert, RotateCcw, Lock,
  Eye, Radio, AlertCircle, UserCheck, Flame, Wallet, CalendarDays,
  Clock3, Hourglass, UserPlus, ChevronRight, ArrowUpRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line,
} from "recharts";
import KycReviewDialog from "@/components/admin/KycReviewDialog";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import React from "react";

interface Dispute { id: string; type: string; status: string; seller_user_id: string; amount: number; created_at: string; transaction_id: string | null; }

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

/* ═════════════════════════════════════════════════════════════
   PHP-ADMIN CLEAN — Primitive kit
   White surfaces, 1px slate borders, no gradients, no glow.
   Compact, dense, professional. Pure semantic colors.
   ═════════════════════════════════════════════════════════════ */

const TONE_CFG = {
  neutral:     { stripe: "#cbd5e1", text: "text-[#475569]", pill: "bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]" },
  primary:     { stripe: "#1e293b", text: "text-[#1e293b]", pill: "bg-[#f1f5f9] text-[#1e293b] border-[#cbd5e1]" },
  success:     { stripe: "#10b981", text: "text-[#047857]", pill: "bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]" },
  warning:     { stripe: "#f59e0b", text: "text-[#b45309]", pill: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]" },
  destructive: { stripe: "#ef4444", text: "text-[#b91c1c]", pill: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]" },
  info:        { stripe: "#3b82f6", text: "text-[#1d4ed8]", pill: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]" },
} as const;
type Tone = keyof typeof TONE_CFG;

/* Card primitive — white surface, slate border, optional left accent rail */
function Card({ children, className, tone }: { children: React.ReactNode; className?: string; tone?: Tone }) {
  return (
    <div className={cn(
      "relative bg-white border border-[#e2e8f0] rounded-md overflow-hidden",
      className
    )} style={tone ? { boxShadow: `inset 3px 0 0 0 ${TONE_CFG[tone].stripe}` } : undefined}>
      {children}
    </div>
  );
}

function CardHeader({ title, icon, action, sub }: {
  title: string; icon?: React.ReactNode; action?: React.ReactNode; sub?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#eef2f6] bg-[#fafbfc]">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-[#64748b] [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
        <h3 className="text-[12px] font-semibold text-[#0f172a] truncate">{title}</h3>
        {sub && <span className="text-[10.5px] text-[#94a3b8] truncate hidden sm:inline">· {sub}</span>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

/* Compact tone pill */
function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 h-5 px-1.5 rounded text-[9.5px] font-semibold uppercase tracking-wide border",
      TONE_CFG[tone].pill,
      className
    )}>
      {children}
    </span>
  );
}

/* KPI card — clean, tabular, optional click-through */
function Kpi({ label, value, sub, icon: Icon, tone = "neutral", delta, onClick }: {
  label: string; value: string; sub?: string; icon: any; tone?: Tone;
  delta?: { value: string; positive: boolean }; onClick?: () => void;
}) {
  const cfg = TONE_CFG[tone];
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "relative bg-white border border-[#e2e8f0] rounded-md p-4 text-left w-full transition-colors",
        onClick && "hover:border-[#cbd5e1] hover:bg-[#fafbfc] cursor-pointer group"
      )}
      style={{ boxShadow: `inset 3px 0 0 0 ${cfg.stripe}` }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#64748b] leading-tight">{label}</p>
        <div className="h-6 w-6 rounded flex items-center justify-center bg-[#f8fafc] border border-[#eef2f6] text-[#475569] shrink-0">
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
      </div>
      <p className={cn("text-[22px] font-bold leading-none tracking-tight tabular-nums", cfg.text)}
         style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        {value}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 min-h-[16px]">
        {sub && <p className="text-[10.5px] text-[#64748b] truncate">{sub}</p>}
        {delta && (
          <span className={cn(
            "text-[10px] font-semibold tabular-nums",
            delta.positive ? "text-[#047857]" : "text-[#b91c1c]"
          )}>
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
        )}
      </div>
      {onClick && <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#cbd5e1] opacity-0 group-hover:opacity-100 transition-opacity" />}
    </Comp>
  );
}

/* Recharts tooltip — solid white */
function ChartTip({ active, payload, label, fmtCurrency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-md px-3 py-2 shadow-sm pointer-events-none">
      {label && <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-1">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
              <span className="text-[#64748b]">{p.name}</span>
            </span>
            <span className="font-semibold tabular-nums text-[#0f172a]">
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
  const [fraudLogs, setFraudLogs] = useState<any[]>([]);
  const [kycReview, setKycReview] = useState<Tables<"profiles"> | null>(null);

  const handleKycApprove = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({
      account_status: "approved", kyc_rejection_reason: null,
    } as any).eq("user_id", userId);
    if (error) { toast.error("Erro ao aprovar KYC"); return; }
    toast.success("KYC aprovado!");
    onUserStatus(userId, "approved");
  };

  const handleKycReject = async (userId: string, reason: string) => {
    const { error } = await supabase.from("profiles").update({
      account_status: "rejected", kyc_rejection_reason: reason,
    } as any).eq("user_id", userId);
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
        setRealtimeTx(prev => prev.map(t => t.id === (payload.new as any).id ? payload.new as Tables<"transactions"> : t));
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
    return withdrawals.filter(w => { const d = new Date(w.created_at); return d >= dateRange.from && d <= dateRange.to; });
  }, [withdrawals, dateRange]);
  const pendingWd = withdrawals.filter(w => w.status === "pending");
  const pendingWdAmount = pendingWd.reduce((a, w) => a + Number(w.amount), 0);
  const totalRetained = filteredApproved.filter(t => !t.retention_released && Number(t.retained_amount) > 0).reduce((a, t) => a + Number(t.retained_amount), 0);

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
    return { name: dayStr, chargebacks: dayTx.filter(t => t.status === "chargeback").length, refunds: dayTx.filter(t => t.status === "refunded").length };
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
    return { hour: `${String(hour).padStart(2, "0")}h`, tpv: txs.reduce((a, t) => a + Number(t.amount), 0), lucro: txs.reduce((a, t) => a + Number(t.fee_amount), 0), vendas: txs.length };
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
      <div className="space-y-4">
        <div className="bg-white border border-[#e2e8f0] rounded-md p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Painel Staff</p>
          <h1 className="text-[22px] font-semibold text-[#0f172a] mt-1">Visão geral</h1>
          <p className="text-[12.5px] text-[#64748b] mt-1">Acesso restrito a operações autorizadas.</p>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Kpi label="Sellers" value={String(profiles.length)} sub="Cadastrados" icon={Users} tone="primary" />
          <Kpi label="Produtos" value={String(products.length)} sub={`${products.filter(p => p.status === "active").length} ativos`} icon={Package} tone="info" />
          <Kpi label="Transações" value={String(allTx.length)} sub={`${approved.length} aprovadas`} icon={CreditCard} tone="success" />
          <Kpi label="Conversão" value={`${conversionRate}%`} sub={`${approved.length}/${allTx.length}`} icon={Percent} tone="warning" />
        </div>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════════
     ADMIN VIEW
     ═════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4">
      {/* ── Hero strip: page header with volume + period ── */}
      <div className="bg-white border border-[#e2e8f0] rounded-md">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
          <div className="p-5 lg:p-6 border-b lg:border-b-0 lg:border-r border-[#eef2f6]">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#ecfdf5] border border-[#a7f3d0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#047857]">Ao vivo</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Command Center</span>
              <span className="ml-auto text-[10.5px] text-[#94a3b8] flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                {rangeLabel}
              </span>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">Volume Movimentado</p>
            <h1 className="mt-1.5 text-[36px] lg:text-[44px] font-bold text-[#0f172a] tabular-nums leading-none tracking-tight">
              {fmtCurrency(totalVolume)}
            </h1>

            <div className="mt-5 grid grid-cols-3 gap-px bg-[#eef2f6] border border-[#eef2f6] rounded overflow-hidden">
              <div className="bg-white px-3.5 py-3">
                <p className="text-[9.5px] font-semibold uppercase tracking-wider text-[#94a3b8]">Lucro</p>
                <p className="mt-1 text-[16px] font-bold text-[#047857] tabular-nums leading-none">{fmtCurrency(takeRateTotal)}</p>
              </div>
              <div className="bg-white px-3.5 py-3">
                <p className="text-[9.5px] font-semibold uppercase tracking-wider text-[#94a3b8]">Take Rate</p>
                <p className="mt-1 text-[16px] font-bold text-[#1e293b] tabular-nums leading-none">{takeRatePct}%</p>
              </div>
              <div className="bg-white px-3.5 py-3">
                <p className="text-[9.5px] font-semibold uppercase tracking-wider text-[#94a3b8]">Ticket Médio</p>
                <p className="mt-1 text-[16px] font-bold text-[#1d4ed8] tabular-nums leading-none">{fmtCurrency(ticketMedio)}</p>
              </div>
            </div>
          </div>

          <div className="p-5 lg:p-6 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Pulso · 7 dias</p>
                <span className="text-[10.5px] font-semibold text-[#0f172a] tabular-nums">{fmtCurrency(tpvMonth)}</span>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e293b" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#1e293b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="tpv" stroke="#1e293b" strokeWidth={2} fill="url(#heroSpark)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PulseStat icon={Activity} label="Conversão" value={`${conversionRate}%`} tone="success" />
              <PulseStat icon={CheckCircle2} label="Aprovadas" value={String(filteredApproved.length)} tone="primary" />
              <PulseStat icon={ShieldAlert} label="Chargeback" value={`${chargebackRate.toFixed(2)}%`} tone={chargebackAlert ? "destructive" : "neutral"} />
              <PulseStat icon={Users} label="Sellers ativos" value={String(activeSellersToday)} tone="info" />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi label="Movimentado Hoje" value={fmtCurrency(tpvToday)} sub={`${todayTx.length} vendas aprovadas`} icon={Flame} tone={todayTx.length > 0 ? "success" : "neutral"} onClick={() => onNavigate?.("transactions")} />
        <Kpi label="Lucro Hoje" value={fmtCurrency(takeRateToday)} sub={`${activeSellersToday} sellers venderam`} icon={DollarSign} tone="primary" onClick={() => onNavigate?.("transactions")} />
        <Kpi label="Saques Pendentes" value={fmtCurrency(pendingWdAmount)} sub={`${pendingWd.length} solicitações · ${highValueWd.length} altos`} icon={Hourglass} tone={pendingWd.length > 5 ? "warning" : "neutral"} onClick={() => onNavigate?.("withdrawals")} />
        <Kpi label="Novos Usuários" value={String(newUsersInRange.length)} sub="cadastros no período" icon={UserPlus} tone="info" onClick={() => onNavigate?.("sellers")} />
        <Kpi label="Lucro · 30 dias" value={fmtCurrency(profit30d)} sub={`${last30Tx.length} vendas · take ${takeRatePct}%`} icon={TrendingUp} tone="success" onClick={() => onNavigate?.("analytics")} />
        <Kpi label="MEDs Pendentes" value={String(pendingMeds.length)} sub={pendingMeds.length > 0 ? `${fmtCurrency(pendingMedsAmount)} em disputa` : "Nenhum em aberto"} icon={AlertCircle} tone={pendingMeds.length > 0 ? "destructive" : "neutral"} onClick={() => onNavigate?.("medpix")} />
        <Kpi label="Aprovações KYC" value={String(kycPending.length)} sub="aguardando análise" icon={UserCheck} tone={kycPending.length > 0 ? "warning" : "neutral"} onClick={() => onNavigate?.("sellers")} />
        <Kpi label="Saldo Retido" value={fmtCurrency(totalRetained)} sub="aguardando liberação" icon={Lock} tone="warning" onClick={() => onNavigate?.("transactions")} />
      </div>

      {/* ── Hourly + Methods ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card className="xl:col-span-2" tone="primary">
          <CardHeader title="Movimento por horário" icon={<Clock3 />} sub={rangeLabel} />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} interval={1} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} content={<ChartTip fmtCurrency={fmtCurrency} />} />
                <Bar dataKey="tpv" name="TPV" fill="#1e293b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="lucro" name="Lucro" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card tone="info">
          <CardHeader title="Métodos de Pagamento" icon={<CreditCard />} />
          <CardBody>
            <div className="space-y-3">
              {methodApproval.sort((a, b) => b.volume - a.volume).map(m => {
                const tone: Tone = m.rate >= 85 ? "success" : m.rate >= 60 ? "warning" : "destructive";
                const cfg = TONE_CFG[tone];
                return (
                  <div key={m.method}>
                    <div className="flex items-center justify-between text-[11.5px] mb-1.5">
                      <span className="font-semibold text-[#0f172a]">{m.method}</span>
                      <span className={cn("font-bold tabular-nums", cfg.text)}>{m.rate.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#f1f5f9] overflow-hidden">
                      <div className="h-full transition-all duration-500" style={{ width: `${m.rate}%`, background: cfg.stripe }} />
                    </div>
                    <div className="flex justify-between text-[9.5px] text-[#94a3b8] mt-1 tabular-nums">
                      <span>{fmtCurrency(m.volume)}</span>
                      <span>{m.approved}/{m.total} tx</span>
                    </div>
                  </div>
                );
              })}
              {methodApproval.length === 0 && <div className="text-center text-[11.5px] text-[#94a3b8] py-6">Sem dados no período</div>}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── Volume chart + Refund trend ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card tone="success">
          <CardHeader
            title="Volume & Take Rate" icon={<TrendingUp />}
            action={
              <div className="flex gap-px bg-[#f1f5f9] border border-[#e2e8f0] rounded p-0.5">
                {(["7d", "30d"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setChartPeriod(f)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-semibold transition-colors",
                      chartPeriod === f ? "bg-white text-[#0f172a] border border-[#e2e8f0] shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"
                    )}
                  >{f}</button>
                ))}
              </div>
            }
          />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="tpvArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} content={<ChartTip fmtCurrency={fmtCurrency} />} />
                <Area type="monotone" dataKey="tpv" name="TPV" stroke="#10b981" strokeWidth={2} fill="url(#tpvArea)" dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="takeRate" name="Take Rate" stroke="#f59e0b" fillOpacity={0} strokeWidth={1.5} strokeDasharray="4 2" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card tone="warning">
          <CardHeader title="Devoluções · 7 dias" icon={<RotateCcw />} />
          <CardBody>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={refundTrend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ stroke: "#cbd5e1" }} content={<ChartTip fmtCurrency={fmtCurrency} />} />
                <Line type="monotone" dataKey="chargebacks" name="Chargebacks" stroke="#ef4444" strokeWidth={2} dot={{ r: 2.5, fill: "#ef4444" }} isAnimationActive={false} />
                <Line type="monotone" dataKey="refunds" name="Reembolsos" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2.5, fill: "#f59e0b" }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#eef2f6] text-[10.5px]">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" /><span className="text-[#64748b]">Chargebacks</span></span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" /><span className="text-[#64748b]">Reembolsos</span></span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── Live activity + Risk alerts ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card className="xl:col-span-2" tone="destructive">
          <CardHeader
            title="Atividade ao vivo"
            icon={<Radio className="animate-pulse" />}
            action={<span className="text-[10px] font-semibold text-[#94a3b8]">{realtimeTx.length} eventos</span>}
          />
          <div className="overflow-hidden">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="bg-[#fafbfc] border-b border-[#eef2f6] text-left">
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Status</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Cliente</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Método</th>
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b] text-right">Valor</th>
                  <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b] text-right">Hora</th>
                </tr>
              </thead>
              <tbody>
                {realtimeTx.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-[11px] text-[#94a3b8] py-8">Aguardando transações...</td></tr>
                )}
                {realtimeTx.slice(0, 8).map(t => {
                  const tone = statusToneMap[t.status] || "neutral";
                  return (
                    <tr key={t.id} className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfc] transition-colors">
                      <td className="px-4 py-2.5"><Pill tone={tone}>{statusLabelMap[t.status] || t.status}</Pill></td>
                      <td className="px-3 py-2.5 text-[#0f172a] truncate max-w-[180px]">{t.customer_name || "Anônimo"}</td>
                      <td className="px-3 py-2.5 text-[#64748b] uppercase text-[10.5px]">{t.payment_method || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#0f172a] tabular-nums">{fmtCurrency(Number(t.amount))}</td>
                      <td className="px-4 py-2.5 text-right text-[#94a3b8] tabular-nums">{new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card tone="destructive">
          <CardHeader title="Alertas de Risco" icon={<ShieldAlert />} />
          <CardBody className="space-y-2">
            <RiskRow label="Taxa de Chargeback" value={`${chargebackRate.toFixed(2)}%`} threshold="Meta < 1%" alert={chargebackAlert} />
            <RiskRow label="Disputas Abertas" value={String(openDisputes)} threshold="Meta < 5" alert={openDisputes > 5} />
            <RiskRow label="Saques Pendentes" value={fmtCurrency(pendingWdAmount)} threshold={`${pendingWd.length} na fila`} alert={pendingWd.length > 10} />
            <RiskRow label="KYC Pendente" value={String(kycPending.length)} threshold="aguardando aprovação" alert={kycPending.length > 0} />
          </CardBody>
        </Card>
      </div>

      {/* ── KYC queue + Pending withdrawals ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card tone={kycPending.length > 0 ? "warning" : "neutral"}>
          <CardHeader
            title={`Aprovações KYC (${kycPending.length})`} icon={<UserCheck />}
            action={onNavigate && <button onClick={() => onNavigate("sellers")} className="text-[10.5px] font-semibold text-[#1d4ed8] hover:underline flex items-center gap-1">Ver todos <ArrowUpRight className="h-3 w-3" /></button>}
          />
          <div className="max-h-[340px] overflow-y-auto">
            {kycPending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[#94a3b8]">
                <CheckCircle2 className="h-6 w-6 mb-2" />
                <p className="text-[11.5px]">Nenhum KYC pendente</p>
              </div>
            ) : (
              <table className="w-full text-[11.5px]">
                <tbody>
                  {kycPending.slice(0, 10).map(p => (
                    <tr key={p.id} className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfc]">
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => setKycReview(p)} className="text-left w-full">
                          <p className="font-semibold text-[#0f172a] truncate">{p.full_name || "Sem nome"}</p>
                          <p className="text-[10.5px] text-[#64748b] truncate">{p.email}</p>
                          <p className="text-[9.5px] text-[#94a3b8] font-mono mt-0.5">{p.document_number || "Sem documento"}</p>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => handleKycApprove(p.user_id)}
                            className="inline-flex items-center gap-1 h-7 px-2 rounded text-[10.5px] font-semibold border border-[#a7f3d0] text-[#047857] bg-[#ecfdf5] hover:bg-[#d1fae5] transition-colors"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Aprovar
                          </button>
                          <button
                            onClick={() => setKycReview(p)}
                            className="inline-flex items-center gap-1 h-7 px-2 rounded text-[10.5px] font-semibold border border-[#fde68a] text-[#b45309] bg-[#fffbeb] hover:bg-[#fef3c7] transition-colors"
                          >
                            <Eye className="h-3 w-3" /> Analisar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card tone={pendingWd.length > 0 ? "info" : "neutral"}>
          <CardHeader
            title={`Saques em revisão (${pendingWd.length})`} icon={<Wallet />}
            action={onNavigate && <button onClick={() => onNavigate("withdrawals")} className="text-[10.5px] font-semibold text-[#1d4ed8] hover:underline flex items-center gap-1">Ver todos <ArrowUpRight className="h-3 w-3" /></button>}
          />
          <div className="max-h-[340px] overflow-y-auto">
            {pendingWd.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[#94a3b8]">
                <CheckCircle2 className="h-6 w-6 mb-2" />
                <p className="text-[11.5px]">Nenhum saque pendente</p>
              </div>
            ) : (
              <table className="w-full text-[11.5px]">
                <tbody>
                  {pendingWd.slice(0, 10).map(w => {
                    const sp = profiles.find(p => p.user_id === w.user_id);
                    const isNew = sp ? (Date.now() - new Date(sp.created_at).getTime()) / (1000 * 60 * 60 * 24) < 30 : false;
                    const isHigh = Number(w.amount) >= 5000;
                    return (
                      <tr key={w.id} className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfc]">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-bold text-[#0f172a] tabular-nums">{fmtCurrency(Number(w.amount))}</span>
                            {isHigh && <Pill tone="warning">Alto</Pill>}
                            {isNew && <Pill tone="info">Novo</Pill>}
                          </div>
                          <p className="text-[10.5px] text-[#64748b] truncate">{sp?.full_name || "—"} · {sp?.email || ""}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex gap-1">
                            <button onClick={() => onWithdrawalAction(w.id, "approved")}
                              className="inline-flex items-center gap-1 h-7 px-2 rounded text-[10.5px] font-semibold border border-[#a7f3d0] text-[#047857] bg-[#ecfdf5] hover:bg-[#d1fae5] transition-colors">
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </button>
                            <button onClick={() => onWithdrawalAction(w.id, "rejected")}
                              className="inline-flex items-center gap-1 h-7 px-2 rounded text-[10.5px] font-semibold border border-[#fecaca] text-[#b91c1c] bg-[#fef2f2] hover:bg-[#fee2e2] transition-colors">
                              <XCircle className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* ── MEDs ── */}
      <Card tone={pendingMeds.length > 0 ? "destructive" : "neutral"}>
        <CardHeader
          title={`MEDs Pendentes (${pendingMeds.length})`} icon={<AlertCircle />}
          action={onNavigate && <button onClick={() => onNavigate("medpix")} className="text-[10.5px] font-semibold text-[#1d4ed8] hover:underline flex items-center gap-1">Ver todos <ArrowUpRight className="h-3 w-3" /></button>}
        />
        {pendingMeds.length === 0 ? (
          <CardBody>
            <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
              <CheckCircle2 className="h-6 w-6 mb-2" />
              <p className="text-[11.5px]">Nenhum MED em aberto</p>
            </div>
          </CardBody>
        ) : (
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#eef2f6] text-left">
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Valor</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Tipo</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Status</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Seller</th>
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">TX</th>
              </tr>
            </thead>
            <tbody>
              {pendingMeds.slice(0, 10).map(d => {
                const tx = transactions.find(t => t.id === d.transaction_id);
                const seller = profiles.find(p => p.user_id === d.seller_user_id);
                return (
                  <tr key={d.id} className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfc] cursor-pointer"
                      onClick={() => onNavigate?.("medpix")}>
                    <td className="px-4 py-2.5 font-bold text-[#0f172a] tabular-nums">{fmtCurrency(Number(d.amount))}</td>
                    <td className="px-3 py-2.5"><Pill tone="destructive">{d.type === "medpix" ? "MED" : d.type === "pre_med_pix" ? "Pre-MED" : "Reemb"}</Pill></td>
                    <td className="px-3 py-2.5"><Pill tone="warning">{d.status === "open" ? "Aberto" : "Em análise"}</Pill></td>
                    <td className="px-3 py-2.5 text-[#0f172a] truncate max-w-[200px]">{seller?.full_name || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-[10.5px] text-[#94a3b8]">{d.transaction_id?.slice(0, 8) || "—"} · {tx?.payment_method || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* ── Fraud blocks ── */}
      <Card tone="destructive">
        <CardHeader title="Bloqueios Anti-Fraude" icon={<ShieldAlert />} />
        <CardBody>
          {fraudLogs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
              {fraudLogs.slice(0, 20).map((f: any) => (
                <div key={f.id} className="bg-[#fef2f2] border border-[#fecaca] rounded px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
                    <span className="text-[11px] font-semibold text-[#b91c1c] truncate">{f.block_reason || "Blocked"}</span>
                    <span className="ml-auto text-[9.5px] text-[#94a3b8] tabular-nums">{new Date(f.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {f.block_type && <Pill tone="destructive">{f.block_type}</Pill>}
                    {f.matched_type && <Pill tone="warning">{f.matched_type}</Pill>}
                    {f.customer_email && <span className="text-[10px] text-[#64748b] truncate">{f.customer_email}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[11.5px] text-[#94a3b8]">Nenhum bloqueio recente</div>
          )}
        </CardBody>
      </Card>

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

/* ── Pulse stat (hero side) ── */
function PulseStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: Tone }) {
  const cfg = TONE_CFG[tone];
  return (
    <div className={cn("flex items-center justify-between rounded border px-2.5 py-2", cfg.pill)}>
      <span className="flex items-center gap-1.5 min-w-0">
        <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
        <span className="text-[10px] font-semibold uppercase tracking-wider truncate">{label}</span>
      </span>
      <span className="text-[12px] font-bold tabular-nums shrink-0">{value}</span>
    </div>
  );
}

/* ── Risk row ── */
function RiskRow({ label, value, threshold, alert }: { label: string; value: string; threshold: string; alert: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between px-3 py-2.5 rounded border",
      alert ? "bg-[#fef2f2] border-[#fecaca]" : "bg-[#f8fafc] border-[#eef2f6]"
    )}>
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold text-[#0f172a]">{label}</p>
        <p className="text-[10px] text-[#94a3b8] mt-0.5">{threshold}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn("text-[13px] font-bold tabular-nums", alert ? "text-[#b91c1c]" : "text-[#047857]")}>{value}</span>
        {alert
          ? <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444] animate-pulse" />
          : <CheckCircle2 className="h-3.5 w-3.5 text-[#10b981]" />}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   PUBLIC API — restyled primitives shared with other admin tabs.
   Keeps backward-compatible exports (GlassPanel, AdminKpi, etc.)
   but renders them in the new PHP-admin clean aesthetic.
   ═════════════════════════════════════════════════════════════ */

export function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white border border-[#e2e8f0] rounded-md p-4 overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function GlassPanelTitle({ children, color, icon }: { children: React.ReactNode; color: string; icon?: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    emerald: "#10b981", green: "#10b981", teal: "#14b8a6", blue: "#3b82f6",
    cyan: "#06b6d4", indigo: "#6366f1", violet: "#8b5cf6", amber: "#f59e0b",
    red: "#ef4444", zinc: "#64748b",
  };
  const c = colorMap[color] || "#1e293b";
  return (
    <h3 className="flex items-center gap-2 text-[12px] font-semibold text-[#0f172a] mb-3 pb-2 border-b border-[#eef2f6]">
      <span className="h-3.5 w-[3px] rounded-full" style={{ background: c }} />
      {icon && <span style={{ color: c }} className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
      {children}
    </h3>
  );
}

export { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle };

export function AdminKpi({ icon, label, value, sub, alert, highlight, gradient }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  alert?: boolean; highlight?: boolean; iconColor?: string; gradient?: string; glowColor?: string;
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
  const cfg = TONE_CFG[tone];
  return (
    <div
      className="relative bg-white border border-[#e2e8f0] rounded-md p-4"
      style={{ boxShadow: `inset 3px 0 0 0 ${cfg.stripe}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] leading-tight">{label}</span>
        <div className="h-6 w-6 rounded flex items-center justify-center bg-[#f8fafc] border border-[#eef2f6] text-[#475569] shrink-0">
          <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        </div>
      </div>
      <p className={cn("text-[22px] font-bold leading-none tracking-tight tabular-nums", cfg.text)}>{value}</p>
      {sub && <p className="mt-2 text-[10.5px] text-[#64748b] truncate">{sub}</p>}
    </div>
  );
}
