import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, ShoppingCart, Wallet, Clock, CheckCircle2,
  AlertCircle, RefreshCw, ArrowDownRight, CircleDollarSign,
  ArrowUpRight, Eye, Target, Trophy, Zap,
  Activity, BarChart3, PieChart as PieChartIcon, ChevronDown, CalendarDays,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ============ Constants ============ */

const MILESTONES = [
  { label: "Início", value: 0 },
  { label: "10K", value: 10000 },
  { label: "100K", value: 100000 },
  { label: "500K", value: 500000 },
  { label: "1M", value: 1000000 },
  { label: "5M", value: 5000000 },
];

const PERIOD_OPTIONS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "3 dias", days: 3 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
];

const PIE_COLORS = [
  "hsl(152, 68%, 46%)",
  "hsl(38, 95%, 55%)",
  "hsl(0, 72%, 51%)",
  "hsl(210, 75%, 55%)",
  "hsl(280, 65%, 55%)",
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

const fmtCurrency = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function toBrasiliaDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function brasiliaToday() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

/* ============ Main Component ============ */

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[3]); // 7 dias default

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("user_id", uid).single(),
      supabase.from("withdrawals").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
    ]).then(([txRes, profileRes, wdRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      if (wdRes.data) setWithdrawals(wdRes.data);
    });
  }, [user?.id]);

  /* ---- Filtered transactions by period ---- */
  const filteredTx = useMemo(() => {
    const today = brasiliaToday();
    if (selectedPeriod.days === 0) {
      const todayStr = today.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return transactions.filter((t) => toBrasiliaDate(t.created_at) === todayStr);
    }
    if (selectedPeriod.days === 1) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return transactions.filter((t) => toBrasiliaDate(t.created_at) === yStr);
    }
    const start = new Date(today);
    start.setDate(start.getDate() - selectedPeriod.days);
    start.setHours(0, 0, 0, 0);
    return transactions.filter((t) => new Date(t.created_at) >= start);
  }, [transactions, selectedPeriod]);

  const approvedTx = filteredTx.filter((t) => t.status === "completed");
  const totalRevenue = approvedTx.reduce((a, t) => a + Number(t.amount), 0);
  const totalNet = approvedTx.reduce((a, t) => a + Number(t.net_amount), 0);
  const totalFees = approvedTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const ticketMedio = approvedTx.length > 0 ? totalRevenue / approvedTx.length : 0;
  const pendingWd = withdrawals.filter((w) => w.status === "pending").reduce((a, w) => a + Number(w.amount), 0);
  const conversionRate = filteredTx.length > 0 ? ((approvedTx.length / filteredTx.length) * 100).toFixed(1) : "0.0";
  const chargebacks = filteredTx.filter((t) => t.status === "chargeback").length;
  const refunds = filteredTx.filter((t) => t.status === "refunded").length;

  const pixTx = approvedTx.filter((t) => t.payment_method === "pix");
  const cardTx = approvedTx.filter((t) => t.payment_method === "credit_card");
  const boletoTx = approvedTx.filter((t) => t.payment_method === "boleto");

  // Chart data based on period
  const chartDays = Math.max(selectedPeriod.days || 1, 1);
  const chartData = useMemo(() => {
    const days = Math.min(chartDays, 30);
    return Array.from({ length: days }, (_, i) => {
      const now = brasiliaToday();
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const compareDate = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const dayTx = transactions.filter((t) => toBrasiliaDate(t.created_at) === compareDate && t.status === "completed");
      return { name: dayStr, vendas: dayTx.reduce((a, t) => a + Number(t.amount), 0) };
    });
  }, [transactions, chartDays]);

  const statusCounts = filteredTx.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // All-time for milestones
  const allCompleted = transactions.filter((t) => t.status === "completed");
  const allTimeRevenue = allCompleted.reduce((a, t) => a + Number(t.amount), 0);
  const milestone = getCurrentMilestone(allTimeRevenue);

  const todayRevenue = useMemo(() => {
    const todayStr = brasiliaToday().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return transactions
      .filter((t) => toBrasiliaDate(t.created_at) === todayStr && t.status === "completed")
      .reduce((a, t) => a + Number(t.amount), 0);
  }, [transactions]);

  const recentActivity = [...transactions.slice(0, 5), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  /* ---- Period label for header ---- */
  const periodLabel = useMemo(() => {
    const today = brasiliaToday();
    if (selectedPeriod.days === 0) return today.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
    if (selectedPeriod.days === 1) {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return y.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
    }
    const start = new Date(today); start.setDate(start.getDate() - selectedPeriod.days);
    return `${start.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} — ${today.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;
  }, [selectedPeriod]);

  return (
    <div className="space-y-5 animate-fade-in relative">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-info/[0.03] rounded-full blur-[100px] animate-float" style={{ animationDelay: "3s" }} />
      </div>

      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground font-display">
            Dashboard
          </h1>
          <p className="text-xs text-foreground/40 mt-1">Visão geral do seu negócio</p>
        </div>

        {/* Period Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 glass-card hover:bg-white/[0.06] rounded-2xl px-4 py-2.5 text-xs font-semibold text-foreground/80 transition-all duration-300 border border-white/[0.06] hover:border-primary/20 group">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              <span>{selectedPeriod.label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-foreground/40 group-hover:text-primary transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[hsl(225,25%,6%)] border-white/[0.08] backdrop-blur-xl rounded-xl p-1 min-w-[160px]">
            {PERIOD_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.label}
                onClick={() => setSelectedPeriod(opt)}
                className={`rounded-lg text-xs font-medium cursor-pointer px-3 py-2.5 transition-all ${
                  selectedPeriod.label === opt.label
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/60 hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Date Range Indicator */}
      <div className="flex items-center gap-2 text-[11px] text-foreground/40">
        <Clock className="h-3 w-3 text-primary/60" />
        <span>{periodLabel}</span>
      </div>

      {/* ===== Milestone ===== */}
      <div className="glass-card rounded-2xl p-5 relative overflow-hidden border border-white/[0.04]">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-[0_0_20px_hsl(152,68%,46%,0.15)]">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-sm font-bold text-foreground">Premiações</span>
                <p className="text-[10px] text-foreground/40">Próximo nível: {milestone.next.label}</p>
              </div>
            </div>
            <span className="text-sm font-extrabold text-primary font-display">
              {fmtCurrency(allTimeRevenue)}
            </span>
          </div>
          <div className="w-full bg-white/[0.04] rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-primary transition-all duration-1000 shadow-[0_0_20px_hsl(152,68%,46%,0.5)]"
              style={{ width: `${Math.max(milestone.pct, 2)}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            {MILESTONES.map((m) => (
              <div key={m.label} className="flex flex-col items-center">
                <div className={`h-2 w-2 rounded-full transition-all ${
                  allTimeRevenue >= m.value
                    ? "bg-primary shadow-[0_0_8px_hsl(152,68%,46%,0.6)]"
                    : "bg-white/10"
                }`} />
                <span className={`text-[9px] mt-1 font-semibold ${
                  allTimeRevenue >= m.value ? "text-primary" : "text-foreground/30"
                }`}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== KPI Cards ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total em Vendas"
          value={fmtCurrency(totalRevenue)}
          subtitle={`${approvedTx.length} vendas aprovadas`}
          icon={<DollarSign className="h-5 w-5" />}
          accentClass="from-primary/20 to-primary/5"
        />
        <KpiCard
          label="Ticket Médio"
          value={fmtCurrency(ticketMedio)}
          subtitle={approvedTx.length > 0 ? "média por venda" : "sem vendas"}
          icon={<TrendingUp className="h-5 w-5" />}
          accentClass="from-info/20 to-info/5"
        />
        <KpiCard
          label="Pedidos Pagos"
          value={String(approvedTx.length)}
          subtitle={`de ${filteredTx.length} transações`}
          icon={<ShoppingCart className="h-5 w-5" />}
          accentClass="from-chart-3/20 to-chart-3/5"
        />
        <KpiCard
          label="Saldo Disponível"
          value={fmtCurrency(totalNet)}
          subtitle={pendingWd > 0 ? `${fmtCurrency(pendingWd)} pendente` : "Pronto para saque"}
          icon={<Wallet className="h-5 w-5" />}
          accentClass="from-warning/20 to-warning/5"
          action={{ label: "Solicitar Saque", href: "/financeiro/saques" }}
        />
      </div>

      {/* ===== Payment Methods ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MethodCard label="PIX" value={pixTx.reduce((a, t) => a + Number(t.amount), 0)} count={pixTx.length} total={filteredTx.filter((t) => t.payment_method === "pix").length} emoji="⚡" />
        <MethodCard label="Cartão" value={cardTx.reduce((a, t) => a + Number(t.amount), 0)} count={cardTx.length} total={filteredTx.filter((t) => t.payment_method === "credit_card").length} emoji="💳" />
        <MethodCard label="Boleto" value={boletoTx.reduce((a, t) => a + Number(t.amount), 0)} count={boletoTx.length} total={filteredTx.filter((t) => t.payment_method === "boleto").length} emoji="📄" />
      </div>

      {/* ===== Middle Row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Financial Summary */}
        <GlassPanel>
          <SectionTitle icon={<CircleDollarSign className="h-4 w-4 text-primary" />}>Resumo Financeiro</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <MetricTile icon={<RefreshCw className="h-3.5 w-3.5 text-primary" />} label="Conversão" value={`${conversionRate}%`} />
            <MetricTile icon={<AlertCircle className="h-3.5 w-3.5 text-warning" />} label="Pre-Chargeback" value="0" />
            <MetricTile icon={<ArrowDownRight className="h-3.5 w-3.5 text-destructive" />} label="Chargeback" value={String(chargebacks)} />
            <MetricTile icon={<CircleDollarSign className="h-3.5 w-3.5 text-info" />} label="Reembolsos" value={String(refunds)} />
          </div>
        </GlassPanel>

        {/* Progress */}
        <GlassPanel>
          <SectionTitle icon={<Target className="h-4 w-4 text-primary" />}>Progresso</SectionTitle>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-xs text-foreground/50">
              <span>Faturado</span><span>Hoje</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xl font-extrabold text-foreground font-display">{fmtCurrency(allTimeRevenue)}</span>
              <span className="text-xl font-extrabold text-primary font-display">{fmtCurrency(todayRevenue)}</span>
            </div>
            <div className="w-full bg-white/[0.04] rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700 shadow-[0_0_10px_hsl(152,68%,46%,0.4)]"
                style={{ width: `${Math.max(milestone.pct, 1)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-foreground/40">Falta {fmtCurrency(Math.max(0, milestone.next.value - allTimeRevenue))}</span>
              <span className="text-primary font-bold">{milestone.pct.toFixed(0)}%</span>
            </div>
          </div>
        </GlassPanel>

        {/* Monitoring */}
        <GlassPanel>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<Zap className="h-4 w-4 text-primary" />}>Monitoramento</SectionTitle>
            <span className="flex items-center gap-1.5 text-[10px] text-primary font-semibold">
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
        </GlassPanel>
      </div>

      {/* ===== Bottom Row: Chart + Pie + Activity ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Area Chart */}
        <div className="lg:col-span-5">
          <GlassPanel>
            <SectionTitle icon={<BarChart3 className="h-4 w-4 text-primary" />}>
              Vendas ({selectedPeriod.label})
            </SectionTitle>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(152, 68%, 46%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(152, 68%, 46%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 20%, 12%)" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(225, 10%, 30%)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(225, 10%, 30%)" fontSize={10} tickFormatter={(v) => `${v}`} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(225, 25%, 6%)",
                      border: "1px solid hsl(225, 20%, 12%)",
                      borderRadius: "12px",
                      fontSize: "11px",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                      color: "white",
                    }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                    labelStyle={{ color: "hsl(0, 0%, 50%)" }}
                  />
                  <Area type="monotone" dataKey="vendas" stroke="hsl(152, 68%, 46%)" strokeWidth={2} fill="url(#areaGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassPanel>
        </div>

        {/* Pie Chart */}
        <div className="lg:col-span-3">
          <GlassPanel>
            <SectionTitle icon={<PieChartIcon className="h-4 w-4 text-primary" />}>Status</SectionTitle>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={4} strokeWidth={0}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(225, 25%, 6%)",
                        border: "1px solid hsl(225, 20%, 12%)",
                        borderRadius: "12px",
                        fontSize: "11px",
                        color: "white",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="capitalize text-foreground/50">{d.name}</span>
                      <span className="font-bold text-foreground">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[170px] text-sm text-foreground/30">Sem dados</div>
            )}
          </GlassPanel>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-4">
          <GlassPanel>
            <div className="flex items-center justify-between mb-4">
              <SectionTitle icon={<Activity className="h-4 w-4 text-primary" />}>Atividade</SectionTitle>
              <div className="flex items-center gap-1.5 text-[10px] text-primary font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(152,68%,46%,0.8)]" />
                Ao vivo
              </div>
            </div>
            <div className="space-y-0.5 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-foreground/30">
                  <Eye className="h-6 w-6 mb-2 opacity-30" />
                  <p className="text-xs">Nenhuma atividade</p>
                </div>
              ) : (
                recentActivity.map((item) => {
                  const isTx = "payment_method" in item;
                  const statusMap: Record<string, { color: string; label: string }> = {
                    completed: { color: "text-primary", label: "Aprovado" },
                    approved: { color: "text-primary", label: "Aprovado" },
                    pending: { color: "text-warning", label: "Pendente" },
                    paid: { color: "text-primary", label: "Pago" },
                    requested: { color: "text-warning", label: "Solicitado" },
                    failed: { color: "text-destructive", label: "Falhou" },
                    rejected: { color: "text-destructive", label: "Recusado" },
                    refunded: { color: "text-info", label: "Reembolso" },
                    chargeback: { color: "text-destructive", label: "Chargeback" },
                  };
                  const st = statusMap[item.status] || { color: "text-foreground/40", label: item.status };
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] last:border-0">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${isTx ? "bg-primary/10 text-primary" : "bg-info/10 text-info"}`}>
                        {isTx ? <DollarSign className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{fmtCurrency(Number(item.amount))}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${st.color} ${st.color.replace("text-", "bg-")}/10`}>
                            {st.label}
                          </span>
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
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function GlassPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden border border-white/[0.04] hover:border-white/[0.06] transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
      {icon}
      {children}
    </h3>
  );
}

function KpiCard({ label, value, subtitle, icon, accentClass, action }: {
  label: string; value: string; subtitle?: string; icon: React.ReactNode; accentClass: string; action?: { label: string; href: string };
}) {
  return (
    <div className="glass-card rounded-2xl p-5 group relative overflow-hidden border border-white/[0.04] hover:border-primary/10 transition-all duration-500">
      <div className={`absolute -top-10 -right-10 w-28 h-28 bg-gradient-to-br ${accentClass} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[10px] font-bold text-foreground/40 uppercase tracking-wider">{label}</h4>
          <div className="h-9 w-9 rounded-xl bg-white/[0.04] backdrop-blur-sm flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors duration-500">
            {icon}
          </div>
        </div>
        <p className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground font-display">{value}</p>
        {subtitle && <p className="text-[10px] text-foreground/40 mt-1.5">{subtitle}</p>}
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
    <div className="glass-card rounded-2xl p-5 group border border-white/[0.04] hover:border-white/[0.06] transition-colors duration-500">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-lg">{emoji}</span>
        <h4 className="text-[10px] font-bold text-foreground/40 uppercase tracking-wider">{label}</h4>
      </div>
      <p className="text-xl font-extrabold text-foreground font-display">{fmtCurrency(value)}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-foreground/40">{count}/{total} pedidos</span>
        <span className="text-[10px] text-primary font-bold">{convRate}%</span>
      </div>
    </div>
  );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
      <div className="flex justify-center mb-1.5">{icon}</div>
      <p className="text-[9px] text-foreground/40 uppercase tracking-wider font-semibold">{label}</p>
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
