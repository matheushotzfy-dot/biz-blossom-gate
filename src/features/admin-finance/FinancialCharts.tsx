import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { brl, rpcErrorMessage } from "./types";

interface Series {
  days: { day: string; entradas: number; saidas: number; taxas: number; custo_adquirente: number }[];
  sellers: { seller: string; name: string; entradas: number; taxas: number; vendas: number }[];
}
const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const compact = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));
const axis = { stroke: "hsl(var(--muted-foreground))", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }, formatter: (v: number) => brl(Number(v)) };

/** Entradas × saídas × taxas por dia, e ranking de sellers no mesmo filtro. */
export function FinancialCharts({ from, to, seller, acquirer }: { from: string; to: string; seller?: string; acquirer?: string }) {
  const q = useQuery({
    queryKey: ["fin-series", from, to, seller, acquirer], staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_financial_series", { _from: from, _to: to, _seller: seller || undefined, _acquirer: acquirer || undefined });
      if (error) throw new Error(rpcErrorMessage(error));
      return data as unknown as Series;
    },
  });
  if (q.isError) return <p className="text-xs text-destructive">{(q.error as Error).message}</p>;
  const s = q.data;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2" aria-label="Entradas, saídas e taxas por dia">
        <h3 className="mb-3 text-xs font-semibold">Entradas, saídas e taxas por dia</h3>
        <div className="h-64">{s && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s.days} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tickFormatter={short} {...axis} minTickGap={16} />
              <YAxis tickFormatter={compact} {...axis} width={44} />
              <Tooltip {...tip} labelFormatter={(l: string) => short(l)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="saidas" name="Saídas" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="taxas" name="Taxas" stroke="hsl(var(--accent-foreground))" fill="transparent" strokeWidth={2} strokeDasharray="4 3" />
            </AreaChart>
          </ResponsiveContainer>)}</div>
      </section>
      <section className="rounded-xl border border-border bg-card p-4" aria-label="Top sellers no período">
        <h3 className="mb-3 text-xs font-semibold">Top sellers no período</h3>
        <div className="h-64">{s && (s.sellers.length === 0 ? <p className="pt-24 text-center text-xs text-muted-foreground">Sem vendas no período</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.sellers} layout="vertical" margin={{ left: 0, right: 8 }}>
              <XAxis type="number" tickFormatter={compact} {...axis} />
              <YAxis type="category" dataKey="name" width={90} {...axis} tickFormatter={(n: string) => (n.length > 12 ? `${n.slice(0, 12)}…` : n)} />
              <Tooltip {...tip} />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              <Bar dataKey="taxas" name="Taxas" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>))}</div>
      </section>
    </div>
  );
}
