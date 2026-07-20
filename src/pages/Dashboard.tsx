import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions, useWithdrawals, useProducts as useProductsQuery, useDisputes, useLedgerBalance } from "@/hooks/useQueryData";
import {
  Activity,
  ArrowDownRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  CreditCard,
  Hash,
  Wallet,
  Zap,
  TrendingUp,
  ShieldCheck,
  Mail,
  Phone,
  User,
  ArrowUpRight,
  Barcode,
  KeyRound,
  BookOpen,
  Webhook,
  Puzzle,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Bar, BarChart, Cell, PieChart, Pie } from "recharts";
import { Trophy, Lock, RefreshCw, QrCode, Receipt, Link2, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import QuickPixDialog from "@/components/QuickPixDialog";
import { PixLogoMark } from "@/components/icons/PixLogoMark";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateTransactionConversions, cn, deriveTransactionStatus, isApprovedTransaction } from "@/lib/utils";

import type { DateRange } from "react-day-picker";
import { Seo } from "@/components/Seo";
import { accountNeedsVerification } from "@/components/AccountVerificationGate";
import { toast } from "sonner";

const PERIOD_PRESETS = [
  { label: "Hoje", days: 0 },
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
      try { localStorage.setItem("privacy_mode", String(next)); } catch { /* noop */ }
      return next;
    });
  }, []);
  return { hidden, toggle };
}

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type ChartGranularity = "hour" | "day" | "month";
type ChartPoint = {
  name: string;
  vendas: number;
  fullLabel: string;
  timestamp: number;
  granularity: ChartGranularity;
};

const _brasiliaDateCache = new Map<string, string>();
function toBrasiliaDate(dateStr: string) {
  let cached = _brasiliaDateCache.get(dateStr);
  if (!cached) {
    cached = new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    _brasiliaDateCache.set(dateStr, cached);
    if (_brasiliaDateCache.size > 2000) {
      const first = _brasiliaDateCache.keys().next().value;
      if (first) _brasiliaDateCache.delete(first);
    }
  }
  return cached;
}

