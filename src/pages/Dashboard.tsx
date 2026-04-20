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
    <div className="dashboard-page mx-auto w-full max-w-[1536px] pb-24 px-4 md:px-6 relative selection:bg-primary/20">
      {/* Decorative noise texture overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] contrast-150 brightness-150 z-[100] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

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
      {/* HOTZFY · EDITORIAL EXECUTIVE DASHBOARD                          */}
      {/* Identidade visual única — luxo discreto, tipografia editorial    */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative px-4 md:px-8 lg:px-12 py-8 md:py-12"
      >
        {/* Ambient signature glow */}
        <div className="pointer-events-none absolute inset-x-0 -top-20 h-[420px] -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[420px] w-[820px] rounded-full bg-primary/[0.07] blur-[120px]" />
          <div className="absolute right-[10%] top-[60px] h-[260px] w-[260px] rounded-full bg-info/[0.05] blur-[100px]" />
        </div>

        {/* ─────────────────────────────────────────────────────── */}
        {/* EDITORIAL HEADER · Magazine masthead style                */}
        {/* ─────────────────────────────────────────────────────── */}
        <header className="mb-10 md:mb-14">
          <div className="flex items-center justify-between gap-4 pb-5 border-b border-foreground/10">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-[0.32em]">
                Hotzfy
              </span>
              <span className="h-3 w-px bg-foreground/15" />
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-[0.28em]">
                Painel Executivo
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-[10px] font-medium text-muted-foreground/60 uppercase tracking-[0.24em]">
                {format(new Date(), "EEEE · dd MMM yyyy", { locale: ptBR })}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/5 px-2.5 py-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-success/50 animate-ping" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                <span className="text-[9px] font-bold text-success uppercase tracking-[0.2em]">Live</span>
              </span>
            </div>
          </div>

          {/* Editorial title block */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mt-8 md:mt-10">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-primary/80 uppercase tracking-[0.32em] mb-3">
                {selectedPeriod.label === "Hoje" ? "Edição de Hoje" : `Edição · ${selectedPeriod.label}`}
              </p>
              <h1 className="font-display font-black tracking-[-0.045em] leading-[0.92] text-[44px] md:text-[60px] lg:text-[72px]">
                {nickname ? (
                  <>
                    <span className="text-gradient-premium">Bem-vindo,</span><br />
                    <span className="italic font-medium text-foreground/70" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{nickname}</span>
                    <span className="text-primary animate-pulse">.</span>
                  </>
                ) : (
                  <>
                    <span className="text-gradient-premium">Painel</span><br />
                    <span className="italic font-medium text-foreground/70" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Executivo</span>
                    <span className="text-primary animate-pulse">.</span>
                  </>
                )}
              </h1>
              <p className="mt-5 max-w-xl text-[14px] text-muted-foreground leading-relaxed font-medium">
                Visão consolidada da sua operação em tempo real.
                {approved.length > 0 && (
                  <> <span className="text-foreground font-semibold">{approved.length}</span> {approved.length === 1 ? "transação aprovada" : "transações aprovadas"} no período.</>
                )}
              </p>
            </div>

            {/* Right: filters as refined controls */}
            <div className="flex flex-col items-stretch lg:items-end gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                {productsData && productsData.length > 0 && (
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="h-9 w-[160px] text-[11.5px] font-semibold rounded-full border-foreground/15 bg-background/50 backdrop-blur-xl hover:border-foreground/30 transition-colors">
                      <SelectValue placeholder="Todos produtos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os produtos</SelectItem>
                      {productsData.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <button
                  onClick={privacy.toggle}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-foreground/15 bg-background/50 backdrop-blur-xl text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                  title={privacy.hidden ? "Mostrar valores" : "Ocultar valores"}
                >
                  {privacy.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="inline-flex items-center rounded-full border border-foreground/10 bg-background/40 backdrop-blur-xl p-1">
                {PERIOD_PRESETS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-[10.5px] font-bold transition-all duration-300",
                      !isCustom && selectedPeriod.label === opt.label
                        ? "bg-foreground text-background shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.4)]"
                        : "text-muted-foreground/70 hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[10.5px] font-bold transition-all duration-300 inline-flex items-center gap-1.5",
                        isCustom ? "bg-foreground text-background shadow-[0_2px_8px_-2px_hsl(var(--foreground)/0.4)]" : "text-muted-foreground/70 hover:text-foreground"
                      )}
                    >
                      <CalendarDays className="h-3 w-3" />
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
            </div>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────── */}
        {/* HERO METRIC · The signature piece                         */}
        {/* ─────────────────────────────────────────────────────── */}
        <section className="relative mb-10 md:mb-14 group/hero">
          <div className="relative rounded-[32px] border border-foreground/10 bg-gradient-to-br from-card/90 via-card/70 to-card/50 backdrop-blur-3xl overflow-hidden shadow-[0_40px_100px_-30px_hsl(var(--primary)/0.25)] transition-all duration-500 hover:shadow-[0_50px_120px_-30px_hsl(var(--primary)/0.35)] mesh-gradient-hero">
            {/* Inner luxury accents */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_65%)] pointer-events-none" />
            <div className="absolute -top-40 -right-20 h-[460px] w-[460px] rounded-full bg-primary/[0.12] blur-[120px] pointer-events-none group-hover/hero:bg-primary/[0.18] transition-colors duration-700" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent opacity-50" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-30" />
            
            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-0 z-10">
              {/* Left: hero revenue */}
              <div className="lg:col-span-7 p-7 md:p-10 lg:p-12 lg:border-r border-foreground/[0.06]">
                <div className="flex items-center gap-2 mb-6">
                  <span className="h-px w-8 bg-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.32em]">Receita Líquida</span>
                </div>

                <div className="font-display font-black text-foreground tabular-nums leading-[0.88] tracking-[-0.05em] text-[56px] md:text-[80px] lg:text-[110px] drop-shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)] group-hover/hero:scale-[1.01] transition-transform duration-700 ease-out">
                  {privacy.hidden ? (
                    <span className="text-foreground/30">{CENSORED}</span>
                  ) : (
                    <div className="inline-flex items-baseline gap-2">
                      <span className="text-[0.4em] font-medium text-foreground/40 self-center">R$</span>
                      <AnimatedNumber value={revenue} formatter={(v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowUpRight className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
                    <span>TPV bruto <span className="text-foreground font-bold tabular-nums">{privacy.hidden ? CENSORED : fmt(approved.reduce((a, t) => a + Number(t.amount), 0))}</span></span>
                  </span>
                  <span className="text-foreground/20">·</span>
                  <span>MDR efetivo <span className="text-foreground font-bold tabular-nums">{(() => {
                    const gross = approved.reduce((a, t) => a + Number(t.amount), 0);
                    const fees = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
                    return gross > 0 ? `${((fees / gross) * 100).toFixed(2)}%` : "0,00%";
                  })()}</span></span>
                  <span className="text-foreground/20">·</span>
                  <span>Ticket médio <span className="text-foreground font-bold tabular-nums">{privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0)}</span></span>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to="/financeiro/saques"
                    className="group inline-flex items-center gap-2 h-11 px-5 rounded-full bg-foreground text-background text-[12.5px] font-bold tracking-tight shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.5)] hover:shadow-[0_12px_32px_-8px_hsl(var(--foreground)/0.6)] transition-all"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Sacar saldo
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    to="/vendas"
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-foreground/15 text-foreground text-[12.5px] font-bold tracking-tight hover:bg-foreground/5 transition-all"
                  >
                    Ver vendas
                  </Link>
                </div>
              </div>

              {/* Right: signature side panel — Saldo + Liquidação */}
              <div className="lg:col-span-5 p-7 md:p-10 lg:p-12 bg-gradient-to-b from-transparent to-foreground/[0.02] flex flex-col justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <span className="h-px w-8 bg-foreground/20" />
                    <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-[0.32em]">Saldo Disponível</span>
                  </div>
                  <p className="font-display font-black text-foreground tabular-nums leading-none tracking-[-0.04em] text-[40px] md:text-[48px]">
                    {privacy.hidden ? <span className="text-foreground/30">{CENSORED}</span> : <AnimatedNumber value={balance} />}
                  </p>
                  <p className="mt-3 text-[11.5px] text-muted-foreground/70 font-medium">
                    Pronto para saque imediato
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-px bg-foreground/[0.08] rounded-2xl overflow-hidden">
                  <div className="bg-card/60 backdrop-blur-xl p-5">
                    <p className="text-[9.5px] font-bold text-muted-foreground/60 uppercase tracking-[0.22em] mb-2">Em análise</p>
                    <p className="text-[20px] font-display font-black text-foreground tabular-nums tracking-[-0.03em] leading-none">
                      {privacy.hidden ? CENSORED : fmt(withdrawalPending)}
                    </p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground/60 font-medium">Saques processando</p>
                  </div>
                  <div className="bg-card/60 backdrop-blur-xl p-5">
                    <p className="text-[9.5px] font-bold text-muted-foreground/60 uppercase tracking-[0.22em] mb-2">Retido</p>
                    <p className="text-[20px] font-display font-black text-foreground tabular-nums tracking-[-0.03em] leading-none">
                      {privacy.hidden ? CENSORED : fmt(transactions.filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0).reduce((a, t) => a + Number(t.retained_amount), 0))}
                    </p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground/60 font-medium">Reserva segurança</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────── */}
        {/* PERFORMANCE STRIP · Editorial KPI row                     */}
        {/* ─────────────────────────────────────────────────────── */}
        <section className="mb-10 md:mb-14">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-[11px] font-bold text-foreground/60 uppercase tracking-[0.28em]">
              <span className="text-primary mr-2">01</span> Performance Operacional
            </h2>
            <span className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-[0.2em]">indicadores chave</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/[0.06] rounded-2xl overflow-hidden border border-foreground/10">
            <EditorialKpi
              label="Aprovação"
              value={privacy.hidden ? CENSORED : `${conversion.toFixed(1)}%`}
              sub={`${approved.length} de ${filteredTx.length} processadas`}
              accent={conversion >= 80 ? "success" : conversion >= 60 ? "warning" : "destructive"}
            />
            <EditorialKpi
              label="Chargeback"
              value={privacy.hidden ? CENSORED : `${chargebackRate.toFixed(2)}%`}
              sub={`${chargebacks.length} ${chargebacks.length === 1 ? "disputa" : "disputas"} · meta < 1%`}
              accent={chargebackRate < 1 ? "success" : chargebackRate < 2 ? "warning" : "destructive"}
            />
            <EditorialKpi
              label="Pendentes"
              value={pending.length.toString()}
              sub="Aguardando captura"
              accent={pending.length > 5 ? "warning" : "neutral"}
            />
            <EditorialKpi
              label="Clientes únicos"
              value={uniqueCustomers.toString()}
              sub="No período selecionado"
              accent="neutral"
            />
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────── */}
        {/* CHART · Editorial canvas                                  */}
        {/* ─────────────────────────────────────────────────────── */}
        <section className="mb-10 md:mb-14">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-[11px] font-bold text-foreground/60 uppercase tracking-[0.28em]">
              <span className="text-primary mr-2">02</span> Volume Processado
            </h2>
            <div className="flex items-center gap-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.2em]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Receita líquida
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/10 bg-card/40 backdrop-blur-xl overflow-hidden">
            <div className="px-6 md:px-8 pt-6 pb-2">
              <p className="font-display font-black text-foreground tabular-nums tracking-[-0.04em] text-[32px] md:text-[40px] leading-none">
                {privacy.hidden ? CENSORED : fmt(revenue)}
              </p>
              <p className="text-[11.5px] text-muted-foreground/60 font-medium mt-2">
                {selectedPeriod.label === "Hoje" ? "Distribuição por hora" : `Distribuição diária · últimos ${selectedPeriod.days} dias`}
              </p>
            </div>
            <div className="h-[260px] md:h-[300px] px-3 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="editorial-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`} width={44} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, fontWeight: 600, boxShadow: "0 12px 40px -12px hsl(var(--primary)/0.2)" }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}
                    formatter={(v: number) => [privacy.hidden ? CENSORED : fmt(v), "Receita"]}
                  />
                  <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2.25} fill="url(#editorial-grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────── */}
        {/* PAYMENT METHODS + RECENT ACTIVITY                         */}
        {/* ─────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
          {/* Payment methods column */}
          <div className="lg:col-span-3">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-[11px] font-bold text-foreground/60 uppercase tracking-[0.28em]">
                <span className="text-primary mr-2">03</span> Canais de Pagamento
              </h2>
              <span className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-[0.2em]">{filteredTx.length} processadas</span>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/40 backdrop-blur-xl overflow-hidden divide-y divide-foreground/[0.06]">
              <EditorialChannelRow
                name="PIX"
                approved={pixApprovedCount}
                total={pixTotalCount}
                revenue={pixRevenue}
                approvalRate={pixConversion}
                share={revenue > 0 ? (pixRevenue / revenue) * 100 : 0}
                privacy={privacy.hidden}
              />
              <EditorialChannelRow
                name="Cartão de Crédito"
                approved={cardApprovedCount}
                total={cardTotalCount}
                revenue={cardRevenue}
                approvalRate={cardConversion}
                share={revenue > 0 ? (cardRevenue / revenue) * 100 : 0}
                privacy={privacy.hidden}
              />
              <EditorialChannelRow
                name="Boleto"
                approved={filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").length}
                total={filteredTx.filter(t => t.payment_method === "boleto").length}
                revenue={filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0)}
                approvalRate={(() => {
                  const total = filteredTx.filter(t => t.payment_method === "boleto").length;
                  const ok = filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").length;
                  return total > 0 ? (ok / total) * 100 : 0;
                })()}
                share={(() => {
                  const rev = filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0);
                  return revenue > 0 ? (rev / revenue) * 100 : 0;
                })()}
                privacy={privacy.hidden}
              />
            </div>
          </div>

          {/* Recent activity column */}
          <div className="lg:col-span-2">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-[11px] font-bold text-foreground/60 uppercase tracking-[0.28em]">
                <span className="text-primary mr-2">04</span> Atividade
              </h2>
              <Link to="/vendas" className="text-[10px] text-muted-foreground/60 hover:text-foreground font-semibold uppercase tracking-[0.2em] transition-colors inline-flex items-center gap-1">
                Tudo <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-card/40 backdrop-blur-xl overflow-hidden">
              {activity.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <div className="mx-auto h-10 w-10 rounded-full bg-foreground/[0.04] flex items-center justify-center mb-3">
                    <Activity className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                  <p className="text-[11.5px] text-muted-foreground/50 font-medium">Sem atividade no momento</p>
                </div>
              ) : (
                <div className="divide-y divide-foreground/[0.06]">
                  {activity.slice(0, 6).map((item) => {
                    const isWithdrawal = item.kind === "withdrawal";
                    const dotColor = item.status === "completed" || item.status === "approved" ? "bg-success"
                      : item.status === "pending" ? "bg-warning"
                      : item.status === "refunded" || item.status === "chargeback" || item.status === "rejected" ? "bg-destructive"
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
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-foreground/[0.03] transition-colors text-left group"
                      >
                        <span className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-foreground truncate">{labelText}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono tracking-tight">
                            {item.id.slice(0, 8)} · {timeAgo(item.createdAt)}
                          </p>
                        </div>
                        <p className="text-[12.5px] font-display font-black text-foreground tabular-nums tracking-tight shrink-0">
                          {privacy.hidden ? CENSORED : fmt(item.amount)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────── */}
        {/* EDITORIAL FOOTER                                          */}
        {/* ─────────────────────────────────────────────────────── */}
        <footer className="flex items-center justify-between pt-6 mt-2 border-t border-foreground/10">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.32em]">Hotzfy</span>
            <span className="h-3 w-px bg-foreground/15" />
            <span className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-[0.24em]">Painel Executivo · Edição {format(new Date(), "MMM yyyy", { locale: ptBR })}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-[0.24em]">
            <span className="h-1 w-1 rounded-full bg-success animate-pulse" />
            Sistema operacional
          </span>
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

/* ─── Editorial dashboard sub-components ─── */

function EditorialKpi({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: "success" | "warning" | "destructive" | "neutral" }) {
  const accentDot: Record<string, string> = {
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    neutral: "bg-foreground/30",
  };
  const accentText: Record<string, string> = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    neutral: "text-foreground",
  };

  return (
    <div className="relative bg-card/60 backdrop-blur-xl px-6 py-8 hover:bg-card/80 transition-all duration-300 group overflow-hidden">
      <div className="flex items-center gap-2.5 mb-5">
        <span className={cn("h-1.5 w-1.5 rounded-full transition-transform duration-300 group-hover:scale-125", accentDot[accent])} />
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.24em] group-hover:text-foreground/80 transition-colors">{label}</p>
      </div>
      <p className={cn("font-display font-black tabular-nums tracking-[-0.04em] leading-none text-[28px] md:text-[36px] transition-transform duration-300 group-hover:translate-x-1", accentText[accent])}>
        {value}
      </p>
      <p className="mt-2.5 text-[10.5px] text-muted-foreground/60 font-medium leading-relaxed">{sub}</p>
    </div>
  );
}

function EditorialChannelRow({ name, approved, total, revenue, approvalRate, share, privacy }: { name: string; approved: number; total: number; revenue: number; approvalRate: number; share: number; privacy: boolean }) {
  return (
    <div className="px-5 md:px-6 py-5 hover:bg-foreground/[0.02] transition-colors">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[13.5px] font-display font-black text-foreground tracking-[-0.02em]">{name}</p>
        <p className="text-[15px] font-display font-black text-foreground tabular-nums tracking-[-0.03em]">
          {privacy ? CENSORED : fmt(revenue)}
        </p>
      </div>
      <div className="flex items-center gap-4 text-[10.5px] text-muted-foreground/70 font-semibold mb-3">
        <span><span className="text-foreground/80 font-bold tabular-nums">{approved}</span><span className="text-muted-foreground/40">/{total}</span> aprovadas</span>
        <span className="text-foreground/15">·</span>
        <span>Aprovação <span className="text-foreground/80 font-bold tabular-nums">{approvalRate.toFixed(1)}%</span></span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">Share <span className="text-foreground/80 font-bold tabular-nums">{share.toFixed(1)}%</span></span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-foreground/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-foreground/80 transition-all duration-500" style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
    </div>
  );
}
