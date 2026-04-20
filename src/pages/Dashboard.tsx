import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions, useWithdrawals, useProducts as useProductsQuery } from "@/hooks/useQueryData";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
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
  Banknote,
  Crown,
  Check,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ─────────────────────── Animated Number ─────────────────────── */
function AnimatedNumber({ value, formatter = fmt, duration = 800 }: { value: number; formatter?: (v: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) { setDisplay(to); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return (
    <span className="relative inline-grid w-max whitespace-nowrap">
      <span className="invisible col-start-1 row-start-1 whitespace-nowrap">{formatter(value)}</span>
      <span className="col-start-1 row-start-1 whitespace-nowrap">{formatter(display)}</span>
    </span>
  );
}

const PERIOD_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
] as const;

type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const STAGGER_CLASSES = ["", "stagger-1", "stagger-2", "stagger-3", "stagger-4", "stagger-5", "stagger-6"];

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
  const { user } = useAuth();
  const { profile } = useProfile();
  const { data: transactions = [], refetch: refetchTx } = useTransactions();
  const { data: withdrawals = [] } = useWithdrawals(10);
  const { data: productsData } = useProductsQuery();
  const products = productsData?.length ?? 0;
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[0]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [scaleMode, setScaleMode] = useState(false);
  const [scaleModeUnlocked, setScaleModeUnlocked] = useState(false);
  const privacy = usePrivacyMode();
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
    let base = transactions;
    if (selectedProductId !== "all") {
      base = base.filter(t => t.product_id === selectedProductId);
    }

    // Custom date range
    if (isCustom && customRange?.from) {
      const start = new Date(customRange.from);
      start.setHours(0, 0, 0, 0);
      const end = customRange.to ? new Date(customRange.to) : new Date(customRange.from);
      end.setHours(23, 59, 59, 999);
      return base.filter((t) => {
        const d = new Date(t.created_at);
        return d >= start && d <= end;
      });
    }

    const today = brasiliaToday();

    if (selectedPeriod.days === 0) {
      const todayStr = today.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return base.filter((t) => toBrasiliaDate(t.created_at) === todayStr);
    }

    if (selectedPeriod.days === 1) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return base.filter((t) => toBrasiliaDate(t.created_at) === yesterdayStr);
    }

    const start = new Date(today);
    start.setDate(start.getDate() - selectedPeriod.days);
    start.setHours(0, 0, 0, 0);

    return base.filter((t) => new Date(t.created_at) >= start);
  }, [transactions, selectedPeriod, isCustom, customRange, selectedProductId]);

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
      if (selectedProductId !== "all" && t.product_id !== selectedProductId) continue;
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

  const periodLabel = isCustom && customRange?.from
    ? customRange.to
      ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${format(customRange.to, "dd/MM", { locale: ptBR })}`
      : format(customRange.from, "dd/MM/yyyy", { locale: ptBR })
    : selectedPeriod.label;

  return (
    <div className="relative mx-auto w-full max-w-[1340px] pb-24">
      {/* ─── GREEN FIRE BORDER EFFECT (Modo Escala milestone) ─── */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute inset-0 ring-2 ring-inset ring-success/40 animate-pulse" />
        </div>
      )}

      {/* ─── SCALE MODE POPUP ─── */}
      {showScalePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80" onClick={() => setShowScalePopup(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card animate-scale-in overflow-hidden">
            <button onClick={() => setShowScalePopup(false)} className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 z-10"><X className="h-4 w-4 text-muted-foreground" /></button>
            <div className="p-8 text-center">
              <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
                <Rocket className="h-8 w-8 text-success" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-success/10 border border-success/20 px-3 py-1 mb-4">
                <Flame className="h-3.5 w-3.5 text-success" />
                <span className="text-[10px] font-bold text-success uppercase tracking-wider">Modo Escala Desbloqueado</span>
              </div>
              <h2 className="text-2xl font-display font-black text-foreground mb-3">Modo Escala<br /><span className="text-success">Ativado</span></h2>
              <p className="text-sm text-muted-foreground mb-6">Você atingiu R$ 2.000 em 24h. A elite dos vendedores.</p>
              <button onClick={() => setShowScalePopup(false)} className="w-full h-11 rounded-lg bg-foreground text-background font-bold text-sm hover:opacity-90 transition-opacity">Continuar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BLOCO 1: VISÃO EXECUTIVA ─── */}
      <section className="relative rounded-2xl border border-border bg-card overflow-hidden mb-5 shadow-[0_1px_0_0_hsl(var(--border)),0_24px_48px_-24px_hsl(var(--background))]">
        {/* Ambient glow + dot pattern */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:radial-gradient(hsl(var(--foreground))_1px,transparent_1px)] [background-size:18px_18px]" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/[0.06] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-success/[0.05] blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between gap-4 px-6 md:px-7 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-muted to-muted/40 border border-border flex items-center justify-center shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]">
              <BarChart3 className="h-3.5 w-3.5 text-foreground" strokeWidth={2.2} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">Visão Executiva</span>
              <span className="text-[10.5px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                Operação em tempo real
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 rounded-lg bg-muted border border-border p-[3px]">
              {PERIOD_PRESETS.map((p) => {
                const active = !isCustom && selectedPeriod.label === p.label;
                return (
                  <button
                    key={p.label}
                    onClick={() => { setIsCustom(false); setSelectedPeriod(p); }}
                    className={cn(
                      "h-7 px-3 rounded-md text-[11.5px] font-semibold transition-colors",
                      active
                        ? "bg-card text-foreground border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "h-[34px] px-3 rounded-lg text-[11.5px] font-semibold transition-colors flex items-center gap-1.5 border",
                    isCustom
                      ? "bg-card text-foreground border-border"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {isCustom && customRange?.from ? periodLabel : "Custom"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range);
                    if (range?.from) setIsCustom(true);
                    if (range?.from && range?.to) setDatePickerOpen(false);
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            <button
              onClick={privacy.toggle}
              className="h-[34px] w-[34px] rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
              title={privacy.hidden ? "Mostrar valores" : "Ocultar valores"}
            >
              {privacy.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Receita + Saldo */}
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] divide-x divide-border border-b border-border">
          <div className="relative px-7 md:px-9 py-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-4 flex items-center gap-2">
              <span className="h-px w-6 bg-gradient-to-r from-transparent via-foreground/40 to-foreground/40" />
              Receita · {periodLabel}
            </p>
            <div className="text-[60px] md:text-[88px] font-display font-black tracking-[-0.045em] leading-[0.92] bg-gradient-to-b from-foreground to-foreground/85 bg-clip-text text-transparent tabular-nums">
              {privacy.hidden ? CENSORED : <AnimatedNumber value={revenue} />}
            </div>
            <div className="mt-7 flex items-center gap-7 flex-wrap">
              {[
                { count: approved.length, label: "aprovadas", color: "bg-success" },
                { count: pending.length, label: "pendentes", color: "bg-warning" },
                { count: chargebacks.length, label: "contestações", color: "bg-destructive" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
                  <span className="text-[13px] font-bold text-foreground tabular-nums">{s.count}</span>
                  <span className="text-[12px] text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative px-7 md:px-8 py-8 bg-gradient-to-br from-success/[0.025] via-transparent to-transparent">
            <div className="flex items-center gap-2 mb-4">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success)/0.6)]" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Saldo Disponível</p>
            </div>
            <div className="text-[40px] md:text-[54px] font-display font-black tracking-[-0.04em] leading-[0.95] bg-gradient-to-b from-success to-success/80 bg-clip-text text-transparent tabular-nums drop-shadow-[0_0_24px_hsl(var(--success)/0.15)]">
              {privacy.hidden ? CENSORED : <AnimatedNumber value={balance} />}
            </div>
            <Link
              to="/financeiro/saques"
              className="relative mt-6 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-foreground text-background text-[11.5px] font-bold hover:opacity-90 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_hsl(var(--foreground)/0.4)] group overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-700" />
              <span className="relative">Sacar agora</span>
              <ArrowRight className="relative h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          {[
            { label: "Conversão", value: `${conversion.toFixed(1)}%`, icon: Target },
            { label: "Ticket Médio", value: privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0), icon: Wallet },
            { label: "Clientes Únicos", value: String(uniqueCustomers), icon: Users },
            { label: "Chargeback", value: `${chargebackRate.toFixed(2)}%`, icon: ShieldCheck, danger: chargebackRate > 1 },
          ].map((kpi) => (
            <div key={kpi.label} className="px-6 md:px-7 py-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{kpi.label}</p>
                <kpi.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
              </div>
              <p className={cn(
                "text-[26px] md:text-[30px] font-display font-black tracking-[-0.03em] leading-none tabular-nums",
                (kpi as any).danger ? "text-destructive" : "text-foreground"
              )}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── BLOCO 2: GRÁFICO + POR MÉTODO ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-5 mb-5">
        {/* Gráfico */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-6 md:px-7 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-foreground" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">Receita ao longo do tempo</p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  {!isCustom && selectedPeriod.days <= 1 ? "Por hora" : "Por dia"} · {periodLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted border border-border">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="text-[10.5px] font-semibold text-foreground">Aprovadas</span>
            </div>
          </div>
          <div className="px-3 md:px-4 py-4 h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 16, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 600 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                  width={50}
                />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                    padding: "10px 14px",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}
                  itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }}
                  formatter={(value: number) => [fmt(value), "Receita"]}
                />
                <Area
                  type="monotone"
                  dataKey="vendas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#dashGrad)"
                  activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Por método */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-6 md:px-7 py-4 border-b border-border">
            <div className="h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center">
              <Layers className="h-3.5 w-3.5 text-foreground" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">Por Método</p>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">Conversão e receita</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {[
              { icon: Zap, label: "PIX", conv: pixConversion, revenue: pixRevenue, sub: `${pixApprovedCount}/${pixTotalCount} aprovadas` },
              { icon: CreditCard, label: "Cartão", conv: cardConversion, revenue: cardRevenue, sub: `${cardApprovedCount}/${cardTotalCount} aprovadas` },
            ].map((m) => (
              <div key={m.label} className="px-6 md:px-7 py-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center">
                      <m.icon className="h-3.5 w-3.5 text-foreground" strokeWidth={2.2} />
                    </div>
                    <span className="text-[13px] font-bold text-foreground tracking-tight">{m.label}</span>
                  </div>
                  <span className="text-[11.5px] font-bold text-foreground tabular-nums px-2 py-1 rounded-md bg-muted border border-border">
                    {m.conv.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[22px] font-display font-black text-foreground tabular-nums tracking-[-0.03em] leading-none">
                  {privacy.hidden ? CENSORED : fmt(m.revenue)}
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-1.5 font-medium">{m.sub}</p>
              </div>
            ))}

            {/* Saques pendentes */}
            <div className="px-6 md:px-7 py-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center">
                    <DollarSign className="h-3.5 w-3.5 text-warning" strokeWidth={2.2} />
                  </div>
                  <span className="text-[13px] font-bold text-foreground tracking-tight">Saques pendentes</span>
                </div>
                <span className="text-[11.5px] font-bold text-warning tabular-nums px-2 py-1 rounded-md bg-warning/10 border border-warning/20">
                  {withdrawals.filter(w => w.status === "pending").length}
                </span>
              </div>
              <div className="text-[22px] font-display font-black text-warning tabular-nums tracking-[-0.03em] leading-none">
                {privacy.hidden ? CENSORED : fmt(withdrawalPending)}
              </div>
              <Link to="/financeiro/saques" className="text-[10.5px] text-foreground font-bold hover:underline mt-1.5 inline-flex items-center gap-1">
                Gerenciar <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ─── BLOCO 3: AÇÕES RÁPIDAS + ATIVIDADE RECENTE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Ações rápidas */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-6 md:px-7 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-foreground" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">Ações Rápidas</p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">Atalhos da operação</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {[
              { icon: Package, label: "Criar produto", desc: "Adicionar novo infoproduto", to: "/vendas/produtos/novo/editar" },
              { icon: ShoppingCart, label: "Personalizar checkout", desc: "Editar página de venda", to: "/vendas/checkout" },
              { icon: Users, label: "Convidar afiliados", desc: "Expandir rede de vendedores", to: "/vendas/afiliados" },
              { icon: Webhook, label: "Configurar integrações", desc: "Conectar apps e webhooks", to: "/integracoes" },
              { icon: Percent, label: "Criar cupom", desc: "Promoções e descontos", to: "/vendas/cupons" },
              { icon: BookOpen, label: "Área de membros", desc: "Gerenciar conteúdo e alunos", to: "/vendas/conteudo" },
              { icon: Banknote, label: "Solicitar saque", desc: "Transferir saldo disponível", to: "/financeiro/saques" },
              { icon: FileText, label: "Documentação API", desc: "Integrar via REST", to: "/vendas/api-docs" },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="flex items-center gap-3.5 px-6 md:px-7 py-3.5 hover:bg-muted/40 transition-colors group"
              >
                <div className="h-9 w-9 rounded-lg bg-muted border border-border flex items-center justify-center group-hover:bg-foreground group-hover:border-foreground transition-colors">
                  <action.icon className="h-4 w-4 text-foreground group-hover:text-background transition-colors" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground tracking-tight">{action.label}</p>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">{action.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))}
          </div>
        </section>

        {/* Atividade recente */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-6 md:px-7 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center">
                <Activity className="h-3.5 w-3.5 text-foreground" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">Atividade Recente</p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">Últimos eventos</p>
              </div>
            </div>
            <Link to="/vendas" className="text-[10.5px] text-foreground hover:underline font-bold uppercase tracking-wider inline-flex items-center gap-1">
              Ver tudo <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {activity.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center mb-4">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">Nenhuma atividade ainda</p>
                <p className="text-[11px] text-muted-foreground mt-1">Novos eventos aparecerão aqui</p>
              </div>
            ) : (
              activity.map((item) => {
                const isCompleted = item.status === "completed" || item.status === "approved";
                const isPending = item.status === "pending";
                const isFailed = item.status === "refunded" || item.status === "chargeback" || item.status === "failed" || item.status === "rejected";
                const statusColor = isCompleted ? "bg-success" : isPending ? "bg-warning" : isFailed ? "bg-destructive" : "bg-muted-foreground";
                const statusLabel = isCompleted ? "Aprovada" : isPending ? "Pendente" : isFailed ? "Falhou" : item.status;
                const tx = item.kind === "transaction" ? transactions.find(t => t.id === item.id) : null;
                const product = tx?.product_id ? productsData?.find(p => p.id === tx.product_id) : null;
                const customerName = tx?.customer_name?.split(" ")[0] || (tx?.customer_email?.split("@")[0]) || null;
                const method = (item as any).paymentMethod;
                const Icon = item.kind === "withdrawal" ? Wallet : method === "pix" ? Zap : CreditCard;
                const methodLabel = item.kind === "withdrawal" ? "Saque" : method === "pix" ? "PIX" : method === "credit_card" || method === "card" ? "Cartão" : (item.label || "Venda");

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (tx) setDetailTx(tx);
                    }}
                    className="w-full flex items-center gap-3.5 px-6 md:px-7 py-3.5 hover:bg-muted/40 transition-colors text-left group"
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-lg border flex items-center justify-center shrink-0",
                      isCompleted && "bg-success/10 border-success/20",
                      isPending && "bg-warning/10 border-warning/20",
                      isFailed && "bg-destructive/10 border-destructive/20",
                      !isCompleted && !isPending && !isFailed && "bg-muted border-border"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        isCompleted && "text-success",
                        isPending && "text-warning",
                        isFailed && "text-destructive",
                        !isCompleted && !isPending && !isFailed && "text-foreground"
                      )} strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[13.5px] font-black text-foreground tabular-nums tracking-tight">
                          {privacy.hidden ? CENSORED : fmt(item.amount)}
                        </span>
                        <span className="text-[10.5px] text-muted-foreground font-medium">·</span>
                        <span className="text-[11px] font-semibold text-foreground/80">{methodLabel}</span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground truncate font-medium flex items-center gap-1.5">
                        <span className={cn("inline-flex items-center gap-1", isCompleted && "text-success", isPending && "text-warning", isFailed && "text-destructive")}>
                          <span className={cn("h-1 w-1 rounded-full", statusColor)} />
                          {statusLabel}
                        </span>
                        {(customerName || product) && <span className="text-muted-foreground/60">·</span>}
                        {customerName && <span className="truncate">{customerName}</span>}
                        {product && <><span className="text-muted-foreground/60">·</span><span className="truncate">{product.name}</span></>}
                        <span className="text-muted-foreground/60">·</span>
                        <span className="shrink-0">{timeAgo(item.createdAt)}</span>
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* ─── DETAIL DIALOG ─── */}
      {detailTx && (
        <Dialog open={!!detailTx} onOpenChange={() => setDetailTx(null)}>
          <DialogContent className="max-w-md">
            <div className="space-y-3">
              <h3 className="text-lg font-bold">Detalhes da transação</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-semibold tabular-nums">{fmt(Number(detailTx.amount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Líquido</span><span className="font-semibold tabular-nums">{fmt(Number(detailTx.net_amount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-semibold capitalize">{detailTx.status}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Método</span><span className="font-semibold uppercase">{detailTx.payment_method}</span></div>
                {detailTx.customer_name && <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-semibold">{detailTx.customer_name}</span></div>}
                {detailTx.customer_email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-semibold truncate max-w-[200px]">{detailTx.customer_email}</span></div>}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
