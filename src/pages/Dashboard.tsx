import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, Wallet, CheckCircle2,
  AlertCircle, RefreshCw, ArrowDownRight,
  ArrowUpRight, Eye, Zap,
  ChevronDown, CalendarDays,
  CreditCard, FileText, Receipt,
  ShoppingCart, Activity, Shield, BarChart3,
  Lock, Volume2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
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

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function toBrasiliaDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function brasiliaToday() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

/* ============ Main ============ */

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
  const totalRevenue = approvedTx.reduce((a, t) => a + Number(t.net_amount), 0);
  const ticketMedio = approvedTx.length > 0 ? totalRevenue / approvedTx.length : 0;
  const pendingWd = withdrawals.filter((w) => w.status === "pending").reduce((a, w) => a + Number(w.amount), 0);
  const conversionRate = filteredTx.length > 0 ? ((approvedTx.length / filteredTx.length) * 100).toFixed(1) : "0.0";
  const chargebacks = filteredTx.filter((t) => t.status === "chargeback").length;
  const refunds = filteredTx.filter((t) => t.status === "refunded").length;
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
      return { name: dayStr, vendas: dayTx.reduce((a, t) => a + Number(t.net_amount), 0) };
    });
  }, [transactions, chartDays]);

  const allCompleted = transactions.filter((t) => t.status === "completed");
  const allTimeRevenue = allCompleted.reduce((a, t) => a + Number(t.net_amount), 0);
  const milestone = getCurrentMilestone(allTimeRevenue);

  const todayRevenue = useMemo(() => {
    const todayStr = brasiliaToday().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return transactions.filter((t) => toBrasiliaDate(t.created_at) === todayStr && t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0);
  }, [transactions]);

  const recentActivity = [...transactions.slice(0, 5), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6 relative pb-8 min-h-screen" style={{ background: "var(--page-bg)" }}>
      {/* Ambient mesh */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute w-[800px] h-[800px] -top-[300px] -left-[200px] rounded-full" style={{ background: "radial-gradient(circle, var(--mesh-green), transparent 70%)", opacity: "var(--mesh-opacity)" }} />
        <div className="absolute w-[600px] h-[600px] top-[30%] -right-[150px] rounded-full" style={{ background: "radial-gradient(circle, var(--mesh-blue), transparent 70%)", opacity: "var(--mesh-opacity)" }} />
      </div>

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-display">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Veja o resumo do seu desempenho!</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-xl border border-border bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-all group">
              <CalendarDays className="h-4 w-4 text-primary" />
              {selectedPeriod.label}
              <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl p-1 min-w-[150px]">
            {PERIOD_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.label} onClick={() => setSelectedPeriod(opt)} className={`rounded-lg text-sm cursor-pointer px-3 py-2 ${selectedPeriod.label === opt.label ? "text-primary font-semibold bg-primary/5" : ""}`}>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: "0.05s" }}>
        <KpiCard icon={<DollarSign />} label="Total em Vendas" value={fmt(totalRevenue)} desc="durante este período." color="primary" />
        <KpiCard icon={<BarChart3 />} label="Ticket Médio" value={fmt(ticketMedio)} desc={approvedTx.length > 0 ? `em ${approvedTx.length} vendas neste período.` : "sem vendas no período."} color="primary" />
        <KpiCard icon={<ShoppingCart />} label="Pedidos Pagos" value={String(approvedTx.length)} desc={`em ${filteredTx.length} transações geradas neste período.`} color="primary" />
        <KpiCard icon={<Wallet />} label="Saldo Disponível" value={fmt(totalRevenue)} color="primary" action={{ label: "Solicitar Saque", href: "/financeiro/saques" }} />
      </div>

      {/* ── 3-COL: Progress / Resumo / Monitoramento ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        {/* Progresso */}
        <Card>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-foreground tracking-tight">Progresso</h3>
              <p className="text-[10px] text-muted-foreground">Rumo à próxima meta</p>
            </div>
          </div>

          {/* Big number */}
          <div className="flex items-end gap-3 mb-5">
            <p className="text-3xl font-black text-foreground tracking-tighter leading-none">{fmt(allTimeRevenue)}</p>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg mb-0.5">{milestone.pct.toFixed(0)}%</span>
          </div>

          {/* Progress bar */}
          <div className="relative mb-4">
            <div className="w-full rounded-full h-3.5 overflow-hidden" style={{ background: "var(--bar-track)" }}>
              <div
                className="h-full rounded-full relative transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.max(milestone.pct, 3)}%`,
                  background: "linear-gradient(90deg, hsl(var(--primary)), hsl(152 75% 55%), hsl(180 70% 50%))",
                  boxShadow: "0 0 24px hsl(var(--primary) / 0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
                }}
              >
                <div className="absolute inset-0 animate-shimmer rounded-full" style={{ backgroundImage: "linear-gradient(90deg, transparent 0%, var(--shimmer-color) 50%, transparent 100%)", backgroundSize: "200% 100%" }} />
              </div>
            </div>
            {/* Milestone markers */}
            <div className="flex justify-between mt-2">
              {MILESTONES.slice(0, 5).map((m, i) => (
                <div key={m.label} className="flex flex-col items-center">
                  <div className={`h-1.5 w-1.5 rounded-full mb-1 ${allTimeRevenue >= m.value ? "bg-primary" : "bg-muted-foreground/20"}`} />
                  <span className={`text-[9px] font-bold ${allTimeRevenue >= m.value ? "text-primary" : "text-muted-foreground/40"}`}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/20">
            <div className="rounded-xl p-3" style={{ background: "var(--glass-subtle)" }}>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Hoje</p>
              <p className="text-sm font-black text-primary">{fmt(todayRevenue)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--glass-subtle)" }}>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Próxima Meta</p>
              <p className="text-sm font-black text-foreground">{milestone.next.label}</p>
            </div>
          </div>
        </Card>

        {/* Resumo Financeiro */}
        <Card>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-foreground tracking-tight">Resumo Financeiro</h3>
              <p className="text-[10px] text-muted-foreground">Métricas de conversão</p>
            </div>
          </div>
          <div className="space-y-3">
            <FinancialRow icon={<TrendingUp className="h-4 w-4" />} label="Conversão" value={`${conversionRate}%`} color="primary" />
            <FinancialRow icon={<AlertCircle className="h-4 w-4" />} label="Pre-Chargeback" value="0" color="warning" />
            <FinancialRow icon={<RefreshCw className="h-4 w-4" />} label="Chargeback" value={String(chargebacks)} subtext={`${chargebackRate}%`} color="destructive" />
            <FinancialRow icon={<ArrowDownRight className="h-4 w-4" />} label="Reembolsos" value={String(refunds)} color="info" />
          </div>
        </Card>

        {/* Monitoramento */}
        <Card>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-foreground tracking-tight">Monitoramento</h3>
              <p className="text-[10px] text-muted-foreground">Status em tempo real</p>
            </div>
          </div>
          <div className="space-y-3">
            <MonitorRow label="API Status" value="Online" status="ok" />
            <MonitorRow label="Webhooks" value="100%" status="ok" />
            <MonitorRow label="Conversão" value={`${conversionRate}%`} status={Number(conversionRate) > 50 ? "ok" : "warn"} />
            <MonitorRow label="Latência" value="0 ms" status="ok" />
          </div>
          <div className="mt-4 pt-3 border-t border-border/20 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] text-muted-foreground font-medium">Todos os sistemas operacionais</span>
          </div>
        </Card>
      </div>

      {/* ── CHART + ACTIVITY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-fade-in" style={{ animationDelay: "0.15s" }}>
        {/* Chart */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-foreground tracking-tight">Vendas Diárias</h3>
                <p className="text-[10px] text-muted-foreground">{selectedPeriod.label}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-foreground tracking-tight">{fmt(totalRevenue)}</p>
              <p className="text-[10px] text-primary font-bold">{approvedTx.length} vendas aprovadas</p>
            </div>
          </div>
          <div className="-mx-2 mt-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={10} tickLine={false} axisLine={false} dy={8} fontWeight={500} />
                <YAxis stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={50} fontWeight={500} />
                <Tooltip
                  contentStyle={{
                    background: "var(--tooltip-bg)",
                    border: "1px solid var(--tooltip-border)",
                    borderRadius: "14px",
                    fontSize: "12px",
                    boxShadow: "var(--hover-card-shadow)",
                    color: "var(--tooltip-text)",
                    backdropFilter: "blur(20px)",
                    padding: "12px 16px",
                  }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                  labelStyle={{ color: "var(--tooltip-text)", opacity: 0.5, fontSize: "10px", marginBottom: "4px" }}
                  cursor={{ stroke: "hsl(var(--primary) / 0.2)", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="vendas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#chartGrad)"
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: "hsl(var(--primary))",
                    stroke: "hsl(var(--primary-foreground))",
                    strokeWidth: 3,
                    style: { filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.5))" },
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Activity */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <CardHead title="Atividade Recente" noMargin />
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
              <Volume2 className="h-3 w-3" />
              <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-primary" />
              Ao vivo
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mb-4">
            {["Todas", "Transações", "Saques"].map((tab, i) => (
              <span key={tab} className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${i === 0 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/20"}`}>{tab}</span>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <Link to="/financeiro/extrato" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">Ver Transações <ArrowUpRight className="h-3 w-3" /></Link>
          </div>

          <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/30">
                <Eye className="h-8 w-8 mb-2" />
                <p className="text-xs">Nenhuma atividade</p>
              </div>
            ) : (
              recentActivity.slice(0, 6).map((item) => {
                const isTx = "payment_method" in item;
                const stMap: Record<string, { c: string; l: string }> = {
                  completed: { c: "hsl(var(--primary))", l: "Aprovado" },
                  approved: { c: "hsl(var(--primary))", l: "Aprovado" },
                  pending: { c: "hsl(var(--warning))", l: "Pendente" },
                  paid: { c: "hsl(var(--primary))", l: "Pago" },
                  failed: { c: "hsl(var(--destructive))", l: "Falhou" },
                  rejected: { c: "hsl(var(--destructive))", l: "Recusado" },
                  refunded: { c: "hsl(var(--info))", l: "Reembolso" },
                  chargeback: { c: "hsl(var(--destructive))", l: "Chargeback" },
                  requested: { c: "hsl(var(--warning))", l: "Solicitado" },
                };
                const st = stMap[item.status] || { c: "hsl(var(--muted-foreground))", l: item.status };
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/10 transition-colors">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${st.c} 12%, transparent)` }}>
                      {isTx ? <DollarSign className="h-4 w-4" style={{ color: st.c }} /> : <ArrowDownRight className="h-4 w-4" style={{ color: st.c }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{fmt(Number(item.amount))}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ color: st.c, background: `color-mix(in srgb, ${st.c} 10%, transparent)` }}>{st.l}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{isTx ? "Nova transação" : "Saque"} {st.l.toLowerCase()}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">há {fmtRelTime(item.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 relative overflow-hidden transition-all duration-300 border border-border/40 bg-card/70 backdrop-blur-xl ${className || ""}`}
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <div className="absolute top-0 left-0 w-[3px] h-full rounded-l-2xl bg-primary" />
      {children}
    </div>
  );
}

function CardHead({ title, right, noMargin }: { title: string; right?: string; noMargin?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${noMargin ? "" : "mb-5"}`}>
      <h3 className="text-[15px] font-bold text-foreground tracking-tight">{title}</h3>
      {right && <span className="text-[10px] text-muted-foreground">{right}</span>}
    </div>
  );
}

function KpiCard({ icon, label, value, desc, color, action }: {
  icon: React.ReactNode; label: string; value: string; desc?: string; color: string;
  action?: { label: string; href: string };
}) {
  return (
    <div
      className="rounded-2xl p-4 lg:p-5 relative overflow-hidden group transition-all duration-300 border border-border/40 bg-card/70 backdrop-blur-xl hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <div className="absolute top-0 left-0 w-[3px] h-full rounded-l-2xl bg-primary" />
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      <p className="text-xl lg:text-2xl font-black text-foreground tracking-tight">{value}</p>
      {desc && <p className="text-[11px] text-muted-foreground mt-1.5">{desc}</p>}
      {action && (
        <Link to={action.href} className="text-xs font-bold mt-3 inline-flex items-center gap-1.5 text-primary hover:gap-2.5 transition-all">
          <CheckCircle2 className="h-3.5 w-3.5" /> {action.label}
        </Link>
      )}
    </div>
  );
}

function FinancialRow({ icon, label, value, subtext, color }: { icon: React.ReactNode; label: string; value: string; subtext?: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: "hsl(var(--primary))",
    warning: "hsl(var(--warning))",
    destructive: "hsl(var(--destructive))",
    info: "hsl(var(--info))",
  };
  const c = colorMap[color] || colorMap.primary;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ background: "var(--glass-subtle)" }}>
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-muted-foreground font-medium">{label}</p>
      </div>
      <div className="text-right">
        <p className="text-base font-black text-foreground">{value}</p>
        {subtext && <p className="text-[10px] font-bold" style={{ color: c }}>{subtext}</p>}
      </div>
    </div>
  );
}

function MonitorRow({ label, value, status }: { label: string; value: string; status: "ok" | "warn" | "error" }) {
  const colors = { ok: "hsl(var(--primary))", warn: "hsl(var(--warning))", error: "hsl(var(--destructive))" };
  const c = colors[status];
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ background: "var(--glass-subtle)" }}>
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
      <span className="text-[12px] text-muted-foreground font-medium flex-1">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

function fmtRelTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} dias`;
  return `${Math.floor(days / 30)} m`;
}
