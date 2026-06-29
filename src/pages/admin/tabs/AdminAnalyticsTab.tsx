import { useEffect, useMemo, useState } from "react";
import {
  TrendingDown, Users, Activity, Target, ArrowUpRight, ArrowDownRight, Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Line, ComposedChart,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumPanel, PremiumSegmented } from "./AdminPremium";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  withdrawals: Tables<"withdrawals">[];
  fmtCurrency: (v: number) => string;
}

type Period = "7d" | "30d" | "90d" | "ytd";
const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90, "ytd": 365 };

type AnalyticsPayload = {
  period_days: number;
  totals: {
    tx_count: number; approved: number; failed: number; refunded: number; pending: number;
    tpv: number; profit: number; active_sellers: number;
  };
  previous: { tx_count: number; approved: number; tpv: number; profit: number; active_sellers: number };
  daily: { name: string; tpv: number; profit: number; vendas: number; prev: number }[];
  methods: { method: string; total: number; approved: number; volume: number; profit: number }[];
  status_mix: { status: string; count: number }[];
  top_sellers: { user_id: string; name: string; volume: number; vendas: number }[];
  heatmap: { dow: number; hour: number; volume: number }[];
  funnel: { unique_buyers: number; repeat_buyers: number };
};

/* ── Sigma Tooltip ── */
function SigmaTooltip({ active, payload, label, fmtCurrency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 font-mono shadow-lg">
      {label && <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>}
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-black tabular-nums text-foreground">
              {typeof p.value === "number" && p.dataKey !== "vendas" && Math.abs(p.value) > 10 ? fmtCurrency(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BigMetric({ label, value, delta, sub, tone = "neutral" }: {
  label: string; value: string; delta?: number; sub?: string;
  tone?: "neutral" | "primary" | "success" | "destructive";
}) {
  const isUp = (delta ?? 0) >= 0;
  const toneCls = { neutral: "text-foreground", primary: "text-primary", success: "text-success", destructive: "text-destructive" }[tone];
  const barCls = { neutral: "bg-foreground/40", primary: "bg-primary", success: "bg-success", destructive: "bg-destructive" }[tone];
  return (
    <div className="group relative bg-card px-4 py-4 sm:px-5 sm:py-5 transition-colors hover:bg-muted/20">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
      <p className={cn("mt-2 font-display text-[22px] sm:text-[26px] font-black leading-none tabular-nums tracking-tight break-words", toneCls)}>
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[10.5px]">
        {delta !== undefined && Number.isFinite(delta) && (
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
      <span className={cn("absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100", barCls)} />
    </div>
  );
}

export default function AdminAnalyticsTab({ fmtCurrency }: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: res, error } = await (supabase as any).rpc("get_admin_analytics", {
          _period_days: PERIOD_DAYS[period],
        });
        if (error) throw error;
        if (!cancelled) setData(res as AnalyticsPayload);
      } catch (e: any) {
        toast.error("Erro ao carregar analytics: " + (e?.message ?? "desconhecido"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period]);

  const t  = data?.totals;
  const pv = data?.previous;

  const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : 0);

  const tpv         = t?.tpv ?? 0;
  const profit      = t?.profit ?? 0;
  const approved    = t?.approved ?? 0;
  const txCount     = t?.tx_count ?? 0;
  const failedTx    = t?.failed ?? 0;
  const refunded    = t?.refunded ?? 0;
  const activeSellers = t?.active_sellers ?? 0;

  const tpvDelta      = pct(tpv,         pv?.tpv         ?? 0);
  const profitDelta   = pct(profit,      pv?.profit      ?? 0);
  const sellersDelta  = pct(activeSellers, pv?.active_sellers ?? 0);

  const takeRate      = tpv > 0 ? (profit / tpv) * 100 : 0;
  const prevTakeRate  = (pv?.tpv ?? 0) > 0 ? ((pv!.profit / pv!.tpv) * 100) : 0;
  const takeRateDelta = pct(takeRate, prevTakeRate);

  const ticket        = approved > 0 ? tpv / approved : 0;
  const prevTicket    = (pv?.approved ?? 0) > 0 ? (pv!.tpv / pv!.approved) : 0;
  const ticketDelta   = pct(ticket, prevTicket);

  const conv          = txCount > 0 ? (approved / txCount) * 100 : 0;
  const prevConv      = (pv?.tx_count ?? 0) > 0 ? ((pv!.approved / pv!.tx_count) * 100) : 0;
  const convDelta     = pct(conv, prevConv);

  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    (data?.heatmap ?? []).forEach(h => {
      if (h.dow >= 0 && h.dow < 7 && h.hour >= 0 && h.hour < 24) grid[h.dow][h.hour] = Number(h.volume);
    });
    const max = Math.max(1, ...grid.flat());
    return { grid, max };
  }, [data?.heatmap]);

  const methods = useMemo(() => (data?.methods ?? []).map(m => ({
    ...m,
    method: m.method === "pix" ? "PIX" : m.method === "credit_card" ? "Cartão" : m.method === "boleto" ? "Boleto" : m.method,
    rate: m.total > 0 ? (m.approved / m.total) * 100 : 0,
  })), [data?.methods]);

  const topSellers   = data?.top_sellers ?? [];
  const statusMix    = data?.status_mix  ?? [];
  const dailySeries  = data?.daily       ?? [];
  const buyerCount   = data?.funnel?.unique_buyers ?? 0;
  const repeatBuyers = data?.funnel?.repeat_buyers ?? 0;
  const repeatRate   = buyerCount > 0 ? (repeatBuyers / buyerCount) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Admin · Analytics"
        title="Performance da Plataforma"
        subtitle={loading
          ? "Calculando métricas no servidor..."
          : `Métricas comparativas — período atual vs anterior · ${approved.toLocaleString("pt-BR")} transações aprovadas`}
        status={{ tone: tpvDelta >= 0 ? "success" : "warning", label: tpvDelta >= 0 ? "Crescimento positivo" : "Atenção", pulse: true }}
        actions={
          <PremiumSegmented<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { value: "7d", label: "7d" },
              { value: "30d", label: "30d" },
              { value: "90d", label: "90d" },
              { value: "ytd", label: "YTD" },
            ]}
          />
        }
      />

      {loading && !data ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando analytics...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-3 lg:grid-cols-6 animate-fade-in stagger-1">
            <BigMetric label="Volume"        value={fmtCurrency(tpv)}              delta={tpvDelta}      sub="vs período anterior" tone="primary" />
            <BigMetric label="Lucro"         value={fmtCurrency(profit)}           delta={profitDelta}   sub="receita líquida"     tone="success" />
            <BigMetric label="Take Rate"     value={`${takeRate.toFixed(2)}%`}     delta={takeRateDelta} sub="margem efetiva" />
            <BigMetric label="Ticket Médio"  value={fmtCurrency(ticket)}           delta={ticketDelta}   sub={`${approved.toLocaleString("pt-BR")} vendas`} />
            <BigMetric label="Conversão"     value={`${conv.toFixed(1)}%`}         delta={convDelta}     sub={`${approved.toLocaleString("pt-BR")}/${txCount.toLocaleString("pt-BR")}`} />
            <BigMetric label="Sellers Ativos" value={String(activeSellers)}        delta={sellersDelta}  sub="únicos no período" />
          </div>

          <PremiumPanel
            title="Volume diário · atual vs anterior"
            action={
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /><span className="text-muted-foreground">Atual</span></span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-muted-foreground/40" /><span className="text-muted-foreground">Anterior</span></span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" /><span className="text-muted-foreground">Lucro</span></span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dailySeries} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
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
                <Area type="monotone" dataKey="tpv"  name="Atual"    stroke="hsl(var(--primary))"          strokeWidth={2}   fill="url(#sigmaVol)" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="profit" name="Lucro"  stroke="hsl(var(--success))"          strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </PremiumPanel>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PremiumPanel title="Heatmap · dia × hora" className="lg:col-span-2">
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
            </PremiumPanel>

            <PremiumPanel title="Status das transações">
              <div className="space-y-2.5">
                {statusMix.map(({ status, count }) => {
                  const pctVal = txCount > 0 ? (count / txCount) * 100 : 0;
                  const tone = status === "approved" || status === "completed" ? "success"
                    : status === "pending" ? "warning"
                    : status === "failed" || status === "expired" ? "destructive"
                    : status === "refunded" || status === "chargeback" ? "destructive"
                    : "info";
                  const labelMap: Record<string, string> = {
                    approved: "Aprovada", completed: "Concluída", pending: "Pendente",
                    failed: "Recusada", expired: "Expirada", refunded: "Reembolsada",
                    chargeback: "Chargeback", disputed: "Em disputa",
                  };
                  const label = labelMap[status] || status;
                  const cls = { success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", info: "bg-info" }[tone];
                  const txt = { success: "text-success", warning: "text-warning", destructive: "text-destructive", info: "text-info" }[tone];
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-foreground/85">{label}</span>
                        <span className="font-mono tabular-nums">
                          <span className={cn("font-black", txt)}>{count.toLocaleString("pt-BR")}</span>
                          <span className="text-muted-foreground/60 ml-1.5">{pctVal.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-sm bg-muted/40 overflow-hidden">
                        <div className={cn("h-full transition-all", cls)} style={{ width: `${pctVal}%` }} />
                      </div>
                    </div>
                  );
                })}
                {statusMix.length === 0 && <p className="text-center text-[11px] text-muted-foreground py-6">Sem dados</p>}
              </div>
            </PremiumPanel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PremiumPanel title="Métodos de pagamento">
              <div className="overflow-x-auto">
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
                        <td className="py-2.5 text-[11px] tabular-nums text-foreground">{fmtCurrency(Number(m.volume))}</td>
                        <td className="py-2.5 text-[11px] tabular-nums text-muted-foreground">{m.approved}/{m.total}</td>
                        <td className={cn(
                          "py-2.5 text-[11px] font-black tabular-nums",
                          m.rate >= 85 ? "text-success" : m.rate >= 60 ? "text-warning" : "text-destructive"
                        )}>{m.rate.toFixed(1)}%</td>
                        <td className="py-2.5 text-[11px] tabular-nums text-success">{fmtCurrency(Number(m.profit))}</td>
                      </tr>
                    ))}
                    {methods.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-[11px] text-muted-foreground">Sem dados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </PremiumPanel>

            <PremiumPanel title="Top sellers · volume">
              {topSellers.length === 0 ? (
                <p className="text-center text-[11px] text-muted-foreground py-12">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topSellers.slice(0, 8).map(s => ({ name: s.name, volume: Number(s.volume) }))} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={120} />
                    <Tooltip content={<SigmaTooltip fmtCurrency={fmtCurrency} />} cursor={{ fill: "hsl(var(--primary) / 0.06)" }} />
                    <Bar dataKey="volume" name="Volume" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {topSellers.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "hsl(var(--success))" : i === 1 ? "hsl(var(--primary))" : "hsl(var(--info))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </PremiumPanel>
          </div>

          <PremiumPanel title="Funil & qualidade">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <FunnelStep label="Tentativas"   value={txCount.toLocaleString("pt-BR")}  icon={Activity} />
              <FunnelStep label="Aprovadas"    value={approved.toLocaleString("pt-BR")} icon={Target} tone="success" pct={txCount > 0 ? (approved / txCount) * 100 : 0} />
              <FunnelStep label="Recusadas"    value={failedTx.toLocaleString("pt-BR")} icon={TrendingDown} tone="destructive" pct={txCount > 0 ? (failedTx / txCount) * 100 : 0} />
              <FunnelStep label="Devolvidas"   value={refunded.toLocaleString("pt-BR")} icon={TrendingDown} tone="warning"     pct={txCount > 0 ? (refunded / txCount) * 100 : 0} />
              <FunnelStep label="Repeat Buyer" value={`${repeatRate.toFixed(1)}%`}      icon={Users} tone="primary" sub={`${buyerCount.toLocaleString("pt-BR")} únicos`} />
            </div>
          </PremiumPanel>
        </>
      )}
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
    <div className={cn("group relative overflow-hidden border rounded-xl p-4 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/20", toneCls)}>
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
