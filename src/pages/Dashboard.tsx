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
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Trophy, Lock, RefreshCw, QrCode, Receipt, Link2, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  pedidos: number;
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

  // Links de pagamento — alimenta o card lateral do dashboard com dados reais.
  const { data: payLinks = [] } = useQuery({
    queryKey: ["dashboard-payment-links", user?.id],
    queryFn: async () => {
      if (!user) return [] as Tables<"payment_links">[];
      const { data, error } = await supabase
        .from("payment_links")
        .select("id,title,total_revenue,current_uses,is_active")
        .eq("user_id", user.id)
        .order("total_revenue", { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as Tables<"payment_links">[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
  const payLinksRevenue = useMemo(
    () => payLinks.reduce((s, l) => s + Number(l.total_revenue || 0), 0),
    [payLinks],
  );
  const payLinksActive = payLinks.filter((l) => l.is_active).length;

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[0]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const privacy = usePrivacyMode();
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);
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
    const countByKey = new Map<string, number>();
    (stats?.series ?? []).forEach((point) => {
      const raw = String(point.bucket);
      byKey.set(raw.slice(0, 13), (byKey.get(raw.slice(0, 13)) || 0) + Number(point.revenue));
      countByKey.set(raw.slice(0, 13), (countByKey.get(raw.slice(0, 13)) || 0) + Number(point.count));
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
          pedidos: countByKey.get(`${dayKey(point)}T${pad(i)}`) || 0,
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
          pedidos: countByKey.get(`${dayKey(cursor)}T00`) || 0,
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
        pedidos: countByKey.get(`${dayKey(d)}T00`) || 0,
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
  const statusLabel = (s: string) => isApprovedTransaction(s) ? 'Aprovado' : s === 'pending' || s === 'processing' ? 'Pendente' : s === 'expired' ? 'Expirada' : s === 'refunded' || s === 'partially_refunded' ? 'Reembolso' : s === 'chargeback' ? 'Chargeback' : s === 'med_lost' ? 'MED perdido' : s === 'med' || s === 'mediation' || s === 'dispute' || s === 'disputed' ? 'MED PIX · em análise' : s === 'cancelled' || s === 'canceled' ? 'Cancelada' : s === 'failed' || s === 'refused' || s === 'rejected' || s === 'error' ? 'Erro' : s;
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
  const chartAverage = approvedCount > 0 ? revenue / approvedCount : 0;



  return (
    <div className="seller-dashboard relative min-h-full w-full text-foreground animate-in fade-in duration-500">
      <Seo title="Dashboard | Vemprapay" description="Painel operacional Vemprapay — saldos, ranking, aprovação e liquidações em tempo real." path="/dashboard" noindex />

      <div className="relative z-10 px-1 sm:px-2 md:px-3 pt-0 pb-24 max-w-[1280px] mx-auto space-y-6">

        {(txError || statsError || productsError) && (
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-[12px] text-destructive">
            <span className="font-semibold">Falha ao carregar métricas</span>
            <button onClick={() => { refetchTx(); refetchStats(); }} className="rounded-lg border border-destructive/50 px-3 py-1 text-[11px] font-bold hover:bg-destructive/10">Tentar novamente</button>
          </div>
        )}

        <SellerOnboarding />

        {/* ═══════════ CONTA — cartão de saldo estilo banco ═══════════ */}
        <section className="vp-hero px-5 py-6 sm:px-7 sm:py-7" aria-label="Resumo da conta">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-medium opacity-80">{greeting}, {nickname}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-[13px] font-semibold opacity-90">Saldo disponível</span>
                <button
                  type="button"
                  onClick={privacy.toggle}
                  aria-label={privacy.hidden ? "Mostrar valores" : "Ocultar valores"}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
                >
                  {privacy.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {statsLoading ? (
                <div className="mt-2 h-10 w-48 animate-pulse rounded-lg bg-primary-foreground/15" aria-label="Carregando" />
              ) : (
                <p className="mt-1 font-display text-[34px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums sm:text-[42px]">
                  {privacy.hidden ? "R$ ••••••" : fmt(Math.max(0, balance))}
                </p>
              )}
              <p className="mt-1 text-[12px] font-medium opacity-75 tabular-nums">
                A liberar: {privacy.hidden ? CENSORED : fmt(pendingBalance)} · Recebido hoje: {privacy.hidden ? CENSORED : fmt(receivedToday)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PeriodDial
                open={datePickerOpen}
                setOpen={setDatePickerOpen}
                label={isCustom ? "Período" : selectedPeriod.label}
                goalPct={goalPct}
                revenueLabel={privacy.hidden ? CENSORED : fmt(revenue)}
                value={periodValue}
                onChange={applyPeriod}
              />
              <button
                type="button"
                onClick={() => { if (!requireApprovedAccount()) navigate("/financeiro/saques"); }}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary-foreground px-5 text-[14px] font-bold text-primary transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <ArrowDownRight className="h-4 w-4" /> Sacar
              </button>
            </div>
          </div>
        </section>

        {/* ═══════════ ATALHOS ═══════════ */}
        <nav aria-label="Atalhos" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:justify-between scrollbar-none">
          {[
            { label: "Pix", icon: QrCode, onClick: () => toast.error("Cobranças PIX temporariamente indisponíveis.") },
            { label: "Sacar", icon: ArrowDownRight, onClick: () => { if (!requireApprovedAccount()) navigate("/financeiro/saques"); } },
            { label: "Vendas", icon: Receipt, onClick: () => { if (!requireApprovedAccount()) navigate("/vendas"); } },
            { label: "Novo produto", icon: Sparkles, onClick: () => { if (!requireApprovedAccount()) navigate("/vendas/produtos"); } },
            { label: "Link de pagamento", icon: Link2, onClick: () => { if (!requireApprovedAccount()) navigate("/vendas/link-pagamento"); } },
            { label: "Credenciais API", icon: KeyRound, onClick: () => { if (!requireApprovedAccount()) navigate("/integracoes/credenciais"); } },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} type="button" onClick={a.onClick} className="vp-shortcut shrink-0 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="vp-shortcut-icon"><Icon className="h-5 w-5" strokeWidth={1.9} /></span>
                <span className="max-w-[84px] text-center text-[12px] font-semibold leading-tight text-foreground">{a.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ═══════════ RESUMO DO PERÍODO ═══════════ */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Faturamento", value: fmt(revenue), sub: revenueTrend === undefined ? compareLabel : `${revenueTrend >= 0 ? "+" : ""}${revenueTrend}% ${compareLabel}`, icon: TrendingUp, danger: false },
            { label: "Vendas pagas", value: String(approvedCount), sub: `${conversion.toFixed(0)}% de aprovação`, icon: Zap, danger: false },
            { label: "Ticket médio", value: fmt(approvedCount > 0 ? revenue / approvedCount : 0), sub: "Por venda aprovada", icon: BarChart3, danger: false },
            { label: "Reembolsos e MED", value: fmt(disputedAmount), sub: "Em análise ou devolvidos", icon: ShieldCheck, danger: true },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="vp-card p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-full", k.danger ? "bg-destructive/10 text-destructive" : "bg-accent text-primary")}>
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <p className="truncate text-[12.5px] font-semibold text-muted-foreground">{k.label}</p>
                </div>
                {statsLoading ? (
                  <div className="mt-4 h-7 w-24 animate-pulse rounded-md bg-muted" aria-label="Carregando" />
                ) : (
                  <p className={cn("mt-4 truncate font-display text-[20px] font-extrabold leading-none tracking-[-0.02em] tabular-nums sm:text-[24px]", k.danger && disputedAmount > 0 ? "text-destructive" : "text-foreground")}>
                    {privacy.hidden && k.label !== "Vendas pagas" ? CENSORED : k.value}
                  </p>
                )}
                <p className="mt-2 truncate text-[11.5px] font-medium text-muted-foreground">{k.sub}</p>
              </div>
            );
          })}
        </section>



        {/* ═══════════ CHART + SIDE PANEL ═══════════ */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Faturamento — clean: título, período e gráfico */}
          <div className="xl:col-span-2 overflow-hidden vp-card">
            <div className="flex items-start justify-between gap-4 px-6 pt-6 md:px-7">
              <div className="min-w-0">
                <h4 className="font-display text-xl font-bold text-foreground">Faturamento</h4>
                <p className="mt-1 text-[11px] text-muted-foreground">Vendas aprovadas no período</p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {isCustom ? "Personalizado" : selectedPeriod.label}
              </span>
            </div>

            <div className="h-[320px] w-full px-2 pb-4 pt-4 md:px-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.26} />
                      <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity={0.06} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="hsl(var(--border)/0.5)" />
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
                  <YAxis width={44} axisLine={false} tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground)/0.55)", fontSize: 10, fontWeight: 500 }}
                    tickFormatter={(v) => Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : `${v}`}
                  />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--primary)/0.5)", strokeWidth: 1 }}
                    wrapperStyle={{ outline: "none", zIndex: 20 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      return (
                        <div className="rounded-[12px] border border-border bg-popover px-3.5 py-2.5">
                          <p className="text-[10px] font-medium text-muted-foreground">{p.payload.fullLabel}</p>
                          <p className="mt-0.5 font-display text-[15px] font-bold tabular-nums text-foreground">
                            {privacy.hidden ? CENSORED : fmt(Number(p.payload.vendas))}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 3 }}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>


          {/* Right side: donuts + links */}
          <div className="space-y-4">
            {/* Índices — formato original */}
             <div className="vp-card p-7">
              <div className="mb-6">
                <h4 className="font-display font-bold text-xl text-foreground">Índices</h4>
                <p className="mt-1 text-[11px] text-muted-foreground">Conversão por método de pagamento</p>
              </div>
              <div className="space-y-5">
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
                    <div className="absolute inset-0 flex items-center justify-center font-display text-[12px] font-black tabular-nums text-foreground">{pixConversion.toFixed(0)}%</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-foreground">Pix</p>
                    <p className="text-[11px] text-muted-foreground">Conversão</p>
                  </div>
                </div>
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
                    <div className="absolute inset-0 flex items-center justify-center font-display text-[12px] font-black tabular-nums text-foreground">{chargebackRate.toFixed(1)}%</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-foreground">Taxa de estorno</p>
                    <p className="text-[11px] text-muted-foreground">Saúde da conta{" "}
                      <span className={cn("ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold", chargebackRate < 1 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")}>
                        {chargebackRate < 1 ? "Excelente" : "Atenção"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment links */}
             <button type="button" onClick={() => { if (!requireApprovedAccount()) navigate("/vendas/link-pagamento"); }} className="group block w-full vp-card p-7 text-left transition-colors duration-300 hover:border-primary/35 hover:bg-card-elevated">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display font-black text-base tracking-[-0.01em] flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> Links de pagamentos</h3>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">Relação entre faturamento e vendas por meio do link de pagamentos</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              {payLinks.length === 0 ? (
                <p className="mt-3 text-[12px] text-muted-foreground/60 italic">Nenhum link de pagamento criado.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {payLinks.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="min-w-0 truncate text-foreground/85">{l.title}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground/70">
                        {Number(l.current_uses || 0)} vendas ·{" "}
                        <span className="font-semibold text-foreground">{fmt(Number(l.total_revenue || 0))}</span>
                      </span>
                    </div>
                  ))}
                  <p className="border-t border-border/40 pt-2 text-[11px] tabular-nums text-muted-foreground/60">
                    {payLinksActive} ativo{payLinksActive === 1 ? "" : "s"} · {fmt(payLinksRevenue)} gerados no total
                  </p>
                </div>
              )}
            </button>
          </div>
        </section>

        {/* ═══════════ ÚLTIMAS TRANSAÇÕES — clean table ═══════════ */}
        <section className="overflow-hidden vp-card">
          <div className="flex items-center justify-between gap-3 px-5 md:px-6 pt-5 pb-4">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-[15px] tracking-[-0.01em] text-foreground">Últimas movimentações</h3>
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
              const bad = ["chargeback", "med", "med_lost", "dispute", "disputed", "refunded", "failed"].includes(item.status);
              const dot = isApproved ? "bg-success" : item.status === "pending" ? "bg-warning animate-pulse" : bad ? "bg-destructive" : "bg-muted-foreground/50";
              const statusColor = isApproved ? "text-success bg-success/10 border-success/25" : item.status === "pending" ? "text-warning bg-warning/10 border-warning/25" : bad ? "text-destructive bg-destructive/10 border-destructive/25" : "text-muted-foreground bg-muted border-border";
              const initial = custName.trim().charAt(0).toUpperCase() || "C";
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setDetailTx(item.tx)}
                    className="group w-full grid md:grid-cols-[1fr_100px_120px_130px_20px] grid-cols-[1fr_auto] gap-4 items-center px-5 md:px-6 py-3.5 text-left transition-all hover:bg-primary/[0.04] active:scale-[0.995]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-primary font-display text-[13px] font-bold text-foreground transition-colors group-hover:border-primary/50 group-hover:bg-primary group-hover:text-primary-foreground">{initial}</span>
                      <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{custName}</p>
                      <p className="text-[11px] text-muted-foreground/70 tabular-nums mt-0.5">
                        {new Date(item.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      </div>
                    </div>
                    <span className="hidden md:inline-flex w-fit rounded-full border border-border bg-background/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{methodLabel}</span>
                    <span className="hidden md:block text-right font-display font-semibold text-[13px] tabular-nums text-foreground">
                      {privacy.hidden ? CENSORED : fmt(item.amount)}
                    </span>
                    <span className={cn("hidden md:inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", statusColor)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                      {statusLabel(item.status)}
                    </span>
                    <div className="md:hidden flex flex-col items-end gap-1">
                      <span className="font-display font-semibold text-[13px] tabular-nums text-foreground">
                        {privacy.hidden ? CENSORED : fmt(item.amount)}
                      </span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusColor)}>
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

      </div>
    </div>
  );
}
