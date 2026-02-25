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
] as const;

const STAGGER_CLASSES = ["", "stagger-1", "stagger-2", "stagger-3", "stagger-4", "stagger-5", "stagger-6"];

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function toBrasiliaDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function brasiliaToday() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>(PERIOD_OPTIONS[2]);
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
      const yesterdayStr = yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return transactions.filter((t) => toBrasiliaDate(t.created_at) === yesterdayStr);
    }

    const start = new Date(today);
    start.setDate(start.getDate() - selectedPeriod.days);
    start.setHours(0, 0, 0, 0);

    return transactions.filter((t) => new Date(t.created_at) >= start);
  }, [transactions, selectedPeriod]);

  const approved = filteredTx.filter((t) => t.status === "completed");
  const pending = filteredTx.filter((t) => t.status === "pending");
  const failed = filteredTx.filter((t) => t.status === "failed");
  const refunded = filteredTx.filter((t) => t.status === "refunded");
  const chargebacks = filteredTx.filter((t) => t.status === "chargeback");

  const revenue = approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
  const gross = approved.reduce((acc, t) => acc + Number(t.amount), 0);
  const ticket = approved.length > 0 ? gross / approved.length : 0;
  const conversion = filteredTx.length > 0 ? (approved.length / filteredTx.length) * 100 : 0;
  const riskRate = filteredTx.length > 0 ? ((chargebacks.length + refunded.length) / filteredTx.length) * 100 : 0;

  const customers = new Set(filteredTx.map((t) => t.customer_email || t.customer_name || t.id)).size;
  const withdrawalPending = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((acc, w) => acc + Number(w.net_amount), 0);

  const chartData = useMemo(() => {
    const days = Math.max(selectedPeriod.days <= 1 ? 7 : selectedPeriod.days, 1);

    return Array.from({ length: days }, (_, i) => {
      const d = new Date(brasiliaToday());
      d.setDate(d.getDate() - (days - 1 - i));

      const label = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      });

      const compare = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

      const amount = transactions
        .filter((t) => toBrasiliaDate(t.created_at) === compare && t.status === "completed")
        .reduce((acc, t) => acc + Number(t.net_amount), 0);

      return { name: label, vendas: amount };
    });
  }, [transactions, selectedPeriod.days]);

  const activity = useMemo(() => {
    const tx = transactions.slice(0, 8).map((t) => ({
      id: t.id,
      kind: "transaction" as const,
      createdAt: t.created_at,
      amount: Number(t.amount),
      status: t.status,
      label: t.payment_method || "Pagamento",
    }));

    const wd = withdrawals.slice(0, 5).map((w) => ({
      id: w.id,
      kind: "withdrawal" as const,
      createdAt: w.created_at,
      amount: Number(w.amount),
      status: w.status,
      label: "Solicitação de saque",
    }));

    return [...tx, ...wd]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [transactions, withdrawals]);

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="relative overflow-hidden panel-enterprise p-5 md:p-8 animate-fade-in">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-primary/15 blur-[90px]" />
          <div className="absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-info/10 blur-[110px]" />
          <div className="absolute inset-0 ambient-grid opacity-25" />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-bold tracking-[0.16em] uppercase text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Command Center
              </div>

              <div>
                <h1 className="text-3xl md:text-5xl font-display font-black tracking-tight leading-[1.05] text-foreground">
                  Plataforma de Escala
                  <br />
                  <span className="text-gradient">para Infoprodutores</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm md:text-[15px] leading-relaxed text-muted-foreground">
                  Um cockpit premium para monitorar vendas, performance de checkout e saúde da operação em tempo real.
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-border/80 bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary/25 hover:bg-muted/40">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {selectedPeriod.label}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[150px] rounded-xl p-1.5">
                {PERIOD_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.label}
                    onClick={() => setSelectedPeriod(option)}
                    className={`rounded-lg py-2 text-sm cursor-pointer ${
                      selectedPeriod.label === option.label ? "bg-primary/10 text-primary font-semibold" : ""
                    }`}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-3">
              <HeroStatCard
                icon={<DollarSign className="h-4 w-4" />}
                label="Receita líquida"
                value={fmt(revenue)}
                helper={`${approved.length} aprovações no período`}
                tone="primary"
              />
              <HeroStatCard
                icon={<Target className="h-4 w-4" />}
                label="Conversão"
                value={`${conversion.toFixed(1)}%`}
                helper={`${filteredTx.length} checkouts analisados`}
                tone="info"
              />
              <HeroStatCard
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Qualidade"
                value={`${(100 - riskRate).toFixed(1)}%`}
                helper={`Risco combinado: ${riskRate.toFixed(2)}%`}
                tone="success"
              />
            </div>

            <div className="lg:col-span-4 space-y-3">
              <div className="rounded-2xl border border-border/80 bg-card/90 p-4">
                <p className="kicker">Saldo para saque</p>
                <p className="mt-2 text-3xl font-display font-black tracking-tight text-foreground">{fmt(revenue)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Operação estável e pronta para escalar.</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/90 p-4">
                <p className="kicker">Saques pendentes</p>
                <p className="mt-2 text-2xl font-display font-black tracking-tight text-foreground">{fmt(withdrawalPending)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{withdrawals.filter((w) => w.status === "pending").length} solicitações aguardando.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={<TrendingUp className="h-5 w-5" />} label="Faturamento bruto" value={fmt(gross)} helper="Vendas aprovadas" tone="primary" delay="stagger-1" />
        <KpiTile icon={<Wallet className="h-5 w-5" />} label="Ticket médio" value={fmt(ticket)} helper="Média por transação" tone="info" delay="stagger-2" />
        <KpiTile icon={<Users className="h-5 w-5" />} label="Clientes únicos" value={String(customers)} helper="No período selecionado" tone="success" delay="stagger-3" />
        <KpiTile icon={<RefreshCw className="h-5 w-5" />} label="Pendências" value={String(pending.length)} helper="Pagamentos aguardando" tone="warning" delay="stagger-4" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8 panel-enterprise p-5 md:p-6 animate-fade-in stagger-2">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-display font-black text-foreground">Performance de Receita</h2>
              <p className="mt-1 text-xs text-muted-foreground">Série temporal de vendas aprovadas</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-bold">Acumulado</p>
              <p className="text-lg font-display font-black text-foreground">{fmt(revenue)}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.18)" fontSize={11} />
              <YAxis tickLine={false} axisLine={false} width={58} stroke="hsl(var(--muted-foreground) / 0.18)" fontSize={11} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                contentStyle={{
                  background: "var(--tooltip-bg)",
                  border: "1px solid var(--tooltip-border)",
                  borderRadius: "12px",
                  fontSize: "13px",
                  color: "var(--tooltip-text)",
                  padding: "10px 14px",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                }}
                formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]}
                cursor={{ stroke: "hsl(var(--primary) / 0.16)", strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="vendas"
                stroke="hsl(var(--primary))"
                strokeWidth={2.8}
                fill="url(#dashboardRevenue)"
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <div className="panel-enterprise p-5 animate-fade-in stagger-3">
            <h3 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Saúde Operacional</h3>
            <div className="space-y-2.5">
              <QualityLine icon={<ShoppingCart className="h-4 w-4" />} label="Aprovadas" value={String(approved.length)} tone="success" />
              <QualityLine icon={<Clock3 className="h-4 w-4" />} label="Pendentes" value={String(pending.length)} tone="warning" />
              <QualityLine icon={<AlertTriangle className="h-4 w-4" />} label="Falhas" value={String(failed.length)} tone="destructive" />
              <QualityLine icon={<RefreshCw className="h-4 w-4" />} label="Risco" value={`${riskRate.toFixed(2)}%`} tone="info" />
            </div>
          </div>

          <div className="panel-enterprise p-5 animate-fade-in stagger-4">
            <h3 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Snapshot de Produto</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <SmallMetric icon={<Package className="h-4 w-4" />} label="Produtos" value={String(products)} />
              <SmallMetric icon={<CreditCard className="h-4 w-4" />} label="Checkouts" value={String(filteredTx.length)} />
              <SmallMetric icon={<GraduationCap className="h-4 w-4" />} label="Cursos" value={String(products)} />
              <SmallMetric icon={<Layers className="h-4 w-4" />} label="Funis" value="Ativo" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="panel-enterprise p-6 animate-fade-in stagger-3">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-display font-black text-foreground">Ações Estratégicas</h3>
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
                className={`panel-enterprise-subtle flex items-center gap-3.5 p-4 group animate-fade-in ${STAGGER_CLASSES[i]}`}
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary/15">
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
                  <p className="text-[11px] text-muted-foreground">{action.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary/60" />
              </Link>
            ))}
          </div>
        </div>

        <div className="panel-enterprise p-6 animate-fade-in stagger-4">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-display font-black text-foreground">Atividade Recente</h3>
            </div>
            <Link to="/financeiro/extrato" className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary transition-all hover:gap-1.5">
              Ver tudo <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-1">
            {activity.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-12 text-center">
                <p className="text-sm font-semibold text-foreground">Nenhuma atividade ainda</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Suas movimentações aparecerão automaticamente aqui.</p>
              </div>
            ) : (
              activity.map((item, i) => {
                const txStyles: Record<string, { label: string; pill: string; icon: string }> = {
                  completed: { label: "Aprovada", pill: "bg-success/15 text-success", icon: "bg-success/12 text-success" },
                  pending: { label: "Pendente", pill: "bg-warning/15 text-warning", icon: "bg-warning/12 text-warning" },
                  failed: { label: "Falhou", pill: "bg-destructive/15 text-destructive", icon: "bg-destructive/12 text-destructive" },
                  refunded: { label: "Reembolso", pill: "bg-info/15 text-info", icon: "bg-info/12 text-info" },
                  chargeback: { label: "Chargeback", pill: "bg-destructive/15 text-destructive", icon: "bg-destructive/12 text-destructive" },
                  default: { label: "Status", pill: "bg-muted text-foreground", icon: "bg-muted text-foreground" },
                };

                const wdStyles: Record<string, { label: string; pill: string; icon: string }> = {
                  pending: { label: "Em análise", pill: "bg-warning/15 text-warning", icon: "bg-warning/12 text-warning" },
                  approved: { label: "Aprovado", pill: "bg-success/15 text-success", icon: "bg-success/12 text-success" },
                  rejected: { label: "Rejeitado", pill: "bg-destructive/15 text-destructive", icon: "bg-destructive/12 text-destructive" },
                  default: { label: "Saque", pill: "bg-muted text-foreground", icon: "bg-muted text-foreground" },
                };

                const styles =
                  item.kind === "transaction"
                    ? txStyles[item.status] || txStyles.default
                    : wdStyles[item.status] || wdStyles.default;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/35 animate-fade-in ${
                      STAGGER_CLASSES[i + 1] || ""
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${styles.icon}`}>
                      {item.kind === "transaction" ? <DollarSign className="h-4.5 w-4.5" /> : <Wallet className="h-4.5 w-4.5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{fmt(item.amount)}</p>
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${styles.pill}`}>{styles.label}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{item.kind === "transaction" ? `Venda • ${item.label}` : item.label}</p>
                    </div>

                    <span className="text-[11px] font-medium text-muted-foreground">{timeAgo(item.createdAt)}</span>
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

type Tone = "primary" | "info" | "success" | "warning";

function KpiTile({
  icon,
  label,
  value,
  helper,
  tone,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: Tone;
  delay?: string;
}) {
  const toneStyles: Record<Tone, { bg: string; text: string }> = {
    primary: { bg: "bg-primary/12", text: "text-primary" },
    info: { bg: "bg-info/12", text: "text-info" },
    success: { bg: "bg-success/12", text: "text-success" },
    warning: { bg: "bg-warning/12", text: "text-warning" },
  };

  return (
    <div className={`panel-enterprise p-5 hover-lift animate-fade-in ${delay || ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="kicker">{label}</span>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${toneStyles[tone].bg}`}>
          <span className={toneStyles[tone].text}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-display font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
}

function HeroStatCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: Tone;
}) {
  const toneStyles: Record<Tone, { bg: string; text: string }> = {
    primary: { bg: "bg-primary/12", text: "text-primary" },
    info: { bg: "bg-info/12", text: "text-info" },
    success: { bg: "bg-success/12", text: "text-success" },
    warning: { bg: "bg-warning/12", text: "text-warning" },
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 p-4 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${toneStyles[tone].bg}`}>
          <span className={toneStyles[tone].text}>{icon}</span>
        </div>
        <span className="kicker">{label}</span>
      </div>
      <p className="text-2xl font-display font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
}

function QualityLine({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "success" | "warning" | "destructive" | "info";
}) {
  const styles: Record<"success" | "warning" | "destructive" | "info", { bg: string; text: string }> = {
    success: { bg: "bg-success/10", text: "text-success" },
    warning: { bg: "bg-warning/10", text: "text-warning" },
    destructive: { bg: "bg-destructive/10", text: "text-destructive" },
    info: { bg: "bg-info/10", text: "text-info" },
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${styles[tone].bg} ${styles[tone].text}`}>{icon}</div>
      <span className="flex-1 text-[13px] font-medium text-muted-foreground">{label}</span>
      <span className="text-[13px] font-bold text-foreground">{value}</span>
    </div>
  );
}

function SmallMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-base font-display font-bold text-foreground">{value}</p>
    </div>
  );
}

