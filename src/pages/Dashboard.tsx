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
  Flame,
  GraduationCap,
  Layers,
  Lock,
  Package,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PERIOD_OPTIONS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
] as const;

const STAGGER_CLASSES = ["", "stagger-1", "stagger-2", "stagger-3", "stagger-4", "stagger-5", "stagger-6"];

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
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
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
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>(PERIOD_OPTIONS[0]);
  const [scaleMode, setScaleMode] = useState(false);
  const [scaleModeUnlocked, setScaleModeUnlocked] = useState(false);
  const [showScalePopup, setShowScalePopup] = useState(false);
  const [fireEffect, setFireEffect] = useState(false);

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
  }, [transactions, selectedPeriod]);

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
    return {
      approved: _approved, pending: _pending, refunded: _refunded, chargebacks: _chargebacks,
      revenue: _revenue, conversion: _conversion,
      pixConversion: _pixConversion, cardConversion: _cardConversion, chargebackRate: _chargebackRate,
    };
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

  const { withdrawalPending, balance } = useMemo(() => {
    const _withdrawalPending = withdrawals.filter((w) => w.status === "pending").reduce((acc, w) => acc + Number(w.net_amount), 0);
    const totalRevenue = transactions.filter(t => t.status === "completed").reduce((acc, t) => acc + Number(t.net_amount), 0);
    const totalWithdrawn = withdrawals.filter(w => w.status === "approved" || w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0);
    const totalChargebacksRefunds = transactions.filter(t => t.status === "chargeback" || t.status === "refunded").reduce((acc, t) => acc + Number(t.net_amount), 0);
    const totalRetained = transactions.filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0).reduce((acc, t) => acc + Number(t.retained_amount), 0);
    return { withdrawalPending: _withdrawalPending, balance: totalRevenue + balanceAdjustments - totalWithdrawn - totalChargebacksRefunds - totalRetained };
  }, [transactions, withdrawals, balanceAdjustments]);

  const chartData = useMemo(() => {
    const days = Math.max(selectedPeriod.days <= 1 ? 7 : selectedPeriod.days, 1);
    const revenueByDate = new Map<string, number>();
    for (const t of transactions) {
      if (t.status !== "completed") continue;
      const dateKey = toBrasiliaDate(t.created_at);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(t.net_amount));
    }
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(brasiliaToday());
      d.setDate(d.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const compare = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return { name: label, vendas: revenueByDate.get(compare) || 0 };
    });
  }, [transactions, selectedPeriod.days]);

  const activity = useMemo(() => {
    const tx = transactions.slice(0, 8).map((t) => ({
      id: t.id, kind: "transaction" as const, createdAt: t.created_at,
      amount: Number(t.amount), status: t.status, label: t.payment_method || "Pagamento",
    }));
    const wd = withdrawals.slice(0, 5).map((w) => ({
      id: w.id, kind: "withdrawal" as const, createdAt: w.created_at,
      amount: Number(w.amount), status: w.status, label: "Solicitação de saque",
    }));
    return [...tx, ...wd].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
  }, [transactions, withdrawals]);

  useEffect(() => {
    if (!user?.id) return;
    if (sessionStorage.getItem(`scale_mode_unlocked_${user.id}`) === "true") { setScaleModeUnlocked(true); setScaleMode(true); }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || scaleModeUnlocked) return;
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const revenue24h = transactions.filter(tx => tx.status === "completed" && new Date(tx.created_at) >= last24h).reduce((acc, tx) => acc + Number(tx.net_amount), 0);
    if (revenue24h >= 2000) {
      sessionStorage.setItem(`scale_mode_unlocked_${user.id}`, "true");
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
      {/* ─── GREEN FIRE BORDER EFFECT ─── */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-primary/40 via-primary/10 to-transparent animate-pulse" />
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-primary/60" style={{
              width: `${Math.random() * 6 + 2}px`, height: `${Math.random() * 6 + 2}px`,
              left: `${Math.random() * 100}%`, bottom: `${Math.random() * 30}%`,
              animation: `fireParticle ${1 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
            }} />
          ))}
        </div>
      )}

      {/* ─── SCALE MODE POPUP ─── */}
      {showScalePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" onClick={() => setShowScalePopup(false)} />
          <div className="relative w-full max-w-md rounded-2xl border-2 border-primary/40 bg-card shadow-2xl shadow-primary/20 animate-scale-in overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-primary/5 pointer-events-none" />
            <button onClick={() => setShowScalePopup(false)} className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center hover:bg-muted z-10">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="relative p-8 md:p-10 text-center">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center ring-4 ring-primary/10">
                <Rocket className="h-10 w-10 text-primary" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/25 px-4 py-1.5 mb-5">
                <Flame className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Modo Escala Ativado</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-black text-foreground mb-4 leading-tight">
                MODO ESCALA<br /><span className="text-gradient">ATIVADO! 🔥</span>
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed mb-6">
                <p className="font-bold text-foreground text-base">AGORA É SANGUE NOS OLHOS! 💪</p>
                <p>O futuro está lá, falta <strong className="text-foreground">VOCÊ</strong> alcançar.</p>
                <p>Estaremos <strong className="text-primary">juntos com você</strong> nessa jornada!</p>
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 mb-6 text-left">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[13px] font-bold text-foreground mb-0.5">Suporte Prioritário</p>
                    <p className="text-[11px] text-muted-foreground">Plataforma 100% disponível para você escalar.</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowScalePopup(false)} className="w-full h-11 rounded-lg gradient-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                BORA ESCALAR! 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          HEADER — Linear-style, minimal
      ═══════════════════════════════════════ */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between animate-fade-in">
        <div>
          <p className="text-[11px] font-mono font-medium text-muted-foreground tracking-wider mb-1">DASHBOARD</p>
          <h1 className="text-xl md:text-[1.75rem] font-display font-black tracking-tight text-foreground leading-none">
            {nickname ? (
              <>Olá, <span className="text-primary">{nickname}</span></>
            ) : (
              <span className="inline-block w-40 h-7 rounded-md bg-muted/30 animate-pulse" />
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {scaleModeUnlocked ? (
            <button onClick={activateScaleMode}
              className={`flame-btn group relative inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all ${
                scaleMode ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
              }`}>
              {[0,1,2,3,4].map(i => <span key={i} className="flame-tip" style={{ left:`${20+i*15}%`, width:`${3+Math.random()*3}px`, height:`${3+Math.random()*3}px`, ['--dur' as string]:`${0.6+i*0.15}s`, ['--delay' as string]:`${i*0.12}s` }} />)}
              <Flame className={`h-3 w-3 ${scaleMode ? "animate-pulse" : ""}`} />
              <span>{scaleMode ? "Escala 🔥" : "Escala"}</span>
            </button>
          ) : (
            <div className="flame-btn group relative inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold border border-border/60 bg-muted/20 text-muted-foreground cursor-not-allowed">
              {[0,1,2,3,4].map(i => <span key={i} className="flame-tip" style={{ left:`${20+i*15}%`, width:`${3+Math.random()*3}px`, height:`${3+Math.random()*3}px`, ['--dur' as string]:`${0.6+i*0.15}s`, ['--delay' as string]:`${i*0.12}s` }} />)}
              <Lock className="h-3 w-3" /><span>Escala</span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-lg bg-popover border border-border p-2.5 text-center shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                <p className="text-[10px] font-semibold text-foreground mb-0.5">🔒 Bloqueado</p>
                <p className="text-[9px] text-muted-foreground">Fature R$ 2.000 em 24h para desbloquear.</p>
              </div>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 text-xs font-medium text-foreground hover:border-border transition-all">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {selectedPeriod.label}
                <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px] rounded-lg p-1">
              {PERIOD_OPTIONS.map(opt => (
                <DropdownMenuItem key={opt.label} onClick={() => setSelectedPeriod(opt)}
                  className={`rounded-md py-1.5 text-[13px] cursor-pointer ${selectedPeriod.label === opt.label ? "bg-primary/10 text-primary font-semibold" : ""}`}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ═══ KPI STRIP — Unified row with dividers ═══ */}
      <section className="grid grid-cols-2 gap-px md:grid-cols-4 rounded-xl border border-border/60 bg-border/20 overflow-hidden animate-fade-in stagger-1">
        <MetricCell label="Receita" value={fmt(revenue)} icon={<ShoppingCart className="h-3.5 w-3.5" />} color="primary" />
        <MetricCell label="Vendas" value={String(approved.length)} icon={<TrendingUp className="h-3.5 w-3.5" />} color="info" />
        <MetricCell label="Conversão" value={`${conversion.toFixed(1)}%`} icon={<Target className="h-3.5 w-3.5" />} color="success" />
        <MetricCell label="Saldo" value={`${balance < 0 ? "- " : ""}${fmt(Math.abs(balance))}`} icon={<Wallet className="h-3.5 w-3.5" />} color={balance < 0 ? "warning" : "primary"} />
      </section>

      {/* ═══ CHART — Hero element, full-width ═══ */}
      <section className="rounded-xl border border-border/60 bg-card animate-fade-in stagger-2 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[13px] font-semibold text-foreground">Receita</h2>
            <span className="text-[10px] font-mono text-muted-foreground/70">{selectedPeriod.days <= 1 ? "7d" : `${selectedPeriod.days}d`}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-mono">líquido</span>
          </div>
        </div>
        <div className="h-[240px] md:h-[300px] px-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 16, right: 16, left: -12, bottom: 4 }}>
              <defs>
                <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.1)" fontSize={10} fontFamily="'JetBrains Mono', monospace" interval={chartData.length > 10 ? Math.ceil(chartData.length / 7) - 1 : 0} />
              <YAxis tickLine={false} axisLine={false} width={50} stroke="hsl(var(--muted-foreground) / 0.1)" fontSize={10} fontFamily="'JetBrains Mono', monospace" tickFormatter={v => `R$${v}`} />
              <Tooltip
                contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: "8px", fontSize: "11px", color: "var(--tooltip-text)", padding: "6px 10px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", fontFamily: "'JetBrains Mono', monospace" }}
                formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]}
                cursor={{ stroke: "hsl(var(--primary) / 0.15)", strokeDasharray: "3 3" }}
              />
              <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={1.5}
                fill="url(#dashboardRevenue)" dot={false}
                activeDot={{ r: 3.5, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ═══ SECONDARY STATS — 6-col tight row ═══ */}
      <section className="grid grid-cols-3 gap-2 md:grid-cols-6 animate-fade-in stagger-3">
        <StatTile label="Ticket médio" value={fmt(approved.length > 0 ? revenue / approved.length : 0)} />
        <StatTile label="Pendentes" value={String(pending.length)} />
        <StatTile label="Conv. PIX" value={`${pixConversion.toFixed(1)}%`} />
        <StatTile label="Conv. Cartão" value={`${cardConversion.toFixed(1)}%`} />
        <StatTile label="Reembolsos" value={String(refunded.length)} />
        <StatTile label="Chargebacks" value={String(chargebacks.length)} warn={chargebacks.length > 0} />
      </section>

      {/* ═══ BOTTOM — Shortcuts + Activity ═══ */}
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-5 animate-fade-in stagger-4">
        {/* Shortcuts */}
        <div className="xl:col-span-2 rounded-xl border border-border/60 bg-card p-4">
          <p className="text-[10px] font-mono font-medium text-muted-foreground tracking-wider mb-3">ATALHOS</p>
          <div className="grid grid-cols-2 gap-px">
            {[
              { label: "Produtos", href: "/vendas/produtos", icon: Package },
              { label: "Conteúdo", href: "/vendas/conteudo", icon: Layers },
              { label: "Checkout", href: "/vendas/checkout", icon: CreditCard },
              { label: "Vendas", href: "/vendas", icon: BarChart3 },
              { label: "Extrato", href: "/financeiro/extrato", icon: FileText },
              { label: "Saques", href: "/financeiro/saques", icon: ArrowDownRight },
              { label: "Webhooks", href: "/vendas/webhooks", icon: Webhook },
              { label: "Perfil", href: "/perfil", icon: User },
            ].map(a => (
              <Link key={a.href} to={a.href} className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/30 transition-colors">
                <a.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-[12px] font-medium text-foreground">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="xl:col-span-3 rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-mono font-medium text-muted-foreground tracking-wider">ATIVIDADE</p>
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            </div>
            <Link to="/financeiro/extrato" className="text-[11px] font-medium text-primary hover:underline">Ver tudo →</Link>
          </div>
          <div>
            {activity.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[13px] text-muted-foreground">Sem movimentações</p>
              </div>
            ) : activity.map((item, i) => {
              const txS: Record<string, { l: string; c: string }> = {
                completed: { l: "Pago", c: "text-success" }, pending: { l: "Pendente", c: "text-warning" },
                failed: { l: "Falha", c: "text-destructive" }, refunded: { l: "Reembolso", c: "text-info" },
                chargeback: { l: "CB", c: "text-destructive" }, default: { l: "—", c: "text-muted-foreground" },
              };
              const wdS: Record<string, { l: string; c: string }> = {
                pending: { l: "Análise", c: "text-warning" }, approved: { l: "Aprovado", c: "text-success" },
                rejected: { l: "Rejeitado", c: "text-destructive" }, default: { l: "Saque", c: "text-muted-foreground" },
              };
              const s = item.kind === "transaction" ? (txS[item.status] || txS.default) : (wdS[item.status] || wdS.default);
              return (
                <div key={item.id} className={`flex items-center gap-3 py-2 border-b border-border/20 last:border-0 animate-fade-in ${STAGGER_CLASSES[i+1]||""}`}>
                  <span className={`text-[10px] font-mono font-semibold w-[60px] shrink-0 ${s.c}`}>{s.l}</span>
                  <span className="text-[13px] font-bold text-foreground tabular-nums flex-1">{fmt(item.amount)}</span>
                  <span className="text-[10px] text-muted-foreground/60 truncate max-w-[100px] hidden md:block font-mono">{item.kind === "transaction" ? item.label : "saque"}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">{timeAgo(item.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══ Sub-components ═══ */

type CellColor = "primary" | "info" | "success" | "warning";

function MetricCell({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: CellColor }) {
  const c: Record<CellColor, string> = { primary: "text-primary", info: "text-info", success: "text-success", warning: "text-warning" };
  return (
    <div className="bg-card p-3 md:p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={c[color]}>{icon}</span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg md:text-xl font-display font-black tracking-tight text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function StatTile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card px-3 py-2.5">
      <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm md:text-base font-display font-black tracking-tight tabular-nums ${warn ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
