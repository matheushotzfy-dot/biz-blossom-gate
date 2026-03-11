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

const _brasiliaDateCache = new Map<string, string>();
function toBrasiliaDate(dateStr: string) {
  let cached = _brasiliaDateCache.get(dateStr);
  if (!cached) {
    cached = new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    _brasiliaDateCache.set(dateStr, cached);
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

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('dashboard-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => { refetchTx(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: `user_id=eq.${user.id}` }, () => { refetchTx(); })
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

  const chartData = useMemo(() => {
    const days = Math.max(selectedPeriod.days <= 1 ? 7 : selectedPeriod.days, 1);
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
      id: t.id, kind: "transaction" as const, createdAt: t.created_at,
      amount: Number(t.amount), status: t.status, label: t.payment_method || "Pagamento",
    }));
    const wd = withdrawals.slice(0, 5).map((w) => ({
      id: w.id, kind: "withdrawal" as const, createdAt: w.created_at,
      amount: Number(w.amount), status: w.status, label: "Solicitação de saque",
    }));
    return [...tx, ...wd]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [transactions, withdrawals]);

  useEffect(() => {
    if (!user?.id) return;
    const key = `scale_mode_unlocked_${user.id}`;
    if (sessionStorage.getItem(key) === "true") {
      setScaleModeUnlocked(true);
      setScaleMode(true);
    }
  }, [user?.id]);

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
      setTimeout(() => { setShowScalePopup(true); setScaleMode(true); }, 800);
      setTimeout(() => setFireEffect(false), 3000);
    }
  }, [user?.id, transactions, scaleModeUnlocked]);

  const activateScaleMode = useCallback(() => {
    if (!scaleModeUnlocked) return;
    setFireEffect(true);
    setTimeout(() => { setShowScalePopup(true); setScaleMode(true); }, 800);
    setTimeout(() => setFireEffect(false), 3000);
  }, [scaleModeUnlocked]);

  const nickname = profile?.nickname || profile?.full_name?.split(" ")[0] || null;

  return (
    <div className="space-y-5 md:space-y-6 relative">
      {/* ─── GREEN FIRE BORDER EFFECT ─── */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-primary/40 via-primary/10 to-transparent animate-pulse" />
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-primary/60"
              style={{
                width: `${Math.random() * 6 + 2}px`, height: `${Math.random() * 6 + 2}px`,
                left: `${Math.random() * 100}%`, bottom: `${Math.random() * 30}%`,
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
                <p>O futuro de luxo já está lá, falta <strong className="text-foreground">VOCÊ</strong> alcançar — e sabemos que irá conseguir!</p>
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

      {/* ═══════════════════════════════════════════════
          HERO — Signature branded header
      ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card animate-fade-in">
        {/* Signature ambient mesh — unique to HOTZFY */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/[0.08] blur-[80px]" />
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-primary/[0.04] blur-[60px]" />
          <div className="absolute left-1/3 bottom-0 h-32 w-96 bg-gradient-to-r from-primary/[0.03] to-transparent blur-[40px]" />
        </div>
        {/* Subtle grid texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 0.5px, transparent 0)",
          backgroundSize: "24px 24px",
        }} />

        <div className="relative z-10 p-5 md:p-8">
          {/* Title row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.08] px-3 py-1 text-[10px] font-bold tracking-[0.18em] uppercase text-primary">
                <Sparkles className="h-3 w-3" /> Comando
              </div>
              <h1 className="text-2xl md:text-4xl lg:text-[2.75rem] font-display font-black tracking-tight leading-[1.1] text-foreground">
                {nickname ? (
                  <>Bem Vindo, <span className="text-gradient">{nickname}</span></>
                ) : (
                  <span className="inline-block w-48 h-8 md:h-12 rounded-xl bg-muted/30 animate-pulse" />
                )}
              </h1>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
              {scaleModeUnlocked ? (
                <button
                  onClick={activateScaleMode}
                  className={`flame-btn group relative inline-flex h-9 md:h-10 items-center gap-1.5 md:gap-2 rounded-xl px-3 md:px-4 text-xs md:text-sm font-bold transition-all ${
                    scaleMode
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="flame-tip" style={{
                      left: `${20 + i * 15}%`, width: `${3 + Math.random() * 3}px`, height: `${3 + Math.random() * 3}px`,
                      ['--dur' as string]: `${0.6 + i * 0.15}s`, ['--delay' as string]: `${i * 0.12}s`,
                    }} />
                  ))}
                  <Flame className={`h-3.5 w-3.5 md:h-4 md:w-4 ${scaleMode ? "animate-pulse" : "group-hover:animate-pulse"}`} />
                  <span className="leading-tight">{scaleMode ? "Modo Escala 🔥" : "Modo Escala"}</span>
                </button>
              ) : (
                <div className="flame-btn group relative inline-flex h-9 md:h-10 items-center gap-1.5 md:gap-2 rounded-xl px-3 md:px-4 text-xs md:text-sm font-bold border border-primary/30 bg-primary/10 text-primary cursor-not-allowed">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="flame-tip" style={{
                      left: `${20 + i * 15}%`, width: `${3 + Math.random() * 3}px`, height: `${3 + Math.random() * 3}px`,
                      ['--dur' as string]: `${0.6 + i * 0.15}s`, ['--delay' as string]: `${i * 0.12}s`,
                    }} />
                  ))}
                  <Lock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="leading-tight">Modo Escala</span>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-60 rounded-xl bg-card border border-border p-3 text-center shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    <p className="text-[11px] font-bold text-foreground mb-1">🔒 Modo Escala Bloqueado</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Liberado automaticamente ao atingir R$ 2.000 faturados em 24 horas.</p>
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

          {/* ─── HERO KPI STRIP — Signature "glass pill" style ─── */}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
            <HeroKpi icon={<ShoppingCart className="h-4 w-4" />} label="Vendas Realizadas" value={fmt(revenue)} accent="primary" />
            <HeroKpi icon={<TrendingUp className="h-4 w-4" />} label="Qtd. de Vendas" value={String(approved.length)} accent="info" />
            <HeroKpi icon={<Target className="h-4 w-4" />} label="Conversão" value={`${conversion.toFixed(1)}%`} accent="success" />
            <HeroKpi icon={<Wallet className="h-4 w-4" />} label="Saldo" value={`${balance < 0 ? "- " : ""}${fmt(Math.abs(balance))}`} accent={balance < 0 ? "warning" : "primary"} />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          CHART + HEALTH PANEL
      ═══════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-12">
        {/* Chart */}
        <div className="xl:col-span-8 rounded-2xl border border-border/60 bg-card p-4 md:p-6 animate-fade-in stagger-1 min-h-[280px] relative overflow-hidden">
          {/* Chart header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-display font-bold text-foreground">Receita</h3>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">{selectedPeriod.days <= 1 ? "Últimos 7 dias" : `Últimos ${selectedPeriod.days} dias`}</span>
          </div>
          <div className="h-[220px] md:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={11} interval={chartData.length > 10 ? Math.ceil(chartData.length / 8) - 1 : 0} />
                <YAxis tickLine={false} axisLine={false} width={58} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={11} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{
                    background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)",
                    borderRadius: "12px", fontSize: "13px", color: "var(--tooltip-text)",
                    padding: "10px 14px", boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                  }}
                  formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]}
                  cursor={{ stroke: "hsl(var(--primary) / 0.16)", strokeDasharray: "4 4" }}
                />
                <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2.5}
                  fill="url(#dashboardRevenue)" dot={false}
                  activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health sidebar */}
        <div className="xl:col-span-4 space-y-3">
          <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5 animate-fade-in stagger-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-md bg-success/10 flex items-center justify-center">
                <Activity className="h-3 w-3 text-success" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
            </div>
            <div className="space-y-2">
              <HealthRow icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Aprovadas" value={String(approved.length)} color="success" />
              <HealthRow icon={<Clock3 className="h-3.5 w-3.5" />} label="Pendentes" value={String(pending.length)} color="warning" />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5 animate-fade-in stagger-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-md bg-info/10 flex items-center justify-center">
                <Percent className="h-3 w-3 text-info" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Conversão</span>
            </div>
            <div className="space-y-2">
              <ConversionRow label="PIX" value={`${pixConversion.toFixed(1)}%`} pct={pixConversion} />
              <ConversionRow label="Cartão" value={`${cardConversion.toFixed(1)}%`} pct={cardConversion} />
              <ConversionRow label="Chargeback" value={`${chargebackRate.toFixed(2)}%`} pct={chargebackRate} danger />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          KPI TILES
      ═══════════════════════════════════════════════ */}
      <section className="grid grid-cols-2 gap-2.5 md:gap-3 md:grid-cols-4">
        <BentoKpi icon={<Wallet className="h-4 w-4" />} label="Ticket médio" value={fmt(approved.length > 0 ? revenue / approved.length : 0)} sub="Por transação" accent="info" delay="stagger-3" />
        <BentoKpi icon={<DollarSign className="h-4 w-4" />} label="Saldo Pendente" value={fmt(withdrawalPending)} sub={`${withdrawals.filter(w => w.status === "pending").length} solicitações`} accent="warning" delay="stagger-4" />
        <BentoKpi icon={<RefreshCw className="h-4 w-4" />} label="Reembolsos" value={String(refunded.length)} sub="No período" accent="info" delay="stagger-5" />
        <BentoKpi icon={<ArrowDownRight className="h-4 w-4" />} label="Chargebacks" value={String(chargebacks.length)} sub="No período" accent="primary" delay="stagger-6" />
      </section>

      {/* ═══════════════════════════════════════════════
          QUICK ACTIONS + ACTIVITY FEED
      ═══════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-2">
        {/* Quick actions */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 md:p-6 animate-fade-in stagger-3">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/[0.08] flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm md:text-[15px] font-display font-bold text-foreground">Ações Rápidas</h3>
          </div>

          <div className="grid grid-cols-2 gap-1.5 md:gap-2">
            {[
              { label: "Criar Produto", href: "/vendas/produtos", icon: Package, desc: "Novo infoproduto" },
              { label: "Conteúdo", href: "/vendas/conteudo", icon: Layers, desc: "Módulos e aulas" },
              { label: "Checkout", href: "/vendas/checkout", icon: CreditCard, desc: "Links de pagamento" },
              { label: "Vendas", href: "/vendas", icon: BarChart3, desc: "Relatório" },
              { label: "Extrato", href: "/financeiro/extrato", icon: FileText, desc: "Fluxo financeiro" },
              { label: "Saques", href: "/financeiro/saques", icon: ArrowDownRight, desc: "Transferir saldo" },
              { label: "Webhooks", href: "/vendas/webhooks", icon: Webhook, desc: "Automações" },
              { label: "Meu Perfil", href: "/perfil", icon: User, desc: "Dados da conta" },
              { label: "API Docs", href: "/vendas/documentacao", icon: BookOpen, desc: "Documentação" },
              { label: "Cursos", href: "/membros", icon: GraduationCap, desc: "Minhas compras" },
            ].map((action, i) => (
              <Link
                key={action.href}
                to={action.href}
                className={`group flex items-center gap-3 rounded-xl p-3 md:p-3.5 transition-all hover:bg-muted/40 animate-fade-in ${STAGGER_CLASSES[i % STAGGER_CLASSES.length]}`}
              >
                <div className="h-9 w-9 rounded-xl bg-muted/50 text-muted-foreground flex items-center justify-center shrink-0 group-hover:bg-primary/[0.08] group-hover:text-primary transition-colors">
                  <action.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground leading-tight">{action.label}</p>
                  <p className="text-[11px] text-muted-foreground hidden md:block">{action.desc}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 hidden md:block group-hover:text-muted-foreground/50 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 md:p-6 animate-fade-in stagger-4">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/[0.08] flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm md:text-[15px] font-display font-bold text-foreground">Atividade</h3>
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" title="Tempo real" />
            </div>
            <Link to="/financeiro/extrato" className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:gap-1.5 transition-all">
              Ver tudo <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-border/40">
            {activity.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-semibold text-foreground">Nenhuma atividade</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Movimentações aparecerão aqui em tempo real.</p>
              </div>
            ) : (
              activity.map((item, i) => {
                const txStyles: Record<string, { label: string; pill: string; dot: string }> = {
                  completed: { label: "Aprovada", pill: "bg-success/10 text-success", dot: "bg-success" },
                  pending: { label: "Pendente", pill: "bg-warning/10 text-warning", dot: "bg-warning" },
                  failed: { label: "Falhou", pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
                  refunded: { label: "Reembolso", pill: "bg-info/10 text-info", dot: "bg-info" },
                  chargeback: { label: "Chargeback", pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
                  default: { label: "Status", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
                };
                const wdStyles: Record<string, { label: string; pill: string; dot: string }> = {
                  pending: { label: "Em análise", pill: "bg-warning/10 text-warning", dot: "bg-warning" },
                  approved: { label: "Aprovado", pill: "bg-success/10 text-success", dot: "bg-success" },
                  rejected: { label: "Rejeitado", pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
                  default: { label: "Saque", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
                };
                const styles = item.kind === "transaction"
                  ? txStyles[item.status] || txStyles.default
                  : wdStyles[item.status] || wdStyles.default;

                return (
                  <div key={item.id} className={`flex items-center gap-3 py-3 first:pt-0 last:pb-0 animate-fade-in ${STAGGER_CLASSES[i + 1] || ""}`}>
                    <div className={`h-2 w-2 rounded-full shrink-0 ${styles.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-foreground tabular-nums">{fmt(item.amount)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${styles.pill}`}>{styles.label}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{item.kind === "transaction" ? `Venda • ${item.label}` : item.label}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground/70 shrink-0 tabular-nums">{timeAgo(item.createdAt)}</span>
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

/* ═══════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════ */

type Accent = "primary" | "info" | "success" | "warning";

const accentStyles: Record<Accent, { iconBg: string; iconText: string }> = {
  primary: { iconBg: "bg-primary/10", iconText: "text-primary" },
  info: { iconBg: "bg-info/10", iconText: "text-info" },
  success: { iconBg: "bg-success/10", iconText: "text-success" },
  warning: { iconBg: "bg-warning/10", iconText: "text-warning" },
};

function HeroKpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: Accent }) {
  const s = accentStyles[accent];
  return (
    <div className="relative rounded-xl border border-border/50 bg-muted/20 p-3 md:p-3.5 overflow-hidden group hover:border-border transition-colors">
      <div className={`absolute top-0 left-0 h-[2px] w-10 ${s.iconBg}`} />
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`h-5 w-5 md:h-6 md:w-6 rounded-md flex items-center justify-center ${s.iconBg}`}>
          <span className={s.iconText}>{icon}</span>
        </div>
        <span className="text-[9px] md:text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold truncate">{label}</span>
      </div>
      <p className="text-lg md:text-xl font-display font-black tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function BentoKpi({ icon, label, value, sub, accent, delay }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: Accent; delay?: string }) {
  const s = accentStyles[accent];
  return (
    <div className={`rounded-xl border border-border/60 bg-card p-3.5 md:p-5 hover:border-border/80 transition-all animate-fade-in ${delay || ""}`}>
      <div className="mb-2 md:mb-3 flex items-center justify-between">
        <span className="text-[9px] md:text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold truncate">{label}</span>
        <div className={`h-8 w-8 md:h-9 md:w-9 rounded-lg flex items-center justify-center ${s.iconBg}`}>
          <span className={s.iconText}>{icon}</span>
        </div>
      </div>
      <p className="text-lg md:text-2xl font-display font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 md:mt-1 text-[10px] md:text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function HealthRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: "success" | "warning" | "destructive" | "info" }) {
  const colors: Record<string, string> = {
    success: "text-success bg-success/10", warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10", info: "text-info bg-info/10",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg p-2">
      <div className={`h-7 w-7 rounded-md flex items-center justify-center ${colors[color]}`}>{icon}</div>
      <span className="flex-1 text-[12px] font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function ConversionRow({ label, value, pct, danger }: { label: string; value: string; pct: number; danger?: boolean }) {
  return (
    <div className="space-y-1.5 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={`text-[12px] font-bold tabular-nums ${danger && pct > 1 ? "text-destructive" : "text-foreground"}`}>{value}</span>
      </div>
      <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${danger ? (pct > 1 ? "bg-destructive" : "bg-muted-foreground/20") : "bg-primary"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}