import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  DollarSign,
  Flame,
  Lock,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  X,
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

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function toBrasiliaDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
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

  const revenue = approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
  const gross = approved.reduce((acc, t) => acc + Number(t.amount), 0);
  const ticket = approved.length > 0 ? gross / approved.length : 0;
  const conversion = filteredTx.length > 0 ? (approved.length / filteredTx.length) * 100 : 0;

  const pixTx = filteredTx.filter((t) => t.payment_method === "pix");
  const cardTx = filteredTx.filter((t) => t.payment_method === "credit_card" || t.payment_method === "cartao");
  const boletoTx = filteredTx.filter((t) => t.payment_method === "boleto");
  const pixPaid = pixTx.filter((t) => t.status === "completed").length;
  const cardPaid = cardTx.filter((t) => t.status === "completed").length;
  const boletoPaid = boletoTx.filter((t) => t.status === "completed").length;

  const withdrawalPending = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((acc, w) => acc + Number(w.net_amount), 0);

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

  const recentSales = useMemo(() => transactions.slice(0, 5), [transactions]);
  const displayName = (profile as any)?.nickname || profile?.full_name?.split(" ")[0] || "Seller";

  return (
    <div className="space-y-6 md:space-y-8 relative">
      {/* Fire border effect */}
      {fireEffect && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-primary/40 via-primary/10 to-transparent animate-pulse" />
          <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-primary/40 via-primary/10 to-transparent animate-pulse" />
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
              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground mb-1">Suporte Prioritário Ativado</p>
                    <p className="text-xs text-muted-foreground">Qualquer ajuda para escalar, pode nos chamar!</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowScalePopup(false)} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20">
                BORA ESCALAR! 🔥
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-foreground">
            Olá, <span className="text-primary">{displayName}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Acompanhe suas vendas, performance e métricas em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Scale Mode */}
          <div className="relative group">
            {!scaleMode && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] font-semibold text-muted-foreground bg-card px-2.5 py-1 rounded-lg border border-border shadow-sm">
                  Ativa com R$ 2K/dia
                </span>
              </div>
            )}
            <button
              disabled={!scaleMode}
              className={`flame-btn relative inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-all ${
                scaleMode
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "border border-border bg-card text-muted-foreground cursor-not-allowed"
              }`}
            >
              {scaleMode && [0,1,2,3,4].map((i) => (
                <span key={i} className="flame-tip" style={{
                  left: `${20 + i * 15}%`,
                  width: `${3 + Math.random() * 3}px`,
                  height: `${3 + Math.random() * 3}px`,
                  ['--dur' as string]: `${0.6 + i * 0.15}s`,
                  ['--delay' as string]: `${i * 0.12}s`,
                }} />
              ))}
              {scaleMode ? <Flame className="h-4 w-4 animate-pulse" /> : <Lock className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{scaleMode ? "Escala 🔥" : "Escala"}</span>
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground hover:border-primary/20 transition-colors">
                <CalendarDays className="h-4 w-4 text-primary" />
                {selectedPeriod.label}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
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
      </div>

      {/* ─── KPI ROW ─── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 animate-fade-in stagger-1">
        <KpiCard icon={<DollarSign />} label="Receita Líquida" value={fmt(revenue)} accent="primary" />
        <KpiCard icon={<Target />} label="Ticket Médio" value={fmt(ticket)} accent="info" />
        <KpiCard icon={<TrendingUp />} label="Conversão" value={`${conversion.toFixed(1)}%`} accent="success" />
        <KpiCard icon={<Wallet />} label="Saques Pend." value={fmt(withdrawalPending)} accent="warning" />
      </section>

      {/* ─── CHART ─── */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 animate-fade-in stagger-2">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-bold text-foreground">Performance</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Receita líquida aprovada por dia</p>
          </div>
          <div className="text-right">
            <p className="text-2xl md:text-3xl font-display font-black text-foreground">{fmt(revenue)}</p>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Total no período</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tickLine={false} axisLine={false} dy={8} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={11} />
            <YAxis tickLine={false} axisLine={false} width={54} stroke="hsl(var(--muted-foreground) / 0.15)" fontSize={11} tickFormatter={(v) => `R$${v}`} />
            <Tooltip
              contentStyle={{
                background: "var(--tooltip-bg)",
                border: "1px solid var(--tooltip-border)",
                borderRadius: "12px",
                fontSize: "13px",
                color: "var(--tooltip-text)",
                padding: "10px 14px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              }}
              formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]}
              cursor={{ stroke: "hsl(var(--primary) / 0.12)", strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="vendas"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#revGrad)"
              dot={false}
              activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      {/* ─── BOTTOM: Payment Methods + Recent Sales ─── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12 animate-fade-in stagger-3">
        {/* Payment methods */}
        <div className="lg:col-span-4 rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-4">Meios de Pagamento</h3>
          <div className="space-y-4">
            <PaymentBar label="PIX" paid={pixPaid} total={pixTx.length} color="primary" />
            <PaymentBar label="Cartão" paid={cardPaid} total={cardTx.length} color="info" />
            <PaymentBar label="Boleto" paid={boletoPaid} total={boletoTx.length} color="warning" />
          </div>

          <div className="mt-5 pt-4 border-t border-border flex gap-3">
            <MiniStat label="Pendentes" value={pending.length} color="warning" />
            <MiniStat label="Aprovadas" value={approved.length} color="success" />
          </div>
        </div>

        {/* Recent sales */}
        <div className="lg:col-span-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">Últimas Vendas</h3>
            <Link to="/vendas" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
              Ver tudo <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">Nenhuma venda ainda</p>
          ) : (
            <div className="space-y-1">
              {recentSales.map((tx) => {
                const s = statusMap[tx.status] || statusMap.default;
                return (
                  <div key={tx.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
                      <DollarSign className={`h-4 w-4 ${s.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{tx.customer_name || "Cliente"}</p>
                      <p className="text-[11px] text-muted-foreground">{tx.payment_method || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{fmt(Number(tx.amount))}</p>
                      <p className="text-[10px] text-muted-foreground">{timeAgo(tx.created_at)}</p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold ${s.pill}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─── Sub-components ─── */

const statusMap: Record<string, { label: string; pill: string; bg: string; text: string }> = {
  completed: { label: "Aprovada", pill: "bg-success/15 text-success", bg: "bg-success/10", text: "text-success" },
  pending: { label: "Pendente", pill: "bg-warning/15 text-warning", bg: "bg-warning/10", text: "text-warning" },
  failed: { label: "Falhou", pill: "bg-destructive/15 text-destructive", bg: "bg-destructive/10", text: "text-destructive" },
  refunded: { label: "Reembolso", pill: "bg-info/15 text-info", bg: "bg-info/10", text: "text-info" },
  chargeback: { label: "Chargeback", pill: "bg-destructive/15 text-destructive", bg: "bg-destructive/10", text: "text-destructive" },
  default: { label: "—", pill: "bg-muted text-foreground", bg: "bg-muted", text: "text-foreground" },
};

type Accent = "primary" | "info" | "success" | "warning";
const accentStyles: Record<Accent, string> = {
  primary: "text-primary bg-primary/10",
  info: "text-info bg-info/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
};

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: Accent }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5 transition-all hover:border-primary/15 hover:shadow-sm group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${accentStyles[accent]} [&>svg]:h-4 [&>svg]:w-4`}>
          {icon}
        </div>
      </div>
      <p className="text-xl md:text-2xl font-display font-black tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function PaymentBar({ label, paid, total, color }: { label: string; paid: number; total: number; color: string }) {
  const pct = total > 0 ? (paid / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{paid}/{total}</span>
          <span className={`text-xs font-bold text-${color}`}>{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
        <div
          className={`h-full rounded-full bg-${color} transition-all duration-700`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex-1 rounded-xl bg-${color}/8 border border-${color}/15 p-3 text-center`}>
      <p className={`text-lg font-display font-black text-${color}`}>{value}</p>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
