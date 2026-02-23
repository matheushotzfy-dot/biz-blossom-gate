import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, ShoppingCart, Wallet, Clock, CheckCircle2,
  AlertCircle, RefreshCw, ArrowDownRight, CircleDollarSign,
  ArrowUpRight, Eye, Target, Trophy, Zap,
  Activity, BarChart3, PieChart as PieChartIcon, ChevronDown, CalendarDays,
  Lock, CreditCard, FileText, Receipt,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
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
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[0]); // Hoje por padrão

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
  const conversionRate = filteredTx.length > 0 ? ((approvedTx.length / filteredTx.length) * 100).toFixed(1) : "0";
  const chargebacks = filteredTx.filter((t) => t.status === "chargeback").length;
  const refunds = filteredTx.filter((t) => t.status === "refunded").length;

  const pixTx = approvedTx.filter((t) => t.payment_method === "pix");
  const cardTx = approvedTx.filter((t) => t.payment_method === "credit_card");
  const boletoTx = approvedTx.filter((t) => t.payment_method === "boleto");

  const pixAll = filteredTx.filter((t) => t.payment_method === "pix");
  const cardAll = filteredTx.filter((t) => t.payment_method === "credit_card");
  const boletoAll = filteredTx.filter((t) => t.payment_method === "boleto");

  const pixConv = pixAll.length > 0 ? ((pixTx.length / pixAll.length) * 100).toFixed(0) : "0";
  const cardConv = cardAll.length > 0 ? ((cardTx.length / cardAll.length) * 100).toFixed(0) : "0";
  const boletoConv = boletoAll.length > 0 ? ((boletoTx.length / boletoAll.length) * 100).toFixed(0) : "0";
  const chargebackRate = filteredTx.length > 0 ? ((chargebacks / filteredTx.length) * 100).toFixed(2) : "0";

  // Chart data
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

  return (
    <div className="space-y-6 animate-fade-in relative pb-8">
      {/* Ambient effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] bg-primary/[0.025] rounded-full blur-[150px] animate-float" />
        <div className="absolute bottom-[-15%] left-[-8%] w-[500px] h-[500px] bg-info/[0.02] rounded-full blur-[130px] animate-float" style={{ animationDelay: "3s" }} />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-primary/[0.015] rounded-full blur-[100px] animate-float" style={{ animationDelay: "5s" }} />
      </div>

      {/* ===== Header ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground font-display">
            Olá, {profile?.full_name?.split(" ")[0] || "Usuário"} 👋
          </h1>
          <p className="text-xs text-foreground/40 mt-0.5">Aqui está o resumo do seu negócio</p>
        </div>

        {/* Period Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-primary/20 rounded-xl px-4 py-2.5 text-xs font-bold text-foreground/80 transition-all duration-300 group">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              {selectedPeriod.label}
              <ChevronDown className="h-3 w-3 text-foreground/30 group-hover:text-primary transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[hsl(225,28%,7%)] border-white/[0.08] backdrop-blur-2xl rounded-xl p-1.5 min-w-[150px]">
            {PERIOD_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.label}
                onClick={() => setSelectedPeriod(opt)}
                className={`rounded-lg text-xs font-semibold cursor-pointer px-3 py-2.5 transition-all ${
                  selectedPeriod.label === opt.label
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/50 hover:text-foreground hover:bg-white/[0.05]"
                }`}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ===== Top KPI Row ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Receita bruta"
          value={fmtCurrency(totalRevenue)}
          sub={`${approvedTx.length} vendas`}
          icon={<DollarSign className="h-4 w-4" />}
          iconBg="bg-primary/10 text-primary"
          trend={approvedTx.length > 0 ? "up" : undefined}
        />
        <KpiCard
          label="Receita líquida"
          value={fmtCurrency(totalNet)}
          sub={`- ${fmtCurrency(totalFees)} taxas`}
          icon={<TrendingUp className="h-4 w-4" />}
          iconBg="bg-info/10 text-info"
        />
        <KpiCard
          label="Ticket médio"
          value={fmtCurrency(ticketMedio)}
          sub={approvedTx.length > 0 ? "por venda" : "—"}
          icon={<Receipt className="h-4 w-4" />}
          iconBg="bg-chart-3/10 text-chart-3"
        />
        <KpiCard
          label="Saldo disponível"
          value={fmtCurrency(totalNet)}
          sub={pendingWd > 0 ? `${fmtCurrency(pendingWd)} em saque` : "Disponível para saque"}
          icon={<Wallet className="h-4 w-4" />}
          iconBg="bg-warning/10 text-warning"
          action={{ label: "Sacar", href: "/financeiro/saques" }}
        />
      </div>

      {/* ===== Progress & Conversion Row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Progress Card - inspired by Screenshot_29 */}
        <GlassPanel>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-5 rounded-full bg-primary" />
            <h3 className="text-sm font-bold text-foreground">Progresso</h3>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-5">
            <div>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider font-semibold">Total faturado</p>
              <p className="text-2xl font-extrabold text-foreground font-display mt-0.5">{fmtCurrency(allTimeRevenue)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider font-semibold">Vendas diárias</p>
              <p className="text-2xl font-extrabold text-primary font-display mt-0.5">{fmtCurrency(todayRevenue)} <span className="text-sm font-bold text-primary/70">/ dia</span></p>
            </div>
            <div>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider font-semibold mt-3">Falta para</p>
              <p className="text-lg font-bold text-foreground/70 font-display">{fmtCurrency(Math.max(0, milestone.next.value - allTimeRevenue))}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider font-semibold mt-3">Meta atual</p>
              <p className="text-lg font-bold text-primary font-display">{milestone.next.label}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold text-foreground/50">Início</span>
              </div>
              <span className="text-[10px] text-foreground/40 italic">{milestone.pct.toFixed(0)}% do caminho até a meta</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-foreground/50">{milestone.next.label}</span>
                <Lock className="h-3.5 w-3.5 text-foreground/30" />
              </div>
            </div>
            <div className="w-full bg-white/[0.06] rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-primary transition-all duration-1000 relative"
                style={{ width: `${Math.max(milestone.pct, 2)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 animate-shimmer" />
              </div>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-foreground/30">PRÓXIMA META</span>
              <span className="text-sm font-extrabold text-foreground font-display">
                {MILESTONES[milestone.tier + 2]?.label || "🏆"}
              </span>
            </div>
          </div>
        </GlassPanel>

        {/* Conversion Card - inspired by Screenshot_27 */}
        <GlassPanel>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Conversão</h3>
              <p className="text-[10px] text-foreground/40">Relação entre pagamentos gerados e concluídos.</p>
            </div>
          </div>

          <div className="space-y-4">
            <ConversionRow icon={<TrendingUp className="h-4 w-4" />} label="Conversão Geral" value={`${conversionRate}%`} pct={Number(conversionRate)} color="primary" />
            <ConversionRow icon={<Zap className="h-4 w-4" />} label="Pix" value={`${pixConv}%`} pct={Number(pixConv)} color="primary" />
            <ConversionRow icon={<CreditCard className="h-4 w-4" />} label="Cartão de Crédito" value={`${cardConv}%`} pct={Number(cardConv)} color="info" />
            <ConversionRow icon={<FileText className="h-4 w-4" />} label="Boleto" value={`${boletoConv}%`} pct={Number(boletoConv)} color="warning" />
            <ConversionRow icon={<AlertCircle className="h-4 w-4" />} label="Taxa de estorno" value={`${chargebackRate}%`} pct={Number(chargebackRate)} color="destructive" />
          </div>
        </GlassPanel>
      </div>

      {/* ===== Chart + Financial Summary ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Area Chart */}
        <div className="lg:col-span-7">
          <GlassPanel>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-primary" />
                <h3 className="text-sm font-bold text-foreground">Vendas ({selectedPeriod.label})</h3>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-primary font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(152,68%,46%,0.8)]" />
                Tempo real
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(152, 68%, 46%)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(152, 68%, 46%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 20%, 10%)" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(225, 10%, 25%)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(225, 10%, 25%)" fontSize={10} tickFormatter={(v) => `${v}`} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(225, 28%, 7%)",
                    border: "1px solid hsl(225, 20%, 14%)",
                    borderRadius: "12px",
                    fontSize: "11px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                    color: "white",
                  }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                  labelStyle={{ color: "hsl(0, 0%, 45%)" }}
                />
                <Area type="monotone" dataKey="vendas" stroke="hsl(152, 68%, 46%)" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: "hsl(152, 68%, 46%)", stroke: "hsl(225, 28%, 7%)", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassPanel>
        </div>

        {/* Financial Summary + Status */}
        <div className="lg:col-span-5 space-y-4">
          {/* Quick stats */}
          <GlassPanel>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h3 className="text-sm font-bold text-foreground">Resumo Financeiro</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Receita Bruta" value={fmtCurrency(totalRevenue)} accent />
              <MiniStat label="Taxas" value={`- ${fmtCurrency(totalFees)}`} />
              <MiniStat label="Chargebacks" value={String(chargebacks)} />
              <MiniStat label="Reembolsos" value={String(refunds)} />
            </div>
          </GlassPanel>

          {/* Status Pie */}
          <GlassPanel>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h3 className="text-sm font-bold text-foreground">Status</h3>
            </div>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={56} dataKey="value" paddingAngle={3} strokeWidth={0}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {pieData.map((d, i) => {
                    const statusLabels: Record<string, string> = { completed: "Aprovado", pending: "Pendente", failed: "Falhou", refunded: "Reembolso", chargeback: "Chargeback" };
                    return (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-xs text-foreground/60 font-medium">{statusLabels[d.name] || d.name}</span>
                        </div>
                        <span className="text-xs font-bold text-foreground">{d.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[100px] text-xs text-foreground/30">Sem dados</div>
            )}
          </GlassPanel>
        </div>
      </div>

      {/* ===== Activity Feed ===== */}
      <GlassPanel>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-primary" />
            <h3 className="text-sm font-bold text-foreground">Atividade Recente</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] text-primary font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(152,68%,46%,0.8)]" />
              Ao vivo
            </div>
            <Link to="/financeiro/extrato" className="text-[10px] text-foreground/40 hover:text-primary font-semibold flex items-center gap-1 transition-colors">
              Ver tudo <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {recentActivity.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-12 text-foreground/20">
              <Eye className="h-8 w-8 mb-3" />
              <p className="text-xs font-medium">Nenhuma atividade recente</p>
            </div>
          ) : (
            recentActivity.map((item) => {
              const isTx = "payment_method" in item;
              const statusMap: Record<string, { color: string; label: string }> = {
                completed: { color: "text-primary bg-primary/10", label: "Aprovado" },
                approved: { color: "text-primary bg-primary/10", label: "Aprovado" },
                pending: { color: "text-warning bg-warning/10", label: "Pendente" },
                paid: { color: "text-primary bg-primary/10", label: "Pago" },
                requested: { color: "text-warning bg-warning/10", label: "Solicitado" },
                failed: { color: "text-destructive bg-destructive/10", label: "Falhou" },
                rejected: { color: "text-destructive bg-destructive/10", label: "Recusado" },
                refunded: { color: "text-info bg-info/10", label: "Reembolso" },
                chargeback: { color: "text-destructive bg-destructive/10", label: "Chargeback" },
              };
              const st = statusMap[item.status] || { color: "text-foreground/40 bg-white/5", label: item.status };
              return (
                <div key={item.id} className="flex items-center gap-3 py-3 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 border border-white/[0.03]">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${isTx ? "bg-primary/10 text-primary" : "bg-info/10 text-info"}`}>
                    {isTx ? <DollarSign className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{fmtCurrency(Number(item.amount))}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground/35 truncate mt-0.5">
                      {isTx ? (item as Tables<"transactions">).customer_name || "Transação" : "Saque"}
                    </p>
                  </div>
                  <span className="text-[10px] text-foreground/25 whitespace-nowrap font-medium">{formatRelativeTime(item.created_at)}</span>
                </div>
              );
            })
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

/* ============ Sub-components ============ */

function GlassPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] backdrop-blur-2xl rounded-2xl p-5 relative overflow-hidden border border-white/[0.05] hover:border-white/[0.08] transition-all duration-500">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, iconBg, trend, action }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; iconBg: string; trend?: "up" | "down"; action?: { label: string; href: string };
}) {
  return (
    <div className="bg-white/[0.02] backdrop-blur-2xl rounded-2xl p-5 group relative overflow-hidden border border-white/[0.05] hover:border-primary/15 transition-all duration-500 hover:translate-y-[-2px] hover:shadow-[0_8px_30px_-10px_hsl(152,68%,46%,0.15)]">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/[0.03] rounded-full blur-2xl group-hover:bg-primary/[0.06] transition-all duration-700" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-foreground/35 uppercase tracking-wider">{label}</p>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg} transition-all duration-300`}>
            {icon}
          </div>
        </div>
        <p className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground font-display">{value}</p>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px] text-foreground/35">{sub}</p>
          {trend === "up" && <ArrowUpRight className="h-3.5 w-3.5 text-primary" />}
        </div>
        {action && (
          <Link to={action.href} className="text-[10px] text-primary font-bold mt-2 inline-flex items-center gap-1 hover:gap-2 transition-all duration-300">
            {action.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function ConversionRow({ icon, label, value, pct, color }: { icon: React.ReactNode; label: string; value: string; pct: number; color: string }) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary",
    info: "bg-info",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };
  const iconBgMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="flex items-center gap-3">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBgMap[color] || iconBgMap.primary}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-foreground/70">{label}</span>
          <span className="text-xs font-bold text-foreground">{value}</span>
        </div>
        <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${colorMap[color] || colorMap.primary} transition-all duration-700`}
            style={{ width: `${Math.max(pct, 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
      <p className="text-[9px] text-foreground/35 uppercase tracking-wider font-bold">{label}</p>
      <p className={`text-base font-bold mt-1 ${accent ? "text-primary" : "text-foreground"} font-display`}>{value}</p>
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
