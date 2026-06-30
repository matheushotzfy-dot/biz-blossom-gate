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
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import QuickPixDialog from "@/components/QuickPixDialog";
import { PixLogoMark } from "@/components/icons/PixLogoMark";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateTransactionConversions, cn, isApprovedTransaction } from "@/lib/utils";

import type { DateRange } from "react-day-picker";
import { Seo } from "@/components/Seo";

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
    const _revenue = _approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const conversions = calculateTransactionConversions(filteredTx);
    const globalPixConversion = calculateTransactionConversions(transactions).pix;

    const _chargebackRate = filteredTx.length > 0 ? (filteredTx.filter(t => t.status === "chargeback").length / filteredTx.length) * 100 : 0;
    const _uniqueCustomers = new Set(filteredTx.map(t => t.customer_email).filter(Boolean)).size;

    return {
      approved: _approved,
      revenue: _revenue,
      conversion: conversions.overall.rate,
      uniqueCustomers: _uniqueCustomers,
      pixConversion: globalPixConversion.rate,
      cardConversion: conversions.card.rate,
      boletoConversion: conversions.boleto.rate,
      chargebackRate: _chargebackRate,
      pixApprovedCount: globalPixConversion.approved, pixTotalCount: globalPixConversion.total,
      cardApprovedCount: conversions.card.approved, cardTotalCount: conversions.card.total,
      boletoApprovedCount: conversions.boleto.approved, boletoTotalCount: conversions.boleto.total,
    };
  }, [filteredTx, transactions]);

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
        const hour = new Date(t.created_at).getHours();
        salesByHour.set(hour, (salesByHour.get(hour) || 0) + Number(t.net_amount));
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
        const d = new Date(t.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth.set(key, (byMonth.get(key) || 0) + Number(t.net_amount));
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
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(t.net_amount));
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
      status: t.status,
      label: t.payment_method || "Venda",
      tx: t,
    }));
    return tx.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const nickname = profile?.nickname || profile?.full_name?.split(" ")[0] || "Vendedor";
  const statusLabel = (s: string) => isApprovedTransaction(s) ? 'Aprovado' : s === 'pending' ? 'Pendente' : s === 'refunded' ? 'Reembolso' : s === 'chargeback' ? 'Chargeback' : s === 'failed' || s === 'refused' ? 'Falhou' : 'Chargeback';
  const statusBg = (s: string) =>
    isApprovedTransaction(s) ? 'bg-emerald-500/20 ring-1 ring-emerald-500/40'
    : s === 'pending' ? 'bg-amber-400/25 ring-1 ring-amber-400/50'
    : s === 'chargeback' ? 'bg-red-600/25 ring-1 ring-red-600/50'
    : s === 'refunded' ? 'bg-muted/40 ring-1 ring-border/40'
    : 'bg-red-500/20 ring-1 ring-red-500/40';
  const statusColor = (s: string) =>
    isApprovedTransaction(s) ? 'text-emerald-500'
    : s === 'pending' ? 'text-amber-500'
    : s === 'chargeback' ? 'text-red-600'
    : s === 'refunded' ? 'text-muted-foreground'
    : 'text-red-500';

  const pendingBalance = useMemo(() => {
    return transactions
      .filter(t => isApprovedTransaction(t.status) && t.retained_until && new Date(t.retained_until) > new Date())
      .reduce((acc, t) => acc + Number(t.retained_amount || 0), 0);
  }, [transactions]);

  // Compare to previous period (same length) for trend deltas
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

    const prevTx = transactions.filter(t => {
      const d = new Date(t.created_at);
      return d >= prevStart && d <= prevEnd;
    });
    const prevApp = prevTx.filter(t => isApprovedTransaction(t.status));
    return {
      prevApprovedCount: prevApp.length,
      prevRevenue: prevApp.reduce((acc, t) => acc + Number(t.net_amount), 0),
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
    { label: "Ticket Médio", value: privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0), icon: BarChart3, color: "neutral", sub: "Média por venda" },
    { label: "Pedidos Pagos", value: approved.length, icon: Zap, color: "success", sub: "Vendas concluídas" },
    { label: "Saldo Pendente", value: privacy.hidden ? CENSORED : fmt(pendingBalance), icon: Clock3, color: "warning", sub: "Aguardando liberação" },
    { label: "Faturamento Total", value: privacy.hidden ? CENSORED : fmt(revenue), icon: TrendingUp, color: "success", sub: `Valor total de vendas · ${compareLabel}`, trend: revenueTrend },
  ];


  return (
    <div className="dashboard-page px-3 pt-2 pb-24 space-y-3 max-w-[1600px] mx-auto animate-in fade-in duration-500 overflow-x-hidden sm:px-4 sm:pb-6 md:px-6 sm:space-y-4">
      <Seo title="Dashboard | Hotzfy" description="Painel de controle com vendas, saldo, transações e KPIs em tempo real." path="/dashboard" noindex />
      {(txError || productsError) && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12px] text-destructive">
          <span className="font-medium">Falha ao carregar parte dos dados. Algumas métricas podem estar desatualizadas.</span>
          <button onClick={() => refetchTx()} className="rounded-md border border-destructive/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider hover:bg-destructive/10 transition-colors">Tentar novamente</button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
             <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <h1 className="max-w-[310px] truncate text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl">{greeting}, {nickname}</h1>
          </div>
        </div>

        {/* Period selector — institutional, dense, Bloomberg-style */}
        <div className="flex h-11 w-full items-stretch overflow-hidden rounded-2xl border border-border bg-card lg:w-auto lg:rounded-xl">


          {/* Segments */}
          <div className="grid flex-1 grid-cols-4 divide-x divide-border lg:flex lg:flex-none lg:items-stretch">
            {PERIOD_PRESETS.map((p) => {
              const isActive = !isCustom && selectedPeriod.label === p.label;
              const shortLabel = p.label === "Hoje" ? "Hoje" : `${p.days}D`;
              return (
                <button
                  key={p.label}
                  onClick={() => { setSelectedPeriod(p); setIsCustom(false); }}
                  className={cn(
                    "seller-segment relative flex min-w-0 items-center justify-center px-2 text-[10px] font-display font-black uppercase tracking-[0.12em] tabular-nums lg:min-w-[58px] lg:px-4 lg:text-[11px] lg:tracking-[0.14em]",
                    isActive
                      ? "text-primary bg-primary/[0.08]"
                      : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />
                  )}
                  {shortLabel}
                </button>
              );
            })}
          </div>

          {/* Custom range trigger — integrated */}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className={cn(
                "seller-segment relative flex min-w-[92px] items-center justify-center gap-1.5 border-l border-border px-2 text-[10px] font-display font-black uppercase tracking-[0.12em] lg:min-w-[112px] lg:px-4 lg:text-[11px] lg:tracking-[0.14em]",
                isCustom
                  ? "text-primary bg-primary/[0.08]"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40"
              )}>
                {isCustom && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />}
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.25} />
                <span className="tabular-nums">
                  {isCustom && customRange?.from
                    ? format(customRange.from, "dd/MM") + (customRange.to ? " – " + format(customRange.to, "dd/MM") : "")
                    : "Custom"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-[320px] overflow-hidden rounded-xl border border-border bg-card p-0"
            >
              {/* Compact header */}
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border">
                <span className="text-[10px] font-display font-black uppercase tracking-[0.16em] text-muted-foreground/80">
                  {customRange?.from
                    ? format(customRange.from, "dd MMM", { locale: ptBR }) +
                      (customRange.to
                        ? " — " + format(customRange.to, "dd MMM", { locale: ptBR })
                        : " — fim?")
                    : "Selecione o intervalo"}
                </span>
                {customRange?.from && customRange?.to && (
                  <span className="text-[10px] font-display font-black uppercase tracking-[0.14em] text-primary tabular-nums px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                    {differenceInDays(customRange.to, customRange.from) + 1}d
                  </span>
                )}
              </div>

              {/* Compact preset chips */}
              <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border bg-secondary/20">
                {(([
                  { label: "Hoje", days: 0 },
                  { label: "7d", days: 6 },
                  { label: "15d", days: 14 },
                  { label: "30d", days: 29 },
                  { label: "Mês", monthMode: "current" },
                ]) as Array<{ label: string; days?: number; monthMode?: "current" }>).map((preset) => {
                  const apply = () => {
                    const today = brasiliaToday();
                    let from: Date, to: Date;
                    if (preset.monthMode === "current") {
                      from = new Date(today.getFullYear(), today.getMonth(), 1);
                      to = today;
                    } else {
                      from = new Date(today);
                      from.setDate(today.getDate() - (preset.days || 0));
                      to = new Date(today);
                    }
                    from.setHours(0, 0, 0, 0);
                    to.setHours(23, 59, 59, 999);
                    setCustomRange({ from, to });
                    setIsCustom(true);
                  };
                  return (
                    <button
                      key={preset.label}
                      onClick={apply}
                      className="px-2.5 py-1 rounded-md text-[10px] font-display font-black uppercase tracking-[0.12em] text-muted-foreground/70 border border-border/50 bg-card hover:text-primary hover:border-primary/40 hover:bg-primary/[0.06] transition-all"
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Single-month calendar with arrow navigation */}
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={(r) => { setCustomRange(r); setIsCustom(true); }}
                locale={ptBR}
                numberOfMonths={1}
                toDate={new Date()}
                defaultMonth={customRange?.from ?? new Date()}
                className="pointer-events-auto p-2"
              />

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-t border-border">
                <button
                  onClick={() => { setCustomRange(undefined); setIsCustom(false); setSelectedPeriod(PERIOD_PRESETS[0]); }}
                  className="text-[10px] font-display font-black uppercase tracking-[0.14em] text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  Limpar
                </button>
                <button
                  onClick={() => setDatePickerOpen(false)}
                  disabled={!customRange?.from || !customRange?.to}
                  className="px-3 py-1.5 rounded-md text-[10px] font-display font-black uppercase tracking-[0.14em] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Aplicar
                </button>
              </div>
            </PopoverContent>


          </Popover>
        </div>

      </div>



      {/* Reorderable section — mobile: hero → chart → stats → shortcuts → conversion */}
      <div className="flex flex-col gap-4 lg:block lg:space-y-4">

      {/* Hero Financial Row */}
      <div className="contents lg:grid lg:grid-cols-4 lg:gap-6">
        <Card className="order-1 lg:order-none seller-hover-card dashboard-hero-card lg:col-span-2 relative overflow-hidden group border-primary/25 bg-card rounded-[1.35rem] min-h-0 sm:rounded-3xl lg:min-h-[220px]">
          {/* Main card inner glow */}
          <div className="absolute inset-px rounded-[1.45rem] bg-gradient-to-br from-primary/[0.01] to-transparent pointer-events-none" />
          
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] transition-all duration-700 group-hover:opacity-[0.08] group-hover:scale-110 hidden sm:block">
            <Wallet className="h-40 w-40 -rotate-12" />
          </div>

          <CardHeader className="px-4 pb-1 pt-4 sm:px-6 sm:pt-5 md:px-8">
             <div className="flex w-fit items-center gap-2 rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-primary transition-all sm:text-[10px] sm:tracking-widest">
                <BarChart3 className="h-3 w-3" />
                Faturamento do Dia
             </div>
          </CardHeader>
          
          <CardContent className="px-4 pb-4 pt-2 sm:px-6 sm:pb-5 md:px-8">
            <div className="flex flex-col gap-3.5 sm:gap-5">
              <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
                <p className="min-w-0 max-w-full truncate text-[28px] font-numbers font-bold leading-none tracking-tight text-foreground min-[380px]:text-[32px] sm:text-4xl md:text-5xl">
                  {privacy.hidden ? CENSORED : fmt(revenue)}
                </p>
                <span className="shrink-0 text-xs font-bold text-muted-foreground/30 sm:text-base">BRL</span>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 rounded-2xl border border-border/40 bg-background/40 p-3 transition-all group-hover:border-primary/20 sm:flex sm:w-fit sm:flex-wrap sm:items-center sm:gap-4 sm:p-4 md:gap-6">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-3 w-3 text-muted-foreground/60" />
                    <p className="truncate text-[8px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 sm:text-[9px] sm:tracking-wider">Saldo Disponível</p>
                  </div>
                  <p className="truncate text-sm font-bold leading-none tracking-tight text-success min-[380px]:text-base sm:text-lg">{privacy.hidden ? CENSORED : fmt(balance)}</p>
                </div>
                <div className="hidden sm:block h-8 w-px bg-border/40" />
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-[8px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 sm:text-[9px] sm:tracking-wider">Conversão</p>
                  <p className="truncate text-sm font-bold leading-none tracking-tight text-primary min-[380px]:text-base sm:text-lg">{conversion.toFixed(1)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 sm:gap-3">
                <Link
                  to="/financeiro/saques"
                  className="seller-action flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-3 text-[11px] font-bold text-primary-foreground sm:px-4 sm:text-[12px]"
                >
                  <ArrowDownRight className="h-4 w-4 shrink-0" />
                  <span>Solicitar Saque</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setPixDialogOpen(true)}
                  className="seller-action dashboard-quick-pix flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-card px-3 text-[11px] font-bold text-foreground hover:bg-primary/[0.06] sm:px-4 sm:text-[12px]"
                >
                  <Zap className="h-4 w-4 text-success shrink-0" />
                  <span>Gerar Pix</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="order-3 grid grid-cols-2 gap-2.5 lg:order-none lg:col-span-2 sm:gap-4 md:gap-5">
          {financialCards.map((card) => (
            <StatCard 
              key={card.label}
              title={card.label}
              value={card.value}
              icon={card.icon}
              color={card.color}
              description={card.sub}
              trend={card.trend}
              changeType={card.trend === undefined ? "neutral" : card.trend > 0 ? "positive" : card.trend < 0 ? "negative" : "neutral"}
            />
          ))}
        </div>
      </div>

      {/* Integration shortcuts row */}
      <div className="order-4 grid grid-cols-2 gap-2.5 lg:order-none sm:grid-cols-4 sm:gap-3 md:gap-4">
        {[
          { label: "Credenciais API", sub: "Gerencie suas chaves", icon: KeyRound, to: "/integracoes/credenciais" },
          { label: "Documentação", sub: "Guia de integração", icon: BookOpen, to: "/integracoes/documentacao" },
          { label: "Webhooks", sub: "Eventos em tempo real", icon: Webhook, to: "/integracoes/webhooks" },
          { label: "Integrações", sub: "Conecte seus apps", icon: Puzzle, to: "/integracoes/apps" },
        ].map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="group relative isolate flex min-h-[102px] w-full min-w-0 flex-col items-start justify-between gap-2 overflow-hidden rounded-[1.05rem] border border-border/70 bg-card p-3 outline-none transition-[transform,border-color,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary/70 hover:bg-primary/[0.045] focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-0 active:scale-[0.99] sm:min-h-[86px] sm:flex-row sm:items-center sm:justify-start sm:gap-2.5 sm:rounded-2xl sm:px-3.5"
          >
            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-foreground/75 transition-[border-color,background-color,color,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 group-hover:-rotate-3 group-hover:border-primary/55 group-hover:bg-primary/[0.12] group-hover:text-primary">
              <item.icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110" />
            </div>
            <div className="relative z-10 min-w-0 flex-1 pr-0.5">
              <p className="truncate text-[12px] font-black leading-[1.15] text-foreground transition-colors duration-300 group-hover:text-primary sm:text-[13px]">
                {item.label}
              </p>
              <p className="mt-1 truncate text-[8px] font-bold uppercase leading-[1.25] tracking-[0.08em] text-muted-foreground/60 transition-colors duration-300 group-hover:text-muted-foreground/90 sm:text-[10px]">
                {item.sub}
              </p>
            </div>
            <div className="relative z-10 hidden xl:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/45 bg-background/40 text-muted-foreground/45 transition-[transform,border-color,background-color,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1 group-hover:border-primary/50 group-hover:bg-primary/[0.12] group-hover:text-primary">
              <ChevronRight className="h-4 w-4" />
            </div>
            <span className="pointer-events-none absolute inset-x-4 top-0 z-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <span className="pointer-events-none absolute left-0 top-3 bottom-3 z-0 w-[3px] origin-center scale-y-50 rounded-r-full bg-primary opacity-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100 group-hover:opacity-100" />
            <span className="pointer-events-none absolute inset-0 z-0 -translate-x-[120%] bg-[linear-gradient(115deg,transparent_0%,hsl(var(--primary)/0.10)_44%,transparent_72%)] opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[120%] group-hover:opacity-100" />
            <span className="pointer-events-none absolute inset-0 z-0 bg-primary/[0.025] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      {/* Main Operations Grid */}
      <div className="contents lg:grid lg:grid-cols-3 lg:gap-6 lg:items-stretch">
        <Card className="order-2 lg:order-none seller-hover-card dashboard-sales-flow-card lg:col-span-2 flex h-full flex-col overflow-hidden rounded-[1.35rem] border-border/50 sm:rounded-3xl">
          <CardHeader className="flex flex-col gap-3 border-b border-border/40 px-4 py-4 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between sm:px-6 sm:py-5 md:px-8">
            <div>
              <CardTitle className="text-base font-bold sm:text-lg">Fluxo de Vendas</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider opacity-50">Desempenho financeiro</CardDescription>
            </div>
            <div className="flex w-full items-center justify-between gap-3 text-xs font-bold min-[520px]:w-auto min-[520px]:justify-start min-[520px]:gap-4">
               <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="opacity-60">Aprovadas</span>
               </div>
               <div className="max-w-[150px] truncate font-bold text-primary sm:max-w-none">{fmt(revenue)}</div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            <div className="h-[246px] w-full pt-5 pb-3 pl-0 pr-2 min-[390px]:h-[264px] sm:h-[320px] sm:pr-6 sm:pl-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.3)" />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    scale="time"
                    domain={[chartData[0]?.timestamp ?? 0, chartData[chartData.length - 1]?.timestamp ?? 0]}
                    ticks={chartTicks}
                    tickFormatter={chartTickFormatter}
                    axisLine={false}
                    tickLine={false}
                    tick={{fill: 'hsl(var(--muted-foreground)/0.5)', fontSize: 10, fontWeight: 700}}
                    dy={10}
                    interval={0}
                    minTickGap={0}
                  />
                  <YAxis width={42} axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground)/0.5)', fontSize: 10, fontWeight: 700}} tickFormatter={(v) => Number(v) >= 1000 ? `R$${Math.round(Number(v) / 1000)}k` : `R$${v}`} />
                  <Tooltip 
                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                    wrapperStyle={{ outline: 'none' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="dashboard-chart-tooltip animate-in fade-in zoom-in-95 duration-150">
                            <p className="tooltip-label mb-1.5 text-[10px] font-black uppercase tracking-[0.18em]">
                              {payload[0].payload.fullLabel || payload[0].payload.name}
                            </p>
                            <p className="tooltip-value text-[24px] font-black tracking-tight tabular-nums leading-none">
                              {fmt(payload[0].value as number)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Area 
                    type="monotone" 
                    dataKey="vendas" 
                    stroke="hsl(var(--primary))" 
                      strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorVendas)"
                    activeDot={{ 
                      r: 6, 
                      fill: "hsl(var(--primary))", 
                      stroke: "hsl(var(--background))", 
                      strokeWidth: 3,
                      className: "text-primary"
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="order-5 lg:order-none seller-hover-card flex h-full flex-col overflow-hidden rounded-[1.35rem] border-border/50 bg-card sm:rounded-3xl">
          <CardHeader className="border-b border-border/40 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold sm:text-lg">Conversão Geral</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider opacity-50">Desempenho por método</CardDescription>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl border border-primary/20">
                <span className="text-lg font-bold sm:text-xl">{conversion.toFixed(1)}%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4 sm:space-y-5">
              {/* PIX */}
              <div className="group space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center">
                      <PixLogoMark className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">PIX</p>
                      <p className="text-[10px] font-bold text-muted-foreground/50">{pixApprovedCount} de {pixTotalCount} pagos</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-info">{pixConversion.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border/20">
                  <div className="h-full bg-gradient-to-r from-info/40 to-info rounded-full transition-all duration-1000" style={{ width: `${pixConversion}%` }} />
                </div>
              </div>

              {/* Cartão */}
              <div className="group space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <CreditCard className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">Cartão</p>
                      <p className="text-[10px] font-bold text-muted-foreground/50">{cardApprovedCount} de {cardTotalCount} pagos</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-primary">{cardConversion.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border/20">
                  <div className="h-full bg-gradient-to-r from-primary/40 to-primary rounded-full transition-all duration-1000" style={{ width: `${cardConversion}%` }} />
                </div>
              </div>

              {/* Boleto */}
              <div className="group space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning">
                      <Barcode className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">Boleto</p>
                      <p className="text-[10px] font-bold text-muted-foreground/50">{boletoApprovedCount} de {boletoTotalCount} pagos</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-warning">{boletoConversion.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border/20">
                  <div className="h-full bg-gradient-to-r from-warning/40 to-warning rounded-full transition-all duration-1000" style={{ width: `${boletoConversion}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
      {/* /Reorderable section */}

      {/* Recent Activity */}
      <Card className="seller-hover-card overflow-hidden rounded-[1.35rem] border-border/40 sm:rounded-3xl">
        <CardHeader className="flex flex-col gap-3 border-b border-border/40 px-4 py-4 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between sm:px-6 sm:py-6 md:px-8">
          <div>
            <CardTitle className="text-base font-bold sm:text-lg">Últimas Transações</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider opacity-50">Acompanhamento em tempo real</CardDescription>
          </div>
          <Link to="/vendas" className="seller-link-action flex w-fit items-center gap-1 text-[11px] font-bold text-primary underline-offset-4 hover:underline sm:text-xs">
             Ver Histórico Completo
             <ChevronRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {activity.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDetailTx(item.tx)}
                className="seller-row-action group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-8 sm:py-6"
              >
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 sm:h-11 sm:w-11 sm:rounded-2xl", statusBg(item.status))}>
                    {item.label === "pix" ? (
                      <PixLogoMark className="h-5 w-5" />
                    ) : item.label === "boleto" ? (
                      <Barcode className={cn("h-5 w-5", statusColor(item.status))} />
                    ) : (
                      <CreditCard className={cn("h-5 w-5", statusColor(item.status))} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold sm:text-sm">{item.label === "pix" ? "Pagamento via PIX" : item.label === "credit_card" ? "Pagamento via Cartão" : item.label === "boleto" ? "Pagamento via Boleto" : "Transação"}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">{timeAgo(item.createdAt)}</p>
                  </div>
                </div>
                <div className="max-w-[128px] shrink-0 text-right sm:max-w-none">
                  <p className="truncate text-[13px] font-bold sm:text-sm">{fmt(item.amount)}</p>
                  <p className={cn("text-[10px] font-bold uppercase tracking-widest", statusColor(item.status))}>{statusLabel(item.status)}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transaction quick-detail popup */}
      <Dialog open={!!detailTx} onOpenChange={(v) => !v && setDetailTx(null)}>
        <DialogContent className="max-w-md">
          {detailTx && (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Detalhes da venda</p>
                <h3 className="text-xl font-bold mt-1">{fmt(Number(detailTx.amount))}</h3>
                <p className={cn("text-xs font-bold uppercase tracking-widest mt-1", statusColor(detailTx.status))}>{statusLabel(detailTx.status)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-border/40 p-3">
                  <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-1">Método</p>
                  <p className="font-semibold flex items-center gap-1.5">
                    {detailTx.payment_method === "pix" ? <><PixLogoMark className="h-3.5 w-3.5"/> PIX</>
                      : detailTx.payment_method === "credit_card" ? <><CreditCard className="h-3.5 w-3.5"/> Cartão</>
                      : detailTx.payment_method === "boleto" ? <><Barcode className="h-3.5 w-3.5"/> Boleto</>
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 p-3">
                  <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-1">Líquido</p>
                  <p className="font-semibold">{fmt(Number(detailTx.net_amount || 0))}</p>
                </div>
                <div className="rounded-xl border border-border/40 p-3 col-span-2">
                  <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1"><User className="h-3 w-3"/> Cliente</p>
                  <p className="font-semibold truncate">{detailTx.customer_name || "—"}</p>
                  {detailTx.customer_email && <p className="text-muted-foreground text-[11px] truncate flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3"/>{detailTx.customer_email}</p>}
                </div>
                <div className="rounded-xl border border-border/40 p-3 col-span-2">
                  <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1"><Hash className="h-3 w-3"/> ID</p>
                  <p className="font-mono text-[11px] truncate">{detailTx.id}</p>
                </div>
                <div className="rounded-xl border border-border/40 p-3 col-span-2">
                  <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1"><CalendarDays className="h-3 w-3"/> Criada</p>
                  <p className="font-semibold">{new Date(detailTx.created_at).toLocaleString("pt-BR")}</p>
                </div>
              </div>
              <button
                onClick={() => { const id = detailTx.id; setDetailTx(null); navigate(`/vendas?tx=${id}`); }}
                className="seller-action w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90"
              >
                Ver completo na aba Vendas <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <QuickPixDialog open={pixDialogOpen} onOpenChange={setPixDialogOpen} />
    </div>
  );
}

