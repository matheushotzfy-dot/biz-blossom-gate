import { useMemo, useState } from "react";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
  BarChart3, TrendingUp, Users, DollarSign, Target, Layers,
  ArrowUpRight, ArrowDownRight, ShoppingCart, Percent, Zap, Eye,
  Clock, CreditCard, Smartphone, FileText, AlertTriangle, Award,
  CalendarDays, Repeat, RefreshCw,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { PageShell, PageTitle, GlassKpi, Panel, SectionHeader, GlowPanel } from "@/components/PageShell";
import { cn } from "@/lib/utils";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtShort = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}K` : fmt(v);
const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 11,
};

export default function Analytics() {
  const { data: transactions = [] } = useTransactions();
  const { data: products = [] } = useProducts();
  const [period, setPeriod] = useState<7 | 15 | 30>(30);

  // ─── KPI Summary ───
  const kpis = useMemo(() => {
    const now = Date.now();
    const completed = transactions.filter(t => t.status === "completed");
    const totalRevenue = completed.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const totalGross = completed.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalFees = completed.reduce((acc, t) => acc + Number(t.fee_amount), 0);
    const uniqueEmails = new Set(completed.map(t => t.customer_email).filter(Boolean));
    const avgTicket = completed.length > 0 ? totalRevenue / completed.length : 0;
    const ltv = uniqueEmails.size > 0 ? totalRevenue / uniqueEmails.size : 0;
    const conversionRate = transactions.length > 0 ? (completed.length / transactions.length * 100) : 0;
    const refunded = transactions.filter(t => t.status === "refunded").length;
    const refundRate = completed.length > 0 ? (refunded / (completed.length + refunded) * 100) : 0;
    const chargeback = transactions.filter(t => t.status === "chargeback").length;
    const chargebackRate = completed.length > 0 ? (chargeback / (completed.length + chargeback) * 100) : 0;

    // Period trends
    const periodMs = period * 86400000;
    const last = completed.filter(t => now - new Date(t.created_at).getTime() < periodMs);
    const prev = completed.filter(t => {
      const age = now - new Date(t.created_at).getTime();
      return age >= periodMs && age < periodMs * 2;
    });
    const lastRev = last.reduce((a, t) => a + Number(t.net_amount), 0);
    const prevRev = prev.reduce((a, t) => a + Number(t.net_amount), 0);
    const trend = prevRev > 0 ? ((lastRev - prevRev) / prevRev * 100) : 0;
    const lastCount = last.length;
    const prevCount = prev.length;
    const salesTrend = prevCount > 0 ? ((lastCount - prevCount) / prevCount * 100) : 0;

    return {
      totalRevenue, totalGross, totalFees, totalSales: completed.length,
      uniqueBuyers: uniqueEmails.size, avgTicket, ltv, conversionRate,
      refundRate, chargebackRate, trend, salesTrend, refunded, chargeback,
      pendingCount: transactions.filter(t => t.status === "pending").length,
      failedCount: transactions.filter(t => t.status === "failed").length,
    };
  }, [transactions, period]);

  // ─── Conversion Funnel ───
  const funnel = useMemo(() => {
    const total = transactions.length;
    const pending = transactions.filter(t => t.status === "pending").length;
    const completed = transactions.filter(t => t.status === "completed").length;
    const failed = transactions.filter(t => t.status === "failed").length;
    const refunded = transactions.filter(t => t.status === "refunded").length;
    const chargeback = transactions.filter(t => t.status === "chargeback").length;
    return [
      { stage: "Checkout Iniciado", count: total, pct: 100, color: "hsl(var(--primary))", icon: Eye },
      { stage: "Pagamento Pendente", count: pending, pct: total > 0 ? (pending / total * 100) : 0, color: "hsl(var(--warning))", icon: Clock },
      { stage: "Aprovado", count: completed, pct: total > 0 ? (completed / total * 100) : 0, color: "hsl(var(--success))", icon: ShoppingCart },
      { stage: "Recusado / Falha", count: failed, pct: total > 0 ? (failed / total * 100) : 0, color: "hsl(var(--destructive))", icon: AlertTriangle },
      { stage: "Reembolso", count: refunded, pct: total > 0 ? (refunded / total * 100) : 0, color: "hsl(var(--chart-2))", icon: RefreshCw },
      { stage: "Chargeback", count: chargeback, pct: total > 0 ? (chargeback / total * 100) : 0, color: "hsl(var(--destructive))", icon: AlertTriangle },
    ];
  }, [transactions]);

  // ─── Daily Revenue Trend ───
  const dailyRevenue = useMemo(() => {
    const map = new Map<string, { day: string; receita: number; vendas: number; bruto: number }>();
    const now = new Date();
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      map.set(key, { day: label, receita: 0, vendas: 0, bruto: 0 });
    }
    for (const tx of transactions.filter(t => t.status === "completed")) {
      const key = new Date(tx.created_at).toISOString().slice(0, 10);
      const existing = map.get(key);
      if (existing) {
        existing.receita += Number(tx.net_amount);
        existing.bruto += Number(tx.amount);
        existing.vendas += 1;
      }
    }
    return Array.from(map.values());
  }, [transactions, period]);

  // ─── Hourly Distribution ───
  const hourlyDistribution = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}h`, vendas: 0, receita: 0 }));
    for (const tx of transactions.filter(t => t.status === "completed")) {
      const h = new Date(tx.created_at).getHours();
      hours[h].vendas += 1;
      hours[h].receita += Number(tx.net_amount);
    }
    return hours;
  }, [transactions]);

  const peakHour = useMemo(() => {
    const best = hourlyDistribution.reduce((a, b) => b.vendas > a.vendas ? b : a, hourlyDistribution[0]);
    return best;
  }, [hourlyDistribution]);

  // ─── Revenue by Product ───
  const revenueByProduct = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number; avgTicket: number; refunds: number }>();
    for (const tx of transactions) {
      if (tx.status !== "completed" && tx.status !== "refunded") continue;
      const product = products.find(p => p.id === tx.product_id);
      const name = product?.name || "Outro";
      const existing = map.get(name) || { name, revenue: 0, count: 0, avgTicket: 0, refunds: 0 };
      if (tx.status === "completed") {
        existing.revenue += Number(tx.net_amount);
        existing.count += 1;
      } else {
        existing.refunds += 1;
      }
      map.set(name, existing);
    }
    return Array.from(map.values())
      .map(p => ({ ...p, avgTicket: p.count > 0 ? p.revenue / p.count : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [transactions, products]);

  // ─── Payment Methods ───
  const paymentMethods = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const tx of transactions.filter(t => t.status === "completed")) {
      const method = tx.payment_method === "credit_card" || tx.payment_method === "card" ? "Cartão" : tx.payment_method === "pix" ? "PIX" : tx.payment_method === "boleto" ? "Boleto" : "Outro";
      const existing = map.get(method) || { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += Number(tx.net_amount);
      map.set(method, existing);
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b.count, 0);
    return Array.from(map.entries()).map(([name, data]) => ({
      name, value: data.count, revenue: data.revenue,
      pct: total > 0 ? (data.count / total * 100) : 0,
    }));
  }, [transactions]);

  // ─── Day of Week ───
  const dayOfWeek = useMemo(() => {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const data = days.map(d => ({ day: d, vendas: 0, receita: 0 }));
    for (const tx of transactions.filter(t => t.status === "completed")) {
      const dow = new Date(tx.created_at).getDay();
      data[dow].vendas += 1;
      data[dow].receita += Number(tx.net_amount);
    }
    return data;
  }, [transactions]);

  const bestDay = useMemo(() => {
    return dayOfWeek.reduce((a, b) => b.vendas > a.vendas ? b : a, dayOfWeek[0]);
  }, [dayOfWeek]);

  // ─── Monthly Cohort ───
  const monthlyCohort = useMemo(() => {
    const map = new Map<string, { month: string; receita: number; vendas: number; ticket: number }>();
    for (const tx of transactions.filter(t => t.status === "completed")) {
      const d = new Date(tx.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const existing = map.get(key) || { month: label, receita: 0, vendas: 0, ticket: 0 };
      existing.receita += Number(tx.net_amount);
      existing.vendas += 1;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, ticket: v.vendas > 0 ? v.receita / v.vendas : 0 }))
      .slice(-12);
  }, [transactions]);

  // ─── Recent Transactions Summary ───
  const recentSummary = useMemo(() => {
    const now = Date.now();
    const today = transactions.filter(t => now - new Date(t.created_at).getTime() < 86400000);
    const todayCompleted = today.filter(t => t.status === "completed");
    const todayRevenue = todayCompleted.reduce((a, t) => a + Number(t.net_amount), 0);
    const yesterday = transactions.filter(t => {
      const age = now - new Date(t.created_at).getTime();
      return age >= 86400000 && age < 2 * 86400000;
    });
    const yesterdayCompleted = yesterday.filter(t => t.status === "completed");
    const yesterdayRevenue = yesterdayCompleted.reduce((a, t) => a + Number(t.net_amount), 0);
    return { todayRevenue, todaySales: todayCompleted.length, yesterdayRevenue, yesterdaySales: yesterdayCompleted.length };
  }, [transactions]);

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageTitle icon={<BarChart3 className="h-6 w-6" />} title="Analytics" subtitle="Visão completa do seu negócio" />
        <div className="flex items-center gap-1.5 bg-card/50 border border-border/40 rounded-xl p-1">
          {([7, 15, 30] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all",
                period === p
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TODAY HIGHLIGHT ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlowPanel glow="success" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hoje</span>
          </div>
          <p className="font-display text-xl md:text-2xl font-black text-foreground tabular-nums">{fmt(recentSummary.todayRevenue)}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">{recentSummary.todaySales} vendas aprovadas</p>
        </GlowPanel>
        <GlowPanel glow="info" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ontem</span>
          </div>
          <p className="font-display text-xl md:text-2xl font-black text-foreground tabular-nums">{fmt(recentSummary.yesterdayRevenue)}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">{recentSummary.yesterdaySales} vendas</p>
        </GlowPanel>
        <GlowPanel glow="primary" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Melhor Hora</span>
          </div>
          <p className="font-display text-xl md:text-2xl font-black text-foreground tabular-nums">{peakHour.hour}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">{peakHour.vendas} vendas nesse horário</p>
        </GlowPanel>
        <GlowPanel glow="warning" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Melhor Dia</span>
          </div>
          <p className="font-display text-xl md:text-2xl font-black text-foreground tabular-nums">{bestDay.day}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">{bestDay.vendas} vendas ({fmtShort(bestDay.receita)})</p>
        </GlowPanel>
      </div>

      {/* ═══ MAIN KPIs ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <GlassKpi label="Receita Líquida" value={fmt(kpis.totalRevenue)} icon={DollarSign} tone="primary" delay={0}
          sub={kpis.trend !== 0 ? `${kpis.trend > 0 ? "+" : ""}${kpis.trend.toFixed(1)}% vs período ant.` : `${period} dias`} />
        <GlassKpi label="Vendas Aprovadas" value={String(kpis.totalSales)} icon={ShoppingCart} tone="success" delay={1}
          sub={kpis.salesTrend !== 0 ? `${kpis.salesTrend > 0 ? "+" : ""}${kpis.salesTrend.toFixed(1)}%` : undefined} />
        <GlassKpi label="Compradores" value={String(kpis.uniqueBuyers)} icon={Users} tone="info" delay={2} sub="Emails únicos" />
        <GlassKpi label="Ticket Médio" value={fmt(kpis.avgTicket)} icon={Target} tone="warning" delay={3} />
        <GlassKpi label="LTV Médio" value={fmt(kpis.ltv)} icon={TrendingUp} tone="primary" delay={4} sub="Receita / comprador" />
        <GlassKpi label="Conversão" value={`${kpis.conversionRate.toFixed(1)}%`} icon={Percent} tone="success" delay={5}
          sub={`${kpis.totalSales} de ${transactions.length}`} />
      </div>

      {/* ═══ HEALTH INDICATORS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Panel className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={cn("h-2 w-2 rounded-full", kpis.refundRate < 3 ? "bg-success" : kpis.refundRate < 6 ? "bg-warning" : "bg-destructive")} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taxa Reembolso</span>
          </div>
          <p className={cn("font-display text-lg font-black tabular-nums", kpis.refundRate < 3 ? "text-success" : kpis.refundRate < 6 ? "text-warning" : "text-destructive")}>
            {kpis.refundRate.toFixed(1)}%
          </p>
          <p className="text-[9px] text-muted-foreground/40 mt-0.5">{kpis.refunded} reembolsos</p>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={cn("h-2 w-2 rounded-full", kpis.chargebackRate < 1 ? "bg-success" : "bg-destructive animate-pulse")} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chargeback</span>
          </div>
          <p className={cn("font-display text-lg font-black tabular-nums", kpis.chargebackRate < 1 ? "text-success" : "text-destructive")}>
            {kpis.chargebackRate.toFixed(2)}%
          </p>
          <p className="text-[9px] text-muted-foreground/40 mt-0.5">{kpis.chargeback} disputas</p>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="h-3 w-3 text-warning" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pendentes</span>
          </div>
          <p className="font-display text-lg font-black text-warning tabular-nums">{kpis.pendingCount}</p>
          <p className="text-[9px] text-muted-foreground/40 mt-0.5">Aguardando pagamento</p>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Falhas</span>
          </div>
          <p className="font-display text-lg font-black text-destructive tabular-nums">{kpis.failedCount}</p>
          <p className="text-[9px] text-muted-foreground/40 mt-0.5">Transações recusadas</p>
        </Panel>
      </div>

      {/* ═══ REVENUE TREND ═══ */}
      <Panel>
        <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title={`Tendência de Receita (${period} dias)`} subtitle="Receita líquida e quantidade de vendas" />
        <div className="h-[280px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyRevenue}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.15)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
              <YAxis yAxisId="revenue" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [
                name === "receita" ? fmt(value) : `${value} vendas`,
                name === "receita" ? "Receita" : "Vendas"
              ]} />
              <Area yAxisId="revenue" type="monotone" dataKey="receita" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revenueGrad)" name="receita" />
              <Line yAxisId="count" type="monotone" dataKey="vendas" stroke="hsl(var(--chart-2))" strokeWidth={1.5} dot={false} name="vendas" strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ═══ CONVERSION FUNNEL ═══ */}
        <Panel>
          <SectionHeader icon={<Target className="h-4 w-4" />} title="Funil de Conversão" subtitle="Do checkout ao pagamento" />
          <div className="space-y-2.5 mt-4">
            {funnel.map((stage, i) => {
              const StageIcon = stage.icon;
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <StageIcon className="h-3 w-3" style={{ color: stage.color }} />
                      <span className="text-[11px] font-bold text-foreground">{stage.stage}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground tabular-nums">{stage.count}</span>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: stage.color }}>{stage.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted/15 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(stage.pct, 1)}%`, background: stage.color, opacity: 0.8 }} />
                  </div>
                  {i === 1 && funnel[2].count > 0 && (
                    <div className="flex items-center gap-1 mt-1 ml-5">
                      <ArrowDownRight className="h-2.5 w-2.5 text-success/50" />
                      <span className="text-[9px] text-success/60 font-medium">
                        {stage.count > 0 ? `${((funnel[2].count / stage.count) * 100).toFixed(0)}% convertem` : ""}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ═══ PAYMENT METHODS ═══ */}
        <Panel>
          <SectionHeader icon={<CreditCard className="h-4 w-4" />} title="Métodos de Pagamento" subtitle="Distribuição das vendas aprovadas" />
          <div className="flex items-center gap-6 mt-4">
            <div className="h-[200px] w-[200px] shrink-0">
              {paymentMethods.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={3} strokeWidth={0}>
                      {paymentMethods.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string, entry: any) => [
                      `${value} vendas · ${fmt(entry.payload.revenue)}`, name
                    ]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <span className="text-sm text-muted-foreground/40">Sem dados</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              {paymentMethods.map((pm, i) => (
                <div key={pm.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-[11px] font-bold text-foreground">{pm.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{pm.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/15 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pm.pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground/40">{pm.value} vendas · {fmt(pm.revenue)}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ═══ HOURLY DISTRIBUTION ═══ */}
        <Panel>
          <SectionHeader icon={<Clock className="h-4 w-4" />} title="Horário das Vendas" subtitle="Identifique os melhores horários para campanhas" />
          <div className="h-[220px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.15)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} vendas`, "Vendas"]} />
                <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* ═══ DAY OF WEEK ═══ */}
        <Panel>
          <SectionHeader icon={<CalendarDays className="h-4 w-4" />} title="Vendas por Dia da Semana" subtitle="Planeje promoções nos dias mais fortes" />
          <div className="h-[220px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.15)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [
                  name === "vendas" ? `${value} vendas` : fmt(value),
                  name === "vendas" ? "Vendas" : "Receita"
                ]} />
                <Bar dataKey="vendas" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} name="vendas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* ═══ MONTHLY COHORT ═══ */}
      <Panel>
        <SectionHeader icon={<Layers className="h-4 w-4" />} title="Evolução Mensal" subtitle="Receita, vendas e ticket médio por mês" />
        <div className="h-[280px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyCohort}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.15)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="revenue" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [
                name === "receita" ? fmt(value) : name === "vendas" ? `${value} vendas` : fmt(value),
                name === "receita" ? "Receita" : name === "vendas" ? "Vendas" : "Ticket Médio"
              ]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="revenue" dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="receita" />
              <Line yAxisId="count" type="monotone" dataKey="vendas" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} name="vendas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* ═══ TOP PRODUCTS ═══ */}
      <Panel>
        <SectionHeader icon={<Award className="h-4 w-4" />} title="Ranking de Produtos" subtitle="Receita, vendas e reembolsos por produto" />
        <div className="mt-4 space-y-3">
          {revenueByProduct.length === 0 && (
            <p className="text-sm text-muted-foreground/40 text-center py-8">Sem dados de vendas</p>
          )}
          {revenueByProduct.map((p, i) => {
            const maxRev = revenueByProduct[0]?.revenue || 1;
            const pct = (p.revenue / maxRev) * 100;
            return (
              <div key={p.name} className="group rounded-xl bg-muted/5 hover:bg-muted/10 p-3 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <span className="text-[12px] font-black">#{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-bold text-foreground truncate">{p.name}</span>
                      <span className="text-[13px] font-black text-foreground tabular-nums ml-2">{fmt(p.revenue)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/50" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[9px] text-muted-foreground/50 tabular-nums">{p.count} vendas</span>
                      <span className="text-[9px] text-muted-foreground/50 tabular-nums">Ticket: {fmt(p.avgTicket)}</span>
                      {p.refunds > 0 && (
                        <span className="text-[9px] text-destructive/60 tabular-nums">{p.refunds} reembolsos</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </PageShell>
  );
}
