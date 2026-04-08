import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  return <>{formatter(display)}</>;
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

  // Memoize all derived metrics to avoid recomputing on every render
  const { approved, pending, refunded, chargebacks, revenue, conversion, pixConversion, cardConversion, chargebackRate, pixRevenue, cardRevenue, pixApprovedCount, pixTotalCount, cardApprovedCount, cardTotalCount } = useMemo(() => {
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

    return {
      approved: _approved, pending: _pending, refunded: _refunded, chargebacks: _chargebacks,
      revenue: _revenue, conversion: _conversion,
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

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">

      {/* ─── GREEN FIRE BORDER EFFECT ─── */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-primary/40 via-primary/10 to-transparent animate-pulse" />
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-primary/60" style={{ width: `${Math.random() * 6 + 2}px`, height: `${Math.random() * 6 + 2}px`, left: `${Math.random() * 100}%`, bottom: `${Math.random() * 30}%`, animation: `fireParticle ${1 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards` }} />
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
            <button onClick={() => setShowScalePopup(false)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted z-10"><X className="h-4 w-4 text-muted-foreground" /></button>
            <div className="relative p-8 md:p-10 text-center">
              <div className="mx-auto mb-6 h-24 w-24 rounded-full bg-primary/15 flex items-center justify-center ring-4 ring-primary/10"><Rocket className="h-12 w-12 text-primary" /></div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/25 px-4 py-1.5 mb-5"><Flame className="h-4 w-4 text-primary" /><span className="text-xs font-bold text-primary uppercase tracking-wider">Modo Escala Ativado</span></div>
              <h2 className="text-2xl md:text-3xl font-display font-black text-foreground mb-4 leading-tight tracking-[-0.04em]">MODO ESCALA<br /><span className="text-gradient">ATIVADO!</span></h2>
              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed mb-6">
                <p className="font-bold text-foreground text-base">AGORA É SANGUE NOS OLHOS!</p>
                <p>O futuro de luxo já está lá, falta <strong className="text-foreground">VOCÊ</strong> alcançar — e sabemos que irá conseguir!</p>
                <p>E estaremos <strong className="text-primary">juntos com você</strong> nessa jornada!</p>
              </div>
              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 mb-6">
                <div className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" /><div className="text-left"><p className="text-sm font-bold text-foreground mb-1">Suporte Prioritário Ativado</p><p className="text-xs text-muted-foreground">No Modo Escala, o suporte e a fluidez da plataforma estarão 100% disponíveis para você. Qualquer ajuda para escalar que precisar, pode nos chamar!</p></div></div>
              </div>
              <p className="text-lg font-display font-black text-primary mb-6">RUMO À LUA!</p>
              <button onClick={() => setShowScalePopup(false)} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">BORA ESCALAR!</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HERO — DASHBOARD COMMAND CENTER                                  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative mb-10 rounded-2xl border border-border/50 bg-card/95 p-6 sm:p-8 lg:p-10"
      >

        <div className="relative z-10">
          {/* Top controls bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
            <div className="flex items-center gap-3">
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }} className="inline-flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center glow-primary">
                  <BarChart3 className="h-4.5 w-4.5 text-primary" />
                </div>
                <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Dashboard</span>
              </motion.div>
              {nickname && (
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 backdrop-blur-sm">
                  <Crown className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-heading text-primary">{nickname}</span>
                </div>
              )}
              <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 shadow-[0_0_16px_rgba(34,197,94,0.12)] backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />
                  <span className="relative h-2 w-2 rounded-full bg-success shadow-[0_0_12px_rgba(34,197,94,0.8)]" />
                </span>
                <span className="text-[8px] font-heading uppercase tracking-[0.25em] text-success">Tempo Real</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Scale Mode Button */}
              {scaleModeUnlocked ? (
                <button onClick={activateScaleMode} className={`flame-btn group relative inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[10px] font-heading transition-all active:scale-[0.97] ${scaleMode ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"}`}>
                  {[0, 1, 2, 3, 4].map((i) => (<span key={i} className="flame-tip" style={{ left: `${20 + i * 15}%`, width: `${3 + Math.random() * 3}px`, height: `${3 + Math.random() * 3}px`, ['--dur' as string]: `${0.6 + i * 0.15}s`, ['--delay' as string]: `${i * 0.12}s` }} />))}
                  <Flame className={`h-3.5 w-3.5 ${scaleMode ? "animate-pulse" : "group-hover:animate-pulse"}`} />
                  <span className="leading-tight">Escala</span>
                </button>
              ) : (
                <div className="flame-btn group relative inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[10px] font-heading border border-primary/30 bg-primary/10 text-primary cursor-not-allowed">
                  {[0, 1, 2, 3, 4].map((i) => (<span key={i} className="flame-tip" style={{ left: `${20 + i * 15}%`, width: `${3 + Math.random() * 3}px`, height: `${3 + Math.random() * 3}px`, ['--dur' as string]: `${0.6 + i * 0.15}s`, ['--delay' as string]: `${i * 0.12}s` }} />))}
                  <Lock className="h-3.5 w-3.5" />
                  <span className="leading-tight">Escala</span>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-60 rounded-xl bg-card border border-border p-3 text-center shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    <p className="text-[11px] font-bold text-foreground mb-1">Modo Escala Bloqueado</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Liberado ao atingir R$ 2.000 em 24h.</p>
                  </div>
                </div>
              )}

              {/* Period selector */}
              <div className="inline-flex items-center rounded-full glass-panel p-0.5">
                {PERIOD_PRESETS.map((opt) => (
                  <button key={opt.label} onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                    className={cn("rounded-full px-3.5 py-1.5 text-[10px] font-heading transition-all duration-400 active:scale-[0.97]",
                      !isCustom && selectedPeriod.label === opt.label ? "bg-primary text-primary-foreground shadow-[0_2px_16px_rgba(16,185,129,0.3)] glow-primary" : "text-muted-foreground/35 hover:text-foreground/70"
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button className={cn("h-8 rounded-full border px-3.5 text-[10px] font-heading transition-all active:scale-[0.97]",
                    isCustom ? "border-primary/20 bg-primary/8 text-primary" : "border-border/10 text-muted-foreground/30 hover:text-foreground hover:border-border/20"
                  )}>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" />
                      {isCustom && customRange?.from
                        ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
                        : "Custom"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto overflow-hidden rounded-2xl border border-border/15 bg-card/95 backdrop-blur-xl p-0 shadow-2xl">
                  <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-3 pointer-events-auto" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
                </PopoverContent>
              </Popover>
              <button onClick={privacy.toggle} className={cn("h-8 w-8 rounded-full transition-all active:scale-[0.97] border border-transparent hover:border-border/10", privacy.hidden ? "text-primary bg-primary/8 glow-primary" : "text-muted-foreground/25 hover:text-foreground")} title={privacy.hidden ? "Mostrar" : "Ocultar"}>
                {privacy.hidden ? <EyeOff className="mx-auto h-3.5 w-3.5" /> : <Eye className="mx-auto h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* MAIN FOCAL POINT — Revenue */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground">
                {isCustom && customRange?.from
                  ? `Receita ${customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")}`
                  : `Receita — ${selectedPeriod.label}`}
              </p>
            </div>
            <div className="flex items-end gap-5 mb-3">
              <span className="text-5xl sm:text-7xl lg:text-[100px] font-heading tabular-nums text-foreground leading-[0.82]">
                {privacy.hidden ? "R$ •••••••" : <AnimatedNumber value={revenue} duration={1000} />}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground rounded-full border border-border/40 bg-card/80 px-3 py-1.5">
                <Check className="h-3 w-3 text-success" /> {approved.length} aprovadas
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground rounded-full border border-border/40 bg-card/80 px-3 py-1.5">
                <Clock3 className="h-3 w-3 text-warning" /> {pending.length} pendentes
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground rounded-full border border-border/40 bg-card/80 px-3 py-1.5">
                <Target className="h-3 w-3" /> {conversion.toFixed(1)}% conversão
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground rounded-full border border-border/40 bg-card/80 px-3 py-1.5">
                <Wallet className="h-3 w-3 text-primary" /> saldo {privacy.hidden ? CENSORED : fmt(Math.abs(balance))}
              </span>
            </div>
          </motion.div>

          {/* Executive KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Faturado", numValue: revenue, formatter: fmt, color: "primary", icon: ShoppingCart },
              { label: "Vendas Aprovadas", numValue: approved.length, formatter: (v: number) => String(Math.round(v)), color: "success", icon: TrendingUp },
              { label: "Taxa Conversão", numValue: conversion, formatter: (v: number) => `${v.toFixed(1)}%`, color: "info", icon: Target },
              { label: "Saldo Disponível", numValue: Math.abs(balance), formatter: fmt, color: balance < 0 ? "warning" : "primary", icon: Wallet },
            ].map((item, idx) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 + idx * 0.06 }}
                className="group relative rounded-xl border border-border/50 bg-card/95 p-5 overflow-hidden transition-all hover:border-border/70 hover:shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground/50 mb-2">{item.label}</p>
                    <p className={cn("text-2xl font-heading tabular-nums tracking-tight leading-none", item.color === "primary" ? "text-foreground" : `text-${item.color}`)}>{privacy.hidden ? CENSORED : <AnimatedNumber value={item.numValue} formatter={item.formatter} />}</p>
                  </div>
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border", `bg-${item.color}/8 border-${item.color}/15 text-${item.color}/60`)}>
                    <item.icon className="h-4.5 w-4.5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CHART + KPIs                                                     */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-12 mb-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="xl:col-span-8 rounded-xl border border-border/50 bg-card/95 p-4 md:p-6 min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.18)" fontSize={11} interval={chartData.length > 10 ? Math.ceil(chartData.length / 8) - 1 : 0} />
              <YAxis tickLine={false} axisLine={false} width={72} stroke="hsl(var(--muted-foreground) / 0.18)" fontSize={11} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k` : `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} />
              <Tooltip
                contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: "12px", fontSize: "13px", color: "var(--tooltip-text)", padding: "10px 14px", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
                formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Receita"]}
                cursor={{ stroke: "hsl(var(--primary) / 0.16)", strokeDasharray: "4 4" }}
              />
              <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#dashboardRevenue)" dot={false} activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <div className="xl:col-span-4 flex flex-col gap-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border/50 bg-card/95 p-4 md:p-5">
            <div className="grid grid-cols-1 gap-2">
              <SmallMetric icon={<Percent className="h-3.5 w-3.5" />} label="Conv. PIX" value={`${pixConversion.toFixed(1)}%`} tone="success" />
              <SmallMetric icon={<CreditCard className="h-3.5 w-3.5" />} label="Conv. Cartão" value={`${cardConversion.toFixed(1)}%`} tone="info" />
              <SmallMetric icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Med. Chargeback" value={`${chargebackRate.toFixed(2)}%`} tone={chargebackRate > 1 ? "destructive" : "success"} />
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Zap, label: "PIX", numValue: pixRevenue, helper: privacy.hidden ? "••••" : `${pixConversion.toFixed(1)}% · ${pixApprovedCount}/${pixTotalCount}`, color: "success" },
              { icon: CreditCard, label: "CARTÃO", numValue: cardRevenue, helper: privacy.hidden ? "••••" : `${cardConversion.toFixed(1)}% · ${cardApprovedCount}/${cardTotalCount}`, color: "info" },
              { icon: Wallet, label: "TICKET MÉDIO", numValue: approved.length > 0 ? revenue / approved.length : 0, helper: "Por transação", color: "primary" },
              { icon: DollarSign, label: "PENDENTE", numValue: withdrawalPending, helper: privacy.hidden ? "••••" : `${withdrawals.filter(w => w.status === "pending").length} solicitações`, color: "warning" },
            ].map((item, idx) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + idx * 0.04 }}
                className="group relative rounded-xl border border-border/50 bg-card/95 p-3.5 md:p-4 overflow-hidden flex flex-col justify-between min-h-[130px] transition-all hover:border-border/70 hover:shadow-sm">
                <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", `bg-${item.color}`)} />
                <div className="pl-1.5 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-auto">
                    <span className="text-[10px] font-heading uppercase tracking-[0.14em] text-muted-foreground/30">{item.label}</span>
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center ring-1 ring-border/20", `bg-${item.color}/8 text-${item.color}/60`)}>
                      <item.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-auto">
                    <p className="text-[22px] font-heading tabular-nums tracking-tight text-foreground leading-none">{privacy.hidden ? CENSORED : <AnimatedNumber value={item.numValue} />}</p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground/25 font-mono">{item.helper}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ACTIONS + ACTIVITY                                               */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2 mb-6">
        {/* Quick actions */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border/50 bg-card/95 p-4 md:p-5 flex flex-col">
          <div className="grid grid-cols-2 gap-2 md:gap-2.5 flex-1">
            {[
              { label: "Criar Produto", href: "/vendas/produtos", icon: Package, desc: "Novo infoproduto" },
              { label: "Área De Membros", href: "/vendas/conteudo", icon: Layers, desc: "Módulos e aulas" },
              { label: "Checkout", href: "/vendas/checkout", icon: CreditCard, desc: "Links de pagamento" },
              { label: "Vendas", href: "/vendas", icon: BarChart3, desc: "Relatório" },
              { label: "Extrato", href: "/financeiro/extrato", icon: FileText, desc: "Fluxo financeiro" },
              { label: "Saques", href: "/financeiro/saques", icon: ArrowDownRight, desc: "Transferir saldo" },
              { label: "Webhooks", href: "/vendas/webhooks", icon: Webhook, desc: "Automações" },
              { label: "Meu Perfil", href: "/perfil", icon: User, desc: "Dados da conta" },
              { label: "API Docs", href: "/vendas/documentacao", icon: BookOpen, desc: "Documentação" },
              { label: "Cursos", href: "/membros", icon: GraduationCap, desc: "Minhas compras" },
            ].map((action) => (
              <Link key={action.href} to={action.href}
                className="group flex items-center gap-2.5 md:gap-3 rounded-xl border border-border/40 bg-card/60 p-2.5 md:p-3.5 transition-all duration-200 hover:border-border/60 hover:bg-card/80 active:scale-[0.985]">
                <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-primary/8 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/12">
                  <action.icon className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] md:text-sm font-display font-bold text-foreground leading-tight">{action.label}</p>
                  <p className="text-[10px] md:text-[11px] text-muted-foreground/30 hidden md:block">{action.desc}</p>
                </div>
                <ChevronRight className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground/15 hidden md:block group-hover:text-primary/40 transition-colors" />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-xl border border-border/50 bg-card/95 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-primary opacity-30" />
                <span className="relative h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
              </span>
              <p className="text-[12px] font-heading text-muted-foreground/40">Tempo real</p>
            </div>
            <Link to="/financeiro/extrato" className="text-[11px] font-heading text-muted-foreground/25 hover:text-primary transition-colors">Ver tudo</Link>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-2.5 space-y-1.5">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <p className="text-sm text-muted-foreground/30 font-display">Sem movimentações ainda</p>
              </div>
            ) : (
              activity.map((item) => {
                const txStyles: Record<string, { label: string; pill: string; iconBg: string; iconText: string }> = {
                  completed: { label: "Aprovada", pill: "bg-success/15 text-success", iconBg: "bg-success/10", iconText: "text-success" },
                  pending: { label: "Pendente", pill: "bg-warning/15 text-warning", iconBg: "bg-warning/10", iconText: "text-warning" },
                  failed: { label: "Falhou", pill: "bg-destructive/15 text-destructive", iconBg: "bg-destructive/10", iconText: "text-destructive" },
                  refunded: { label: "Reembolso", pill: "bg-info/15 text-info", iconBg: "bg-info/10", iconText: "text-info" },
                  chargeback: { label: "Chargeback", pill: "bg-destructive/15 text-destructive", iconBg: "bg-destructive/10", iconText: "text-destructive" },
                  default: { label: "Status", pill: "bg-muted text-foreground", iconBg: "bg-muted/20", iconText: "text-muted-foreground" },
                };
                const wdStyles: Record<string, { label: string; pill: string; iconBg: string; iconText: string }> = {
                  pending: { label: "Em análise", pill: "bg-warning/15 text-warning", iconBg: "bg-warning/10", iconText: "text-warning" },
                  approved: { label: "Aprovado", pill: "bg-success/15 text-success", iconBg: "bg-success/10", iconText: "text-success" },
                  rejected: { label: "Rejeitado", pill: "bg-destructive/15 text-destructive", iconBg: "bg-destructive/10", iconText: "text-destructive" },
                  default: { label: "Saque", pill: "bg-muted text-foreground", iconBg: "bg-muted/20", iconText: "text-muted-foreground" },
                };
                const styles = item.kind === "transaction" ? txStyles[item.status] || txStyles.default : wdStyles[item.status] || wdStyles.default;
                const borderColor: Record<string, string> = { completed: "border-l-success", pending: "border-l-warning", failed: "border-l-destructive", refunded: "border-l-info", chargeback: "border-l-destructive", approved: "border-l-success", rejected: "border-l-destructive" };
                const fullTx = item.kind === "transaction" ? transactions.find(t => t.id === item.id) ?? null : null;

                return (
                  <div key={item.id}
                    className={cn("group relative flex items-center gap-3 rounded-xl border-l-[3px] px-3.5 py-3 transition-all duration-300 hover:bg-primary/[0.03]", borderColor[item.status] || "border-l-muted-foreground")}>
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-border/10 shadow-sm", styles.iconBg, styles.iconText)}>
                      {item.kind === "transaction" ? <DollarSign className="h-4.5 w-4.5" /> : <Wallet className="h-4.5 w-4.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-display font-black text-foreground tabular-nums tracking-[-0.02em]">{privacy.hidden ? CENSORED : fmt(item.amount)}</p>
                        <span className={cn("h-2 w-2 rounded-full shadow-[0_0_6px_currentColor] animate-pulse", styles.iconBg, styles.iconText)} />
                      </div>
                      <p className="text-[11px] text-muted-foreground/40 truncate mt-0.5 font-display">{item.kind === "transaction" ? `Venda • ${item.label}` : item.label}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {fullTx && (
                        <button onClick={() => setDetailTx(fullTx)} className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-foreground hover:bg-muted/20 transition-all" title="Ver detalhes">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className="text-[10px] text-muted-foreground/20 font-mono tabular-nums min-w-[28px] text-right">{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </section>

      <Dialog open={!!detailTx} onOpenChange={(open) => !open && setDetailTx(null)}>
        <DialogContent className="sm:max-w-md border-border/40 bg-card backdrop-blur-xl p-0 gap-0 overflow-hidden">
          {detailTx && (() => {
            const statusMap: Record<string, { label: string; color: string }> = {
              completed: { label: "Aprovada", color: "bg-success/15 text-success" },
              pending: { label: "Pendente", color: "bg-warning/15 text-warning" },
              failed: { label: "Falhou", color: "bg-destructive/15 text-destructive" },
              refunded: { label: "Reembolso", color: "bg-info/15 text-info" },
              chargeback: { label: "Chargeback", color: "bg-destructive/15 text-destructive" },
            };
            const s = statusMap[detailTx.status] || { label: detailTx.status, color: "bg-muted text-foreground" };
            const productName = productsData?.find(p => p.id === detailTx.product_id)?.name;

            return (
              <div>
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold text-foreground tabular-nums">{fmt(Number(detailTx.amount))}</p>
                    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${s.color}`}>{s.label}</span>
                  </div>
                  {productName && <p className="text-[13px] text-muted-foreground mt-1">{productName}</p>}
                </div>

                {/* Details grid */}
                <div className="px-6 py-4 space-y-3">
                  {detailTx.customer_name && (
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cliente</p>
                        <p className="text-sm font-medium text-foreground truncate">{detailTx.customer_name}</p>
                      </div>
                    </div>
                  )}
                  {detailTx.customer_email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
                        <p className="text-sm font-medium text-foreground truncate">{detailTx.customer_email}</p>
                      </div>
                    </div>
                  )}
                  {detailTx.customer_phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Telefone</p>
                        <p className="text-sm font-medium text-foreground">{detailTx.customer_phone}</p>
                      </div>
                    </div>
                  )}

                  {/* Financial breakdown */}
                  <div className="rounded-xl border border-border/30 bg-muted/5 p-3 mt-1 space-y-2">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-muted-foreground">Bruto</span>
                      <span className="font-semibold text-foreground tabular-nums">{fmt(Number(detailTx.amount))}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-muted-foreground">Taxas</span>
                      <span className="font-semibold text-destructive tabular-nums">- {fmt(Number(detailTx.fee_amount))}</span>
                    </div>
                    <div className="border-t border-border/20 pt-2 flex justify-between text-[13px]">
                      <span className="font-semibold text-foreground">Líquido</span>
                      <span className="font-bold text-primary tabular-nums">{fmt(Number(detailTx.net_amount))}</span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 pt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      {detailTx.payment_method === "credit_card" ? "Cartão" : detailTx.payment_method === "pix" ? "PIX" : detailTx.payment_method || "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {new Date(detailTx.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/40 font-mono truncate pt-1">ID: {detailTx.id}</p>
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

type Tone = "primary" | "info" | "success" | "warning" | "destructive";

const toneMap: Record<Tone, { bg: string; text: string }> = {
  primary: { bg: "bg-primary/12", text: "text-primary" },
  info: { bg: "bg-info/12", text: "text-info" },
  success: { bg: "bg-success/12", text: "text-success" },
  warning: { bg: "bg-warning/12", text: "text-warning" },
  destructive: { bg: "bg-destructive/12", text: "text-destructive" },
};

function MiniHeroCard({ icon, label, value, tone, idx = 0 }: { icon: React.ReactNode; label: string; value: string; tone: Tone; idx?: number }) {
  const accentBar: Record<Tone, string> = {
    primary: "bg-primary",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };

  return (
    <div className={`group relative rounded-xl border border-border/60 bg-card/95 shadow-sm backdrop-blur-md p-3.5 md:p-5 transition-all duration-300 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 overflow-hidden animate-fade-in ${STAGGER_CLASSES[idx + 1] || ""}`}>
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-full ${accentBar[tone]}`} />
      <div className="relative z-10 pl-1.5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`h-7 w-7 md:h-8 md:w-8 rounded-lg flex items-center justify-center ${toneMap[tone].bg} ring-1 ring-border/20`}>
            <span className={toneMap[tone].text}>{icon}</span>
          </div>
          <span className="text-[9px] md:text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold truncate">{label}</span>
        </div>
        <p className="text-xl md:text-2xl lg:text-[28px] font-display font-black tracking-[-0.03em] text-foreground tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function KpiTile({ icon, label, value, helper, tone, delay }: { icon: React.ReactNode; label: string; value: string; helper: string; tone: Tone; delay?: string }) {
  const accentBar: Record<Tone, string> = {
    primary: "bg-primary",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };

  return (
    <div className={`group relative rounded-2xl border border-border/60 bg-card/95 shadow-sm backdrop-blur-md p-3.5 md:p-4 transition-all duration-300 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 overflow-hidden animate-fade-in flex flex-col justify-between min-h-[130px] ${delay || ""}`}>
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-full ${accentBar[tone]}`} />
      <div className="pl-1.5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-auto">
          <span className="text-[10px] md:text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-extrabold">{label}</span>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${toneMap[tone].bg} ring-1 ring-border/20`}>
            <span className={toneMap[tone].text}>{icon}</span>
          </div>
        </div>
        <div className="mt-auto">
          <p className="text-[22px] md:text-[26px] font-display font-black tracking-[-0.03em] text-foreground tabular-nums leading-none">{value}</p>
          <p className="mt-1.5 text-[10px] md:text-[11px] text-muted-foreground/70 font-medium">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function QualityLine({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "success" | "warning" | "destructive" | "info" }) {
  const styles: Record<string, { bg: string; text: string; ring: string }> = {
    success: { bg: "bg-success/10", text: "text-success", ring: "ring-success/20" },
    warning: { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/20" },
    destructive: { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/20" },
    info: { bg: "bg-info/10", text: "text-info", ring: "ring-info/20" },
  };

  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border/40 bg-muted/10 px-4 py-3.5 transition-all duration-200 hover:bg-muted/20 hover:border-border/60">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ring-1 ${styles[tone].bg} ${styles[tone].text} ${styles[tone].ring}`}>{icon}</div>
      <span className="flex-1 text-[13px] font-semibold text-foreground/80">{label}</span>
      <span className="text-base font-display font-black text-foreground tabular-nums tracking-tight">{value}</span>
    </div>
  );
}

function SmallMetric({ icon, label, value, tone = "info" }: { icon: React.ReactNode; label: string; value: string; tone?: "success" | "info" | "destructive" }) {
  const tStyles: Record<string, { text: string; valueTxt: string }> = {
    success: { text: "text-success", valueTxt: "text-success" },
    info: { text: "text-info", valueTxt: "text-foreground" },
    destructive: { text: "text-destructive", valueTxt: "text-destructive" },
  };
  const s = tStyles[tone] || tStyles.info;

  return (
    <div className="group rounded-xl border border-border/40 bg-muted/10 p-3 transition-all duration-200 hover:bg-muted/20 hover:border-border/60">
      <div className="mb-1.5 flex items-center gap-2">
        <span className={s.text}>{icon}</span>
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg md:text-xl font-display font-black tracking-tight tabular-nums ${s.valueTxt}`}>{value}</p>
    </div>
  );
}
