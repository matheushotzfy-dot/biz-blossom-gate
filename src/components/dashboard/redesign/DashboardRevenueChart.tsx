import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface DashboardChartPoint {
  timestamp: number;
  vendas: number;
  pedidos: number;
  fullLabel: string;
  granularity: "hour" | "day" | "month";
}

interface DashboardRevenueChartProps {
  chartData: DashboardChartPoint[];
  chartTicks: number[];
  chartTickFormatter: (value: number) => string;
  revenue: number;
  periodLabel: string;
  formatCurrency: (value: number) => string;
}

export function DashboardRevenueChart({ chartData, chartTicks, chartTickFormatter, revenue, periodLabel, formatCurrency }: DashboardRevenueChartProps) {
  const firstTimestamp = chartData[0]?.timestamp ?? 0;
  const lastTimestamp = chartData[chartData.length - 1]?.timestamp ?? firstTimestamp;

  return (
    <div className="min-w-0 overflow-hidden border-b border-border lg:border-b-0 lg:border-r">
      <header className="flex items-start justify-between gap-4 px-5 pb-1 pt-5 sm:px-6 sm:pt-6">
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Faturamento</h2>
          <p className="mt-1 text-xs text-muted-foreground">Receita aprovada por {periodLabel.toLowerCase()}</p>
        </div>
        <p className="font-numbers text-lg font-bold tabular-nums text-foreground">{formatCurrency(revenue)}</p>
      </header>
      <div className="h-[280px] w-full px-2 pb-3 pt-4 sm:h-[340px] sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
            <XAxis dataKey="timestamp" type="number" scale="time" domain={[firstTimestamp, lastTimestamp]} ticks={chartTicks} tickFormatter={chartTickFormatter} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} dy={10} minTickGap={12} />
            <YAxis width={52} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(value) => Number(value) >= 1000 ? `R$ ${Math.round(Number(value) / 1000)}k` : `R$ ${value}`} />
            <Tooltip cursor={{ stroke: "hsl(var(--primary))", strokeDasharray: "4 4" }} content={({ active, payload }) => active && payload?.[0] ? (
              <div className="rounded-md border border-border bg-popover px-3 py-2">
                <p className="text-xs text-muted-foreground">{payload[0].payload.fullLabel}</p>
                <p className="mt-1 font-numbers text-sm font-bold tabular-nums text-foreground">{formatCurrency(Number(payload[0].value ?? 0))}</p>
              </div>
            ) : null} />
            <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#dashboardRevenueFill)" dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
