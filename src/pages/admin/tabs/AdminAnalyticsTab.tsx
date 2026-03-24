import { useMemo } from "react";
import {
  BarChart3, TrendingUp, Users, CreditCard, DollarSign, Percent,
  Calendar, Target, Layers, Activity, PieChart as PieIcon, ArrowUpRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle, AdminKpi } from "./AdminOverviewTab";
import { cn } from "@/lib/utils";

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  withdrawals: Tables<"withdrawals">[];
  fmtCurrency: (v: number) => string;
}

const COLORS = ["#6366f1", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

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
    <div className="space-y-5 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <AdminKpi icon={<DollarSign className="h-5 w-5" />} label="Receita Líquida" value={fmtCurrency(totalRevenue)} sub="Total aprovado" highlight />
        <AdminKpi icon={<Percent className="h-5 w-5" />} label="Take Rate" value={fmtCurrency(totalFees)} sub={`${transactions.length > 0 ? ((totalFees / (totalRevenue + totalFees)) * 100).toFixed(1) : 0}%`} />
        <AdminKpi icon={<Target className="h-5 w-5" />} label="Taxa Aprovação" value={`${approvalRate.toFixed(1)}%`} sub={`${approved.length}/${transactions.length}`} />
        <AdminKpi icon={<Users className="h-5 w-5" />} label="Sellers Ativos" value={String(activeSellers)} sub={`de ${profiles.length}`} />
        <AdminKpi icon={<CreditCard className="h-5 w-5" />} label="Ticket Médio" value={fmtCurrency(avgTicket)} sub="Por venda" />
        <AdminKpi icon={<TrendingUp className="h-5 w-5" />} label="Projeção Mês" value={fmtCurrency(forecast.monthProjection)} sub={forecast.trend === "up" ? "Crescendo" : forecast.trend === "down" ? "Caindo" : "Estável"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Forecast */}
        <AdminPanel className="lg:col-span-2">
          <PanelTitle color="emerald" icon={<TrendingUp className="h-4 w-4" />}>
            Previsão de Receita (30 dias + 7 dias projetados)
          </PanelTitle>
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecast.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} interval={4} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#0C0C18", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: 12, color: "#fff" }} />
                <Area type="monotone" dataKey="receita" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} name="Receita" />
                <Area type="monotone" dataKey="previsao" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeDasharray="5 5" name="Previsão" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AdminPanel>

        {/* Conversion Funnel */}
        <AdminPanel>
          <PanelTitle color="blue" icon={<Layers className="h-4 w-4" />}>Funil de Conversão</PanelTitle>
          <div className="mt-4 space-y-2">
            {funnel.map((stage, i) => (
              <div key={stage.stage} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-white/80">{stage.stage}</span>
                  <span className="text-white/30">{stage.count} ({stage.pct.toFixed(1)}%)</span>
                </div>
                <div className="h-6 bg-white/[0.04] rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-500"
                    style={{ width: `${Math.max(stage.pct, 2)}%`, backgroundColor: stage.color, opacity: 0.8 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>

        {/* Method Distribution */}
        <AdminPanel>
          <PanelTitle color="violet" icon={<PieIcon className="h-4 w-4" />}>Distribuição por Método</PanelTitle>
          <div className="h-[250px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={methodPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {methodPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#0C0C18", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: 12, color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </AdminPanel>

        {/* Daily Revenue Bars */}
        <AdminPanel className="lg:col-span-2">
          <PanelTitle color="amber" icon={<BarChart3 className="h-4 w-4" />}>Receita vs Taxas (14 dias)</PanelTitle>
          <div className="h-[280px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#0C0C18", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: 12, color: "#fff" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                <Bar dataKey="receita" fill="#6366f1" name="Receita Líquida" radius={[4, 4, 0, 0]} />
                <Bar dataKey="taxas" fill="#f59e0b" name="Taxas Coletadas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminPanel>

        {/* Cohort Analysis */}
        <AdminPanel className="lg:col-span-2">
          <PanelTitle color="cyan" icon={<Calendar className="h-4 w-4" />}>Análise de Cohort — Sellers por Mês de Cadastro</PanelTitle>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06]">
                {["Mês", "Novos Sellers", "Ativos (venderam)", "Receita Gerada", "Retenção"].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-semibold text-white/25 uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {cohortData.map(c => (
                  <tr key={c.month} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <td className="p-3 text-xs font-bold text-white/80">{c.month}</td>
                    <td className="p-3 text-xs text-white/60">{c.newSellers}</td>
                    <td className="p-3 text-xs text-indigo-400 font-medium">{c.activeSellers}</td>
                    <td className="p-3 text-xs font-bold text-white/80">{fmtCurrency(c.revenue)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", c.retention >= 50 ? "bg-indigo-500" : c.retention >= 25 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${c.retention}%` }} />
                        </div>
                        <span className="text-[10px] text-white/30">{c.retention}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
