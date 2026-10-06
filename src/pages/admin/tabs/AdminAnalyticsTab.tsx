import { useState } from "react";
import { RefreshCw, Loader2, Users, TrendingUp, ShieldAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel } from "./AdminPremium";
import { useAnalytics } from "@/features/admin-finance/useAnalytics";
import { initialAnalyticsFilters } from "@/features/admin-finance/analyticsModel";
import { AnalyticsActivity } from "@/features/admin-finance/AnalyticsActivity";
import { AnalyticsSellerTable } from "@/features/admin-finance/AnalyticsSellerTable";
import { OverviewCharts } from "@/features/admin-finance/OverviewCharts";
import { dateKey, ratio } from "@/features/admin-finance/overviewModel";

interface Props { dateRange: { from: Date; to: Date }; fmtCurrency: (value: number) => string }
export default function AdminAnalyticsTab(props: Props) {
  return <AnalyticsContent key={`${dateKey(props.dateRange.from)}:${dateKey(props.dateRange.to)}`} {...props} />;
}
function AnalyticsContent({ dateRange, fmtCurrency: money }: Props) {
  const [filters, setFilters] = useState(initialAnalyticsFilters);
  const { details, overview } = useAnalytics(dateRange, filters);
  const data = details.data, metrics = overview.data;
  const busy = details.isFetching || overview.isFetching;
  const failed = details.isError || overview.isError;
  const refresh = () => { void details.refetch(); void overview.refetch(); };
  const period = `${dateKey(dateRange.from).split("-").reverse().join("/")} — ${dateKey(dateRange.to).split("-").reverse().join("/")}`;
  return <div className="space-y-5">
    <FinanceiroHero eyebrow="Admin · Analytics" title="Visão completa da operação" subtitle={`${period} · Brasília · apenas transações reais`} status={{ tone: failed ? "warning" : "neutral", label: failed ? "Consulta incompleta" : busy ? "Atualizando" : "Dados consultados", pulse: false }} actions={<Button variant="outline" onClick={refresh} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>} />
    {failed && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-card p-4 text-sm"><p>Não foi possível carregar todos os indicadores. Não interprete dados ausentes como zero.</p><Button variant="outline" onClick={refresh} disabled={busy}>Tentar novamente</Button></div>}
    {!failed && (!data || !metrics) && <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Carregando Analytics…</div>}
    {data && metrics && <>
      <section className="space-y-3"><h2 className="flex items-center gap-2 font-display text-base font-semibold"><TrendingUp className="h-4 w-4 text-primary" />Vendas e resultado do período</h2>
        <PremiumMetricGrid cols={4}>
          <PremiumMetric label="Volume transacionado" value={money(metrics.summary.gross)} subtitle="Total das vendas atualmente pagas" tone="primary" />
          <PremiumMetric label="Vendas pagas" value={String(metrics.summary.sales)} subtitle={`${metrics.summary.attempts} tentativas no período`} />
          <PremiumMetric label="Ticket médio" value={money(metrics.summary.sales ? metrics.summary.gross / metrics.summary.sales : 0)} subtitle="Volume ÷ vendas pagas" />
          <PremiumMetric label="Conversão geral" value={`${ratio(metrics.summary.sales, metrics.summary.attempts).toFixed(1)}%`} subtitle="Pagas ÷ tentativas; não visitas" />
          <PremiumMetric label="Taxas arrecadadas" value={money(metrics.summary.fees)} />
          <PremiumMetric label="Custo das adquirentes" value={money(metrics.summary.acquirer)} />
          <PremiumMetric label="Resultado líquido de taxas" value={money(metrics.summary.profit)} subtitle="Não inclui despesas e impostos" tone="success" />
          <PremiumMetric label="Recusas e expirações" value={String(data.summary.failed_transactions)} subtitle={`${data.summary.pending_transactions} tentativas ainda pendentes`} tone="warning" />
        </PremiumMetricGrid>
      </section>
      <section className="space-y-3"><h2 className="flex items-center gap-2 font-display text-base font-semibold"><Users className="h-4 w-4 text-info" />Sellers e clientes</h2>
        <PremiumMetricGrid cols={4}>
          <PremiumMetric label="Sellers cadastrados" value={String(data.summary.registered_sellers)} subtitle="Base atual, excluindo equipe" />
          <PremiumMetric label="Contas ativas" value={String(data.summary.active_sellers)} subtitle="Aprovadas/ativas e não congeladas" tone="success" />
          <PremiumMetric label="Sellers vendendo hoje" value={String(data.summary.selling_today)} subtitle="Hoje em Brasília, independente do filtro" tone="primary" />
          <PremiumMetric label="Sellers vendendo no período" value={String(data.summary.selling_sellers)} subtitle="Ao menos uma venda paga" tone="primary" />
          <PremiumMetric label="Clientes únicos" value={String(data.summary.clients)} subtitle="E-mails distintos em vendas pagas" />
          <PremiumMetric label="Clientes recorrentes" value={String(data.summary.repeat_clients)} subtitle={`${ratio(data.summary.repeat_clients, data.summary.clients).toFixed(1)}% compraram mais de uma vez no período`} />
          <PremiumMetric label="Novos cadastros" value={String(data.summary.new_registrations)} subtitle="Contas de sellers criadas no período" />
          <PremiumMetric label="Vendas sem identificação" value={String(data.summary.unidentified_sales)} subtitle="Sem e-mail; fora da contagem de clientes" tone="warning" />
        </PremiumMetricGrid>
      </section>
      <AnalyticsActivity daily={data.daily} />
      <AnalyticsSellerTable data={data} filters={filters} onFilters={setFilters} fmtCurrency={money} busy={busy} />
      <section className="space-y-3"><h2 className="flex items-center gap-2 font-display text-base font-semibold"><ShieldAlert className="h-4 w-4 text-destructive" />Reembolsos e disputas no período</h2>
        <PremiumMetricGrid cols={3}>
          <PremiumMetric label="Reembolsos efetivados" value={String(data.summary.refunds)} subtitle={money(data.summary.refund_amount)} tone="warning" />
          <PremiumMetric label="Chargebacks" value={String(data.summary.chargebacks)} subtitle={money(data.summary.chargeback_amount)} tone="destructive" />
          <PremiumMetric label="MED PIX / pré-MED" value={String(data.summary.med)} subtitle={money(data.summary.med_amount)} tone="warning" />
        </PremiumMetricGrid>
        <p className="text-xs text-muted-foreground">Reembolsos pela data de confirmação da devolução; disputas pela data de abertura. Valores de MED representam reclamações, não perda confirmada.</p>
      </section>
      <section className="space-y-3"><h2 className="flex items-center gap-2 font-display text-base font-semibold"><Wallet className="h-4 w-4 text-warning" />Pendências atuais · independente do período</h2>
        <PremiumMetricGrid cols={3}>
          <PremiumMetric label="Reembolsos aguardando aprovação" value={String(data.operations.pending_refunds)} subtitle={`${money(data.operations.refunds_reserved)} já descontados dos sellers`} tone="warning" />
          <PremiumMetric label="Saques pendentes/em processamento" value={String(data.operations.pending_withdrawals)} subtitle={money(data.operations.withdrawal_amount)} tone="warning" />
          <PremiumMetric label="MED PIX em análise" value={String(data.operations.open_med)} tone="warning" />
          <PremiumMetric label="KYC pendente" value={String(data.operations.kyc_pending)} />
          <PremiumMetric label="Contas congeladas" value={String(data.operations.frozen_sellers)} tone="destructive" />
        </PremiumMetricGrid>
      </section>
      <OverviewCharts data={metrics} />
      <PremiumPanel title="Pagamentos por método"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{["Método", "Tentativas", "Vendas pagas", "Conversão", "Movimentado"].map(label => <th key={label} className="whitespace-nowrap p-3">{label}</th>)}</tr></thead><tbody>{metrics.methods.map(method => <tr key={method.method} className="border-b border-border"><td className="p-3">{method.method === "pix" ? "PIX" : method.method === "credit_card" ? "Cartão" : method.method}</td><td className="p-3">{method.total}</td><td className="p-3">{method.sales}</td><td className="p-3">{ratio(method.sales, method.total).toFixed(1)}%</td><td className="whitespace-nowrap p-3">{money(method.gross)}</td></tr>)}{!metrics.methods.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhuma transação no período.</td></tr>}</tbody></table></div></PremiumPanel>
      <p className="text-xs text-muted-foreground">Consultado em {new Date(data.checked_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília). Totais independem da busca e paginação dos sellers.</p>
    </>}
  </div>;
}
