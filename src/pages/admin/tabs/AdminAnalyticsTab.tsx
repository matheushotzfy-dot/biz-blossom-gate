import { useMemo } from "react";
import {
 BarChart3, TrendingUp, Users, CreditCard, DollarSign, Percent,
 Calendar, Target, Layers, Activity, PieChart as PieIcon, ArrowUpRight, Wallet, ShieldAlert,
} from "lucide-react";
import {
 AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
 BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel } from "./AdminPremium";

interface Props {
 transactions: Tables<"transactions">[];
 profiles: Tables<"profiles">[];
 products: Tables<"products">[];
 withdrawals: Tables<"withdrawals">[];
 fmtCurrency: (v: number) => string;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info))", "hsl(var(--destructive))"];

function TooltipBox({ active, payload, label, fmtCurrency }: any) {
 if (!active || !payload?.length) return null;
 return <div className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] shadow-xl">
  {label && <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>}
  {payload.map((p: any) => <div key={p.dataKey} className="flex items-center justify-between gap-5 py-0.5">
   <span className="font-bold text-muted-foreground">{p.name}</span>
   <span className="font-black tabular-nums text-foreground">{typeof p.value === "number" && p.value > 100 ? fmtCurrency(p.value) : p.value}</span>
  </div>)}
 </div>;
}

