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
  Mail,
  Phone,
  User,
  ArrowUpRight,
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
  const { data: productsData } = useProductsQuery();
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

  const { approved, revenue, conversion, uniqueCustomers, pixConversion, cardConversion, chargebackRate, pixApprovedCount, pixTotalCount, cardApprovedCount, cardTotalCount } = useMemo(() => {
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
    };
  }, [filteredTx]);

  const balance = useMemo(() => {
    const totalRevenue = transactions.filter(t => t.status === "completed").reduce((acc, t) => acc + Number(t.net_amount), 0);
    const totalWithdrawn = withdrawals.filter(w => w.status === "approved" || w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0);
    const totalRetained = transactions.filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0).reduce((acc, t) => acc + Number(t.retained_amount), 0);
    return Math.max(totalRevenue - totalWithdrawn - totalRetained, 0);
  }, [transactions, withdrawals]);

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

  const financialCards = [
    { label: "Faturamento", value: privacy.hidden ? CENSORED : fmt(revenue), icon: TrendingUp, color: "success" as const, sub: "Bruto no período", trend: 12 },
    { label: "Vendas", value: approved.length, icon: Zap, color: "primary" as const, sub: "Transações concluídas", trend: 8 },
    { label: "Ticket Médio", value: privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0), icon: BarChart3, color: "info" as const, sub: "Média por venda" },
    { label: "Clientes", value: uniqueCustomers, icon: User, color: "warning" as const, sub: "Compradores únicos" },
  ];


  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="h-3 w-3 rounded-full bg-success animate-pulse" />
             <h1 className="text-3xl font-black tracking-tight text-foreground">{greeting}, {nickname}</h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Sua operação está saudável e em pleno funcionamento.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-muted/30 p-1 rounded-2xl border border-border/50">
            {PERIOD_PRESETS.map(p => (
              <button 
                key={p.label}
                onClick={() => { setSelectedPeriod(p); setIsCustom(false); }}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                  !isCustom && selectedPeriod.label === p.label ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className={cn(
                "h-11 px-5 rounded-2xl border flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all",
                isCustom ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground"
              )}>
                <CalendarDays className="h-4 w-4" />
                {isCustom && customRange?.from ? format(customRange.from, "dd/MM") + " - " + (customRange.to ? format(customRange.to, "dd/MM") : "") : "Personalizado"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-0 border-border/50 rounded-3xl overflow-hidden shadow-2xl">
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
        <Card className="lg:col-span-2 relative overflow-hidden group border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent shadow-xl shadow-primary/5 rounded-[2rem]">
          <div className="absolute top-0 right-0 p-12 opacity-[0.05] transition-all duration-700 group-hover:opacity-[0.1] group-hover:scale-110 group-hover:-rotate-6">
            <Wallet className="h-48 w-48 -rotate-12" />
          </div>
          <CardHeader className="pb-2">
             <div className="flex items-center gap-2 text-primary font-black uppercase tracking-[0.3em] text-[10px] bg-primary/5 w-fit px-3 py-1 rounded-full border border-primary/10">
                <ShieldCheck className="h-3 w-3" />
                Saldo Seguro Disponível
             </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-baseline gap-4">
              <p className="text-[64px] font-black tracking-tighter leading-none bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                {privacy.hidden ? CENSORED : fmt(balance)}
              </p>
              <span className="text-muted-foreground/60 font-black text-xl tracking-tighter">BRL</span>
            </div>
            
            <div className="mt-10 flex flex-wrap gap-4">
               <Link to="/financeiro/saques" className="bg-primary text-primary-foreground px-10 h-14 rounded-2xl font-black text-sm flex items-center gap-2 shadow-2xl shadow-primary/30 hover:translate-y-[-2px] hover:shadow-primary/40 active:scale-[0.98] transition-all">
                  <ArrowDownRight className="h-5 w-5" />
                  Solicitar Saque
               </Link>
               <Link to="/vendas/links" className="bg-card border border-border px-10 h-14 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-accent hover:translate-y-[-2px] transition-all">
                  <Zap className="h-5 w-5 text-success" />
                  Link de Pagamento
               </Link>
            </div>
          </CardContent>
          
          {/* Animated background element */}
          <div className="absolute -bottom-24 -left-24 h-64 w-64 bg-primary/5 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity" />
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
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
      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-border/40 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 px-8 py-6">
            <div>
              <CardTitle className="text-xl font-black">Fluxo de Vendas</CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-wider">Desempenho financeiro no tempo</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
               <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span>Aprovadas</span>
               </div>
               <div className="text-success font-black">{fmt(revenue)}</div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[360px] w-full pt-8 pb-4 pr-8 pl-4">
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

        <Card className="border-border/40 overflow-hidden bg-secondary/10">
          <CardHeader className="border-b border-border/40 px-8 py-6">
            <CardTitle className="text-xl font-black">Saúde da Operação</CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-wider">KPIs críticos de performance</CardDescription>
          </CardHeader>
          <CardContent className="px-8 py-8 space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Taxa de Conversão</span>
                <span className="text-2xl font-black text-primary">{conversion.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${conversion}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Conversão PIX</p>
                 <p className="text-xl font-black">{pixConversion.toFixed(0)}%</p>
              </div>
              <div className="space-y-2 text-right">
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Conversão Card</p>
                 <p className="text-xl font-black">{cardConversion.toFixed(0)}%</p>
              </div>
            </div>

            <div className="pt-6 border-t border-border/40">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-success" />
                     </div>
                     <div>
                        <p className="text-xs font-black">Risco & Fraude</p>
                        <p className="text-[10px] font-bold text-muted-foreground">Monitoramento ativo</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-sm font-black text-success">Excelente</p>
                     <p className="text-[10px] font-bold text-muted-foreground">Score: {Math.max(0, 100 - chargebackRate * 12).toFixed(0)}</p>
                  </div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-border/40 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 px-8 py-6">
          <div>
            <CardTitle className="text-xl font-black">Últimas Transações</CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-wider">Acompanhamento em tempo real</CardDescription>
          </div>
          <Link to="/vendas" className="text-xs font-black text-primary hover:underline underline-offset-4 flex items-center gap-1">
             Ver Histórico Completo
             <ChevronRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {activity.map((item) => (
              <div key={item.id} className="group flex items-center justify-between px-8 py-4 hover:bg-muted/30 transition-all cursor-pointer">
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
