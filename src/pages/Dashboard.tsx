import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, ShoppingCart, Wallet, Clock, CheckCircle2,
  AlertCircle, RefreshCw, ArrowDownRight, CircleDollarSign, Volume2,
  Lock, ArrowUpRight, Zap, Globe, Shield, Eye,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(10),
    ]).then(([txRes, profileRes, wdRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      if (wdRes.data) setWithdrawals(wdRes.data);
    });
  }, [user]);

  const approvedTx = transactions.filter((t) => t.status === "approved");
  const totalRevenue = approvedTx.reduce((a, t) => a + Number(t.amount), 0);
  const totalNet = approvedTx.reduce((a, t) => a + Number(t.net_amount), 0);
  const ticketMedio = approvedTx.length > 0 ? totalRevenue / approvedTx.length : 0;
  const totalFees = approvedTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const pendingWd = withdrawals.filter((w) => w.status === "pending").reduce((a, w) => a + Number(w.amount), 0);
  const conversionRate = transactions.length > 0 ? ((approvedTx.length / transactions.length) * 100).toFixed(1) : "0.0";
  const chargebacks = transactions.filter((t) => t.status === "chargeback").length;
  const refunds = transactions.filter((t) => t.status === "refunded").length;

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = transactions.filter((t) => new Date(t.created_at).toDateString() === d.toDateString() && t.status === "approved");
    return { name: dayStr, vendas: dayTx.reduce((a, t) => a + Number(t.amount), 0) };
  });

  const meta = 10000;
  const progressPct = Math.min((totalRevenue / meta) * 100, 100);
  const dailyRevenue = chartData[chartData.length - 1]?.vendas || 0;

  const recentActivity = [...transactions.slice(0, 5), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Veja o resumo de seu desempenho!</p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-2.5 text-xs text-muted-foreground shadow-sm">
          <Clock className="h-3.5 w-3.5 text-primary" />
          {new Date(Date.now() - 30 * 86400000).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
          {" - "}
          {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total em Vendas"
          value={`R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle="durante este período."
          icon={<DollarSign className="h-5 w-5" />}
          gradient="from-emerald-500/10 to-emerald-500/5"
          iconBg="bg-emerald-500/15"
        />
        <KpiCard
          label="Ticket Médio"
          value={`R$ ${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle={`em ${approvedTx.length} vendas neste período.`}
          icon={<TrendingUp className="h-5 w-5" />}
          gradient="from-blue-500/10 to-blue-500/5"
          iconBg="bg-blue-500/15"
        />
        <KpiCard
          label="Pedidos Pagos"
          value={String(approvedTx.length)}
          subtitle={`em ${transactions.length} transações geradas.`}
          icon={<ShoppingCart className="h-5 w-5" />}
          gradient="from-violet-500/10 to-violet-500/5"
          iconBg="bg-violet-500/15"
        />
        <KpiCard
          label="Saldo Disponível"
          value={`R$ ${totalNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle={pendingWd > 0 ? `R$ ${pendingWd.toFixed(2)} em saques pendentes` : "Pronto para saque"}
          icon={<Wallet className="h-5 w-5" />}
          gradient="from-amber-500/10 to-amber-500/5"
          iconBg="bg-amber-500/15"
          action={{ label: "Solicitar Saque", href: "/financeiro/saques" }}
        />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progress */}
        <div className="relative overflow-hidden bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
          <SectionTitle>Progresso</SectionTitle>
          <div className="flex justify-between text-xs text-muted-foreground mb-1 mt-4">
            <span>Total faturado</span><span>Vendas diárias</span>
          </div>
          <div className="flex justify-between mb-4">
            <span className="text-lg font-bold">R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            <span className="text-lg font-bold text-primary">R$ {dailyRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / dia</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Falta para</span><span>Meta atual</span>
          </div>
          <div className="flex justify-between mb-3">
            <span className="text-sm font-semibold">R$ {Math.max(0, meta - totalRevenue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            <span className="text-sm font-semibold">{(meta / 1000).toFixed(0)}K</span>
          </div>
          <div className="w-full bg-muted/50 rounded-full h-2.5 mb-3 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700 shadow-[0_0_8px_hsl(152,60%,45%,0.4)]" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>{progressPct.toFixed(0)}% do caminho até a meta</span>
            </div>
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3" /><span>PRÓXIMA META</span>
            </div>
          </div>
          <div className="flex justify-between mt-2">
            <div className="flex items-center gap-1 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Início</div>
            <span className="text-sm font-bold">100K</span>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="relative overflow-hidden bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full" />
          <SectionTitle>Resumo Financeiro</SectionTitle>
          <div className="grid grid-cols-2 gap-6 mt-4">
            <MetricCard icon={<RefreshCw className="h-5 w-5 text-primary" />} label="Conversão" value={`${conversionRate}%`} change="+0%" />
            <MetricCard icon={<AlertCircle className="h-5 w-5 text-amber-500" />} label="Pre-Chargeback" value="0" change="+0%" />
            <MetricCard icon={<ArrowDownRight className="h-5 w-5 text-red-500" />} label="Chargeback" value={String(chargebacks)} change="+0%" />
            <MetricCard icon={<CircleDollarSign className="h-5 w-5 text-blue-500" />} label="Reembolsos" value={String(refunds)} change="+0%" />
          </div>
        </div>

        {/* Monitoring */}
        <div className="relative overflow-hidden bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-bl-full" />
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Monitoramento</SectionTitle>
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">Atualizado agora</span>
          </div>
          <div className="grid grid-cols-2 gap-y-5 mt-2">
            <MonitorItem label="Tempo Médio" value="0 ms" />
            <MonitorItem label="Taxa Conversão" value={`${conversionRate} %`} accent />
            <MonitorItem label="API/minuto" value="0.0" />
            <MonitorItem label="Webhook OK" value="100.0 %" accent />
          </div>
          <div className="border-t border-border/50 mt-5 pt-3 flex justify-between text-xs text-muted-foreground">
            <span>0 chamadas/24h</span>
            <span className="text-primary font-medium">Todos webhooks OK</span>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chart */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
          <SectionTitle>Vendas</SectionTitle>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 12%)" />
                <XAxis dataKey="name" stroke="hsl(220, 10%, 40%)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(220, 10%, 40%)" fontSize={11} tickFormatter={(v) => `R$ ${v}`} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(220, 25%, 8%)", border: "1px solid hsl(220, 20%, 15%)", borderRadius: "12px", fontSize: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                />
                <Area type="monotone" dataKey="vendas" stroke="hsl(152, 60%, 45%)" fillOpacity={1} fill="url(#colorVendas)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Atividade Recente</SectionTitle>
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Volume2 className="h-3.5 w-3.5" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-medium">Ao vivo</span>
            </div>
          </div>
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Eye className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma atividade recente</p>
              </div>
            ) : (
              recentActivity.map((item) => {
                const isTx = "payment_method" in item;
                const statusColor = item.status === "approved" || item.status === "paid" ? "text-primary" : item.status === "pending" || item.status === "requested" ? "text-amber-500" : "text-red-500";
                const statusLabel: Record<string, string> = { approved: "Aprovado", pending: "Pendente", paid: "Pago", requested: "Solicitado", failed: "Falhou", rejected: "Recusado", refunded: "Reembolsado", chargeback: "Chargeback", under_review: "Em análise" };
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${isTx ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-500"}`}>
                      {isTx ? <DollarSign className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">R$ {Number(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusColor} ${statusColor.replace("text-", "bg-")}/10`}>{statusLabel[item.status] || item.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {isTx ? (item as Tables<"transactions">).customer_name || "Nova transação pendente" : "Solicitação de saque"}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatRelativeTime(item.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex gap-2 mt-4 pt-3 border-t border-border/50">
            <Link to="/financeiro/extrato" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              Ver Transações <ArrowUpRight className="h-3 w-3" />
            </Link>
            <Link to="/financeiro/taxas" className="text-xs text-primary font-medium hover:underline flex items-center gap-1 ml-auto">
              Ver Taxas <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold flex items-center gap-2">
      <span className="w-1 h-5 bg-gradient-to-b from-primary to-emerald-400 rounded-full" />
      {children}
    </h3>
  );
}

function KpiCard({ label, value, subtitle, icon, gradient, iconBg, action }: {
  label: string; value: string; subtitle?: string; icon: React.ReactNode; gradient: string; iconBg: string; action?: { label: string; href: string };
}) {
  return (
    <div className={`relative overflow-hidden bg-card rounded-2xl border border-border/50 p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 group`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</h4>
          <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center text-foreground/70`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
        {action && (
          <Link to={action.href} className="text-xs text-primary font-semibold mt-3 inline-flex items-center gap-1.5 hover:gap-2 transition-all">
            <span className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center text-[8px] font-bold">+</span>
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, change }: { icon: React.ReactNode; label: string; value: string; change: string }) {
  return (
    <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/30">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{change}</p>
    </div>
  );
}

function MonitorItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} horas`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} dias`;
  return `há ${Math.floor(days / 30)} meses`;
}
