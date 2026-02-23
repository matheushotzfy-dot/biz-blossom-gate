import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, ShoppingCart, Wallet, Clock, CheckCircle2,
  AlertCircle, RefreshCw, ArrowDownRight, CircleDollarSign, Volume2,
  Lock, ArrowUpRight, Eye, Target, Trophy, Zap, Shield,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

// Milestone tiers
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
  if (v === 0) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
};

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

  const milestone = getCurrentMilestone(totalRevenue);
  const dailyRevenue = chartData[chartData.length - 1]?.vendas || 0;

  const recentActivity = [...transactions.slice(0, 5), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header + Milestone Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Veja o resumo de seu desempenho!</p>
          </div>
          <div className="flex items-center gap-2 bg-card/60 backdrop-blur-xl border border-border/30 rounded-2xl px-4 py-2.5 text-xs text-muted-foreground shadow-lg shadow-black/5 shrink-0">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">
              {new Date(Date.now() - 30 * 86400000).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
              {" - "}
              {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <span className="sm:hidden">Últimos 30 dias</span>
          </div>
        </div>

        {/* Milestone Progress - Top Bar */}
        <div className="bg-card/60 backdrop-blur-xl border border-border/30 rounded-2xl p-4 shadow-lg shadow-black/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Premiações</span>
            </div>
            <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full">
              {fmtCurrency(totalRevenue)} / R$ {(milestone.next.value / 1000).toFixed(0)}K
            </span>
          </div>
          <div className="relative">
            <div className="w-full bg-muted/30 rounded-full h-3 overflow-hidden backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-primary transition-all duration-1000 shadow-[0_0_16px_hsl(152,60%,45%,0.6)]"
                style={{ width: `${Math.max(milestone.pct, 2)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              {MILESTONES.map((m) => (
                <div key={m.label} className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full border-2 transition-all ${
                    totalRevenue >= m.value ? "bg-primary border-primary shadow-[0_0_8px_hsl(152,60%,45%,0.6)]" : "bg-muted/50 border-border/50"
                  }`} />
                  <span className={`text-[9px] mt-1 font-medium ${totalRevenue >= m.value ? "text-primary" : "text-muted-foreground/60"}`}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          label="Total em Vendas"
          value={fmtCurrency(totalRevenue)}
          subtitle="durante este período."
          icon={<DollarSign className="h-5 w-5" />}
          accentColor="text-primary"
        />
        <KpiCard
          label="Ticket Médio"
          value={fmtCurrency(ticketMedio)}
          subtitle={approvedTx.length > 0 ? `em ${approvedTx.length} vendas neste período.` : "sem vendas ainda"}
          icon={<TrendingUp className="h-5 w-5" />}
          accentColor="text-primary"
        />
        <KpiCard
          label="Pedidos Pagos"
          value={approvedTx.length > 0 ? String(approvedTx.length) : "—"}
          subtitle={transactions.length > 0 ? `em ${transactions.length} transações geradas.` : "nenhuma transação"}
          icon={<ShoppingCart className="h-5 w-5" />}
          accentColor="text-primary"
        />
        <KpiCard
          label="Saldo Disponível"
          value={fmtCurrency(totalNet)}
          subtitle={pendingWd > 0 ? `${fmtCurrency(pendingWd)} pendente` : "Pronto para saque"}
          icon={<Wallet className="h-5 w-5" />}
          accentColor="text-primary"
          action={{ label: "Solicitar Saque", href: "/financeiro/saques" }}
        />
      </div>

      {/* Vendas por método */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <MethodCard label="Vendas no Pix" value={pixTx.reduce((a,t) => a + Number(t.amount), 0)} count={pixTx.length} total={transactions.filter(t => t.payment_method === "pix").length} />
        <MethodCard label="Vendas no Cartão" value={cardTx.reduce((a,t) => a + Number(t.amount), 0)} count={cardTx.length} total={transactions.filter(t => t.payment_method === "credit_card").length} />
        <MethodCard label="Vendas no Boleto" value={boletoTx.reduce((a,t) => a + Number(t.amount), 0)} count={boletoTx.length} total={transactions.filter(t => t.payment_method === "boleto").length} />
      </div>

      {/* Middle Row: Progress + Financial Summary + Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Progress Card */}
        <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/30 p-5 shadow-lg shadow-black/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/8 to-transparent rounded-bl-full" />
          <SectionTitle icon={<Target className="h-4 w-4 text-primary" />}>Progresso</SectionTitle>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total faturado</span><span>Vendas diárias</span>
            </div>
            <div className="flex justify-between">
              <span className="text-lg font-bold text-foreground">{fmtCurrency(totalRevenue)}</span>
              <span className="text-lg font-bold text-primary">{fmtCurrency(dailyRevenue)} / dia</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Falta para</span><span>Meta atual</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-semibold text-foreground">{fmtCurrency(Math.max(0, milestone.next.value - totalRevenue))}</span>
              <span className="text-sm font-semibold text-foreground">{milestone.next.label}</span>
            </div>
            <div className="w-full bg-muted/30 rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700 shadow-[0_0_10px_hsl(152,60%,45%,0.5)]" style={{ width: `${Math.max(milestone.pct, 1)}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span>{milestone.pct.toFixed(0)}% do caminho até a meta</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Início</div>
              <div className="flex items-center gap-1 text-xs"><Lock className="h-3 w-3 text-muted-foreground" /> <span className="font-bold">{milestone.next.label}</span></div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/30 p-5 shadow-lg shadow-black/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-info/8 to-transparent rounded-bl-full" />
          <SectionTitle icon={<CircleDollarSign className="h-4 w-4 text-primary" />}>Resumo Financeiro</SectionTitle>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <MetricCard icon={<RefreshCw className="h-5 w-5 text-primary" />} label="Conversão" value={`${conversionRate}%`} change="+0%" />
            <MetricCard icon={<AlertCircle className="h-5 w-5 text-warning" />} label="Pre-Chargeback" value="0" change="+0%" />
            <MetricCard icon={<ArrowDownRight className="h-5 w-5 text-destructive" />} label="Chargeback" value={String(chargebacks)} change="+0%" />
            <MetricCard icon={<CircleDollarSign className="h-5 w-5 text-info" />} label="Reembolsos" value={String(refunds)} change="+0%" />
          </div>
        </div>

        {/* Monitoring */}
        <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/30 p-5 shadow-lg shadow-black/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-success/8 to-transparent rounded-bl-full" />
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<Zap className="h-4 w-4 text-primary" />}>Monitoramento</SectionTitle>
            <span className="text-[10px] text-muted-foreground bg-muted/30 backdrop-blur-sm px-2 py-0.5 rounded-full">Atualizado agora</span>
          </div>
          <div className="grid grid-cols-2 gap-y-5 mt-2">
            <MonitorItem label="Tempo Médio" value="0 ms" />
            <MonitorItem label="Taxa Conversão" value={`${conversionRate} %`} accent />
            <MonitorItem label="API/minuto" value="0.0" />
            <MonitorItem label="Webhook OK" value="100.0 %" accent />
          </div>
          <div className="border-t border-border/30 mt-5 pt-3 flex justify-between text-xs text-muted-foreground">
            <span>0 chamadas/24h</span>
            <span className="text-primary font-medium">Todos webhooks OK</span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-4">
        {/* Chart */}
        <div className="lg:col-span-3 bg-card/60 backdrop-blur-xl rounded-2xl border border-border/30 p-5 shadow-lg shadow-black/5">
          <SectionTitle icon={<TrendingUp className="h-4 w-4 text-primary" />}>Vendas por dia</SectionTitle>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barCategoryGap="20%">
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(152, 60%, 45%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 12%)" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(220, 10%, 40%)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(220, 10%, 40%)" fontSize={11} tickFormatter={(v) => `R$ ${v}`} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(220, 25%, 8%)", border: "1px solid hsl(220, 20%, 15%)", borderRadius: "16px", fontSize: "12px", boxShadow: "0 16px 48px rgba(0,0,0,0.4)", backdropFilter: "blur(20px)" }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                />
                <Bar dataKey="vendas" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity */}
        <div className="lg:col-span-2 bg-card/60 backdrop-blur-xl rounded-2xl border border-border/30 p-5 shadow-lg shadow-black/5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<Volume2 className="h-4 w-4 text-primary" />}>Atividade Recente</SectionTitle>
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(152,60%,45%,0.8)]" />
              <span className="font-medium">Ao vivo</span>
            </div>
          </div>
          <div className="space-y-0.5 max-h-[280px] overflow-y-auto pr-1">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Eye className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">Nenhuma atividade recente</p>
              </div>
            ) : (
              recentActivity.map((item) => {
                const isTx = "payment_method" in item;
                const statusColor = item.status === "approved" || item.status === "paid" ? "text-primary" : item.status === "pending" || item.status === "requested" ? "text-warning" : "text-destructive";
                const statusLabel: Record<string, string> = { approved: "Aprovado", pending: "Pendente", paid: "Pago", requested: "Solicitado", failed: "Falhou", rejected: "Recusado", refunded: "Reembolsado", chargeback: "Chargeback", under_review: "Em análise" };
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-muted/20 transition-colors border-b border-border/20 last:border-0">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 backdrop-blur-sm ${isTx ? "bg-primary/10 text-primary" : "bg-info/10 text-info"}`}>
                      {isTx ? <DollarSign className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{fmtCurrency(Number(item.amount))}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusColor} ${statusColor.replace("text-", "bg-")}/10`}>{statusLabel[item.status] || item.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {isTx ? (item as Tables<"transactions">).customer_name || "Nova transação" : "Solicitação de saque"}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatRelativeTime(item.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
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

/* ============ Sub-components ============ */

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold flex items-center gap-2">
      {icon || <span className="w-1 h-5 bg-gradient-to-b from-primary to-emerald-400 rounded-full" />}
      {children}
    </h3>
  );
}

function KpiCard({ label, value, subtitle, icon, accentColor, action }: {
  label: string; value: string; subtitle?: string; icon: React.ReactNode; accentColor: string; action?: { label: string; href: string };
}) {
  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/30 p-4 md:p-5 shadow-lg shadow-black/5 hover:shadow-xl hover:border-primary/30 transition-all duration-300 group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-primary rounded-full shadow-[0_0_4px_hsl(152,60%,45%,0.4)]" />
            <h4 className="text-xs font-semibold text-foreground/70">{label}</h4>
          </div>
          <div className={`h-8 w-8 md:h-9 md:w-9 rounded-xl bg-primary/10 backdrop-blur-sm flex items-center justify-center ${accentColor}`}>{icon}</div>
        </div>
        <p className="text-xl md:text-2xl font-extrabold tracking-tight mt-1 text-foreground">{value}</p>
        {subtitle && <p className="text-[11px] text-foreground/60 mt-1">{subtitle}</p>}
        {action && (
          <Link to={action.href} className="text-xs text-primary font-semibold mt-2 inline-flex items-center gap-1.5 hover:gap-2 transition-all">
            <span className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center text-[8px] font-bold">+</span>
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function MethodCard({ label, value, count, total }: { label: string; value: number; count: number; total: number }) {
  const convRate = total > 0 ? ((count / total) * 100).toFixed(0) : "0";
  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/30 p-4 md:p-5 shadow-lg shadow-black/5 hover:border-primary/20 transition-all">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-4 bg-primary rounded-full shadow-[0_0_4px_hsl(152,60%,45%,0.4)]" />
        <h4 className="text-xs font-semibold text-foreground/70">{label}</h4>
      </div>
      <p className="text-xl font-extrabold text-foreground">{fmtCurrency(value)}</p>
      <p className="text-[11px] text-foreground/60 mt-1">{convRate}% de conversão</p>
      <p className="text-[11px] text-foreground/60">{count} de {total} pedidos</p>
    </div>
  );
}

function MetricCard({ icon, label, value, change }: { icon: React.ReactNode; label: string; value: string; change: string }) {
  return (
    <div className="text-center p-3 rounded-xl bg-muted/10 backdrop-blur-sm border border-border/20">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-[10px] text-foreground/60 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold mt-1 text-foreground">{value}</p>
      <p className="text-[10px] text-foreground/60 mt-0.5">{change}</p>
    </div>
  );
}

function MonitorItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-foreground/60 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
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
