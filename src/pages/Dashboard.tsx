import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, Wallet, ShoppingCart, Activity,
  BarChart3, ChevronDown, CalendarDays, ArrowUpRight, ArrowDownRight,
  AlertCircle, RefreshCw, Eye, Zap, Receipt,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PERIOD_OPTIONS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
];

const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function toBrasiliaDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function brasiliaToday() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[0]);

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
    ]).then(([txRes, wdRes]) => {
      if (txRes.data) setTransactions(txRes.data);
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

  const recentActivity = [...transactions.slice(0, 5), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Resumo do seu desempenho</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-all">
              <CalendarDays className="h-4 w-4 text-primary" />
              {selectedPeriod.label}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl p-1 min-w-[140px]">
            {PERIOD_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.label} onClick={() => setSelectedPeriod(opt)} className={`rounded-lg text-sm cursor-pointer ${selectedPeriod.label === opt.label ? "text-primary font-semibold bg-primary/5" : ""}`}>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Total em Vendas" value={fmt(totalRevenue)} desc={`${approvedTx.length} vendas aprovadas`} />
        <KpiCard icon={<BarChart3 className="h-5 w-5" />} label="Ticket Médio" value={fmt(ticketMedio)} desc={approvedTx.length > 0 ? `em ${approvedTx.length} vendas` : "sem vendas"} />
        <KpiCard icon={<ShoppingCart className="h-5 w-5" />} label="Pedidos Pagos" value={String(approvedTx.length)} desc={`de ${filteredTx.length} transações`} />
        <KpiCard icon={<Wallet className="h-5 w-5" />} label="Saldo Disponível" value={fmt(totalRevenue)} action={{ label: "Solicitar Saque", href: "/financeiro/saques" }} />
      </div>

      {/* 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversão */}
        <Card>
          <CardTitle icon={<Receipt className="h-4 w-4" />} title="Resumo Financeiro" />
          <div className="space-y-2.5 mt-4">
            <StatRow icon={<TrendingUp />} label="Conversão" value={`${conversionRate}%`} color="primary" />
            <StatRow icon={<AlertCircle />} label="Pre-Chargeback" value="0" color="warning" />
            <StatRow icon={<RefreshCw />} label="Chargeback" value={String(chargebacks)} sub={`${chargebackRate}%`} color="destructive" />
            <StatRow icon={<ArrowDownRight />} label="Reembolsos" value={String(refunds)} color="info" />
          </div>
        </Card>

        {/* Monitor */}
        <Card>
          <CardTitle icon={<Activity className="h-4 w-4" />} title="Monitoramento" />
          <div className="space-y-2.5 mt-4">
            <MonitorRow label="API Status" value="Online" status="ok" />
            <MonitorRow label="Webhooks" value="100%" status="ok" />
            <MonitorRow label="Conversão" value={`${conversionRate}%`} status={Number(conversionRate) > 50 ? "ok" : "warn"} />
            <MonitorRow label="Latência" value="0 ms" status="ok" />
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground">Sistemas operacionais</span>
          </div>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardTitle icon={<Zap className="h-4 w-4" />} title="Ações Rápidas" />
          <div className="space-y-2.5 mt-4">
            {[
              { label: "Ver Vendas", href: "/vendas", icon: ShoppingCart },
              { label: "Solicitar Saque", href: "/financeiro/saques", icon: Wallet },
              { label: "Gerenciar Gastos", href: "/financeiro/gastos", icon: BarChart3 },
              { label: "Ver Extrato", href: "/financeiro/extrato", icon: Receipt },
            ].map((a) => (
              <Link key={a.href} to={a.href} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors text-sm font-medium text-foreground group">
                <a.icon className="h-4 w-4 text-primary" />
                {a.label}
                <ArrowUpRight className="h-3.5 w-3.5 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <CardTitle icon={<BarChart3 className="h-4 w-4" />} title="Vendas Diárias" />
            <div className="text-right">
              <p className="text-xl font-extrabold text-foreground">{fmt(totalRevenue)}</p>
              <p className="text-xs text-primary font-semibold">{approvedTx.length} vendas</p>
            </div>
          </div>
          <div className="-mx-2">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground) / 0.2)" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke="hsl(var(--muted-foreground) / 0.2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={55} />
                <Tooltip
                  contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: "12px", fontSize: "12px", color: "var(--tooltip-text)", backdropFilter: "blur(12px)", padding: "10px 14px" }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                  cursor={{ stroke: "hsl(var(--primary) / 0.2)", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#dashGrad)" dot={false} activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <CardTitle icon={<Activity className="h-4 w-4" />} title="Atividade Recente" />
            <Link to="/financeiro/extrato" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
              Ver tudo <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1 max-h-[260px] overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/30">
                <Eye className="h-8 w-8 mb-2" />
                <p className="text-xs">Nenhuma atividade</p>
              </div>
            ) : recentActivity.slice(0, 6).map((item) => {
              const isTx = "payment_method" in item;
              const stMap: Record<string, { c: string; l: string }> = {
                completed: { c: "hsl(var(--primary))", l: "Aprovado" },
                pending: { c: "hsl(var(--warning))", l: "Pendente" },
                failed: { c: "hsl(var(--destructive))", l: "Falhou" },
                refunded: { c: "hsl(var(--info))", l: "Reembolso" },
                chargeback: { c: "hsl(var(--destructive))", l: "Chargeback" },
              };
              const st = stMap[item.status] || { c: "hsl(var(--muted-foreground))", l: item.status };
              return (
                <div key={item.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/20 transition-colors">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${st.c} 12%, transparent)` }}>
                    {isTx ? <DollarSign className="h-4 w-4" style={{ color: st.c }} /> : <ArrowDownRight className="h-4 w-4" style={{ color: st.c }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{fmt(Number(item.amount))}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ color: st.c, background: `color-mix(in srgb, ${st.c} 10%, transparent)` }}>{st.l}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{isTx ? "Transação" : "Saque"}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{fmtRelTime(item.created_at)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* Sub-components */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 bg-card border border-border/50 ${className || ""}`} style={{ boxShadow: "var(--card-shadow)" }}>
      {children}
    </div>
  );
}

function CardTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
    </div>
  );
}

function KpiCard({ icon, label, value, desc, action }: {
  icon: React.ReactNode; label: string; value: string; desc?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-2xl p-5 bg-card border border-border/50 transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ boxShadow: "var(--card-shadow)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary">{icon}</div>
      </div>
      <p className="text-2xl font-extrabold text-foreground tracking-tight">{value}</p>
      {desc && <p className="text-xs text-muted-foreground mt-1.5">{desc}</p>}
      {action && (
        <Link to={action.href} className="text-xs font-bold mt-3 inline-flex items-center gap-1 text-primary hover:underline">
          {action.label} <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function StatRow({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  const colorMap: Record<string, string> = { primary: "hsl(var(--primary))", warning: "hsl(var(--warning))", destructive: "hsl(var(--destructive))", info: "hsl(var(--info))" };
  const c = colorMap[color] || colorMap.primary;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 [&>svg]:h-4 [&>svg]:w-4" style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}>{icon}</div>
      <span className="text-sm text-muted-foreground font-medium flex-1">{label}</span>
      <div className="text-right">
        <span className="text-sm font-bold text-foreground">{value}</span>
        {sub && <p className="text-[10px] font-bold" style={{ color: c }}>{sub}</p>}
      </div>
    </div>
  );
}

function MonitorRow({ label, value, status }: { label: string; value: string; status: "ok" | "warn" | "error" }) {
  const colors = { ok: "hsl(var(--primary))", warn: "hsl(var(--warning))", error: "hsl(var(--destructive))" };
  const c = colors[status];
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
      <span className="text-sm text-muted-foreground font-medium flex-1">{label}</span>
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
  return `${days}d`;
}
