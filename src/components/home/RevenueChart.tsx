import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "./Money";

export interface SalesPoint { key: number; label: string; full: string; revenue: number; orders: number }
export interface RangeOption { id: string; label: string }

export interface RevenueChartProps {
  data: SalesPoint[];
  revenue: number;
  orders: number;
  trend?: number;
  hidden: boolean;
  loading: boolean;
  ranges: RangeOption[];
  activeRange: string | null;
  onRange: (id: string) => void;
  extra?: React.ReactNode;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(Math.round(v)));

/** Faturamento aprovado: linha luminosa com área em degradê e leitura por ponto. */
export function RevenueChart(p: RevenueChartProps) {
  const up = (p.trend ?? 0) >= 0;
  const empty = !p.loading && p.data.every((d) => d.revenue === 0);
  const last = [...p.data].reverse().find((d) => d.revenue > 0);

  return (
    <section className="vp-glass p-6" aria-label="Faturamento">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[14px] text-muted-foreground">Faturamento aprovado</p>
          <Money value={p.revenue} hidden={p.hidden} className="mt-1 block text-[34px] font-extrabold leading-none text-foreground" centsClassName="opacity-100" />
          <p className="mt-2 flex items-center gap-3 text-[13px]">
            {p.trend !== undefined && <span className={cn("inline-flex items-center gap-1 font-semibold", up ? "vp-glow-text" : "text-destructive")}>{up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{up ? "+" : "−"}{Math.abs(p.trend)}% vs período anterior</span>}
            <span className="text-muted-foreground">{p.orders} {p.orders === 1 ? "pedido pago" : "pedidos pagos"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" className="flex rounded-full bg-muted p-1 text-[12.5px] font-semibold">
            {p.ranges.map((r) => (
              <button key={r.id} role="tab" aria-selected={p.activeRange === r.id} onClick={() => p.onRange(r.id)}
                className={cn("rounded-full px-3.5 py-1.5 transition-colors", p.activeRange === r.id ? "bg-secondary text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
                {r.label}
              </button>
            ))}
          </div>
          {p.extra}
        </div>
      </header>

      <div className="relative mt-6 h-[300px]">
        {p.loading ? <div className="vp-skel h-full w-full" /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={p.data} margin={{ top: 16, right: 14, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="vpNoirArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--vp-glow))" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="hsl(var(--vp-glow))" stopOpacity={0} />
                </linearGradient>
                <filter id="vpNoirGlow" x="-10%" y="-50%" width="120%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <CartesianGrid vertical stroke="hsl(var(--border))" strokeDasharray="0" horizontal={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={8} />
              <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => (p.hidden ? "•" : compact(v))} allowDecimals={false} />
              <Tooltip cursor={{ stroke: "hsl(var(--vp-glow) / .5)", strokeDasharray: "3 3" }} content={<Tip hidden={p.hidden} />} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--vp-glow))" strokeWidth={2.5} fill="url(#vpNoirArea)" filter="url(#vpNoirGlow)" isAnimationActive={false}
                dot={false} activeDot={{ r: 6, fill: "hsl(var(--vp-glow))", stroke: "hsl(var(--background))", strokeWidth: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {empty && <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className="rounded-full border border-border bg-card px-4 py-2 text-[12.5px] text-muted-foreground">Nenhuma venda aprovada neste período</span></div>}
        {!empty && last && !p.hidden && (
          <div className="pointer-events-none absolute right-4 top-0 rounded-xl border border-border bg-card px-3 py-2 text-right">
            <p className="text-[13px] font-bold text-foreground vp-num">{brl(last.revenue)}</p>
            <p className="text-[11px] text-muted-foreground">{last.label}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Tip({ active, payload, hidden }: { active?: boolean; payload?: Array<{ payload: SalesPoint }>; hidden: boolean }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3.5 py-2.5 text-popover-foreground shadow-2xl">
      <p className="text-[11px] font-semibold capitalize text-muted-foreground">{d.full}</p>
      <p className="mt-1 text-[15px] font-extrabold vp-num">{hidden ? "R$ ••••" : brl(d.revenue)}</p>
      <p className="text-[11.5px] text-muted-foreground">{d.orders} {d.orders === 1 ? "pedido" : "pedidos"}</p>
    </div>
  );
}