function brasiliaToday() {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

const _spPartsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
});
function brasiliaParts(dateStr: string) {
  const parts = _spPartsFmt.formatToParts(new Date(dateStr));
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
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

// ═══════════ DASHBOARD PERIOD FILTER ═══════════
type PeriodFilterProps = {
  selectedPeriod: PeriodPreset;
  setSelectedPeriod: (p: PeriodPreset) => void;
  isCustom: boolean;
  setIsCustom: (v: boolean) => void;
  customRange: DateRange | undefined;
  setCustomRange: (r: DateRange | undefined) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
};

function DashboardPeriodFilter({
  selectedPeriod, setSelectedPeriod, isCustom, setIsCustom, customRange, setCustomRange, open, setOpen,
}: PeriodFilterProps) {
  const now = brasiliaToday();

  const applyPreset = (p: PeriodPreset) => {
    setSelectedPeriod(p);
    setIsCustom(false);
    setCustomRange(undefined);
    setOpen(false);
  };

  const applyYesterday = () => {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const from = new Date(y); from.setHours(0, 0, 0, 0);
    const to = new Date(y); to.setHours(23, 59, 59, 999);
    setCustomRange({ from, to });
    setIsCustom(true);
    setOpen(false);
  };

  const applyThisMonth = () => {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(now); to.setHours(23, 59, 59, 999);
    setCustomRange({ from, to });
    setIsCustom(true);
    setOpen(false);
  };

  const isYesterdayActive = (() => {
    if (!isCustom || !customRange?.from || !customRange?.to) return false;
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return customRange.from.toDateString() === y.toDateString() && customRange.to.toDateString() === y.toDateString();
  })();

  const isThisMonthActive = (() => {
    if (!isCustom || !customRange?.from || !customRange?.to) return false;
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return customRange.from.toDateString() === first.toDateString() && customRange.to.toDateString() === now.toDateString();
  })();

  const label = isCustom
    ? (isYesterdayActive ? "Ontem"
      : isThisMonthActive ? "Este mês"
      : customRange?.from ? `${format(customRange.from, "dd/MM")}${customRange.to ? ` — ${format(customRange.to, "dd/MM")}` : ""}`
      : "Personalizado")
    : selectedPeriod.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 backdrop-blur px-4 py-3 hover:border-primary/40 transition-all">
          <CalendarDays className="h-4 w-4 text-primary" />
          <div className="text-left">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">Período</p>
            <p className="text-[13px] font-black tabular-nums leading-none mt-0.5">{label}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 rotate-90" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-3 rounded-2xl border-border/60">
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          <button onClick={() => applyPreset(PERIOD_PRESETS[0])}
            className={cn("h-9 rounded-xl text-[12px] font-bold transition-all",
              !isCustom && selectedPeriod.label === "Hoje" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
            Hoje
          </button>
          <button onClick={applyYesterday}
            className={cn("h-9 rounded-xl text-[12px] font-bold transition-all",
              isYesterdayActive ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
            Ontem
          </button>
          <button onClick={() => applyPreset(PERIOD_PRESETS[1])}
            className={cn("h-9 rounded-xl text-[12px] font-bold transition-all",
              !isCustom && selectedPeriod.label === "7 dias" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
            7 dias
          </button>
          <button onClick={() => applyPreset(PERIOD_PRESETS[2])}
            className={cn("h-9 rounded-xl text-[12px] font-bold transition-all",
              !isCustom && selectedPeriod.label === "15 dias" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
            15 dias
          </button>
          <button onClick={() => applyPreset(PERIOD_PRESETS[3])}
            className={cn("h-9 rounded-xl text-[12px] font-bold transition-all",
              !isCustom && selectedPeriod.label === "30 dias" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
            30 dias
          </button>
          <button onClick={applyThisMonth}
            className={cn("h-9 rounded-xl text-[12px] font-bold transition-all",
              isThisMonthActive ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
            Este mês
          </button>
        </div>
        <div className="border-t border-border/40 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Personalizado</p>
          <Calendar
            mode="range"
            selected={customRange}
            onSelect={(r) => {
              if (r?.from) {
                setCustomRange(r);
                setIsCustom(true);
                if (r.from && r.to) setOpen(false);
              }
            }}
            locale={ptBR}
            className="p-0 pointer-events-auto"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { data: transactions = [], isError: txError, refetch: refetchTx } = useTransactions();
  const { data: withdrawals = [] } = useWithdrawals(10);
  const { data: disputes = [] } = useDisputes();
  const { data: productsData, isError: productsError } = useProductsQuery();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[0]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const privacy = usePrivacyMode();
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const { data: availableBalance = 0 } = useLedgerBalance();
  const accountLocked = accountNeedsVerification(profile?.account_status);

  const requireApprovedAccount = useCallback((target = "/perfil?tab=identidade&scrollTo=kyc") => {
    if (!accountLocked) return false;
    toast.warning("Complete o KYC e aguarde aprovação do administrador para liberar esta função.");
    navigate(target);
    return true;
  }, [accountLocked, navigate]);

  const filteredTx = useMemo(() => {
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
    
    const start = new Date(today);
    start.setDate(start.getDate() - (selectedPeriod.days - 1));
    start.setHours(0, 0, 0, 0);

    return transactions.filter((t) => new Date(t.created_at) >= start);
  }, [transactions, selectedPeriod, isCustom, customRange]);

  const { approved, revenue, conversion, uniqueCustomers, pixConversion, cardConversion, boletoConversion, chargebackRate, pixApprovedCount, pixTotalCount, cardApprovedCount, cardTotalCount, boletoApprovedCount, boletoTotalCount } = useMemo(() => {
    const _approved = filteredTx.filter((t) => isApprovedTransaction(t.status));
    const _revenue = _approved.reduce((acc, t) => acc + Number(t.amount), 0);
    const conversions = calculateTransactionConversions(filteredTx);

    const _chargebackRate = filteredTx.length > 0 ? (filteredTx.filter(t => deriveTransactionStatus(t) === "chargeback").length / filteredTx.length) * 100 : 0;
    const _uniqueCustomers = new Set(filteredTx.map(t => t.customer_email).filter(Boolean)).size;

    return {
      approved: _approved,
      revenue: _revenue,
      conversion: conversions.overall.rate,
      uniqueCustomers: _uniqueCustomers,
      pixConversion: conversions.pix.rate,
      cardConversion: conversions.card.rate,
      boletoConversion: conversions.boleto.rate,
      chargebackRate: _chargebackRate,
      pixApprovedCount: conversions.pix.approved, pixTotalCount: conversions.pix.total,
      cardApprovedCount: conversions.card.approved, cardTotalCount: conversions.card.total,
      boletoApprovedCount: conversions.boleto.approved, boletoTotalCount: conversions.boleto.total,
    };
  }, [filteredTx]);

  // Using availableBalance from RPC now
  const balance = availableBalance;

  const chartData = useMemo(() => {
    // Resolve the actual window (start/end) for the selected period or custom range
    let start: Date;
    let end: Date;
    const today = brasiliaToday();

    if (isCustom && customRange?.from) {
      start = new Date(customRange.from);
      start.setHours(0, 0, 0, 0);
      end = new Date(customRange.to ?? customRange.from);
      end.setHours(23, 59, 59, 999);
    } else if (selectedPeriod.days === 0) {
      start = new Date(today);
      start.setHours(0, 0, 0, 0);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
    } else {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(today);
      start.setDate(start.getDate() - (selectedPeriod.days - 1));
      start.setHours(0, 0, 0, 0);
    }

    const spanDays = differenceInDays(end, start) + 1;
    const isSingleDay = spanDays <= 1;

    // 1) HOURLY (single day)
    if (isSingleDay) {
      const salesByHour = new Map<number, number>();
      filteredTx.forEach(t => {
        if (!isApprovedTransaction(t.status)) return;
        const hour = brasiliaParts(t.created_at).hour;
        salesByHour.set(hour, (salesByHour.get(hour) || 0) + Number(t.amount));
      });
      return Array.from({ length: 24 }, (_, i): ChartPoint => {
        const point = new Date(start);
        point.setHours(i, 0, 0, 0);
        return {
          name: `${i}h`,
          vendas: salesByHour.get(i) || 0,
          fullLabel: `${i}:00`,
          timestamp: point.getTime(),
          granularity: "hour",
        };
      });
    }

    // 2) MONTHLY (span > 60 days)
    if (spanDays > 60) {
      const byMonth = new Map<string, number>();
      filteredTx.forEach(t => {
        if (!isApprovedTransaction(t.status)) return;
        const p = brasiliaParts(t.created_at);
        const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
        byMonth.set(key, (byMonth.get(key) || 0) + Number(t.amount));
      });
      const result: ChartPoint[] = [];
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);
      while (cursor <= last) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
        result.push({
          name: cursor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          vendas: byMonth.get(key) || 0,
          fullLabel: cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
          timestamp: cursor.getTime(),
          granularity: "month",
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return result;
    }

    // 3) DAILY (default)
    const revenueByDate = new Map<string, number>();
    filteredTx.forEach(t => {
      if (!isApprovedTransaction(t.status)) return;
      const dateKey = toBrasiliaDate(t.created_at);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(t.amount));
    });
    return Array.from({ length: spanDays }, (_, i): ChartPoint => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return {
        name: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        vendas: revenueByDate.get(dateStr) || 0,
        fullLabel: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }),
        timestamp: d.getTime(),
        granularity: "day",
      };
    });
  }, [filteredTx, selectedPeriod.days, isCustom, customRange]);

  const chartTicks = useMemo(() => {
    if (chartData.length <= 1) return chartData.map((p) => p.timestamp);

    const granularity = chartData[0]?.granularity;
    const maxTicks = granularity === "hour"
      ? 7
      : granularity === "month"
        ? Math.min(chartData.length, 8)
        : chartData.length <= 31
          ? chartData.length
          : 8;

    const indexes = new Set<number>();
    for (let i = 0; i < maxTicks; i++) {
      indexes.add(Math.round((i * (chartData.length - 1)) / (maxTicks - 1)));
    }
    return Array.from(indexes)
      .sort((a, b) => a - b)
      .map((index) => chartData[index].timestamp);
  }, [chartData]);

  const chartTickFormatter = useCallback((value: number) => {
    const d = new Date(value);
    const granularity = chartData[0]?.granularity;
    if (granularity === "hour") return `${d.getHours()}h`;
    if (granularity === "month") return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    if (chartData.length > 15 && chartData.length <= 31) return d.toLocaleDateString("pt-BR", { day: "2-digit" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }, [chartData]);

  const activity = useMemo(() => {
    const tx = transactions.slice(0, 10).map((t) => ({
      id: t.id,
      kind: "transaction" as const,
      createdAt: t.created_at,
      amount: Number(t.amount),
      status: deriveTransactionStatus(t),
      label: t.payment_method || "Venda",
      tx: t,
    }));
    return tx.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const nickname = profile?.nickname || profile?.full_name?.split(" ")[0] || "Vendedor";
  const statusLabel = (s: string) => isApprovedTransaction(s) ? 'Aprovado' : s === 'pending' || s === 'processing' ? 'Pendente' : s === 'expired' ? 'Expirada' : s === 'refunded' || s === 'partially_refunded' ? 'Reembolso' : s === 'chargeback' ? 'Chargeback' : s === 'med' || s === 'mediation' || s === 'dispute' || s === 'disputed' ? 'MED' : s === 'cancelled' || s === 'canceled' ? 'Cancelada' : s === 'failed' || s === 'refused' || s === 'rejected' || s === 'error' ? 'Erro' : s;
  const statusBg = (s: string) =>
    isApprovedTransaction(s) ? 'bg-emerald-500/20 ring-1 ring-emerald-500/40'
    : s === 'pending' ? 'bg-amber-400/25 ring-1 ring-amber-400/50'
    : s === 'expired' || s === 'cancelled' || s === 'canceled' ? 'bg-muted/40 ring-1 ring-border/40'
    : s === 'med' || s === 'dispute' || s === 'disputed' ? 'bg-orange-500/20 ring-1 ring-orange-500/40'
    : s === 'chargeback' ? 'bg-red-600/25 ring-1 ring-red-600/50'
    : s === 'refunded' ? 'bg-muted/40 ring-1 ring-border/40'
    : 'bg-red-500/20 ring-1 ring-red-500/40';
  const statusColor = (s: string) =>
    isApprovedTransaction(s) ? 'text-emerald-500'
    : s === 'pending' ? 'text-amber-500'
    : s === 'expired' || s === 'cancelled' || s === 'canceled' ? 'text-muted-foreground'
    : s === 'med' || s === 'dispute' || s === 'disputed' ? 'text-orange-500'
    : s === 'chargeback' ? 'text-red-600'
    : s === 'refunded' ? 'text-muted-foreground'
    : 'text-red-500';

  // Saldo Pendente = (1) reserva ainda retida (D+N) + (2) líquido aprovado mas ainda não disponível para saque
  const pendingBalance = useMemo(() => {
    const now = Date.now();
    let retained = 0;
    let toRelease = 0;
    for (const t of transactions) {
      if (!isApprovedTransaction(t.status)) continue;
      const retUntil = t.retained_until ? new Date(t.retained_until).getTime() : 0;
      if (retUntil > now) {
        retained += Number(t.retained_amount || 0);
        toRelease += Number(t.net_amount || 0) - Number(t.retained_amount || 0);
      }
    }
    return retained + Math.max(0, toRelease);
  }, [transactions]);

  // Compare to previous period (same length) for trend deltas — anchored in America/Sao_Paulo
  const { prevApprovedCount, prevRevenue } = useMemo(() => {
    const today = brasiliaToday();
    let start: Date;
    let end: Date;

    if (isCustom && customRange?.from) {
      start = new Date(customRange.from);
      end = customRange.to ? new Date(customRange.to) : new Date(customRange.from);
    } else if (selectedPeriod.days === 0) {
      start = new Date(today);
      end = new Date(today);
    } else {
      start = new Date(today);
      start.setDate(start.getDate() - (selectedPeriod.days - 1));
      end = new Date(today);
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const lenMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - lenMs);

    // Compare using SP calendar date to avoid browser-tz drift
    const spDay = (iso: string) => toBrasiliaDate(iso);
    const prevStartKey = prevStart.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const prevEndKey = prevEnd.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const toKey = (k: string) => { const [d, m, y] = k.split("/"); return `${y}-${m}-${d}`; };
    const lo = toKey(prevStartKey), hi = toKey(prevEndKey);

    const prevTx = transactions.filter(t => {
      const k = toKey(spDay(t.created_at));
      return k >= lo && k <= hi;
    });
    const prevApp = prevTx.filter(t => isApprovedTransaction(t.status));
    return {
      prevApprovedCount: prevApp.length,
      prevRevenue: prevApp.reduce((acc, t) => acc + Number(t.amount), 0),
    };
  }, [transactions, selectedPeriod, isCustom, customRange]);

  const pctChange = (curr: number, prev: number): number | undefined => {
    if (prev === 0) return curr === 0 ? 0 : undefined;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const ordersTrend = pctChange(approved.length, prevApprovedCount);
  const revenueTrend = pctChange(revenue, prevRevenue);
  const compareLabel = (!isCustom && selectedPeriod.days === 0) ? "vs ontem" : "vs período anterior";

  const financialCards: Array<{ label: string; value: string | number; icon: typeof BarChart3; color: "neutral" | "success" | "warning" | "destructive"; sub: string; trend?: number }> = [
    { label: "Ticket Médio", value: privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0), icon: BarChart3, color: "neutral", sub: "Média bruta por venda" },
    { label: "Pedidos Pagos", value: approved.length, icon: Zap, color: "success", sub: "Vendas concluídas" },
    { label: "Saldo Pendente", value: privacy.hidden ? CENSORED : fmt(pendingBalance), icon: Clock3, color: "warning", sub: "Reserva + a liberar (D+N)" },
    { label: "Faturamento Total", value: privacy.hidden ? CENSORED : fmt(revenue), icon: TrendingUp, color: "success", sub: `Valor bruto · ${compareLabel}`, trend: revenueTrend },
  ];

  // ═══ Derived data for new layout ═══
  const receivedToday = useMemo(() => {
    const todayStr = brasiliaToday().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return transactions
      .filter(t => isApprovedTransaction(t.status) && toBrasiliaDate(t.created_at) === todayStr)
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [transactions]);

  const disputedAmount = useMemo(() => {
    return transactions
      .filter(t => ["med", "mediation", "dispute", "disputed", "chargeback"].includes(t.status))
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [transactions]);

  const goalTarget = 100000;
  const goalPct = Math.min(100, (revenue / goalTarget) * 100);

  // Sparkline data from chart
  const sparkData = useMemo(() => chartData.map(d => ({ v: d.vendas })), [chartData]);
  const productsMap = useMemo(() => {
    const map: Record<string, string> = {};
    (productsData || []).forEach((p: { id: string; name: string | null }) => { map[p.id] = p.name || p.id; });
    return map;
  }, [productsData]);

  const donutPix = [{ name: "on", value: pixConversion }, { name: "off", value: Math.max(0, 100 - pixConversion) }];
  const donutChb = [{ name: "on", value: chargebackRate }, { name: "off", value: Math.max(0, 100 - chargebackRate) }];



  return (
    <div className="relative min-h-screen w-full text-foreground animate-in fade-in duration-500 overflow-hidden">
      <Seo title="Dashboard | Hotzfy" description="Painel operacional Hotzfy — saldos, ranking, aprovação e liquidações em tempo real." path="/dashboard" noindex />

      {/* Ambient gradient backdrop — spans full scrollable dashboard */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(60% 40% at 80% 0%, hsl(var(--primary)/0.12), transparent 70%), radial-gradient(50% 40% at 10% 100%, hsl(var(--primary)/0.08), transparent 70%), linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background)) 100%)",
        }}
      />

      <div className="relative z-10 px-2 sm:px-4 md:px-6 pt-4 pb-24 max-w-[1600px] mx-auto space-y-5">


        {(txError || productsError) && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-[12px] text-destructive">
            <span className="font-semibold">Falha ao carregar métricas</span>
            <button onClick={() => refetchTx()} className="rounded-lg border border-destructive/50 px-3 py-1 text-[11px] font-bold hover:bg-destructive/10">Tentar novamente</button>
          </div>
        )}

        {/* ═══════════ TOP GREETING ROW ═══════════ */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display font-black tracking-[-0.02em] text-2xl md:text-[32px] leading-tight truncate">
              Seja bem-vindo, <span className="text-foreground/90">{nickname}</span>
              <button onClick={privacy.toggle} className="ml-2 inline-flex align-middle text-muted-foreground/60 hover:text-primary transition-colors">
                {privacy.hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Que essa jornada seja leve, produtiva e cheia de conquistas!</p>
          </div>

          {/* Faturamento / Meta hero chip — richer, clickable to open period filter */}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className="group relative overflow-hidden flex items-center gap-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-card/90 to-card px-4 py-3 min-w-[300px] hover:border-primary/50 hover:shadow-[0_8px_28px_-10px_hsl(var(--primary)/0.4)] transition-all text-left">
                <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/15 blur-2xl" />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary shrink-0">
                  <TrendingUp className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div className="relative flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-primary/90">
                      Faturamento · {isCustom ? "Período" : selectedPeriod.label}
                    </p>
                    <CalendarDays className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-display font-black text-[18px] tabular-nums tracking-[-0.02em] text-foreground">
                      {privacy.hidden ? CENSORED : fmt(revenue)}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60 tabular-nums">
                      / meta {privacy.hidden ? CENSORED : fmt(goalTarget)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/70"
                        style={{ width: `${Math.min(100, (revenue/goalTarget)*100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black tabular-nums text-primary shrink-0">{Math.min(100, (revenue/goalTarget)*100).toFixed(0)}%</span>
                  </div>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[320px] p-3 rounded-2xl border-border/60">
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {PERIOD_PRESETS.map((p) => (
                  <button key={p.label}
                    onClick={() => { setSelectedPeriod(p); setIsCustom(false); setCustomRange(undefined); setDatePickerOpen(false); }}
                    className={cn("h-9 rounded-xl text-[12px] font-bold transition-all",
                      !isCustom && selectedPeriod.label === p.label ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const now = brasiliaToday();
                    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                    const to = new Date(now); to.setHours(23,59,59,999);
                    setCustomRange({ from, to }); setIsCustom(true); setDatePickerOpen(false);
                  }}
                  className={cn("h-9 rounded-xl text-[12px] font-bold transition-all col-span-2",
                    isCustom ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
                  Este mês
                </button>
              </div>
              <div className="border-t border-border/40 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Personalizado</p>
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(r) => {
                    if (r?.from) {
                      setCustomRange(r); setIsCustom(true);
                      if (r.from && r.to) setDatePickerOpen(false);
                    }
                  }}
                  locale={ptBR}
                  className="p-0 pointer-events-auto"
                />
              </div>
            </PopoverContent>
          </Popover>
        </header>

        {/* ═══════════ HERO — RANKING BANNER ═══════════ */}
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.08]">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40"
            style={{ backgroundImage: "radial-gradient(50% 80% at 90% 50%, hsl(var(--primary)/0.25), transparent 60%), radial-gradient(40% 60% at 10% 10%, hsl(var(--primary)/0.15), transparent 60%)" }}
          />
          <div className="relative flex flex-col lg:flex-row items-center gap-6 p-5 md:p-6 lg:p-8">
            {/* Left copy */}
            <div className="flex-1 min-w-0 space-y-3 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
                <Trophy className="h-3.5 w-3.5" /> Ranking · Corrida de Faturamento
              </div>
              <h2 className="font-display font-black text-2xl sm:text-3xl lg:text-5xl tracking-[-0.03em] leading-[1.05]">
                Conheça os <span className="text-primary">CAMPEÕES</span>
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto lg:mx-0">
                Os resultados estão definidos. Conheça os vencedores da Corrida de Faturamento e prepare-se para a próxima temporada.
              </p>
            <Link to="/premiacoes?tab=corrida" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-primary-foreground text-[13px] font-bold hover:bg-primary/90 transition-all active:scale-[0.98]">
                Ver ranking completo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Podium visual */}
            <div className="flex items-end gap-2 sm:gap-3 shrink-0">
              {[
                { pos: "02", name: "Airis F.", h: "h-20 sm:h-24", tone: "from-slate-300 to-slate-500" },
                { pos: "01", name: "Bryan G.", h: "h-28 sm:h-32", tone: "from-yellow-300 to-amber-500" },
                { pos: "03", name: "Wdzin", h: "h-16 sm:h-20", tone: "from-orange-400 to-orange-700" },
              ].map((p) => (
                <div key={p.pos} className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{p.name}</span>
                  <div className={cn("w-14 sm:w-16 lg:w-20 rounded-t-xl bg-gradient-to-b flex items-start justify-center pt-2 shadow-lg", p.h, p.tone)}>
                    <span className="font-display font-black text-lg text-background/90">{p.pos}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* ═══════════ 4 KPI CARDS ═══════════ */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Saldo Disponível", value: fmt(Math.max(0, balance)), sub: "Saldo disponível", icon: Wallet, spark: true, isRevenue: false },
            { label: "Recebido Hoje", value: fmt(receivedToday), sub: "Total faturado no dia", icon: RefreshCw, spark: true, isRevenue: false },
            { label: "Bloqueio Cautelar", value: fmt(disputedAmount), sub: "MEDs em disputa", icon: Lock, spark: false, isRevenue: false },
            { label: "Faturamento Total", value: fmt(revenue), sub: "Valor bruto de vendas", icon: TrendingUp, spark: true, isRevenue: true },
          ].map((k) => {
            const Icon = k.icon;
            const isRevenue = k.isRevenue;
              <div key={k.label} className={cn(
                "group relative overflow-hidden rounded-3xl border p-5 transition-all",
                isRevenue
                  ? "border-primary/25 bg-gradient-to-br from-primary/[0.08] via-card to-card hover:border-primary/50 hover:shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.35)]"
                  : "border-border/60 bg-card/80 backdrop-blur hover:border-primary/40 hover:shadow-[0_4px_24px_-8px_hsl(var(--primary)/0.2)]"
              )}>
                {/* Ornamental corner glow for revenue */}
                {isRevenue && (
                  <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
                )}

                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "font-black uppercase tracking-[0.18em]",
                      isRevenue ? "text-[10px] text-primary/90" : "text-[10px] text-muted-foreground/70"
                    )}>{k.label}</p>
                    <p className={cn(
                      "mt-2 font-display font-black tabular-nums tracking-[-0.03em] truncate",
                      isRevenue ? "text-[26px] md:text-[28px] text-foreground" : "text-2xl md:text-[26px] text-foreground"
                    )}>
                      {privacy.hidden ? CENSORED : k.value}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {isRevenue && typeof trend === "number" && (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] tabular-nums",
                          trend > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : trend < 0 ? "border-red-500/30 bg-red-500/10 text-red-500"
                          : "border-border/60 bg-muted/40 text-muted-foreground"
                        )}>
                          {trend > 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : trend < 0 ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
                          {trend > 0 ? "+" : ""}{trend}%
                        </span>
                      )}
                      <p className="text-[11px] text-muted-foreground/60 truncate">{k.sub}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl transition-transform group-hover:scale-110",
                    isRevenue ? "border border-primary/30 bg-primary/15 text-primary" : "bg-primary/10 text-primary"
                  )}>
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                </div>

                {k.spark && sparkData.length > 1 && (
                  <div className={cn("absolute bottom-0 left-0 right-0 pointer-events-none", isRevenue ? "h-14 opacity-90" : "h-10 opacity-70")}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`sp-${k.label}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={isRevenue ? 0.55 : 0.4} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={isRevenue ? 2 : 1.5} fill={`url(#sp-${k.label})`} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ═══════════ 4 QUICK ACTIONS ═══════════ */}
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Gerar PIX", sub: "Exige KYC aprovado", icon: QrCode, onClick: () => { if (!requireApprovedAccount()) setPixDialogOpen(true); } },
            { label: "Solicitar Saque", sub: "Exige KYC aprovado", icon: ArrowDownRight, onClick: () => { if (!requireApprovedAccount()) navigate("/financeiro/saques"); } },
            { label: "Transações", sub: "Exige KYC aprovado", icon: Receipt, onClick: () => { if (!requireApprovedAccount()) navigate("/vendas"); } },
            { label: "Credenciais API", sub: "Exige KYC aprovado", icon: KeyRound, onClick: () => { if (!requireApprovedAccount()) navigate("/integracoes/credenciais"); } },
          ].map((a) => {
            const Icon = a.icon;
            const inner = (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-foreground group-hover:border-primary/50 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-[14px] text-foreground truncate">{a.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 truncate">{a.sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </>
            );
            const cls = "group flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 backdrop-blur px-4 py-3.5 transition-all hover:border-primary/40 hover:bg-card active:scale-[0.98]";
            return <button key={a.label} onClick={a.onClick} className={cn(cls, "text-left")}>{inner}</button>;
          })}
        </section>

        {/* ═══════════ CHART + SIDE PANEL ═══════════ */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">

          {/* Faturamento — Area chart premium */}
          <div className="xl:col-span-2 rounded-3xl border border-border/60 bg-card/80 backdrop-blur overflow-hidden">
            {/* Header with KPI trio + toggle */}
            <div className="flex flex-col gap-4 px-5 md:px-6 pt-5 pb-4 border-b border-border/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">Fluxo · {isCustom ? "Personalizado" : selectedPeriod.label}</p>
                  <h3 className="font-display font-black text-xl tracking-[-0.02em] mt-1">Faturamento</h3>
                </div>
                <div className="flex items-center rounded-full border border-border/60 bg-muted/20 p-1">
                  {PERIOD_PRESETS.filter(p => ["Hoje", "7 dias", "30 dias"].includes(p.label)).map((p) => {
                    const isActive = !isCustom && selectedPeriod.label === p.label;
                    const short = p.label === "Hoje" ? "Hoje" : p.label === "7 dias" ? "Semana" : "Mês";
                    return (
                      <button key={p.label} onClick={() => { setSelectedPeriod(p); setIsCustom(false); }}
                        className={cn("px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.1em] transition-all",
                          isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        )}>
                        {short}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* KPI trio */}
              {(() => {
                const total = chartData.reduce((a, d) => a + d.vendas, 0);
                const active = chartData.filter(d => d.vendas > 0);
                const avg = active.length ? total / active.length : 0;
                const best = chartData.reduce<{ label: string; v: number }>((m, d) => d.vendas > m.v ? { label: d.fullLabel, v: d.vendas } : m, { label: "—", v: 0 });
                const trio = [
                  { k: "Total", v: privacy.hidden ? CENSORED : fmt(total) },
                  { k: "Ticket médio", v: privacy.hidden ? CENSORED : fmt(avg) },
                  { k: "Melhor dia", v: best.v > 0 ? (privacy.hidden ? CENSORED : fmt(best.v)) : "—", sub: best.v > 0 ? best.label : undefined },
                ];
                return (
                  <div className="grid grid-cols-3 gap-2">
                    {trio.map(t => (
                      <div key={t.k} className="rounded-2xl border border-border/40 bg-background/40 px-3 py-2.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{t.k}</p>
                        <p className="mt-1 font-display font-black text-[14px] md:text-[15px] tabular-nums tracking-[-0.02em] truncate">{t.v}</p>
                        {t.sub && <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">{t.sub}</p>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="h-[300px] w-full px-2 pb-4 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 6, bottom: 4 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="hsl(var(--border)/0.5)" />
                  <XAxis dataKey="timestamp" type="number" scale="time"
                    domain={[chartData[0]?.timestamp ?? 0, chartData[chartData.length - 1]?.timestamp ?? 0]}
                    ticks={chartTicks} tickFormatter={chartTickFormatter}
                    axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground)/0.55)", fontSize: 10, fontWeight: 700 }}
                    dy={10} interval="preserveStartEnd" minTickGap={12}
                  />
                  <YAxis hide domain={[0, "dataMax + 100"]} />
                  <Tooltip cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }} wrapperStyle={{ outline: "none" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const p = payload[0];
                        return (
                          <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl px-3.5 py-2.5 shadow-2xl min-w-[160px]">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-1.5">{p.payload.fullLabel}</p>
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              <p className="text-primary font-display font-black text-[15px] tabular-nums leading-none">{fmt(p.value as number)}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2.25} fill="url(#revGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2.5 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right side: donuts + links */}
          <div className="space-y-3">
            {/* Donuts card */}
            <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-5">
              <div className="mb-3">
                <h3 className="font-display font-black text-base tracking-[-0.01em]">Índices</h3>
                <p className="text-[11px] text-muted-foreground/70">Boleto, pix e chargeback</p>
              </div>
              <div className="space-y-4">
                {/* Pix */}
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutPix} dataKey="value" innerRadius={22} outerRadius={30} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                          <Cell fill="hsl(var(--primary))" />
                          <Cell fill="hsl(var(--muted)/0.6)" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center font-display font-black text-[12px] tabular-nums">{pixConversion.toFixed(0)}%</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[14px]">Pix</p>
                    <p className="text-[11px] text-muted-foreground/70">Conversão</p>
                  </div>
                </div>
                {/* Chargeback */}
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutChb} dataKey="value" innerRadius={22} outerRadius={30} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                          <Cell fill={chargebackRate < 1 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                          <Cell fill="hsl(var(--muted)/0.6)" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center font-display font-black text-[12px] tabular-nums">{chargebackRate.toFixed(1)}%</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[14px]">Taxa de estorno</p>
                    <p className="text-[11px] text-muted-foreground/70">Saúde da conta{" "}
                      <span className={cn("ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold", chargebackRate < 1 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")}>
                        {chargebackRate < 1 ? "Excelente" : "Atenção"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment links */}
            <button type="button" onClick={() => { if (!requireApprovedAccount()) navigate("/vendas/link-pagamento"); }} className="group block w-full rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-5 text-left hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display font-black text-base tracking-[-0.01em] flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> Links de pagamentos</h3>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">Relação entre faturamento e vendas por meio do link de pagamentos</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="mt-3 text-[12px] text-muted-foreground/60 italic">Nenhum link de pagamento criado.</p>
            </button>
          </div>
        </section>

        {/* ═══════════ ÚLTIMAS TRANSAÇÕES — Editorial Stream ═══════════ */}
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 backdrop-blur">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 md:px-6 pt-5 pb-4 border-b border-border/40">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shrink-0">
                <Receipt className="h-5 w-5" strokeWidth={2.25} />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-black text-lg tracking-[-0.02em] leading-none">Últimas transações</h3>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  <span className="tabular-nums font-bold text-foreground/80">{activity.length}</span>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  Aprovação <span className="tabular-nums font-bold text-primary">{conversion.toFixed(0)}%</span>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <span className="tabular-nums font-bold text-foreground/80">{privacy.hidden ? CENSORED : fmt(revenue)}</span>
                </p>
              </div>
            </div>
            <button type="button" onClick={() => { if (!requireApprovedAccount()) navigate("/vendas"); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-border/30">
            {activity.length === 0 && (
              <li className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 text-primary">
                  <Receipt className="h-6 w-6" strokeWidth={2} />
                </div>
                <p className="text-[12px] font-black uppercase tracking-[0.24em] text-foreground/70">Aguardando primeira venda</p>
                <p className="text-[12px] text-muted-foreground/70 mt-1.5">Suas transações aparecem aqui em tempo real</p>
              </li>
            )}
            {activity.map((item) => {
              const isApproved = isApprovedTransaction(item.status);
              const method = item.label;
              const methodLabel = method === "pix" ? "PIX" : method === "credit_card" ? "Cartão" : method === "boleto" ? "Boleto" : "Venda";
              const MethodIcon = method === "pix" ? PixLogoMark : method === "credit_card" ? CreditCard : method === "boleto" ? Barcode : Receipt;
              const custName = item.tx.customer_name || item.tx.customer_email || "Cliente";
              const initials = custName.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase() || "?";
              const haloTone =
                isApproved ? "ring-emerald-500/40 bg-emerald-500/[0.08] text-emerald-500"
                : item.status === "pending" ? "ring-amber-400/40 bg-amber-400/[0.08] text-amber-500"
                : item.status === "expired" || item.status === "cancelled" || item.status === "canceled" ? "ring-border/60 bg-muted/40 text-muted-foreground"
                : item.status === "chargeback" || item.status === "med" || item.status === "dispute" || item.status === "disputed" ? "ring-red-500/40 bg-red-500/[0.08] text-red-500"
                : "ring-border/60 bg-muted/40 text-muted-foreground";
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setDetailTx(item.tx)}
                    className="group relative w-full flex items-center gap-3 md:gap-4 px-5 md:px-6 py-3.5 text-left hover:bg-primary/[0.03] transition-colors"
                  >
                    {/* Left accent bar */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity",
                        isApproved ? "bg-emerald-500" : item.status === "pending" ? "bg-amber-400" : item.status === "chargeback" ? "bg-red-500" : "bg-muted-foreground/40"
                      )}
                    />

                    {/* Avatar with status halo */}
                    <div className={cn("relative h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center ring-1 font-display font-black text-[13px] tabular-nums", haloTone)}>
                      {initials}
                    </div>

                    {/* Main */}
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-[14px] text-foreground truncate leading-tight">{custName}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/80 flex items-center gap-1.5 truncate">
                        <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 font-bold uppercase tracking-[0.08em] text-[10px] text-foreground/70">
                          <MethodIcon className="h-3 w-3" />
                          {methodLabel}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(item.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-muted-foreground/40 hidden sm:inline">·</span>
                        <span className="hidden sm:inline text-muted-foreground/60">há {timeAgo(item.createdAt)}</span>
                      </p>
                    </div>

                    {/* Value + status */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="font-display font-black text-[15px] tabular-nums tracking-[-0.02em] text-foreground">
                        {privacy.hidden ? CENSORED : fmt(item.amount)}
                      </span>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]",
                        isApproved ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
                        : item.status === "pending" ? "border-amber-400/30 bg-amber-400/10 text-amber-500"
                        : item.status === "expired" || item.status === "cancelled" || item.status === "canceled" ? "border-border/60 bg-muted/40 text-muted-foreground"
                        : item.status === "chargeback" || item.status === "med" || item.status === "dispute" || item.status === "disputed" ? "border-red-500/25 bg-red-500/10 text-red-500"
                        : "border-border/60 bg-muted/40 text-muted-foreground"
                      )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full",
                          isApproved ? "bg-emerald-500" : item.status === "pending" ? "bg-amber-500 animate-pulse" : item.status === "chargeback" ? "bg-red-500" : "bg-muted-foreground/60"
                        )} />
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <ChevronRight className="hidden sm:block h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Detail panel — premium layout */}
        {detailTx && (
          <TransactionDetailPanel
            tx={detailTx}
            products={productsMap}
            onClose={() => setDetailTx(null)}
            variant="seller"
          />
        )}

        <QuickPixDialog open={pixDialogOpen} onOpenChange={setPixDialogOpen} />
      </div>
    </div>
  );
}
