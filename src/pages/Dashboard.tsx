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

  return (
    <div className="dashboard-page mx-auto w-full max-w-[1320px] pb-24 px-4 md:px-10 lg:px-14 relative selection:bg-primary/15">
      {/* Hairline grid background — institutional signature */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025]" aria-hidden style={{ backgroundImage: "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "72px 72px" }} />
      {/* Soft ambient glow — luxury accent */}
      <div className="pointer-events-none absolute top-0 right-0 -z-10 h-[480px] w-[480px] rounded-full bg-primary/[0.04] blur-[140px]" aria-hidden />
      <div className="pointer-events-none absolute top-[600px] left-0 -z-10 h-[400px] w-[400px] rounded-full bg-primary/[0.025] blur-[120px]" aria-hidden />

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
              <div className="mx-auto mb-6 relative h-28 w-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDuration: '2.5s' }} />
                <div className="absolute inset-2 rounded-full border border-primary/15 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center ring-4 ring-primary/15 shadow-lg shadow-primary/20">
                  <Rocket className="h-10 w-10 text-primary drop-shadow-lg" />
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/25 px-4 py-1.5 mb-4">
                <Flame className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Modo Escala Desbloqueado</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-black text-foreground mb-3 leading-tight tracking-[-0.04em]">
                MODO ESCALA<br /><span className="text-gradient">ATIVADO! 🔥</span>
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed mb-6">
                <p className="font-bold text-foreground text-base">Você atingiu a elite dos vendedores!</p>
                <p>R$ 2.000 em 24h comprovam: você tem <strong className="text-primary">mentalidade de escala</strong>. Poucos chegam aqui — e você é um deles.</p>
                <p>A partir de agora, cada venda te aproxima do <strong className="text-foreground">próximo nível</strong>. Sem limites.</p>
              </div>
              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 mb-6">
                <div className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" /><div className="text-left"><p className="text-sm font-bold text-foreground mb-1">Suporte Prioritário Ativado</p><p className="text-xs text-muted-foreground">No Modo Escala, o suporte e a fluidez da plataforma estarão 100% disponíveis para você. Qualquer ajuda para escalar que precisar, pode nos chamar!</p></div></div>
              </div>
              <p className="text-lg font-display font-black text-primary mb-6">O CÉU NÃO É O LIMITE 🚀</p>
              <button onClick={() => setShowScalePopup(false)} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.97]">BORA DOMINAR!</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HOTZFY · ULTRA PREMIUM DASHBOARD · 4K                            */}
      {/* Direto ao ponto: dados, gráficos, decisões.                       */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative py-7 md:py-9"
      >
        {/* ─────────────────────────────────────────────────────────────── */}
        {/* COMMAND BAR · Compacta, institucional, direto ao controle        */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <header className="mb-8 md:mb-10">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Identity block */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative h-10 w-10 rounded-[9px] bg-foreground text-background flex items-center justify-center shrink-0 shadow-[0_4px_14px_-4px_hsl(var(--foreground)/0.35),inset_0_1px_0_hsl(var(--background)/0.15)]">
                <span className="font-display font-black text-[15px] tracking-[-0.06em] leading-none">H</span>
                <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-success ring-[2px] ring-background">
                  <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-[14px] text-foreground tracking-[-0.02em] leading-none">HOTZFY</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-foreground/[0.06] border border-foreground/[0.06] text-[8.5px] font-mono uppercase tracking-[0.16em] text-foreground/65 font-bold">
                    <span className="h-1 w-1 rounded-full bg-success animate-pulse" />
                    Live
                  </span>
                </div>
                <span className="hidden md:inline-block mt-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/80 tabular-nums">
                  {format(new Date(), "EEE · dd MMM yyyy · HH:mm", { locale: ptBR })}
                </span>
              </div>
            </div>

            {/* Controls — single rail */}
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {productsData && productsData.length > 0 && (
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="h-10 w-[200px] text-[12px] font-semibold rounded-[8px] border-foreground/[0.12] bg-card/60 backdrop-blur-xl hover:border-foreground/30 hover:bg-foreground/[0.025] transition-all shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {productsData.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="inline-flex items-center rounded-[8px] border border-foreground/[0.12] bg-card/60 backdrop-blur-xl overflow-hidden shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]">
                {PERIOD_PRESETS.map((opt, idx) => (
                  <button
                    key={opt.label}
                    onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                    className={cn(
                      "px-3.5 h-10 text-[10.5px] font-bold uppercase tracking-[0.1em] transition-all",
                      idx > 0 && "border-l border-foreground/[0.08]",
                      !isCustom && selectedPeriod.label === opt.label
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "px-3 h-10 text-[10.5px] font-bold transition-all border-l border-foreground/[0.08] inline-flex items-center gap-1.5",
                        isCustom ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                      )}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
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
              </div>

              <button
                onClick={privacy.toggle}
                className="h-10 w-10 inline-flex items-center justify-center rounded-[8px] border border-foreground/[0.12] bg-card/60 backdrop-blur-xl text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-foreground/[0.025] transition-all shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]"
                title={privacy.hidden ? "Mostrar valores" : "Ocultar valores"}
              >
                {privacy.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* TREASURY · Receita líquida + Saldo (premium 4K)                  */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="mb-7 md:mb-9">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
            {/* Receita líquida — bloco principal */}
            <div className="lg:col-span-8 relative rounded-[20px] border border-foreground/[0.09] bg-card overflow-hidden shadow-[0_1px_0_hsl(var(--foreground)/0.04),0_24px_60px_-24px_hsl(var(--foreground)/0.18)] group/block">
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.025] via-transparent to-transparent pointer-events-none" />
              <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-primary/[0.06] blur-[120px] pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />

              <div className="relative px-7 md:px-10 lg:px-12 pt-9 pb-9 md:pt-11 md:pb-11">
                <div className="flex items-start justify-between gap-4 mb-8">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-mono text-[9.5px] font-bold text-muted-foreground uppercase tracking-[0.24em]">Receita Líquida</span>
                      <span className="h-px w-8 bg-foreground/20" />
                      <span className="font-mono text-[9.5px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em]">{selectedPeriod.label}</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground/80 leading-relaxed">Total apurado · valores em reais (BRL)</p>
                  </div>
                  <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/[0.1] border border-success/20 text-[9.5px] font-mono uppercase tracking-[0.16em] text-success font-bold shrink-0 mt-1 shadow-[0_0_12px_-2px_hsl(var(--success)/0.3)]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                    </span>
                    Apurado
                  </div>
                </div>

                <div className="font-display font-semibold text-foreground tabular-nums leading-[0.92] tracking-[-0.055em] text-[60px] md:text-[92px] lg:text-[116px]">
                  {privacy.hidden ? (
                    <span className="text-foreground/20">{CENSORED}</span>
                  ) : (
                    <span className="inline-flex items-baseline gap-3">
                      <span className="text-[0.28em] font-medium text-muted-foreground/60 self-start mt-3 tracking-normal">R$</span>
                      <span className="bg-gradient-to-br from-foreground via-foreground/95 to-foreground/70 bg-clip-text text-transparent drop-shadow-[0_2px_24px_hsl(var(--foreground)/0.08)]">
                        <AnimatedNumber value={revenue} formatter={(v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                      </span>
                    </span>
                  )}
                </div>

                <div className="mt-12 grid grid-cols-3 border-t border-foreground/[0.08]">
                  {[
                    { label: "TPV bruto", code: "GMV", value: privacy.hidden ? CENSORED : fmt(approved.reduce((a, t) => a + Number(t.amount), 0)) },
                    { label: "MDR efetivo", code: "MDR", value: (() => { const gross = approved.reduce((a, t) => a + Number(t.amount), 0); const fees = approved.reduce((a, t) => a + Number(t.fee_amount), 0); return gross > 0 ? `${((fees / gross) * 100).toFixed(2)}%` : "0,00%"; })() },
                    { label: "Ticket médio", code: "AOV", value: privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0) },
                  ].map((m, i) => (
                    <div key={i} className={cn("py-7 pr-4 group/stat", i > 0 && "pl-7 border-l border-foreground/[0.08]")}>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="font-mono text-[8.5px] font-bold text-muted-foreground/80 tracking-[0.22em]">{m.code}</span>
                        <span className="text-[10px] text-muted-foreground/30">·</span>
                        <span className="text-[10px] font-medium text-muted-foreground tracking-tight uppercase">{m.label}</span>
                      </div>
                      <p className="text-[20px] md:text-[24px] font-display font-semibold text-foreground tabular-nums tracking-[-0.028em] leading-none transition-transform group-hover/stat:translate-x-0.5 duration-300">{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-9 flex flex-wrap items-center gap-2.5">
                  <Link to="/financeiro/saques" className="group/cta inline-flex items-center gap-2 h-11 px-5 rounded-[9px] bg-foreground text-background text-[12px] font-bold hover:bg-foreground/90 transition-all shadow-[0_4px_14px_-4px_hsl(var(--foreground)/0.45),inset_0_1px_0_hsl(var(--background)/0.15)] hover:shadow-[0_8px_24px_-4px_hsl(var(--foreground)/0.55),inset_0_1px_0_hsl(var(--background)/0.15)] hover:-translate-y-px">
                    <Wallet className="h-4 w-4" />
                    Solicitar saque
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5" />
                  </Link>
                  <Link to="/vendas" className="inline-flex items-center gap-2 h-11 px-5 rounded-[9px] border border-foreground/[0.14] bg-card/40 backdrop-blur text-foreground text-[12px] font-bold hover:bg-foreground/[0.04] hover:border-foreground/30 transition-all">
                    Ver transações
                  </Link>
                  <span className="ml-auto hidden md:inline font-mono text-[9.5px] text-muted-foreground/60 tracking-[0.18em] uppercase">
                    REF · {format(new Date(), "yyyyMMdd")}
                  </span>
                </div>
              </div>
            </div>

            {/* Saldo / Liquidação */}
            <div className="lg:col-span-4 relative rounded-[20px] border border-foreground/[0.09] bg-card overflow-hidden shadow-[0_1px_0_hsl(var(--foreground)/0.04),0_24px_60px_-24px_hsl(var(--foreground)/0.18)] group/balance">
              <div className="absolute inset-0 bg-gradient-to-bl from-foreground/[0.03] via-transparent to-transparent pointer-events-none" />
              <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-primary/[0.05] blur-[100px] pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />

              <div className="relative px-7 md:px-9 pt-9 pb-9 md:pt-11 md:pb-11 flex flex-col gap-7 h-full">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[9.5px] font-bold text-muted-foreground uppercase tracking-[0.24em]">Saldo Disponível</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/[0.1] border border-success/20 font-mono text-[9px] font-bold text-success tracking-[0.16em] uppercase shadow-[0_0_10px_-2px_hsl(var(--success)/0.3)]">
                      <span className="h-1 w-1 rounded-full bg-success" />
                      Free
                    </span>
                  </div>
                  <p className="font-display font-semibold tabular-nums leading-[0.95] tracking-[-0.04em] text-[40px] md:text-[50px]">
                    {privacy.hidden ? (
                      <span className="text-foreground/20">{CENSORED}</span>
                    ) : (
                      <span className="bg-gradient-to-br from-foreground via-foreground/95 to-foreground/70 bg-clip-text text-transparent">
                        <AnimatedNumber value={balance} />
                      </span>
                    )}
                  </p>
                  <p className="mt-3 text-[11.5px] text-muted-foreground/85 leading-relaxed">Liquidez imediata · saque em D+0 via PIX</p>
                </div>

                <div className="border-t border-foreground/[0.08] pt-6 space-y-5 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning shadow-[0_0_6px_hsl(var(--warning)/0.6)]" />
                        <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.2em]">Em análise</p>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground/65 mt-1 ml-3">Saques em processamento</p>
                    </div>
                    <p className="text-[16px] font-display font-semibold text-foreground tabular-nums tracking-tight">
                      {privacy.hidden ? CENSORED : fmt(withdrawalPending)}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-info shadow-[0_0_6px_hsl(var(--info)/0.6)]" />
                        <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.2em]">Reserva técnica</p>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground/65 mt-1 ml-3">Liberação programada · D+30</p>
                    </div>
                    <p className="text-[16px] font-display font-semibold text-foreground tabular-nums tracking-tight">
                      {privacy.hidden ? CENSORED : fmt(transactions.filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0).reduce((a, t) => a + Number(t.retained_amount), 0))}
                    </p>
                  </div>
                </div>

                <Link to="/financeiro/saques" className="border-t border-foreground/[0.08] pt-4 flex items-center justify-between hover:px-1 transition-all group/link">
                  <span className="text-[10px] font-mono text-muted-foreground tracking-[0.18em] uppercase font-bold group-hover/link:text-foreground transition-colors">Conta operacional</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover/link:text-foreground group-hover/link:translate-x-0.5 transition-all" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* KPIs · Indicadores operacionais (premium tiles)                  */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="mb-7 md:mb-9">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            <EditorialKpi label="Taxa de aprovação" code="APR" value={privacy.hidden ? CENSORED : `${conversion.toFixed(1)}%`} sub={`${approved.length} de ${filteredTx.length} processadas`} accent={conversion >= 80 ? "success" : conversion >= 60 ? "warning" : "destructive"} />
            <EditorialKpi label="Chargeback" code="CBK" value={privacy.hidden ? CENSORED : `${chargebackRate.toFixed(2)}%`} sub={`${chargebacks.length} ${chargebacks.length === 1 ? "disputa" : "disputas"} · meta < 1%`} accent={chargebackRate < 1 ? "success" : chargebackRate < 2 ? "warning" : "destructive"} />
            <EditorialKpi label="Pagamentos pendentes" code="PND" value={pending.length.toString()} sub="Aguardando captura" accent={pending.length > 5 ? "warning" : "neutral"} />
            <EditorialKpi label="Clientes únicos" code="CST" value={uniqueCustomers.toString()} sub="No período" accent="neutral" />
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* CHART · Série histórica (premium 4K)                             */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="mb-7 md:mb-9">
          <div className="relative rounded-[20px] border border-foreground/[0.09] bg-card overflow-hidden shadow-[0_1px_0_hsl(var(--foreground)/0.04),0_24px_60px_-24px_hsl(var(--foreground)/0.18)]">
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />

            <div className="relative px-7 md:px-10 pt-8 pb-6 flex items-end justify-between gap-6 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-[9.5px] font-bold text-muted-foreground uppercase tracking-[0.24em]">Série Histórica</span>
                  <span className="h-px w-8 bg-foreground/20" />
                  <span className="font-mono text-[9.5px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em]">Volume</span>
                </div>
                <p className="font-display font-semibold tabular-nums tracking-[-0.04em] text-[34px] md:text-[44px] leading-none">
                  {privacy.hidden ? <span className="text-foreground/20">{CENSORED}</span> : (
                    <span className="inline-flex items-baseline gap-2 bg-gradient-to-br from-foreground via-foreground/95 to-foreground/70 bg-clip-text text-transparent">
                      <span className="text-[0.4em] font-medium text-muted-foreground/70 not-italic">R$</span>
                      {revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </p>
                <p className="text-[11.5px] text-muted-foreground/85 mt-3">
                  {selectedPeriod.label === "Hoje" ? "Distribuição por hora · America/São Paulo" : `Distribuição diária · últimos ${selectedPeriod.days} dias`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/[0.05] border border-foreground/[0.08]">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                  <span className="font-bold tracking-[0.14em] text-foreground/85">Receita líquida</span>
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/[0.025] border border-foreground/[0.06] tabular-nums font-medium">
                  {chartData.length} pts
                </span>
              </div>
            </div>

            <div className="relative h-[320px] md:h-[400px] px-3 pb-5 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="institutional-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.32} />
                      <stop offset="55%" stopColor="hsl(var(--foreground))" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="institutional-stroke" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0.7} />
                    </linearGradient>
                    <pattern id="grid-pattern" width="56" height="56" patternUnits="userSpaceOnUse">
                      <path d="M 56 0 L 0 0 0 56" fill="none" stroke="hsl(var(--foreground))" strokeOpacity="0.04" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: "hsl(var(--muted-foreground))", fontWeight: 600, letterSpacing: "0.05em" }} tickLine={false} axisLine={false} dy={8} />
                  <YAxis tick={{ fontSize: 10.5, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`} width={48} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.3, strokeDasharray: "3 3" }}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--foreground) / 0.18)", borderRadius: 10, fontSize: 12.5, fontWeight: 500, padding: "12px 16px", boxShadow: "0 24px 48px -12px hsl(var(--foreground) / 0.28)" }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 700, marginBottom: 6 }}
                    formatter={(v: number) => [privacy.hidden ? CENSORED : fmt(v), "Receita"]}
                  />
                  <Area type="monotone" dataKey="vendas" stroke="url(#institutional-stroke)" strokeWidth={2.25} fill="url(#institutional-grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* CHANNELS + ACTIVITY                                              */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5 mb-10">
          <div className="lg:col-span-3 relative rounded-[20px] border border-foreground/[0.09] bg-card overflow-hidden shadow-[0_1px_0_hsl(var(--foreground)/0.04),0_24px_60px_-24px_hsl(var(--foreground)/0.18)]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
            <div className="px-7 md:px-9 pt-7 pb-5 border-b border-foreground/[0.06]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9.5px] font-bold text-muted-foreground uppercase tracking-[0.24em]">Canais</span>
                <span className="h-px w-8 bg-foreground/20" />
                <span className="font-mono text-[9.5px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em]">Mix de Pagamento</span>
              </div>
            </div>
            <div className="divide-y divide-foreground/[0.06]">
              <EditorialChannelRow index="01" name="PIX" approved={pixApprovedCount} total={pixTotalCount} revenue={pixRevenue} approvalRate={pixConversion} share={revenue > 0 ? (pixRevenue / revenue) * 100 : 0} privacy={privacy.hidden} />
              <EditorialChannelRow index="02" name="Cartão de crédito" approved={cardApprovedCount} total={cardTotalCount} revenue={cardRevenue} approvalRate={cardConversion} share={revenue > 0 ? (cardRevenue / revenue) * 100 : 0} privacy={privacy.hidden} />
              <EditorialChannelRow
                index="03"
                name="Boleto"
                approved={filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").length}
                total={filteredTx.filter(t => t.payment_method === "boleto").length}
                revenue={filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0)}
                approvalRate={(() => { const total = filteredTx.filter(t => t.payment_method === "boleto").length; const ok = filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").length; return total > 0 ? (ok / total) * 100 : 0; })()}
                share={(() => { const rev = filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0); return revenue > 0 ? (rev / revenue) * 100 : 0; })()}
                privacy={privacy.hidden}
              />
            </div>
          </div>

          <div className="lg:col-span-2 relative rounded-[20px] border border-foreground/[0.09] bg-card overflow-hidden shadow-[0_1px_0_hsl(var(--foreground)/0.04),0_24px_60px_-24px_hsl(var(--foreground)/0.18)]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
            <div className="px-6 md:px-7 pt-7 pb-5 border-b border-foreground/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9.5px] font-bold text-muted-foreground uppercase tracking-[0.24em]">Atividade</span>
                <span className="h-px w-8 bg-foreground/20" />
                <span className="font-mono text-[9.5px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em]">Recente</span>
              </div>
              <Link to="/vendas" className="font-mono text-[9.5px] uppercase font-bold text-muted-foreground hover:text-foreground tracking-[0.18em] inline-flex items-center gap-1.5 transition-colors group">
                Ver tudo <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {activity.length === 0 ? (
              <div className="px-5 py-20 text-center">
                <div className="mx-auto h-10 w-10 rounded-full bg-foreground/[0.04] border border-foreground/[0.06] flex items-center justify-center mb-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-[11.5px] text-muted-foreground font-medium">Sem atividade no período</p>
              </div>
            ) : (
              <div className="divide-y divide-foreground/[0.06]">
                {activity.slice(0, 6).map((item, idx) => {
                  const isWithdrawal = item.kind === "withdrawal";
                  const dotColor = item.status === "completed" || item.status === "approved" ? "bg-success shadow-[0_0_8px_hsl(var(--success)/0.6)]"
                    : item.status === "pending" ? "bg-warning shadow-[0_0_8px_hsl(var(--warning)/0.6)]"
                    : item.status === "refunded" || item.status === "chargeback" || item.status === "rejected" ? "bg-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.6)]"
                    : "bg-muted-foreground/40";
                  const labelText = isWithdrawal ? "Saque solicitado"
                    : (item.label === "pix" ? "PIX"
                      : item.label === "credit_card" || item.label === "card" ? "Cartão"
                        : item.label === "boleto" ? "Boleto" : "Pagamento");

                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      onClick={() => {
                        if (!isWithdrawal) {
                          const tx = transactions.find(t => t.id === item.id);
                          if (tx) setDetailTx(tx);
                        }
                      }}
                      className="w-full flex items-center gap-3.5 px-6 py-4 hover:bg-foreground/[0.025] transition-colors text-left group"
                    >
                      <span className="font-mono text-[9.5px] font-bold text-muted-foreground/50 tracking-[0.12em] tabular-nums w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                      <span className={cn("h-2 w-2 rounded-full shrink-0 ring-2 ring-background", dotColor)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate group-hover:translate-x-0.5 transition-transform">{labelText}</p>
                        <p className="text-[10.5px] text-muted-foreground mt-0.5 font-mono tracking-tight">
                          {item.id.slice(0, 8).toUpperCase()} · {timeAgo(item.createdAt)}
                        </p>
                      </div>
                      <p className="text-[14px] font-display font-semibold text-foreground tabular-nums tracking-tight shrink-0">
                        {privacy.hidden ? CENSORED : fmt(item.amount)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* COLOPHON                                                          */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <footer className="pt-7 mt-2 border-t border-foreground/[0.08]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-5 rounded-[5px] bg-foreground text-background flex items-center justify-center">
                <span className="font-display font-black text-[9px] tracking-[-0.06em] leading-none">H</span>
              </div>
              <span className="font-display font-bold text-[11px] text-foreground tracking-[-0.01em]">HOTZFY</span>
              <span className="h-2.5 w-px bg-foreground/15" />
              <span className="font-mono text-[9.5px] text-muted-foreground uppercase tracking-[0.18em]">Capital Operations · Treasury</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="tabular-nums">REF · {format(new Date(), "yyyyMMdd-HHmm")}</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                </span>
                Uptime 99.99%
              </span>
            </div>
          </div>
        </footer>
      </motion.div>

      <Dialog open={!!detailTx} onOpenChange={(open) => !open && setDetailTx(null)}>
        <DialogContent className="sm:max-w-[460px] border-border/20 bg-card p-0 gap-0 overflow-hidden rounded-[20px]">
          {detailTx && (() => {
            const statusMap: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
              completed: { label: "Aprovada", color: "text-success", bg: "bg-success/10", border: "border-success/20", dot: "bg-success" },
              pending: { label: "Pendente", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", dot: "bg-warning" },
              failed: { label: "Falhou", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", dot: "bg-destructive" },
              refunded: { label: "Reembolso", color: "text-info", bg: "bg-info/10", border: "border-info/20", dot: "bg-info" },
              chargeback: { label: "Chargeback", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", dot: "bg-destructive" },
            };
            const s = statusMap[detailTx.status] || { label: detailTx.status, color: "text-foreground", bg: "bg-muted/10", border: "border-border/20", dot: "bg-muted-foreground" };
            const productName = productsData?.find(p => p.id === detailTx.product_id)?.name;

            return (
              <div>
                {/* Header */}
                <div className="relative px-7 pt-8 pb-6 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent pointer-events-none" />
                  <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold border", s.color, s.bg, s.border)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                        {s.label}
                      </span>
                      {detailTx.payment_method && (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold text-muted-foreground border border-border/20 bg-muted/5">
                          <CreditCard className="h-3 w-3" />
                          {detailTx.payment_method === "credit_card" ? "Cartão" : detailTx.payment_method === "pix" ? "PIX" : detailTx.payment_method}
                        </span>
                      )}
                    </div>
                    <p className="text-4xl font-heading font-black text-foreground tabular-nums tracking-tight leading-none">{fmt(Number(detailTx.amount))}</p>
                    {productName && <p className="text-[13px] text-muted-foreground/70 mt-2">{productName}</p>}
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

                {/* Dados do cliente */}
                <div className="px-7 py-5 space-y-3.5">
                  {[
                    { show: !!detailTx.customer_name, icon: User, label: "Cliente", value: detailTx.customer_name },
                    { show: !!detailTx.customer_email, icon: Mail, label: "Email", value: detailTx.customer_email },
                    { show: !!detailTx.customer_phone, icon: Phone, label: "Telefone", value: detailTx.customer_phone },
                  ].filter(f => f.show).map((field, i) => (
                    <div key={i} className="flex items-center gap-3.5 group">
                      <div className="h-10 w-10 rounded-xl bg-primary/8 border border-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/12 transition-colors">
                        <field.icon className="h-4 w-4 text-primary/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground/40">{field.label}</p>
                        <p className="text-[13px] font-semibold text-foreground truncate mt-0.5">{field.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

                {/* Financial breakdown */}
                <div className="px-7 py-5">
                  <div className="rounded-xl border border-border/15 bg-gradient-to-b from-muted/5 to-transparent p-4 space-y-3">
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-muted-foreground/70">Valor bruto</span>
                      <span className="font-semibold text-foreground tabular-nums">{fmt(Number(detailTx.amount))}</span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-muted-foreground/70">Taxas da plataforma</span>
                      <span className="font-semibold text-destructive/80 tabular-nums">- {fmt(Number(detailTx.fee_amount))}</span>
                    </div>
                    <div className="border-t border-border/10 pt-3 flex justify-between items-center">
                      <span className="text-[13px] font-bold text-foreground">Valor líquido</span>
                      <span className="font-black text-primary tabular-nums text-[18px] font-heading tracking-tight">{fmt(Number(detailTx.net_amount))}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-7 pb-6 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
                    <Clock3 className="h-3 w-3" />
                    {new Date(detailTx.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </span>
                  <p className="text-[9px] text-muted-foreground/25 font-mono truncate max-w-[180px]">ID: {detailTx.id}</p>
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
    <div className={`group relative rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-3 md:p-4 transition-all duration-300 hover:border-border/80 hover:bg-card/80 shadow-sm hover:shadow-md overflow-hidden animate-fade-in ${STAGGER_CLASSES[idx + 1] || ""}`}>
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
    <div className={`group relative rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-3.5 md:p-4 transition-all duration-300 hover:border-border/80 hover:bg-card/80 shadow-sm hover:shadow-md overflow-hidden animate-fade-in flex flex-col justify-between min-h-[130px] ${delay || ""}`}>
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
          <p className="mt-1.5 text-[10px] md:text-[11px] text-muted-foreground/80 font-medium">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function PixLogoMark({ className, variant = "teal" }: { className?: string; variant?: "teal" | "white" }) {
  const color = variant === "white" ? "hsl(var(--primary-foreground))" : "hsl(173 58% 47%)";

  return (
    <svg
      viewBox="538 29 73 73"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
      className={cn("select-none", className)}
      style={{ color }}
    >
      <path
        d="m 596.82737,86.620206 c -3.08045,0 -5.97782,-1.19944 -8.15622,-3.37679 l -11.77678,-11.77713 c -0.82691,-0.82903 -2.26801,-0.82656 -3.09456,0 l -11.81982,11.82017 c -2.17841,2.17734 -5.07577,3.37679 -8.15623,3.37679 h -2.32092 l 14.9158,14.915444 c 4.65807,4.65808 12.21069,4.65808 16.86912,0 l 14.95813,-14.958484 z"
        fill="currentColor"
      />
      <path
        d="m 553.82362,44.963326 c 3.08046,0 5.97782,1.19944 8.15622,3.37679 l 11.81982,11.82193 c 0.85125,0.85161 2.2412,0.85479 3.09457,-10e-4 l 11.77678,-11.77784 c 2.1784,-2.17735 5.07576,-3.37679 8.15622,-3.37679 h 1.41852 l -14.95778,-14.95813 c -4.65878,-4.658432 -12.2114,-4.658432 -16.86948,0 l -14.91509,14.91509 z"
        fill="currentColor"
      />
      <path
        d="m 610.61844,57.378776 -9.03922,-9.03922 c -0.19897,0.0797 -0.41452,0.12946 -0.64206,0.12946 h -4.10986 c -2.12478,0 -4.20476,0.86184 -5.70618,2.36432 l -11.77643,11.77678 c -1.10207,1.10208 -2.55022,1.65347 -3.99697,1.65347 -1.44815,0 -2.89524,-0.55139 -3.99697,-1.65241 l -11.82088,-11.82088 c -1.50142,-1.50283 -3.5814,-2.36431 -5.70618,-2.36431 h -5.05354 c -0.21555,0 -0.41698,-0.0508 -0.60713,-0.12242 l -9.07521,9.07521 c -4.65843,4.65843 -4.65843,12.2107 0,16.86913 l 9.07486,9.07485 c 0.1905,-0.0716 0.39193,-0.12241 0.60748,-0.12241 h 5.05354 c 2.12478,0 4.20476,-0.86148 5.70618,-2.36396 l 11.81982,-11.81982 c 2.13643,-2.13466 5.8607,-2.13537 7.995,0.001 l 11.77643,11.77573 c 1.50142,1.50248 3.5814,2.36431 5.70618,2.36431 h 4.10986 c 0.22754,0 0.44309,0.0497 0.64206,0.12947 l 9.03922,-9.03922 c 4.65808,-4.65843 4.65808,-12.2107 0,-16.86913"
        fill="currentColor"
      />
    </svg>
  );
}

/* ─── Gateway dashboard sub-components ─── */

function GatewayKpi({ label, value, sub, tone, trend }: { label: string; value: string; sub: string; tone: "primary" | "success" | "warning" | "destructive" | "info"; trend: "up" | "down" | "neutral" }) {
  const toneAccent: Record<string, string> = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    info: "bg-info",
  };
  const toneText: Record<string, string> = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    info: "text-info",
  };

  return (
    <div className="relative rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 overflow-hidden hover:border-border transition-colors">
      <div className={cn("absolute left-0 top-0 bottom-0 w-[2px]", toneAccent[tone])} />
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.16em]">{label}</p>
        {trend === "up" && <ArrowUpRight className={cn("h-3 w-3", toneText[tone])} strokeWidth={2.5} />}
        {trend === "down" && <ArrowDownRight className="h-3 w-3 text-destructive" strokeWidth={2.5} />}
      </div>
      <p className="text-[22px] md:text-[24px] font-display font-black text-foreground tabular-nums tracking-[-0.03em] leading-none">{value}</p>
      <p className="text-[10.5px] text-muted-foreground/60 font-medium mt-2">{sub}</p>
    </div>
  );
}

function PaymentMethodRow({ name, approved, total, revenue, approvalRate, share, privacy, tone }: { name: string; approved: number; total: number; revenue: number; approvalRate: number; share: number; privacy: boolean; tone: "success" | "info" | "warning" }) {
  const toneAccent: Record<string, string> = {
    success: "bg-success",
    info: "bg-info",
    warning: "bg-warning",
  };

  return (
    <div className="px-5 py-3.5 hover:bg-muted/10 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-sm", toneAccent[tone])} />
          <p className="text-[12.5px] font-bold text-foreground">{name}</p>
        </div>
        <p className="text-[13px] font-display font-black text-foreground tabular-nums tracking-tight">
          {privacy ? CENSORED : fmt(revenue)}
        </p>
      </div>
      <div className="flex items-center gap-4 text-[10.5px] text-muted-foreground/70 font-semibold mb-2">
        <span><span className="text-foreground/80 font-bold tabular-nums">{approved}</span> / {total} aprovadas</span>
        <span>Aprovação <span className="text-foreground/80 font-bold tabular-nums">{approvalRate.toFixed(1)}%</span></span>
        <span className="ml-auto">Share <span className="text-foreground/80 font-bold tabular-nums">{share.toFixed(1)}%</span></span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted/30 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", toneAccent[tone])} style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
    </div>
  );
}

function RiskRow({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "neutral" | "warning" | "destructive" }) {
  const toneText: Record<string, string> = {
    neutral: "text-foreground",
    warning: "text-warning",
    destructive: "text-destructive",
  };

  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-foreground/80">{label}</p>
        <p className="text-[10px] text-muted-foreground/60 font-medium truncate">{hint}</p>
      </div>
      <p className={cn("text-[15px] font-display font-black tabular-nums tracking-tight ml-3", toneText[tone])}>{value}</p>
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
  const tStyles: Record<string, { text: string; valueTxt: string; iconBg: string }> = {
    success: { text: "text-success", valueTxt: "text-success", iconBg: "bg-success/10" },
    info: { text: "text-info", valueTxt: "text-foreground", iconBg: "bg-info/10" },
    destructive: { text: "text-destructive", valueTxt: "text-destructive", iconBg: "bg-destructive/10" },
  };
  const s = tStyles[tone] || tStyles.info;

  return (
    <div className="dashboard-action-link flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", s.iconBg)}>
          <span className={s.text}>{icon}</span>
        </div>
        <span className="text-[11px] text-muted-foreground/70 font-semibold">{label}</span>
      </div>
      <p className={`text-lg font-display font-black tracking-tight tabular-nums ${s.valueTxt}`}>{value}</p>
    </div>
  );
}

/* ─── Editorial dashboard sub-components (premium 4K) ─── */

function EditorialKpi({ label, code, value, sub, accent }: { label: string; code?: string; value: string; sub: string; accent: "success" | "warning" | "destructive" | "neutral" }) {
  const accentDot: Record<string, string> = {
    success: "bg-success shadow-[0_0_10px_hsl(var(--success)/0.6)]",
    warning: "bg-warning shadow-[0_0_10px_hsl(var(--warning)/0.6)]",
    destructive: "bg-destructive shadow-[0_0_10px_hsl(var(--destructive)/0.6)]",
    neutral: "bg-muted-foreground/40",
  };
  const accentGlow: Record<string, string> = {
    success: "from-success/[0.04]",
    warning: "from-warning/[0.04]",
    destructive: "from-destructive/[0.04]",
    neutral: "from-foreground/[0.025]",
  };

  return (
    <div className="relative rounded-[18px] border border-foreground/[0.09] bg-card overflow-hidden shadow-[0_1px_0_hsl(var(--foreground)/0.04),0_18px_40px_-20px_hsl(var(--foreground)/0.15)] hover:shadow-[0_1px_0_hsl(var(--foreground)/0.04),0_28px_60px_-20px_hsl(var(--foreground)/0.22)] hover:-translate-y-px transition-all duration-300 group overflow-hidden">
      <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent pointer-events-none", accentGlow[accent])} />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/12 to-transparent" />
      {/* Hover sweep */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative px-6 py-7 md:px-7 md:py-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full transition-transform group-hover:scale-125", accentDot[accent])} />
            <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.2em] group-hover:text-foreground/85 transition-colors">{label}</p>
          </div>
          {code && <span className="font-mono text-[8.5px] font-bold text-muted-foreground/40 tracking-[0.22em] px-2 py-0.5 rounded-[4px] bg-foreground/[0.04]">{code}</span>}
        </div>
        <p className="font-display font-semibold tabular-nums tracking-[-0.045em] leading-none text-[34px] md:text-[42px] bg-gradient-to-br from-foreground via-foreground/95 to-foreground/70 bg-clip-text text-transparent transition-transform group-hover:translate-x-0.5 duration-300">
          {value}
        </p>
        <p className="mt-3.5 text-[11px] text-muted-foreground/85 font-medium leading-relaxed">{sub}</p>
      </div>
    </div>
  );
}

function EditorialChannelRow({ index, name, approved, total, revenue, approvalRate, share, privacy }: { index?: string; name: string; approved: number; total: number; revenue: number; approvalRate: number; share: number; privacy: boolean }) {
  return (
    <div className="px-7 md:px-9 py-5 md:py-6 hover:bg-foreground/[0.025] transition-colors group relative">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          {index && <span className="font-mono text-[10px] font-bold text-muted-foreground/45 tracking-[0.18em] tabular-nums shrink-0 group-hover:text-foreground/65 transition-colors">{index}</span>}
          <p className="text-[14px] md:text-[15px] font-semibold text-foreground tracking-tight truncate group-hover:translate-x-0.5 transition-transform">{name}</p>
        </div>
        <p className="text-[16px] md:text-[17px] font-display font-semibold text-foreground tabular-nums tracking-tight shrink-0">
          {privacy ? CENSORED : fmt(revenue)}
        </p>
      </div>
      <div className="flex items-center gap-3 text-[10.5px] font-mono text-muted-foreground mb-3.5 tracking-tight">
        <span className="uppercase tracking-[0.14em]"><span className="text-foreground font-bold tabular-nums">{approved}</span><span className="text-muted-foreground/50">/{total}</span></span>
        <span className="text-foreground/15">·</span>
        <span className="uppercase tracking-[0.14em]">APR <span className="text-foreground font-bold tabular-nums">{approvalRate.toFixed(1)}%</span></span>
        <span className="ml-auto uppercase tracking-[0.14em]">SHR <span className="text-foreground font-bold tabular-nums">{share.toFixed(1)}%</span></span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-foreground/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-foreground/85 to-foreground/55 transition-all duration-700 ease-out shadow-[0_0_12px_hsl(var(--foreground)/0.25)]" style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
    </div>
  );
}
