import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "framer-motion";

export interface SalesPoint { key: number; label: string; full: string; revenue: number; orders: number }
export type ChartBucket = "hour" | "day" | "month";

export interface RevenueChartProps {
  data: SalesPoint[];
  bucket: ChartBucket;
  hidden: boolean;
  loading: boolean;
  /** Chip de período (abre o seletor de datas). */
  action: ReactNode;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(Math.round(v)));
const PER: Record<ChartBucket, string> = { hour: "por hora", day: "por dia", month: "por mês" };
const INK = "hsl(var(--muted-foreground))";

/**
 * Faturamento aprovado — título, subtítulo, chip de período e uma única área.
 * Os valores aparecem só no tooltip (decisão de produto: gráfico limpo, sem totais).
 */
export function RevenueChart(p: RevenueChartProps) {
  const reduced = useReducedMotion() ?? false;
  const empty = !p.loading && p.data.every((d) => d.revenue === 0);
  const peakIdx = empty ? -1 : p.data.reduce((best, d, i) => (d.revenue > (p.data[best]?.revenue ?? 0) ? i : best), 0);
  const peak = peakIdx >= 0 ? p.data[peakIdx] : null;
  const flipLeft = peakIdx > p.data.length * 0.78;

  return (
    <section className="vp-sheet p-6 sm:p-7" aria-label="Faturamento aprovado">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-extrabold tracking-[-0.025em] text-foreground">Faturamento aprovado</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">Vendas pagas {PER[p.bucket]}</p>
        </div>
        {p.action}
      </header>

      <div className="relative mt-6 h-[300px] sm:h-[330px]">
        {p.loading ? <div className="vp-skel h-full w-full" /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={p.data} margin={{ top: 46, right: 12, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="vpAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} tick={{ fontSize: 12, fill: INK }} dy={10} />
              <YAxis
                tickLine={false} axisLine={false} width={56} allowDecimals={false}
                domain={empty ? [0, 100] : [0, "auto"]} tickCount={5}
                tick={{ fontSize: 12, fill: INK }} tickFormatter={(v: number) => (p.hidden ? "•" : compact(v))}
              />
              <Tooltip cursor={{ stroke: "hsl(var(--primary) / .4)", strokeDasharray: "3 4" }} content={<Tip hidden={p.hidden} />} />
              <Area
                type="monotone" dataKey="revenue" stroke={empty ? "hsl(var(--primary) / .4)" : "hsl(var(--primary))"} strokeWidth={empty ? 2 : 3} fill="url(#vpAreaFill)"
                isAnimationActive={!reduced} animationDuration={900} animationEasing="ease-out"
                dot={false} activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 3 }}
              />
              {peak && (
                <ReferenceDot
                  x={peak.label} y={peak.revenue} ifOverflow="extendDomain"
                  shape={(s: { cx?: number; cy?: number }) => <PeakMark cx={s.cx ?? 0} cy={s.cy ?? 0} text={p.hidden ? "Pico" : brl(peak.revenue)} flip={flipLeft} />}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}

        {empty && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center pb-8">
            <div className="rounded-2xl border border-border bg-card/95 px-5 py-3.5 text-center shadow-[0_12px_32px_-18px_hsl(222_47%_11%/.35)]">
              <p className="text-[14px] font-bold text-foreground">Nenhuma venda aprovada neste período</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">Quando você vender, a curva aparece aqui.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Marca do melhor ponto do período: bolinha com aro e o valor numa etiqueta. */
function PeakMark({ cx, cy, text, flip }: { cx: number; cy: number; text: string; flip: boolean }) {
  const w = Math.max(64, text.length * 8 + 22);
  const x = flip ? cx - w + 14 : cx - 14;
  return (
    <g pointerEvents="none">
      <rect x={x} y={cy - 40} width={w} height={26} rx={13} fill="hsl(var(--foreground))" />
      <text x={x + w / 2} y={cy - 23} textAnchor="middle" fontSize={12} fontWeight={700} fill="hsl(var(--background))">{text}</text>
      <circle cx={cx} cy={cy} r={9} fill="hsl(var(--primary) / .18)" />
      <circle cx={cx} cy={cy} r={5.5} fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth={2.5} />
    </g>
  );
}

function Tip({ active, payload, hidden }: { active?: boolean; payload?: Array<{ payload: SalesPoint }>; hidden: boolean }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-2xl border border-border bg-popover px-4 py-3 text-popover-foreground shadow-[0_18px_40px_-18px_hsl(222_47%_11%/.35)]">
      <p className="text-[12px] font-semibold capitalize text-muted-foreground">{d.full}</p>
      <p className="mt-1 text-[18px] font-extrabold tracking-[-0.03em] vp-num">{hidden ? "R$ ••••" : brl(d.revenue)}</p>
      <p className="text-[12.5px] text-muted-foreground">{d.orders} {d.orders === 1 ? "pedido pago" : "pedidos pagos"}</p>
    </div>
  );
}
