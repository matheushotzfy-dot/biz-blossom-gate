import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions, useWithdrawals, useProducts as useProductsQuery } from "@/hooks/useQueryData";
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
  Percent,
  FileText,
  Webhook,
  User,
  BookOpen,
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

// Cache date string conversion to avoid repeated Intl calls
const _brasiliaDateCache = new Map<string, string>();
function toBrasiliaDate(dateStr: string) {
  let cached = _brasiliaDateCache.get(dateStr);
  if (!cached) {
    cached = new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    _brasiliaDateCache.set(dateStr, cached);
    // Keep cache bounded
    if (_brasiliaDateCache.size > 2000) {
      const first = _brasiliaDateCache.keys().next().value;
      if (first) _brasiliaDateCache.delete(first);
    }
  }
  return cached;
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
  const { profile } = useProfile();
  const { data: transactions = [], refetch: refetchTx } = useTransactions();
  const { data: withdrawals = [] } = useWithdrawals(10);
  const { data: productsData } = useProductsQuery();
  const products = productsData?.length ?? 0;
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>(PERIOD_OPTIONS[0]);
  const [scaleMode, setScaleMode] = useState(false);
  const [scaleModeUnlocked, setScaleModeUnlocked] = useState(false);
  const [showScalePopup, setShowScalePopup] = useState(false);
  const [fireEffect, setFireEffect] = useState(false);

  // Realtime subscription for transactions
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('dashboard-transactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
        () => { refetchTx(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'withdrawals', filter: `user_id=eq.${user.id}` },
        () => { refetchTx(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refetchTx]);

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

  // Memoize all derived metrics to avoid recomputing on every render
  const { approved, pending, refunded, chargebacks, revenue, conversion, pixConversion, cardConversion, chargebackRate } = useMemo(() => {
    const _approved = filteredTx.filter((t) => t.status === "completed");
    const _pending = filteredTx.filter((t) => t.status === "pending");
    const _refunded = filteredTx.filter((t) => t.status === "refunded");
    const _chargebacks = filteredTx.filter((t) => t.status === "chargeback");

    const _revenue = _approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const _conversion = filteredTx.length > 0 ? (_approved.length / filteredTx.length) * 100 : 0;

    const pixTx = filteredTx.filter(t => t.payment_method === "pix");
    const pixApproved = pixTx.filter(t => t.status === "completed");
    const _pixConversion = pixTx.length > 0 ? (pixApproved.length / pixTx.length) * 100 : 0;

    const cardTx = filteredTx.filter(t => t.payment_method === "credit_card" || t.payment_method === "card");
    const cardApproved = cardTx.filter(t => t.status === "completed");
    const _cardConversion = cardTx.length > 0 ? (cardApproved.length / cardTx.length) * 100 : 0;

    const _chargebackRate = filteredTx.length > 0 ? (_chargebacks.length / filteredTx.length) * 100 : 0;

    return {
      approved: _approved, pending: _pending, refunded: _refunded, chargebacks: _chargebacks,
      revenue: _revenue, conversion: _conversion,
      pixConversion: _pixConversion, cardConversion: _cardConversion, chargebackRate: _chargebackRate,
    };
  }, [filteredTx]);

  const [balanceAdjustments, setBalanceAdjustments] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("balance_adjustments").select("amount, type").eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          const adj = data.reduce((acc, a) => acc + (a.type === "credit" ? Number(a.amount) : -Number(a.amount)), 0);
          setBalanceAdjustments(adj);
        }
      });
  }, [user?.id]);

  const { withdrawalPending, balance } = useMemo(() => {
    const _withdrawalPending = withdrawals
      .filter((w) => w.status === "pending")
      .reduce((acc, w) => acc + Number(w.net_amount), 0);

    const totalRevenue = transactions
      .filter(t => t.status === "completed")
      .reduce((acc, t) => acc + Number(t.net_amount), 0);
    const totalWithdrawn = withdrawals
      .filter(w => w.status === "approved" || w.status === "pending")
      .reduce((acc, w) => acc + Number(w.amount), 0);
    const totalChargebacksRefunds = transactions
      .filter(t => t.status === "chargeback" || t.status === "refunded")
      .reduce((acc, t) => acc + Number(t.net_amount), 0);
    const totalRetained = transactions
      .filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0)
      .reduce((acc, t) => acc + Number(t.retained_amount), 0);

    return { withdrawalPending: _withdrawalPending, balance: totalRevenue + balanceAdjustments - totalWithdrawn - totalChargebacksRefunds - totalRetained };
  }, [transactions, withdrawals, balanceAdjustments]);

  // Optimized chart: pre-index transactions by date to avoid O(N*M)
  const chartData = useMemo(() => {
    const days = Math.max(selectedPeriod.days <= 1 ? 7 : selectedPeriod.days, 1);

    // Pre-index completed transactions by date string
    const revenueByDate = new Map<string, number>();
    for (const t of transactions) {
      if (t.status !== "completed") continue;
      const dateKey = toBrasiliaDate(t.created_at);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(t.net_amount));
    }

    return Array.from({ length: days }, (_, i) => {
      const d = new Date(brasiliaToday());
      d.setDate(d.getDate() - (days - 1 - i));

      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const compare = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

      return { name: label, vendas: revenueByDate.get(compare) || 0 };
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

  // Check if scale mode was already unlocked (persisted per-session)
  useEffect(() => {
    if (!user?.id) return;
    const key = `scale_mode_unlocked_${user.id}`;
    if (sessionStorage.getItem(key) === "true") {
      setScaleModeUnlocked(true);
      setScaleMode(true);
    }
  }, [user?.id]);

  // Auto-unlock scale mode when seller hits R$2k in last 24h
  useEffect(() => {
    if (!user?.id || scaleModeUnlocked) return;
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const revenue24h = transactions
      .filter(tx => tx.status === "completed" && new Date(tx.created_at) >= last24h)
      .reduce((acc, tx) => acc + Number(tx.net_amount), 0);

    if (revenue24h >= 2000) {
      sessionStorage.setItem(`scale_mode_unlocked_${user.id}`, "true");
      setScaleModeUnlocked(true);
      setFireEffect(true);
      setTimeout(() => {
        setShowScalePopup(true);
        setScaleMode(true);
      }, 800);
      setTimeout(() => setFireEffect(false), 3000);
    }
  }, [user?.id, transactions, scaleModeUnlocked]);

  const activateScaleMode = useCallback(() => {
    if (!scaleModeUnlocked) return;
    setFireEffect(true);
    setTimeout(() => {
      setShowScalePopup(true);
      setScaleMode(true);
    }, 800);
    setTimeout(() => setFireEffect(false), 3000);
  }, [scaleModeUnlocked]);

  const nickname = profile?.nickname || profile?.full_name?.split(" ")[0] || null;

  // Top products from transactions
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const t of filteredTx.filter(tx => tx.status === "completed")) {
      const pid = t.product_id || "unknown";
      const existing = map.get(pid) || { name: pid, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += Number(t.net_amount);
      map.set(pid, existing);
    }
    // Map product names
    const arr = Array.from(map.entries()).map(([id, data]) => {
      const product = (productsData || []).find((p: any) => p.id === id);
      return { id, name: product?.name || "Produto", ...data };
    });
    return arr.sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filteredTx, productsData]);

  return (
    <div className="space-y-5 md:space-y-6 relative">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-primary/8 blur-[150px]" />
        <div className="absolute top-1/4 -right-20 h-72 w-72 rounded-full bg-primary/5 blur-[120px]" />
      {/* ─── GREEN FIRE BORDER EFFECT ─── */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-primary/40 via-primary/10 to-transparent animate-pulse" />
        </div>
      )}

      {/* ─── SCALE MODE POPUP ─── */}
      {showScalePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" onClick={() => setShowScalePopup(false)} />
          <div className="relative w-full max-w-md rounded-3xl border-2 border-primary/40 bg-card shadow-2xl shadow-primary/20 animate-scale-in overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-primary/5 pointer-events-none" />
            <button onClick={() => setShowScalePopup(false)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted z-10">
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
                MODO ESCALA<br /><span className="text-gradient">ATIVADO! 🔥</span>
              </h2>
              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed mb-6">
                <p className="font-bold text-foreground text-base">AGORA É SANGUE NOS OLHOS! 💪</p>
                <p>O futuro de luxo já está lá, falta <strong className="text-foreground">VOCÊ</strong> alcançar!</p>
                <p>E estaremos <strong className="text-primary">juntos com você</strong> nessa jornada!</p>
              </div>
              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground mb-1">Suporte Prioritário Ativado</p>
                    <p className="text-xs text-muted-foreground">No Modo Escala, o suporte e a fluidez da plataforma estarão 100% disponíveis para você.</p>
                  </div>
                </div>
              </div>
              <p className="text-lg font-display font-black text-primary mb-6">RUMO À LUA! 🚀🌙</p>
              <button onClick={() => setShowScalePopup(false)} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                BORA ESCALAR! 🔥
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── HEADER ROW ─── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-foreground">
            {nickname ? (
              <>Bem Vindo, <span className="text-primary">{nickname}</span></>
            ) : (
              <span className="inline-block w-48 h-8 rounded-xl bg-muted/30 animate-pulse" />
            )}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">Visão geral da sua operação</p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {scaleModeUnlocked ? (
            <button
              onClick={activateScaleMode}
              className={`group relative inline-flex h-9 md:h-10 items-center gap-1.5 md:gap-2 rounded-xl px-3 md:px-4 text-xs md:text-sm font-bold transition-all ${
                scaleMode
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              <Flame className={`h-3.5 w-3.5 md:h-4 md:w-4 ${scaleMode ? "animate-pulse" : "group-hover:animate-pulse"}`} />
              <span>{scaleMode ? "Modo Escala 🔥" : "Modo Escala"}</span>
            </button>
          ) : (
            <div className="group relative inline-flex h-9 md:h-10 items-center gap-1.5 md:gap-2 rounded-xl px-3 md:px-4 text-xs md:text-sm font-bold border border-primary/30 bg-primary/10 text-primary cursor-not-allowed">
              <Lock className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span>Modo Escala</span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-60 rounded-xl bg-card border border-border p-3 text-center shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                <p className="text-[11px] font-bold text-foreground mb-1">🔒 Modo Escala Bloqueado</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Liberado automaticamente ao atingir R$ 2.000 em 24h.</p>
              </div>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-9 md:h-10 items-center gap-1.5 md:gap-2 rounded-xl border border-border/80 bg-card px-3 md:px-3.5 text-xs md:text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary/25">
                <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                {selectedPeriod.label}
                <ChevronDown className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground" />
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

      {/* ─── KPI BENTO CARDS ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <FintechKpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Receita Líquida"
          value={fmt(revenue)}
          trend={approved.length > 0 ? "+15% vs ontem" : "0%"}
          trendUp={approved.length > 0}
          tone="primary"
        />
        <FintechKpiCard
          icon={<ShoppingCart className="h-5 w-5" />}
          label="Vendas Aprovadas"
          value={String(approved.length)}
          trend={`${pending.length} pendentes`}
          trendUp={true}
          tone="primary"
        />
        <FintechKpiCard
          icon={<Target className="h-5 w-5" />}
          label="Conversão"
          value={`${conversion.toFixed(1)}%`}
          trend={`${filteredTx.length} transações`}
          trendUp={conversion >= 50}
          tone="primary"
        />
        <FintechKpiCard
          icon={<Wallet className="h-5 w-5" />}
          label="Saldo Disponível"
          value={`${balance < 0 ? "- " : ""}${fmt(Math.abs(balance))}`}
          trend={`${withdrawals.filter(w => w.status === "pending").length} saques pendentes`}
          trendUp={balance > 0}
          tone={balance >= 0 ? "primary" : "warning"}
        />
      </div>

      {/* ─── CHART + OPERATIONAL SNAPSHOT ─── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Chart */}
        <div className="xl:col-span-8 rounded-2xl border border-primary/10 bg-card backdrop-blur-md p-4 md:p-6 shadow-xl shadow-primary/5 min-h-[320px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Performance de Receita</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Evolução no período selecionado</p>
            </div>
            <div className="text-right">
              <p className="text-2xl md:text-3xl font-black tracking-tighter text-foreground">{fmt(revenue)}</p>
              <p className="text-[11px] text-primary font-semibold">{selectedPeriod.label}</p>
            </div>
          </div>
          <div className="h-[220px] md:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={11} interval={chartData.length > 10 ? Math.ceil(chartData.length / 8) - 1 : 0} />
                <YAxis tickLine={false} axisLine={false} width={58} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={11} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--primary) / 0.2)",
                    borderRadius: "12px",
                    fontSize: "13px",
                    color: "hsl(var(--foreground))",
                    padding: "10px 14px",
                    boxShadow: "0 8px 30px hsl(var(--primary) / 0.1)",
                  }}
                  formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]}
                  cursor={{ stroke: "hsl(var(--primary) / 0.3)", strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="vendas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fill="url(#dashboardRevenue)"
                  dot={false}
                  activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>

        {/* Operational Snapshot */}
        <div className="xl:col-span-4 space-y-4">
          <div className="rounded-2xl border border-primary/10 bg-card backdrop-blur-md p-4 md:p-5 shadow-xl shadow-primary/5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary/60 mb-3">Operacional</h4>
            <div className="space-y-2.5">
              <OperationalRow icon={<Percent className="h-4 w-4" />} label="Conv. PIX" value={`${pixConversion.toFixed(1)}%`} tone="primary" />
              <OperationalRow icon={<CreditCard className="h-4 w-4" />} label="Conv. Cartão" value={`${cardConversion.toFixed(1)}%`} tone="primary" />
              <OperationalRow icon={<AlertTriangle className="h-4 w-4" />} label="Chargeback" value={`${chargebackRate.toFixed(2)}%`} tone={chargebackRate > 1 ? "destructive" : "primary"} />
            </div>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-card backdrop-blur-md p-4 md:p-5 shadow-xl shadow-primary/5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary/60 mb-3">Resumo</h4>
            <div className="space-y-2.5">
              <OperationalRow icon={<Wallet className="h-4 w-4" />} label="Ticket Médio" value={fmt(approved.length > 0 ? revenue / approved.length : 0)} tone="primary" />
              <OperationalRow icon={<RefreshCw className="h-4 w-4" />} label="Reembolsos" value={String(refunded.length)} tone="info" />
              <OperationalRow icon={<ArrowDownRight className="h-4 w-4" />} label="Chargebacks" value={String(chargebacks.length)} tone={chargebacks.length > 0 ? "destructive" : "primary"} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM GRID: TOP PRODUCTS + LATEST SALES ─── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Top Products */}
        <div className="rounded-2xl border border-border/60 bg-card backdrop-blur-md p-4 md:p-6 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Top Produtos</h3>
            </div>
            <Link to="/vendas/produtos" className="text-[11px] font-semibold text-primary hover:underline">Ver todos</Link>
          </div>

          {topProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Nenhuma venda no período</p>
            </div>
          ) : (
            <div className="space-y-1">
              {topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/30">
                  <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-xs font-black text-foreground shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.count} vendas</p>
                  </div>
                  <p className="text-sm font-black text-foreground">{fmt(p.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Sales */}
        <div className="rounded-2xl border border-border/60 bg-card backdrop-blur-md p-4 md:p-6 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-info" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Últimas Vendas</h3>
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" title="Tempo real" />
            </div>
            <Link to="/financeiro/extrato" className="text-[11px] font-semibold text-primary hover:underline">
              Ver tudo
            </Link>
          </div>

          <div className="space-y-0.5">
            {activity.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Nenhuma atividade</p>
              </div>
            ) : (
              activity.map((item) => {
                const statusConfig: Record<string, { label: string; pill: string }> = {
                  completed: { label: "Aprovada", pill: "bg-success/15 text-success" },
                  pending: { label: "Pendente", pill: "bg-warning/15 text-warning" },
                  failed: { label: "Falhou", pill: "bg-destructive/15 text-destructive" },
                  refunded: { label: "Reembolso", pill: "bg-info/15 text-info" },
                  chargeback: { label: "Chargeback", pill: "bg-destructive/15 text-destructive" },
                  approved: { label: "Aprovado", pill: "bg-success/15 text-success" },
                  rejected: { label: "Rejeitado", pill: "bg-destructive/15 text-destructive" },
                };
                const config = statusConfig[item.status] || { label: item.status, pill: "bg-muted text-foreground" };

                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/30">
                    <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                      {item.kind === "transaction" ? <DollarSign className="h-4 w-4 text-foreground/60" /> : <Wallet className="h-4 w-4 text-foreground/60" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground">{fmt(item.amount)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${config.pill}`}>{config.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{item.kind === "transaction" ? `Venda • ${item.label}` : item.label}</p>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground shrink-0">{timeAgo(item.createdAt)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ─── QUICK ACTIONS ─── */}
      <div className="rounded-2xl border border-border/60 bg-card backdrop-blur-md p-4 md:p-6 shadow-xl shadow-black/10">
        <div className="mb-3 md:mb-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Ações Rápidas</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
          {[
            { label: "Criar Produto", href: "/vendas/produtos", icon: Package },
            { label: "Conteúdo", href: "/vendas/conteudo", icon: Layers },
            { label: "Vendas", href: "/vendas", icon: BarChart3 },
            { label: "Extrato", href: "/financeiro/extrato", icon: FileText },
            { label: "Saques", href: "/financeiro/saques", icon: ArrowDownRight },
            { label: "Webhooks", href: "/vendas/webhooks", icon: Webhook },
            { label: "Meu Perfil", href: "/perfil", icon: User },
            { label: "API Docs", href: "/vendas/documentacao", icon: BookOpen },
            { label: "Cursos", href: "/membros", icon: GraduationCap },
            { label: "Checkout", href: "/vendas/checkout", icon: CreditCard },
          ].map((action) => (
            <Link
              key={action.href}
              to={action.href}
              className="group flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/10 p-3 transition-all hover:border-primary/20 hover:bg-muted/30 hover:-translate-y-0.5"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                <action.icon className="h-4 w-4" />
              </div>
              <p className="text-xs md:text-sm font-semibold text-foreground">{action.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Fintech KPI Card ─── */
type Tone = "primary" | "info" | "success" | "warning" | "destructive";

const toneColors: Record<Tone, { iconBg: string; iconText: string; trendText: string }> = {
  success: { iconBg: "bg-success/10", iconText: "text-success", trendText: "text-success" },
  info: { iconBg: "bg-info/10", iconText: "text-info", trendText: "text-info" },
  primary: { iconBg: "bg-primary/10", iconText: "text-primary", trendText: "text-primary" },
  warning: { iconBg: "bg-warning/10", iconText: "text-warning", trendText: "text-warning" },
  destructive: { iconBg: "bg-destructive/10", iconText: "text-destructive", trendText: "text-destructive" },
};

function FintechKpiCard({ icon, label, value, trend, trendUp, tone }: {
  icon: React.ReactNode; label: string; value: string; trend: string; trendUp: boolean; tone: Tone;
}) {
  const colors = toneColors[tone];
  return (
    <div className="rounded-2xl border border-border/60 bg-card backdrop-blur-md p-4 md:p-5 shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:border-primary/15 group">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <span className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground font-bold">{label}</span>
        <div className={`h-8 w-8 md:h-9 md:w-9 rounded-lg flex items-center justify-center ${colors.iconBg} transition-colors`}>
          <span className={colors.iconText}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter text-foreground leading-none mb-1.5">{value}</p>
      <div className="flex items-center gap-1">
        {trendUp ? <ArrowUpRight className={`h-3 w-3 ${colors.trendText}`} /> : <ArrowDownRight className="h-3 w-3 text-muted-foreground" />}
        <span className={`text-[10px] md:text-[11px] font-semibold ${trendUp ? colors.trendText : "text-muted-foreground"}`}>{trend}</span>
      </div>
    </div>
  );
}

function OperationalRow({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: Tone }) {
  const colors = toneColors[tone];
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-muted/10 hover:bg-muted/20 transition-colors">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${colors.iconBg}`}>
        <span className={colors.iconText}>{icon}</span>
      </div>
      <span className="flex-1 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}
