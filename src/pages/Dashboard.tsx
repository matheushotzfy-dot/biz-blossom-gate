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
    <div className="mx-auto w-full max-w-[1340px] pb-20">
      {/* ─── GREEN FIRE BORDER EFFECT ─── */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent animate-pulse" />
        </div>
      )}

      {/* ─── SCALE MODE POPUP ─── */}
      {showScalePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" onClick={() => setShowScalePopup(false)} />
          <div className="relative w-full max-w-md rounded-3xl border-2 border-primary/40 bg-card shadow-2xl shadow-primary/20 animate-scale-in overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-primary/5 pointer-events-none" />
            <button onClick={() => setShowScalePopup(false)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted z-10"><X className="h-4 w-4 text-muted-foreground" /></button>
            <div className="relative p-8 text-center">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center ring-4 ring-primary/15">
                <Rocket className="h-10 w-10 text-primary" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/25 px-4 py-1.5 mb-4">
                <Flame className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Modo Escala Desbloqueado</span>
              </div>
              <h2 className="text-2xl font-display font-black text-foreground mb-3">MODO ESCALA<br /><span className="text-primary">ATIVADO! 🔥</span></h2>
              <p className="text-sm text-muted-foreground mb-6">Você atingiu R$ 2.000 em 24h. A elite dos vendedores!</p>
              <button onClick={() => setShowScalePopup(false)} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold text-sm">BORA DOMINAR!</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HOTZFY · DASHBOARD CLÁSSICO (versão publicada)                    */}
      {/* ════════════════════════════════════════════════════════════════ */}

      {/* ─── BLOCO 1: VISÃO EXECUTIVA ─── */}
      <section className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden mb-5">
        {/* Header com tabs de período */}
        <div className="flex items-center justify-between gap-4 px-5 md:px-7 py-4 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70">Visão Executiva</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-0.5 rounded-lg bg-muted/30 border border-border/30 p-0.5">
              {PERIOD_PRESETS.map((p) => {
                const active = !isCustom && selectedPeriod.label === p.label;
                return (
                  <button
                    key={p.label}
                    onClick={() => { setIsCustom(false); setSelectedPeriod(p); }}
                    className={cn(
                      "h-7 px-3 rounded-md text-[11.5px] font-semibold transition-all",
                      active
                        ? "bg-background text-foreground shadow-sm"
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
                    "h-7 px-3 rounded-md text-[11.5px] font-semibold transition-all flex items-center gap-1.5 border",
                    isCustom
                      ? "bg-background text-foreground border-border/60 shadow-sm"
                      : "bg-muted/30 text-muted-foreground border-border/30 hover:text-foreground"
                  )}
                >
                  <CalendarDays className="h-3 w-3" />
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
              className="h-7 w-7 rounded-md bg-muted/30 border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title={privacy.hidden ? "Mostrar valores" : "Ocultar valores"}
            >
              {privacy.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Receita + Saldo */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-px bg-border/30">
          <div className="bg-card/60 px-6 md:px-8 py-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70 mb-3">
              Receita · {periodLabel}
            </p>
            <div className="text-[64px] md:text-[88px] font-display font-black tracking-[-0.05em] leading-none text-foreground tabular-nums">
              {privacy.hidden ? CENSORED : <AnimatedNumber value={revenue} />}
            </div>
            <div className="mt-5 flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-[12px] font-semibold text-foreground tabular-nums">{approved.length}</span>
                <span className="text-[12px] text-muted-foreground">aprovadas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                <span className="text-[12px] font-semibold text-foreground tabular-nums">{pending.length}</span>
                <span className="text-[12px] text-muted-foreground">pendentes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span className="text-[12px] font-semibold text-foreground tabular-nums">{chargebacks.length}</span>
                <span className="text-[12px] text-muted-foreground">contestações</span>
              </div>
            </div>
          </div>

          <div className="bg-card/60 px-6 md:px-8 py-7">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">Saldo Disponível</p>
            </div>
            <div className="text-[40px] md:text-[52px] font-display font-black tracking-[-0.04em] leading-none text-success tabular-nums">
              {privacy.hidden ? CENSORED : <AnimatedNumber value={balance} />}
            </div>
            <Link
              to="/financeiro/saques"
              className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:gap-2.5 transition-all"
            >
              Sacar agora
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/30 border-t border-border/30">
          {[
            { label: "Conversão", value: `${conversion.toFixed(1)}%`, color: "text-primary" },
            { label: "Ticket Médio", value: privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0), color: "text-foreground" },
            { label: "Clientes Únicos", value: String(uniqueCustomers), color: "text-foreground" },
            { label: "Chargeback", value: `${chargebackRate.toFixed(2)}%`, color: chargebackRate > 1 ? "text-destructive" : "text-foreground" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-card/60 px-5 md:px-7 py-5">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">{kpi.label}</p>
              <p className={cn("text-[26px] md:text-[30px] font-display font-black tracking-[-0.03em] leading-none tabular-nums", kpi.color)}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── BLOCO 2: GRÁFICO + POR MÉTODO ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-5 mb-5">
        {/* Gráfico */}
        <section className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 md:px-7 py-4 border-b border-border/30">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70">Receita ao Longo do Tempo</p>
              <p className="text-[10.5px] text-muted-foreground/70 mt-0.5">
                {!isCustom && selectedPeriod.days <= 1 ? "Por hora" : "Por dia"} · {periodLabel}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="text-[10.5px] font-medium text-muted-foreground">Vendas aprovadas</span>
            </div>
          </div>
          <div className="px-3 md:px-4 py-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 16, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}
                  formatter={(value: number) => [fmt(value), "Receita"]}
                />
                <Area
                  type="monotone"
                  dataKey="vendas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#dashGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Por método */}
        <section className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
          <div className="px-5 md:px-7 py-4 border-b border-border/30">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70">Por Método</p>
            <p className="text-[10.5px] text-muted-foreground/70 mt-0.5">Conversão e receita</p>
          </div>
          <div className="divide-y divide-border/30">
            {/* PIX */}
            <div className="px-5 md:px-7 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">PIX</span>
                </div>
                <span className="text-[12px] font-bold text-primary tabular-nums">{pixConversion.toFixed(1)}%</span>
              </div>
              <div className="text-[18px] font-display font-black text-foreground tabular-nums tracking-tight">
                {privacy.hidden ? CENSORED : fmt(pixRevenue)}
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">{pixApprovedCount}/{pixTotalCount} aprovadas</p>
            </div>

            {/* Cartão */}
            <div className="px-5 md:px-7 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">Cartão</span>
                </div>
                <span className="text-[12px] font-bold text-primary tabular-nums">{cardConversion.toFixed(1)}%</span>
              </div>
              <div className="text-[18px] font-display font-black text-foreground tabular-nums tracking-tight">
                {privacy.hidden ? CENSORED : fmt(cardRevenue)}
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">{cardApprovedCount}/{cardTotalCount} aprovadas</p>
            </div>

            {/* Saques pendentes */}
            <div className="px-5 md:px-7 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-warning/15 flex items-center justify-center">
                    <DollarSign className="h-3.5 w-3.5 text-warning" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">Saques pendentes</span>
                </div>
                <span className="text-[12px] font-bold text-muted-foreground tabular-nums">
                  {withdrawals.filter(w => w.status === "pending").length}
                </span>
              </div>
              <div className="text-[18px] font-display font-black text-warning tabular-nums tracking-tight">
                {privacy.hidden ? CENSORED : fmt(withdrawalPending)}
              </div>
              <Link to="/financeiro/saques" className="text-[10.5px] text-primary font-semibold hover:underline mt-0.5 inline-block">
                Gerenciar &rsaquo;
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ─── BLOCO 3: AÇÕES RÁPIDAS + ATIVIDADE RECENTE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Ações rápidas */}
        <section className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 md:px-7 py-4 border-b border-border/30">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70">Ações Rápidas</p>
            <Link to="/vendas/produtos" className="text-[10.5px] text-muted-foreground hover:text-foreground font-medium">
              tudo
            </Link>
          </div>
          <div className="divide-y divide-border/30">
            {[
              { icon: Package, label: "Criar produto", to: "/vendas/produtos" },
              { icon: ShoppingCart, label: "Configurar checkout", to: "/vendas/checkout" },
              { icon: Users, label: "Convidar afiliados", to: "/vendas/afiliados" },
              { icon: Webhook, label: "Configurar integrações", to: "/integracoes" },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="flex items-center gap-3 px-5 md:px-7 py-3.5 hover:bg-muted/20 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-muted/40 border border-border/30 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                  <action.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="flex-1 text-[13px] font-semibold text-foreground">{action.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </section>

        {/* Atividade recente */}
        <section className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 md:px-7 py-4 border-b border-border/30">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70">Atividade Recente</p>
            <Link to="/vendas" className="text-[10.5px] text-primary hover:underline font-semibold inline-flex items-center gap-1">
              Ver tudo <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/30">
            {activity.length === 0 ? (
              <div className="px-5 md:px-7 py-10 text-center">
                <div className="mx-auto h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-[12px] text-muted-foreground">Nenhuma atividade ainda</p>
              </div>
            ) : (
              activity.map((item) => {
                const isCompleted = item.status === "completed" || item.status === "approved";
                const isPending = item.status === "pending";
                const isFailed = item.status === "refunded" || item.status === "chargeback" || item.status === "failed" || item.status === "rejected";
                const statusColor = isCompleted ? "bg-success" : isPending ? "bg-warning" : isFailed ? "bg-destructive" : "bg-muted-foreground";
                const statusLabel = isCompleted ? "Aprovada" : isPending ? "Pendente" : isFailed ? "Falhou" : item.status;
                const Icon = item.kind === "withdrawal" ? Wallet : item.paymentMethod === "pix" ? Zap : CreditCard;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.kind === "transaction") {
                        const tx = transactions.find(t => t.id === item.id);
                        if (tx) setDetailTx(tx);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-5 md:px-7 py-3.5 hover:bg-muted/20 transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-foreground tabular-nums">
                          {privacy.hidden ? CENSORED : fmt(item.amount)}
                        </span>
                        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider",
                          isCompleted && "bg-success/12 text-success",
                          isPending && "bg-warning/12 text-warning",
                          isFailed && "bg-destructive/12 text-destructive",
                          !isCompleted && !isPending && !isFailed && "bg-muted/40 text-muted-foreground"
                        )}>
                          <span className={cn("h-1 w-1 rounded-full", statusColor)} />
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">
                        {item.kind === "withdrawal"
                          ? `Saque · ${timeAgo(item.createdAt)}`
                          : `Venda · ${item.paymentMethod === "pix" ? "PIX" : item.paymentMethod === "credit_card" || item.paymentMethod === "card" ? "Cartão" : item.label} · ${timeAgo(item.createdAt)}`}
                      </p>
                    </div>
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