export default function AdminAnalyticsTab({ transactions, profiles, products, withdrawals, fmtCurrency }: Props) {

 // ═══ COHORT ANALYSIS ═══
 // Group sellers by signup month, track revenue in subsequent months
 const cohortData = useMemo(() => {
 const now = new Date();
 const months: string[] = [];
 for (let i = 5; i >= 0; i--) {
 const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
 months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
 }

 const sellerByMonth = new Map<string, Set<string>>();
 for (const p of profiles) {
 const m = p.created_at.slice(0, 7);
 if (!sellerByMonth.has(m)) sellerByMonth.set(m, new Set());
 sellerByMonth.get(m)!.add(p.user_id);
 }

 // Revenue by seller by month
 const revenueBySellerMonth = new Map<string, Map<string, number>>();
 for (const t of transactions) {
 if (t.status !== "completed" && t.status !== "approved") continue;
 const m = t.created_at.slice(0, 7);
 if (!revenueBySellerMonth.has(t.user_id)) revenueBySellerMonth.set(t.user_id, new Map());
 const sm = revenueBySellerMonth.get(t.user_id)!;
 sm.set(m, (sm.get(m) || 0) + Number(t.net_amount));
 }

 return months.map(month => {
 const sellers = sellerByMonth.get(month) || new Set();
 const activeSellers = new Set<string>();
 let revenue = 0;
 for (const sid of sellers) {
 const sm = revenueBySellerMonth.get(sid);
 if (sm) {
 for (const [, v] of sm) { revenue += v; }
 activeSellers.add(sid);
 }
 }
 return {
 month: month.slice(5) + "/" + month.slice(2, 4),
 newSellers: sellers.size,
 activeSellers: activeSellers.size,
 revenue: Math.round(revenue),
 retention: sellers.size > 0 ? Math.round((activeSellers.size / sellers.size) * 100) : 0,
 };
 });
 }, [profiles, transactions]);

 // ═══ CONVERSION FUNNEL ═══
 const funnel = useMemo(() => {
 const total = transactions.length;
 const pending = transactions.filter(t => t.status === "pending").length;
 const completed = transactions.filter(t => t.status === "completed" || t.status === "approved").length;
 const failed = transactions.filter(t => t.status === "failed" || t.status === "expired").length;
 const refunded = transactions.filter(t => t.status === "refunded").length;
 const chargeback = transactions.filter(t => t.status === "chargeback").length;

 return [
 { stage: "Iniciadas", count: total, pct: 100, color: "#3b82f6" },
 { stage: "Pendentes", count: pending, pct: total > 0 ? (pending / total) * 100 : 0, color: "#f59e0b" },
 { stage: "Aprovadas", count: completed, pct: total > 0 ? (completed / total) * 100 : 0, color: "#6366f1" },
 { stage: "Recusadas", count: failed, pct: total > 0 ? (failed / total) * 100 : 0, color: "#ef4444" },
 { stage: "Estornos", count: refunded, pct: total > 0 ? (refunded / total) * 100 : 0, color: "#f59e0b" },
 { stage: "Chargebacks", count: chargeback, pct: total > 0 ? (chargeback / total) * 100 : 0, color: "#ef4444" },
 ];
 }, [transactions]);

 // ═══ REVENUE FORECAST (linear regression on last 30 days) ═══
 const forecast = useMemo(() => {
 const now = new Date();
 const dailyRevenue = new Map<string, number>();

 for (let i = 29; i >= 0; i--) {
 const d = new Date(now); d.setDate(d.getDate() - i);
 dailyRevenue.set(d.toISOString().slice(0, 10), 0);
 }

 for (const t of transactions) {
 if (t.status !== "completed" && t.status !== "approved") continue;
 const day = t.created_at.slice(0, 10);
 if (dailyRevenue.has(day)) {
 dailyRevenue.set(day, dailyRevenue.get(day)! + Number(t.net_amount));
 }
 }

 const entries = Array.from(dailyRevenue.entries()).sort();
 const values = entries.map(([, v]) => v);

 // Simple linear regression
 const n = values.length;
 const xSum = n * (n - 1) / 2;
 const ySum = values.reduce((a, v) => a + v, 0);
 const xySum = values.reduce((a, v, i) => a + i * v, 0);
 const x2Sum = n * (n - 1) * (2 * n - 1) / 6;
 const slope = n > 1 ? (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum) : 0;
 const intercept = (ySum - slope * xSum) / n;

 // Build chart data with 7-day forecast
 const chartData = entries.map(([date, revenue], i) => ({
 date: date.slice(5).replace("-", "/"),
 receita: Math.round(revenue),
 previsao: null as number | null,
 }));

 for (let i = 1; i <= 7; i++) {
 const d = new Date(now); d.setDate(d.getDate() + i);
 const predicted = Math.max(0, Math.round(intercept + slope * (n + i - 1)));
 chartData.push({
 date: d.toISOString().slice(5, 10).replace("-", "/"),
 receita: null as any,
 previsao: predicted,
 });
 }

 const avgDaily = ySum / n;
 const monthProjection = avgDaily * 30;
 const trend = slope > 0 ? "up" : slope < 0 ? "down" : "flat";

 return { chartData, avgDaily, monthProjection, trend, slope };
 }, [transactions]);

 // ═══ METHOD DISTRIBUTION ═══
 const methodPie = useMemo(() => {
 const counts: Record<string, number> = {};
 for (const t of transactions) {
 const m = t.payment_method || "other";
 counts[m] = (counts[m] || 0) + 1;
 }
 const labels: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto", other: "Outro" };
 return Object.entries(counts).map(([method, count]) => ({
 name: labels[method] || method,
 value: count,
 }));
 }, [transactions]);

 // ═══ DAILY REVENUE BAR (last 14 days) ═══
 const dailyBars = useMemo(() => {
 const now = new Date();
 const data: { day: string; receita: number; taxas: number }[] = [];
 for (let i = 13; i >= 0; i--) {
 const d = new Date(now); d.setDate(d.getDate() - i);
 const key = d.toISOString().slice(0, 10);
 const label = `${d.getDate()}/${d.getMonth() + 1}`;
 let receita = 0, taxas = 0;
 for (const t of transactions) {
 if ((t.status !== "completed" && t.status !== "approved") || !t.created_at.startsWith(key)) continue;
 receita += Number(t.net_amount);
 taxas += Number(t.fee_amount);
 }
 data.push({ day: label, receita: Math.round(receita), taxas: Math.round(taxas) });
 }
 return data;
 }, [transactions]);

 // ═══ TOP KPIs ═══
 const approved = useMemo(() => transactions.filter(t => t.status === "completed" || t.status === "approved"), [transactions]);
 const totalRevenue = approved.reduce((a, t) => a + Number(t.net_amount), 0);
 const totalFees = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
 const approvalRate = transactions.length > 0 ? (approved.length / transactions.length) * 100 : 0;
 const activeSellers = new Set(approved.map(t => t.user_id)).size;
 const avgTicket = approved.length > 0 ? totalRevenue / approved.length : 0;

  return (
  <div className="space-y-6 animate-fade-in">
  <FinanceiroHero eyebrow="Analytics · Command Center" title={fmtCurrency(totalRevenue + totalFees)} subtitle={`TPV analisado · lucro ${fmtCurrency(totalFees)} · aprovação ${approvalRate.toFixed(1)}% · ${activeSellers} sellers ativos`} status={{ tone: "success", label: "Stripe-level analytics", pulse: true }} />
  <PremiumMetricGrid cols={6}>
  <PremiumMetric icon={DollarSign} label="Receita Líquida" value={fmtCurrency(totalRevenue)} sub="Total aprovado" tone="success" />
  <PremiumMetric icon={Percent} label="Lucro / Taxas" value={fmtCurrency(totalFees)} sub={`${transactions.length > 0 ? ((totalFees / (totalRevenue + totalFees)) * 100).toFixed(1) : 0}% do TPV`} tone="primary" />
  <PremiumMetric icon={Target} label="Aprovação" value={`${approvalRate.toFixed(1)}%`} sub={`${approved.length}/${transactions.length} transações`} tone="info" />
  <PremiumMetric icon={Users} label="Sellers Ativos" value={String(activeSellers)} sub={`base total ${profiles.length}`} tone="neutral" />
  <PremiumMetric icon={CreditCard} label="Ticket Médio" value={fmtCurrency(avgTicket)} sub="por venda aprovada" tone="warning" />
  <PremiumMetric icon={TrendingUp} label="Projeção Mês" value={fmtCurrency(forecast.monthProjection)} sub={forecast.trend === "up" ? "Crescendo" : forecast.trend === "down" ? "Contraindo" : "Estável"} tone={forecast.trend === "up" ? "success" : "neutral"} />
  </PremiumMetricGrid>

  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
  <PremiumPanel className="xl:col-span-2" title="Receita + projeção" eyebrow="30 dias reais · 7 dias forecast" icon={TrendingUp}>
  <ResponsiveContainer width="100%" height={330}>
  <ComposedChart data={forecast.chartData} margin={{ top: 10, right: 10, bottom: 0, left: -8 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.36} vertical={false} />
  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={4} tickLine={false} axisLine={false} />
  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
  <Tooltip content={<TooltipBox fmtCurrency={fmtCurrency} />} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.24 }} />
  <Area type="monotone" dataKey="receita" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.18)" strokeWidth={2.4} name="Receita" isAnimationActive animationDuration={900} />
  <Line type="monotone" dataKey="previsao" stroke="hsl(var(--warning))" strokeWidth={2.2} strokeDasharray="6 4" dot={false} name="Previsão" isAnimationActive animationDuration={1100} />
  </ComposedChart>
  </ResponsiveContainer>
  </PremiumPanel>

  <PremiumPanel title="Métodos" eyebrow="Distribuição" icon={PieIcon}>
  <ResponsiveContainer width="100%" height={330}>
  <PieChart>
  <Pie data={methodPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={104} paddingAngle={4} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
  {methodPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />)}
  </Pie>
  <Tooltip content={<TooltipBox fmtCurrency={fmtCurrency} />} />
  </PieChart>
  </ResponsiveContainer>
  </PremiumPanel>
  </div>

  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
  <PremiumPanel title="Funil de Conversão" eyebrow="Transações" icon={Layers}>
  <div className="space-y-3">
  {funnel.map((stage) => (
  <div key={stage.stage} className="space-y-1.5">
  <div className="flex justify-between text-xs"><span className="font-black text-foreground">{stage.stage}</span><span className="font-bold text-muted-foreground">{stage.count} · {stage.pct.toFixed(1)}%</span></div>
  <div className="h-8 overflow-hidden rounded-xl border border-border/50 bg-muted/30"><div className="h-full rounded-xl transition-all duration-700" style={{ width: `${Math.max(stage.pct, 2)}%`, backgroundColor: stage.color }} /></div>
  </div>
  ))}
  </div>
  </PremiumPanel>

  <PremiumPanel className="xl:col-span-2" title="Receita vs taxas" eyebrow="Últimos 14 dias" icon={BarChart3}>
  <ResponsiveContainer width="100%" height={280}>
  <BarChart data={dailyBars} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.36} vertical={false} />
  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
  <Tooltip content={<TooltipBox fmtCurrency={fmtCurrency} />} />
  <Legend wrapperStyle={{ fontSize: 11 }} />
  <Bar dataKey="receita" fill="hsl(var(--primary))" name="Receita Líquida" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={800} />
  <Bar dataKey="taxas" fill="hsl(var(--success))" name="Taxas Coletadas" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={1000} />
  </BarChart>
  </ResponsiveContainer>
  </PremiumPanel>
  </div>

  <PremiumPanel title="Cohort de Sellers" eyebrow="Retenção e ativação mensal" icon={Calendar}>
  <div className="overflow-x-auto">
  <table className="w-full text-sm">
  <thead><tr className="border-b border-border/40 bg-muted/30 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">{["Mês", "Novos", "Ativos", "Receita", "Retenção"].map(h => <th key={h} className="px-5 py-4 text-left">{h}</th>)}</tr></thead>
  <tbody>
  {cohortData.map(c => <tr key={c.month} className="border-b border-border/40 transition-colors hover:bg-muted/20">
  <td className="px-5 py-4 text-xs font-black text-foreground">{c.month}</td><td className="px-5 py-4 text-xs font-bold text-muted-foreground">{c.newSellers}</td><td className="px-5 py-4 text-xs font-black text-primary">{c.activeSellers}</td><td className="px-5 py-4 text-xs font-black text-foreground">{fmtCurrency(c.revenue)}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="h-2 w-24 overflow-hidden rounded-full bg-muted/50"><div className={cn("h-full rounded-full", c.retention >= 50 ? "bg-success" : c.retention >= 25 ? "bg-warning" : "bg-destructive")} style={{ width: `${c.retention}%` }} /></div><span className="text-[10px] font-black text-muted-foreground">{c.retention}%</span></div></td>
  </tr>)}
  </tbody>
  </table>
  </div>
  </PremiumPanel>
  </div>
  );
}
