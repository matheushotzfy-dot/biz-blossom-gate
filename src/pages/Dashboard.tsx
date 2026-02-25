import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, Wallet, ShoppingCart, Activity,
  BarChart3, ChevronDown, CalendarDays, ArrowUpRight, ArrowDownRight, FileText,
  AlertCircle, RefreshCw, Eye, Zap, Receipt, Target, Clock,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
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
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      return transactions.filter((t) => toBrasiliaDate(t.created_at) === yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }));
    }
    const start = new Date(today); start.setDate(start.getDate() - selectedPeriod.days); start.setHours(0, 0, 0, 0);
    return transactions.filter((t) => new Date(t.created_at) >= start);
  }, [transactions, selectedPeriod]);

  const approved = filteredTx.filter((t) => t.status === "completed");
  const revenue = approved.reduce((a, t) => a + Number(t.net_amount), 0);
  const ticket = approved.length > 0 ? revenue / approved.length : 0;
  const conv = filteredTx.length > 0 ? ((approved.length / filteredTx.length) * 100).toFixed(1) : "0.0";
  const cbs = filteredTx.filter((t) => t.status === "chargeback").length;
  const refs = filteredTx.filter((t) => t.status === "refunded").length;
  const cbRate = filteredTx.length > 0 ? ((cbs / filteredTx.length) * 100).toFixed(2) : "0";

  const chartData = useMemo(() => {
    const days = Math.min(Math.max(selectedPeriod.days || 1, 1), 30);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(brasiliaToday()); d.setDate(d.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const cmp = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const val = transactions.filter((t) => toBrasiliaDate(t.created_at) === cmp && t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0);
      return { name: label, vendas: val };
    });
  }, [transactions, selectedPeriod.days]);

  const activity = [...transactions.slice(0, 5), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground font-medium">Bem-vindo de volta 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground mt-0.5">Dashboard</h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg border border-border bg-card text-foreground hover:border-primary/30 transition-all">
              <CalendarDays className="h-4 w-4 text-primary" />
              {selectedPeriod.label}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-lg p-1 min-w-[130px]">
            {PERIOD_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.label} onClick={() => setSelectedPeriod(opt)} className={`rounded-md text-sm cursor-pointer ${selectedPeriod.label === opt.label ? "text-primary font-semibold bg-primary/5" : ""}`}>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: DollarSign, label: "Receita Líquida", value: fmt(revenue), desc: `${approved.length} vendas aprovadas`, color: "primary" },
          { icon: Target, label: "Ticket Médio", value: fmt(ticket), desc: approved.length > 0 ? `${approved.length} transações` : "—", color: "info" },
          { icon: ShoppingCart, label: "Pedidos Pagos", value: String(approved.length), desc: `de ${filteredTx.length} gerados`, color: "success" },
          { icon: Wallet, label: "Saldo Disponível", value: fmt(revenue), desc: "Disponível para saque", color: "primary", link: "/financeiro/saques" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl p-4 bg-card border border-border hover:border-primary/20 transition-all" style={{ boxShadow: "var(--card-shadow)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-${kpi.color}/10`}>
                <kpi.icon className={`h-4 w-4 text-${kpi.color}`} />
              </div>
            </div>
            <p className="text-xl lg:text-2xl font-extrabold text-foreground tracking-tight">{kpi.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.desc}</p>
            {kpi.link && (
              <Link to={kpi.link} className="text-[11px] font-bold mt-2 inline-flex items-center gap-1 text-primary hover:gap-1.5 transition-all">
                Solicitar Saque <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Chart + Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-xl p-5 bg-card border border-border" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Performance de Vendas</h3>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold text-foreground">{fmt(revenue)}</p>
              <p className="text-[11px] text-primary font-semibold">{approved.length} aprovadas</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground) / 0.12)" fontSize={10} tickLine={false} axisLine={false} dy={8} />
              <YAxis stroke="hsl(var(--muted-foreground) / 0.12)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={50} />
              <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: "8px", fontSize: "12px", color: "var(--tooltip-text)", padding: "8px 12px" }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Vendas"]} cursor={{ stroke: "hsl(var(--primary) / 0.12)", strokeDasharray: "4 4" }} />
              <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Metrics panel */}
        <div className="rounded-xl p-5 bg-card border border-border" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Métricas</h3>
          </div>
          <div className="space-y-2.5">
            <MetricRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="Conversão" value={`${conv}%`} color="hsl(var(--primary))" />
            <MetricRow icon={<AlertCircle className="h-3.5 w-3.5" />} label="Pre-CB" value="0" color="hsl(var(--warning))" />
            <MetricRow icon={<RefreshCw className="h-3.5 w-3.5" />} label="Chargeback" value={`${cbs}`} sub={`${cbRate}%`} color="hsl(var(--destructive))" />
            <MetricRow icon={<ArrowDownRight className="h-3.5 w-3.5" />} label="Reembolsos" value={`${refs}`} color="hsl(var(--info))" />
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2 mb-2.5">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">Sistema</span>
            </div>
            {[
              { l: "API", v: "Online" },
              { l: "Webhooks", v: "100%" },
              { l: "Latência", v: "0ms" },
            ].map((s) => (
              <div key={s.l} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <span className="text-[11px] text-muted-foreground">{s.l}</span>
                </div>
                <span className="text-[11px] font-bold text-foreground">{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Access + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-5 bg-card border border-border" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Acesso Rápido</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Vendas", href: "/vendas", icon: ShoppingCart, color: "primary" },
              { label: "Saques", href: "/financeiro/saques", icon: Wallet, color: "success" },
              { label: "Produtos", href: "/vendas/produtos", icon: BarChart3, color: "info" },
              { label: "Gastos", href: "/financeiro/gastos", icon: Receipt, color: "warning" },
              { label: "Extrato", href: "/financeiro/extrato", icon: FileText, color: "primary" },
              { label: "Webhooks", href: "/vendas/webhooks", icon: Clock, color: "info" },
            ].map((a) => (
              <Link key={a.href} to={a.href} className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-muted/20 hover:bg-primary/[0.04] hover:border-primary/15 transition-all group">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-${a.color}/10`}>
                  <a.icon className={`h-3.5 w-3.5 text-${a.color}`} />
                </div>
                <span className="text-[13px] font-semibold text-foreground">{a.label}</span>
                <ArrowUpRight className="h-3 w-3 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-5 bg-card border border-border" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Atividade Recente</h3>
            </div>
            <Link to="/financeiro/extrato" className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1">
              Ver tudo <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-0.5">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground/25">
                <Eye className="h-7 w-7 mb-2" />
                <p className="text-xs">Nenhuma atividade</p>
              </div>
            ) : activity.map((item) => {
              const isTx = "payment_method" in item;
              const stMap: Record<string, { c: string; l: string }> = {
                completed: { c: "hsl(var(--success))", l: "Aprovado" },
                pending: { c: "hsl(var(--warning))", l: "Pendente" },
                failed: { c: "hsl(var(--destructive))", l: "Falhou" },
                refunded: { c: "hsl(var(--info))", l: "Reembolso" },
                chargeback: { c: "hsl(var(--destructive))", l: "CB" },
              };
              const st = stMap[item.status] || { c: "hsl(var(--muted-foreground))", l: item.status };
              const diff = Date.now() - new Date(item.created_at).getTime();
              const mins = Math.floor(diff / 60000);
              const timeStr = mins < 1 ? "agora" : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`;
              return (
                <div key={item.id} className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${st.c} 10%, transparent)` }}>
                    {isTx ? <DollarSign className="h-3.5 w-3.5" style={{ color: st.c }} /> : <ArrowDownRight className="h-3.5 w-3.5" style={{ color: st.c }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-foreground">{fmt(Number(item.amount))}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: st.c, background: `color-mix(in srgb, ${st.c} 8%, transparent)` }}>{st.l}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{isTx ? "Transação" : "Saque"}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/50">
      <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>{icon}</div>
      <span className="text-[13px] text-muted-foreground font-medium flex-1">{label}</span>
      <div className="text-right">
        <span className="text-[13px] font-bold text-foreground">{value}</span>
        {sub && <p className="text-[9px] font-bold" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}
