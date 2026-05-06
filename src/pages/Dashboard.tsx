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

  const statusLabel = (s: string) => s === 'completed' ? 'Aprovado' : s === 'pending' ? 'Pendente' : s === 'refunded' ? 'Reembolso' : s === 'chargeback' ? 'Chargeback' : 'Falhou';
  const statusColor = (s: string) => s === 'completed' ? 'text-emerald-400' : s === 'pending' ? 'text-amber-400' : 'text-red-400';
  const statusBg = (s: string) => s === 'completed' ? 'bg-emerald-500/10' : s === 'pending' ? 'bg-amber-500/10' : 'bg-red-500/10';

  return (
    <div className="dashboard-page mx-auto w-full max-w-[1440px] pb-24 px-3 md:px-6 relative pt-2">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] md:text-[26px] font-display font-black tracking-[-0.02em] text-foreground leading-none">
              {nickname || "Vendedor"}
            </h1>
            <button onClick={privacy.toggle} className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border/30 text-muted-foreground/60 hover:text-foreground hover:border-border/60 transition-colors">
              {privacy.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[12px] text-muted-foreground/40 font-medium leading-none">Visão geral da sua operação</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border border-border/30 bg-card/50 p-[3px]">
            {PERIOD_PRESETS.filter(p => ["Hoje", "7 dias", "30 dias"].includes(p.label)).map((opt) => (
              <button key={opt.label} onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                className={cn("rounded-[5px] px-3.5 py-[6px] text-[11px] font-display font-bold transition-all leading-none",
                  !isCustom && selectedPeriod.label === opt.label
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    : "text-muted-foreground/50 hover:text-foreground border border-transparent"
                )}>
                {opt.label}
              </button>
            ))}
          </div>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className={cn("h-[30px] rounded-md border px-3 text-[11px] font-bold transition-all inline-flex items-center gap-1.5 leading-none",
                isCustom ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-400" : "border-border/30 bg-card/50 text-muted-foreground/50 hover:text-foreground"
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
      </div>

      {/* ── Balance Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[1px] rounded-xl overflow-hidden border border-border/30 bg-border/20 mb-5">
        {([
          { label: "Faturamento", value: privacy.hidden ? CENSORED : fmt(transactions.filter(t => t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0)), sub: "Volume total", icon: <TrendingUp className="h-4 w-4" />, color: "text-emerald-400" },
          { label: "Disponível", value: privacy.hidden ? CENSORED : fmt(Math.max(balance, 0)), sub: "Liberado para saque", icon: <Wallet className="h-4 w-4" />, color: "text-emerald-400" },
          { label: "Pendente", value: privacy.hidden ? CENSORED : fmt(transactions.filter(t => t.status === "completed" && !t.retention_released).reduce((a, t) => a + Number(t.retained_amount), 0)), sub: "Aguardando liberação", icon: <Clock3 className="h-4 w-4" />, color: "text-amber-400" },
          { label: "Vendas", value: privacy.hidden ? CENSORED : transactions.filter(t => t.status === "completed").length.toString(), sub: "Transações aprovadas", icon: <Zap className="h-4 w-4" />, color: "text-blue-400" },
        ]).map((c) => (
          <div key={c.label} className="bg-card px-5 py-5 flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.1em] leading-none">{c.label}</span>
              <span className={cn("opacity-40", c.color)}>{c.icon}</span>
            </div>
            <div>
              <p className="text-[22px] md:text-[26px] font-display font-black tabular-nums tracking-[-0.03em] text-foreground leading-none">{c.value}</p>
              <p className="text-[10px] text-muted-foreground/30 mt-1.5 leading-none font-medium">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
        {([
          { label: "Gerar PIX", desc: "Receber pagamento", icon: <PixLogoMark className="h-4.5 w-4.5" />, href: "/vendas/links" },
          { label: "Solicitar Saque", desc: "Transferir saldo", icon: <ArrowDownRight className="h-4.5 w-4.5" />, href: "/financeiro/saques" },
          { label: "Transações", desc: "Histórico completo", icon: <BarChart3 className="h-4.5 w-4.5" />, href: "/vendas" },
          { label: "API Keys", desc: "Suas credenciais", icon: <Hash className="h-4.5 w-4.5" />, href: "/vendas/api-keys" },
        ]).map((a) => (
          <Link key={a.href} to={a.href} className="group flex items-center gap-3 rounded-lg border border-border/20 bg-card/60 hover:bg-card hover:border-border/40 px-4 py-3.5 transition-all">
            <div className="h-9 w-9 rounded-md bg-emerald-500/8 border border-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-400/70 group-hover:text-emerald-400 group-hover:border-emerald-500/20 transition-colors">
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-display font-bold text-foreground leading-none">{a.label}</p>
              <p className="text-[10px] text-muted-foreground/30 mt-1 leading-none">{a.desc}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-muted-foreground/40 transition-colors shrink-0" />
          </Link>
        ))}
      </div>

      {/* ── Chart + KPIs ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-2.5 mb-5">
        {/* Chart */}
        <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/15">
            <div>
              <h3 className="text-[13px] font-display font-bold text-foreground leading-none">Faturamento</h3>
              <p className="text-[10px] text-muted-foreground/30 mt-1 leading-none">Evolução no período</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[9px] text-muted-foreground/30 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Receita
            </span>
          </div>
          <div className="px-2 pb-4 pt-2">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160 60% 45%)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(160 60% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={9} interval={chartData.length > 10 ? Math.ceil(chartData.length / 8) - 1 : 0} />
                <YAxis tickLine={false} axisLine={false} width={56} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={9} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k` : `R$${v}`} />
                <Tooltip
                  cursor={{ stroke: "hsl(160 60% 45% / 0.2)", strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-border/30 bg-card px-3.5 py-2.5">
                        <p className="font-display text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em] leading-none">{label}</p>
                        <p className="font-display text-[14px] font-black text-emerald-400 tabular-nums mt-1.5 tracking-tight leading-none">
                          {fmt(payload[0].value as number)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="vendas" stroke="hsl(160 60% 45%)" strokeWidth={1.5} fill="url(#dashboardRevenue)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))", stroke: "hsl(160 60% 45%)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPIs Panel */}
        <div className="rounded-xl border border-border/30 bg-card overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/15">
            <h3 className="text-[13px] font-display font-bold text-foreground leading-none">Índices</h3>
            <p className="text-[10px] text-muted-foreground/30 mt-1 leading-none">Métricas de conversão</p>
          </div>
          <div className="flex-1 p-5 space-y-4">
            {/* Conversion rings */}
            {([
              { label: "PIX", pct: pixConversion, color: "emerald", detail: `${pixApprovedCount}/${pixTotalCount}` },
              { label: "Cartão", pct: cardConversion, color: "blue", detail: `${cardApprovedCount}/${cardTotalCount}` },
              { label: "Chargeback", pct: chargebackRate, color: chargebackRate > 1 ? "red" : "emerald", detail: `${chargebacks.length} ocorrências` },
            ] as const).map((kpi) => {
              const strokeColor = kpi.color === "emerald" ? "hsl(160 60% 45%)" : kpi.color === "blue" ? "hsl(210 70% 55%)" : "hsl(0 65% 55%)";
              const textClass = kpi.color === "emerald" ? "text-emerald-400" : kpi.color === "blue" ? "text-blue-400" : "text-red-400";
              return (
                <div key={kpi.label} className="flex items-center gap-3.5">
                  <div className="relative h-11 w-11 shrink-0">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--border) / 0.15)" strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeDasharray={`${(kpi.label === "Chargeback" ? Math.min(kpi.pct * 9.42, 94.2) : kpi.pct * 0.942)} 100`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={cn("text-[9px] font-display font-black tabular-nums leading-none", textClass)}>
                        {kpi.label === "Chargeback" ? `${kpi.pct.toFixed(1)}%` : `${kpi.pct.toFixed(0)}%`}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-display font-bold text-foreground leading-none">{kpi.label}</p>
                    <p className="text-[10px] text-muted-foreground/30 mt-1 leading-none">{kpi.detail}</p>
                  </div>
                </div>
              );
            })}

            {/* Summary stats */}
            <div className="border-t border-border/15 pt-3.5 space-y-2">
              {([
                { label: "Ticket Médio", value: privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0) },
                { label: "Conversão Geral", value: `${conversion.toFixed(1)}%` },
                { label: "Clientes Únicos", value: uniqueCustomers.toString() },
              ]).map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground/35">{s.label}</span>
                  <span className="text-[11px] font-display font-black text-foreground tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Activity ── */}
      <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/15 px-5 py-4">
          <div>
            <h3 className="text-[13px] font-display font-bold text-foreground leading-none">Atividade Recente</h3>
            <p className="text-[10px] text-muted-foreground/30 mt-1 leading-none">Últimas movimentações</p>
          </div>
          <Link to="/vendas" className="text-[11px] font-bold text-emerald-400/70 hover:text-emerald-400 transition-colors">Ver tudo</Link>
        </div>
        {activity.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Activity className="h-5 w-5 text-muted-foreground/15 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground/25">Nenhuma atividade encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {activity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/20 transition-all cursor-pointer" onClick={() => item.kind === 'transaction' && setDetailTx(transactions.find(t => t.id === item.id) || null)}>
                <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", statusBg(item.status))}>
                  {item.kind === 'withdrawal' ? <ArrowDownRight className={cn("h-3.5 w-3.5", statusColor(item.status))} /> : <CreditCard className={cn("h-3.5 w-3.5", statusColor(item.status))} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground truncate leading-none">{item.label === 'pix' ? 'PIX' : item.label === 'credit_card' ? 'Cartão de Crédito' : item.label}</p>
                  <p className="text-[9px] text-muted-foreground/25 uppercase tracking-wider mt-1 leading-none">
                    {item.kind === 'withdrawal' ? 'Saque' : 'Venda'} · {timeAgo(item.createdAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-display font-black text-foreground tabular-nums leading-none">{privacy.hidden ? CENSORED : fmt(item.amount)}</p>
                  <p className={cn("text-[8px] font-bold uppercase tracking-[0.1em] mt-1 leading-none", statusColor(item.status))}>
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
