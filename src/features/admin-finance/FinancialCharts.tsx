import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { brl, rpcErrorMessage } from "./types";

interface Series {
  days: { day: string; entradas: number; saidas: number; taxas: number; custo_adquirente: number }[];
  sellers: { seller: string; name: string; entradas: number; taxas: number; vendas: number }[];
}
const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const compact = (v: number) => v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const axis = { stroke: "hsl(var(--muted-foreground))", fontSize: 12, tickLine: false, axisLine: false } as const;
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
  const s = q.data;
  const noMovement = !!s && s.days.every((d) => d.entradas === 0 && d.saidas === 0 && d.taxas === 0);
  if (q.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-[12px] border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
        <p className="text-[13px] font-semibold text-destructive">Não foi possível carregar os gráficos.</p>
        <p className="max-w-md text-[12px] text-muted-foreground">{(q.error as Error).message}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()}>Tentar de novo</Button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <PremiumPanel title="Entradas, saídas e taxas por dia">
        <div className="h-64" role="img" aria-label="Gráfico de entradas, saídas e taxas por dia">
          {!s ? <div className="h-full animate-pulse rounded-lg bg-muted/30" role="status" aria-label="Carregando gráfico" />
          : noMovement ? <p className="pt-24 text-center text-xs text-muted-foreground">Sem movimentação no período</p>
          : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s.days} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tickFormatter={short} {...axis} minTickGap={16} />
                <YAxis tickFormatter={compact} {...axis} width={44} />
                <Tooltip {...tip} labelFormatter={(l: string) => short(l)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="saidas" name="Saídas" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="taxas" name="Taxas" stroke="hsl(var(--accent-foreground))" fill="transparent" strokeWidth={2} strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </PremiumPanel>
      <PremiumPanel title="Top sellers no período">
        <div className="h-64" role="img" aria-label="Ranking de sellers por entradas e taxas">
          {!s ? <div className="h-full animate-pulse rounded-lg bg-muted/30" role="status" aria-label="Carregando ranking" />
          : s.sellers.length === 0 ? <p className="pt-24 text-center text-xs text-muted-foreground">Sem vendas no período</p>
          : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.sellers} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" tickFormatter={compact} {...axis} />
                <YAxis type="category" dataKey="name" width={120} {...axis} tickFormatter={(n: string) => (n.length > 17 ? `${n.slice(0, 17)}…` : n)} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="taxas" name="Taxas" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </PremiumPanel>
    </div>
  );
}
