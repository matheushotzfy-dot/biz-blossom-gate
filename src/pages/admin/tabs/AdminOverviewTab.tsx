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
function Panel({ children, className, title, icon, action }: {
  children: React.ReactNode; className?: string;
  title?: string; icon?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[24px] border border-border/60 bg-card overflow-hidden flex flex-col transition-colors hover:border-primary/20", className)}>
      {(title || icon) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
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

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Plataforma · Visão Executiva"
        title={fmtCurrency(totalVolume)}
        subtitle={`Valor movimentado no período · lucro ${fmtCurrency(takeRateTotal)} · take rate ${takeRatePct}% · ticket médio ${fmtCurrency(ticketMedio)} · ${rangeLabel}`}
        status={{ tone: "success", label: "Live", pulse: true }}
      />

      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi label="Movimentado Hoje" value={fmtCurrency(tpvToday)} sub={`${todayTx.length} vendas aprovadas`} icon={Flame} tone={todayTx.length > 0 ? "success" : "neutral"} />
        <FinanceiroKpi label="Lucro Hoje" value={fmtCurrency(takeRateToday)} sub={`${activeSellersToday} sellers venderam`} icon={DollarSign} tone="primary" />
        <FinanceiroKpi label="Saques Pendentes" value={fmtCurrency(pendingWdAmount)} sub={`${pendingWd.length} solicitações · ${highValueWd.length} altos`} icon={Hourglass} tone={pendingWd.length > 5 ? "warning" : "neutral"} />
        <FinanceiroKpi label="Novos Usuários" value={String(newUsersInRange.length)} sub="cadastros no período" icon={UserPlus} tone="info" />
      </FinanceiroKpiGrid>

      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi label="Lucro no Período" value={fmtCurrency(takeRateTotal)} sub={`${takeRatePct}% de take rate`} icon={TrendingUp} tone="success" />
        <FinanceiroKpi label="Aprovações KYC" value={String(kycPending.length)} sub="usuários aguardando análise" icon={UserCheck} tone={kycPending.length > 0 ? "warning" : "neutral"} />
        <FinanceiroKpi label="Saldo Retido" value={fmtCurrency(totalRetained)} sub="aguardando liberação" icon={Lock} tone="warning" />
        <FinanceiroKpi label="Volume Sacado" value={fmtCurrency(totalWithdrawn)} sub="pagos no período" icon={ArrowDownToLine} tone="neutral" />
      </FinanceiroKpiGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          className="xl:col-span-3"
          title="Movimento por horário"
          icon={<Clock3 className="h-3.5 w-3.5" />}
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

        <Panel title="Métodos de Pagamento" icon={<CreditCard className="h-3.5 w-3.5" />}>
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
        <Panel title="Atividade ao vivo" icon={<Radio className="h-3.5 w-3.5 text-destructive animate-pulse" />} className="max-h-[420px]">
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

        <Panel title="Devoluções · 7 dias" icon={<RotateCcw className="h-3.5 w-3.5" />}>
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

        <Panel title="Alertas de Risco" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
          <div className="space-y-2">
            <RiskRow label="Taxa de Chargeback" value={`${chargebackRate.toFixed(2)}%`} threshold="< 1%" alert={chargebackAlert} />
            <RiskRow label="Disputas Abertas" value={String(openDisputes)} threshold="< 5" alert={openDisputes > 5} />
            <RiskRow label="Saques Pendentes" value={fmtCurrency(pendingWdAmount)} threshold={`${pendingWd.length} na fila`} alert={pendingWd.length > 10} />
            <RiskRow label="KYC Pendente" value={String(kycPending.length)} threshold="aguardando aprovação" alert={kycPending.length > 0} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`Aprovações KYC (${kycPending.length})`} icon={<UserCheck className="h-3.5 w-3.5" />}>
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {kycPending.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors group">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-foreground truncate">{p.full_name || "Sem nome"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                  <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">{p.document_number || "Sem documento"}</p>
                </div>
                <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-success/30 text-success hover:bg-success/10 hover:text-success" onClick={() => onUserStatus(p.user_id, "approved")}>
                    <CheckCircle2 className="h-3 w-3" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => {
                    window.open(`mailto:${p.email || ""}?subject=Verificação KYC`, "_blank");
                    toast.info(`Analisando ${p.full_name || p.email}`);
                  }}>
                    <Eye className="h-3 w-3" /> Analisar
                  </Button>
                </div>
              </div>
            ))}
            {kycPending.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50">
                <CheckCircle2 className="h-6 w-6 mb-2" />
                <p className="text-[11px]">Nenhum KYC pendente</p>
              </div>
            )}
          </div>
        </Panel>

        <Panel title={`Saques em revisão (${pendingWd.length})`} icon={<Wallet className="h-3.5 w-3.5" />}>
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

      <Panel title="Bloqueios Anti-Fraude" icon={<ShieldAlert className="h-3.5 w-3.5 text-destructive" />}>
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
    </div>
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

