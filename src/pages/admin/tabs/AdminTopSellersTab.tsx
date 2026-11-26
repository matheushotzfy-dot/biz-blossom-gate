import { useState } from "react";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PremiumMetric, PremiumMetricGrid } from "@/pages/admin/tabs/AdminPremium";
import { useAnalytics } from "@/features/admin-finance/useAnalytics";
import { initialAnalyticsFilters } from "@/features/admin-finance/analyticsModel";
import { AnalyticsSellerTable } from "@/features/admin-finance/AnalyticsSellerTable";
import { topSellersCSV } from "@/features/admin-finance/topSellersExport";
import { dateKey } from "@/features/admin-finance/overviewModel";

export interface AdminTopSellersProps { dateRange: { from: Date; to: Date }; fmtCurrency: (value: number) => string }
export default function AdminTopSellersTab(props: AdminTopSellersProps) {
  return <TopSellersContent key={`${dateKey(props.dateRange.from)}:${dateKey(props.dateRange.to)}`} {...props} />;
}
function TopSellersContent({ dateRange, fmtCurrency: money }: AdminTopSellersProps) {
  const [filters, setFilters] = useState({ ...initialAnalyticsFilters, sellingOnly: true });
  const { details, overview } = useAnalytics(dateRange, filters);
  const data = details.data, metrics = overview.data;
  const busy = details.isFetching || overview.isFetching;
  const failed = details.isError || overview.isError;
  const from = dateKey(dateRange.from), to = dateKey(dateRange.to);
  const refresh = () => { void details.refetch(); void overview.refetch(); };
  const exportPage = () => {
    if (!data || busy || failed) return;
    const blob = new Blob([topSellersCSV(data.sellers, from, to, data.page * data.page_size)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `top-sellers-${from}-${to}-pagina-${data.page + 1}.csv`;
    anchor.click(); URL.revokeObjectURL(url);
  };
  const cards = [
    { label: "Sellers vendendo", value: data ? String(data.summary.selling_sellers) : "—" },
    { label: "Vendas pagas", value: metrics ? String(metrics.summary.sales) : "—" },
    { label: "Volume aprovado", value: metrics ? money(metrics.summary.gross) : "—" },
    { label: "Ticket médio", value: metrics ? money(metrics.summary.sales ? metrics.summary.gross / metrics.summary.sales : 0) : "—" },
    { label: "Taxas arrecadadas", value: metrics ? money(metrics.summary.fees) : "—" },
    { label: "Custo adquirentes", value: metrics ? money(metrics.summary.acquirer) : "—" },
  ];
  return <div className="space-y-5">
    <AdminPageHeader
      title="Top Sellers"
      subtitle={`Ranking de quem mais vendeu entre ${from.split("-").reverse().join("/")} e ${to.split("-").reverse().join("/")}, no horário de Brasília.`}
      actions={<><Button variant="outline" size="icon" aria-label="Atualizar Top Sellers" title="Atualizar Top Sellers" disabled={busy} onClick={refresh}><RefreshCw className={`h-4 w-4${busy ? " animate-spin" : ""}`} /></Button><Button variant="outline" disabled={busy || failed || !data?.sellers.length} onClick={exportPage}><Download className="mr-2 h-4 w-4" />CSV desta página</Button></>}
    />
    {failed ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-4 text-sm"><p>Não foi possível carregar Top Sellers. Dados ausentes não representam zero.</p><Button variant="outline" disabled={busy} onClick={refresh}>Tentar novamente</Button></div> : <>
      <section aria-label="Totais do período"><PremiumMetricGrid cols={6}>{cards.map(card => <PremiumMetric key={card.label} label={card.label} value={card.value} />)}</PremiumMetricGrid></section>
      {!data || !metrics ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Carregando Top Sellers…</div> : <>
        <AnalyticsSellerTable ranked data={data} filters={filters} onFilters={setFilters} fmtCurrency={money} busy={busy} />
        <p className="text-xs text-muted-foreground">Totais de toda a operação no período, independentes da busca. Vendas atualmente pagas; reembolsos por confirmação e disputas por abertura. MED PIX não significa perda confirmada.</p>
        <p className="text-xs text-muted-foreground">Consultado em {new Date(data.checked_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília).</p>
      </>}
    </>}
  </div>;
}
