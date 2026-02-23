import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, ShoppingCart, Wallet, Clock, CheckCircle2,
  AlertCircle, RefreshCw, ArrowDownRight, CircleDollarSign,
  Lock, ArrowUpRight, Eye, Target, Trophy, Zap, Shield, Activity,
  Sparkles, BarChart3, PieChart as PieChartIcon,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const MILESTONES = [
  { label: "Início", value: 0 },
  { label: "10K", value: 10000 },
  { label: "100K", value: 100000 },
  { label: "500K", value: 500000 },
  { label: "1M", value: 1000000 },
  { label: "5M", value: 5000000 },
];

function getCurrentMilestone(revenue: number) {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (revenue >= MILESTONES[i].value) {
      const next = MILESTONES[i + 1] || MILESTONES[i];
      const prev = MILESTONES[i];
      const pct = next.value === prev.value ? 100 : ((revenue - prev.value) / (next.value - prev.value)) * 100;
      return { current: prev, next, pct: Math.min(pct, 100), tier: i };
    }
  }
  return { current: MILESTONES[0], next: MILESTONES[1], pct: (revenue / MILESTONES[1].value) * 100, tier: 0 };
}

const fmtCurrency = (v: number) => {
  if (v === 0) return "R$ 0,00";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("*").eq("user_id", uid).single(),
      supabase.from("withdrawals").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
    ]).then(([txRes, profileRes, wdRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      if (wdRes.data) setWithdrawals(wdRes.data);
    });
  }, [user?.id]);

  const approvedTx = transactions.filter((t) => t.status === "approved");
  const totalRevenue = approvedTx.reduce((a, t) => a + Number(t.amount), 0);
  const totalNet = approvedTx.reduce((a, t) => a + Number(t.net_amount), 0);
  const totalFees = approvedTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const ticketMedio = approvedTx.length > 0 ? totalRevenue / approvedTx.length : 0;
  const pendingWd = withdrawals.filter((w) => w.status === "pending").reduce((a, w) => a + Number(w.amount), 0);
  const conversionRate = transactions.length > 0 ? ((approvedTx.length / transactions.length) * 100).toFixed(1) : "0.0";
  const chargebacks = transactions.filter((t) => t.status === "chargeback").length;
  const refunds = transactions.filter((t) => t.status === "refunded").length;
  const pixTx = approvedTx.filter(t => t.payment_method === "pix");
  const cardTx = approvedTx.filter(t => t.payment_method === "credit_card");
  const boletoTx = approvedTx.filter(t => t.payment_method === "boleto");

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = transactions.filter((t) => new Date(t.created_at).toDateString() === d.toDateString() && t.status === "approved");
    return { name: dayStr, vendas: dayTx.reduce((a, t) => a + Number(t.amount), 0) };
  });

  const statusCounts = transactions.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["hsl(152,68%,46%)", "hsl(38,95%,55%)", "hsl(0,72%,51%)", "hsl(210,75%,55%)", "hsl(280,65%,55%)"];

  const milestone = getCurrentMilestone(totalRevenue);
  const dailyRevenue = chartData[chartData.length - 1]?.vendas || 0;

  const recentActivity = [...transactions.slice(0, 5), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Background ambient effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-info/[0.03] rounded-full blur-[100px] animate-float" style={{ animationDelay: '3s' }} />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary animate-glow-pulse" />
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">Visão Geral</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground font-display">
              Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2 glass-card rounded-2xl px-4 py-2.5 text-xs text-foreground/60 shrink-0">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">
              {new Date(Date.now() - 30 * 86400000).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
              {" — "}
              {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="sm:hidden">Últimos 30 dias</span>
          </div>
        </div>

        {/* Milestone Bar */}
        <div className="glass-card rounded-2xl p-5 glow-primary relative overflow-hidden">
          <div className="absolute inset-0 dot-grid opacity-30" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <span className="text-sm font-bold text-foreground">Premiações</span>
                  <p className="text-[10px] text-foreground/40">Próximo nível: {milestone.next.label}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-xl">
                {fmtCurrency(totalRevenue)}
              </span>
            </div>
            <div className="w-full bg-white/[0.04] rounded-full h-3 overflow-hidden backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-primary transition-all duration-1000 shadow-[0_0_20px_hsl(152,68%,46%,0.5)]"
                style={{ width: `${Math.max(milestone.pct, 2)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2.5">
              {MILESTONES.map((m) => (
                <div key={m.label} className="flex flex-col items-center">
                  <div className={`h-2 w-2 rounded-full transition-all ${
                    totalRevenue >= m.value ? "bg-primary shadow-[0_0_8px_hsl(152,68%,46%,0.6)]" : "bg-white/10"
                  }`} />
                  <span className={`text-[9px] mt-1 font-semibold ${totalRevenue >= m.value ? "text-primary" : "text-foreground/30"}`}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total em Vendas" value={fmtCurrency(totalRevenue)} subtitle={`${approvedTx.length} vendas aprovadas`} icon={<DollarSign className="h-5 w-5" />} glowColor="primary" />
        <KpiCard label="Ticket Médio" value={fmtCurrency(ticketMedio)} subtitle={approvedTx.length > 0 ? `média por venda` : "sem vendas"} icon={<TrendingUp className="h-5 w-5" />} glowColor="info" />
        <KpiCard label="Pedidos Pagos" value={approvedTx.length > 0 ? String(approvedTx.length) : "0"} subtitle={`de ${transactions.length} transações`} icon={<ShoppingCart className="h-5 w-5" />} glowColor="chart-3" />
        <KpiCard label="Saldo Disponível" value={fmtCurrency(totalNet)} subtitle={pendingWd > 0 ? `${fmtCurrency(pendingWd)} pendente` : "Pronto para saque"} icon={<Wallet className="h-5 w-5" />} glowColor="warning" action={{ label: "Solicitar Saque", href: "/financeiro/saques" }} />
      </div>

      {/* Payment Methods */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MethodCard label="PIX" value={pixTx.reduce((a,t) => a + Number(t.amount), 0)} count={pixTx.length} total={transactions.filter(t => t.payment_method === "pix").length} emoji="⚡" />
        <MethodCard label="Cartão" value={cardTx.reduce((a,t) => a + Number(t.amount), 0)} count={cardTx.length} total={transactions.filter(t => t.payment_method === "credit_card").length} emoji="💳" />
        <MethodCard label="Boleto" value={boletoTx.reduce((a,t) => a + Number(t.amount), 0)} count={boletoTx.length} total={transactions.filter(t => t.payment_method === "boleto").length} emoji="📄" />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Financial Summary */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
          <div className="relative">
            <SectionTitle icon={<CircleDollarSign className="h-4 w-4 text-primary" />}>Resumo Financeiro</SectionTitle>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <MetricCard icon={<RefreshCw className="h-4 w-4 text-primary" />} label="Conversão" value={`${conversionRate}%`} />
              <MetricCard icon={<AlertCircle className="h-4 w-4 text-warning" />} label="Pre-Chargeback" value="0" />
              <MetricCard icon={<ArrowDownRight className="h-4 w-4 text-destructive" />} label="Chargeback" value={String(chargebacks)} />
              <MetricCard icon={<CircleDollarSign className="h-4 w-4 text-info" />} label="Reembolsos" value={String(refunds)} />
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-info/5 to-transparent rounded-bl-full" />
          <div className="relative">
            <SectionTitle icon={<Target className="h-4 w-4 text-primary" />}>Progresso</SectionTitle>
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs text-foreground/50 mb-1">
                  <span>Faturado</span><span>Hoje</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xl font-bold text-foreground">{fmtCurrency(totalRevenue)}</span>
                  <span className="text-xl font-bold text-primary">{fmtCurrency(dailyRevenue)}</span>
                </div>
              </div>
              <div className="w-full bg-white/[0.04] rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700 shadow-[0_0_10px_hsl(152,68%,46%,0.4)]" style={{ width: `${Math.max(milestone.pct, 1)}%` }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-foreground/40">Falta {fmtCurrency(Math.max(0, milestone.next.value - totalRevenue))}</span>
                <span className="text-primary font-bold">{milestone.pct.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monitoring */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-success/5 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle icon={<Zap className="h-4 w-4 text-primary" />}>Monitoramento</SectionTitle>
              <span className="flex items-center gap-1.5 text-[10px] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(152,68%,46%,0.8)]" />
                Online
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-5">
              <MonitorItem label="Tempo Médio" value="0 ms" />
              <MonitorItem label="Conversão" value={`${conversionRate}%`} accent />
              <MonitorItem label="API/min" value="0.0" />
              <MonitorItem label="Webhook" value="100%" accent />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Chart + Pie + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Bar Chart */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-5">
          <SectionTitle icon={<BarChart3 className="h-4 w-4 text-primary" />}>Vendas (7 dias)</SectionTitle>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barCategoryGap="25%">
                <defs>
                  <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(152, 68%, 46%)" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="hsl(152, 68%, 46%)" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 20%, 12%)" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(225, 10%, 35%)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(225, 10%, 35%)" fontSize={11} tickFormatter={(v) => `${v}`} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(225, 25%, 8%)", border: "1px solid hsl(225, 20%, 14%)", borderRadius: "16px", fontSize: "12px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", color: "white" }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                  labelStyle={{ color: "hsl(0, 0%, 70%)" }}
                />
                <Bar dataKey="vendas" fill="url(#barGrad2)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="lg:col-span-3 glass-card rounded-2xl p-5">
          <SectionTitle icon={<PieChartIcon className="h-4 w-4 text-primary" />}>Status</SectionTitle>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(225, 25%, 8%)", border: "1px solid hsl(225, 20%, 14%)", borderRadius: "12px", fontSize: "12px", color: "white" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="capitalize text-foreground/50">{d.name}</span>
                    <span className="font-bold text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-sm text-foreground/30">Sem dados</div>
          )}
        </div>

        {/* Activity */}
        <div className="lg:col-span-4 glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<Activity className="h-4 w-4 text-primary" />}>Atividade</SectionTitle>
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(152,68%,46%,0.8)]" />
              <span className="font-medium">Ao vivo</span>
            </div>
          </div>
          <div className="space-y-0.5 max-h-[260px] overflow-y-auto pr-1">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-foreground/30">
                <Eye className="h-6 w-6 mb-2 opacity-30" />
                <p className="text-xs">Nenhuma atividade</p>
              </div>
            ) : (
              recentActivity.map((item) => {
                const isTx = "payment_method" in item;
                const statusColor = item.status === "approved" || item.status === "paid" ? "text-primary" : item.status === "pending" || item.status === "requested" ? "text-warning" : "text-destructive";
                const statusLabel: Record<string, string> = { approved: "Aprovado", pending: "Pendente", paid: "Pago", requested: "Solicitado", failed: "Falhou", rejected: "Recusado", refunded: "Reembolso", chargeback: "Chargeback" };
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-0">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${isTx ? "bg-primary/10 text-primary" : "bg-info/10 text-info"}`}>
                      {isTx ? <DollarSign className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{fmtCurrency(Number(item.amount))}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusColor} ${statusColor.replace("text-", "bg-")}/10`}>{statusLabel[item.status] || item.status}</span>
                      </div>
                      <p className="text-[11px] text-foreground/40 truncate mt-0.5">
                        {isTx ? (item as Tables<"transactions">).customer_name || "Nova transação" : "Solicitação de saque"}
                      </p>
                    </div>
                    <span className="text-[10px] text-foreground/30 whitespace-nowrap">{formatRelativeTime(item.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.04]">
            <Link to="/financeiro/extrato" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
              Ver Transações <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
      {icon}
      {children}
    </h3>
  );
}

function KpiCard({ label, value, subtitle, icon, glowColor, action }: {
  label: string; value: string; subtitle?: string; icon: React.ReactNode; glowColor: string; action?: { label: string; href: string };
}) {
  return (
    <div className="glass-card-hover rounded-2xl p-5 group relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/[0.04] rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">{label}</h4>
          <div className="h-9 w-9 rounded-xl bg-white/[0.04] backdrop-blur-sm flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors duration-500">
            {icon}
          </div>
        </div>
        <p className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-display">{value}</p>
        {subtitle && <p className="text-[11px] text-foreground/40 mt-1.5">{subtitle}</p>}
        {action && (
          <Link to={action.href} className="text-xs text-primary font-bold mt-3 inline-flex items-center gap-1.5 hover:gap-2.5 transition-all duration-300">
            {action.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function MethodCard({ label, value, count, total, emoji }: { label: string; value: number; count: number; total: number; emoji: string }) {
  const convRate = total > 0 ? ((count / total) * 100).toFixed(0) : "0";
  return (
    <div className="glass-card-hover rounded-2xl p-5 group">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xl">{emoji}</span>
        <h4 className="text-xs font-bold text-foreground/50 uppercase tracking-wider">{label}</h4>
      </div>
      <p className="text-xl font-extrabold text-foreground font-display">{fmtCurrency(value)}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px] text-foreground/40">{count}/{total} pedidos</span>
        <span className="text-[11px] text-primary font-bold">{convRate}%</span>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-[10px] text-foreground/40 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function MonitorItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-foreground/40 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}m`;
}
