import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CreditCard,
  DollarSign,
  Flame,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
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

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function toBrasiliaDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function brasiliaToday() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>(PERIOD_OPTIONS[0]);
  const [scaleMode, setScaleMode] = useState(false);
  const [showScalePopup, setShowScalePopup] = useState(false);
  const [fireEffect, setFireEffect] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> & { nickname?: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    ]).then(([txRes, wdRes, profileRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (wdRes.data) setWithdrawals(wdRes.data);
      if (profileRes.data) setProfile(profileRes.data as any);
    });
  }, [user?.id]);

  const todayRevenue = useMemo(() => {
    const todayStr = brasiliaToday().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return transactions
      .filter((t) => t.status === "completed" && toBrasiliaDate(t.created_at) === todayStr)
      .reduce((acc, t) => acc + Number(t.net_amount), 0);
  }, [transactions]);

  useEffect(() => {
    if (todayRevenue >= 2000 && !scaleMode) {
      setFireEffect(true);
      setTimeout(() => { setShowScalePopup(true); setScaleMode(true); }, 800);
      setTimeout(() => setFireEffect(false), 3000);
    }
  }, [todayRevenue, scaleMode]);

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

  const approved = filteredTx.filter((t) => t.status === "completed");
  const pending = filteredTx.filter((t) => t.status === "pending");
  const refunded = filteredTx.filter((t) => t.status === "refunded");
  const chargebacks = filteredTx.filter((t) => t.status === "chargeback");

  const revenue = approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
  const gross = approved.reduce((acc, t) => acc + Number(t.amount), 0);
  const ticket = approved.length > 0 ? gross / approved.length : 0;
  const conversion = filteredTx.length > 0 ? (approved.length / filteredTx.length) * 100 : 0;
  const riskCount = refunded.length + chargebacks.length;
  const quality = approved.length > 0 ? Math.max(0, 100 - (riskCount / approved.length) * 100) : 100;
  const uniqueCustomers = new Set(filteredTx.map(t => t.customer_email).filter(Boolean)).size;

  const withdrawalPending = withdrawals.filter((w) => w.status === "pending");
  const withdrawalPendingAmount = withdrawalPending.reduce((acc, w) => acc + Number(w.net_amount), 0);
  const totalNetEarned = transactions.filter(t => t.status === "completed").reduce((acc, t) => acc + Number(t.net_amount), 0);
  const totalWithdrawn = withdrawals.filter(w => w.status === "approved" || w.status === "completed").reduce((acc, w) => acc + Number(w.amount), 0);
  const availableBalance = Math.max(0, totalNetEarned - totalWithdrawn - withdrawalPendingAmount);

  const chartData = useMemo(() => {
    const days = Math.max(selectedPeriod.days <= 1 ? 7 : selectedPeriod.days, 1);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(brasiliaToday());
      d.setDate(d.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const compare = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const amount = transactions
        .filter((t) => toBrasiliaDate(t.created_at) === compare && t.status === "completed")
        .reduce((acc, t) => acc + Number(t.net_amount), 0);
      return { name: label, vendas: amount };
    });
  }, [transactions, selectedPeriod.days]);

  const displayName = (profile as any)?.nickname || profile?.full_name?.split(" ")[0] || "Seller";

  const pixAll = filteredTx.filter(t => t.payment_method === "pix");
  const pixOk = pixAll.filter(t => t.status === "completed").length;
  const pixConv = pixAll.length > 0 ? (pixOk / pixAll.length) * 100 : 0;

  return (
    <div className="space-y-4 relative animate-fade-in">
      {/* Fire border effect */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent animate-pulse" />
        </div>
      )}

      {/* Scale mode popup */}
      {showScalePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" onClick={() => setShowScalePopup(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-primary/30 bg-card shadow-2xl shadow-primary/20 animate-scale-in overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-primary/5 pointer-events-none" />
            <button onClick={() => setShowScalePopup(false)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted z-10">
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
              <h2 className="text-2xl md:text-3xl font-display font-black text-foreground mb-3">
                MODO ESCALA<br /><span className="text-gradient">ATIVADO! 🔥</span>
              </h2>
              <p className="text-sm text-muted-foreground mb-2">SANGUE NOS OLHOS! 💪</p>
              <p className="text-sm text-muted-foreground mb-6">Estaremos <strong className="text-primary">juntos com você</strong> nessa jornada!</p>
              <button onClick={() => setShowScalePopup(false)} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20">
                BORA ESCALAR! 🔥
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-primary font-display font-bold text-sm">Olá, {displayName}</span>
            <Sparkles className="h-3.5 w-3.5 text-primary/60" />
          </div>
          <h1 className="text-xl md:text-2xl font-display font-black tracking-tight text-foreground">
            Command Center
          </h1>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-xs font-semibold text-foreground hover:border-primary/20 transition-colors">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {selectedPeriod.label}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px] rounded-xl p-1">
            {PERIOD_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.label}
                onClick={() => setSelectedPeriod(option)}
                className={`rounded-lg py-2 text-sm cursor-pointer ${selectedPeriod.label === option.label ? "bg-primary/10 text-primary font-semibold" : ""}`}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ═══ CHART (PRIORITY — TOP) ═══ */}
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-display font-bold text-foreground">Performance de Receita</h2>
              <p className="text-[10px] text-muted-foreground">Vendas aprovadas no período</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg md:text-xl font-display font-black text-foreground">{fmt(revenue)}</p>
            <p className="text-[10px] text-muted-foreground">{approved.length} aprovadas</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={10} />
            <YAxis tickLine={false} axisLine={false} width={50} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={10} tickFormatter={(v) => `R$${v}`} />
            <Tooltip
              contentStyle={{
                background: "var(--tooltip-bg)",
                border: "1px solid var(--tooltip-border)",
                borderRadius: "12px",
                fontSize: "12px",
                color: "var(--tooltip-text)",
                padding: "8px 12px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              }}
              formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]}
              cursor={{ stroke: "hsl(var(--primary) / 0.12)", strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="vendas"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#revGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ═══ KPI GRID — 3 cols clean ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Receita Líquida" value={fmt(revenue)} accent />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Faturamento Bruto" value={fmt(gross)} />
        <KpiCard icon={<CreditCard className="h-4 w-4" />} label="Ticket Médio" value={fmt(ticket)} />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Conversão" value={`${conversion.toFixed(1)}%`} />
        <KpiCard icon={<ShieldCheck className="h-4 w-4" />} label="Qualidade" value={`${quality.toFixed(1)}%`} />
        <KpiCard icon={<Users className="h-4 w-4" />} label="Clientes" value={String(uniqueCustomers)} />
      </div>

      {/* ═══ BOTTOM ROW — Saldo + Saúde ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Saldo */}
        <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Financeiro</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saldo Disponível</span>
              <p className="text-xl md:text-2xl font-display font-black text-foreground mt-1">{fmt(availableBalance)}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saques Pendentes</span>
              <p className="text-xl md:text-2xl font-display font-black text-foreground mt-1">{fmt(withdrawalPendingAmount)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{withdrawalPending.length} solicitações</p>
            </div>
          </div>
        </div>

        {/* Saúde Operacional */}
        <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Saúde Operacional</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Aprovadas" value={approved.length} color="text-primary" />
            <MiniStat label="Pendentes" value={pending.length} color="text-warning" />
            <MiniStat label="Reembolsos" value={refunded.length} color="text-info" />
            <MiniStat label="Chargebacks" value={chargebacks.length} color="text-destructive" />
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conv. PIX</span>
              <span className="text-xs font-bold text-primary">{pixConv.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.max(pixConv, 1)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-3.5 md:p-4 transition-all hover:border-primary/15 ${accent ? "border-primary/20" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${accent ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"}`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg md:text-xl font-display font-black tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-display font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
    </div>
  );
}
