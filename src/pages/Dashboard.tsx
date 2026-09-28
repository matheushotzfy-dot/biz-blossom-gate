import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions, useWithdrawals, useProducts as useProductsQuery, useDisputes, useLedgerBalance, useDashboardStats } from "@/hooks/useQueryData";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateTransactionConversions, cn, deriveTransactionStatus, isApprovedTransaction } from "@/lib/utils";

import type { DateRange } from "react-day-picker";
import { Seo } from "@/components/Seo";
import { useKycStatus } from "@/hooks/useKycStatus";
import { PeriodPicker, buildPeriod, type PeriodValue, type PeriodPresetId } from "@/components/PeriodPicker";
import { toast } from "sonner";
import { PromoBanner } from "@/components/dashboard/PromoBanner";
import { SellerOnboarding } from "@/components/dashboard/SellerOnboarding";
import { Button } from "@/components/ui/button";


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

// ═══════════ PERIOD DIAL — gatilho do seletor de período ═══════════
type PeriodDialProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  label: string;
  goalPct: number;
  revenueLabel: string;
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
};

function PeriodDial({ open, setOpen, label, goalPct, revenueLabel, value, onChange }: PeriodDialProps) {
  const today = new Date();
  const dayNum = today.getDate();
  const pct = Math.max(0, Math.min(100, goalPct));

  return (
    <PeriodPicker
      open={open}
      onOpenChange={setOpen}
      value={value}
      onChange={onChange}
      align="end"
      side="bottom"
      trigger={
        <button
          aria-label="Selecionar período"
          className="group relative flex items-end gap-3 border-b border-primary/30 bg-transparent px-1 pb-1.5 pt-1 text-left transition-colors hover:border-primary/70"
        >
          <span className="flex items-baseline gap-[3px] leading-none">
            <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.05em] tabular-nums text-foreground">
              {String(dayNum).padStart(2, "0")}
            </span>
            <span className="font-display text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-muted-foreground/60">
              {today.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
            </span>
          </span>

          <span className="h-6 w-px bg-border/70" />

          <span className="min-w-0 leading-none">
            <span className="block text-[9.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
              {label}
            </span>
            <span className="mt-1 block font-display text-[14px] font-bold leading-none tabular-nums tracking-[-0.03em] text-foreground">
              {revenueLabel}
            </span>
          </span>

          <ChevronRight className="mb-[3px] h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />

          <span aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] overflow-hidden">
            <span className="block h-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
          </span>
        </button>
      }
    />
  );
}



