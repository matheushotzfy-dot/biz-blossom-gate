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
  Users,
  Wallet,
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
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
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
        (t) =>
          toBrasiliaDate(t.created_at) ===
          yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
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

  const activity = [...transactions.slice(0, 6), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 7);

  return (
    <div className="space-y-5 animate-fade-in">
      <section className="panel-enterprise p-5 md:p-6 surface-glow relative overflow-hidden">
        <div className="absolute inset-0 ambient-grid opacity-25 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-foreground">Command Center • HOTZFY</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">
              Plataforma enterprise para infoprodutores
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Controle vendas, checkout e entrega do conteúdo em um único painel de alta performance.
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card/80 hover:border-primary/30 transition-colors text-sm font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                {selectedPeriod.label}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl p-1 min-w-[130px]">
              {PERIOD_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.label}
                  onClick={() => setSelectedPeriod(option)}
                  className={`rounded-lg text-sm cursor-pointer ${
                    selectedPeriod.label === option.label ? "text-primary font-semibold bg-primary/8" : ""
                  }`}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="panel-enterprise-subtle p-3.5">
            <p className="kicker">Receita líquida</p>
            <p className="text-2xl font-display font-extrabold text-foreground mt-1">{fmt(revenue)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{approved.length} pagamentos aprovados</p>
          </div>
          <div className="panel-enterprise-subtle p-3.5">
            <p className="kicker">Operação de vendas</p>
            <p className="text-2xl font-display font-extrabold text-foreground mt-1">{conversion}%</p>
            <p className="text-[11px] text-muted-foreground mt-1">Conversão no período selecionado</p>
          </div>
          <div className="panel-enterprise-subtle p-3.5">
            <p className="kicker">Saúde da conta</p>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-success" />
              Gateway estável, checkout online
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Chargeback: {cbRate}% • Reembolso: {refunded.length}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Receita"
          value={fmt(revenue)}
          sub="Valor líquido"
          tone="primary"
        />
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          label="Ticket médio"
          value={fmt(ticket)}
          sub="Média por venda"
          tone="info"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Clientes"
          value={String(customers)}
          sub="Base ativa"
          tone="success"
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Saldo disponível"
          value={fmt(revenue)}
          sub="Pronto para saque"
          tone="warning"
          link="/financeiro/saques"
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 panel-enterprise p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-display font-bold text-foreground">Performance de Receita</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Série temporal de vendas aprovadas</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-display font-extrabold text-foreground">{fmt(revenue)}</p>
              <p className="text-[11px] text-muted-foreground">{selectedPeriod.label}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="hotzfyChart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                stroke="hsl(var(--muted-foreground) / 0.2)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground) / 0.2)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${v}`}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--tooltip-bg)",
                  border: "1px solid var(--tooltip-border)",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "var(--tooltip-text)",
                  padding: "8px 12px",
                }}
                formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Vendas"]}
                cursor={{ stroke: "hsl(var(--primary) / 0.15)", strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="vendas"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#hotzfyChart)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "hsl(var(--primary))",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <div className="panel-enterprise p-4">
            <h3 className="text-xs font-display font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Qualidade da operação
            </h3>
            <div className="space-y-2.5">
              <MetricLine icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Vendas aprovadas" value={String(approved.length)} />
              <MetricLine icon={<Clock3 className="h-3.5 w-3.5" />} label="Pendentes" value={String(pending.length)} />
              <MetricLine icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Falhas" value={String(failed.length)} />
              <MetricLine icon={<RefreshCw className="h-3.5 w-3.5" />} label="Chargebacks" value={`${chargebacks.length} (${cbRate}%)`} />
            </div>
          </div>

          <div className="panel-enterprise p-4">
            <h3 className="text-xs font-display font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Snapshot infoprodutos
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat icon={<Package className="h-3.5 w-3.5" />} label="Produtos" value={String(products)} />
              <MiniStat icon={<CreditCard className="h-3.5 w-3.5" />} label="Checkouts" value={String(filteredTx.length)} />
              <MiniStat icon={<GraduationCap className="h-3.5 w-3.5" />} label="Cursos" value={String(products)} />
              <MiniStat icon={<Layers className="h-3.5 w-3.5" />} label="Funis" value="Ativo" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="panel-enterprise p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-display font-bold text-foreground">Ações Estratégicas</h3>
            <span className="text-[11px] text-muted-foreground">Navegação rápida</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Criar Produto", href: "/vendas/produtos", icon: Package, desc: "Novo infoproduto" },
              { label: "Gerir Conteúdo", href: "/vendas/conteudo", icon: Layers, desc: "Aulas e módulos" },
              { label: "Checkout", href: "/vendas/checkout", icon: CreditCard, desc: "Links de pagamento" },
              { label: "Vendas", href: "/vendas", icon: BarChart3, desc: "Relatórios" },
              { label: "Extrato", href: "/financeiro/extrato", icon: Activity, desc: "Fluxo financeiro" },
              { label: "Saques", href: "/financeiro/saques", icon: ArrowDownRight, desc: "Transferir saldo" },
            ].map((action) => (
              <Link
                key={action.href}
                to={action.href}
                className="panel-enterprise-subtle p-3 flex items-center gap-3 hover:border-primary/30 hover:bg-primary/[0.04] transition-all"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/12 text-primary flex items-center justify-center shrink-0">
                  <action.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel-enterprise p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-display font-bold text-foreground">Atividade Recente</h3>
            <Link to="/financeiro/extrato" className="text-[11px] font-semibold text-primary inline-flex items-center gap-1">
              Ver tudo <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-1">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground/35">
                <Eye className="h-7 w-7 mb-2" />
                <p className="text-xs">Nenhuma atividade ainda</p>
              </div>
            ) : (
              activity.map((item) => {
                const isTx = "payment_method" in item;
                const statusMap: Record<string, { label: string; color: string }> = {
                  completed: { label: "Aprovado", color: "hsl(var(--success))" },
                  pending: { label: "Pendente", color: "hsl(var(--warning))" },
                  failed: { label: "Falhou", color: "hsl(var(--destructive))" },
                  refunded: { label: "Reembolso", color: "hsl(var(--info))" },
                  chargeback: { label: "Chargeback", color: "hsl(var(--destructive))" },
                };

                const status = statusMap[item.status] || {
                  label: item.status,
                  color: "hsl(var(--muted-foreground))",
                };

                const diff = Date.now() - new Date(item.created_at).getTime();
                const mins = Math.floor(diff / 60000);
                const timeLabel = mins < 1 ? "agora" : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`;

                return (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/35 transition-colors">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `color-mix(in srgb, ${status.color} 12%, transparent)` }}
                    >
                      {isTx ? (
                        <DollarSign className="h-4 w-4" style={{ color: status.color }} />
                      ) : (
                        <Wallet className="h-4 w-4" style={{ color: status.color }} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{fmt(Number(item.amount))}</p>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            color: status.color,
                            background: `color-mix(in srgb, ${status.color} 12%, transparent)`,
                          }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {isTx ? `Venda • ${(item as Tables<"transactions">).payment_method || "Pagamento"}` : "Saque"}
                      </p>
                    </div>

                    <span className="text-[10px] text-muted-foreground">{timeLabel}</span>
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

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
  link,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: Tone;
  link?: string;
}) {
  const toneClass: Record<Tone, string> = {
    primary: "bg-primary/12 text-primary",
    info: "bg-info/12 text-info",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
  };

  const content = (
    <div className="panel-enterprise p-4 hover:border-primary/25 transition-colors">
      <div className="flex items-center justify-between mb-2.5">
        <span className="kicker">{label}</span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${toneClass[tone]}`}>{icon}</div>
      </div>
      <p className="text-lg lg:text-xl font-display font-extrabold text-foreground leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
}

function MetricLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/25 px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/25 p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px]">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm font-display font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}
