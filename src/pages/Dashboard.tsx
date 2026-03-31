import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions, useWithdrawals, useProducts as useProductsQuery } from "@/hooks/useQueryData";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  Flame,
  GraduationCap,
  Hash,
  Layers,
  Lock,
  Mail,
  Package,
  Phone,
  RefreshCw,
  Rocket,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
  Percent,
  FileText,
  Webhook,
  User,
  BookOpen,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
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
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

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
  const { user } = useAuth();
  const { profile } = useProfile();
  const { data: transactions = [], refetch: refetchTx } = useTransactions();
  const { data: withdrawals = [] } = useWithdrawals(10);
  const { data: productsData } = useProductsQuery();
  const products = productsData?.length ?? 0;
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[0]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [scaleMode, setScaleMode] = useState(false);
  const [scaleModeUnlocked, setScaleModeUnlocked] = useState(false);
  const privacy = usePrivacyMode();
  const [showScalePopup, setShowScalePopup] = useState(false);
  const [fireEffect, setFireEffect] = useState(false);
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
      const start = new Date(customRange.from); start.setHours(0, 0, 0, 0);
      const end = customRange.to ? new Date(customRange.to) : new Date(customRange.from); end.setHours(23, 59, 59, 999);
      return transactions.filter((t) => { const d = new Date(t.created_at); return d >= start && d <= end; });
    }
    const today = brasiliaToday();
    if (selectedPeriod.days === 0) {
      const todayStr = today.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return transactions.filter((t) => toBrasiliaDate(t.created_at) === todayStr);
    }
    if (selectedPeriod.days === 1) {
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return transactions.filter((t) => toBrasiliaDate(t.created_at) === yesterdayStr);
    }
    const start = new Date(today); start.setDate(start.getDate() - selectedPeriod.days); start.setHours(0, 0, 0, 0);
    return transactions.filter((t) => new Date(t.created_at) >= start);
  }, [transactions, selectedPeriod, isCustom, customRange]);

  const { approved, pending, refunded, chargebacks, revenue, conversion, pixConversion, cardConversion, chargebackRate } = useMemo(() => {
    const _approved = filteredTx.filter((t) => t.status === "completed");
    const _pending = filteredTx.filter((t) => t.status === "pending");
    const _refunded = filteredTx.filter((t) => t.status === "refunded");
    const _chargebacks = filteredTx.filter((t) => t.status === "chargeback");
    const _revenue = _approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const _conversion = filteredTx.length > 0 ? (_approved.length / filteredTx.length) * 100 : 0;
    const pixTx = filteredTx.filter(t => t.payment_method === "pix");
    const pixApproved = pixTx.filter(t => t.status === "completed");
    const _pixConversion = pixTx.length > 0 ? (pixApproved.length / pixTx.length) * 100 : 0;
    const cardTx = filteredTx.filter(t => t.payment_method === "credit_card" || t.payment_method === "card");
    const cardApproved = cardTx.filter(t => t.status === "completed");
    const _cardConversion = cardTx.length > 0 ? (cardApproved.length / cardTx.length) * 100 : 0;
    const _chargebackRate = filteredTx.length > 0 ? (_chargebacks.length / filteredTx.length) * 100 : 0;
    return { approved: _approved, pending: _pending, refunded: _refunded, chargebacks: _chargebacks, revenue: _revenue, conversion: _conversion, pixConversion: _pixConversion, cardConversion: _cardConversion, chargebackRate: _chargebackRate };
  }, [filteredTx]);

  const [balanceAdjustments, setBalanceAdjustments] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("balance_adjustments").select("amount, type").eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setBalanceAdjustments(data.reduce((acc, a) => acc + (a.type === "credit" ? Number(a.amount) : -Number(a.amount)), 0));
      });
  }, [user?.id]);

  const { withdrawalPending, balance } = useMemo(() => {
    const _withdrawalPending = withdrawals.filter((w) => w.status === "pending").reduce((acc, w) => acc + Number(w.net_amount), 0);
    const totalRevenue = transactions.filter(t => t.status === "completed").reduce((acc, t) => acc + Number(t.net_amount), 0);
    const totalWithdrawn = withdrawals.filter(w => w.status === "approved" || w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0);
    const totalRetained = transactions.filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0).reduce((acc, t) => acc + Number(t.retained_amount), 0);
    return { withdrawalPending: _withdrawalPending, balance: totalRevenue + balanceAdjustments - totalWithdrawn - totalRetained };
  }, [transactions, withdrawals, balanceAdjustments]);

  const chartData = useMemo(() => {
    let days: number; let startDate: Date;
    if (isCustom && customRange?.from) {
      const end = customRange.to || customRange.from;
      days = Math.max(differenceInDays(end, customRange.from) + 1, 1);
      startDate = new Date(customRange.from);
    } else {
      days = Math.max(selectedPeriod.days <= 1 ? 7 : selectedPeriod.days, 1);
      startDate = new Date(brasiliaToday()); startDate.setDate(startDate.getDate() - (days - 1));
    }
    const revenueByDate = new Map<string, number>();
    for (const t of transactions) {
      if (t.status !== "completed") continue;
      const dateKey = toBrasiliaDate(t.created_at);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(t.net_amount));
    }
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(startDate); d.setDate(d.getDate() + i);
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const compare = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return { name: label, vendas: revenueByDate.get(compare) || 0 };
    });
  }, [transactions, selectedPeriod.days, isCustom, customRange]);

  const activity = useMemo(() => {
    const tx = transactions.slice(0, 8).map((t) => ({ id: t.id, kind: "transaction" as const, createdAt: t.created_at, amount: Number(t.amount), status: t.status, label: t.payment_method || "Pagamento" }));
    const wd = withdrawals.slice(0, 5).map((w) => ({ id: w.id, kind: "withdrawal" as const, createdAt: w.created_at, amount: Number(w.amount), status: w.status, label: "Saque" }));
    return [...tx, ...wd].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
  }, [transactions, withdrawals]);

  useEffect(() => {
    if (!user?.id) return;
    const key = `scale_mode_unlocked_${user.id}`;
    if (localStorage.getItem(key) === "true") { setScaleModeUnlocked(true); setScaleMode(true); }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || scaleModeUnlocked) return;
    const now = new Date(); const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const revenue24h = transactions.filter(tx => tx.status === "completed" && new Date(tx.created_at) >= last24h).reduce((acc, tx) => acc + Number(tx.net_amount), 0);
    if (revenue24h >= 2000) {
      localStorage.setItem(`scale_mode_unlocked_${user.id}`, "true");
      setScaleModeUnlocked(true); setFireEffect(true);
      setTimeout(() => { setShowScalePopup(true); setScaleMode(true); }, 800);
      setTimeout(() => setFireEffect(false), 3000);
    }
  }, [user?.id, transactions, scaleModeUnlocked]);

  const activateScaleMode = useCallback(() => {
    if (!scaleModeUnlocked) return;
    setFireEffect(true);
    setTimeout(() => { setShowScalePopup(true); setScaleMode(true); }, 800);
    setTimeout(() => setFireEffect(false), 3000);
  }, [scaleModeUnlocked]);

  const nickname = profile?.nickname || profile?.full_name?.split(" ")[0] || null;

  return (
    <div className="space-y-4 md:space-y-5 relative">
      {/* Fire effect */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/30 via-primary/8 to-transparent animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/30 via-primary/8 to-transparent animate-pulse" />
          <div className="absolute top-0 left-0 bottom-0 w-20 bg-gradient-to-r from-primary/30 via-primary/8 to-transparent animate-pulse" />
          <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-l from-primary/30 via-primary/8 to-transparent animate-pulse" />
        </div>
      )}

      {/* Scale Mode Popup */}
      {showScalePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" onClick={() => setShowScalePopup(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-primary/30 bg-card shadow-2xl animate-scale-in overflow-hidden">
            <button onClick={() => setShowScalePopup(false)} className="absolute top-4 right-4 h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted z-10">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <div className="relative p-8 text-center">
              <div className="mx-auto mb-5 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Rocket className="h-10 w-10 text-primary" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/8 border border-primary/20 px-3 py-1 mb-4">
                <Flame className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Modo Escala</span>
              </div>
              <h2 className="text-2xl font-display font-black text-foreground mb-3">MODO ESCALA <span className="text-gradient">ATIVADO!</span></h2>
              <p className="text-sm text-muted-foreground mb-5">Suporte prioritário e funcionalidades exclusivas desbloqueadas!</p>
              <button onClick={() => setShowScalePopup(false)} className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-bold text-sm">
                BORA ESCALAR!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding */}
      {transactions.length === 0 && products === 0 && (
        <section className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.03] p-6 md:p-8 animate-fade-in">
          <div className="text-center max-w-lg mx-auto">
            <div className="mx-auto mb-4 h-14 w-14 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/15">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-display font-black tracking-tight text-foreground mb-2">
              Bem-vindo à <span className="text-gradient">HOTZFY</span>!
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Crie seu produto, configure o checkout e comece a vender.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
              {[
                { step: "1", label: "Criar Produto", href: "/vendas/produtos" },
                { step: "2", label: "Verificar Conta", href: "/financeiro/identidade" },
                { step: "3", label: "Primeira Venda", href: "/vendas/checkout" },
              ].map(s => (
                <Link key={s.step} to={s.href} className="group p-3.5 rounded-xl border border-border/30 bg-card/60 hover:border-primary/20 transition-all text-left">
                  <div className="h-7 w-7 rounded-lg gradient-primary text-primary-foreground text-xs font-bold flex items-center justify-center mb-2">
                    {s.step}
                  </div>
                  <p className="text-[12px] font-bold text-foreground">{s.label}</p>
                </Link>
              ))}
            </div>
            <Link to="/vendas/produtos" className="inline-flex items-center gap-2 h-10 px-5 rounded-xl gradient-primary text-primary-foreground font-bold text-sm">
              <Rocket className="h-4 w-4" /> Começar
            </Link>
          </div>
        </section>
      )}

      {/* Header Row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-display font-black tracking-tight text-foreground">
            {nickname ? <>Olá, <span className="text-gradient">{nickname}</span></> : <span className="inline-block w-32 h-7 rounded-lg bg-muted/30 animate-pulse" />}
          </h1>
          <p className="text-[12px] text-muted-foreground/60 mt-0.5">Resumo do seu negócio</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Scale Mode */}
          {scaleModeUnlocked ? (
            <button onClick={activateScaleMode} className={cn("h-8 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all", scaleMode ? "bg-primary text-primary-foreground" : "border border-primary/30 bg-primary/8 text-primary hover:bg-primary/15")}>
              <Flame className={cn("h-3.5 w-3.5", scaleMode && "animate-pulse")} />
              <span>Modo Escala</span>
            </button>
          ) : (
            <div className="h-8 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-bold border border-border/30 bg-muted/10 text-muted-foreground/50 cursor-not-allowed">
              <Lock className="h-3.5 w-3.5" />
              <span>Modo Escala</span>
            </div>
          )}

          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-card px-3 text-xs font-semibold text-foreground transition-all hover:border-border/60">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                {isCustom && customRange?.from
                  ? customRange.to ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${format(customRange.to, "dd/MM", { locale: ptBR })}` : format(customRange.from, "dd/MM/yyyy", { locale: ptBR })
                  : selectedPeriod.label}
                <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-lg overflow-hidden">
              <div className="p-1.5 space-y-0.5 min-w-[140px]">
                {PERIOD_PRESETS.map((option) => (
                  <button key={option.label} onClick={() => { setSelectedPeriod(option); setIsCustom(false); setCustomRange(undefined); setDatePickerOpen(false); }}
                    className={cn("w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all", !isCustom && selectedPeriod.label === option.label ? "bg-primary/10 text-primary font-semibold" : "text-foreground/60 hover:bg-muted/30 hover:text-foreground")}>
                    {option.label}
                  </button>
                ))}
                <div className="my-1 border-t border-border/15" />
                <button onClick={() => setIsCustom(true)} className={cn("w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] font-medium flex items-center gap-1.5", isCustom ? "bg-primary/10 text-primary" : "text-foreground/60 hover:bg-muted/30")}>
                  <CalendarDays className="h-3 w-3" /> Personalizado
                </button>
                {isCustom && (
                  <div className="border-t border-border/15 mt-1 pt-1">
                    <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }}
                      numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-2.5 pointer-events-auto"
                      classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <button onClick={privacy.toggle} className="h-8 w-8 rounded-lg border border-border/40 bg-card flex items-center justify-center hover:border-border/60 transition-all" title={privacy.hidden ? "Mostrar" : "Ocultar"}>
            {privacy.hidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KpiCard label="Receita Líquida" value={privacy.hidden ? CENSORED : fmt(revenue)} icon={<DollarSign className="h-4 w-4" />} tone="primary" />
        <KpiCard label="Vendas" value={privacy.hidden ? CENSORED : String(approved.length)} icon={<ShoppingCart className="h-4 w-4" />} tone="success" />
        <KpiCard label="Conversão" value={privacy.hidden ? CENSORED : `${conversion.toFixed(1)}%`} icon={<Target className="h-4 w-4" />} tone="info" />
        <KpiCard label="Saldo" value={privacy.hidden ? CENSORED : fmt(Math.abs(balance))} icon={<Wallet className="h-4 w-4" />} tone={balance < 0 ? "destructive" : "primary"} prefix={balance < 0 ? "- " : ""} />
      </div>

      {/* Chart + Side panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Chart */}
        <div className="xl:col-span-2 rounded-xl border border-border/30 bg-card/80 p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-[12px] font-bold text-foreground">Receita</span>
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">
              {isCustom && customRange?.from ? "Personalizado" : selectedPeriod.label}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tickLine={false} axisLine={false} dy={6} stroke="hsl(var(--muted-foreground) / 0.12)" fontSize={10} fontFamily="Space Grotesk" interval={chartData.length > 10 ? Math.ceil(chartData.length / 8) - 1 : 0} />
              <YAxis tickLine={false} axisLine={false} width={54} stroke="hsl(var(--muted-foreground) / 0.12)" fontSize={10} fontFamily="Space Grotesk" tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: "10px", fontSize: "11px", fontFamily: "Space Grotesk", color: "var(--tooltip-text)", padding: "8px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
                formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]}
                cursor={{ stroke: "hsl(var(--primary) / 0.1)", strokeDasharray: "3 3" }}
              />
              <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">
          {/* Health */}
          <div className="rounded-xl border border-border/30 bg-card/80 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span className="text-[11px] font-bold text-foreground">Saúde</span>
            </div>
            <div className="space-y-1.5">
              <MetricRow label="Aprovadas" value={String(approved.length)} tone="success" />
              <MetricRow label="Pendentes" value={String(pending.length)} tone="warning" />
              <MetricRow label="Reembolsos" value={String(refunded.length)} tone="info" />
              <MetricRow label="Chargebacks" value={String(chargebacks.length)} tone={chargebacks.length > 0 ? "destructive" : "success"} />
            </div>
          </div>

          {/* Conversions */}
          <div className="rounded-xl border border-border/30 bg-card/80 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-3.5 w-3.5 text-info" />
              <span className="text-[11px] font-bold text-foreground">Conversões</span>
            </div>
            <div className="space-y-1.5">
              <MetricRow label="Conv. PIX" value={`${pixConversion.toFixed(1)}%`} tone="success" />
              <MetricRow label="Conv. Cartão" value={`${cardConversion.toFixed(1)}%`} tone="info" />
              <MetricRow label="Chargeback" value={`${chargebackRate.toFixed(2)}%`} tone={chargebackRate > 1 ? "destructive" : "success"} />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <MiniKpi label="Ticket médio" value={privacy.hidden ? CENSORED : fmt(approved.length > 0 ? revenue / approved.length : 0)} />
        <MiniKpi label="Saldo Pendente" value={privacy.hidden ? CENSORED : fmt(withdrawalPending)} />
        <MiniKpi label="Reembolsos" value={privacy.hidden ? CENSORED : String(refunded.length)} />
        <MiniKpi label="Chargebacks" value={privacy.hidden ? CENSORED : String(chargebacks.length)} />
      </div>

      {/* Actions + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Quick Actions */}
        <div className="rounded-xl border border-border/30 bg-card/80 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold text-foreground">Ações Rápidas</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Criar Produto", href: "/vendas/produtos", icon: Package },
              { label: "Conteúdo", href: "/vendas/conteudo", icon: Layers },
              { label: "Checkout", href: "/vendas/checkout", icon: CreditCard },
              { label: "Vendas", href: "/vendas", icon: BarChart3 },
              { label: "Extrato", href: "/financeiro/extrato", icon: FileText },
              { label: "Saques", href: "/financeiro/saques", icon: ArrowDownRight },
              { label: "Webhooks", href: "/vendas/webhooks", icon: Webhook },
              { label: "Perfil", href: "/perfil", icon: User },
            ].map((action) => (
              <Link key={action.href} to={action.href} className="group flex items-center gap-2.5 rounded-lg border border-border/20 p-2.5 transition-all hover:border-primary/15 hover:bg-primary/[0.03]">
                <div className="h-8 w-8 rounded-lg bg-primary/6 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <action.icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[12px] font-semibold text-foreground truncate">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="rounded-xl border border-border/30 bg-card/80 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-border/15">
            <div className="flex items-center gap-2">
              <div className="relative h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-40" />
                <span className="relative block h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
              <span className="text-[11px] font-bold text-foreground">Tempo real</span>
            </div>
            <Link to="/financeiro/extrato" className="text-[10px] font-bold text-primary/50 hover:text-primary transition-colors">Ver tudo</Link>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
            {activity.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground/50">Sem movimentações</p>
              </div>
            ) : (
              activity.map((item) => {
                const statusColors: Record<string, string> = {
                  completed: "border-l-success bg-success/[0.03]",
                  pending: "border-l-warning bg-warning/[0.03]",
                  failed: "border-l-destructive bg-destructive/[0.03]",
                  refunded: "border-l-info bg-info/[0.03]",
                  chargeback: "border-l-destructive bg-destructive/[0.03]",
                  approved: "border-l-success bg-success/[0.03]",
                  rejected: "border-l-destructive bg-destructive/[0.03]",
                };
                const fullTx = item.kind === "transaction" ? transactions.find(t => t.id === item.id) : null;

                return (
                  <div key={item.id} className={cn("group flex items-center gap-2.5 rounded-lg border-l-[2.5px] px-3 py-2.5 transition-all", statusColors[item.status] || "border-l-muted-foreground bg-muted/[0.03]")}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-display font-bold text-foreground tabular-nums">{privacy.hidden ? CENSORED : fmt(item.amount)}</p>
                      <p className="text-[10px] text-muted-foreground/50 truncate">{item.kind === "transaction" ? `Venda • ${item.label}` : item.label}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {fullTx && (
                        <button onClick={() => setDetailTx(fullTx)} className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                          <Eye className="h-3 w-3" />
                        </button>
                      )}
                      <span className="text-[9px] text-muted-foreground/30 font-semibold tabular-nums">{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      <Dialog open={!!detailTx} onOpenChange={(open) => !open && setDetailTx(null)}>
        <DialogContent className="sm:max-w-md border-border/30 bg-card p-0 gap-0 overflow-hidden">
          {detailTx && (() => {
            const statusMap: Record<string, { label: string; color: string }> = {
              completed: { label: "Aprovada", color: "bg-success/12 text-success" },
              pending: { label: "Pendente", color: "bg-warning/12 text-warning" },
              failed: { label: "Falhou", color: "bg-destructive/12 text-destructive" },
              refunded: { label: "Reembolso", color: "bg-info/12 text-info" },
              chargeback: { label: "Chargeback", color: "bg-destructive/12 text-destructive" },
            };
            const s = statusMap[detailTx.status] || { label: detailTx.status, color: "bg-muted text-foreground" };
            const productName = productsData?.find(p => p.id === detailTx.product_id)?.name;
            return (
              <div>
                <div className="px-5 pt-5 pb-3 border-b border-border/20">
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-display font-black text-foreground tabular-nums">{fmt(Number(detailTx.amount))}</p>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${s.color}`}>{s.label}</span>
                  </div>
                  {productName && <p className="text-[12px] text-muted-foreground mt-1">{productName}</p>}
                </div>
                <div className="px-5 py-4 space-y-2.5">
                  {detailTx.customer_name && <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Cliente" value={detailTx.customer_name} />}
                  {detailTx.customer_email && <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={detailTx.customer_email} />}
                  {detailTx.customer_phone && <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={detailTx.customer_phone} />}
                  <div className="rounded-lg border border-border/20 bg-muted/5 p-3 space-y-1.5">
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Bruto</span><span className="font-semibold text-foreground tabular-nums">{fmt(Number(detailTx.amount))}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Taxas</span><span className="font-semibold text-destructive tabular-nums">- {fmt(Number(detailTx.fee_amount))}</span></div>
                    <div className="border-t border-border/15 pt-1.5 flex justify-between text-[12px]"><span className="font-semibold text-foreground">Líquido</span><span className="font-bold text-primary tabular-nums">{fmt(Number(detailTx.net_amount))}</span></div>
                  </div>
                  <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />{detailTx.payment_method === "credit_card" ? "Cartão" : detailTx.payment_method === "pix" ? "PIX" : detailTx.payment_method || "—"}</span>
                    <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{new Date(detailTx.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground/30 font-mono truncate">ID: {detailTx.id}</p>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-components ─── */

type Tone = "primary" | "info" | "success" | "warning" | "destructive";

const toneStyles: Record<Tone, { bg: string; text: string; border: string }> = {
  primary: { bg: "bg-primary/8", text: "text-primary", border: "border-primary/15" },
  info: { bg: "bg-info/8", text: "text-info", border: "border-info/15" },
  success: { bg: "bg-success/8", text: "text-success", border: "border-success/15" },
  warning: { bg: "bg-warning/8", text: "text-warning", border: "border-warning/15" },
  destructive: { bg: "bg-destructive/8", text: "text-destructive", border: "border-destructive/15" },
};

function KpiCard({ label, value, icon, tone, prefix }: { label: string; value: string; icon: React.ReactNode; tone: Tone; prefix?: string }) {
  const t = toneStyles[tone];
  return (
    <div className="rounded-xl border border-border/30 bg-card/80 p-3.5 md:p-4 transition-all hover:border-border/50">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] md:text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60 font-bold">{label}</span>
        <div className={cn("h-7 w-7 md:h-8 md:w-8 rounded-lg flex items-center justify-center", t.bg)}>
          <span className={t.text}>{icon}</span>
        </div>
      </div>
      <p className="text-lg md:text-2xl font-display font-black tracking-tight text-foreground tabular-nums">{prefix}{value}</p>
    </div>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const t = toneStyles[tone];
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/10 transition-colors">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-[13px] font-display font-bold tabular-nums", t.text)}>{value}</span>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/20 bg-card/60 p-3">
      <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/50 font-bold mb-1">{label}</p>
      <p className="text-sm md:text-base font-display font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground/40">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-[12px] font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
