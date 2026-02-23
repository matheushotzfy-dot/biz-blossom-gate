import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, Wallet, CheckCircle2,
  AlertCircle, RefreshCw, ArrowDownRight,
  ArrowUpRight, Eye, Trophy, Zap,
  ChevronDown, CalendarDays,
  CreditCard, FileText, Receipt, Sparkles,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
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

const PIE_COLORS = ["#00FFA3", "#FFAA00", "#FF4D6A", "#00A3FF", "#A855F7"];

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
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[0]);

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

  const statusCounts = filteredTx.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const allCompleted = transactions.filter((t) => t.status === "completed");
  const allTimeRevenue = allCompleted.reduce((a, t) => a + Number(t.amount), 0);
  const milestone = getCurrentMilestone(allTimeRevenue);

  const todayRevenue = useMemo(() => {
    const todayStr = brasiliaToday().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return transactions.filter((t) => toBrasiliaDate(t.created_at) === todayStr && t.status === "completed").reduce((a, t) => a + Number(t.amount), 0);
  }, [transactions]);

  const recentActivity = [...transactions.slice(0, 5), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-5 relative pb-8 min-h-screen" style={{ background: "linear-gradient(165deg, #080c18 0%, #0d1225 30%, #0a0f1e 60%, #0c1029 100%)" }}>
      {/* Mesh gradient overlays */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute w-[900px] h-[900px] -top-[300px] -left-[200px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, #00FFA3, transparent 70%)" }} />
        <div className="absolute w-[700px] h-[700px] top-[20%] -right-[200px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, #7C3AED, transparent 70%)" }} />
        <div className="absolute w-[600px] h-[600px] bottom-[-200px] left-[30%] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #0094FF, transparent 70%)" }} />
        {/* Subtle noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      </div>

      {/* ===== Header ===== */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-extrabold tracking-tight text-white font-display">
              {profile?.full_name?.split(" ")[0] || "Usuário"}
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: "linear-gradient(135deg, rgba(0,255,163,0.12), rgba(0,163,255,0.08))", color: "#00FFA3", border: "1px solid rgba(0,255,163,0.1)" }}>
              <Sparkles className="h-3 w-3" /> Online
            </div>
          </div>
          <p className="text-[13px] text-white/30 mt-1 font-medium">Resumo do seu negócio</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white/70 rounded-full transition-all duration-300 hover:text-white group" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.06)" }}>
              <CalendarDays className="h-3.5 w-3.5 text-[#00FFA3]" />
              {selectedPeriod.label}
              <ChevronDown className="h-3 w-3 text-white/20 group-hover:text-[#00FFA3] transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl p-1.5 min-w-[160px] border-white/[0.06]" style={{ background: "rgba(13,18,37,0.97)", backdropFilter: "blur(30px)", boxShadow: "0 25px 80px rgba(0,0,0,0.8)" }}>
            {PERIOD_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.label} onClick={() => setSelectedPeriod(opt)} className={`rounded-xl text-[13px] font-medium cursor-pointer px-3 py-2.5 transition-all ${selectedPeriod.label === opt.label ? "text-[#00FFA3]" : "text-white/50 hover:text-white hover:bg-white/[0.04]"}`} style={selectedPeriod.label === opt.label ? { background: "rgba(0,255,163,0.06)" } : {}}>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ===== KPI Cards ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: "0.05s" }}>
        <MetricCard label="Receita Bruta" value={fmtCurrency(totalRevenue)} sub={`${approvedTx.length} vendas`} accent="#00FFA3" icon={<DollarSign className="h-5 w-5" />} trend={approvedTx.length > 0} />
        <MetricCard label="Receita Líquida" value={fmtCurrency(totalNet)} sub={`-${fmtCurrency(totalFees)} taxas`} accent="#0094FF" icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard label="Ticket Médio" value={fmtCurrency(ticketMedio)} sub={approvedTx.length > 0 ? "por venda" : "—"} accent="#A855F7" icon={<Receipt className="h-5 w-5" />} />
        <MetricCard label="Saldo Disponível" value={fmtCurrency(totalNet)} sub={pendingWd > 0 ? `${fmtCurrency(pendingWd)} em saque` : "Livre para saque"} accent="#FFAA00" icon={<Wallet className="h-5 w-5" />} action={{ label: "Sacar", href: "/financeiro/saques" }} />
      </div>

      {/* ===== FULL-WIDTH CHART ===== */}
      <div className="animate-fade-in rounded-2xl overflow-hidden relative" style={{ animationDelay: "0.1s", background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(0,255,163,0.015) 100%)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: "linear-gradient(90deg, transparent 10%, rgba(0,255,163,0.15) 50%, transparent 90%)" }} />
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-[15px] font-bold text-white">Vendas</h3>
            <span className="text-[11px] text-white/30 font-medium">{selectedPeriod.label}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full" style={{ color: "#00FFA3", background: "rgba(0,255,163,0.06)", border: "1px solid rgba(0,255,163,0.08)" }}>
            <span className="h-[6px] w-[6px] rounded-full animate-pulse" style={{ background: "#00FFA3", boxShadow: "0 0 8px #00FFA3" }} />
            Tempo real
          </div>
        </div>
        <div className="px-2 pb-3">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00FFA3" stopOpacity={0.2} />
                  <stop offset="40%" stopColor="#00FFA3" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="#00FFA3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.08)" fontSize={11} tickLine={false} axisLine={false} dy={8} />
              <YAxis stroke="rgba(255,255,255,0.08)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} width={40} />
              <Tooltip contentStyle={{ background: "rgba(13,18,37,0.97)", border: "1px solid rgba(0,255,163,0.12)", borderRadius: "14px", fontSize: "12px", boxShadow: "0 20px 60px rgba(0,0,0,0.8)", color: "white", backdropFilter: "blur(20px)", padding: "10px 14px" }} formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]} labelStyle={{ color: "rgba(255,255,255,0.35)" }} />
              <Area type="monotone" dataKey="vendas" stroke="#00FFA3" strokeWidth={2} fill="url(#chartFill)" dot={false} activeDot={{ r: 5, fill: "#00FFA3", stroke: "rgba(0,255,163,0.25)", strokeWidth: 8, style: { filter: "drop-shadow(0 0 10px rgba(0,255,163,0.6))" } as React.CSSProperties }} style={{ filter: "drop-shadow(0 0 4px rgba(0,255,163,0.25))" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ===== Middle Row: Progress + Conversion (Mirrored) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: "0.15s" }}>
        {/* Progress */}
        <Panel>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(0,255,163,0.15), rgba(0,255,163,0.05))", boxShadow: "0 0 25px rgba(0,255,163,0.1)" }}>
              <Trophy className="h-5 w-5" style={{ color: "#00FFA3" }} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-white">Progresso</h3>
              <p className="text-[11px] text-white/25">Meta de faturamento</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Total faturado</p>
              <p className="text-[22px] font-extrabold text-white mt-1" style={{ textShadow: "0 0 30px rgba(0,255,163,0.1)" }}>{fmtCurrency(allTimeRevenue)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Hoje</p>
              <p className="text-[22px] font-extrabold mt-1" style={{ color: "#00FFA3", textShadow: "0 0 20px rgba(0,255,163,0.2)" }}>{fmtCurrency(todayRevenue)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Falta para meta</p>
              <p className="text-[16px] font-bold text-white/60 mt-1">{fmtCurrency(Math.max(0, milestone.next.value - allTimeRevenue))}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Meta</p>
              <p className="text-[16px] font-bold mt-1" style={{ color: "#00FFA3" }}>{milestone.next.label}</p>
            </div>
          </div>
          {/* Bar */}
          <div>
            <div className="flex justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#00FFA3" }} />
                <span className="text-[10px] font-bold text-white/40">{milestone.pct.toFixed(0)}%</span>
              </div>
              <span className="text-[10px] font-bold text-white/25">{milestone.next.label}</span>
            </div>
            <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full rounded-full relative transition-all duration-1000" style={{ width: `${Math.max(milestone.pct, 2)}%`, background: "linear-gradient(90deg, #00FFA3, #00D48B)", boxShadow: "0 0 15px rgba(0,255,163,0.35), 0 0 40px rgba(0,255,163,0.1)" }}>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 animate-shimmer" />
              </div>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-white/20 uppercase tracking-wider">Próxima</span>
              <span className="text-[12px] font-extrabold text-white/60">{MILESTONES[milestone.tier + 2]?.label || "🏆 Topo"}</span>
            </div>
          </div>
        </Panel>

        {/* Conversion */}
        <Panel>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(0,148,255,0.15), rgba(0,148,255,0.05))", boxShadow: "0 0 25px rgba(0,148,255,0.1)" }}>
              <RefreshCw className="h-5 w-5" style={{ color: "#0094FF" }} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-white">Conversão</h3>
              <p className="text-[11px] text-white/25">Taxa por método de pagamento</p>
            </div>
          </div>
          <div className="space-y-3">
            <ConvBar icon={<TrendingUp className="h-4 w-4" />} label="Geral" value={`${conversionRate}%`} pct={Number(conversionRate)} color="#00FFA3" />
            <ConvBar icon={<Zap className="h-4 w-4" />} label="Pix" value={`${pixConv}%`} pct={Number(pixConv)} color="#00FFA3" />
            <ConvBar icon={<CreditCard className="h-4 w-4" />} label="Cartão" value={`${cardConv}%`} pct={Number(cardConv)} color="#0094FF" />
            <ConvBar icon={<FileText className="h-4 w-4" />} label="Boleto" value={`${boletoConv}%`} pct={Number(boletoConv)} color="#FFAA00" />
            <ConvBar icon={<AlertCircle className="h-4 w-4" />} label="Estorno" value={`${chargebackRate}%`} pct={Number(chargebackRate)} color="#FF4D6A" />
          </div>
        </Panel>
      </div>

      {/* ===== Bottom Row: Financial + Status + Activity ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        {/* Financial */}
        <Panel>
          <h3 className="text-[14px] font-bold text-white mb-4">Resumo Financeiro</h3>
          <div className="space-y-3">
            <FinRow label="Receita Bruta" value={fmtCurrency(totalRevenue)} color="#00FFA3" />
            <FinRow label="Taxas Cobradas" value={`-${fmtCurrency(totalFees)}`} color="#FFAA00" />
            <FinRow label="Chargebacks" value={String(chargebacks)} color="#FF4D6A" />
            <FinRow label="Reembolsos" value={String(refunds)} color="#0094FF" />
            <div className="pt-3 mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <FinRow label="Líquido Final" value={fmtCurrency(totalNet)} color="#00FFA3" bold />
            </div>
          </div>
        </Panel>

        {/* Status Pie */}
        <Panel>
          <h3 className="text-[14px] font-bold text-white mb-3">Status</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={52} dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {pieData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.map((d, i) => {
                  const labels: Record<string, string> = { completed: "Aprovado", pending: "Pendente", failed: "Falhou", refunded: "Reembolso", chargeback: "Chargeback" };
                  return (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length], boxShadow: `0 0 6px ${PIE_COLORS[i % PIE_COLORS.length]}50` }} />
                        <span className="text-[12px] text-white/50">{labels[d.name] || d.name}</span>
                      </div>
                      <span className="text-[12px] font-bold text-white">{d.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[110px] text-[12px] text-white/20">Sem dados</div>
          )}
        </Panel>

        {/* Activity */}
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-white">Atividade</h3>
            <Link to="/financeiro/extrato" className="text-[11px] text-white/30 hover:text-[#00FFA3] font-medium flex items-center gap-1 transition-colors">
              Ver tudo <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-white/15">
                <Eye className="h-7 w-7 mb-2" />
                <p className="text-[11px]">Nenhuma atividade</p>
              </div>
            ) : (
              recentActivity.slice(0, 5).map((item) => {
                const isTx = "payment_method" in item;
                const stMap: Record<string, { c: string; l: string }> = {
                  completed: { c: "#00FFA3", l: "Aprovado" }, approved: { c: "#00FFA3", l: "Aprovado" },
                  pending: { c: "#FFAA00", l: "Pendente" }, paid: { c: "#00FFA3", l: "Pago" },
                  failed: { c: "#FF4D6A", l: "Falhou" }, rejected: { c: "#FF4D6A", l: "Recusado" },
                  refunded: { c: "#0094FF", l: "Reembolso" }, chargeback: { c: "#FF4D6A", l: "Chargeback" },
                  requested: { c: "#FFAA00", l: "Solicitado" },
                };
                const st = stMap[item.status] || { c: "#888", l: item.status };
                return (
                  <div key={item.id} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl transition-all duration-200 hover:bg-white/[0.02]">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${st.c}12` }}>
                      {isTx ? <DollarSign className="h-3.5 w-3.5" style={{ color: st.c }} /> : <ArrowDownRight className="h-3.5 w-3.5" style={{ color: st.c }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-bold text-white">{fmtCurrency(Number(item.amount))}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: st.c, background: `${st.c}10` }}>{st.l}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-white/20 font-medium">{formatRelativeTime(item.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden transition-all duration-500" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}>
      <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}

function MetricCard({ label, value, sub, accent, icon, trend, action }: {
  label: string; value: string; sub?: string; accent: string; icon: React.ReactNode; trend?: boolean; action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-2xl p-4 lg:p-5 relative overflow-hidden group transition-all duration-500 cursor-default" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}22`; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.4), 0 0 40px ${accent}08`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}20, transparent)` }} />
      <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: `${accent}15` }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{label}</p>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}10`, color: accent }}>
            {icon}
          </div>
        </div>
        <p className="text-[20px] lg:text-[24px] font-extrabold text-white tracking-tight" style={{ textShadow: `0 0 30px ${accent}15` }}>{value}</p>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px] text-white/30">{sub}</p>
          {trend && <ArrowUpRight className="h-3.5 w-3.5" style={{ color: accent, filter: `drop-shadow(0 0 3px ${accent}60)` }} />}
        </div>
        {action && (
          <Link to={action.href} className="text-[10px] font-bold mt-2 inline-flex items-center gap-1 hover:gap-2 transition-all duration-300" style={{ color: accent }}>
            {action.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function ConvBar({ icon, label, value, pct, color }: { icon: React.ReactNode; label: string; value: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}10`, color }}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium text-white/60">{label}</span>
          <span className="text-[12px] font-bold text-white" style={{ textShadow: `0 0 10px ${color}20` }}>{value}</span>
        </div>
        <div className="w-full rounded-full h-[5px] overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, 0)}%`, background: color, boxShadow: `0 0 8px ${color}40` }} />
        </div>
      </div>
    </div>
  );
}

function FinRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[12px] ${bold ? "font-bold text-white" : "text-white/40"}`}>{label}</span>
      <span className={`text-[13px] font-bold`} style={{ color, textShadow: bold ? `0 0 15px ${color}30` : "none" }}>{value}</span>
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
