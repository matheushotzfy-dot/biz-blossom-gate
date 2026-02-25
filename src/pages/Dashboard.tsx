import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  DollarSign,
  Eye,
  GraduationCap,
  Layers,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PERIOD_OPTIONS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
];

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

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
  const [products, setProducts] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([txRes, wdRes, prodRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (wdRes.data) setWithdrawals(wdRes.data);
      if (prodRes.count != null) setProducts(prodRes.count);
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
      return transactions.filter(
        (t) => toBrasiliaDate(t.created_at) === yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      );
    }
    const start = new Date(today);
    start.setDate(start.getDate() - selectedPeriod.days);
    start.setHours(0, 0, 0, 0);
    return transactions.filter((t) => new Date(t.created_at) >= start);
  }, [transactions, selectedPeriod]);

  const approved = filteredTx.filter((t) => t.status === "completed");
  const pending = filteredTx.filter((t) => t.status === "pending");
  const failed = filteredTx.filter((t) => t.status === "failed");
  const chargebacks = filteredTx.filter((t) => t.status === "chargeback");
  const refunded = filteredTx.filter((t) => t.status === "refunded");
  const revenue = approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
  const ticket = approved.length > 0 ? revenue / approved.length : 0;
  const conversion = filteredTx.length > 0 ? ((approved.length / filteredTx.length) * 100).toFixed(1) : "0.0";
  const cbRate = filteredTx.length > 0 ? ((chargebacks.length / filteredTx.length) * 100).toFixed(2) : "0";
  const customers = new Set(filteredTx.map((t) => t.customer_email || t.customer_name || t.id)).size;

  const chartData = useMemo(() => {
    const days = Math.min(Math.max(selectedPeriod.days || 1, 1), 30);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(brasiliaToday());
      d.setDate(d.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const compare = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const amount = transactions
        .filter((t) => toBrasiliaDate(t.created_at) === compare && t.status === "completed")
        .reduce((acc, t) => acc + Number(t.net_amount), 0);
      return { name: label, vendas: amount };
    });
  }, [transactions, selectedPeriod.days]);

  const activity = [...transactions.slice(0, 6), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 7);

  return (
    <div className="space-y-6">
      {/* === HERO SECTION === */}
      <section className="panel-enterprise gradient-hero p-6 md:p-8 animate-fade-in">
        <div className="absolute inset-0 ambient-grid opacity-30 pointer-events-none rounded-2xl" />

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 mb-4 animate-scale-in">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-bold text-primary tracking-wide">HOTZFY COMMAND CENTER</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-foreground leading-[1.1]">
                Painel do<br />
                <span className="text-gradient">Infoprodutor</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-3 max-w-lg leading-relaxed">
                Gerencie vendas, checkout, entrega de conteúdo e finanças em um único painel de controle de alta performance.
              </p>
            </div>

            <div className="flex items-center gap-3 lg:pt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-border bg-card hover:border-primary/25 transition-all text-sm font-semibold text-foreground shadow-sm">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {selectedPeriod.label}
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl p-1.5 min-w-[140px]">
                  {PERIOD_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.label}
                      onClick={() => setSelectedPeriod(option)}
                      className={`rounded-lg text-sm cursor-pointer py-2 ${
                        selectedPeriod.label === option.label ? "text-primary font-semibold bg-primary/8" : ""
                      }`}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Hero KPIs */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="panel-enterprise-subtle p-4 animate-fade-in stagger-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-primary/12 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <span className="kicker">Receita líquida</span>
              </div>
              <p className="text-3xl font-display font-black text-foreground tracking-tight">{fmt(revenue)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{approved.length} pagamentos aprovados</p>
            </div>

            <div className="panel-enterprise-subtle p-4 animate-fade-in stagger-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-info/12 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-info" />
                </div>
                <span className="kicker">Conversão</span>
              </div>
              <p className="text-3xl font-display font-black text-foreground tracking-tight">{conversion}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">{filteredTx.length} checkouts no período</p>
            </div>

            <div className="panel-enterprise-subtle p-4 animate-fade-in stagger-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-success/12 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-success" />
                </div>
                <span className="kicker">Saúde da conta</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-2 w-2 rounded-full bg-success" style={{ animation: "pulse-glow 2s ease infinite" }} />
                <p className="text-sm font-bold text-foreground">Gateway online</p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">CB: {cbRate}% • Reembolso: {refunded.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* === KPI CARDS === */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={<DollarSign />} label="Receita" value={fmt(revenue)} sub="Valor líquido" tone="primary" delay="stagger-1" />
        <KpiCard icon={<Target />} label="Ticket Médio" value={fmt(ticket)} sub="Média por venda" tone="info" delay="stagger-2" />
        <KpiCard icon={<Users />} label="Clientes" value={String(customers)} sub="Base ativa" tone="success" delay="stagger-3" />
        <KpiCard icon={<Wallet />} label="Saldo" value={fmt(revenue)} sub="Pronto para saque" tone="warning" link="/financeiro/saques" delay="stagger-4" />
      </section>

      {/* === CHART + SIDEBAR === */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 panel-enterprise p-6 animate-fade-in stagger-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-display font-bold text-foreground">Performance de Receita</h2>
              <p className="text-xs text-muted-foreground mt-1">Série temporal — vendas aprovadas</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-display font-black text-foreground">{fmt(revenue)}</p>
              <p className="text-[11px] text-primary font-semibold">{selectedPeriod.label}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="hotzfyChart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={11} tickLine={false} axisLine={false} dy={8} />
              <YAxis stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={55} />
              <Tooltip
                contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: "12px", fontSize: "13px", color: "var(--tooltip-text)", padding: "10px 14px", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
                formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Vendas"]}
                cursor={{ stroke: "hsl(var(--primary) / 0.12)", strokeDasharray: "4 4" }}
              />
              <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#hotzfyChart)" dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <div className="panel-enterprise p-5 animate-fade-in stagger-3">
            <h3 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Qualidade da Operação</h3>
            <div className="space-y-2">
              <MetricLine icon={<ShoppingCart className="h-4 w-4" />} label="Aprovadas" value={String(approved.length)} color="success" />
              <MetricLine icon={<Clock3 className="h-4 w-4" />} label="Pendentes" value={String(pending.length)} color="warning" />
              <MetricLine icon={<AlertTriangle className="h-4 w-4" />} label="Falhas" value={String(failed.length)} color="destructive" />
              <MetricLine icon={<RefreshCw className="h-4 w-4" />} label="Chargebacks" value={`${chargebacks.length}`} color="destructive" />
            </div>
          </div>

          <div className="panel-enterprise p-5 animate-fade-in stagger-4">
            <h3 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Infoprodutos</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat icon={<Package className="h-4 w-4" />} label="Produtos" value={String(products)} />
              <MiniStat icon={<CreditCard className="h-4 w-4" />} label="Checkouts" value={String(filteredTx.length)} />
              <MiniStat icon={<GraduationCap className="h-4 w-4" />} label="Cursos" value={String(products)} />
              <MiniStat icon={<Layers className="h-4 w-4" />} label="Funis" value="Ativo" />
            </div>
          </div>
        </div>
      </section>

      {/* === ACTIONS + ACTIVITY === */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="panel-enterprise p-6 animate-fade-in stagger-3">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-base font-display font-bold text-foreground">Ações Estratégicas</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Criar Produto", href: "/vendas/produtos", icon: Package, desc: "Novo infoproduto" },
              { label: "Gerir Conteúdo", href: "/vendas/conteudo", icon: Layers, desc: "Módulos e aulas" },
              { label: "Checkout", href: "/vendas/checkout", icon: CreditCard, desc: "Links de pagamento" },
              { label: "Ver Vendas", href: "/vendas", icon: BarChart3, desc: "Relatório completo" },
              { label: "Extrato", href: "/financeiro/extrato", icon: Activity, desc: "Fluxo financeiro" },
              { label: "Saques", href: "/financeiro/saques", icon: ArrowDownRight, desc: "Transferir saldo" },
            ].map((action, i) => (
              <Link
                key={action.href}
                to={action.href}
                className={`panel-enterprise-subtle p-4 flex items-center gap-3.5 group animate-fade-in stagger-${i + 1}`}
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
                  <p className="text-[11px] text-muted-foreground">{action.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        <div className="panel-enterprise p-6 animate-fade-in stagger-4">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-base font-display font-bold text-foreground">Atividade Recente</h3>
            </div>
            <Link to="/financeiro/extrato" className="text-[12px] font-semibold text-primary inline-flex items-center gap-1 hover:gap-1.5 transition-all">
              Ver tudo <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-1">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-muted-foreground/30">
                <Eye className="h-8 w-8 mb-3" />
                <p className="text-sm font-medium">Nenhuma atividade ainda</p>
                <p className="text-[11px] mt-1 text-muted-foreground/20">Suas vendas aparecerão aqui</p>
              </div>
            ) : (
              activity.map((item, i) => {
                const isTx = "payment_method" in item;
                const statusMap: Record<string, { label: string; color: string }> = {
                  completed: { label: "Aprovado", color: "hsl(var(--success))" },
                  pending: { label: "Pendente", color: "hsl(var(--warning))" },
                  failed: { label: "Falhou", color: "hsl(var(--destructive))" },
                  refunded: { label: "Reembolso", color: "hsl(var(--info))" },
                  chargeback: { label: "Chargeback", color: "hsl(var(--destructive))" },
                };
                const status = statusMap[item.status] || { label: item.status, color: "hsl(var(--muted-foreground))" };
                const diff = Date.now() - new Date(item.created_at).getTime();
                const mins = Math.floor(diff / 60000);
                const timeLabel = mins < 1 ? "agora" : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`;

                return (
                  <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-all animate-fade-in stagger-${i + 1}`}>
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${status.color} 12%, transparent)` }}>
                      {isTx ? <DollarSign className="h-4.5 w-4.5" style={{ color: status.color }} /> : <Wallet className="h-4.5 w-4.5" style={{ color: status.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{fmt(Number(item.amount))}</p>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md" style={{ color: status.color, background: `color-mix(in srgb, ${status.color} 12%, transparent)` }}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isTx ? `Venda • ${(item as Tables<"transactions">).payment_method || "Pagamento"}` : "Saque"}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium">{timeLabel}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// === SUB COMPONENTS ===

type Tone = "primary" | "info" | "success" | "warning";

function KpiCard({ icon, label, value, sub, tone, link, delay = "" }: {
  icon: React.ReactNode; label: string; value: string; sub: string; tone: Tone; link?: string; delay?: string;
}) {
  const toneStyles: Record<Tone, { bg: string; text: string }> = {
    primary: { bg: "bg-primary/12", text: "text-primary" },
    info: { bg: "bg-info/12", text: "text-info" },
    success: { bg: "bg-success/12", text: "text-success" },
    warning: { bg: "bg-warning/12", text: "text-warning" },
  };

  const card = (
    <div className={`panel-enterprise p-5 hover-lift animate-fade-in ${delay}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="kicker">{label}</span>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${toneStyles[tone].bg}`}>
          <span className={toneStyles[tone].text}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-display font-black text-foreground tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>
    </div>
  );

  return link ? <Link to={link}>{card}</Link> : card;
}

function MetricLine({
  icon,
  label,
  value,
  color = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: "primary" | "info" | "success" | "warning" | "destructive";
}) {
  const tone: Record<"primary" | "info" | "success" | "warning" | "destructive", { bg: string; text: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary" },
    info: { bg: "bg-info/10", text: "text-info" },
    success: { bg: "bg-success/10", text: "text-success" },
    warning: { bg: "bg-warning/10", text: "text-warning" },
    destructive: { bg: "bg-destructive/10", text: "text-destructive" },
  };

  const current = tone[color] ?? tone.primary;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3 hover:bg-muted/40 transition-colors">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${current.bg} ${current.text}`}>{icon}</div>
      <span className="text-[13px] text-muted-foreground font-medium flex-1">{label}</span>
      <span className="text-[13px] font-bold text-foreground">{value}</span>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-base font-display font-bold text-foreground">{value}</p>
    </div>
  );
}
