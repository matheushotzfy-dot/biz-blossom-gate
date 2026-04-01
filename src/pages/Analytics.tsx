import { useMemo } from "react";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
  BarChart3, TrendingUp, Users, DollarSign, Target, Layers,
  ArrowUpRight, ArrowDownRight, ShoppingCart, Percent, Zap, Eye,
  Clock, CreditCard, Smartphone, FileText,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, CartesianGrid, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { PageShell, PageTitle, GlassKpi, Panel, SectionHeader } from "@/components/PageShell";
import { cn } from "@/lib/utils";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function Analytics() {
  const { data: transactions = [] } = useTransactions();
  const { data: products = [] } = useProducts();

  // ─── Conversion Funnel ───
  const funnel = useMemo(() => {
    const total = transactions.length;
    const pending = transactions.filter(t => t.status === "pending").length;
    const completed = transactions.filter(t => t.status === "completed").length;
    const failed = transactions.filter(t => t.status === "failed").length;
    const refunded = transactions.filter(t => t.status === "refunded").length;
    return [
      { stage: "Checkout Iniciado", count: total, pct: 100, color: "hsl(var(--primary))" },
      { stage: "Pagamento Pendente", count: pending + completed + refunded, pct: total > 0 ? ((pending + completed + refunded) / total * 100) : 0, color: "hsl(var(--warning))" },
      { stage: "Pagamento Aprovado", count: completed, pct: total > 0 ? (completed / total * 100) : 0, color: "hsl(var(--success))" },
      { stage: "Falhas", count: failed, pct: total > 0 ? (failed / total * 100) : 0, color: "hsl(var(--destructive))" },
    ];
  }, [transactions]);

  // ─── Daily Revenue Trend (last 30 days) ───
  const dailyRevenue = useMemo(() => {
    const map = new Map<string, { day: string; revenue: number; count: number }>();
    const now = new Date();
    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      map.set(key, { day: label, revenue: 0, count: 0 });
    }
    for (const tx of transactions.filter(t => t.status === "completed")) {
      const key = new Date(tx.created_at).toISOString().slice(0, 10);
      const existing = map.get(key);
      if (existing) {
        existing.revenue += Number(tx.net_amount);
        existing.count += 1;
      }
    }
    return Array.from(map.values());
  }, [transactions]);

  // ─── Hourly Distribution (Heatmap data) ───
  const hourlyDistribution = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}h`, sales: 0, revenue: 0 }));
    for (const tx of transactions.filter(t => t.status === "completed")) {
      const h = new Date(tx.created_at).getHours();
      hours[h].sales += 1;
      hours[h].revenue += Number(tx.net_amount);
    }
    return hours;
  }, [transactions]);

  // ─── Revenue by Product (LTV proxy) ───
  const revenueByProduct = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number; avgTicket: number }>();
    const completedTx = transactions.filter(t => t.status === "completed");
    for (const tx of completedTx) {
      const product = products.find(p => p.id === tx.product_id);
      const name = product?.name || "Outro";
      const existing = map.get(name) || { name, revenue: 0, count: 0, avgTicket: 0 };
      existing.revenue += Number(tx.net_amount);
      existing.count += 1;
      map.set(name, existing);
    }
    return Array.from(map.values())
      .map(p => ({ ...p, avgTicket: p.count > 0 ? p.revenue / p.count : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [transactions, products]);

  // ─── Cohort by Month ───
  const monthlyCohort = useMemo(() => {
    const map = new Map<string, { month: string; newBuyers: number; revenue: number; txCount: number }>();
    const completedTx = transactions.filter(t => t.status === "completed");
    for (const tx of completedTx) {
      const d = new Date(tx.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const existing = map.get(key) || { month: label, newBuyers: 0, revenue: 0, txCount: 0 };
      existing.revenue += Number(tx.net_amount);
      existing.txCount += 1;
      if (tx.customer_email) existing.newBuyers += 1;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
      .slice(-12);
  }, [transactions]);

  // ─── Payment Method Distribution ───
  const paymentMethods = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const tx of transactions.filter(t => t.status === "completed")) {
      const method = tx.payment_method === "credit_card" || tx.payment_method === "card" ? "Cartão" : tx.payment_method === "pix" ? "PIX" : tx.payment_method === "boleto" ? "Boleto" : "Outro";
      const existing = map.get(method) || { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += Number(tx.net_amount);
      map.set(method, existing);
    }
    return Array.from(map.entries()).map(([name, data]) => ({ name, value: data.count, revenue: data.revenue }));
  }, [transactions]);

  // ─── KPI Summary ───
  const kpis = useMemo(() => {
    const completed = transactions.filter(t => t.status === "completed");
    const totalRevenue = completed.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const uniqueEmails = new Set(completed.map(t => t.customer_email).filter(Boolean));
    const avgTicket = completed.length > 0 ? totalRevenue / completed.length : 0;
    const ltv = uniqueEmails.size > 0 ? totalRevenue / uniqueEmails.size : 0;
    const conversionRate = transactions.length > 0 ? (completed.length / transactions.length * 100) : 0;
    // Calculate 7-day trend
    const now = Date.now();
    const last7 = completed.filter(t => now - new Date(t.created_at).getTime() < 7 * 86400000);
    const prev7 = completed.filter(t => {
      const age = now - new Date(t.created_at).getTime();
      return age >= 7 * 86400000 && age < 14 * 86400000;
    });
    const last7Rev = last7.reduce((a, t) => a + Number(t.net_amount), 0);
    const prev7Rev = prev7.reduce((a, t) => a + Number(t.net_amount), 0);
    const trend = prev7Rev > 0 ? ((last7Rev - prev7Rev) / prev7Rev * 100) : 0;
    return { totalRevenue, totalSales: completed.length, uniqueBuyers: uniqueEmails.size, avgTicket, ltv, conversionRate, trend };
  }, [transactions]);

  return (
    <PageShell>
      <PageTitle icon={<BarChart3 className="h-6 w-6" />} title="Analytics Avançado" subtitle="Funil de conversão, tendências de receita e análise de cohort" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <GlassKpi label="Receita Total" value={fmt(kpis.totalRevenue)} icon={DollarSign} tone="primary" delay={0} sub={kpis.trend !== 0 ? `${kpis.trend > 0 ? "+" : ""}${kpis.trend.toFixed(1)}% vs 7d ant.` : undefined} />
        <GlassKpi label="Vendas Aprovadas" value={String(kpis.totalSales)} icon={ShoppingCart} tone="success" delay={1} />
        <GlassKpi label="Compradores Únicos" value={String(kpis.uniqueBuyers)} icon={Users} tone="info" delay={2} />
        <GlassKpi label="Ticket Médio" value={fmt(kpis.avgTicket)} icon={Target} tone="warning" delay={3} />
        <GlassKpi label="LTV Médio" value={fmt(kpis.ltv)} icon={TrendingUp} tone="primary" delay={4} />
        <GlassKpi label="Conversão Geral" value={`${kpis.conversionRate.toFixed(1)}%`} icon={Percent} tone="success" delay={5} />
      </div>

      {/* Daily Revenue Trend */}
      <Panel>
        <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="Tendência de Receita (30 dias)" />
        <div className="h-[260px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyRevenue}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.2)" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                formatter={(value: number, name: string) => [fmt(value), "Receita"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revenueGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Funnel */}
      <Panel>
        <SectionHeader icon={<Target className="h-4 w-4" />} title="Funil de Conversão" />
        <div className="space-y-3 mt-4">
          {funnel.map((stage, i) => (
            <div key={stage.stage} className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-bold text-foreground">{stage.stage}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground tabular-nums">{stage.count} transações</span>
                  <span className="text-[11px] font-bold text-primary tabular-nums">{stage.pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-3 rounded-full bg-muted/20 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${stage.pct}%`, background: stage.color }}
                />
              </div>
              {i < funnel.length - 1 && i < 2 && (
                <div className="flex items-center justify-center my-1">
                  <ArrowDownRight className="h-3 w-3 text-muted-foreground/30" />
                  <span className="text-[9px] text-muted-foreground/40 ml-1">
                    {funnel[i + 1] && stage.count > 0
                      ? `${((funnel[i + 1].count / stage.count) * 100).toFixed(0)}% avançam`
                      : ""}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Cohort */}
        <Panel>
          <SectionHeader icon={<Layers className="h-4 w-4" />} title="Receita Mensal (Cohort)" />
          <div className="h-[260px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCohort}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.2)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                  formatter={(value: number) => [fmt(value), "Receita"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Payment Methods Pie */}
        <Panel>
          <SectionHeader icon={<Zap className="h-4 w-4" />} title="Métodos de Pagamento" />
          <div className="h-[260px] mt-4 flex items-center justify-center">
            {paymentMethods.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3}>
                    {paymentMethods.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                    formatter={(value: number, name: string, entry: any) => [`${value} vendas (${fmt(entry.payload.revenue)})`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-sm text-muted-foreground/40">Sem dados</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {paymentMethods.map((pm, i) => (
              <div key={pm.name} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] font-bold text-muted-foreground">{pm.name}: {pm.value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Hourly Distribution */}
      <Panel>
        <SectionHeader icon={<Clock className="h-4 w-4" />} title="Distribuição por Hora do Dia" />
        <div className="h-[200px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.2)" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                formatter={(value: number, name: string) => [name === "sales" ? `${value} vendas` : fmt(value), name === "sales" ? "Vendas" : "Receita"]}
              />
              <Bar dataKey="sales" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Revenue by Product */}
      <Panel>
        <SectionHeader icon={<DollarSign className="h-4 w-4" />} title="LTV por Produto" />
        <div className="mt-4 space-y-2">
          {revenueByProduct.length === 0 && (
            <p className="text-sm text-muted-foreground/40 text-center py-8">Sem dados de vendas</p>
          )}
          {revenueByProduct.map((p, i) => {
            const maxRev = revenueByProduct[0]?.revenue || 1;
            const pct = (p.revenue / maxRev) * 100;
            return (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-muted-foreground w-40 truncate">{p.name}</span>
                <div className="flex-1 h-3 rounded-full bg-muted/20 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/50" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-bold text-foreground tabular-nums w-24 text-right">{fmt(p.revenue)}</span>
                <span className="text-[9px] text-muted-foreground/40 tabular-nums w-20 text-right">{p.count} vendas · {fmt(p.avgTicket)}/tx</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </PageShell>
  );
}
