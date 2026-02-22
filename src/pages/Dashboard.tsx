import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Wallet,
  Target,
  BarChart3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Volume2,
  Lock,
  CircleDollarSign,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const [txRes, profileRes, wdRes] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(10),
      ]);
      if (txRes.data) setTransactions(txRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      if (wdRes.data) setWithdrawals(wdRes.data);
    };
    loadData();
  }, [user]);

  const approvedTx = transactions.filter((t) => t.status === "approved");
  const totalRevenue = approvedTx.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalNet = approvedTx.reduce((acc, t) => acc + Number(t.net_amount), 0);
  const ticketMedio = approvedTx.length > 0 ? totalRevenue / approvedTx.length : 0;
  const totalFees = approvedTx.reduce((acc, t) => acc + Number(t.fee_amount), 0);
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0);

  // Build chart data from last 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = transactions.filter((t) => {
      const txDate = new Date(t.created_at);
      return txDate.toDateString() === d.toDateString() && t.status === "approved";
    });
    const total = dayTx.reduce((acc, t) => acc + Number(t.amount), 0);
    return { name: dayStr, vendas: total };
  });

  const conversionRate = transactions.length > 0
    ? ((approvedTx.length / transactions.length) * 100).toFixed(1)
    : "0.0";

  const chargebacks = transactions.filter((t) => t.status === "chargeback").length;
  const refunds = transactions.filter((t) => t.status === "refunded").length;

  // Recent activity
  const recentActivity = [...transactions.slice(0, 5), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const meta = 10000;
  const progressPercent = Math.min((totalRevenue / meta) * 100, 100);
  const dailyRevenue = chartData.length > 0 ? chartData[chartData.length - 1]?.vendas || 0 : 0;

  return (
    <div className="space-y-6 dark">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Veja o resumo de seu desempenho!
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
          {" - "}
          {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* Top 4 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardPodpay
          label="Total em Vendas"
          value={`R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle="durante este período."
          icon={<DollarSign className="h-5 w-5" />}
          accentColor="text-primary"
        />
        <StatCardPodpay
          label="Ticket Médio"
          value={`R$ ${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle={`em ${approvedTx.length} vendas neste período.`}
          icon={<TrendingUp className="h-5 w-5" />}
          accentColor="text-primary"
        />
        <StatCardPodpay
          label="Pedidos Pagos"
          value={String(approvedTx.length)}
          subtitle={`em ${transactions.length} transações geradas neste período.`}
          icon={<ShoppingCart className="h-5 w-5" />}
          accentColor="text-primary"
        />
        <StatCardPodpay
          label="Saldo Disponível"
          value={`R$ ${totalNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subtitle={pendingWithdrawals > 0 ? `R$ ${pendingWithdrawals.toFixed(2)} em saques pendentes` : undefined}
          icon={<Wallet className="h-5 w-5" />}
          accentColor="text-primary"
          action={{ label: "Solicitar Saque", href: "/financeiro/saques" }}
        />
      </div>

      {/* Middle row: Progresso + Resumo Financeiro + Monitoramento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progresso */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <span className="w-1 h-4 bg-primary rounded-full" />
            Progresso
          </h3>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Total faturado</span>
            <span>Vendas diárias</span>
          </div>
          <div className="flex justify-between mb-4">
            <span className="text-lg font-bold">R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            <span className="text-lg font-bold text-primary">R$ {dailyRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / dia</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Falta para</span>
            <span>Meta atual</span>
          </div>
          <div className="flex justify-between mb-3">
            <span className="text-sm font-semibold">R$ {Math.max(0, meta - totalRevenue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            <span className="text-sm font-semibold">{(meta / 1000).toFixed(0)}K</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 mb-3">
            <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>{progressPercent.toFixed(0)}% do caminho até a meta</span>
            </div>
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              <span>100K</span>
            </div>
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-6">
            <span className="w-1 h-4 bg-primary rounded-full" />
            Resumo Financeiro
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <FinancialMetric icon={<RefreshCw className="h-5 w-5 text-primary" />} label="Conversão" value={`${conversionRate}%`} change="+0%" />
            <FinancialMetric icon={<AlertCircle className="h-5 w-5 text-warning" />} label="Pre-Chargeback" value="0" change="+0%" />
            <FinancialMetric icon={<ArrowDownRight className="h-5 w-5 text-destructive" />} label="Chargeback" value={String(chargebacks)} change="+0%" />
            <FinancialMetric icon={<CircleDollarSign className="h-5 w-5 text-info" />} label="Qtde. Reembolsos" value={String(refunds)} change="+0%" />
          </div>
        </div>

        {/* Monitoramento */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full" />
              Monitoramento
            </h3>
            <span className="text-xs text-muted-foreground">Atualizado há alguns segundos</span>
          </div>
          <div className="grid grid-cols-2 gap-y-5">
            <MonitorMetric label="Tempo Médio" value="0 ms" />
            <MonitorMetric label="Taxa Conversão" value={`${conversionRate} %`} accent />
            <MonitorMetric label="API/minuto" value="0.0" />
            <MonitorMetric label="Webhook OK" value="100.0 %" accent />
          </div>
          <div className="border-t border-border mt-4 pt-3 flex justify-between text-xs text-muted-foreground">
            <span>0 chamadas/24h</span>
            <span className="text-primary">Todos webhooks OK</span>
          </div>
        </div>
      </div>

      {/* Bottom row: Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Vendas chart */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <span className="w-1 h-4 bg-primary rounded-full" />
            Vendas
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 15%)" />
              <XAxis dataKey="name" stroke="hsl(220, 10%, 50%)" fontSize={11} />
              <YAxis stroke="hsl(220, 10%, 50%)" fontSize={11} tickFormatter={(v) => `R$ ${v}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 25%, 9%)",
                  border: "1px solid hsl(220, 20%, 15%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
              />
              <Area type="monotone" dataKey="vendas" stroke="hsl(152, 60%, 45%)" fillOpacity={1} fill="url(#colorVendas)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Atividade Recente */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full" />
              Atividade Recente
            </h3>
            <div className="flex items-center gap-1 text-xs text-primary">
              <Volume2 className="h-3.5 w-3.5" />
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Ao vivo
              </span>
            </div>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade recente</p>
            ) : (
              recentActivity.map((item) => {
                const isTx = "payment_method" in item;
                const statusColor = item.status === "approved" || item.status === "paid"
                  ? "text-primary"
                  : item.status === "pending" || item.status === "requested"
                  ? "text-warning"
                  : "text-destructive";
                const statusLabel = {
                  approved: "Aprovado",
                  pending: "Pendente",
                  paid: "Pago",
                  requested: "Solicitado",
                  failed: "Falhou",
                  rejected: "Recusado",
                  refunded: "Reembolsado",
                  chargeback: "Chargeback",
                  under_review: "Em análise",
                }[item.status] || item.status;

                return (
                  <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isTx ? "bg-primary/10 text-primary" : "bg-info/10 text-info"
                    }`}>
                      {isTx ? "$" : "↓"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          R$ {Number(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {isTx ? (item as Tables<"transactions">).customer_name || "Nova transação" : "Solicitação de saque"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components

function StatCardPodpay({
  label,
  value,
  subtitle,
  icon,
  accentColor,
  action,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-1 h-4 bg-primary rounded-full" />
          {label}
        </h4>
        <div className={`${accentColor} opacity-60`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      {action && (
        <a href={action.href} className="text-xs text-primary font-medium mt-2 inline-flex items-center gap-1 hover:underline">
          <span className="h-3 w-3 rounded-full border border-primary flex items-center justify-center text-[8px]">+</span>
          {action.label}
        </a>
      )}
    </div>
  );
}

function FinancialMetric({ icon, label, value, change }: { icon: React.ReactNode; label: string; value: string; change: string }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{change}</p>
    </div>
  );
}

function MonitorMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
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
  const months = Math.floor(days / 30);
  return `há ${months} meses`;
}
