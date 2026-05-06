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
  ArrowUpRight,
  DollarSign,
  GraduationCap,
  Users,
  Package,
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
  const { data: transactions = [], refetch: refetchTx } = useTransactions();
  const { data: withdrawals = [] } = useWithdrawals(10);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[0]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const privacy = usePrivacyMode();
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('dashboard-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => { refetchTx(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: `user_id=eq.${user.id}` }, () => { refetchTx(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refetchTx]);

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

  const { approved, revenue, conversion, uniqueCustomers, pixConversion, cardConversion, chargebackRate, chargebacks } = useMemo(() => {
    const _approved = filteredTx.filter((t) => t.status === "completed");
    const _revenue = _approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const _conversion = filteredTx.length > 0 ? (_approved.length / filteredTx.length) * 100 : 0;
    const pixTx = filteredTx.filter(t => t.payment_method === "pix");
    const pixApproved = pixTx.filter(t => t.status === "completed");
    const _pixConversion = pixTx.length > 0 ? (pixApproved.length / pixTx.length) * 100 : 0;
    const cardTx = filteredTx.filter(t => t.payment_method === "credit_card" || t.payment_method === "card");
    const cardApproved = cardTx.filter(t => t.status === "completed");
    const _cardConversion = cardTx.length > 0 ? (cardApproved.length / cardTx.length) * 100 : 0;
    const _chargebacks = filteredTx.filter((t) => t.status === "chargeback");
    const _chargebackRate = filteredTx.length > 0 ? (_chargebacks.length / filteredTx.length) * 100 : 0;
    const _uniqueCustomers = new Set(filteredTx.map(t => t.customer_email).filter(Boolean)).size;
    return { approved: _approved, revenue: _revenue, conversion: _conversion, uniqueCustomers: _uniqueCustomers, pixConversion: _pixConversion, cardConversion: _cardConversion, chargebackRate: _chargebackRate, chargebacks: _chargebacks };
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

  const { balance } = useMemo(() => {
    const totalRevenue = transactions.filter(t => t.status === "completed").reduce((acc, t) => acc + Number(t.net_amount), 0);
    const totalWithdrawn = withdrawals.filter(w => w.status === "approved" || w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0);
    const totalRetained = transactions.filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0).reduce((acc, t) => acc + Number(t.retained_amount), 0);
    return { balance: totalRevenue + balanceAdjustments - totalWithdrawn - totalRetained };
  }, [transactions, withdrawals, balanceAdjustments]);

  const chartData = useMemo(() => {
    const isHourly = !isCustom && selectedPeriod.days <= 1;
    if (isHourly) {
      const revenueByHour = new Map<number, number>();
      for (const t of filteredTx) {
        if (t.status !== "completed") continue;
        const hour = new Date(t.created_at).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
        const h = parseInt(hour, 10);
        revenueByHour.set(h, (revenueByHour.get(h) || 0) + Number(t.net_amount));
      }
      return Array.from({ length: 24 }, (_, i) => ({ name: `${String(i).padStart(2, "0")}:00`, vendas: revenueByHour.get(i) || 0 }));
    }
    let days = isCustom && customRange?.from ? Math.max(differenceInDays(customRange.to || customRange.from!, customRange.from) + 1, 1) : Math.max(selectedPeriod.days, 1);
    let startDate = isCustom && customRange?.from ? new Date(customRange.from) : new Date(brasiliaToday());
    if (!isCustom) startDate.setDate(startDate.getDate() - (days - 1));
    const revenueByDate = new Map<string, number>();
    for (const t of transactions) {
      if (t.status !== "completed") continue;
      const dateKey = toBrasiliaDate(t.created_at);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(t.net_amount));
    }
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return { name: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }), vendas: revenueByDate.get(d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })) || 0 };
    });
  }, [transactions, filteredTx, selectedPeriod.days, isCustom, customRange]);

  const activity = useMemo(() => {
    const tx = transactions.slice(0, 8).map((t) => ({ id: t.id, kind: "transaction" as const, createdAt: t.created_at, amount: Number(t.amount), status: t.status, label: t.payment_method || "Pagamento" }));
    const wd = withdrawals.slice(0, 5).map((w) => ({ id: w.id, kind: "withdrawal" as const, createdAt: w.created_at, amount: Number(w.amount), status: w.status, label: "Saque" }));
    return [...tx, ...wd].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
  }, [transactions, withdrawals]);

  const nickname = profile?.nickname || profile?.full_name?.split(" ")[0] || "Vendedor";
  const safeBalance = Math.max(balance, 0);

  return (
    <div className="mx-auto w-full max-w-[1440px] p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Olá, {nickname}</h1>
          <p className="text-muted-foreground">Aqui está o resumo da sua operação.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={privacy.toggle} className="p-2 rounded-lg border bg-card hover:bg-accent">
            {privacy.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Saldo Disponível", value: privacy.hidden ? CENSORED : fmt(safeBalance), icon: Wallet, color: "text-primary" },
          { label: "Faturamento", value: privacy.hidden ? CENSORED : fmt(revenue), icon: TrendingUp, color: "text-success" },
          { label: "Conversão", value: `${conversion.toFixed(1)}%`, icon: Zap, color: "text-info" },
          { label: "Clientes", value: uniqueCustomers.toString(), icon: Users, color: "text-warning" },
        ].map((stat, i) => (
          <div key={i} className="p-6 rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
            <div className="text-2xl font-black tabular-nums">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl border bg-card shadow-sm">
          <h3 className="text-lg font-bold mb-6">Performance de Vendas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v/1000}k`} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
              <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorVendas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="p-6 rounded-2xl border bg-card shadow-sm">
          <h3 className="text-lg font-bold mb-6">Atividade Recente</h3>
          <div className="space-y-4">
            {activity.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-full", item.kind === 'withdrawal' ? "bg-destructive/10" : "bg-success/10")}>
                    {item.kind === 'withdrawal' ? <ArrowDownRight className="h-4 w-4 text-destructive" /> : <CreditCard className="h-4 w-4 text-success" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</p>
                  </div>
                </div>
                <span className="font-bold tabular-nums">{privacy.hidden ? CENSORED : fmt(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
