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

  return (
    <div className="dashboard-page mx-auto w-full max-w-[1440px] pb-24 px-1 relative">

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
          <div className="absolute inset-0 bg-background/80" onClick={() => setShowScalePopup(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-primary/30 bg-card animate-scale-in overflow-hidden">
            <button onClick={() => setShowScalePopup(false)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted z-10"><X className="h-4 w-4 text-muted-foreground" /></button>
             <div className="relative p-8 md:p-10 text-center">
              <div className="mx-auto mb-6 relative h-28 w-28 flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                  <Rocket className="h-10 w-10 text-primary" />
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
      {/* HERO — ONE DOMINANT METRIC                                       */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="dashboard-panel dashboard-panel-primary relative mb-5 rounded-[24px]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-background/70" />
        {/* Corner brackets — premium frame detail */}
        <div className="pointer-events-none absolute top-3 left-3 h-3 w-3 border-l border-t border-foreground/20 rounded-tl-md" />
        <div className="pointer-events-none absolute top-3 right-3 h-3 w-3 border-r border-t border-foreground/20 rounded-tr-md" />
        <div className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 border-l border-b border-foreground/20 rounded-bl-md" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-r border-b border-foreground/20 rounded-br-md" />

        {/* Toolbar */}
        <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-border/30 px-6 py-4 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-primary/15 to-primary/5 border border-primary/20 text-primary">
              <BarChart3 className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <span className="font-display text-[13px] font-bold tracking-[-0.01em] text-foreground">Dashboard</span>
            {scaleModeUnlocked && (
              <button onClick={activateScaleMode} className={cn("ml-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all",
                scaleMode ? "border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/10" : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground hover:border-primary/30"
              )}>
                <Flame className={cn("h-3 w-3", scaleMode && "animate-pulse")} />
                Escala
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="dashboard-toolbar-shell inline-flex items-center rounded-xl p-0.5">
              {PERIOD_PRESETS.map((opt) => (
                <button key={opt.label} onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                  className={cn("rounded-lg px-3 py-1.5 text-[11px] font-display font-black uppercase tracking-wider transition-all duration-300",
                    !isCustom && selectedPeriod.label === opt.label ? "dashboard-segment-active text-foreground" : "dashboard-segment-muted hover:text-foreground"
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button className={cn("h-8 rounded-xl border px-3 text-[10px] font-black uppercase tracking-wider transition-all inline-flex items-center gap-1.5",
                  isCustom ? "border-primary/35 bg-primary/10 text-foreground" : "border-border/45 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}>
                  <CalendarDays className="h-3 w-3" />
                  {isCustom && customRange?.from
                    ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
                    : "Custom"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto overflow-hidden rounded-2xl border border-border/30 bg-popover p-0">
                <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-3 pointer-events-auto" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
              </PopoverContent>
            </Popover>
            <button onClick={privacy.toggle} className={cn("h-8 w-8 rounded-xl border flex items-center justify-center transition-all", privacy.hidden ? "border-primary/35 bg-primary/10 text-primary" : "border-border/45 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-primary/30")} title={privacy.hidden ? "Mostrar" : "Ocultar"}>
              {privacy.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Main metric block */}
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-0">
          <div className="px-6 py-9 lg:px-10 lg:py-12 border-b lg:border-b-0 lg:border-r border-border/30 relative">
            {/* Decorative corner mark */}
            <div className="pointer-events-none absolute top-5 right-5 hidden lg:flex items-center gap-1 opacity-40">
              <span className="h-px w-3 bg-foreground/30" />
              <span className="h-1 w-1 rounded-full bg-primary/60" />
              <span className="h-px w-3 bg-foreground/30" />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/70">
                Receita {isCustom && customRange?.from
                  ? `· ${customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")}`
                  : `· ${selectedPeriod.label}`}
              </p>
            </div>
            <div className="flex items-baseline gap-4 flex-wrap">
              <span className="inline-flex items-baseline font-display text-[clamp(2.4rem,7.5vw,76px)] font-black leading-none tracking-[-0.04em] whitespace-nowrap text-foreground">
                {privacy.hidden ? "R$ •••••••" : <AnimatedNumber value={revenue} duration={1000} />}
              </span>
              {approved.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-3 py-1 font-display text-[11px] font-black uppercase tracking-wider text-success">
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {approved.length} venda{approved.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Inline sparkline */}
            {chartData.length > 1 && !privacy.hidden && (
              <div className="mt-5 -mx-1 h-8 opacity-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="heroSparkline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#heroSparkline)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mt-7 flex items-center gap-6 text-[11px] flex-wrap">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="font-display font-black text-foreground tabular-nums">{approved.length}</span>
                <span className="font-display font-bold uppercase tracking-wider text-[10px] text-foreground/75">aprovadas</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-warning" />
                <span className="font-display font-black text-foreground tabular-nums">{pending.length}</span>
                <span className="font-display font-bold uppercase tracking-wider text-[10px] text-foreground/75">pendentes</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-destructive" />
                <span className="font-display font-black text-foreground tabular-nums">{chargebacks.length + refunded.length}</span>
                <span className="font-display font-bold uppercase tracking-wider text-[10px] text-foreground/75">contestações</span>
              </div>
            </div>
          </div>

          <div className="relative px-6 py-9 lg:px-10 lg:py-12">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-success" />
              <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/70">Saldo Disponível</p>
            </div>
            <p className="font-display text-[clamp(1.8rem,4.5vw,46px)] font-black tabular-nums text-success tracking-[-0.035em] leading-none">
              {privacy.hidden ? CENSORED : fmt(Math.abs(balance))}
            </p>

            {/* Trust badges */}
            <div className="mt-3 flex items-center gap-2 text-[9px] font-display font-bold uppercase tracking-[0.14em] text-muted-foreground/50">
              <span className="inline-flex items-center gap-1"><Lock className="h-2.5 w-2.5" strokeWidth={2.5} /> Criptografado</span>
              <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5" strokeWidth={2.5} /> Auditado</span>
            </div>

            <Link to="/financeiro/saques" className="group mt-5 inline-flex items-center gap-2 rounded-full bg-success/10 ring-1 ring-success/20 px-3.5 py-1.5 font-display text-[11px] font-black uppercase tracking-wider text-success transition-all hover:bg-success/15 hover:ring-success/30">
              Sacar agora
              <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
            </Link>
            {withdrawalPending > 0 && (
              <p className="mt-4 text-[10px] text-muted-foreground/60">
                <span className="font-display font-black text-warning tabular-nums">{fmt(withdrawalPending)}</span>
                <span className="ml-1 font-medium">em saques pendentes</span>
              </p>
            )}
          </div>
        </div>

        {/* Compact supporting KPI strip */}
        <div className="relative grid grid-cols-2 lg:grid-cols-4 border-t border-border/30 divide-x divide-border/30">
          {([
            { label: "Conversão", numValue: conversion, formatter: (v: number) => `${v.toFixed(1)}%`, accent: "text-info", accentBg: "from-info/10" },
            { label: "Ticket Médio", numValue: approved.length > 0 ? revenue / approved.length : 0, formatter: fmt, accent: "text-foreground", accentBg: "from-foreground/5" },
            { label: "Clientes Únicos", numValue: uniqueCustomers, formatter: (v: number) => String(Math.round(v)), accent: "text-foreground", accentBg: "from-foreground/5" },
            { label: "Chargeback", numValue: chargebackRate, formatter: (v: number) => `${v.toFixed(2)}%`, accent: chargebackRate > 1 ? "text-destructive" : "text-success", accentBg: chargebackRate > 1 ? "from-destructive/10" : "from-success/10" },
          ] as const).map((item, i) => (
            <div key={item.label} className={cn("group relative px-6 py-5 lg:px-8 transition-colors hover:bg-muted/5", i >= 2 && "border-t lg:border-t-0 border-border/30")}>
              <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent opacity-0 transition-opacity group-hover:opacity-100", item.accentBg)} />
              <p className="font-display text-[10px] font-black uppercase tracking-[0.18em] text-foreground/70 mb-2">{item.label}</p>
              <p className={cn("font-display text-[22px] lg:text-[26px] font-black tabular-nums leading-none tracking-[-0.035em]", item.accent)}>
                {privacy.hidden ? CENSORED : <AnimatedNumber value={item.numValue} formatter={item.formatter} />}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* DOMINANT CHART AREA                                              */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="dashboard-panel dashboard-panel-primary relative mb-5 rounded-[24px]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-background/70" />
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px]">
          {/* Chart */}
          <div className="flex flex-col border-b xl:border-b-0 xl:border-r border-border/30">
            <div className="flex items-center justify-between px-7 py-5 border-b border-border/30">
              <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-display text-[13px] font-bold tracking-[-0.01em] text-foreground">Performance de receita</p>
                  <p className="text-[11px] text-muted-foreground/55 mt-0.5 font-medium">
                    {!isCustom && selectedPeriod.days <= 1 ? "Distribuição por hora" : "Distribuição por dia"} · {selectedPeriod.label}
                  </p>
                </div>
              </div>
              <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-primary/8 ring-1 ring-primary/15 px-3 py-1.5 text-[10px] font-display font-black uppercase tracking-wider text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Vendas aprovadas
              </div>
            </div>
            <div className="flex-1 px-3 py-5 min-h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.4)" fontSize={10} interval={chartData.length > 10 ? Math.ceil(chartData.length / 8) - 1 : 0} />
                  <YAxis tickLine={false} axisLine={false} width={64} stroke="hsl(var(--muted-foreground) / 0.4)" fontSize={10} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k` : `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--primary) / 0.3)", strokeWidth: 1, strokeDasharray: "4 4" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const value = payload[0].value as number;
                      return (
                        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
                          <p className="font-display text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.18em]">{label}</p>
                          <p className="font-display text-[15px] font-black text-primary tabular-nums mt-1 tracking-tight">
                            R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#dashboardRevenue)" dot={false} activeDot={{ r: 6, strokeWidth: 2.5, fill: "hsl(var(--card))", stroke: "hsl(var(--primary))" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment breakdown rail */}
          <div className="flex flex-col">
            <div className="px-6 py-5 border-b border-border/30">
              <p className="font-display text-[13px] font-bold tracking-[-0.01em] text-foreground">Por método</p>
              <p className="text-[11px] text-muted-foreground/55 mt-0.5 font-medium">Conversão e receita</p>
            </div>
            <div className="flex-1 divide-y divide-border/20">
              {[
                { icon: <PixLogoMark className="h-3.5 w-3.5" />, label: "PIX", conv: pixConversion, revenue: pixRevenue, count: `${pixApprovedCount}/${pixTotalCount}`, color: "text-success", borderColor: "border-success/20", bgColor: "bg-success/10" },
                { icon: <CreditCard className="h-3.5 w-3.5" strokeWidth={2.5} />, label: "Cartão", conv: cardConversion, revenue: cardRevenue, count: `${cardApprovedCount}/${cardTotalCount}`, color: "text-info", borderColor: "border-info/20", bgColor: "bg-info/10" },
              ].map((m) => (
                <div key={m.label} className="group px-6 py-5 transition-colors hover:bg-foreground/[0.015]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                    <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg border transition-colors", m.bgColor, m.borderColor, m.color)}>
                        {m.icon}
                      </div>
                      <span className="font-display text-[12px] text-foreground font-bold uppercase tracking-[0.08em]">{m.label}</span>
                    </div>
                    <span className={cn("font-display text-[14px] font-black tabular-nums tracking-tight", m.color)}>{m.conv.toFixed(1)}%</span>
                  </div>
                  <p className="font-display text-[20px] font-black tabular-nums text-foreground leading-none tracking-[-0.03em]">
                    {privacy.hidden ? CENSORED : fmt(m.revenue)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2 font-medium">{m.count} aprovadas</p>
                </div>
              ))}
              <div className="group px-6 py-5 transition-colors hover:bg-foreground/[0.015]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10 border border-warning/20 text-warning">
                      <DollarSign className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </div>
                    <span className="font-display text-[12px] text-foreground font-bold uppercase tracking-[0.08em]">Saques pendentes</span>
                  </div>
                  <span className="font-display text-[10px] text-muted-foreground/50 tabular-nums font-bold">{withdrawals.filter(w => w.status === "pending").length}</span>
                </div>
                <p className="font-display text-[20px] font-black tabular-nums text-warning leading-none tracking-[-0.03em]">
                  {privacy.hidden ? CENSORED : fmt(withdrawalPending)}
                </p>
                <Link to="/financeiro/saques" className="text-[10px] text-primary font-display font-bold uppercase tracking-[0.08em] mt-2 inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                  Gerenciar <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ACTIONS + ACTIVITY                                               */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.4fr] mb-8">
          {/* Quick actions — operational support */}
          <div className="dashboard-panel dashboard-panel-primary relative rounded-[24px] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/30 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-primary/15 to-primary/5 border border-primary/20 text-primary">
                  <Zap className="h-3.5 w-3.5" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-display text-[13px] font-bold tracking-[-0.01em] text-foreground">Ações rápidas</p>
                  <p className="text-[11px] text-muted-foreground/55 mt-0.5 font-medium">Atalhos operacionais</p>
                </div>
              </div>
              <Link to="/perfil" className="font-display text-[10px] text-muted-foreground/60 hover:text-foreground font-black uppercase tracking-wider transition-colors">Tudo</Link>
            </div>
            <div className="divide-y divide-border/20 max-h-[580px] overflow-y-auto">
              {[
                { label: "Criar produto", href: "/vendas/produtos", icon: Package, tone: "primary" },
                { label: "Configurar checkout", href: "/vendas/checkout", icon: CreditCard, tone: "info" },
                { label: "Link de pagamento", href: "/vendas/links", icon: Hash, tone: "primary" },
                { label: "Ver vendas", href: "/vendas", icon: BarChart3, tone: "success" },
                { label: "Extrato financeiro", href: "/financeiro/extrato", icon: FileText, tone: "info" },
                { label: "Solicitar saque", href: "/financeiro/saques", icon: ArrowDownRight, tone: "success" },
                { label: "Dados bancários", href: "/financeiro/dados-bancarios", icon: Banknote, tone: "warning" },
                { label: "Identidade & KYC", href: "/financeiro/identidade", icon: ShieldCheck, tone: "success" },
                { label: "Cupons de desconto", href: "/vendas/cupons", icon: Percent, tone: "primary" },
                { label: "Área de membros", href: "/vendas/conteudo", icon: GraduationCap, tone: "info" },
                { label: "Programa de afiliados", href: "/vendas/afiliados", icon: Users, tone: "primary" },
                { label: "Apps & Integrações", href: "/integracoes", icon: Layers, tone: "info" },
                { label: "Webhooks & API", href: "/vendas/webhooks", icon: Webhook, tone: "warning" },
                { label: "Suporte", href: "/suporte", icon: Sparkles, tone: "primary" },
              ].map((action) => {
                const toneClasses: Record<string, { bg: string; border: string; text: string }> = {
                  primary: { bg: "bg-gradient-to-b from-primary/12 to-primary/4", border: "border-primary/15", text: "text-primary" },
                  info: { bg: "bg-gradient-to-b from-info/12 to-info/4", border: "border-info/15", text: "text-info" },
                  success: { bg: "bg-gradient-to-b from-success/12 to-success/4", border: "border-success/15", text: "text-success" },
                  warning: { bg: "bg-gradient-to-b from-warning/12 to-warning/4", border: "border-warning/15", text: "text-warning" },
                };
                const t = toneClasses[action.tone] || toneClasses.primary;
                return (
                  <Link
                    key={action.href}
                    to={action.href}
                    className="group relative flex items-center gap-3.5 px-6 py-3.5 transition-all hover:bg-accent/45"
                  >
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-300 group-hover:border-primary/25", t.bg, t.border, t.text)}>
                      <action.icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </div>
                    <span className="flex-1 font-display text-[13px] font-semibold text-foreground/90 tracking-[-0.005em] transition-colors group-hover:text-foreground">{action.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/25 transition-all group-hover:text-foreground/60 group-hover:translate-x-0.5" strokeWidth={2.25} />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Activity feed */}
          <div className="dashboard-panel dashboard-panel-success relative rounded-[24px] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/30 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-success/15 to-success/5 border border-success/20 text-success">
                  <Activity className="h-3.5 w-3.5" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-display text-[13px] font-bold tracking-[-0.01em] text-foreground">Atividade recente</p>
                  <p className="text-[11px] text-muted-foreground/55 mt-0.5 font-medium">Últimas movimentações</p>
                </div>
              </div>
              <Link to="/financeiro/extrato" className="group inline-flex items-center gap-1.5 rounded-full bg-primary/10 ring-1 ring-primary/20 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wider text-primary transition-all hover:bg-primary/15 hover:ring-primary/30">
                Ver tudo <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
              </Link>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
              {activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                    <PixLogoMark className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-display font-bold text-muted-foreground/40">Sem movimentações ainda</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/25">Suas vendas aparecerão aqui</p>
                </div>
              ) : (
                activity.map((item, idx) => {
                  const txStyles: Record<string, { label: string; pillBg: string; pillText: string; pillBorder: string; iconBg: string; iconText: string }> = {
                    completed: { label: "Aprovada", pillBg: "bg-success/6", pillText: "text-success", pillBorder: "border-success/10", iconBg: "bg-success/10", iconText: "text-success" },
                    pending: { label: "Pendente", pillBg: "bg-warning/6", pillText: "text-warning", pillBorder: "border-warning/10", iconBg: "bg-warning/10", iconText: "text-warning" },
                    failed: { label: "Falhou", pillBg: "bg-destructive/6", pillText: "text-destructive", pillBorder: "border-destructive/10", iconBg: "bg-destructive/10", iconText: "text-destructive" },
                    refunded: { label: "Reembolso", pillBg: "bg-info/6", pillText: "text-info", pillBorder: "border-info/10", iconBg: "bg-info/10", iconText: "text-info" },
                    chargeback: { label: "Chargeback", pillBg: "bg-destructive/6", pillText: "text-destructive", pillBorder: "border-destructive/10", iconBg: "bg-destructive/10", iconText: "text-destructive" },
                    default: { label: "Status", pillBg: "bg-muted/6", pillText: "text-muted-foreground", pillBorder: "border-border/10", iconBg: "bg-muted/10", iconText: "text-muted-foreground" },
                  };
                  const wdStyles: Record<string, { label: string; pillBg: string; pillText: string; pillBorder: string; iconBg: string; iconText: string }> = {
                    pending: { label: "Em análise", pillBg: "bg-warning/6", pillText: "text-warning", pillBorder: "border-warning/10", iconBg: "bg-warning/10", iconText: "text-warning" },
                    approved: { label: "Aprovado", pillBg: "bg-success/6", pillText: "text-success", pillBorder: "border-success/10", iconBg: "bg-success/10", iconText: "text-success" },
                    rejected: { label: "Rejeitado", pillBg: "bg-destructive/6", pillText: "text-destructive", pillBorder: "border-destructive/10", iconBg: "bg-destructive/10", iconText: "text-destructive" },
                    default: { label: "Saque", pillBg: "bg-muted/6", pillText: "text-muted-foreground", pillBorder: "border-border/10", iconBg: "bg-muted/10", iconText: "text-muted-foreground" },
                  };
                  const s = item.kind === "transaction" ? txStyles[item.status] || txStyles.default : wdStyles[item.status] || wdStyles.default;
                  const fullTx = item.kind === "transaction" ? transactions.find(t => t.id === item.id) ?? null : null;

                  return (
                    <div key={item.id} className={cn("dashboard-activity-row group rounded-[18px] border border-transparent px-3 py-3 transition-all hover:border-border/20 hover:bg-background/50", idx < activity.length - 1 && "mb-1.5")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/20", s.iconBg, s.iconText)}>
                          {item.kind === "transaction"
                            ? item.paymentMethod === "pix"
                              ? <PixLogoMark className="h-4 w-4" />
                              : item.paymentMethod === "credit_card" || item.paymentMethod === "card"
                                ? <CreditCard className="h-4 w-4" />
                                : <DollarSign className="h-4 w-4" />
                            : <Wallet className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13px] font-display font-black tabular-nums text-foreground">{privacy.hidden ? CENSORED : fmt(item.amount)}</p>
                            <span className={cn("rounded-full border px-2.5 py-0.5 text-[9px] font-bold", s.pillBg, s.pillText, s.pillBorder)}>
                              {s.label}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[10px] text-muted-foreground/45">{item.kind === "transaction" ? `Venda • ${item.label === "credit_card" || item.label === "card" ? "Cartão" : item.label === "pix" ? "PIX" : item.label}` : item.label}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {fullTx && (
                            <button onClick={() => setDetailTx(fullTx)} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground/30 transition-all hover:bg-accent hover:text-foreground">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="text-[9px] font-mono tabular-nums text-muted-foreground/25">{timeAgo(item.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

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
                <div className="relative px-7 pt-8 pb-6 border-b border-border/40">
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
    <div className={`group relative rounded-2xl border border-border/50 bg-card p-3.5 md:p-5 transition-all duration-200 hover:border-border/80 overflow-hidden animate-fade-in ${STAGGER_CLASSES[idx + 1] || ""}`}>
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
    <div className={`group relative rounded-2xl border border-border/50 bg-card p-3.5 md:p-4 transition-all duration-200 hover:border-border/80 overflow-hidden animate-fade-in flex flex-col justify-between min-h-[130px] ${delay || ""}`}>
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
