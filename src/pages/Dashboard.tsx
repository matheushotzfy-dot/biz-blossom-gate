import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions, useWithdrawals, useProducts as useProductsQuery } from "@/hooks/useQueryData";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  Flame,
  GraduationCap,
  Hash,
  Layers,
  Lock,
  Mail,
  Package,
  Phone,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
  Percent,
  FileText,
  Webhook,
  User,
  Banknote,
  Crown,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";


/* ─────────────────────── Componentes de Interface ─────────────────────── */



const PERIOD_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
] as const;

type PeriodPreset = (typeof PERIOD_PRESETS)[number];



const CENSORED = "••••••";

function usePrivacyMode() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; }
  });
  const toggle = useCallback(() => {
    setHidden(prev => {
      const next = !prev;
      try { localStorage.setItem("privacy_mode", String(next)); } catch {}
      return next;
    });
  }, []);
  return { hidden, toggle };
}

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  // Use Intl to get reliable Brasília date parts
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  return new Date(Number(y), Number(m) - 1, Number(d));
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { data: transactions = [], refetch: refetchTx } = useTransactions();
  const { data: withdrawals = [] } = useWithdrawals(10);
  const { data: productsData } = useProductsQuery();
  const products = productsData?.length ?? 0;
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[0]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [scaleMode, setScaleMode] = useState(false);
  const [scaleModeUnlocked, setScaleModeUnlocked] = useState(false);
  const privacy = usePrivacyMode();
  
  // Update privacy mode when localStorage changes (from the header toggle)
  useEffect(() => {
    const checkPrivacy = () => {
      const isHidden = localStorage.getItem("privacy_mode") === "true";
      if (privacy.hidden !== isHidden) {
        privacy.toggle();
      }
    };
    window.addEventListener('storage', checkPrivacy);
    // Also check on a short interval since we don't always get storage events on the same tab
    const interval = setInterval(checkPrivacy, 1000);
    return () => {
      window.removeEventListener('storage', checkPrivacy);
      clearInterval(interval);
    };
  }, [privacy.hidden, privacy.toggle]);
  const [showScalePopup, setShowScalePopup] = useState(false);
  const [fireEffect, setFireEffect] = useState(false);
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);

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
    // Custom date range
    if (isCustom && customRange?.from) {
      const start = new Date(customRange.from);
      start.setHours(0, 0, 0, 0);
      const end = customRange.to ? new Date(customRange.to) : new Date(customRange.from);
      end.setHours(23, 59, 59, 999);
      return transactions.filter((t) => {
        const d = new Date(t.created_at);
        return d >= start && d <= end;
      });
    }

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
  }, [transactions, selectedPeriod, isCustom, customRange]);

  const animKey = isCustom
    ? `custom-${customRange?.from?.getTime() ?? 0}-${customRange?.to?.getTime() ?? 0}`
    : `p-${selectedPeriod.label}`;

  // Memoize all derived metrics to avoid recomputing on every render
  const { approved, pending, refunded, chargebacks, revenue, conversion, uniqueCustomers, pixConversion, cardConversion, chargebackRate, pixRevenue, cardRevenue, pixApprovedCount, pixTotalCount, cardApprovedCount, cardTotalCount } = useMemo(() => {
    const _approved = filteredTx.filter((t) => t.status === "completed");
    const _pending = filteredTx.filter((t) => t.status === "pending");
    const _refunded = filteredTx.filter((t) => t.status === "refunded");
    const _chargebacks = filteredTx.filter((t) => t.status === "chargeback");

    const _revenue = _approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const _conversion = filteredTx.length > 0 ? (_approved.length / filteredTx.length) * 100 : 0;

    const pixTx = filteredTx.filter(t => t.payment_method === "pix");
    const pixApproved = pixTx.filter(t => t.status === "completed");
    const _pixConversion = pixTx.length > 0 ? (pixApproved.length / pixTx.length) * 100 : 0;
    const _pixRevenue = pixApproved.reduce((acc, t) => acc + Number(t.net_amount), 0);

    const cardTx = filteredTx.filter(t => t.payment_method === "credit_card" || t.payment_method === "card");
    const cardApproved = cardTx.filter(t => t.status === "completed");
    const _cardConversion = cardTx.length > 0 ? (cardApproved.length / cardTx.length) * 100 : 0;
    const _cardRevenue = cardApproved.reduce((acc, t) => acc + Number(t.net_amount), 0);

    const _chargebackRate = filteredTx.length > 0 ? (_chargebacks.length / filteredTx.length) * 100 : 0;

    const _uniqueCustomers = new Set(filteredTx.map(t => t.customer_email).filter(Boolean)).size;

    return {
      approved: _approved, pending: _pending, refunded: _refunded, chargebacks: _chargebacks,
      revenue: _revenue, conversion: _conversion, uniqueCustomers: _uniqueCustomers,
      pixConversion: _pixConversion, cardConversion: _cardConversion, chargebackRate: _chargebackRate,
      pixRevenue: _pixRevenue, cardRevenue: _cardRevenue,
      pixApprovedCount: pixApproved.length, pixTotalCount: pixTx.length,
      cardApprovedCount: cardApproved.length, cardTotalCount: cardTx.length,
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
    // FIX: Chargebacks/refunds were previously ADDING net_amount instead of not counting
    // Completed revenue already excludes chargebacks/refunds (different status),
    // so we should NOT subtract them again. Only subtract retained amounts.
    const totalRetained = transactions
      .filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0)
      .reduce((acc, t) => acc + Number(t.retained_amount), 0);

    return { withdrawalPending: _withdrawalPending, balance: totalRevenue + balanceAdjustments - totalWithdrawn - totalRetained };
  }, [transactions, withdrawals, balanceAdjustments]);

  // Optimized chart: pre-index transactions by date/hour to avoid O(N*M)
  const chartData = useMemo(() => {
    const isHourly = !isCustom && selectedPeriod.days <= 1;

    if (isHourly) {
      // Show 24 hours for today or yesterday
      const revenueByHour = new Map<number, number>();
      for (const t of filteredTx) {
        if (t.status !== "completed") continue;
        const hour = new Date(t.created_at).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
        const h = parseInt(hour, 10);
        revenueByHour.set(h, (revenueByHour.get(h) || 0) + Number(t.net_amount));
      }
      return Array.from({ length: 24 }, (_, i) => ({
        name: `${String(i).padStart(2, "0")}:00`,
        vendas: revenueByHour.get(i) || 0,
      }));
    }

    let days: number;
    let startDate: Date;

    if (isCustom && customRange?.from) {
      const end = customRange.to || customRange.from;
      days = Math.max(differenceInDays(end, customRange.from) + 1, 1);
      startDate = new Date(customRange.from);
    } else {
      days = Math.max(selectedPeriod.days, 1);
      startDate = new Date(brasiliaToday());
      startDate.setDate(startDate.getDate() - (days - 1));
    }

    // Pre-index completed transactions by date string
    const revenueByDate = new Map<string, number>();
    for (const t of transactions) {
      if (t.status !== "completed") continue;
      const dateKey = toBrasiliaDate(t.created_at);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(t.net_amount));
    }

    return Array.from({ length: days }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);

      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const compare = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

      return { name: label, vendas: revenueByDate.get(compare) || 0 };
    });
  }, [transactions, filteredTx, selectedPeriod.days, isCustom, customRange]);

  const activity = useMemo(() => {
    const tx = transactions.slice(0, 8).map((t) => ({
      id: t.id,
      kind: "transaction" as const,
      createdAt: t.created_at,
      amount: Number(t.amount),
      status: t.status,
      label: t.payment_method || "Pagamento",
      paymentMethod: t.payment_method,
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

  // Check if scale mode was already unlocked (persisted permanently in localStorage)
  useEffect(() => {
    if (!user?.id) return;
    const key = `scale_mode_unlocked_${user.id}`;
    if (localStorage.getItem(key) === "true") {
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
      // Persist permanently so it can never be turned off
      localStorage.setItem(`scale_mode_unlocked_${user.id}`, "true");
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

  const statusLabel = (s: string) => s === 'completed' ? 'Aprovado' : s === 'pending' ? 'Pendente' : s === 'refunded' ? 'Reembolso' : s === 'chargeback' ? 'Chargeback' : 'Falhou';
  const statusColor = (s: string) => s === 'completed' ? 'text-success' : s === 'pending' ? 'text-warning' : 'text-destructive';
  const statusBg = (s: string) => s === 'completed' ? 'bg-success/10 border-success/20' : s === 'pending' ? 'bg-warning/10 border-warning/20' : 'bg-destructive/10 border-destructive/20';

  const completedTx = transactions.filter(t => t.status === "completed");
  const totalRevenue = completedTx.reduce((a, t) => a + Number(t.net_amount), 0);
  const retainedBalance = completedTx
    .filter(t => !t.retention_released)
    .reduce((a, t) => a + Number(t.retained_amount), 0);
  const approvedSalesCount = completedTx.length;
  const periodRevenueLabel = privacy.hidden ? CENSORED : fmt(revenue);
  const safeBalance = Math.max(balance, 0);

  const financialCards = [
    { label: "Faturamento", value: privacy.hidden ? CENSORED : fmt(totalRevenue), sub: "Volume total", icon: TrendingUp, tone: "text-success", accent: "border-t-success", iconBorder: "border-success/30" },
    { label: "Disponível", value: privacy.hidden ? CENSORED : fmt(safeBalance), sub: "Liberado para saque", icon: Wallet, tone: "text-primary", accent: "border-t-primary", iconBorder: "border-primary/30" },
    { label: "Pendente", value: privacy.hidden ? CENSORED : fmt(retainedBalance), sub: "Aguardando liberação", icon: Clock3, tone: "text-warning", accent: "border-t-warning", iconBorder: "border-warning/30" },
    { label: "Vendas", value: privacy.hidden ? CENSORED : approvedSalesCount.toString(), sub: "Aprovadas", icon: Zap, tone: "text-info", accent: "border-t-info", iconBorder: "border-info/30" },
  ];

  const quickActions = [
    { label: "Gerar PIX", desc: "Receber agora", icon: PixLogoMark, href: "/vendas/links", tone: "text-success", bg: "bg-success/10 border-success/20" },
    { label: "Sacar", desc: "Transferir saldo", icon: ArrowDownRight, href: "/financeiro/saques", tone: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { label: "Transações", desc: "Histórico completo", icon: BarChart3, href: "/vendas", tone: "text-info", bg: "bg-info/10 border-info/20" },
    { label: "API Keys", desc: "Credenciais", icon: Hash, href: "/vendas/api-keys", tone: "text-muted-foreground", bg: "bg-muted/40 border-border/60" },
  ];

  const conversionItems = [
    { label: "PIX", pct: pixConversion, detail: `${pixApprovedCount}/${pixTotalCount}`, tone: "success", stroke: "hsl(var(--success))" },
    { label: "Cartão", pct: cardConversion, detail: `${cardApprovedCount}/${cardTotalCount}`, tone: "info", stroke: "hsl(var(--info))" },
    { label: "Chargeback", pct: chargebackRate, detail: `${chargebacks.length} ocorrências`, tone: chargebackRate > 1 ? "destructive" : "success", stroke: chargebackRate > 1 ? "hsl(var(--destructive))" : "hsl(var(--success))" },
  ] as const;

  const summaryStats = [
    { label: "Ticket médio", value: privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0) },
    { label: "Conversão", value: `${conversion.toFixed(1)}%` },
    { label: "Clientes", value: uniqueCustomers.toString() },
  ];

  return (
    <div className="dashboard-page mx-auto w-full max-w-[1440px] pb-24 px-1 md:px-0 relative pt-1">

      <section className="mb-6 overflow-hidden rounded-[2rem] border border-border/40 bg-card/40 backdrop-blur-sm shadow-xl shadow-black/5">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 border-b border-border/40 xl:border-b-0 xl:border-r">
            <div className="flex flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-3 w-3 items-center justify-center">
                    <div className="h-full w-full rounded-full bg-success/80" />
                    <div className="absolute inset-0 animate-ping rounded-full bg-success/40" />
                  </div>
                  <h1 className="text-[28px] md:text-[32px] font-display font-black text-foreground leading-none tracking-tight">
                    Bom dia, <span className="text-primary">{nickname || "Vendedor"}</span>
                  </h1>
                </div>
                <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                  Visão geral da sua operação hoje
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-2xl border border-border/40 bg-background/50 p-1.5 shadow-inner">
                  {PERIOD_PRESETS.filter(p => ["Hoje", "7 dias", "30 dias"].includes(p.label)).map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                      className={cn(
                        "rounded-xl px-4 py-2.5 text-[11px] font-black leading-none transition-all duration-200",
                        !isCustom && selectedPeriod.label === opt.label
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/40"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "inline-flex h-[46px] items-center gap-2.5 rounded-2xl border px-4 text-[11px] font-black leading-none transition-all",
                      isCustom ? "border-primary/50 bg-primary/5 text-primary" : "border-border/40 bg-background/50 text-muted-foreground/70 hover:bg-accent/40 hover:text-foreground shadow-inner"
                    )}>
                      <CalendarDays className="h-4 w-4" />
                      {isCustom && customRange?.from
                        ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
                        : "Personalizado"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto overflow-hidden rounded-3xl border border-border/40 bg-popover/95 backdrop-blur-xl p-0 shadow-2xl">
                    <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-4" classNames={{ day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground", day_range_middle: "bg-primary/5 text-foreground hover:bg-primary/10", day_range_end: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" }} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-0 border-t border-border/40 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="px-6 py-10 md:px-10 md:py-12">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-5 inline-flex items-center gap-3 rounded-[1rem] border border-primary/20 bg-primary/5 px-4 py-2.5 ring-1 ring-primary/5">
                      <Wallet className="h-4 w-4 text-primary" />
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/70">Saldo disponível p/ saque</span>
                    </div>
                    <div className="flex items-baseline gap-4">
                      <p className="text-[48px] md:text-[72px] font-display font-black tracking-[-0.05em] text-foreground leading-[0.8] tabular-nums">
                        {privacy.hidden ? CENSORED : fmt(safeBalance)}
                      </p>
                    </div>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        Online
                      </div>
                      <div className="rounded-xl border border-border/40 bg-background/40 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground/60 shadow-inner">
                        Período: {isCustom ? "Customizado" : selectedPeriod.label}
                      </div>
                      <div className="rounded-xl border border-border/40 bg-background/40 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground/60 shadow-inner">
                        Rec. Período: {periodRevenueLabel}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
                    <Link to="/financeiro/saques" className="inline-flex h-[52px] min-w-[140px] items-center justify-center gap-3 rounded-2xl bg-primary px-8 text-[14px] font-black text-primary-foreground shadow-xl shadow-primary/25 hover:scale-[1.03] active:scale-[0.97] transition-all">
                      <ArrowDownRight className="h-5 w-5" strokeWidth={3} />
                      Sacar
                    </Link>
                    <Link to="/vendas/links" className="inline-flex h-[52px] min-w-[140px] items-center justify-center gap-3 rounded-2xl border-2 border-border/40 bg-background/60 px-8 text-[14px] font-black text-foreground hover:bg-accent/40 hover:border-primary/30 transition-all hover:scale-[1.03] active:scale-[0.97]">
                      <PixLogoMark className="h-5 w-5 text-success" />
                      Link PIX
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 border-t border-border/40 bg-secondary/10 md:grid-cols-1 md:border-l md:border-t-0 md:divide-y md:divide-border/40">
                {summaryStats.map((item) => (
                  <div key={item.label} className="flex flex-col justify-center border-r border-border/40 px-6 py-6 last:border-r-0 md:border-r-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/50">{item.label}</p>
                    <p className="mt-2 text-[20px] font-display font-black text-foreground tabular-nums leading-none tracking-tight">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 border-t border-border/40 lg:grid-cols-4 divide-x divide-border/40">
              {financialCards.map((card) => (
                <div key={card.label} className={cn("group/card relative min-h-[140px] px-6 py-7 transition-all duration-300 hover:bg-background/80")}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-10 group-hover/card:opacity-30 transition-opacity" />
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 group-hover/card:text-muted-foreground/60 transition-colors">{card.label}</span>
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-card shadow-sm transition-transform group-hover/card:scale-110", card.tone)}>
                      <card.icon className="h-5 w-5" strokeWidth={2.5} />
                    </div>
                  </div>
                  <p className="text-[32px] md:text-[36px] font-display font-black tracking-[-0.04em] text-foreground leading-none tabular-nums">{card.value}</p>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">{card.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="bg-secondary/5 p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Sincronização</p>
                <h2 className="mt-1 text-[20px] font-display font-black text-foreground leading-none tracking-tight">Tempo Real</h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] border border-success/30 bg-success/5 text-success shadow-sm">
                <Activity className="h-5 w-5 animate-pulse" />
              </div>
            </div>

            <div className="space-y-4">
              {conversionItems.map((kpi) => {
                const textTone = kpi.tone === "success" ? "text-success" : kpi.tone === "info" ? "text-info" : "text-destructive";
                const pctValue = kpi.pct;
                // Full circle is 2 * PI * r = 2 * 3.14159 * 15 = 94.24
                const circumference = 94.24;
                const offset = circumference - (pctValue / 100) * circumference;
                
                return (
                  <div key={kpi.label} className="group/kpi relative overflow-hidden rounded-2xl border border-border/40 bg-card p-4 transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-black/5">
                    <div className="flex items-center gap-4">
                      <div className="relative h-12 w-12 shrink-0">
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted)/0.3)" strokeWidth="3" />
                          <circle 
                            cx="18" cy="18" r="15" fill="none" 
                            stroke={kpi.stroke} 
                            strokeWidth="3" 
                            strokeDasharray={circumference} 
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={cn("text-[10px] font-black tabular-nums leading-none", textTone)}>
                            {kpi.pct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black text-foreground leading-tight">{kpi.label}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 leading-none">{kpi.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quickActions.map((a) => (
          <Link key={a.href} to={a.href} className="group flex min-h-[80px] items-center gap-4 rounded-3xl border border-border/40 bg-card/50 px-5 py-4 transition-all hover:bg-accent/40 hover:border-primary/20 hover:shadow-lg hover:shadow-black/5">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-transform group-hover:scale-110", a.bg, a.tone)}>
              <a.icon className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-black text-foreground leading-tight">{a.label}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 leading-none">{a.desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/40 backdrop-blur-sm shadow-xl shadow-black/5">
          <div className="flex items-center justify-between border-b border-border/40 px-6 py-6 md:px-8">
            <div className="space-y-1">
              <h3 className="text-[16px] font-black text-foreground leading-none tracking-tight">Faturamento</h3>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">Performance por período</p>
            </div>
            <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-2 text-[11px] font-black text-success tabular-nums">
              {periodRevenueLabel}
            </div>
          </div>
          <div className="relative px-2 pb-6 pt-4">
            <ResponsiveContainer width="100%" height={284}>
              <AreaChart data={chartData} margin={{ top: 10, right: 18, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.35)" fontSize={10} interval={chartData.length > 10 ? Math.ceil(chartData.length / 8) - 1 : 0} />
                <YAxis tickLine={false} axisLine={false} width={60} stroke="hsl(var(--muted-foreground) / 0.35)" fontSize={10} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k` : `R$${v}`} />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--success) / 0.35)", strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                        <p className="mt-1.5 text-[15px] font-black text-success tabular-nums leading-none">
                          {fmt(payload[0].value as number)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="vendas" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#dashboardRevenue)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))", stroke: "hsl(var(--success))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="border-b border-border/60 px-5 py-4">
            <h3 className="text-[14px] font-black text-foreground leading-none">Qualidade</h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/65">Risco e performance</p>
          </div>
          <div className="p-5">
            <div className="mb-4 rounded-2xl border border-border/60 bg-background/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">Score</span>
                <ShieldCheck className="h-4 w-4 text-success" />
              </div>
              <p className="text-[30px] font-display font-black text-foreground leading-none tabular-nums">{Math.max(0, 100 - chargebackRate * 12).toFixed(0)}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success" style={{ width: `${Math.max(8, Math.min(100, 100 - chargebackRate * 12))}%` }} />
              </div>
            </div>
            <div className="space-y-3">
              {summaryStats.map((s) => (
                <div key={s.label} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
                  <span className="text-[12px] font-semibold text-muted-foreground">{s.label}</span>
                  <span className="text-[12px] font-black text-foreground tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <h3 className="text-[14px] font-black text-foreground leading-none">Atividade recente</h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/65">Últimas movimentações</p>
          </div>
          <Link to="/vendas" className="text-[11px] font-black text-primary hover:text-foreground transition-colors">Ver tudo</Link>
        </div>
        {activity.length === 0 ? (
          <div className="grid min-h-[132px] place-items-center px-5 py-10 text-center">
            <div>
              <Activity className="mx-auto mb-3 h-6 w-6 text-muted-foreground/45" />
              <p className="text-[12px] font-semibold text-muted-foreground">Nenhuma atividade encontrada</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {activity.map((item) => (
              <div key={item.id} className="flex cursor-pointer items-center gap-3 px-5 py-3.5 hover:bg-accent/35" onClick={() => item.kind === 'transaction' && setDetailTx(transactions.find(t => t.id === item.id) || null)}>
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", statusBg(item.status))}>
                  {item.kind === 'withdrawal' ? <ArrowDownRight className={cn("h-4 w-4", statusColor(item.status))} /> : <CreditCard className={cn("h-4 w-4", statusColor(item.status))} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black text-foreground leading-none">{item.label === 'pix' ? 'PIX' : item.label === 'credit_card' ? 'Cartão de Crédito' : item.label}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
                    {item.kind === 'withdrawal' ? 'Saque' : 'Venda'} · {timeAgo(item.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-display font-black text-foreground tabular-nums leading-none">{privacy.hidden ? CENSORED : fmt(item.amount)}</p>
                  <p className={cn("mt-1 text-[9px] font-black uppercase tracking-[0.12em] leading-none", statusColor(item.status))}>
                    {statusLabel(item.status)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Transaction Detail Dialog ── */}
      <Dialog open={!!detailTx} onOpenChange={(open) => !open && setDetailTx(null)}>
        <DialogContent className="sm:max-w-[440px] border-border/20 bg-card p-0 gap-0 overflow-hidden rounded-xl">
          {detailTx && (() => {
            const sMap: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
              completed: { label: "Aprovada", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/15", dot: "bg-emerald-400" },
              pending: { label: "Pendente", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/15", dot: "bg-amber-400" },
              failed: { label: "Falhou", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/15", dot: "bg-red-400" },
              refunded: { label: "Reembolso", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/15", dot: "bg-blue-400" },
              chargeback: { label: "Chargeback", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/15", dot: "bg-red-400" },
            };
            const s = sMap[detailTx.status] || { label: detailTx.status, color: "text-foreground", bg: "bg-muted/10", border: "border-border/20", dot: "bg-muted-foreground" };
            const productName = productsData?.find(p => p.id === detailTx.product_id)?.name;

            return (
              <div>
                <div className="px-6 pt-7 pb-5 border-b border-border/15">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[10px] font-bold border leading-none", s.color, s.bg, s.border)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                      {s.label}
                    </span>
                    {detailTx.payment_method && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-[5px] text-[9px] font-semibold text-muted-foreground/50 border border-border/15 leading-none">
                        <CreditCard className="h-2.5 w-2.5" />
                        {detailTx.payment_method === "credit_card" ? "Cartão" : detailTx.payment_method === "pix" ? "PIX" : detailTx.payment_method}
                      </span>
                    )}
                  </div>
                  <p className="text-[32px] font-display font-black text-foreground tabular-nums tracking-[-0.03em] leading-none">{fmt(Number(detailTx.amount))}</p>
                  {productName && <p className="text-[12px] text-muted-foreground/40 mt-2 leading-none">{productName}</p>}
                </div>
                <div className="px-6 py-4 space-y-3">
                  {[
                    { show: !!detailTx.customer_name, icon: User, label: "Cliente", value: detailTx.customer_name },
                    { show: !!detailTx.customer_email, icon: Mail, label: "Email", value: detailTx.customer_email },
                    { show: !!detailTx.customer_phone, icon: Phone, label: "Telefone", value: detailTx.customer_phone },
                  ].filter(f => f.show).map((field, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-emerald-500/5 border border-emerald-500/8 flex items-center justify-center shrink-0">
                        <field.icon className="h-3.5 w-3.5 text-emerald-400/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[8px] font-display uppercase tracking-[0.18em] text-muted-foreground/25 leading-none">{field.label}</p>
                        <p className="text-[12px] font-semibold text-foreground truncate mt-1 leading-none">{field.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mx-6 h-px bg-border/10" />
                <div className="px-6 py-4">
                  <div className="rounded-lg border border-border/10 bg-card-elevated/50 p-3.5 space-y-2.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-muted-foreground/40">Valor bruto</span>
                      <span className="font-semibold text-foreground tabular-nums">{fmt(Number(detailTx.amount))}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-muted-foreground/40">Taxas</span>
                      <span className="font-semibold text-red-400/70 tabular-nums">- {fmt(Number(detailTx.fee_amount))}</span>
                    </div>
                    <div className="border-t border-border/8 pt-2.5 flex justify-between items-center">
                      <span className="text-[12px] font-bold text-foreground">Líquido</span>
                      <span className="font-black text-emerald-400 tabular-nums text-[16px] font-display tracking-tight">{fmt(Number(detailTx.net_amount))}</span>
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/25">
                    <Clock3 className="h-3 w-3" />
                    {new Date(detailTx.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </span>
                  <p className="text-[8px] text-muted-foreground/15 font-mono truncate max-w-[160px]">ID: {detailTx.id}</p>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-components ─── */

function PixLogoMark({ className, variant = "teal" }: { className?: string; variant?: "teal" | "white" }) {
  const color = variant === "white" ? "hsl(var(--primary-foreground))" : "hsl(173 58% 47%)";
  return (
    <svg viewBox="538 29 73 73" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet" shapeRendering="geometricPrecision" className={cn("select-none", className)} style={{ color }}>
      <path d="m 596.82737,86.620206 c -3.08045,0 -5.97782,-1.19944 -8.15622,-3.37679 l -11.77678,-11.77713 c -0.82691,-0.82903 -2.26801,-0.82656 -3.09456,0 l -11.81982,11.82017 c -2.17841,2.17734 -5.07577,3.37679 -8.15623,3.37679 h -2.32092 l 14.9158,14.915444 c 4.65807,4.65808 12.21069,4.65808 16.86912,0 l 14.95813,-14.958484 z" fill="currentColor" />
      <path d="m 553.82362,44.963326 c 3.08046,0 5.97782,1.19944 8.15622,3.37679 l 11.81982,11.82193 c 0.85125,0.85161 2.2412,0.85479 3.09457,-10e-4 l 11.77678,-11.77784 c 2.1784,-2.17735 5.07576,-3.37679 8.15622,-3.37679 h 1.41852 l -14.95778,-14.95813 c -4.65878,-4.658432 -12.2114,-4.658432 -16.86948,0 l -14.91509,14.91509 z" fill="currentColor" />
      <path d="m 610.61844,57.378776 -9.03922,-9.03922 c -0.19897,0.0797 -0.41452,0.12946 -0.64206,0.12946 h -4.10986 c -2.12478,0 -4.20476,0.86184 -5.70618,2.36432 l -11.77643,11.77678 c -1.10207,1.10208 -2.55022,1.65347 -3.99697,1.65347 -1.44815,0 -2.89524,-0.55139 -3.99697,-1.65241 l -11.82088,-11.82088 c -1.50142,-1.50283 -3.5814,-2.36431 -5.70618,-2.36431 h -5.05354 c -0.21555,0 -0.41698,-0.0508 -0.60713,-0.12242 l -9.07521,9.07521 c -4.65843,4.65843 -4.65843,12.2107 0,16.86913 l 9.07486,9.07485 c 0.1905,-0.0716 0.39193,-0.12241 0.60748,-0.12241 h 5.05354 c 2.12478,0 4.20476,-0.86148 5.70618,-2.36396 l 11.81982,-11.81982 c 2.13643,-2.13466 5.8607,-2.13537 7.995,0.001 l 11.77643,11.77573 c 1.50142,1.50248 3.5814,2.36431 5.70618,2.36431 h 4.10986 c 0.22754,0 0.44309,0.0497 0.64206,0.12947 l 9.03922,-9.03922 c 4.65808,-4.65843 4.65808,-12.2107 0,-16.86913" fill="currentColor" />
    </svg>
  );
}