/* ── Glass Panel ── */
export function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
 return (
 <div className={cn(
 "relative isolate overflow-hidden rounded-2xl border border-white/[0.08] p-5",
 "bg-gradient-to-b from-white/[0.05] to-white/[0.015]",
 "shadow-[0_14px_36px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]",
 "transition-[border-color,box-shadow] duration-300 hover:border-white/[0.12]",
 className
 )}>
 {children}
 </div>
 );
}

/* ── Glass Panel Title ── */
export function GlassPanelTitle({ children, color, icon }: { children: React.ReactNode; color: string; icon?: React.ReactNode }) {
 const colorMap: Record<string, string> = {
 emerald: "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]",
 indigo: "bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.6)]",
 amber: "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]",
 blue: "bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.6)]",
 red: "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.6)]",
 violet: "bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.6)]",
 cyan: "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]",
 zinc: "bg-zinc-400/40",
 teal: "bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.6)]",
 green: "bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.6)]",
 };
 const textColorMap: Record<string, string> = {
 emerald: "text-emerald-400",
 indigo: "text-indigo-400",
 amber: "text-amber-400",
 blue: "text-teal-400",
 red: "text-red-400",
 violet: "text-violet-400",
 cyan: "text-cyan-400",
 zinc: "text-zinc-400",
 teal: "text-teal-400",
 green: "text-green-400",
 };
 return (
 <h3 className="text-[13px] font-bold flex items-center gap-2.5 text-white/[0.92]">
 <span className={cn("w-1 h-4 rounded-full", colorMap[color] || colorMap.emerald)} />
 {icon && <span className={textColorMap[color] || "text-emerald-400"}>{icon}</span>}
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
 <span className={cn("text-sm font-black", alert ? "text-red-400" : "text-emerald-400")} style={{ fontFamily: "'Space Grotesk', monospace" }}>{value}</span>
 {alert ? (
 <span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
 ) : (
 <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/50" />
 )}
 </div>
 </div>
 );
}

/* ── Legacy exports ── */
export { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle };
export function AdminKpi({ icon, label, value, sub, alert, highlight, iconColor, gradient, glowColor }: {
 icon: React.ReactNode; label: string; value: string; sub?: string;
 alert?: boolean; highlight?: boolean; iconColor?: string;
 gradient?: string; glowColor?: string;
}) {
 return (
 <div className={cn(
 "rounded-xl bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/[0.08] p-4",
 "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_16px_rgba(0,0,0,0.25)]",
 "hover:border-white/[0.12] transition-all duration-300",
 alert && "border-amber-500/20 ring-1 ring-amber-500/10"
 )}
 style={{ boxShadow: highlight && glowColor ? `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 35px ${glowColor}` : undefined }}
 >
 <div className="flex items-center justify-between mb-2.5">
 <span className="text-[8px] uppercase tracking-[0.22em] text-white/[0.18] font-bold">{label}</span>
 {gradient ? (
 <div className={cn("h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-md ring-1 ring-white/[0.12]", gradient)}>{icon}</div>
 ) : (
 <div className={cn("h-9 w-9 rounded-lg bg-white/[0.05] flex items-center justify-center ring-1 ring-white/[0.05]", iconColor || "text-white/30")}>{icon}</div>
 )}
 </div>
 <p className={cn("text-xl font-extrabold tracking-tight text-white", highlight && "text-amber-400")} style={{ fontFamily: "'Space Grotesk', monospace" }}>{value}</p>
 {sub && <p className="text-[10px] text-white/25 mt-1.5 font-medium">{sub}</p>}
 </div>
 );
}
