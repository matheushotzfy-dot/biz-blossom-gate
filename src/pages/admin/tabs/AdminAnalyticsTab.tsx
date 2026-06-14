import { useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Users, CreditCard, DollarSign, Activity,
  Layers, Target, Zap, ArrowUpRight, ArrowDownRight, Calendar,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line, ComposedChart,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  withdrawals: Tables<"withdrawals">[];
  fmtCurrency: (v: number) => string;
}

type Period = "7d" | "30d" | "90d" | "ytd";

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90, "ytd": 365 };

/* ── Sigma Tooltip ── */
function SigmaTooltip({ active, payload, label, fmtCurrency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 font-mono">
      {label && <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>}
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-black tabular-nums text-foreground">
              {typeof p.value === "number" && p.value > 100 ? fmtCurrency(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Big Metric (Sigma style) ── */
function BigMetric({ label, value, delta, sub, tone = "neutral" }: {
  label: string; value: string; delta?: number; sub?: string;
  tone?: "neutral" | "primary" | "success" | "destructive";
}) {
  const isUp = (delta ?? 0) >= 0;
  const toneCls = {
    neutral: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="border-r border-border last:border-r-0 px-5 py-4 first:pl-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
      <p className={cn("mt-2 font-display text-[26px] sm:text-[30px] font-black leading-none tabular-nums tracking-tight", toneCls)}>
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[10.5px]">
        {delta !== undefined && (
          <span className={cn(
            "inline-flex items-center gap-0.5 font-bold tabular-nums px-1.5 py-0.5 rounded",
            isUp ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
          )}>
            {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-muted-foreground/75 truncate">{sub}</span>}
      </div>
    </div>
  );
}

/* ── Sigma Panel ── */
function SigmaPanel({ title, action, children, className }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("border border-border bg-card rounded-lg overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/85">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function AdminAnalyticsTab({ transactions, profiles, products, withdrawals, fmtCurrency }: Props) {
  const [period, setPeriod] = useState<Period>("30d");

  /* ── Period slicing ── */
  const { current, previous, days } = useMemo(() => {
    const d = PERIOD_DAYS[period];
    const now = new Date();
    const start = new Date(); start.setDate(start.getDate() - d);
    const prevStart = new Date(); prevStart.setDate(prevStart.getDate() - d * 2);
    const prevEnd = new Date(start);

    return {
      days: d,
      current: transactions.filter(t => new Date(t.created_at) >= start && new Date(t.created_at) <= now),
      previous: transactions.filter(t => new Date(t.created_at) >= prevStart && new Date(t.created_at) < prevEnd),
    };
  }, [transactions, period]);

  const approved = useMemo(() => current.filter(t => t.status === "approved" || t.status === "completed"), [current]);
  const prevApproved = useMemo(() => previous.filter(t => t.status === "approved" || t.status === "completed"), [previous]);

  const tpv = approved.reduce((a, t) => a + Number(t.amount), 0);
  const prevTpv = prevApproved.reduce((a, t) => a + Number(t.amount), 0);
  const tpvDelta = prevTpv > 0 ? ((tpv - prevTpv) / prevTpv) * 100 : 0;

  const profit = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const prevProfit = prevApproved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const profitDelta = prevProfit > 0 ? ((profit - prevProfit) / prevProfit) * 100 : 0;

  const takeRate = tpv > 0 ? (profit / tpv) * 100 : 0;
  const prevTakeRate = prevTpv > 0 ? (prevProfit / prevTpv) * 100 : 0;
  const takeRateDelta = prevTakeRate > 0 ? ((takeRate - prevTakeRate) / prevTakeRate) * 100 : 0;

  const ticket = approved.length > 0 ? tpv / approved.length : 0;
  const prevTicket = prevApproved.length > 0 ? prevTpv / prevApproved.length : 0;
  const ticketDelta = prevTicket > 0 ? ((ticket - prevTicket) / prevTicket) * 100 : 0;

  const conv = current.length > 0 ? (approved.length / current.length) * 100 : 0;
  const prevConv = previous.length > 0 ? (prevApproved.length / previous.length) * 100 : 0;
  const convDelta = prevConv > 0 ? ((conv - prevConv) / prevConv) * 100 : 0;

  const activeSellers = new Set(approved.map(t => t.user_id)).size;
  const prevActiveSellers = new Set(prevApproved.map(t => t.user_id)).size;
  const sellersDelta = prevActiveSellers > 0 ? ((activeSellers - prevActiveSellers) / prevActiveSellers) * 100 : 0;

  /* ── Daily series ── */
  const daily = useMemo(() => Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = approved.filter(t => new Date(t.created_at).toDateString() === d.toDateString());
    const prevDay = new Date(d); prevDay.setDate(prevDay.getDate() - days);
    const prevDayTx = prevApproved.filter(t => new Date(t.created_at).toDateString() === prevDay.toDateString());
    return {
      name: dayStr,
      tpv: dayTx.reduce((a, t) => a + Number(t.amount), 0),
      prev: prevDayTx.reduce((a, t) => a + Number(t.amount), 0),
      profit: dayTx.reduce((a, t) => a + Number(t.fee_amount), 0),
      vendas: dayTx.length,
    };
  }), [approved, prevApproved, days]);

  /* ── Hour heatmap (7d×24h) ── */
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    approved.forEach(t => {
      const d = new Date(t.created_at);
      grid[d.getDay()][d.getHours()] += Number(t.amount);
    });
    const max = Math.max(1, ...grid.flat());
    return { grid, max };
  }, [approved]);

  /* ── Payment method breakdown ── */
  const methods = useMemo(() => {
    const m: Record<string, { total: number; approved: number; volume: number; profit: number }> = {};
    current.forEach(t => {
      const k = t.payment_method || "other";
      if (!m[k]) m[k] = { total: 0, approved: 0, volume: 0, profit: 0 };
      m[k].total++;
      if (t.status === "approved" || t.status === "completed") {
        m[k].approved++;
        m[k].volume += Number(t.amount);
        m[k].profit += Number(t.fee_amount);
      }
    });
    return Object.entries(m).map(([k, v]) => ({
      method: k === "pix" ? "PIX" : k === "credit_card" ? "Cartão" : k === "boleto" ? "Boleto" : k,
      ...v,
      rate: v.total > 0 ? (v.approved / v.total) * 100 : 0,
    })).sort((a, b) => b.volume - a.volume);
  }, [current]);

  /* ── Top sellers ── */
  const topSellers = useMemo(() => {
    const m = new Map<string, number>();
    approved.forEach(t => m.set(t.user_id, (m.get(t.user_id) || 0) + Number(t.amount)));
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([uid, vol]) => {
        const p = profiles.find(pp => pp.user_id === uid);
        return { name: p?.full_name || p?.email?.split("@")[0] || uid.slice(0, 6), volume: vol };
      });
  }, [approved, profiles]);

  /* ── Funnel: created -> approved -> repeat ── */
  const totalAttempts = current.length;
  const failedTx = current.filter(t => t.status === "failed" || t.status === "expired").length;
  const refunded = current.filter(t => t.status === "refunded" || t.status === "chargeback").length;
  const buyerSet = new Set(approved.map(t => t.customer_email).filter(Boolean));
  const buyerCount = buyerSet.size;
  const repeatBuyers = approved.filter(t => {
    const sameEmail = approved.filter(x => x.customer_email === t.customer_email);
    return sameEmail.length > 1;
  });
  const repeatRate = buyerCount > 0 ? (new Set(repeatBuyers.map(t => t.customer_email)).size / buyerCount) * 100 : 0;

  /* ── Status mix ── */
  const statusMix = useMemo(() => {
    const m: Record<string, number> = {};
    current.forEach(t => { m[t.status] = (m[t.status] || 0) + 1; });
    return Object.entries(m).map(([status, count]) => ({ status, count }));
  }, [current]);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Analytics · Sigma</p>
          <h1 className="font-display text-[28px] sm:text-[34px] font-black leading-none tracking-tight text-foreground mt-1">
            Performance da Plataforma
          </h1>
          <p className="text-[12px] text-muted-foreground/75 mt-1.5">
            Métricas comparativas — período atual vs. anterior · {approved.length} transações
          </p>
        </div>
        <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-card">
          {(["7d", "30d", "90d", "ytd"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors",
                period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "ytd" ? "YTD" : p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Big Numbers Strip ── */}
      <div className="border border-border bg-card rounded-lg">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 px-5 py-3">
          <BigMetric label="Volume" value={fmtCurrency(tpv)} delta={tpvDelta} sub="vs período anterior" tone="primary" />
          <BigMetric label="Lucro" value={fmtCurrency(profit)} delta={profitDelta} sub="receita líquida" tone="success" />
          <BigMetric label="Take Rate" value={`${takeRate.toFixed(2)}%`} delta={takeRateDelta} sub="margem efetiva" />
          <BigMetric label="Ticket Médio" value={fmtCurrency(ticket)} delta={ticketDelta} sub={`${approved.length} vendas`} />
          <BigMetric label="Conversão" value={`${conv.toFixed(1)}%`} delta={convDelta} sub={`${approved.length}/${current.length}`} />
          <BigMetric label="Sellers Ativos" value={String(activeSellers)} delta={sellersDelta} sub="únicos no período" />
        </div>
      </div>

      {/* ── Volume comparison chart ── */}
      <SigmaPanel
        title="Volume diário · atual vs anterior"
        action={
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /><span className="text-muted-foreground">Atual</span></span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-muted-foreground/40" /><span className="text-muted-foreground">Anterior</span></span>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={daily} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="sigmaVol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
            <Tooltip content={<SigmaTooltip fmtCurrency={fmtCurrency} />} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }} />
            <Area type="monotone" dataKey="prev" name="Anterior" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 3" fill="transparent" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="tpv" name="Atual" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#sigmaVol)" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="profit" name="Lucro" stroke="hsl(var(--success))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </SigmaPanel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Heatmap ── */}
        <SigmaPanel title="Heatmap · dia × hora" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-px text-[8.5px] mb-1">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center text-muted-foreground/60 font-mono">{h % 3 === 0 ? `${String(h).padStart(2, "0")}` : ""}</div>
                ))}
              </div>
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, day) => (
                <div key={day} className="grid grid-cols-[40px_repeat(24,1fr)] gap-px mb-px">
                  <div className="text-[9px] font-bold uppercase text-muted-foreground flex items-center">{label}</div>
                  {heatmap.grid[day].map((v, h) => {
                    const intensity = v / heatmap.max;
                    return (
                      <div
                        key={h}
                        title={`${label} ${h}h · ${fmtCurrency(v)}`}
                        className="aspect-square rounded-[2px] border border-border/40 transition-transform hover:scale-110"
                        style={{
                          background: intensity > 0
                            ? `hsl(var(--primary) / ${0.08 + intensity * 0.85})`
                            : "hsl(var(--muted) / 0.3)"
                        }}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="flex items-center justify-end gap-1.5 mt-3 text-[9px] text-muted-foreground/70">
                <span>Menos</span>
                {[0.1, 0.3, 0.5, 0.75, 1].map(i => (
                  <span key={i} className="h-3 w-3 rounded-[2px] border border-border/40" style={{ background: `hsl(var(--primary) / ${i})` }} />
                ))}
                <span>Mais</span>
              </div>
            </div>
          </div>
        </SigmaPanel>

        {/* ── Status Mix ── */}
        <SigmaPanel title="Status das transações">
          <div className="space-y-2.5">
            {statusMix.map(({ status, count }) => {
              const pct = current.length > 0 ? (count / current.length) * 100 : 0;
              const tone = status === "approved" || status === "completed" ? "success"
                : status === "pending" ? "warning"
                : status === "failed" || status === "expired" ? "destructive"
                : status === "refunded" || status === "chargeback" ? "destructive"
                : "info";
              const label = {
                approved: "Aprovada", completed: "Concluída", pending: "Pendente",
                failed: "Recusada", expired: "Expirada", refunded: "Reembolsada",
                chargeback: "Chargeback", disputed: "Em disputa",
              }[status] || status;
              const cls = {
                success: "bg-success", warning: "bg-warning",
                destructive: "bg-destructive", info: "bg-info",
              }[tone];
              const txt = {
                success: "text-success", warning: "text-warning",
                destructive: "text-destructive", info: "text-info",
              }[tone];
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-foreground/85">{label}</span>
                    <span className="font-mono tabular-nums">
                      <span className={cn("font-black", txt)}>{count}</span>
                      <span className="text-muted-foreground/60 ml-1.5">{pct.toFixed(1)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-sm bg-muted/40 overflow-hidden">
                    <div className={cn("h-full transition-all", cls)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {statusMix.length === 0 && <p className="text-center text-[11px] text-muted-foreground py-6">Sem dados</p>}
          </div>
        </SigmaPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Payment methods ── */}
        <SigmaPanel title="Métodos de pagamento">
          <table className="w-full font-mono">
            <thead>
              <tr className="border-b border-border">
                {["Método", "Volume", "Vendas", "Aprov.", "Lucro"].map(h => (
                  <th key={h} className="text-left py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {methods.map(m => (
                <tr key={m.method} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="py-2.5 text-[12px] font-bold text-foreground">{m.method}</td>
                  <td className="py-2.5 text-[11px] tabular-nums text-foreground">{fmtCurrency(m.volume)}</td>
                  <td className="py-2.5 text-[11px] tabular-nums text-muted-foreground">{m.approved}/{m.total}</td>
                  <td className={cn(
                    "py-2.5 text-[11px] font-black tabular-nums",
                    m.rate >= 85 ? "text-success" : m.rate >= 60 ? "text-warning" : "text-destructive"
                  )}>{m.rate.toFixed(1)}%</td>
                  <td className="py-2.5 text-[11px] tabular-nums text-success">{fmtCurrency(m.profit)}</td>
                </tr>
              ))}
              {methods.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-[11px] text-muted-foreground">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </SigmaPanel>

        {/* ── Top sellers ── */}
        <SigmaPanel title="Top sellers · volume">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topSellers} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
              <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={120} />
              <Tooltip content={<SigmaTooltip fmtCurrency={fmtCurrency} />} cursor={{ fill: "hsl(var(--primary) / 0.06)" }} />
              <Bar dataKey="volume" name="Volume" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {topSellers.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "hsl(var(--success))" : i === 1 ? "hsl(var(--primary))" : "hsl(var(--info))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SigmaPanel>
      </div>

      {/* ── Funnel KPIs ── */}
      <SigmaPanel title="Funil & qualidade">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <FunnelStep label="Tentativas" value={String(totalAttempts)} icon={Activity} />
          <FunnelStep label="Aprovadas" value={String(approved.length)} icon={Target} tone="success" pct={totalAttempts > 0 ? (approved.length / totalAttempts) * 100 : 0} />
          <FunnelStep label="Recusadas" value={String(failedTx)} icon={TrendingDown} tone="destructive" pct={totalAttempts > 0 ? (failedTx / totalAttempts) * 100 : 0} />
          <FunnelStep label="Devolvidas" value={String(refunded)} icon={TrendingDown} tone="warning" pct={totalAttempts > 0 ? (refunded / totalAttempts) * 100 : 0} />
          <FunnelStep label="Repeat Buyer" value={`${repeatRate.toFixed(1)}%`} icon={Users} tone="primary" sub={`${buyerCount} únicos`} />
        </div>
      </SigmaPanel>
    </div>
  );
}

function FunnelStep({ label, value, icon: Icon, tone = "neutral", pct, sub }: {
  label: string; value: string; icon: any;
  tone?: "neutral" | "success" | "destructive" | "warning" | "primary";
  pct?: number; sub?: string;
}) {
  const toneCls = {
    neutral: "text-foreground border-border",
    success: "text-success border-success/30",
    destructive: "text-destructive border-destructive/30",
    warning: "text-warning border-warning/30",
    primary: "text-primary border-primary/30",
  }[tone];
  return (
    <div className={cn("border rounded-md p-3.5", toneCls)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">{label}</span>
        <Icon className="h-3.5 w-3.5 opacity-60" />
      </div>
      <p className={cn("font-display text-[22px] font-black leading-none tabular-nums", toneCls.split(" ")[0])}>{value}</p>
      {pct !== undefined && <p className="text-[10px] text-muted-foreground/75 mt-1.5 font-mono tabular-nums">{pct.toFixed(1)}% do total</p>}
      {sub && <p className="text-[10px] text-muted-foreground/75 mt-1.5">{sub}</p>}
    </div>
  );
}
