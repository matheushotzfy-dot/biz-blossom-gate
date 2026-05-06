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

  return (
    <div className="dashboard-page mx-auto w-full max-w-[1440px] pb-24 px-3 md:px-6 relative space-y-5 pt-2">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TOP BAR — Greeting + Period selector                    */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-black tracking-tight text-foreground">
            Olá, {nickname || "Vendedor"}
            <button onClick={privacy.toggle} className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-border/40 bg-card text-muted-foreground hover:text-foreground transition-colors align-middle ml-2">
              {privacy.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </h1>
          <p className="text-[13px] text-muted-foreground/60 mt-0.5">Painel de controle da sua operação.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/40 bg-card p-0.5">
            {PERIOD_PRESETS.filter(p => ["Hoje", "7 dias", "30 dias"].includes(p.label)).map((opt) => (
              <button key={opt.label} onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                className={cn("rounded-md px-3 py-1.5 text-[11px] font-display font-bold transition-all",
                  !isCustom && selectedPeriod.label === opt.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}>
                {opt.label}
              </button>
            ))}
          </div>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className={cn("h-8 rounded-lg border px-3 text-[11px] font-bold transition-all inline-flex items-center gap-1.5",
                isCustom ? "border-primary/35 bg-primary/10 text-foreground" : "border-border/40 bg-card text-muted-foreground hover:text-foreground"
              )}>
                <CalendarDays className="h-3 w-3" />
                {isCustom && customRange?.from
                  ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
                  : "Custom"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto overflow-hidden rounded-xl border border-border/30 bg-popover p-0">
              <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-3 pointer-events-auto" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
            </PopoverContent>
          </Popover>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FINANCIAL STAT CARDS — Always visible, compact          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          {
            label: "Total Faturado",
            sublabel: "Volume total histórico",
            value: privacy.hidden ? CENSORED : fmt(transactions.filter(t => t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0)),
            icon: <TrendingUp className="h-5 w-5 text-primary" />,
            accent: "border-l-primary",
          },
          {
            label: "Saldo Disponível",
            sublabel: "Liberado para saque",
            value: privacy.hidden ? CENSORED : fmt(Math.max(balance, 0)),
            icon: <Wallet className="h-5 w-5 text-success" />,
            accent: "border-l-success",
          },
          {
            label: "Saldo Pendente",
            sublabel: "Aguardando liberação",
            value: privacy.hidden ? CENSORED : fmt(transactions.filter(t => t.status === "completed" && !t.retention_released).reduce((a, t) => a + Number(t.retained_amount), 0)),
            icon: <Clock3 className="h-5 w-5 text-warning" />,
            accent: "border-l-warning",
          },
          {
            label: "Vendas Realizadas",
            sublabel: "Quantidade total",
            value: privacy.hidden ? CENSORED : transactions.filter(t => t.status === "completed").length.toString(),
            icon: <Zap className="h-5 w-5 text-info" />,
            accent: "border-l-info",
          },
        ]).map((card) => (
          <div key={card.label} className={cn("group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 md:p-5 border-l-[3px] transition-all hover:border-border/70", card.accent)}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] md:text-[12px] font-display font-bold text-muted-foreground/70 uppercase tracking-[0.06em]">{card.label}</p>
              <div className="h-9 w-9 rounded-lg bg-card-elevated border border-border/30 flex items-center justify-center">
                {card.icon}
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-display font-black tabular-nums tracking-[-0.03em] text-foreground leading-none">
              {card.value}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-2 font-medium">{card.sublabel}</p>
          </div>
        ))}
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* QUICK ACTIONS — Compact row                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: "Gerar PIX", sublabel: "QR Code para receber", icon: <PixLogoMark className="h-5 w-5" />, href: "/vendas/links" },
          { label: "Solicitar Saque", sublabel: "Transferir via PIX", icon: <ArrowDownRight className="h-5 w-5 text-success" />, href: "/financeiro/saques" },
          { label: "Transações", sublabel: "Ver histórico", icon: <BarChart3 className="h-5 w-5 text-info" />, href: "/vendas" },
          { label: "Credenciais API", sublabel: "Gerencie suas credenciais", icon: <Hash className="h-5 w-5 text-warning" />, href: "/vendas/api-keys" },
        ]).map((action) => (
          <Link key={action.href} to={action.href} className="group flex items-center gap-3.5 rounded-xl border border-border/50 bg-card px-4 py-4 transition-all hover:border-primary/30 hover:bg-accent/30">
            <div className="h-10 w-10 rounded-lg bg-card-elevated border border-border/30 flex items-center justify-center shrink-0 group-hover:border-primary/20 transition-colors">
              {action.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-display font-bold text-foreground tracking-tight">{action.label}</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">{action.sublabel}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
          </Link>
        ))}
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CHART + INDICES                                                   */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-3">
        {/* Faturamento Chart */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-b border-border/30">
            <div>
              <h3 className="text-[15px] font-display font-bold text-foreground tracking-tight">Faturamento</h3>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">Evolução do período selecionado</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/50 font-medium">
                <span className="h-2 w-2 rounded-full bg-primary" /> Receita
              </span>
            </div>
          </div>
          <div className="px-3 pb-5 min-h-[300px]">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.3)" fontSize={10} interval={chartData.length > 10 ? Math.ceil(chartData.length / 8) - 1 : 0} />
                <YAxis tickLine={false} axisLine={false} width={64} stroke="hsl(var(--muted-foreground) / 0.3)" fontSize={10} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k` : `R$${v}`} />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--primary) / 0.3)", strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-border bg-card px-4 py-3">
                        <p className="font-display text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">{label}</p>
                        <p className="font-display text-[15px] font-black text-primary tabular-nums mt-1 tracking-tight">
                          {fmt(payload[0].value as number)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#dashboardRevenue)" dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(var(--card))", stroke: "hsl(var(--primary))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right sidebar — KPIs */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-border/30">
            <h3 className="text-[15px] font-display font-bold text-foreground tracking-tight">Índices</h3>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Métricas de conversão</p>
          </div>
          <div className="flex-1 p-5 space-y-5">
            {/* Pix */}
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--border) / 0.3)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--success))" strokeWidth="3" strokeDasharray={`${pixConversion * 0.974} 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-display font-black text-success tabular-nums">{pixConversion.toFixed(0)}%</span>
                </div>
              </div>
              <div>
                <p className="text-[13px] font-display font-bold text-foreground">Pix</p>
                <p className="text-[11px] text-muted-foreground/50">Conversão</p>
              </div>
            </div>
            {/* Card */}
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--border) / 0.3)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--info))" strokeWidth="3" strokeDasharray={`${cardConversion * 0.974} 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-display font-black text-info tabular-nums">{cardConversion.toFixed(0)}%</span>
                </div>
              </div>
              <div>
                <p className="text-[13px] font-display font-bold text-foreground">Cartão</p>
                <p className="text-[11px] text-muted-foreground/50">Conversão</p>
              </div>
            </div>
            {/* Chargeback */}
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--border) / 0.3)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke={chargebackRate > 1 ? "hsl(var(--destructive))" : "hsl(var(--success))"} strokeWidth="3" strokeDasharray={`${Math.min(chargebackRate * 9.74, 97.4)} 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn("text-[11px] font-display font-black tabular-nums", chargebackRate > 1 ? "text-destructive" : "text-success")}>{chargebackRate.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <p className="text-[13px] font-display font-bold text-foreground">Chargeback</p>
                <p className="text-[11px] text-muted-foreground/50">Saúde da conta</p>
              </div>
            </div>
            {/* Summary */}
            <div className="border-t border-border/30 pt-4 space-y-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground/60">Ticket Médio</span>
                <span className="font-display font-black text-foreground tabular-nums">{privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground/60">Conversão Geral</span>
                <span className="font-display font-black text-foreground tabular-nums">{conversion.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground/60">Clientes Únicos</span>
                <span className="font-display font-black text-foreground tabular-nums">{uniqueCustomers}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ACTIVITY FEED                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/30 px-6 py-5">
          <div>
            <h3 className="text-[15px] font-display font-bold text-foreground tracking-tight">Atividade Recente</h3>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Últimas transações e saques</p>
          </div>
          <Link to="/vendas" className="text-[12px] font-bold text-primary hover:underline">Ver tudo</Link>
        </div>
        <div className="divide-y divide-border/20">
          {activity.map((item) => (
            <div key={item.id} className="flex items-center gap-3.5 px-6 py-3.5 hover:bg-accent/30 transition-all cursor-pointer" onClick={() => item.kind === 'transaction' && setDetailTx(transactions.find(t => t.id === item.id) || null)}>
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                item.status === 'completed' ? "bg-success/10 text-success" : 
                item.status === 'pending' ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
              )}>
                {item.kind === 'withdrawal' ? <ArrowDownRight className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground truncate">{item.label}</p>
                <p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider mt-0.5">
                  {item.kind === 'withdrawal' ? 'Saque' : 'Venda'} • {timeAgo(item.createdAt)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-display font-black text-foreground tabular-nums">{fmt(item.amount)}</p>
                <p className={cn("text-[9px] font-bold uppercase tracking-widest mt-0.5",
                  item.status === 'completed' ? "text-success" : 
                  item.status === 'pending' ? "text-warning" : "text-destructive"
                )}>
                  {item.status === 'completed' ? 'Aprovado' : 
                   item.status === 'pending' ? 'Pendente' : 'Cancelado'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

        <DialogContent className="sm:max-w-[460px] border-border/20 bg-card p-0 gap-0 overflow-hidden rounded-xl">
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
                <div className="relative px-7 pt-8 pb-6 border-b border-border/40">
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
                  <p className="text-4xl font-display font-black text-foreground tabular-nums tracking-tight leading-none">{fmt(Number(detailTx.amount))}</p>
                  {productName && <p className="text-[13px] text-muted-foreground/70 mt-2">{productName}</p>}
                </div>
                <div className="px-7 py-5 space-y-3.5">
                  {[
                    { show: !!detailTx.customer_name, icon: User, label: "Cliente", value: detailTx.customer_name },
                    { show: !!detailTx.customer_email, icon: Mail, label: "Email", value: detailTx.customer_email },
                    { show: !!detailTx.customer_phone, icon: Phone, label: "Telefone", value: detailTx.customer_phone },
                  ].filter(f => f.show).map((field, i) => (
                    <div key={i} className="flex items-center gap-3.5 group">
                      <div className="h-10 w-10 rounded-lg bg-primary/8 border border-primary/10 flex items-center justify-center shrink-0">
                        <field.icon className="h-4 w-4 text-primary/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-display uppercase tracking-[0.18em] text-muted-foreground/40">{field.label}</p>
                        <p className="text-[13px] font-semibold text-foreground truncate mt-0.5">{field.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
                <div className="px-7 py-5">
                  <div className="rounded-lg border border-border/15 bg-card-elevated p-4 space-y-3">
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
                      <span className="font-black text-primary tabular-nums text-[18px] font-display tracking-tight">{fmt(Number(detailTx.net_amount))}</span>
                    </div>
                  </div>
                </div>
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
