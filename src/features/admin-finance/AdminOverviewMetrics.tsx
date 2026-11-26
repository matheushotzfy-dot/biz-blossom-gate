import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumMetric, PremiumMetricGrid } from "@/pages/admin/tabs/AdminPremium";
import { OverviewCharts } from "./OverviewCharts";
import { dateKey, overviewSchema, ratio } from "./overviewModel";

export interface AdminOverviewMetricsProps { dateRange?: { from: Date; to: Date }; refreshSignal?: unknown; onNavigate?: (tab: string) => void }
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function AdminOverviewMetrics({ dateRange, refreshSignal, onNavigate }: AdminOverviewMetricsProps) {
  const { user } = useAuth();
  const client = useQueryClient();
  const from = dateKey(dateRange?.from ?? new Date());
  const to = dateKey(dateRange?.to ?? new Date());
  const queryKey = ["admin-overview-metrics", user?.id, from, to];
  const query = useQuery({ queryKey, enabled: Boolean(user), staleTime: 30000, queryFn: async () => {
    const { data, error } = await supabase.rpc("get_admin_overview_metrics" as never, { _from: from, _to: to } as never);
    if (error) throw error;
    return overviewSchema.parse(data);
  } });
  useEffect(() => { void client.invalidateQueries({ queryKey: ["admin-overview-metrics", user?.id] }); }, [client, user?.id, refreshSignal]);
  if (query.isPending) return <Skeleton className="h-[236px] rounded-xl" />;
  if (query.isError) return <div role="alert" className="flex flex-wrap items-center gap-4 rounded-lg border border-destructive p-4"><p className="text-sm text-destructive">Não foi possível carregar os indicadores deste período.</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div>;
  const data = query.data;
  const s = data.summary;
  const cards = [
    { title: "Volume transacionado", value: money(s.gross), sub: `${s.sales.toLocaleString("pt-BR")} vendas pagas`, tab: "transactions" },
    { title: "Ticket médio", value: money(s.sales > 0 ? s.gross / s.sales : 0), sub: "Valor por venda paga", tab: "transactions" },
    { title: "Conversão geral", value: `${ratio(s.sales, s.attempts).toFixed(2)}%`, sub: `${s.sales} pagas / ${s.attempts} tentativas`, tab: "transactions" },
    { title: "Resultado líquido de taxas", value: money(s.profit), sub: "Taxas − custo da adquirente¹", tab: "fin-metrics" },
    { title: "Chargeback", value: data.risk.chargebacks.toLocaleString("pt-BR"), sub: money(data.risk.chargeback_amount), tab: "chargeback", danger: data.risk.chargebacks > 0 },
    { title: "MED PIX", value: data.risk.med_count.toLocaleString("pt-BR"), sub: `${money(data.risk.med_amount)} · ${data.risk.med_open} em aberto no total`, tab: "medpix", danger: data.risk.med_open > 0 },
    { title: "Novos cadastros", value: data.new_users.toLocaleString("pt-BR"), sub: "Sellers no período", tab: "sellers" },
    { title: "KYC pendente", value: data.kyc_pending.toLocaleString("pt-BR"), sub: "Fila atual de aprovação", tab: "sellers" },
  ];
  return <div className="space-y-5">
    <PremiumMetricGrid cols={4}>{cards.map(card => <PremiumMetric key={card.title} label={card.title} value={card.value} sub={card.sub} tone={card.danger ? "destructive" : "neutral"} onClick={() => onNavigate?.(card.tab)} />)}</PremiumMetricGrid>
    <p className="text-xs text-muted-foreground">¹ Resultado das vendas pagas após adquirente; não inclui despesas administrativas, impostos ou custos não registrados.</p>
    <OverviewCharts data={data} />
    <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-border py-4 text-sm">{data.methods.map(method => <div key={method.method}><span className="font-medium">{method.method === "pix" ? "PIX" : method.method === "credit_card" ? "Cartão" : method.method}</span><span className="ml-3 tabular-nums text-muted-foreground">{method.sales}/{method.total} · {ratio(method.sales, method.total).toFixed(1)}% · {money(method.gross)}</span></div>)}{data.methods.length === 0 && <p className="text-muted-foreground">Nenhuma transação real neste período.</p>}</div>
  </div>;
}