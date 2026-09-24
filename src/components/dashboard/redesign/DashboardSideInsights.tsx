import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import type { DashboardChartPoint } from "./DashboardRevenueChart";

interface DashboardSideInsightsProps {
  chartData: DashboardChartPoint[];
  chartTickFormatter: (value: number) => string;
  pixConversion: number;
  chargebackRate: number;
  onPaymentLinkClick: () => void;
}

export function DashboardSideInsights({ chartData, chartTickFormatter, pixConversion, chargebackRate, onPaymentLinkClick }: DashboardSideInsightsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
      <section className="dashboard-data-panel rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-base font-bold text-foreground">Pedidos</h2>
        <p className="mt-1 text-xs text-muted-foreground">Volume no período selecionado</p>
        <div className="mt-5 h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="timestamp" tickFormatter={chartTickFormatter} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} minTickGap={18} />
              <Tooltip cursor={{ fill: "hsl(var(--accent))" }} content={({ active, payload }) => active && payload?.[0] ? (
                <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-foreground">{Number(payload[0].value ?? 0)} pedidos</div>
              ) : null} />
              <Bar dataKey="pedidos" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="dashboard-data-panel rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Formas de pagamento</h2>
            <p className="mt-1 text-xs text-muted-foreground">Desempenho da operação</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onPaymentLinkClick} className="text-xs text-primary">Links</Button>
        </div>
        <div className="mt-5 space-y-5">
          <MetricBar label="Conversão PIX" value={pixConversion} />
          <MetricBar label="Taxa de estorno" value={chargebackRate} inverse />
        </div>
      </section>
    </div>
  );
}

function MetricBar({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const width = Math.max(2, Math.min(100, value));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-numbers font-bold tabular-nums text-foreground">{value.toFixed(1)}%</span>
      </div>
      <progress
        className={inverse && value >= 1 ? "dashboard-progress dashboard-progress-danger" : "dashboard-progress"}
        value={width}
        max={100}
        aria-label={`${label}: ${value.toFixed(1)}%`}
      />
    </div>
  );
}
