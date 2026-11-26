import { useState } from "react";
import { AreaChart, Area, BarChart, Bar, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import type { OverviewMetrics } from "./overviewModel";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const compact = (value: number) => value.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
type Metric = "gross" | "sales" | "profit";
const names: Record<string, string> = { gross: "Movimentado", sales: "Vendas", profit: "Resultado após adquirente", fees: "Taxas arrecadadas", acquirer: "Custo da adquirente" };
interface ChartTipProps { active?: boolean; label?: string | number; payload?: Array<{ dataKey?: string; value?: number; payload?: Record<string, unknown> }>; hourly?: boolean }
function ChartTip({ active, payload, label, hourly }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const keys = hourly ? ["gross", "sales", "profit"] : payload.map(p => p.dataKey ?? "gross");
  return <div className="rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground">
    <p className="mb-2 font-semibold">{hourly ? `${label}h` : label}</p>
    {keys.map(key => <p key={key} className="flex justify-between gap-6 py-1"><span>{names[key]}</span><strong className="tabular-nums">{key === "sales" ? Number(row?.[key] ?? 0).toLocaleString("pt-BR") : money(Number(row?.[key] ?? 0))}</strong></p>)}
  </div>;
}
function MetricSwitch({ value, onChange }: { value: Metric; onChange: (value: Metric) => void }) {
  return <div className="flex flex-wrap gap-1">{(["gross", "sales", "profit"] as const).map(key => <Button key={key} size="sm" variant={value === key ? "secondary" : "ghost"} onClick={() => onChange(key)} className="h-8 text-xs">{key === "profit" ? "Resultado" : names[key]}</Button>)}</div>;
}
export function OverviewCharts({ data }: { data: OverviewMetrics }) {
  const [pulseMetric, setPulseMetric] = useState<Metric>("gross");
  const [hourMetric, setHourMetric] = useState<Metric>("gross");
  const daily = data.daily.map(row => ({ ...row, label: `${row.day.slice(8, 10)}/${row.day.slice(5, 7)}` }));
  return <div className="space-y-5">
    <PremiumPanel title="Pulso de volume" eyebrow={`${data.from.split("-").reverse().join("/")} — ${data.to.split("-").reverse().join("/")}`} action={<MetricSwitch value={pulseMetric} onChange={setPulseMetric} />}>
      <div className="h-[280px] min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily} margin={{ left: 0, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" minTickGap={32} fontSize={12} stroke="hsl(var(--muted-foreground))" />
        <YAxis width={55} tickFormatter={compact} allowDecimals={pulseMetric !== "sales"} fontSize={12} stroke="hsl(var(--muted-foreground))" />
        <Tooltip content={<ChartTip />} />
        <Area type="monotone" dataKey={pulseMetric} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
        {daily.length > 14 && <Brush dataKey="label" height={25} stroke="hsl(var(--primary))" fill="hsl(var(--card))" travellerWidth={8} />}
      </AreaChart></ResponsiveContainer></div>
    </PremiumPanel>
    <div className="grid gap-5 xl:grid-cols-2">
      <PremiumPanel title="Volume por horário" eyebrow="Horários de Brasília · soma do período" action={<MetricSwitch value={hourMetric} onChange={setHourMetric} />}>
        <div className="h-[250px] min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.hourly} margin={{ left: 0, right: 8 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="hour" tickFormatter={h => `${h}h`} interval={2} fontSize={12} stroke="hsl(var(--muted-foreground))" />
          <YAxis width={55} tickFormatter={compact} allowDecimals={hourMetric !== "sales"} fontSize={12} stroke="hsl(var(--muted-foreground))" />
          <Tooltip content={<ChartTip hourly />} cursor={false} />
          <Bar dataKey={hourMetric} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart></ResponsiveContainer></div>
      </PremiumPanel>
      <PremiumPanel title="Taxas e custo da operação" eyebrow="Taxas arrecadadas − adquirente = resultado">
        <div className="flex flex-wrap gap-4 pb-3 text-xs text-muted-foreground">{["fees", "acquirer", "profit"].map(key => <span key={key} className={cn(key === "profit" && "text-success")}>{names[key]}</span>)}</div>
        <div className="h-[225px] min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily} margin={{ left: 0, right: 8 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="label" minTickGap={35} fontSize={12} stroke="hsl(var(--muted-foreground))" /><YAxis width={55} tickFormatter={compact} fontSize={12} stroke="hsl(var(--muted-foreground))" />
          <Tooltip content={<ChartTip />} />
          <Area dataKey="fees" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.08} isAnimationActive={false} />
          <Area dataKey="acquirer" stroke="hsl(var(--warning))" fillOpacity={0} isAnimationActive={false} />
          <Area dataKey="profit" stroke="hsl(var(--success))" fillOpacity={0} strokeWidth={2} isAnimationActive={false} />
        </AreaChart></ResponsiveContainer></div>
      </PremiumPanel>
    </div>
  </div>;
}