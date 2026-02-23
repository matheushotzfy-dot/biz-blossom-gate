import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, Wallet, CheckCircle2,
  AlertCircle, RefreshCw, ArrowDownRight,
  ArrowUpRight, Eye, Trophy, Zap,
  ChevronDown, CalendarDays,
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
    <div className="space-y-5 relative pb-8">
      {/* ===== Cinematic Background ===== */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 20% 30%, rgba(0,255,170,0.07), transparent 40%),
              radial-gradient(circle at 80% 70%, rgba(0,148,255,0.06), transparent 40%),
              radial-gradient(circle at 60% 20%, rgba(124,58,237,0.04), transparent 35%),
              hsl(225, 25%, 6%)
            `,
          }}
        />
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary/[0.03] rounded-full blur-[180px] animate-float" />
        <div className="absolute bottom-[-15%] left-[-8%] w-[600px] h-[600px] bg-info/[0.025] rounded-full blur-[160px] animate-float" style={{ animationDelay: "3s" }} />
        <div className="absolute top-[50%] left-[40%] w-[400px] h-[400px] bg-[hsl(280,65%,55%)]/[0.02] rounded-full blur-[120px] animate-float" style={{ animationDelay: "5s" }} />
      </div>

      {/* ===== Header ===== */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground font-display">
            Olá, {profile?.full_name?.split(" ")[0] || "Usuário"} 👋
          </h1>
          <p className="text-xs text-foreground/40 mt-0.5">Aqui está o resumo do seu negócio</p>
        </div>

        {/* Period Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-foreground/80 transition-all duration-300 group rounded-2xl border border-white/[0.06] hover:border-primary/20"
              style={{
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 0 0 1px rgba(0,255,170,0.03), 0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              {selectedPeriod.label}
              <ChevronDown className="h-3 w-3 text-foreground/30 group-hover:text-primary transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-white/[0.08] rounded-2xl p-1.5 min-w-[160px]"
            style={{
              background: "rgba(11,15,23,0.95)",
              backdropFilter: "blur(30px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.label}
                onClick={() => setSelectedPeriod(opt)}
                className={`rounded-xl text-xs font-semibold cursor-pointer px-3 py-2.5 transition-all ${
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <KpiCard
          label="Receita bruta"
          value={fmtCurrency(totalRevenue)}
          sub={`${approvedTx.length} vendas`}
          icon={<DollarSign className="h-4 w-4" />}
          glowColor="0,255,170"
          trend={approvedTx.length > 0 ? "up" : undefined}
        />
        <KpiCard
          label="Receita líquida"
          value={fmtCurrency(totalNet)}
          sub={`- ${fmtCurrency(totalFees)} taxas`}
          icon={<TrendingUp className="h-4 w-4" />}
          glowColor="0,148,255"
        />
        <KpiCard
          label="Ticket médio"
          value={fmtCurrency(ticketMedio)}
          sub={approvedTx.length > 0 ? "por venda" : "—"}
          icon={<Receipt className="h-4 w-4" />}
          glowColor="124,58,237"
        />
        <KpiCard
          label="Saldo disponível"
          value={fmtCurrency(totalNet)}
          sub={pendingWd > 0 ? `${fmtCurrency(pendingWd)} em saque` : "Disponível para saque"}
          icon={<Wallet className="h-4 w-4" />}
          glowColor="255,170,0"
          action={{ label: "Sacar", href: "/financeiro/saques" }}
        />
      </div>

      {/* ===== Mirrored: Progress + Conversion ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        {/* Progress Card */}
        <CinematicPanel glowPosition="top-left" glowColor="0,255,170">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,255,170,0.1)", boxShadow: "0 0 20px rgba(0,255,170,0.15)" }}>
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Progresso</h3>
              <p className="text-[10px] text-foreground/30">Meta de faturamento</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-5">
            <div>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider font-semibold">Total faturado</p>
              <p className="text-2xl font-extrabold text-foreground font-display mt-0.5" style={{ textShadow: "0 0 30px rgba(0,255,170,0.15)" }}>{fmtCurrency(allTimeRevenue)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider font-semibold">Vendas diárias</p>
              <p className="text-2xl font-extrabold text-primary font-display mt-0.5" style={{ textShadow: "0 0 20px rgba(0,255,170,0.25)" }}>{fmtCurrency(todayRevenue)} <span className="text-sm font-bold text-primary/70">/ dia</span></p>
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
              <span className="text-[10px] text-foreground/40 italic">{milestone.pct.toFixed(0)}%</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-foreground/50">{milestone.next.label}</span>
                <Lock className="h-3.5 w-3.5 text-foreground/30" />
              </div>
            </div>
            <div className="w-full rounded-full h-3 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div
                className="h-full rounded-full relative transition-all duration-1000"
                style={{
                  width: `${Math.max(milestone.pct, 2)}%`,
                  background: "linear-gradient(90deg, hsl(152,68%,46%), hsl(152,80%,60%), hsl(152,68%,46%))",
                  boxShadow: "0 0 20px rgba(0,255,170,0.4), 0 0 60px rgba(0,255,170,0.1)",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/25 animate-shimmer" />
              </div>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-foreground/30">PRÓXIMA META</span>
              <span className="text-sm font-extrabold text-foreground font-display">
                {MILESTONES[milestone.tier + 2]?.label || "🏆"}
              </span>
            </div>
          </div>
        </CinematicPanel>

        {/* Conversion Card (mirror) */}
        <CinematicPanel glowPosition="top-right" glowColor="0,148,255">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,148,255,0.1)", boxShadow: "0 0 20px rgba(0,148,255,0.15)" }}>
              <RefreshCw className="h-4 w-4 text-info" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Conversão</h3>
              <p className="text-[10px] text-foreground/30">Taxa de sucesso por método</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <ConversionRow icon={<TrendingUp className="h-4 w-4" />} label="Conversão Geral" value={`${conversionRate}%`} pct={Number(conversionRate)} glowColor="0,255,170" />
            <ConversionRow icon={<Zap className="h-4 w-4" />} label="Pix" value={`${pixConv}%`} pct={Number(pixConv)} glowColor="0,255,170" />
            <ConversionRow icon={<CreditCard className="h-4 w-4" />} label="Cartão de Crédito" value={`${cardConv}%`} pct={Number(cardConv)} glowColor="0,148,255" />
            <ConversionRow icon={<FileText className="h-4 w-4" />} label="Boleto" value={`${boletoConv}%`} pct={Number(boletoConv)} glowColor="255,170,0" />
            <ConversionRow icon={<AlertCircle className="h-4 w-4" />} label="Taxa de estorno" value={`${chargebackRate}%`} pct={Number(chargebackRate)} glowColor="255,60,60" />
          </div>
        </CinematicPanel>
      </div>

      {/* ===== Chart + Financial (Mirrored) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
        {/* Area Chart */}
        <div className="lg:col-span-7">
          <CinematicPanel glowPosition="bottom-left" glowColor="0,255,170">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-primary" style={{ boxShadow: "0 0 8px rgba(0,255,170,0.5)" }} />
                <h3 className="text-sm font-bold text-foreground">Vendas ({selectedPeriod.label})</h3>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-primary font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(0,255,170,0.06)", boxShadow: "0 0 15px rgba(0,255,170,0.08)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ boxShadow: "0 0 8px rgba(0,255,170,0.8)" }} />
                Tempo real
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="neonGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(0,255,170,0.3)" stopOpacity={1} />
                    <stop offset="50%" stopColor="rgba(0,255,170,0.08)" stopOpacity={1} />
                    <stop offset="100%" stopColor="rgba(0,255,170,0)" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.12)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.12)" fontSize={10} tickFormatter={(v) => `${v}`} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(11,15,23,0.95)",
                    border: "1px solid rgba(0,255,170,0.15)",
                    borderRadius: "16px",
                    fontSize: "11px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(0,255,170,0.08)",
                    color: "white",
                    backdropFilter: "blur(20px)",
                  }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                  labelStyle={{ color: "rgba(255,255,255,0.4)" }}
                />
                <Area
                  type="monotone"
                  dataKey="vendas"
                  stroke="rgba(0,255,170,0.9)"
                  strokeWidth={2.5}
                  fill="url(#neonGrad)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "hsl(152, 68%, 46%)",
                    stroke: "rgba(0,255,170,0.3)",
                    strokeWidth: 6,
                    style: { filter: "drop-shadow(0 0 8px rgba(0,255,170,0.6))" } as React.CSSProperties,
                  }}
                  style={{ filter: "drop-shadow(0 0 6px rgba(0,255,170,0.3))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CinematicPanel>
        </div>

        {/* Financial Summary + Status (Mirror) */}
        <div className="lg:col-span-5 space-y-4">
          <CinematicPanel glowPosition="top-right" glowColor="124,58,237">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full" style={{ background: "hsl(280,65%,55%)", boxShadow: "0 0 8px rgba(124,58,237,0.5)" }} />
              <h3 className="text-sm font-bold text-foreground">Resumo Financeiro</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Receita Bruta" value={fmtCurrency(totalRevenue)} glowColor="0,255,170" accent />
              <MiniStat label="Taxas" value={`- ${fmtCurrency(totalFees)}`} glowColor="255,170,0" />
              <MiniStat label="Chargebacks" value={String(chargebacks)} glowColor="255,60,60" />
              <MiniStat label="Reembolsos" value={String(refunds)} glowColor="0,148,255" />
            </div>
          </CinematicPanel>

          <CinematicPanel glowPosition="bottom-right" glowColor="0,148,255">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-5 rounded-full bg-info" style={{ boxShadow: "0 0 8px rgba(0,148,255,0.5)" }} />
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
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length], boxShadow: `0 0 8px ${PIE_COLORS[i % PIE_COLORS.length]}40` }} />
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
          </CinematicPanel>
        </div>
      </div>

      {/* ===== Activity Feed ===== */}
      <div className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
        <CinematicPanel glowPosition="bottom-center" glowColor="0,255,170">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-primary" style={{ boxShadow: "0 0 8px rgba(0,255,170,0.5)" }} />
              <h3 className="text-sm font-bold text-foreground">Atividade Recente</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-primary font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(0,255,170,0.06)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ boxShadow: "0 0 8px rgba(0,255,170,0.8)" }} />
                Ao vivo
              </div>
              <Link to="/financeiro/extrato" className="text-[10px] text-foreground/40 hover:text-primary font-semibold flex items-center gap-1 transition-colors duration-300">
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
                const statusMap: Record<string, { color: string; label: string; glow: string }> = {
                  completed: { color: "text-primary", label: "Aprovado", glow: "0,255,170" },
                  approved: { color: "text-primary", label: "Aprovado", glow: "0,255,170" },
                  pending: { color: "text-warning", label: "Pendente", glow: "255,170,0" },
                  paid: { color: "text-primary", label: "Pago", glow: "0,255,170" },
                  requested: { color: "text-warning", label: "Solicitado", glow: "255,170,0" },
                  failed: { color: "text-destructive", label: "Falhou", glow: "255,60,60" },
                  rejected: { color: "text-destructive", label: "Recusado", glow: "255,60,60" },
                  refunded: { color: "text-info", label: "Reembolso", glow: "0,148,255" },
                  chargeback: { color: "text-destructive", label: "Chargeback", glow: "255,60,60" },
                };
                const st = statusMap[item.status] || { color: "text-foreground/40", label: item.status, glow: "255,255,255" };
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-3 px-3 rounded-2xl transition-all duration-300 border border-white/[0.04] hover:border-white/[0.08] group cursor-default"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      e.currentTarget.style.boxShadow = `0 0 30px rgba(${st.glow},0.05)`;
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{
                      background: isTx ? "rgba(0,255,170,0.08)" : "rgba(0,148,255,0.08)",
                      boxShadow: isTx ? "0 0 15px rgba(0,255,170,0.1)" : "0 0 15px rgba(0,148,255,0.1)",
                    }}>
                      {isTx ? <DollarSign className="h-4 w-4 text-primary" /> : <ArrowDownRight className="h-4 w-4 text-info" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{fmtCurrency(Number(item.amount))}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${st.color}`} style={{ background: `rgba(${st.glow},0.08)` }}>
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
        </CinematicPanel>
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function CinematicPanel({ children, glowPosition, glowColor }: { children: React.ReactNode; glowPosition?: string; glowColor?: string }) {
  const gc = glowColor || "0,255,170";
  const glowStyles: Record<string, React.CSSProperties> = {
    "top-left": { top: "-40%", left: "-20%", width: "300px", height: "300px" },
    "top-right": { top: "-40%", right: "-20%", width: "300px", height: "300px" },
    "bottom-left": { bottom: "-40%", left: "-20%", width: "300px", height: "300px" },
    "bottom-right": { bottom: "-40%", right: "-20%", width: "300px", height: "300px" },
    "bottom-center": { bottom: "-30%", left: "30%", width: "300px", height: "300px" },
  };
  const glowStyle = glowStyles[glowPosition || "top-left"] || glowStyles["top-left"];

  return (
    <div
      className="rounded-[18px] p-5 relative overflow-hidden transition-all duration-500 group/panel"
      style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: `0 0 0 1px rgba(${gc},0.03), 0 10px 40px rgba(0,0,0,0.5)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
        e.currentTarget.style.boxShadow = `0 0 0 1px rgba(${gc},0.06), 0 15px 50px rgba(0,0,0,0.6), 0 0 40px rgba(${gc},0.04)`;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)";
        e.currentTarget.style.boxShadow = `0 0 0 1px rgba(${gc},0.03), 0 10px 40px rgba(0,0,0,0.5)`;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Top highlight line */}
      <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: `linear-gradient(90deg, transparent, rgba(${gc},0.12), transparent)` }} />
      {/* Ambient glow */}
      <div
        className="absolute rounded-full blur-[100px] pointer-events-none opacity-40 group-hover/panel:opacity-60 transition-opacity duration-700"
        style={{ ...glowStyle, background: `rgba(${gc},0.08)` }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, glowColor, trend, action }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; glowColor: string; trend?: "up" | "down"; action?: { label: string; href: string };
}) {
  return (
    <div
      className="rounded-[18px] p-5 group relative overflow-hidden transition-all duration-500 cursor-default"
      style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: `0 0 0 1px rgba(${glowColor},0.03), 0 10px 40px rgba(0,0,0,0.5)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = `1px solid rgba(${glowColor},0.15)`;
        e.currentTarget.style.boxShadow = `0 0 0 1px rgba(${glowColor},0.08), 0 15px 50px rgba(0,0,0,0.6), 0 0 50px rgba(${glowColor},0.06)`;
        e.currentTarget.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)";
        e.currentTarget.style.boxShadow = `0 0 0 1px rgba(${glowColor},0.03), 0 10px 40px rgba(0,0,0,0.5)`;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Top highlight */}
      <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: `linear-gradient(90deg, transparent, rgba(${glowColor},0.15), transparent)` }} />
      {/* Corner glow */}
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-[50px] opacity-40 group-hover:opacity-70 transition-all duration-700" style={{ background: `rgba(${glowColor},0.1)` }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-foreground/35 uppercase tracking-wider">{label}</p>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-300" style={{ background: `rgba(${glowColor},0.08)`, boxShadow: `0 0 15px rgba(${glowColor},0.12)`, color: `rgb(${glowColor})` }}>
            {icon}
          </div>
        </div>
        <p className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground font-display" style={{ textShadow: `0 0 25px rgba(${glowColor},0.15)` }}>{value}</p>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px] text-foreground/35">{sub}</p>
          {trend === "up" && <ArrowUpRight className="h-3.5 w-3.5 text-primary" style={{ filter: "drop-shadow(0 0 4px rgba(0,255,170,0.4))" }} />}
        </div>
        {action && (
          <Link to={action.href} className="text-[10px] text-primary font-bold mt-2 inline-flex items-center gap-1 hover:gap-2 transition-all duration-300" style={{ textShadow: "0 0 10px rgba(0,255,170,0.3)" }}>
            {action.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function ConversionRow({ icon, label, value, pct, glowColor }: { icon: React.ReactNode; label: string; value: string; pct: number; glowColor: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `rgba(${glowColor},0.08)`, boxShadow: `0 0 15px rgba(${glowColor},0.1)`, color: `rgb(${glowColor})` }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-foreground/70">{label}</span>
          <span className="text-xs font-bold text-foreground" style={{ textShadow: `0 0 15px rgba(${glowColor},0.2)` }}>{value}</span>
        </div>
        <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.max(pct, 0)}%`,
              background: `rgb(${glowColor})`,
              boxShadow: `0 0 10px rgba(${glowColor},0.4)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent, glowColor }: { label: string; value: string; accent?: boolean; glowColor?: string }) {
  const gc = glowColor || "255,255,255";
  return (
    <div className="rounded-xl p-3 border border-white/[0.04] transition-all duration-300 hover:border-white/[0.08]" style={{ background: "rgba(255,255,255,0.02)" }}>
      <p className="text-[9px] text-foreground/35 uppercase tracking-wider font-bold">{label}</p>
      <p className={`text-base font-bold mt-1 font-display ${accent ? "text-primary" : "text-foreground"}`} style={{ textShadow: accent ? `0 0 20px rgba(${gc},0.25)` : "none" }}>{value}</p>
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
