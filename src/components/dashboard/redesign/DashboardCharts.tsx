import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell, PieChart, Pie } from "recharts";
import { cn } from "@/lib/utils";

interface DashboardChartsProps {
  chartData: any[];
  chartTicks: number[];
  chartTickFormatter: (v: number) => string;
  pixConversion: number;
  chargebackRate: number;
  periodLabel: string;
  isCustom: boolean;
  formatCurrency: (v: number) => string;
  onPaymentLinkClick: () => void;
}

export function DashboardCharts({
  chartData,
  chartTicks,
  chartTickFormatter,
  pixConversion,
  chargebackRate,
  periodLabel,
  isCustom,
  formatCurrency,
  onPaymentLinkClick,
}: DashboardChartsProps) {
  const donutPix = useMemo(() => [{ name: "on", value: pixConversion }, { name: "off", value: Math.max(0, 100 - pixConversion) }], [pixConversion]);
  const donutChb = useMemo(() => [{ name: "on", value: chargebackRate }, { name: "off", value: Math.max(0, 100 - chargebackRate) }], [chargebackRate]);

  return (
    <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Faturamento — Clean line chart */}
      <div className="xl:col-span-2 overflow-hidden rounded-[24px] border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-6 py-5 md:px-8">
          <div className="min-w-0">
            <h4 className="font-display font-bold text-xl tracking-[-0.02em] text-foreground">Faturamento</h4>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Comparativo de entradas e saídas</p>
          </div>
          <span className="shrink-0 rounded-[10px] border border-border/60 bg-background px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {isCustom ? "Período personalizado" : periodLabel}
          </span>
        </div>

        <div className="h-[300px] w-full pr-4 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 14, right: 8, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                  <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border)/0.28)" />
              <XAxis 
                dataKey="timestamp" 
                type="number" 
                scale="time"
                domain={[chartData[0]?.timestamp ?? 0, chartData[chartData.length - 1]?.timestamp ?? 0]}
                ticks={chartTicks} 
                tickFormatter={chartTickFormatter}
                axisLine={false} 
                tickLine={false}
                tick={{
                  fill: "hsl(var(--muted-foreground)/0.7)",
                  fontSize: chartData[0]?.granularity === "hour" ? 9 : 11,
                  fontWeight: 500,
                }}
                dy={10} 
                interval={0}
                minTickGap={chartData[0]?.granularity === "hour" ? -1 : 5}
                padding={{ left: 6, right: 6 }}
              />
              <YAxis 
                width={52} 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground)/0.55)", fontSize: 10, fontWeight: 500 }}
                tickFormatter={(v) => Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : `${v}`}
              />
              <Tooltip 
                cursor={{ stroke: "hsl(var(--primary)/0.45)", strokeWidth: 1, strokeDasharray: "4 4" }} 
                wrapperStyle={{ outline: "none" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const p = payload[0];
                    return (
                      <div className="rounded-[10px] border border-border bg-card px-3.5 py-2.5">
                        <p className="text-[10px] font-medium text-muted-foreground/70 mb-1">{p.payload.fullLabel}</p>
                        <p className="text-foreground font-display font-bold text-[14px] tabular-nums">{formatCurrency(p.value as number)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="vendas" 
                stroke="url(#revStroke)" 
                strokeWidth={2.5} 
                fill="url(#revGrad)"
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2.5 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Right side: donuts + links */}
      <div className="space-y-4">
         <div className="rounded-[24px] border border-border bg-card p-7">
          <div className="mb-6">
            <h4 className="font-display font-bold text-xl tracking-[-0.02em]">Índices</h4>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Conversão por método de pagamento</p>
          </div>
          <div className="space-y-5">
            {/* Pix */}
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutPix} dataKey="value" innerRadius={22} outerRadius={30} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                      <Cell fill="hsl(var(--primary))" />
                      <Cell fill="hsl(var(--muted)/0.6)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center font-display font-black text-[12px] tabular-nums">{pixConversion.toFixed(0)}%</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[14px]">Pix</p>
                <p className="text-[11px] text-muted-foreground/70">Conversão</p>
              </div>
            </div>
            {/* Chargeback */}
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutChb} dataKey="value" innerRadius={22} outerRadius={30} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                      <Cell fill={chargebackRate < 1 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                      <Cell fill="hsl(var(--muted)/0.6)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center font-display font-black text-[12px] tabular-nums">{chargebackRate.toFixed(1)}%</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[14px]">Taxa de estorno</p>
                <p className="text-[11px] text-muted-foreground/70">Saúde da conta{" "}
                  <span className={cn("ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold", chargebackRate < 1 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")}>
                    {chargebackRate < 1 ? "Excelente" : "Atenção"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <button 
          type="button" 
          onClick={onPaymentLinkClick}
          className="group block w-full rounded-[24px] border border-border bg-card p-7 text-left transition-colors duration-300 hover:border-primary/35 hover:bg-card-elevated"
        >
          <h4 className="font-display font-bold text-lg tracking-[-0.02em]">Links de Pagamento</h4>
          <p className="text-[11px] text-muted-foreground/60 mt-1 mb-4">Crie e gerencie seus links</p>
          <div className="flex items-center gap-2 text-primary font-bold text-[12px]">
            Acessar agora
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </div>
        </button>
      </div>
    </section>
  );
}