export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { data: transactions = [], isError: txError, refetch: refetchTx } = useTransactions(25);
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
  const kyc = useKycStatus();
  const accountLocked = !kyc.approved;

  // Valor normalizado do seletor de período (fonte única para o PeriodPicker).
  const periodValue = useMemo<PeriodValue>(() => {
    if (isCustom && customRange?.from) {
      const from = new Date(customRange.from); from.setHours(0, 0, 0, 0);
      const to = new Date(customRange.to ?? customRange.from); to.setHours(23, 59, 59, 999);
      const monthStart = new Date(from.getFullYear(), from.getMonth(), 1);
      const isMonth = from.getTime() === monthStart.getTime() && to.toDateString() === brasiliaToday().toDateString();
      const y = new Date(brasiliaToday()); y.setDate(y.getDate() - 1);
      const isYesterday = from.toDateString() === y.toDateString() && to.toDateString() === y.toDateString();
      return { presetId: isMonth ? "month" : isYesterday ? "yesterday" : null, from, to };
    }
    const map: Record<number, PeriodPresetId> = { 0: "today", 7: "7d", 15: "15d", 30: "30d" };
    return buildPeriod(map[selectedPeriod.days] ?? "today");
  }, [isCustom, customRange, selectedPeriod]);

  const applyPeriod = useCallback((v: PeriodValue) => {
    const presetDays: Partial<Record<PeriodPresetId, number>> = { today: 0, "7d": 7, "15d": 15, "30d": 30 };
    if (v.presetId && v.presetId in presetDays) {
      const days = presetDays[v.presetId]!;
      const preset = PERIOD_PRESETS.find((p) => p.days === days) ?? PERIOD_PRESETS[0];
      setSelectedPeriod(preset);
      setIsCustom(false);
      setCustomRange(undefined);
      return;
    }
    setCustomRange({ from: v.from, to: v.to });
    setIsCustom(true);
  }, []);

  const requireApprovedAccount = useCallback((target = "/perfil?tab=identidade&scrollTo=kyc") => {
    if (!accountLocked) return false;
    toast.warning("Complete o KYC e aguarde aprovação do administrador para liberar esta função.");
    navigate(target);
    return true;
  }, [accountLocked, navigate]);


  // Janela do período selecionado (fonte única para agregados e gráfico)
  const { rangeStart, rangeEnd, bucket, spanDays } = useMemo(() => {
    const today = brasiliaToday();
    let start: Date;
    let end: Date;

    if (isCustom && customRange?.from) {
      start = new Date(customRange.from);
      end = new Date(customRange.to ?? customRange.from);
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

    const span = differenceInDays(end, start) + 1;
    const b: "hour" | "day" | "month" = span <= 1 ? "hour" : span > 60 ? "month" : "day";
    return { rangeStart: start, rangeEnd: end, bucket: b, spanDays: span };
  }, [isCustom, customRange, selectedPeriod]);

  const { data: stats, isError: statsError, isPending: statsLoading, refetch: refetchStats } = useDashboardStats(rangeStart, rangeEnd, bucket);

  const cur = stats?.current;
  const rate = (a?: number, t?: number) => (t && t > 0 ? ((a ?? 0) / t) * 100 : 0);

  const approvedCount = Number(cur?.approved_count ?? 0);
  const revenue = Number(cur?.revenue ?? 0);
  const uniqueCustomers = Number(cur?.unique_customers ?? 0);
  const conversion = rate(cur?.approved_count, cur?.total_count);
  const pixConversion = rate(cur?.pix_approved, cur?.pix_total);
  const cardConversion = rate(cur?.card_approved, cur?.card_total);
  const boletoConversion = rate(cur?.boleto_approved, cur?.boleto_total);
  const chargebackRate = rate(cur?.chargeback_count, cur?.total_count);
  const pixApprovedCount = Number(cur?.pix_approved ?? 0);
  const pixTotalCount = Number(cur?.pix_total ?? 0);
  const cardApprovedCount = Number(cur?.card_approved ?? 0);
  const cardTotalCount = Number(cur?.card_total ?? 0);
  const boletoApprovedCount = Number(cur?.boleto_approved ?? 0);
  const boletoTotalCount = Number(cur?.boleto_total ?? 0);


  // Using availableBalance from RPC now
  const balance = availableBalance;

  const chartData = useMemo(() => {
    const start = rangeStart;
    const end = rangeEnd;

    // Série agregada no servidor: chave = timestamp local (America/Sao_Paulo) truncado
    const byKey = new Map<string, number>();
    (stats?.series ?? []).forEach((point) => {
      const raw = String(point.bucket);
      byKey.set(raw.slice(0, 13), (byKey.get(raw.slice(0, 13)) || 0) + Number(point.revenue));
    });
    const pad = (n: number) => String(n).padStart(2, "0");
    const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // 1) HOURLY (single day)
    if (bucket === "hour") {
      return Array.from({ length: 24 }, (_, i): ChartPoint => {
        const point = new Date(start);
        point.setHours(i, 0, 0, 0);
        return {
          name: `${i}h`,
          vendas: byKey.get(`${dayKey(point)}T${pad(i)}`) || 0,
          fullLabel: `${i}:00`,
          timestamp: point.getTime(),
          granularity: "hour",
        };
      });
    }

    // 2) MONTHLY (span > 60 days)
    if (bucket === "month") {
      const result: ChartPoint[] = [];
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);
      while (cursor <= last) {
        result.push({
          name: cursor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          vendas: byKey.get(`${dayKey(cursor)}T00`) || 0,
          fullLabel: cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
          timestamp: cursor.getTime(),
          granularity: "month",
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return result;
    }

    // 3) DAILY (default)
    return Array.from({ length: spanDays }, (_, i): ChartPoint => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return {
        name: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        vendas: byKey.get(`${dayKey(d)}T00`) || 0,
        fullLabel: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }),
        timestamp: d.getTime(),
        granularity: "day",
      };
    });
  }, [stats, bucket, rangeStart, rangeEnd, spanDays]);


  const chartTicks = useMemo(() => {
    if (chartData.length <= 1) return chartData.map((p) => p.timestamp);

    const granularity = chartData[0]?.granularity;

    // Horário: todas as 24 horas do dia (0h até 23h), espaçamento uniforme.
    if (granularity === "hour") {
      return chartData.map((p) => p.timestamp);
    }

    const maxTicks = granularity === "month"
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

  // Saldo Pendente e período anterior vêm agregados do servidor (suporta alto volume)
  const pendingBalance = Number(stats?.global?.pending_balance ?? 0);
  const prevApprovedCount = Number(stats?.previous?.approved_count ?? 0);
  const prevRevenue = Number(stats?.previous?.revenue ?? 0);


  const pctChange = (curr: number, prev: number): number | undefined => {
    if (prev === 0) return curr === 0 ? 0 : undefined;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const ordersTrend = pctChange(approvedCount, prevApprovedCount);
  const revenueTrend = pctChange(revenue, prevRevenue);
  const compareLabel = (!isCustom && selectedPeriod.days === 0) ? "vs ontem" : "vs período anterior";

  const financialCards: Array<{ label: string; value: string | number; icon: typeof BarChart3; color: "neutral" | "success" | "warning" | "destructive"; sub: string; trend?: number }> = [
    { label: "Ticket Médio", value: privacy.hidden ? CENSORED : fmt(approvedCount > 0 ? revenue / approvedCount : 0), icon: BarChart3, color: "neutral", sub: "Média bruta por venda" },
    { label: "Pedidos Pagos", value: approvedCount, icon: Zap, color: "success", sub: "Vendas concluídas" },
    { label: "Saldo Pendente", value: privacy.hidden ? CENSORED : fmt(pendingBalance), icon: Clock3, color: "warning", sub: "Reserva + a liberar (D+N)" },
    { label: "Faturamento Total", value: privacy.hidden ? CENSORED : fmt(revenue), icon: TrendingUp, color: "success", sub: `Valor bruto · ${compareLabel}`, trend: revenueTrend },

  ];

  // ═══ Derived data for new layout (agregados do servidor) ═══
  const receivedToday = Number(stats?.global?.received_today ?? 0);
  const disputedAmount = Number(stats?.global?.disputed_amount ?? 0);


  const goalTarget = 100000;
  const goalPct = Math.min(100, (revenue / goalTarget) * 100);

  // Sparkline data from chart
  const productsMap = useMemo(() => {
    const map: Record<string, string> = {};
    (productsData || []).forEach((p: { id: string; name: string | null }) => { map[p.id] = p.name || p.id; });
    return map;
  }, [productsData]);

  const donutPix = [{ name: "on", value: pixConversion }, { name: "off", value: Math.max(0, 100 - pixConversion) }];
  const donutChb = [{ name: "on", value: chargebackRate }, { name: "off", value: Math.max(0, 100 - chargebackRate) }];



  return (
    <div className="seller-dashboard relative min-h-full w-full text-foreground animate-in fade-in duration-500">
      <Seo title="Dashboard | Venxpay" description="Painel operacional Venxpay — saldos, ranking, aprovação e liquidações em tempo real." path="/dashboard" noindex />

      <div className="relative z-10 px-1 sm:px-2 md:px-3 pt-0 pb-24 max-w-[1280px] mx-auto space-y-6">

        {(txError || statsError || productsError) && (
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-[12px] text-destructive">
            <span className="font-semibold">Falha ao carregar métricas</span>
            <button onClick={() => { refetchTx(); refetchStats(); }} className="rounded-lg border border-destructive/50 px-3 py-1 text-[11px] font-bold hover:bg-destructive/10">Tentar novamente</button>
          </div>
        )}

        <SellerOnboarding />

        {/* ═══════════ GREETING ═══════════ */}
        <header className="-mt-3 min-w-0 md:-mt-4">
          <h1 className="font-display font-bold text-[22px] md:text-[28px] leading-[1.15] truncate">
            Seja bem-vindo, {nickname}
            <button
              onClick={privacy.toggle}
              aria-label={privacy.hidden ? "Mostrar valores" : "Ocultar valores"}
              className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-[8px] align-middle text-muted-foreground/45 transition-colors hover:text-primary"
            >
              {privacy.hidden ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
          </h1>
          <p className="text-muted-foreground text-[13px] font-medium mt-1.5">Que essa jornada seja leve, produtiva e cheia de conquistas!</p>
        </header>

        {/* ═══════════ HERO — BRAND BANNER (com dial de período) ═══════════ */}
        <PromoBanner
          periodControl={
            <PeriodDial
              open={datePickerOpen}
              setOpen={setDatePickerOpen}
              label={isCustom ? "Período" : selectedPeriod.label}
              goalPct={goalPct}
              revenueLabel={privacy.hidden ? CENSORED : fmt(revenue)}
              value={periodValue}
              onChange={applyPeriod}
            />
          }
        />




        {/* ═══════════ KPI CARDS ═══════════ */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Saldo disponível", value: fmt(Math.max(0, balance)), sub: "Pronto para saque", tone: "success" as const, icon: Wallet },
            { label: "Recebido hoje", value: fmt(receivedToday), sub: "Movimento confirmado", tone: "primary" as const, icon: RefreshCw },
            { label: "Reembolsos", value: fmt(disputedAmount), sub: "MEDs e Reembolsos", tone: "danger" as const, icon: ShieldCheck },
            { label: "Volume total", value: fmt(revenue), sub: "Vendas acumuladas", tone: "success" as const, icon: TrendingUp },
          ].map((k) => {
            const isDanger = k.tone === "danger";
            const Icon = k.icon;
            return (
              <div
                key={k.label}
                className="group relative min-h-[160px] overflow-hidden rounded-[22px] border border-border bg-card px-5 py-5 transition-colors duration-300 hover:border-primary/30 hover:bg-card-elevated"
              >
                <Icon
                  aria-hidden
                  strokeWidth={1.25}
                  className={cn(
                    "pointer-events-none absolute -bottom-4 -right-3 h-24 w-24 rotate-[-8deg] transition-colors duration-200",
                    isDanger ? "text-destructive/[0.07] group-hover:text-destructive/[0.11]" : "text-primary/[0.07] group-hover:text-primary/[0.11]",
                  )}
                />
                <div className={cn(
                  "absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-[10px] border bg-background/65 transition-colors duration-200",
                  isDanger ? "border-destructive/20 text-destructive group-hover:border-destructive/35" : "border-border text-primary group-hover:border-primary/30",
                )}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </div>
                <div className="relative z-10 flex h-full min-w-0 flex-col pr-11">
                  <p className={cn("text-[13px] font-medium", isDanger ? "text-destructive/90" : "text-muted-foreground")}>{k.label}</p>
                  {statsLoading ? (
                    <div className="mt-5 h-[25px] w-32 animate-pulse rounded-[6px] bg-muted/50 sm:h-[28px]" aria-label="Carregando" />
                  ) : (
                  <p className={cn("mt-5 whitespace-nowrap font-display text-[25px] font-bold leading-none tracking-[-0.02em] tabular-nums sm:text-[28px]", isDanger ? "text-destructive" : "text-foreground")}>
                  {privacy.hidden ? CENSORED : k.value}
                  </p>
                  )}

                  <p className="mt-auto truncate pt-4 text-[11px] font-medium text-muted-foreground/65">{k.sub}</p>
                </div>
              </div>
            );
          })}
        </section>

        {/* ═══════════ QUICK ACTIONS ═══════════ */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Gerar PIX", sub: "QR Code para receber", icon: QrCode, onClick: () => { if (!requireApprovedAccount()) setPixDialogOpen(true); } },
            { label: "Solicitar Saque", sub: "Transferir via PIX", icon: ArrowDownRight, onClick: () => { if (!requireApprovedAccount()) navigate("/financeiro/saques"); } },
            { label: "Transações", sub: "Ver histórico", icon: Receipt, onClick: () => { if (!requireApprovedAccount()) navigate("/vendas"); } },
            { label: "Credenciais API", sub: "Gerencie suas credenciais", icon: KeyRound, onClick: () => { if (!requireApprovedAccount()) navigate("/integracoes/credenciais"); } },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <Button
                type="button"
                variant="ghost"
                key={a.label}
                onClick={a.onClick}
                className="group relative h-auto min-h-[82px] justify-start gap-3 overflow-hidden rounded-[18px] border border-border bg-card px-4 py-3 text-left text-foreground transition-colors duration-300 hover:border-primary/30 hover:bg-accent/55"
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-primary/20 bg-primary/8 text-primary transition-colors duration-200 group-hover:border-primary/35 group-hover:bg-primary/12">
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
                </span>
                <div className="relative min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight text-foreground 2xl:text-[14px]">{a.label}</p>
                  <p className="truncate text-[11px] font-normal text-muted-foreground">{a.sub}</p>
                </div>
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground/60 transition-colors duration-200 group-hover:text-primary">
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Button>
            );
          })}
        </section>



        {/* ═══════════ CHART + SIDE PANEL ═══════════ */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Faturamento — Clean line chart (Cakto-style) */}
          <div className="xl:col-span-2 overflow-hidden rounded-[24px] border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/40 px-6 py-5 md:px-8">
              <div className="min-w-0">
                <h4 className="font-display font-bold text-xl tracking-[-0.02em] text-foreground">Faturamento</h4>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Comparativo de entradas e saídas</p>
              </div>
              <span className="shrink-0 rounded-[10px] border border-border/60 bg-background px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {isCustom ? "Período personalizado" : selectedPeriod.label}
              </span>
            </div>


            <div className="h-[300px] w-full pr-4 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 14, right: 8, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                      <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border)/0.28)" />
                  <XAxis dataKey="timestamp" type="number" scale="time"
                    domain={[chartData[0]?.timestamp ?? 0, chartData[chartData.length - 1]?.timestamp ?? 0]}
                    ticks={chartTicks} tickFormatter={chartTickFormatter}
                    axisLine={false} tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground)/0.7)",
                      fontSize: chartData[0]?.granularity === "hour" ? 9 : 11,
                      fontWeight: 500,
                    }}
                    dy={10} interval={0}
                    minTickGap={chartData[0]?.granularity === "hour" ? -1 : 5}
                    padding={{ left: 6, right: 6 }}
                  />
                  <YAxis width={52} axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground)/0.55)", fontSize: 10, fontWeight: 500 }}
                    tickFormatter={(v) => Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : `${v}`}
                  />
                  <Tooltip cursor={{ stroke: "hsl(var(--primary)/0.45)", strokeWidth: 1, strokeDasharray: "4 4" }} wrapperStyle={{ outline: "none" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const p = payload[0];
                        return (
                          <div className="rounded-[10px] border border-border bg-card px-3.5 py-2.5">
                            <p className="text-[10px] font-medium text-muted-foreground/70 mb-1">{p.payload.fullLabel}</p>
                            <p className="text-foreground font-display font-bold text-[14px] tabular-nums">{fmt(p.value as number)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="vendas" stroke="url(#revStroke)" strokeWidth={2.5} fill="url(#revGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2.5 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right side: donuts + links */}
          <div className="space-y-4">
            {/* Donuts card */}
             <div className="rounded-[24px] border border-border bg-card p-7">
              <div className="mb-6">
                <h4 className="font-display font-bold text-xl tracking-[-0.02em]">Índices</h4>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Conversão por método de pagamento</p>
              </div>
              <div className="space-y-5">

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
             <button type="button" onClick={() => { if (!requireApprovedAccount()) navigate("/vendas/link-pagamento"); }} className="group block w-full rounded-[24px] border border-border bg-card p-7 text-left transition-colors duration-300 hover:border-primary/35 hover:bg-card-elevated">
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

        {/* ═══════════ ÚLTIMAS TRANSAÇÕES — clean table ═══════════ */}
        <section className="overflow-hidden rounded-[24px] border border-border bg-card">
          <div className="flex items-center justify-between gap-3 px-5 md:px-6 pt-5 pb-4">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-[15px] tracking-[-0.01em] text-foreground">Últimas transações</h3>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                {activity.length} {activity.length === 1 ? "transação" : "transações"} · {conversion.toFixed(0)}% aprovadas
              </p>
            </div>
            <button
              type="button"
              onClick={() => { if (!requireApprovedAccount()) navigate("/vendas"); }}
              className="text-[12px] font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              Ver todas
            </button>
          </div>

          {activity.length > 0 && (
            <div className="hidden md:grid grid-cols-[1fr_100px_120px_110px_20px] gap-4 px-5 md:px-6 py-2 border-y border-border/40 bg-muted/20 text-[11px] font-medium text-muted-foreground/60">
              <span>Cliente</span>
              <span>Método</span>
              <span className="text-right">Valor</span>
              <span>Status</span>
              <span />
            </div>
          )}

          <ul className="divide-y divide-border/30">
            {activity.length === 0 && (
              <li className="px-6 py-14 text-center">
                <p className="text-[13px] text-muted-foreground">Nenhuma transação ainda.</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Suas vendas aparecerão aqui em tempo real.</p>
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
