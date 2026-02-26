import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CreditCard,
  DollarSign,
  Flame,
  Lock,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
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
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>(PERIOD_OPTIONS[0]);
  const [scaleMode, setScaleMode] = useState(false);
  const [showScalePopup, setShowScalePopup] = useState(false);
  const [fireEffect, setFireEffect] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> & { nickname?: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    ]).then(([txRes, wdRes, profileRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (wdRes.data) setWithdrawals(wdRes.data);
      if (profileRes.data) setProfile(profileRes.data as any);
    });
  }, [user?.id]);

  const todayRevenue = useMemo(() => {
    const todayStr = brasiliaToday().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return transactions
      .filter((t) => t.status === "completed" && toBrasiliaDate(t.created_at) === todayStr)
      .reduce((acc, t) => acc + Number(t.net_amount), 0);
  }, [transactions]);

  useEffect(() => {
    if (todayRevenue >= 2000 && !scaleMode) {
      setFireEffect(true);
      setTimeout(() => { setShowScalePopup(true); setScaleMode(true); }, 800);
      setTimeout(() => setFireEffect(false), 3000);
    }
  }, [todayRevenue, scaleMode]);

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
  const refunded = filteredTx.filter((t) => t.status === "refunded");
  const chargebacks = filteredTx.filter((t) => t.status === "chargeback");

  const revenue = approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
  const gross = approved.reduce((acc, t) => acc + Number(t.amount), 0);
  const ticket = approved.length > 0 ? gross / approved.length : 0;
  const conversion = filteredTx.length > 0 ? (approved.length / filteredTx.length) * 100 : 0;

  // Quality: risk = (refunded + chargebacks) / approved — inverted to show quality %
  const riskCount = refunded.length + chargebacks.length;
  const quality = approved.length > 0 ? Math.max(0, 100 - (riskCount / approved.length) * 100) : 100;
  const riskCombined = approved.length > 0 ? ((riskCount / approved.length) * 100).toFixed(3) : "000";

  // Unique customers
  const uniqueCustomers = new Set(filteredTx.map(t => t.customer_email).filter(Boolean)).size;

  const withdrawalBalance = withdrawals
    .filter((w) => w.status === "approved" || w.status === "completed")
    .reduce((acc, w) => acc + Number(w.net_amount), 0);
  const withdrawalPending = withdrawals.filter((w) => w.status === "pending");
  const withdrawalPendingAmount = withdrawalPending.reduce((acc, w) => acc + Number(w.net_amount), 0);

  // Balance for withdrawal = net revenue - already withdrawn
  const totalNetEarned = transactions
    .filter(t => t.status === "completed")
    .reduce((acc, t) => acc + Number(t.net_amount), 0);
  const totalWithdrawn = withdrawals
    .filter(w => w.status === "approved" || w.status === "completed")
    .reduce((acc, w) => acc + Number(w.amount), 0);
  const availableBalance = Math.max(0, totalNetEarned - totalWithdrawn - withdrawalPendingAmount);

  const chartData = useMemo(() => {
    const days = Math.max(selectedPeriod.days <= 1 ? 7 : selectedPeriod.days, 1);
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

  const displayName = (profile as any)?.nickname || profile?.full_name?.split(" ")[0] || "Seller";

  return (
    <div className="space-y-5 md:space-y-6 relative">
      {/* Fire border effect */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-primary/40 via-primary/10 to-transparent animate-pulse" />
        </div>
      )}

      {/* Scale mode popup */}
      {showScalePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" onClick={() => setShowScalePopup(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-primary/30 bg-card shadow-2xl shadow-primary/20 animate-scale-in overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-primary/5 pointer-events-none" />
            <button onClick={() => setShowScalePopup(false)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted z-10">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="relative p-8 md:p-10 text-center">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center ring-4 ring-primary/10">
                <Rocket className="h-10 w-10 text-primary" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/25 px-4 py-1.5 mb-5">
                <Flame className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Modo Escala Ativado</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-black text-foreground mb-3">
                MODO ESCALA<br /><span className="text-gradient">ATIVADO! 🔥</span>
              </h2>
              <p className="text-sm text-muted-foreground mb-2">SANGUE NOS OLHOS! 💪</p>
              <p className="text-sm text-muted-foreground mb-6">Estaremos <strong className="text-primary">juntos com você</strong> nessa jornada!</p>
              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground mb-1">Suporte Prioritário Ativado</p>
                    <p className="text-xs text-muted-foreground">Qualquer ajuda para escalar, pode nos chamar!</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowScalePopup(false)} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20">
                BORA ESCALAR! 🔥
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HERO: COMMAND CENTER ═══ */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
        <div className="p-6 md:p-8">
          {/* Top row: badge + period */}
          <div className="flex items-start justify-between mb-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.15em]">Command Center</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground hover:border-primary/20 transition-colors">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {selectedPeriod.label}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px] rounded-xl p-1">
                {PERIOD_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.label}
                    onClick={() => setSelectedPeriod(option)}
                    className={`rounded-lg py-2 text-sm cursor-pointer ${selectedPeriod.label === option.label ? "bg-primary/10 text-primary font-semibold" : ""}`}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-black tracking-tight text-foreground leading-[1.1] mb-2">
            Plataforma de Escala{" "}
            <br className="hidden md:block" />
            <span className="text-primary">para Infoprodutores</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Um cockpit premium para monitorar vendas, performance de checkout e saúde da operação em tempo real.
          </p>

          {/* Main KPIs row */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: 3 main cards */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Receita Líquida */}
              <div className="rounded-xl border border-border bg-background p-4 md:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Receita Líquida</span>
                </div>
                <p className="text-2xl md:text-3xl font-display font-black text-foreground tracking-tight">{fmt(revenue)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{approved.length} aprovações no período</p>
              </div>

              {/* Conversão */}
              <div className="rounded-xl border border-border bg-background p-4 md:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Conversão</span>
                </div>
                <p className="text-2xl md:text-3xl font-display font-black text-foreground tracking-tight">{conversion.toFixed(1)}%</p>
                <p className="text-[11px] text-muted-foreground mt-1">{filteredTx.length} checkouts analisados</p>
              </div>

              {/* Qualidade */}
              <div className="rounded-xl border border-border bg-background p-4 md:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-4 w-4 text-warning" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Qualidade</span>
                </div>
                <p className="text-2xl md:text-3xl font-display font-black text-foreground tracking-tight">{quality.toFixed(1)}%</p>
                <p className="text-[11px] text-muted-foreground mt-1">Risco combinado: {riskCombined}%</p>
              </div>
            </div>

            {/* Right: Saldo + Saques */}
            <div className="lg:col-span-4 space-y-3">
              <div className="rounded-xl border border-border bg-background p-4 md:p-5">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Saldo para Saque</span>
                <p className="text-2xl md:text-3xl font-display font-black text-foreground tracking-tight mt-2">{fmt(availableBalance)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Operação estável e pronta para escalar.</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4 md:p-5">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Saques Pendentes</span>
                <p className="text-2xl md:text-3xl font-display font-black text-foreground tracking-tight mt-2">{fmt(withdrawalPendingAmount)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{withdrawalPending.length} solicitações aguardando.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECONDARY KPIs ═══ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in stagger-1">
        <SecondaryKpi icon={<TrendingUp />} label="Faturamento Bruto" value={fmt(gross)} sub="Vendas aprovadas" />
        <SecondaryKpi icon={<CreditCard />} label="Ticket Médio" value={fmt(ticket)} sub="Média por transação" />
        <SecondaryKpi icon={<Users />} label="Clientes Únicos" value={String(uniqueCustomers)} sub="No período selecionado" />
        <SecondaryKpi icon={<Clock />} label="Pendências" value={String(pending.length)} sub="Pagamentos aguardando" />
      </section>

      {/* ═══ CHART + SAÚDE OPERACIONAL ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-fade-in stagger-2">
        {/* Performance chart */}
        <div className="lg:col-span-8 rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-bold text-foreground">Performance de Receita</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Série temporal de vendas aprovadas.</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Acumulado</p>
              <p className="text-xl md:text-2xl font-display font-black text-foreground">{fmt(revenue)}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={11} />
              <YAxis tickLine={false} axisLine={false} width={54} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={11} tickFormatter={(v) => `R$${v}`} />
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
                cursor={{ stroke: "hsl(var(--primary) / 0.12)", strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="vendas"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#revGrad)"
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Saúde Operacional */}
        <div className="lg:col-span-4 rounded-2xl border border-border bg-card p-5 md:p-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-5">Saúde Operacional</h3>
          <div className="space-y-4">
            <HealthRow icon={<CheckCircle2 />} label="Aprovadas" value={approved.length} color="success" />
            <HealthRow icon={<AlertCircle />} label="Pendentes" value={pending.length} color="warning" />
            <HealthRow icon={<ArrowUpRight />} label="Reembolsos" value={refunded.length} color="info" />
            <HealthRow icon={<ShieldCheck />} label="Chargebacks" value={chargebacks.length} color="destructive" />
          </div>

          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">Conv. PIX</span>
              <span className="text-xs font-bold text-primary">
                {filteredTx.filter(t => t.payment_method === "pix").length > 0
                  ? `${((filteredTx.filter(t => t.payment_method === "pix" && t.status === "completed").length / filteredTx.filter(t => t.payment_method === "pix").length) * 100).toFixed(0)}%`
                  : "0%"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
              {(() => {
                const pixAll = filteredTx.filter(t => t.payment_method === "pix");
                const pixOk = pixAll.filter(t => t.status === "completed").length;
                const pct = pixAll.length > 0 ? (pixOk / pixAll.length) * 100 : 0;
                return <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.max(pct, 1)}%` }} />;
              })()}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Sub-components ─── */

function SecondaryKpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5 transition-all hover:border-primary/15 hover:shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted/50 [&>svg]:h-4 [&>svg]:w-4 text-muted-foreground">
          {icon}
        </div>
      </div>
      <p className="text-xl md:text-2xl font-display font-black tracking-tight text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function HealthRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-${color}/10 [&>svg]:h-4 [&>svg]:w-4 text-${color}`}>
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}
