import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions, useWithdrawals, useProducts as useProductsQuery, useDisputes } from "@/hooks/useQueryData";
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
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";

import type { DateRange } from "react-day-picker";

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
  const { data: transactions = [] } = useTransactions();
  const { data: withdrawals = [] } = useWithdrawals(10);
  const { data: disputes = [] } = useDisputes();
  const { data: productsData } = useProductsQuery();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[0]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const privacy = usePrivacyMode();
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);
  const [availableBalance, setAvailableBalance] = useState<number>(0);

  useEffect(() => {
    if (!user?.id) return;
    const fetchBalance = async () => {
      const { data, error } = await supabase.rpc("get_ledger_balance", { _user_id: user.id });
      if (!error && data !== null) setAvailableBalance(Number(data));
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

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
      .reduce((acc, t) => acc + Number(t.net_amount), 0);
  }, [transactions]);

  const medCount = useMemo(() => {
    return disputes.filter(d => d.type === 'medpix' && d.status === 'open').length;
  }, [disputes]);

  const financialCards = [
    { label: "Ticket Médio", value: privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0), icon: BarChart3, color: "info" as const, sub: "Média/venda" },
    { label: "Pedidos Pagos", value: approved.length, icon: Zap, color: "primary" as const, sub: "Concluídos", trend: 8 },
    { label: "Saldo Pendente", value: privacy.hidden ? CENSORED : fmt(pendingBalance), icon: Clock3, color: "warning" as const, sub: "Processando" },
    { label: "MEDS", value: medCount, icon: ShieldCheck, color: "destructive" as const, sub: "Disputas" },
  ];


  return (
    <div className="p-4 md:p-6 pt-2 md:pt-4 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
             <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
             <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">{greeting}, {nickname}</h1>
          </div>
          <p className="text-muted-foreground font-medium text-[11px] md:text-xs flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Acompanhe o desempenho da sua operação em tempo real.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-muted/20 p-1.5 rounded-[1.25rem] border border-border/40 backdrop-blur-md">
            {PERIOD_PRESETS.map(p => (
              <button 
                key={p.label}
                onClick={() => { setSelectedPeriod(p); setIsCustom(false); }}
                className={cn(
                  "px-6 py-2.5 rounded-[1rem] text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300",
                  !isCustom && selectedPeriod.label === p.label 
                    ? "bg-card text-primary shadow-lg shadow-black/5 ring-1 ring-border border-transparent" 
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className={cn(
                "h-[46px] px-6 rounded-[1.25rem] border-2 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300",
                isCustom 
                  ? "border-primary/30 bg-primary/5 text-primary shadow-lg shadow-primary/5" 
                  : "border-border/40 bg-card text-muted-foreground/60 hover:border-border hover:text-foreground hover:shadow-md"
              )}>
                <CalendarDays className="h-4 w-4" />
                {isCustom && customRange?.from ? format(customRange.from, "dd/MM") + " - " + (customRange.to ? format(customRange.to, "dd/MM") : "") : "Personalizado"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-0 border-border/50 rounded-[2rem] overflow-hidden shadow-2xl">
              <Calendar 
                mode="range" 
                selected={customRange} 
                onSelect={(r) => { setCustomRange(r); setIsCustom(true); }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Hero Financial Row */}
      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-2 relative overflow-hidden group border-primary/20 bg-gradient-to-br from-primary/[0.04] via-card to-card shadow-xl shadow-primary/5 rounded-3xl min-h-[220px]">
          {/* Main card inner glow */}
          <div className="absolute inset-px rounded-[1.45rem] bg-gradient-to-br from-primary/[0.01] to-transparent pointer-events-none" />
          
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] transition-all duration-700 group-hover:opacity-[0.08] group-hover:scale-110">
            <Wallet className="h-40 w-40 -rotate-12" />
          </div>

          <CardHeader className="pb-1 pt-6 px-6 md:px-8">
             <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/10 transition-all">
                <BarChart3 className="h-3 w-3" />
                Faturamento do Dia
             </div>
          </CardHeader>
          
          <CardContent className="pt-2 pb-6 px-6 md:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-6 flex-1">
                <div className="flex items-baseline gap-3">
                  <p className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground">
                    {privacy.hidden ? CENSORED : fmt(revenue)}
                  </p>
                  <span className="text-muted-foreground/30 font-bold text-lg">BRL</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 md:gap-6 p-4 rounded-2xl bg-background/40 border border-border/40 backdrop-blur-sm w-fit group-hover:border-primary/20 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-3 w-3 text-muted-foreground/60" />
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Saldo Disponível</p>
                    </div>
                    <p className="text-lg font-black text-success tracking-tight leading-none">{privacy.hidden ? CENSORED : fmt(balance)}</p>
                  </div>
                  <div className="hidden sm:block h-8 w-px bg-border/40" />
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Conversão</p>
                    <p className="text-lg font-black text-primary tracking-tight leading-none">{conversion.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 w-full md:w-auto">
                <Link to="/financeiro/saques" className="group/btn flex-1 md:flex-none relative overflow-hidden bg-primary text-primary-foreground px-6 h-12 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:translate-y-[-2px] hover:shadow-primary/30 active:scale-[0.98] transition-all whitespace-nowrap">
                  <ArrowDownRight className="h-4 w-4" />
                  Solicitar Saque
                </Link>
                <Link to="/vendas/links" className="flex-1 md:flex-none bg-card border border-border/60 px-6 h-12 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-accent hover:border-primary/20 hover:translate-y-[-2px] transition-all active:scale-[0.98] whitespace-nowrap">
                  <Zap className="h-4 w-4 text-success" />
                  Link de Pagamento
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-2 gap-4 md:gap-6">
          {financialCards.map((card) => (
            <StatCard 
              key={card.label}
              title={card.label}
              value={card.value}
              icon={card.icon}
              color={card.color}
              description={card.sub}
              trend={card.trend}
              changeType={card.trend ? "positive" : "neutral"}
            />
          ))}
        </div>
      </div>


      {/* Main Operations Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/40 overflow-hidden shadow-lg shadow-black/5 rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 px-6 py-5 md:px-8">
            <div>
              <CardTitle className="text-lg font-black">Fluxo de Vendas</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-wider opacity-50">Desempenho financeiro</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
               <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="opacity-60">Aprovadas</span>
               </div>
               <div className="text-primary font-black">{fmt(revenue)}</div>
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
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                              {payload[0].payload.fullLabel || payload[0].payload.name}
                            </p>
                            <p className="text-xl font-black text-primary tracking-tight">
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

        <Card className="border-border/40 overflow-hidden bg-gradient-to-b from-card to-background/20 shadow-xl shadow-black/5 rounded-3xl">
          <CardHeader className="border-b border-border/40 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black">Conversão Geral</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider opacity-50">Desempenho por método</CardDescription>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl border border-primary/20">
                <span className="text-xl font-black">{conversion.toFixed(1)}%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 py-8 space-y-8">
            <div className="space-y-6">
              {/* PIX */}
              <div className="group space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#32BCAD]/10 border border-[#32BCAD]/20 flex items-center justify-center text-[#32BCAD]">
                      <Zap className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">PIX</p>
                      <p className="text-[10px] font-bold text-muted-foreground/50">{pixApprovedCount} de {pixTotalCount} pagos</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-[#32BCAD]">{pixConversion.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border/20">
                  <div className="h-full bg-gradient-to-r from-[#32BCAD]/40 to-[#32BCAD] rounded-full transition-all duration-1000" style={{ width: `${pixConversion}%` }} />
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
                      <p className="text-xs font-black uppercase tracking-wider">Cartão</p>
                      <p className="text-[10px] font-bold text-muted-foreground/50">{cardApprovedCount} de {cardTotalCount} pagos</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-primary">{cardConversion.toFixed(0)}%</span>
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
                      <p className="text-xs font-black uppercase tracking-wider">Boleto</p>
                      <p className="text-[10px] font-bold text-muted-foreground/50">{boletoApprovedCount} de {boletoTotalCount} pagos</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-orange-500">{boletoConversion.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border/20">
                  <div className="h-full bg-gradient-to-r from-orange-500/40 to-orange-500 rounded-full transition-all duration-1000" style={{ width: `${boletoConversion}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-border/40 overflow-hidden shadow-lg shadow-black/5 rounded-3xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 px-6 py-6 md:px-8">
          <div>
            <CardTitle className="text-lg font-black">Últimas Transações</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider opacity-50">Acompanhamento em tempo real</CardDescription>
          </div>
          <Link to="/vendas" className="text-xs font-black text-primary hover:underline underline-offset-4 flex items-center gap-1">
             Ver Histórico Completo
             <ChevronRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {activity.map((item) => (
              <div key={item.id} className="group flex items-center justify-between px-8 py-6 hover:bg-muted/30 transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", statusBg(item.status))}>
                    <CreditCard className={cn("h-5 w-5", statusColor(item.status))} />
                  </div>
                  <div>
                    <p className="text-sm font-black">{item.label === "pix" ? "Pagamento via PIX" : item.label === "credit_card" ? "Pagamento via Cartão" : "Transação"}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">{timeAgo(item.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black">{fmt(item.amount)}</p>
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", statusColor(item.status))}>{statusLabel(item.status)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
