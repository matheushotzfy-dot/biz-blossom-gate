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
      {/* GATEWAY EXECUTIVE DASHBOARD — Stripe/Adyen inspired              */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="px-4 md:px-6 py-6 space-y-5"
      >
        {/* ─── HEADER BAR ─── */}
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-5 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 border border-success/20 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] font-bold text-success uppercase tracking-wider">Live</span>
              </span>
              <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">
                Gateway · Painel Executivo
              </span>
            </div>
            <h1 className="text-[22px] md:text-[26px] font-display font-black text-foreground tracking-[-0.03em] leading-tight">
              Bem-vindo{nickname ? `, ${nickname}` : ""}
            </h1>
            <p className="text-[12px] text-muted-foreground/70 font-medium mt-1">
              {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · Atualizado em tempo real
            </p>
          </div>

          {/* Right cluster: filters + actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Product filter */}
            {productsData && productsData.length > 0 && (
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="h-9 w-[180px] text-[12px] font-semibold rounded-lg border-border/60 bg-card/40">
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

            {/* Period segmented control */}
            <div className="inline-flex items-center rounded-lg border border-border/60 bg-card/40 backdrop-blur-xl p-0.5 shadow-sm">
              {PERIOD_PRESETS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[11px] font-bold transition-all duration-200",
                    !isCustom && selectedPeriod.label === opt.label
                      ? "bg-foreground text-background shadow-sm"
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
                      "rounded-md px-3 py-1.5 text-[11px] font-bold transition-all duration-200 flex items-center gap-1.5",
                      isCustom ? "bg-foreground text-background shadow-sm" : "text-muted-foreground/70 hover:text-foreground"
                    )}
                  >
                    <CalendarDays className="h-3 w-3" />
                    Custom
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

            {/* Privacy toggle */}
            <button
              onClick={privacy.toggle}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border/60 bg-card/40 backdrop-blur-xl text-muted-foreground hover:text-foreground hover:border-border transition-all"
              title={privacy.hidden ? "Mostrar valores" : "Ocultar valores"}
            >
              {privacy.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>

            <Link
              to="/financeiro/saques"
              className="h-9 inline-flex items-center gap-1.5 px-4 rounded-lg bg-foreground text-background text-[12px] font-bold shadow-sm hover:opacity-90 transition-all"
            >
              <Wallet className="h-3.5 w-3.5" />
              Sacar saldo
            </Link>
          </div>
        </header>

        {/* ─── PRIMARY KPI ROW — Gateway core metrics ─── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* TPV — Total Payment Volume (gross) */}
          <GatewayKpi
            label="TPV · Volume Bruto"
            value={privacy.hidden ? CENSORED : fmt(approved.reduce((acc, t) => acc + Number(t.amount), 0))}
            sub={`${approved.length} transações aprovadas`}
            tone="primary"
            trend={approved.length > 0 ? "up" : "neutral"}
          />
          {/* Net revenue */}
          <GatewayKpi
            label="Receita Líquida"
            value={privacy.hidden ? CENSORED : fmt(revenue)}
            sub={`Após taxas · MDR efetivo ${(() => {
              const gross = approved.reduce((acc, t) => acc + Number(t.amount), 0);
              const fees = approved.reduce((acc, t) => acc + Number(t.fee_amount), 0);
              return gross > 0 ? `${((fees / gross) * 100).toFixed(2)}%` : "0,00%";
            })()}`}
            tone="success"
            trend="up"
          />
          {/* Approval rate */}
          <GatewayKpi
            label="Taxa de Aprovação"
            value={privacy.hidden ? CENSORED : `${conversion.toFixed(2)}%`}
            sub={`${approved.length} de ${filteredTx.length} processadas`}
            tone={conversion >= 80 ? "success" : conversion >= 60 ? "warning" : "destructive"}
            trend={conversion >= 80 ? "up" : "down"}
          />
          {/* Chargeback rate */}
          <GatewayKpi
            label="Chargeback Rate"
            value={privacy.hidden ? CENSORED : `${chargebackRate.toFixed(2)}%`}
            sub={`${chargebacks.length} disputa${chargebacks.length === 1 ? "" : "s"} · meta < 1%`}
            tone={chargebackRate < 1 ? "success" : chargebackRate < 2 ? "warning" : "destructive"}
            trend={chargebackRate < 1 ? "up" : "down"}
          />
        </section>

        {/* ─── MAIN GRID: Chart (left) + Settlement panel (right) ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart card */}
          <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">Volume processado</p>
                <p className="text-[15px] font-display font-black text-foreground tracking-tight mt-0.5">
                  {privacy.hidden ? CENSORED : fmt(revenue)}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-primary" />
                  Receita líquida
                </span>
              </div>
            </div>
            <div className="h-[280px] px-2 pt-3 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gw-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} width={40} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, fontWeight: 600 }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}
                    formatter={(v: number) => [privacy.hidden ? CENSORED : fmt(v), "Receita"]}
                  />
                  <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gw-grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Settlement panel — what matters for cash management */}
          <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">Liquidação · Settlement</p>
              <p className="text-[15px] font-display font-black text-foreground tracking-tight mt-0.5">Posição de caixa</p>
            </div>
            <div className="flex-1 px-5 py-4 space-y-4">
              {/* Available */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">Saldo disponível</p>
                <p className="text-[28px] font-display font-black text-foreground tabular-nums tracking-[-0.03em] leading-none mt-1">
                  {privacy.hidden ? CENSORED : <AnimatedNumber value={balance} />}
                </p>
                <p className="text-[11px] text-muted-foreground/60 font-medium mt-1.5">Pronto para saque imediato</p>
              </div>

              <div className="h-px bg-border/40" />

              {/* In transit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em] mb-1">Em análise</p>
                  <p className="text-[16px] font-display font-black text-warning tabular-nums tracking-tight">
                    {privacy.hidden ? CENSORED : fmt(withdrawalPending)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Saques em processamento</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em] mb-1">Retido</p>
                  <p className="text-[16px] font-display font-black text-info tabular-nums tracking-tight">
                    {privacy.hidden ? CENSORED : fmt(transactions.filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0).reduce((acc, t) => acc + Number(t.retained_amount), 0))}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Reserva de segurança</p>
                </div>
              </div>

              <div className="h-px bg-border/40" />

              {/* Quick actions */}
              <div className="space-y-2 pt-1">
                <Link to="/financeiro/extrato" className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/40 hover:border-border hover:bg-muted/20 transition-all group">
                  <span className="text-[12px] font-semibold text-foreground/80 group-hover:text-foreground">Extrato detalhado</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                </Link>
                <Link to="/financeiro/antecipacao" className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/40 hover:border-border hover:bg-muted/20 transition-all group">
                  <span className="text-[12px] font-semibold text-foreground/80 group-hover:text-foreground">Antecipar recebíveis</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── PAYMENT METHOD BREAKDOWN + RISK SIGNALS ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Payment methods */}
          <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">Métodos de pagamento</p>
                <p className="text-[15px] font-display font-black text-foreground tracking-tight mt-0.5">Performance por canal</p>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{filteredTx.length} processadas</span>
            </div>
            <div className="divide-y divide-border/40">
              <PaymentMethodRow
                name="PIX"
                approved={pixApprovedCount}
                total={pixTotalCount}
                revenue={pixRevenue}
                approvalRate={pixConversion}
                share={revenue > 0 ? (pixRevenue / revenue) * 100 : 0}
                privacy={privacy.hidden}
                tone="success"
              />
              <PaymentMethodRow
                name="Cartão de Crédito"
                approved={cardApprovedCount}
                total={cardTotalCount}
                revenue={cardRevenue}
                approvalRate={cardConversion}
                share={revenue > 0 ? (cardRevenue / revenue) * 100 : 0}
                privacy={privacy.hidden}
                tone="info"
              />
              <PaymentMethodRow
                name="Boleto"
                approved={filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").length}
                total={filteredTx.filter(t => t.payment_method === "boleto").length}
                revenue={filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").reduce((acc, t) => acc + Number(t.net_amount), 0)}
                approvalRate={(() => {
                  const total = filteredTx.filter(t => t.payment_method === "boleto").length;
                  const ok = filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").length;
                  return total > 0 ? (ok / total) * 100 : 0;
                })()}
                share={(() => {
                  const rev = filteredTx.filter(t => t.payment_method === "boleto" && t.status === "completed").reduce((acc, t) => acc + Number(t.net_amount), 0);
                  return revenue > 0 ? (rev / revenue) * 100 : 0;
                })()}
                privacy={privacy.hidden}
                tone="warning"
              />
            </div>
          </div>

          {/* Risk signals */}
          <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/60" />
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">Risk Signals</p>
            </div>
            <div className="divide-y divide-border/40">
              <RiskRow label="Pendentes" value={pending.length.toString()} hint="Aguardando captura" tone={pending.length > 5 ? "warning" : "neutral"} />
              <RiskRow label="Reembolsos" value={refunded.length.toString()} hint={privacy.hidden ? CENSORED : `${fmt(refunded.reduce((acc, t) => acc + Number(t.net_amount), 0))} debitados`} tone={refunded.length > 0 ? "warning" : "neutral"} />
              <RiskRow label="Chargebacks" value={chargebacks.length.toString()} hint={`${chargebackRate.toFixed(2)}% do total`} tone={chargebacks.length > 0 ? "destructive" : "neutral"} />
              <RiskRow label="Clientes únicos" value={uniqueCustomers.toString()} hint="No período" tone="neutral" />
              <RiskRow label="Ticket médio" value={privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0)} hint="Por transação aprovada" tone="neutral" />
            </div>
          </div>
        </section>

        {/* ─── ACTIVITY FEED + OPERATIONAL TOOLS ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent activity */}
          <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground/60" />
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">Atividade recente</p>
              </div>
              <Link to="/vendas" className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider">Ver tudo</Link>
            </div>
            {activity.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-[12px] text-muted-foreground/60">Sem atividade no momento</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {activity.map((item) => {
                  const isWithdrawal = item.kind === "withdrawal";
                  const statusColor = item.status === "completed" || item.status === "approved" ? "text-success bg-success/10 border-success/20"
                    : item.status === "pending" ? "text-warning bg-warning/10 border-warning/20"
                    : item.status === "refunded" || item.status === "chargeback" || item.status === "rejected" ? "text-destructive bg-destructive/10 border-destructive/20"
                    : "text-muted-foreground bg-muted/20 border-border/40";
                  const statusLabel = item.status === "completed" ? "Aprovada" : item.status === "approved" ? "Aprovado" : item.status === "pending" ? "Pendente" : item.status === "refunded" ? "Reembolso" : item.status === "chargeback" ? "Chargeback" : item.status === "rejected" ? "Recusado" : item.status;

                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      onClick={() => {
                        if (!isWithdrawal) {
                          const tx = transactions.find(t => t.id === item.id);
                          if (tx) setDetailTx(tx);
                        }
                      }}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors text-left"
                    >
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", isWithdrawal ? "bg-info/10 text-info" : "bg-primary/10 text-primary")}>
                        {isWithdrawal ? <ArrowDownRight className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[12.5px] font-semibold text-foreground truncate">
                            {isWithdrawal ? "Saque solicitado" : (item.label === "pix" ? "PIX" : item.label === "credit_card" || item.label === "card" ? "Cartão de Crédito" : item.label === "boleto" ? "Boleto" : "Pagamento")}
                          </p>
                          <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", statusColor)}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-muted-foreground/60 mt-0.5 font-mono">ID {item.id.slice(0, 8)} · {timeAgo(item.createdAt)}</p>
                      </div>
                      <p className="text-[13px] font-display font-black text-foreground tabular-nums tracking-tight shrink-0">
                        {privacy.hidden ? CENSORED : fmt(item.amount)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Operational tools */}
          <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-muted-foreground/60" />
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">Operação</p>
            </div>
            <div className="divide-y divide-border/40">
              {[
                { label: "Produtos", value: products.toString(), href: "/vendas/produtos", icon: Package },
                { label: "Configurar checkout", value: "", href: "/vendas/checkout", icon: CreditCard },
                { label: "Webhooks & API", value: "", href: "/vendas/webhooks", icon: Webhook },
                { label: "Apps & Integrações", value: "", href: "/integracoes", icon: Layers },
                { label: "Cupons", value: "", href: "/vendas/cupons", icon: Percent },
                { label: "Identidade & KYC", value: "", href: "/financeiro/identidade", icon: ShieldCheck },
                { label: "Dados bancários", value: "", href: "/financeiro/dados-bancarios", icon: Banknote },
                { label: "Suporte", value: "", href: "/suporte", icon: Sparkles },
              ].map((action) => (
                <Link
                  key={action.href}
                  to={action.href}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20 transition-colors group"
                >
                  <action.icon className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                  <span className="flex-1 text-[12px] font-semibold text-foreground/80 group-hover:text-foreground">{action.label}</span>
                  {action.value && <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{action.value}</span>}
                  <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FOOTER SIGNATURE ─── */}
        <footer className="flex items-center justify-between pt-4 mt-2 border-t border-border/30 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.18em]">
          <span>Hotzfy Gateway · v1.0</span>
          <span className="flex items-center gap-1.5">
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
