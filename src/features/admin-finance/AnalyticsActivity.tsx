import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import type { AnalyticsData } from "./analyticsModel";

const labels = { sellers: "Sellers vendendo", clients: "Clientes", registrations: "Novos cadastros", sales: "Vendas" };
type ActivityMetric = keyof typeof labels;
export function AnalyticsActivity({ daily }: { daily: AnalyticsData["daily"] }) {
  const [metric, setMetric] = useState<ActivityMetric>("sellers");
  const data = daily.map(row => ({ ...row, label: row.day.split("-").reverse().join("/") }));
  return <PremiumPanel title="Atividade por dia" eyebrow="Vendas pagas · horário de Brasília" action={<div className="flex flex-wrap gap-1">{(Object.keys(labels) as ActivityMetric[]).map(key => <Button key={key} size="sm" variant={key === metric ? "secondary" : "ghost"} onClick={() => setMetric(key)}>{labels[key]}</Button>)}</div>}>
    <div className="h-[250px] min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}>
      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="label" minTickGap={35} fontSize={11} stroke="hsl(var(--muted-foreground))" />
      <YAxis allowDecimals={false} width={45} fontSize={11} stroke="hsl(var(--muted-foreground))" />
      <Tooltip content={({ active, payload }) => {
        const row = payload?.[0]?.payload as AnalyticsData["daily"][number] | undefined;
        if (!active || !row) return null;
        return <div className="rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground"><strong>{row.day.split("-").reverse().join("/")}</strong>{(Object.keys(labels) as ActivityMetric[]).map(key => <p key={key} className="flex justify-between gap-6 pt-2"><span>{labels[key]}</span><b>{row[key].toLocaleString("pt-BR")}</b></p>)}<p className="pt-2">Volume: {row.volume.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>;
      }} cursor={false} />
      <Bar dataKey={metric} fill="hsl(var(--info))" radius={[3, 3, 0, 0]} isAnimationActive={false} />
    </BarChart></ResponsiveContainer></div>
  </PremiumPanel>;
}