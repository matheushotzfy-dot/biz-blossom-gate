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
import { cn, formatCurrency } from "@/lib/utils";

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
      try { localStorage.setItem("privacy_mode", String(next)); } catch {}
      return next;
    });
  }, []);
  return { hidden, toggle };
}

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    start.setDate(start.getDate() - selectedPeriod.days);
    start.setHours(0, 0, 0, 0);

    return transactions.filter((t) => new Date(t.created_at) >= start);
  }, [transactions, selectedPeriod, isCustom, customRange]);

  const { approved, revenue, conversion, uniqueCustomers, pixConversion, cardConversion, boletoConversion, chargebackRate, pixApprovedCount, pixTotalCount, cardApprovedCount, cardTotalCount, boletoApprovedCount, boletoTotalCount } = useMemo(() => {
    const _approved = filteredTx.filter((t) => t.status === "completed");
    const _revenue = _approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const _conversion = filteredTx.length > 0 ? (_approved.length / filteredTx.length) * 100 : 0;
    
    const pixTx = filteredTx.filter(t => t.payment_method === "pix");
    const pixApproved = pixTx.filter(t => t.status === "completed");
    const _pixConversion = pixTx.length > 0 ? (pixApproved.length / pixTx.length) * 100 : 0;

    const cardTx = filteredTx.filter(t => t.payment_method === "credit_card" || t.payment_method === "card");
    const cardApproved = cardTx.filter(t => t.status === "completed");
    const _cardConversion = cardTx.length > 0 ? (cardApproved.length / cardTx.length) * 100 : 0;

    const boletoTx = filteredTx.filter(t => t.payment_method === "boleto");
    const boletoApproved = boletoTx.filter(t => t.status === "completed");
    const _boletoConversion = boletoTx.length > 0 ? (boletoApproved.length / boletoTx.length) * 100 : 0;

    const _chargebackRate = filteredTx.length > 0 ? (filteredTx.filter(t => t.status === "chargeback").length / filteredTx.length) * 100 : 0;
    const _uniqueCustomers = new Set(filteredTx.map(t => t.customer_email).filter(Boolean)).size;

    return {
      approved: _approved,
      revenue: _revenue,
      conversion: _conversion,
      uniqueCustomers: _uniqueCustomers,
      pixConversion: _pixConversion,
      cardConversion: _cardConversion,
      boletoConversion: _boletoConversion,
      chargebackRate: _chargebackRate,
      pixApprovedCount: pixApproved.length, pixTotalCount: pixTx.length,
      cardApprovedCount: cardApproved.length, cardTotalCount: cardTx.length,
      boletoApprovedCount: boletoApproved.length, boletoTotalCount: boletoTx.length,
    };
  }, [filteredTx]);

  // Using availableBalance from RPC now
  const balance = availableBalance;

  const chartData = useMemo(() => {
    const isSingleDay = (isCustom && customRange?.from && (!customRange.to || differenceInDays(customRange.to, customRange.from) === 0)) || (!isCustom && selectedPeriod.days === 0);
    
    if (isSingleDay) {
      // Logic for hourly sales
      const salesByHour = new Map<number, number>();
      const targetDate = isCustom ? new Date(customRange!.from!) : brasiliaToday();
      const targetDateStr = targetDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

      filteredTx.forEach(t => {
        if (t.status !== "completed") return;
        const date = new Date(t.created_at);
        const hour = date.getHours();
        salesByHour.set(hour, (salesByHour.get(hour) || 0) + Number(t.net_amount));
      });

      return Array.from({ length: 24 }, (_, i) => ({
        name: `${i}h`,
        vendas: salesByHour.get(i) || 0,
        fullLabel: `${i}:00`,
      }));
    }

    const days = Math.max(selectedPeriod.days, 1);
    const startDate = new Date(brasiliaToday());
    startDate.setDate(startDate.getDate() - (days - 1));
    const revenueByDate = new Map<string, number>();
    
    // Use transactions for overall history or filteredTx for specific range
    const txSource = isCustom ? filteredTx : transactions;
    
    for (const t of txSource) {
      if (t.status !== "completed") continue;
      const dateKey = toBrasiliaDate(t.created_at);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(t.net_amount));
    }

    return Array.from({ length: days }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return { 
        name: label, 
        vendas: revenueByDate.get(dateStr) || 0,
        fullLabel: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
      };
    });
  }, [transactions, filteredTx, selectedPeriod.days, isCustom, customRange]);

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
  const statusLabel = (s: string) => s === 'completed' ? 'Aprovado' : s === 'pending' ? 'Pendente' : s === 'refunded' ? 'Reembolso' : 'Chargeback';
  const statusBg = (s: string) => s === 'completed' ? 'bg-success/10' : s === 'pending' ? 'bg-warning/10' : 'bg-destructive/10';
  const statusColor = (s: string) => s === 'completed' ? 'text-success' : s === 'pending' ? 'text-warning' : 'text-destructive';

  const pendingBalance = useMemo(() => {
    return transactions
      .filter(t => t.status === "completed" && t.retained_until && new Date(t.retained_until) > new Date())
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
      start.setDate(start.getDate() - selectedPeriod.days);
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
    const prevApp = prevTx.filter(t => t.status === "completed");
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
    <div className="p-4 md:p-6 pt-2 md:pt-4 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 overflow-x-hidden">
      <Seo title="Dashboard | Hotzfy" description="Painel de controle com vendas, saldo, transações e KPIs em tempo real." path="/dashboard" noindex />
      {(txError || productsError) && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12px] text-destructive">
          <span className="font-medium">Falha ao carregar parte dos dados. Algumas métricas podem estar desatualizadas.</span>
          <button onClick={() => refetchTx()} className="rounded-md border border-destructive/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider hover:bg-destructive/10 transition-colors">Tentar novamente</button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
             <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
             <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">{greeting}, {nickname}</h1>
          </div>
        </div>

        {/* Period selector — institutional, dense, Bloomberg-style */}
        <div className="inline-flex items-stretch h-11 rounded-xl border border-border bg-card overflow-hidden">


          {/* Segments */}
          <div className="flex items-stretch divide-x divide-border">
            {PERIOD_PRESETS.map((p) => {
              const isActive = !isCustom && selectedPeriod.label === p.label;
              const shortLabel = p.label === "Hoje" ? "Hoje" : `${p.days}D`;
              return (
                <button
                  key={p.label}
                  onClick={() => { setSelectedPeriod(p); setIsCustom(false); }}
                  className={cn(
                    "seller-segment relative px-4 flex items-center justify-center text-[11px] font-display font-black uppercase tracking-[0.14em] tabular-nums min-w-[58px]",
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
                "seller-segment relative border-l border-border px-4 flex items-center gap-2 text-[11px] font-display font-black uppercase tracking-[0.14em]",
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
              className="p-0 border border-border rounded-xl overflow-hidden bg-card w-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <CalendarDays className="h-3 w-3" strokeWidth={2.25} />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[9px] font-display font-black uppercase tracking-[0.18em] text-muted-foreground/70">
                      Período personalizado
                    </span>
                    <span className="text-[11px] font-display font-bold text-foreground tabular-nums">
                      {customRange?.from
                        ? format(customRange.from, "dd MMM", { locale: ptBR }) +
                          (customRange.to
                            ? " — " + format(customRange.to, "dd MMM yyyy", { locale: ptBR })
                            : " — selecione fim")
                        : "Selecione o intervalo"}
                    </span>
                  </div>
                </div>
                {customRange?.from && customRange?.to && (
                  <span className="text-[10px] font-display font-black uppercase tracking-[0.16em] text-primary tabular-nums px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                    {differenceInDays(customRange.to, customRange.from) + 1}d
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row">
                {/* Quick presets rail */}
                <div className="sm:w-[148px] sm:border-r border-b sm:border-b-0 border-border bg-secondary/15 p-2 flex sm:flex-col gap-0.5 overflow-x-auto sm:overflow-visible">
                  {([
                    { label: "Hoje", days: 0 },
                    { label: "Ontem", days: 1, offset: 1 },
                    { label: "Últimos 7 dias", days: 6 },
                    { label: "Últimos 15 dias", days: 14 },
                    { label: "Últimos 30 dias", days: 29 },
                    { label: "Este mês", monthMode: "current" },
                    { label: "Mês passado", monthMode: "previous" },
                  ] as { label: string; days?: number; offset?: number; monthMode?: "current" | "previous" }[]).map((preset) => {
                    const apply = () => {
                      const today = new Date();
                      let from: Date, to: Date;
                      if (preset.monthMode === "current") {
                        from = new Date(today.getFullYear(), today.getMonth(), 1);
                        to = today;
                      } else if (preset.monthMode === "previous") {
                        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                        to = new Date(today.getFullYear(), today.getMonth(), 0);
                      } else if (preset.offset) {
                        from = new Date(today);
                        from.setDate(today.getDate() - preset.offset);
                        to = new Date(from);
                      } else {
                        from = new Date(today);
                        from.setDate(today.getDate() - (preset.days || 0));
                        to = new Date(today);
                      }
                      setCustomRange({ from, to });
                      setIsCustom(true);
                    };
                    return (
                      <button
                        key={preset.label}
                        onClick={apply}
                        className="seller-menu-item text-left px-2.5 py-2 rounded-md text-[11px] font-display font-bold text-muted-foreground/80 hover:text-foreground hover:bg-secondary/60 whitespace-nowrap"
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Calendar */}
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(r) => { setCustomRange(r); setIsCustom(true); }}
                  locale={ptBR}
                  numberOfMonths={1}
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border bg-secondary/20">
                <button
                  onClick={() => { setCustomRange(undefined); setIsCustom(false); setSelectedPeriod(PERIOD_PRESETS[0]); }}
                  className="seller-text-action text-[10px] font-display font-black uppercase tracking-[0.14em] text-muted-foreground/60 hover:text-foreground"
                >
                  Limpar
                </button>
                <button
                  onClick={() => setDatePickerOpen(false)}
                  disabled={!customRange?.from || !customRange?.to}
                  className="seller-action px-3 py-1.5 rounded-md text-[10px] font-display font-black uppercase tracking-[0.14em] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Aplicar
                </button>
              </div>
            </PopoverContent>

          </Popover>
        </div>

      </div>



      {/* Hero Financial Row */}
      <div className="grid lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="seller-hover-card lg:col-span-2 relative overflow-hidden group border-primary/20 bg-gradient-to-br from-primary/[0.04] via-card to-card shadow-xl shadow-primary/5 rounded-3xl min-h-[220px]">
          {/* Main card inner glow */}
          <div className="absolute inset-px rounded-[1.45rem] bg-gradient-to-br from-primary/[0.01] to-transparent pointer-events-none" />
          
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] transition-all duration-700 group-hover:opacity-[0.08] group-hover:scale-110 hidden sm:block">
            <Wallet className="h-40 w-40 -rotate-12" />
          </div>

          <CardHeader className="pb-1 pt-5 px-4 sm:px-6 md:px-8">
             <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/10 transition-all">
                <BarChart3 className="h-3 w-3" />
                Faturamento do Dia
             </div>
          </CardHeader>
          
          <CardContent className="pt-2 pb-5 px-4 sm:px-6 md:px-8">
            <div className="flex flex-col gap-4 sm:gap-5">
              <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-none break-all">
                  {privacy.hidden ? CENSORED : fmt(revenue)}
                </p>
                <span className="text-muted-foreground/30 font-bold text-sm sm:text-base">BRL</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 p-3 sm:p-4 rounded-2xl bg-background/40 border border-border/40 backdrop-blur-sm w-full sm:w-fit group-hover:border-primary/20 transition-all">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-3 w-3 text-muted-foreground/60" />
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Saldo Disponível</p>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-success tracking-tight leading-none break-all">{privacy.hidden ? CENSORED : fmt(balance)}</p>
                </div>
                <div className="hidden sm:block h-8 w-px bg-border/40" />
                <div className="space-y-1 min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Conversão</p>
                  <p className="text-base sm:text-lg font-bold text-primary tracking-tight leading-none">{conversion.toFixed(1)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-1">
                <Link
                  to="/financeiro/saques"
                  className="seller-action bg-primary text-primary-foreground h-11 px-4 rounded-xl font-bold text-[12px] flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <ArrowDownRight className="h-4 w-4 shrink-0" />
                  <span>Solicitar Saque</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setPixDialogOpen(true)}
                  className="seller-action bg-background/60 text-foreground h-11 px-4 rounded-xl font-bold text-[12px] flex items-center justify-center gap-2 hover:bg-accent whitespace-nowrap"
                >
                  <Zap className="h-4 w-4 text-success shrink-0" />
                  <span>Gerar Pix</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>


        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
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


      {/* Main Operations Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="seller-hover-card lg:col-span-2 border-border/40 overflow-hidden shadow-lg shadow-black/5 rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 px-6 py-5 md:px-8">
            <div>
              <CardTitle className="text-lg font-bold">Fluxo de Vendas</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider opacity-50">Desempenho financeiro</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
               <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="opacity-60">Aprovadas</span>
               </div>
               <div className="text-primary font-bold">{fmt(revenue)}</div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[300px] md:h-[350px] w-full pt-6 pb-4 pr-6 pl-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.3)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground)/0.5)', fontSize: 10, fontWeight: 700}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground)/0.5)', fontSize: 10, fontWeight: 700}} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip 
                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-card/95 backdrop-blur-md border border-border/50 p-4 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                              {payload[0].payload.fullLabel || payload[0].payload.name}
                            </p>
                            <p className="text-xl font-bold text-primary tracking-tight">
                              {fmt(payload[0].value as number)}
                            </p>
                            <div className="mt-2 h-1 w-full bg-primary/10 rounded-full overflow-hidden">
                              <div className="h-full bg-primary animate-out slide-in-from-left-full duration-1000" style={{ width: '100%' }} />
                            </div>
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
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorVendas)"
                    activeDot={{ 
                      r: 6, 
                      fill: "hsl(var(--primary))", 
                      stroke: "hsl(var(--background))", 
                      strokeWidth: 3,
                      className: "drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="seller-hover-card border-border/40 overflow-hidden bg-gradient-to-b from-card to-background/20 shadow-xl shadow-black/5 rounded-3xl">
          <CardHeader className="border-b border-border/40 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Conversão Geral</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider opacity-50">Desempenho por método</CardDescription>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl border border-primary/20">
                <span className="text-xl font-bold">{conversion.toFixed(1)}%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 py-8 space-y-8">
            <div className="space-y-6">
              {/* PIX */}
              <div className="group space-y-3">
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
              <div className="group space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <CreditCard className="h-4.5 w-4.5" />
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
              <div className="group space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                      <Barcode className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">Boleto</p>
                      <p className="text-[10px] font-bold text-muted-foreground/50">{boletoApprovedCount} de {boletoTotalCount} pagos</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-orange-500">{boletoConversion.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border/20">
                  <div className="h-full bg-gradient-to-r from-orange-500/40 to-orange-500 rounded-full transition-all duration-1000" style={{ width: `${boletoConversion}%` }} />
                </div>
              </div>
            </div>

            {/* Quick integration shortcuts */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[
                { label: "Credenciais API", icon: KeyRound, to: "/integracoes?tab=keys" },
                { label: "Documentação", icon: BookOpen, to: "/integracoes?tab=api" },
                { label: "Webhooks", icon: Webhook, to: "/integracoes?tab=webhooks" },
                { label: "Integrações", icon: Puzzle, to: "/integracoes?tab=apps" },
              ].map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="seller-hover-card group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/40 bg-card/50 px-3 py-4 text-center transition-all hover:border-primary/40"
                >
                  <div className="h-9 w-9 rounded-xl border border-border/40 bg-muted/30 flex items-center justify-center text-foreground/70 group-hover:text-primary group-hover:border-primary/40 transition-colors">
                    <item.icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="seller-hover-card border-border/40 overflow-hidden shadow-lg shadow-black/5 rounded-3xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 px-6 py-6 md:px-8">
          <div>
            <CardTitle className="text-lg font-bold">Últimas Transações</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider opacity-50">Acompanhamento em tempo real</CardDescription>
          </div>
          <Link to="/vendas" className="seller-link-action text-xs font-bold text-primary hover:underline underline-offset-4 flex items-center gap-1">
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
                className="seller-row-action group w-full text-left flex items-center justify-between px-8 py-6 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", statusBg(item.status))}>
                    {item.label === "pix" ? (
                      <PixLogoMark className="h-5 w-5" />
                    ) : item.label === "boleto" ? (
                      <Barcode className={cn("h-5 w-5", statusColor(item.status))} />
                    ) : (
                      <CreditCard className={cn("h-5 w-5", statusColor(item.status))} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{item.label === "pix" ? "Pagamento via PIX" : item.label === "credit_card" ? "Pagamento via Cartão" : item.label === "boleto" ? "Pagamento via Boleto" : "Transação"}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">{timeAgo(item.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{fmt(item.amount)}</p>
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

