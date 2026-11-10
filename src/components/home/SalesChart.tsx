import { useState } from "react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "./Money";

export interface SalesPoint { key: number; label: string; full: string; revenue: number; orders: number }

export interface SalesChartProps {
  data: SalesPoint[];
  revenue: number;
  orders: number;
  trend?: number;
  compareLabel: string;
  hidden: boolean;
  loading: boolean;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(Math.round(v)));

/** Gráfico principal: barras por período com linha de média e leitura do ponto ativo. */
export function SalesChart(p: SalesChartProps) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const values = p.data.map((d) => d[metric]);
  const nonZero = values.filter((v) => v > 0);
  const avg = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
  const empty = !p.loading && p.data.every((d) => d.revenue === 0);
  const up = (p.trend ?? 0) >= 0;

  return (
    <section className="vp-panel p-5 sm:p-6" aria-label="Vendas no período">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="vp-label">Faturamento aprovado</p>
          <div className="mt-1.5 flex items-baseline gap-3">
            <Money value={p.revenue} hidden={p.hidden} className="text-[30px] font-extrabold text-foreground" />
            {p.trend !== undefined && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold", up ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive")}>
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(p.trend)}% {p.compareLabel}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{p.orders} {p.orders === 1 ? "pedido pago" : "pedidos pagos"}</p>
        </div>
        <div role="tablist" className="flex rounded-full border border-border bg-muted p-0.5 text-[12px] font-semibold">
          {(["revenue", "orders"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)}
              className={cn("rounded-full px-3.5 py-1.5 transition-colors", metric === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              {m === "revenue" ? "Valor" : "Pedidos"}
            </button>
          ))}
        </div>
      </header>

      <div className="relative mt-5 h-[260px]">
        {p.loading ? (
          <div className="flex h-full items-end gap-1.5">{Array.from({ length: 18 }, (_, i) => <div key={i} className="vp-skel flex-1" style={{ height: `${20 + ((i * 37) % 70)}%` }} />)}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={p.data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="22%">
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => (p.hidden ? "•" : metric === "revenue" ? compact(v) : String(v))} allowDecimals={false} />
              <Tooltip cursor={{ fill: "hsl(var(--accent))", radius: 8 }} content={<ChartTip hidden={p.hidden} />} />
              {avg > 0 && <ReferenceLine y={avg} stroke="hsl(var(--foreground) / 0.35)" strokeDasharray="4 4" label={{ value: "média", position: "insideTopRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />}
              <Bar dataKey={metric} radius={[6, 6, 2, 2]} fill="hsl(var(--primary))" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {empty && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="rounded-xl bg-card/90 px-4 py-2 text-center text-[12.5px] text-muted-foreground">Nenhuma venda aprovada neste período</div>
          </div>
        )}
      </div>
    </section>
  );
}

interface TipProps { active?: boolean; payload?: Array<{ payload: SalesPoint }>; hidden: boolean }
function ChartTip({ active, payload, hidden }: TipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3.5 py-2.5 text-popover-foreground shadow-lg">
      <p className="text-[11px] font-semibold capitalize text-muted-foreground">{d.full}</p>
      <p className="mt-1 text-[15px] font-extrabold vp-num">{hidden ? "R$ ••••" : brl(d.revenue)}</p>
      <p className="text-[11.5px] text-muted-foreground">{d.orders} {d.orders === 1 ? "pedido" : "pedidos"}</p>
    </div>
  );
}
