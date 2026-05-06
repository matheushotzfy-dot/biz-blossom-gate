import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions, useWithdrawals, useProducts as useProductsQuery } from "@/hooks/useQueryData";
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
  X as XIcon,
  CheckCircle2,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

const PERIOD_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
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
  const { data: transactions = [] } = useTransactions();
  const { data: withdrawals = [] } = useWithdrawals(10);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[0]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const privacy = usePrivacyMode();
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);

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

  const { approved, revenue, conversion, uniqueCustomers, pixConversion, cardConversion, chargebackRate, pixApprovedCount, pixTotalCount, cardApprovedCount, cardTotalCount, chargebacks } = useMemo(() => {
    const _approved = filteredTx.filter((t) => t.status === "completed");
    const _revenue = _approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const _conversion = filteredTx.length > 0 ? (_approved.length / filteredTx.length) * 100 : 0;
    
    const pixTx = filteredTx.filter(t => t.payment_method === "pix");
    const pixApproved = pixTx.filter(t => t.status === "completed");
    const _pixConversion = pixTx.length > 0 ? (pixApproved.length / pixTx.length) * 100 : 0;

    const cardTx = filteredTx.filter(t => t.payment_method === "credit_card" || t.payment_method === "card");
    const cardApproved = cardTx.filter(t => t.status === "completed");
    const _cardConversion = cardTx.length > 0 ? (cardApproved.length / cardTx.length) * 100 : 0;

    const _chargebackRate = filteredTx.length > 0 ? (filteredTx.filter(t => t.status === "chargeback").length / filteredTx.length) * 100 : 0;
    const _uniqueCustomers = new Set(filteredTx.map(t => t.customer_email).filter(Boolean)).size;

    return {
      approved: _approved,
      revenue: _revenue,
      conversion: _conversion,
      uniqueCustomers: _uniqueCustomers,
      pixConversion: _pixConversion,
      cardConversion: _cardConversion,
      chargebackRate: _chargebackRate,
      pixApprovedCount: pixApproved.length, pixTotalCount: pixTx.length,
      cardApprovedCount: cardApproved.length, cardTotalCount: cardTx.length,
      chargebacks: filteredTx.filter(t => t.status === "chargeback"),
    };
  }, [filteredTx]);

  const balance = useMemo(() => {
    const totalRevenue = transactions.filter(t => t.status === "completed").reduce((acc, t) => acc + Number(t.net_amount), 0);
    const totalWithdrawn = withdrawals.filter(w => w.status === "approved" || w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0);
    const totalRetained = transactions.filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0).reduce((acc, t) => acc + Number(t.retained_amount), 0);
    return Math.max(totalRevenue - totalWithdrawn - totalRetained, 0);
  }, [transactions, withdrawals]);

  const chartData = useMemo(() => {
    const days = Math.max(selectedPeriod.days, 1);
    const startDate = new Date(brasiliaToday());
    startDate.setDate(startDate.getDate() - (days - 1));
    const revenueByDate = new Map<string, number>();
    for (const t of transactions) {
      if (t.status !== "completed") continue;
      const dateKey = toBrasiliaDate(t.created_at);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(t.net_amount));
    }
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return { name: label, vendas: revenueByDate.get(d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })) || 0 };
    });
  }, [transactions, selectedPeriod.days]);

  const nickname = profile?.nickname || profile?.full_name?.split(" ")[0] || "Vendedor";
  const statusBg = (s: string) => s === 'completed' ? 'bg-emerald-500/10' : 'bg-amber-500/10';
  const statusColor = (s: string) => s === 'completed' ? 'text-emerald-500' : 'text-amber-500';

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground">Bom dia, {nickname}</h1>
          <p className="text-muted-foreground font-medium">Sua central de operações</p>
        </div>
        <div className="flex gap-2">
            {PERIOD_PRESETS.map(p => (
                <button 
                  key={p.label}
                  onClick={() => setSelectedPeriod(p)}
                  className={cn("px-4 py-2 rounded-xl text-sm font-semibold transition", selectedPeriod.label === p.label ? "bg-primary text-white" : "bg-card border border-border")}
                >
                    {p.label}
                </button>
            ))}
        </div>
      </div>

      {/* Hero Financials */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="col-span-2 border-primary/20 bg-primary/5">
          <CardHeader className="pb-2"><CardDescription>Saldo Disponível</CardDescription></CardHeader>
          <CardContent><p className="text-5xl font-black">{privacy.hidden ? CENSORED : fmt(balance)}</p></CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2"><CardDescription>Faturamento</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{privacy.hidden ? CENSORED : fmt(revenue)}</p></CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2"><CardDescription>Conversão</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{conversion.toFixed(1)}%</p></CardContent>
        </Card>
      </div>

      {/* Main Charts & Activity */}
      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Evolução de Vendas</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Area dataKey="vendas" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Qualidade</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                    <span>Score de Risco</span>
                    <span className="font-bold text-success">{Math.max(0, 100 - chargebackRate * 12).toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span>PIX Conversão</span>
                    <span className="font-bold">{pixConversion.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                    <span>Cartão Conversão</span>
                    <span className="font-bold">{cardConversion.toFixed(0)}%</span>
                </div>
            </CardContent>
        </Card>
      </div>
      
    </div>
  );
}

function PixLogoMark({ className }: { className?: string }) {
  return <div className={className} />; // Simplification for now
}
