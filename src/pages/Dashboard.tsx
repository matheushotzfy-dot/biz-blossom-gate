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

      {/* Blueprint grid backdrop — flat, no glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border)/0.4) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)/0.4) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "linear-gradient(to bottom, black, transparent 55%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 55%)",
        }}
      />

      <div className="relative z-10 px-2 sm:px-4 md:px-6 pt-4 pb-24 max-w-[1600px] mx-auto space-y-5">


        {(txError || productsError) && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-[12px] text-destructive">
            <span className="font-semibold">Falha ao carregar métricas</span>
            <button onClick={() => refetchTx()} className="rounded-lg border border-destructive/50 px-3 py-1 text-[11px] font-bold hover:bg-destructive/10">Tentar novamente</button>
          </div>
        )}

        {/* ═══════════ HEADER ═══════════ */}
        <header className="flex flex-col gap-4 border-b border-border/60 pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <span>Painel operacional</span>
              <span className="text-border">/</span>
              <span className="tabular-nums">{format(new Date(), "dd MMM yyyy", { locale: ptBR }).toUpperCase()}</span>
            </div>

            <h1 className="mt-2 flex items-center gap-2.5 font-display text-[26px] font-bold leading-none tracking-[-0.035em] md:text-[34px]">
              <span className="truncate">{nickname}</span>
              <button
                onClick={privacy.toggle}
                aria-label={privacy.hidden ? "Mostrar valores" : "Ocultar valores"}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground/60 transition-colors hover:border-border hover:text-foreground"
              >
                {privacy.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </h1>
          </div>

          {/* Período + meta — bloco técnico */}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className="group w-full min-w-[300px] rounded-lg border border-border/60 bg-card px-4 py-3 text-left transition-colors hover:border-border md:w-auto">
                <div className="flex items-center justify-between gap-6">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                    Faturamento · {isCustom ? "Período" : selectedPeriod.label}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50 transition-colors group-hover:text-foreground">
                    Alterar <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-display text-[20px] font-bold tabular-nums leading-none tracking-[-0.03em] text-foreground">
                    {privacy.hidden ? CENSORED : fmt(revenue)}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground/50">
                    / {privacy.hidden ? CENSORED : fmt(goalTarget)}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-[3px] flex-1 overflow-hidden rounded-sm bg-muted/60">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, (revenue / goalTarget) * 100)}%` }} />
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/50">
                    {Math.min(100, (revenue / goalTarget) * 100).toFixed(0)}%
                  </span>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[320px] rounded-lg border-border/60 p-3">
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {PERIOD_PRESETS.map((p) => (
                  <button key={p.label}
                    onClick={() => { setSelectedPeriod(p); setIsCustom(false); setCustomRange(undefined); setDatePickerOpen(false); }}
                    className={cn("h-9 rounded-md text-[12px] font-semibold transition-colors",
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
                  className={cn("col-span-2 h-9 rounded-md text-[12px] font-semibold transition-colors",
                    isCustom ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
                  Este mês
                </button>
              </div>
              <div className="border-t border-border/40 pt-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Personalizado</p>
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
                  className="pointer-events-auto p-0"
                />
              </div>
            </PopoverContent>
          </Popover>
        </header>

        {/* ═══════════ RANKING BLOCK ═══════════ */}
        <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">
              Corrida de faturamento
            </span>
            <span className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-primary">
              Temporada encerrada
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
            <div className="flex flex-col justify-center gap-3 px-5 py-6 lg:border-r lg:border-border/60">
              <h2 className="font-display text-[28px] font-bold leading-[1.05] tracking-[-0.04em] lg:text-[36px]">
                Os campeões<br />estão definidos.
              </h2>
              <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground/70">
                Confira o resultado consolidado da temporada e as premiações liberadas para os primeiros colocados.
              </p>
              <Link
                to="/premiacoes?tab=corrida"
                className="mt-1 inline-flex w-fit items-center gap-2 rounded-md border border-border bg-foreground px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-background transition-opacity hover:opacity-85"
              >
                Ver ranking completo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <ul className="divide-y divide-border/50 border-t border-border/60 lg:border-t-0">
              {[
                { pos: "01", name: "Bryan G.", note: "Campeão da temporada", pct: 100 },
                { pos: "02", name: "Airis F.", note: "Vice-campeão", pct: 72 },
                { pos: "03", name: "Wdzin", note: "Terceiro colocado", pct: 48 },
              ].map((p, i) => (
                <li key={p.pos} className="relative flex items-center gap-4 px-5 py-4">
                  {i === 0 && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-primary" />}
                  <span className={cn(
                    "font-display text-[22px] font-bold tabular-nums leading-none tracking-[-0.04em]",
                    i === 0 ? "text-primary" : "text-muted-foreground/35",
                  )}>
                    {p.pos}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-foreground">{p.name}</p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50">{p.note}</p>
                  </div>
                  <div className="hidden h-[3px] w-24 overflow-hidden rounded-sm bg-muted/60 sm:block">
                    <div className={cn("h-full", i === 0 ? "bg-primary" : "bg-muted-foreground/35")} style={{ width: `${p.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>


        {/* ═══════════ METRICS RAIL ═══════════ */}
        <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { code: "01", label: "Saldo disponível", value: fmt(Math.max(0, balance)), sub: "Livre para saque", accent: false, spark: false },
              { code: "02", label: "Recebido hoje", value: fmt(receivedToday), sub: "Liquidado no dia", accent: false, spark: false },
              { code: "03", label: "Bloqueio cautelar", value: fmt(disputedAmount), sub: "MEDs em disputa", accent: false, spark: false },
              { code: "04", label: "Faturamento total", value: fmt(revenue), sub: "Volume bruto no período", accent: true, spark: true },
            ].map((k, i) => (
              <div
                key={k.label}
                className={cn(
                  "relative flex flex-col justify-between border-border/50 px-5 py-5",
                  i > 0 && "border-t sm:border-t-0",
                  i % 2 === 1 && "sm:border-l",
                  i === 2 && "sm:border-t xl:border-t-0",
                  i > 0 && "xl:border-l",
                  k.accent && "bg-muted/20",
                )}
              >
                {k.accent && <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-primary xl:inset-y-0 xl:left-0 xl:right-auto xl:h-auto xl:w-[2px]" />}

                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-mono text-[10px] tabular-nums",
                    k.accent ? "text-primary/80" : "text-muted-foreground/35",
                  )}>
                    {k.code}
                  </span>
                  <span aria-hidden className="h-px w-3 bg-border" />
                  <p className={cn(
                    "truncate font-mono text-[10px] uppercase tracking-[0.18em]",
                    k.accent ? "text-primary/90" : "text-muted-foreground/55",
                  )}>
                    {k.label}
                  </p>
                </div>

                <p className="mt-3 truncate font-display text-[27px] font-bold leading-none tracking-[-0.04em] tabular-nums text-foreground">
                  {privacy.hidden ? CENSORED : k.value}
                </p>

                <p className="mt-2 truncate text-[11px] text-muted-foreground/50">{k.sub}</p>

                {k.spark && sparkData.length > 1 && (
                  <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 opacity-30">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="sp-rail" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1} fill="url(#sp-rail)" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ QUICK ACTIONS ═══════════ */}
        <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { key: "PIX", label: "Gerar cobrança", sub: "QR Code e copia-e-cola", onClick: () => { if (!requireApprovedAccount()) setPixDialogOpen(true); } },
              { key: "OUT", label: "Solicitar saque", sub: "Transferir saldo disponível", onClick: () => { if (!requireApprovedAccount()) navigate("/financeiro/saques"); } },
              { key: "TXN", label: "Transações", sub: "Extrato completo de vendas", onClick: () => { if (!requireApprovedAccount()) navigate("/vendas"); } },
              { key: "API", label: "Credenciais", sub: "Chaves, webhooks e docs", onClick: () => { if (!requireApprovedAccount()) navigate("/integracoes/credenciais"); } },
            ].map((a, i) => (
              <button
                key={a.key}
                onClick={a.onClick}
                className={cn(
                  "group flex items-center gap-3.5 border-border/50 px-5 py-4 text-left transition-colors hover:bg-muted/25",
                  i > 0 && "border-t sm:border-t-0",
                  i % 2 === 1 && "sm:border-l",
                  i === 2 && "sm:border-t xl:border-t-0",
                  i > 0 && "xl:border-l",
                )}
              >
                <span className="shrink-0 rounded-sm border border-border/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/50 transition-colors group-hover:border-primary/50 group-hover:text-primary">
                  {a.key}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-foreground">{a.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground/50">{a.sub}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/25 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground/60" />
              </button>
            ))}
          </div>
        </section>



        {/* ═══════════ CHART + SIDE PANEL ═══════════ */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">

          {/* Faturamento */}
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card xl:col-span-2">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">Faturamento</p>
                <p className="mt-1 text-[13px] font-semibold text-foreground">
                  {isCustom ? "Período personalizado" : selectedPeriod.label}
                </p>
              </div>
              <div className="flex items-center rounded-md border border-border/60 p-0.5">
                {PERIOD_PRESETS.filter(p => ["Hoje", "7 dias", "30 dias"].includes(p.label)).map((p) => {
                  const isActive = !isCustom && selectedPeriod.label === p.label;
                  const short = p.label === "Hoje" ? "Hoje" : p.label === "7 dias" ? "7d" : "30d";
                  return (
                    <button key={p.label} onClick={() => { setSelectedPeriod(p); setIsCustom(false); }}
                      className={cn("rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                        isActive ? "bg-foreground text-background" : "text-muted-foreground/60 hover:text-foreground"
                      )}>
                      {short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-[300px] w-full pb-4 pr-4 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border)/0.35)" />
                  <XAxis dataKey="timestamp" type="number" scale="time"
                    domain={[chartData[0]?.timestamp ?? 0, chartData[chartData.length - 1]?.timestamp ?? 0]}
                    ticks={chartTicks} tickFormatter={chartTickFormatter}
                    axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground)/0.5)", fontSize: 10, fontFamily: "ui-monospace, monospace" }}
                    dy={8} interval="preserveStartEnd" minTickGap={20}
                  />
                  <YAxis width={48} axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground)/0.45)", fontSize: 10, fontFamily: "ui-monospace, monospace" }}
                    tickFormatter={(v) => Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : `${v}`}
                  />
                  <Tooltip cursor={{ stroke: "hsl(var(--foreground)/0.35)", strokeWidth: 1 }} wrapperStyle={{ outline: "none" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const p = payload[0];
                        return (
                          <div className="rounded-md border border-border bg-card px-3 py-2">
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">{p.payload.fullLabel}</p>
                            <p className="mt-1 font-display text-[14px] font-bold tabular-nums text-foreground">{fmt(p.value as number)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={1.75} fill="url(#revGrad)"
                    dot={false}
                    activeDot={{ r: 3, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Índices — barras horizontais */}
            <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
              <div className="border-b border-border/60 px-5 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">Índices operacionais</p>
              </div>
              <div className="divide-y divide-border/50">
                {[
                  { label: "Conversão Pix", value: pixConversion, suffix: "%", ok: true, note: "Pedidos pagos / gerados" },
                  { label: "Taxa de estorno", value: chargebackRate, suffix: "%", ok: chargebackRate < 1, note: chargebackRate < 1 ? "Dentro do limite" : "Acima do limite" },
                ].map((m) => (
                  <div key={m.label} className="px-5 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13px] font-semibold text-foreground">{m.label}</p>
                      <p className={cn("font-display text-[17px] font-bold tabular-nums leading-none tracking-[-0.03em]", m.ok ? "text-foreground" : "text-destructive")}>
                        {m.value.toFixed(1)}{m.suffix}
                      </p>
                    </div>
                    <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-sm bg-muted/60">
                      <div className={cn("h-full", m.ok ? "bg-primary" : "bg-destructive")} style={{ width: `${Math.min(100, m.value)}%` }} />
                    </div>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/45">{m.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment links */}
            <button
              type="button"
              onClick={() => { if (!requireApprovedAccount()) navigate("/vendas/link-pagamento"); }}
              className="group flex flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-card text-left transition-colors hover:border-border"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">Links de pagamento</p>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground/60" />
              </div>
              <div className="flex flex-1 flex-col justify-center px-5 py-5">
                <p className="text-[13px] text-muted-foreground/70">
                  Nenhum link de pagamento criado.
                </p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary/80">
                  Criar primeiro link
                </p>
              </div>
            </button>
          </div>
        </section>


        {/* ═══════════ ÚLTIMAS TRANSAÇÕES ═══════════ */}
        <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3 md:px-6">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">Últimas transações</p>
              <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground/45">
                {activity.length} {activity.length === 1 ? "registro" : "registros"} · {conversion.toFixed(0)}% aprovadas
              </p>
            </div>
            <button
              type="button"
              onClick={() => { if (!requireApprovedAccount()) navigate("/vendas"); }}
              className="rounded-md border border-border/60 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60 transition-colors hover:border-border hover:text-foreground"
            >
              Ver todas
            </button>
          </div>

          {activity.length > 0 && (
            <div className="hidden grid-cols-[1fr_100px_120px_110px_20px] gap-4 border-b border-border/60 bg-muted/15 px-5 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/45 md:grid md:px-6">
              <span>Cliente</span>
              <span>Método</span>
              <span className="text-right">Valor</span>
              <span>Status</span>
              <span />
            </div>
          )}

          <ul className="divide-y divide-border/40">
            {activity.length === 0 && (
              <li className="px-6 py-16 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/50">Sem registros no período</p>
                <p className="mt-2 text-[12px] text-muted-foreground/45">Suas vendas aparecerão aqui em tempo real.</p>
              </li>

            )}
            {activity.map((item) => {
              const isApproved = isApprovedTransaction(item.status);
              const method = item.label;
              const methodLabel = method === "pix" ? "PIX" : method === "credit_card" ? "Cartão" : method === "boleto" ? "Boleto" : "—";
              const custName = item.tx.customer_name || item.tx.customer_email || "Cliente";
              const dot =
                isApproved ? "bg-emerald-500"
                : item.status === "pending" ? "bg-amber-500"
                : item.status === "chargeback" || item.status === "med" || item.status === "dispute" || item.status === "disputed" ? "bg-red-500"
                : "bg-muted-foreground/50";
              const statusColor =
                isApproved ? "text-emerald-600 dark:text-emerald-500"
                : item.status === "pending" ? "text-amber-600 dark:text-amber-500"
                : item.status === "chargeback" || item.status === "med" || item.status === "dispute" || item.status === "disputed" ? "text-red-600 dark:text-red-500"
                : "text-muted-foreground";
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setDetailTx(item.tx)}
                    className="group w-full grid md:grid-cols-[1fr_100px_120px_110px_20px] grid-cols-[1fr_auto] gap-4 items-center px-5 md:px-6 py-3 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{custName}</p>
                      <p className="text-[11px] text-muted-foreground/70 tabular-nums mt-0.5">
                        {new Date(item.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="hidden md:inline text-[12px] text-muted-foreground">{methodLabel}</span>
                    <span className="hidden md:block text-right font-display font-semibold text-[13px] tabular-nums text-foreground">
                      {privacy.hidden ? CENSORED : fmt(item.amount)}
                    </span>
                    <span className={cn("hidden md:inline-flex items-center gap-1.5 text-[11px] font-semibold", statusColor)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                      {statusLabel(item.status)}
                    </span>
                    <div className="md:hidden flex flex-col items-end gap-1">
                      <span className="font-display font-semibold text-[13px] tabular-nums text-foreground">
                        {privacy.hidden ? CENSORED : fmt(item.amount)}
                      </span>
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold", statusColor)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <ChevronRight className="hidden md:block h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
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
