import { useState } from "react";
import { Search, RefreshCw, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PremiumMetric, PremiumMetricGrid, premiumTable } from "@/pages/admin/tabs/AdminPremium";
import { cn } from "@/lib/utils";
import { useSellersPage } from "./useSellersPage";
import { initialSellerFilters, type SellerFilters } from "./sellersModel";

export interface SellersDirectoryProps { range: { from: Date; to: Date }; onOpen: (userId: string) => void; money: (value: number) => string; enabled: boolean }
const STATES = [["all", "Todas as contas"], ["kyc", "KYC pendente"], ["approved", "Aprovadas"], ["frozen", "Saldo congelado"], ["blocked", "Bloqueadas"], ["rejected", "KYC recusado"], ["white", "White"], ["black", "Black"], ["unset", "Sem classificação"]];
const RISKS = [["all", "Todos os riscos"], ["med", "Com MED PIX"], ["chargeback", "Com chargeback"], ["refund", "Com reembolso"], ["any", "Com ocorrências"]];
const SORTS = [["volume", "Maior volume"], ["sales", "Mais vendas"], ["med", "Mais MED PIX"], ["chargeback", "Mais chargebacks"], ["refund", "Mais reembolsos"], ["newest", "Cadastros recentes"]];
function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full min-w-0 xl:w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{options.map(([id, text]) => <SelectItem key={id} value={id}>{text}</SelectItem>)}</SelectContent></Select>;
}
export function SellersDirectory({ range, onOpen, money, enabled }: SellersDirectoryProps) {
  const [filters, setFilters] = useState<SellerFilters>(initialSellerFilters);
  const [search, setSearch] = useState("");
  const query = useSellersPage(range, filters, enabled);
  const change = (next: Partial<SellerFilters>) => setFilters(previous => ({ ...previous, ...next, page: 0 }));
  const summary = query.data?.summary;
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.page_size ?? 25)));
  return <section className="space-y-5" aria-label="Gestão de sellers">
    <AdminPageHeader
      title="Sellers"
      subtitle="Todas as contas, com vendas, riscos e situação cadastral no período do topo."
      actions={<Button variant="outline" size="icon" aria-label="Atualizar sellers" title="Atualizar sellers" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} /></Button>}
    />
    <PremiumMetricGrid cols={6}>
      {[{ label: "Contas cadastradas", value: summary?.registered, state: "all" }, { label: "Vendendo no período", value: summary?.selling, sellingOnly: true }, { label: "KYC pendente", value: summary?.kyc, state: "kyc" }, { label: "Volume aprovado", value: summary ? money(summary.volume) : undefined }, { label: "MED PIX", value: summary?.med, risk: "med" }, { label: "Chargebacks", value: summary?.chargebacks, risk: "chargeback" }].map(metric => <PremiumMetric key={metric.label} label={metric.label} value={String(metric.value ?? "—")} tone={(metric.risk && Number(metric.value) > 0) ? "destructive" : "neutral"} onClick={metric.value === undefined ? undefined : () => change({ state: metric.state ?? "all", risk: metric.risk ?? "all", sellingOnly: metric.sellingOnly ?? false })} />)}
    </PremiumMetricGrid>
    <div className="space-y-3">
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 xl:flex">
        <form className="col-span-2 flex min-w-0 flex-1 gap-2" onSubmit={event => { event.preventDefault(); change({ search: search.trim() }); }}><Input aria-label="Buscar seller" placeholder="Nome, e-mail ou ID" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} /><Button variant="outline" size="icon" type="submit" aria-label="Aplicar busca"><Search className="h-4 w-4" /></Button></form>
        <Filter label="Situação do seller" value={filters.state} options={STATES} onChange={state => change({ state })} />
        <Filter label="Filtrar riscos" value={filters.risk} options={RISKS} onChange={risk => change({ risk })} />
        <div className="col-span-2 sm:col-span-1 xl:contents"><Filter label="Ordenar sellers" value={filters.sort} options={SORTS} onChange={sort => change({ sort })} /></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><label className="flex items-center gap-2"><Checkbox checked={filters.sellingOnly} onCheckedChange={value => change({ sellingOnly: value === true })} />Só quem vendeu no período</label><span>{query.data?.total ?? "—"} sellers encontrados</span></div>
    </div>
    {query.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-card p-4 text-sm text-destructive">Não foi possível carregar os sellers.<Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div> : <div className={premiumTable.wrapper} aria-busy={query.isFetching}>
      <table className={premiumTable.table}><thead><tr className={premiumTable.headRow}>{["Seller", "Situação", "Vendas", "Volume aprovado", "Ticket médio", "Conversão", "MED PIX", "Chargebacks", "Reembolsos", ""].map(label => <th key={label} className={cn(premiumTable.th, "whitespace-nowrap px-4", (label === "Ticket médio" || label === "Conversão") && "hidden 2xl:table-cell")}>{label}</th>)}</tr></thead><tbody>
        {query.data?.rows.map(seller => <tr key={seller.user_id} className={cn(premiumTable.row, "cursor-pointer")} onClick={() => onOpen(seller.user_id)}>
          <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-display text-primary">{(seller.full_name || seller.email || "S")[0].toUpperCase()}</span><div className="min-w-[150px]"><Button variant="link" className="h-auto max-w-[220px] truncate p-0 text-foreground" onClick={event => { event.stopPropagation(); onOpen(seller.user_id); }}>{seller.full_name || "Sem nome"}</Button><p className="max-w-[220px] truncate text-xs text-muted-foreground">{seller.email}</p><p className="mt-1 text-[10px] text-muted-foreground">{seller.seller_type?.toUpperCase() || "Sem classificação"}</p><p className="mt-1 text-[11px] font-medium tabular-nums text-foreground sm:hidden">{seller.sales} {seller.sales === 1 ? "venda" : "vendas"} · {money(seller.volume)}</p></div></div></td>
          <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={seller.account_status || "pending_review"} />{seller.balance_frozen && <p className="mt-1 text-xs text-destructive">Saldo congelado</p>}</td>
          <td className="px-4 py-3">{seller.sales}<p className="whitespace-nowrap text-[10px] text-muted-foreground">{seller.attempts} tentativas</p></td><td className="whitespace-nowrap px-4 py-3 font-semibold">{money(seller.volume)}</td><td className="hidden whitespace-nowrap px-4 py-3 2xl:table-cell">{money(seller.sales ? seller.volume / seller.sales : 0)}</td><td className="hidden px-4 py-3 2xl:table-cell">{(seller.attempts ? seller.sales / seller.attempts * 100 : 0).toFixed(1)}%</td>
          {[{ count: seller.med, amount: seller.med_amount }, { count: seller.chargebacks, amount: seller.chargeback_amount }, { count: seller.refunds, amount: seller.refund_amount }].map((risk, index) => <td key={["med", "cb", "rf"][index]} className="px-4 py-3"><span className={cn("tabular-nums", risk.count > 0 && "text-destructive")}>{risk.count}</span><p className="whitespace-nowrap text-[10px] text-muted-foreground">{money(risk.amount)}</p></td>)}
          <td className="px-4 py-3"><Button variant="outline" size="icon" aria-label={`Ver detalhes de ${seller.full_name || seller.email}`} onClick={event => { event.stopPropagation(); onOpen(seller.user_id); }}><ArrowUpRight className="h-4 w-4" /></Button></td>
        </tr>)}
        {!query.data?.rows.length && <tr><td colSpan={10} className="py-12 text-center text-muted-foreground">{query.isPending ? "Carregando sellers…" : "Nenhum seller encontrado para estes filtros."}</td></tr>}
      </tbody></table>
    </div>}
    <footer className="flex items-center justify-between text-xs text-muted-foreground"><span>Página {filters.page + 1} de {pages}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={query.isFetching || !filters.page} onClick={() => setFilters(previous => ({ ...previous, page: previous.page - 1 }))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Próxima página" disabled={query.isFetching || filters.page + 1 >= pages} onClick={() => setFilters(previous => ({ ...previous, page: previous.page + 1 }))}><ChevronRight className="h-4 w-4" /></Button></div></footer>
  </section>;
}