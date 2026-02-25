import { useEffect, useMemo, useState, useCallback } from "react";
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
  Flame,
  GraduationCap,
  Layers,
  Lock,
  Package,
  RefreshCw,
  Rocket,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
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
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>(PERIOD_OPTIONS[0]); // Default: Hoje
  const [products, setProducts] = useState(0);
  const [scaleMode, setScaleMode] = useState(false);
  const [showScalePopup, setShowScalePopup] = useState(false);
  const [fireEffect, setFireEffect] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> & { nickname?: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    ]).then(([txRes, wdRes, prodRes, profileRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (wdRes.data) setWithdrawals(wdRes.data);
      if (prodRes.count != null) setProducts(prodRes.count);
      if (profileRes.data) setProfile(profileRes.data as any);
    });
  }, [user?.id]);

  // Auto-activate scale mode when daily revenue >= 2000
  const todayRevenue = useMemo(() => {
    const todayStr = brasiliaToday().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return transactions
      .filter((t) => t.status === "completed" && toBrasiliaDate(t.created_at) === todayStr)
      .reduce((acc, t) => acc + Number(t.net_amount), 0);
  }, [transactions]);

  useEffect(() => {
    if (todayRevenue >= 2000 && !scaleMode) {
      setFireEffect(true);
      setTimeout(() => {
        setShowScalePopup(true);
        setScaleMode(true);
      }, 800);
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

  // Payment method metrics
  const pixTx = filteredTx.filter((t) => t.payment_method === "pix");
  const cardTx = filteredTx.filter((t) => t.payment_method === "credit_card" || t.payment_method === "cartao");
  const boletoTx = filteredTx.filter((t) => t.payment_method === "boleto");

  const pixApproved = pixTx.filter((t) => t.status === "completed");
  const cardApproved = cardTx.filter((t) => t.status === "completed");
  const boletoApproved = boletoTx.filter((t) => t.status === "completed");

  const pixRevenue = pixApproved.reduce((a, t) => a + Number(t.net_amount), 0);
  const cardRevenue = cardApproved.reduce((a, t) => a + Number(t.net_amount), 0);
  const boletoRevenue = boletoApproved.reduce((a, t) => a + Number(t.net_amount), 0);

  const pixConversion = pixTx.length > 0 ? (pixApproved.length / pixTx.length) * 100 : 0;
  const cardConversion = cardTx.length > 0 ? (cardApproved.length / cardTx.length) * 100 : 0;
  const boletoConversion = boletoTx.length > 0 ? (boletoApproved.length / boletoTx.length) * 100 : 0;

  const totalSales = filteredTx.length;
  const withdrawalPending = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((acc, w) => acc + Number(w.net_amount), 0);
  const withdrawalPendingCount = withdrawals.filter(w => w.status === "pending").length;

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

  const displayName = (profile as any)?.nickname || profile?.full_name?.split(" ")[0] || user?.user_metadata?.nickname || user?.user_metadata?.full_name?.split(" ")[0] || "Seller";

  return (
    <div className="space-y-5 md:space-y-6 relative">
      {/* ─── GREEN FIRE BORDER EFFECT ─── */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 left-0 h-48 w-48 bg-primary/30 blur-[60px] rounded-full" />
          <div className="absolute top-0 right-0 h-48 w-48 bg-primary/30 blur-[60px] rounded-full" />
          <div className="absolute bottom-0 left-0 h-48 w-48 bg-primary/30 blur-[60px] rounded-full" />
          <div className="absolute bottom-0 right-0 h-48 w-48 bg-primary/30 blur-[60px] rounded-full" />
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-primary/60"
              style={{
                width: `${Math.random() * 6 + 2}px`,
                height: `${Math.random() * 6 + 2}px`,
                left: `${Math.random() * 100}%`,
                bottom: `${Math.random() * 30}%`,
                animation: `fireParticle ${1 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      {/* ─── SCALE MODE POPUP ─── */}
      {showScalePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" onClick={() => setShowScalePopup(false)} />
          <div className="relative w-full max-w-md rounded-3xl border-2 border-primary/40 bg-card shadow-2xl shadow-primary/20 animate-scale-in overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-primary/5 pointer-events-none" />
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/20 blur-[80px]" />
            <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-primary/20 blur-[80px]" />
            
            <button
              onClick={() => setShowScalePopup(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted z-10"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="relative p-8 md:p-10 text-center">
              <div className="mx-auto mb-6 h-24 w-24 rounded-full bg-primary/15 flex items-center justify-center ring-4 ring-primary/10">
                <Rocket className="h-12 w-12 text-primary" />
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/25 px-4 py-1.5 mb-5">
                <Flame className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Modo Escala Ativado</span>
              </div>

              <h2 className="text-2xl md:text-3xl font-display font-black text-foreground mb-4 leading-tight">
                MODO ESCALA<br />
                <span className="text-gradient">ATIVADO! 🔥</span>
              </h2>

              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed mb-6">
                <p className="font-bold text-foreground text-base">
                  AGORA É SANGUE NOS OLHOS! 💪
                </p>
                <p>
                  O futuro de luxo já está lá, falta <strong className="text-foreground">VOCÊ</strong> alcançar — e sabemos que irá conseguir!
                </p>
                <p>
                  E estaremos <strong className="text-primary">juntos com você</strong> nessa jornada!
                </p>
              </div>

              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground mb-1">Suporte Prioritário Ativado</p>
                    <p className="text-xs text-muted-foreground">
                      No Modo Escala, o suporte e a fluidez da plataforma estarão 100% disponíveis para você. 
                      Qualquer ajuda para escalar que precisar, pode nos chamar!
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-lg font-display font-black text-primary mb-6">
                RUMO À LUA! 🚀🌙
              </p>

              <button
                onClick={() => setShowScalePopup(false)}
                className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                BORA ESCALAR! 🔥
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden rounded-2xl md:rounded-3xl border-2 border-border bg-card backdrop-blur-xl p-4 md:p-8 animate-fade-in shadow-lg">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-primary/15 blur-[90px]" />
          <div className="absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-info/10 blur-[110px]" />
        </div>

        <div className="relative z-10 space-y-5 md:space-y-6">
          {/* Title row */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] uppercase text-primary">
                <Sparkles className="h-3 w-3" /> Dashboard De Infoprodutor
              </div>
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-display font-black tracking-tight leading-[1.1] text-foreground">
                Olá, <span className="text-primary">{displayName}</span> 👋
              </h1>
              <p className="hidden md:block max-w-xl text-sm text-muted-foreground leading-relaxed">
                Cockpit premium para monitorar vendas, performance e ajudar em suas métricas.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              {/* Scale Mode Button - locked until 2k daily */}
              <div className="relative">
                {!scaleMode && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
                    <span className="text-[8px] font-bold text-muted-foreground bg-muted/80 backdrop-blur px-2 py-0.5 rounded-md border border-border">
                      Ativa ao atingir R$ 2K em 24h
                    </span>
                  </div>
                )}
                <button
                  disabled={!scaleMode}
                  className={`flame-btn group relative inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-all ${
                    scaleMode
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "border border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-60"
                  }`}
                >
                  {scaleMode && [0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="flame-tip"
                      style={{
                        left: `${20 + i * 15}%`,
                        width: `${3 + Math.random() * 3}px`,
                        height: `${3 + Math.random() * 3}px`,
                        ['--dur' as string]: `${0.6 + i * 0.15}s`,
                        ['--delay' as string]: `${i * 0.12}s`,
                      }}
                    />
                  ))}
                  {scaleMode ? (
                    <Flame className="h-4 w-4 animate-pulse" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{scaleMode ? "Modo Escala 🔥" : "Modo Escala"}</span>
                  <span className="sm:hidden">{scaleMode ? "🔥" : "Escala"}</span>
                </button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-border bg-card px-3.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary/25">
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
          </div>

          {/* Hero metrics */}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
            <MiniHeroCard icon={<DollarSign className="h-4 w-4" />} label="Receita Líquida" value={fmt(revenue)} tone="primary" />
            <MiniHeroCard icon={<ShoppingCart className="h-4 w-4" />} label="Total de Vendas" value={String(totalSales)} tone="info" />
            <MiniHeroCard icon={<Target className="h-4 w-4" />} label="Conversão Geral" value={`${conversion.toFixed(1)}%`} tone="success" />
            <MiniHeroCard icon={<Wallet className="h-4 w-4" />} label="Saques Aguardando" value={fmt(withdrawalPending)} sub={`${withdrawalPendingCount} solicitações`} tone="warning" />
          </div>
        </div>
      </section>

      {/* ─── KPI TILES ─── */}
      <section className="grid grid-cols-2 gap-2.5 md:gap-4 md:grid-cols-4">
        <KpiTile icon={<Wallet className="h-5 w-5" />} label="Ticket Médio" value={fmt(ticket)} helper="Valor médio por transação aprovada" tone="info" delay="stagger-1" />
        <KpiTile icon={<RefreshCw className="h-5 w-5" />} label="Pendentes" value={String(pending.length)} helper="Transações aguardando pagamento" tone="warning" delay="stagger-2" />
        <KpiTile icon={<ShoppingCart className="h-5 w-5" />} label="Aprovadas" value={String(approved.length)} helper="Vendas confirmadas no período" tone="success" delay="stagger-3" />
        <KpiTile icon={<ArrowDownRight className="h-5 w-5" />} label="Saques Aguard." value={fmt(withdrawalPending)} helper={`${withdrawalPendingCount} solicitações`} tone="primary" delay="stagger-4" />
      </section>

      {/* ─── PAYMENT METHOD METRICS ─── */}
      <section className="grid grid-cols-1 gap-2.5 md:gap-4 md:grid-cols-3">
        <PaymentMethodCard
          method="PIX"
          icon="💠"
          generated={pixTx.length}
          paid={pixApproved.length}
          revenue={pixRevenue}
          conversion={pixConversion}
          tone="primary"
        />
        <PaymentMethodCard
          method="Cartão"
          icon="💳"
          generated={cardTx.length}
          paid={cardApproved.length}
          revenue={cardRevenue}
          conversion={cardConversion}
          tone="info"
        />
        <PaymentMethodCard
          method="Boleto"
          icon="📄"
          generated={boletoTx.length}
          paid={boletoApproved.length}
          revenue={boletoRevenue}
          conversion={boletoConversion}
          tone="warning"
        />
      </section>

      {/* ─── CHART + HEALTH ─── */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8 rounded-2xl border-2 border-border bg-card backdrop-blur-xl p-4 md:p-6 animate-fade-in stagger-2 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base md:text-lg font-display font-black text-foreground">Performance de Receita</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Receita líquida aprovada no período</p>
            </div>
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-primary font-bold">Total</p>
              <p className="text-base md:text-lg font-display font-black text-foreground">{fmt(revenue)}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
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
                strokeWidth={2.5}
                fill="url(#dashboardRevenue)"
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="xl:col-span-4 space-y-3">
          <div className="rounded-2xl border-2 border-border bg-card backdrop-blur-xl p-4 md:p-5 animate-fade-in stagger-3 shadow-sm">
            <h3 className="text-[11px] font-display font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">Saúde Operacional</h3>
            <div className="space-y-2">
              <QualityLine icon={<ShoppingCart className="h-4 w-4" />} label="Aprovadas" value={String(approved.length)} tone="success" />
              <QualityLine icon={<Clock3 className="h-4 w-4" />} label="Pendentes" value={String(pending.length)} tone="warning" />
              <QualityLine icon={<RefreshCw className="h-4 w-4" />} label="Reembolsos" value={String(refunded.length)} tone="info" />
              <QualityLine icon={<AlertTriangle className="h-4 w-4" />} label="Chargebacks" value={String(chargebacks.length)} tone="destructive" />
            </div>
          </div>

          <div className="rounded-2xl border-2 border-border bg-card backdrop-blur-xl p-4 md:p-5 animate-fade-in stagger-4 shadow-sm">
            <h3 className="text-[11px] font-display font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">Snapshot</h3>
            <div className="grid grid-cols-2 gap-2">
              <SmallMetric icon={<Package className="h-4 w-4" />} label="Produtos" value={String(products)} />
              <SmallMetric icon={<CreditCard className="h-4 w-4" />} label="Checkouts" value={String(filteredTx.length)} />
              <SmallMetric icon={<GraduationCap className="h-4 w-4" />} label="Cursos" value={String(products)} />
            </div>
          </div>
        </div>
      </section>

      {/* ─── ACTIONS + ACTIVITY ─── */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Quick actions */}
        <div className="rounded-2xl border-2 border-border bg-card backdrop-blur-xl p-4 md:p-6 animate-fade-in stagger-3 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-base md:text-lg font-display font-black text-foreground">Ações Rápidas</h3>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {[
              { label: "Criar Produto", href: "/vendas/produtos", icon: Package, desc: "Novo infoproduto" },
              { label: "Conteúdo", href: "/vendas/conteudo", icon: Layers, desc: "Módulos e aulas" },
              { label: "Checkout", href: "/vendas/checkout", icon: CreditCard, desc: "Links de pagamento" },
              { label: "Vendas", href: "/vendas", icon: BarChart3, desc: "Relatório" },
              { label: "Extrato", href: "/financeiro/extrato", icon: Activity, desc: "Fluxo financeiro" },
              { label: "Saques", href: "/financeiro/saques", icon: ArrowDownRight, desc: "Transferir saldo" },
            ].map((action, i) => (
              <Link
                key={action.href}
                to={action.href}
                className={`group flex items-center gap-3 rounded-xl border-2 border-border bg-muted/20 p-3 md:p-4 transition-all hover:border-primary/25 hover:bg-muted/40 animate-fade-in ${STAGGER_CLASSES[i]}`}
              >
                <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <action.icon className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <div className="min-w-0 flex-1 hidden md:block">
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
                  <p className="text-[11px] text-muted-foreground">{action.desc}</p>
                </div>
                <div className="min-w-0 flex-1 md:hidden">
                  <p className="text-[12px] font-semibold text-foreground leading-tight">{action.label}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 hidden md:block" />
              </Link>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="rounded-2xl border-2 border-border bg-card backdrop-blur-xl p-4 md:p-6 animate-fade-in stagger-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-base md:text-lg font-display font-black text-foreground">Atividade Recente</h3>
            </div>
            <Link to="/financeiro/extrato" className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:gap-1.5 transition-all">
              Ver tudo <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-0.5">
            {activity.length === 0 ? (
              <div className="rounded-xl border-2 border-border bg-muted/20 px-4 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">Nenhuma atividade</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Movimentações aparecerão aqui.</p>
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
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/30 animate-fade-in ${
                      STAGGER_CLASSES[i + 1] || ""
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${styles.icon}`}>
                      {item.kind === "transaction" ? <DollarSign className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground">{fmt(item.amount)}</p>
                        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${styles.pill}`}>{styles.label}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{item.kind === "transaction" ? `Venda • ${item.label}` : item.label}</p>
                    </div>

                    <span className="text-[11px] font-medium text-muted-foreground shrink-0">{timeAgo(item.createdAt)}</span>
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

/* ─── Sub-components ─── */

type Tone = "primary" | "info" | "success" | "warning";

const toneMap: Record<Tone, { bg: string; text: string; border: string }> = {
  primary: { bg: "bg-primary/12", text: "text-primary", border: "border-primary/20" },
  info: { bg: "bg-info/12", text: "text-info", border: "border-info/20" },
  success: { bg: "bg-success/12", text: "text-success", border: "border-success/20" },
  warning: { bg: "bg-warning/12", text: "text-warning", border: "border-warning/20" },
};

function MiniHeroCard({ icon, label, value, tone, sub }: { icon: React.ReactNode; label: string; value: string; tone: Tone; sub?: string }) {
  return (
    <div className={`rounded-xl border-2 ${toneMap[tone].border} bg-card p-3 shadow-sm`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${toneMap[tone].bg}`}>
          <span className={toneMap[tone].text}>{icon}</span>
        </div>
        <span className="text-[11px] uppercase tracking-[0.12em] text-foreground/70 font-bold">{label}</span>
      </div>
      <p className="text-xl md:text-2xl font-display font-black tracking-tight text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function KpiTile({ icon, label, value, helper, tone, delay }: { icon: React.ReactNode; label: string; value: string; helper: string; tone: Tone; delay?: string }) {
  return (
    <div className={`rounded-2xl border-2 ${toneMap[tone].border} bg-card backdrop-blur-xl p-4 md:p-5 hover:shadow-md transition-all animate-fade-in shadow-sm ${delay || ""}`}>
      <div className="mb-2 md:mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] text-foreground/70 font-bold">{label}</span>
        <div className={`h-9 w-9 md:h-10 md:w-10 rounded-xl flex items-center justify-center ${toneMap[tone].bg}`}>
          <span className={toneMap[tone].text}>{icon}</span>
        </div>
      </div>
      <p className="text-xl md:text-2xl font-display font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-[10px] md:text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
}

function PaymentMethodCard({ method, icon, generated, paid, revenue, conversion, tone }: {
  method: string; icon: string; generated: number; paid: number; revenue: number; conversion: number; tone: Tone;
}) {
  return (
    <div className={`rounded-2xl border-2 ${toneMap[tone].border} bg-card p-4 md:p-5 animate-fade-in shadow-sm`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-display font-bold text-foreground">{method}</span>
        <span className={`ml-auto rounded-lg px-2 py-0.5 text-[10px] font-bold ${toneMap[tone].bg} ${toneMap[tone].text}`}>
          {conversion.toFixed(1)}%
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[12px]">
          <span className="text-muted-foreground">Gerados</span>
          <span className="font-bold text-foreground">{generated}</span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-muted-foreground">Pagos</span>
          <span className="font-bold text-primary">{paid}</span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-muted-foreground">Receita</span>
          <span className="font-bold text-foreground">{fmt(revenue)}</span>
        </div>
      </div>
      {/* Mini progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${tone === "primary" ? "from-primary/80 to-primary" : tone === "info" ? "from-info/80 to-info" : "from-warning/80 to-warning"}`} style={{ width: `${Math.min(conversion, 100)}%` }} />
      </div>
    </div>
  );
}

function QualityLine({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "success" | "warning" | "destructive" | "info" }) {
  const styles: Record<string, { bg: string; text: string }> = {
    success: { bg: "bg-success/10", text: "text-success" },
    warning: { bg: "bg-warning/10", text: "text-warning" },
    destructive: { bg: "bg-destructive/10", text: "text-destructive" },
    info: { bg: "bg-info/10", text: "text-info" },
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-border bg-muted/20 px-3 py-2.5">
      <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${styles[tone].bg} ${styles[tone].text}`}>{icon}</div>
      <span className="flex-1 text-[12px] font-semibold text-foreground/80">{label}</span>
      <span className="text-[14px] font-black text-foreground">{value}</span>
    </div>
  );
}

function SmallMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-border bg-muted/20 p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm md:text-base font-display font-black text-foreground">{value}</p>
    </div>
  );
}
