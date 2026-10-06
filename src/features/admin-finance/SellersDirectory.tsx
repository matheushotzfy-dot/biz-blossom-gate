import { useState } from "react";
import { Users, TrendingUp, ShieldAlert, FileCheck, Search, RefreshCw, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { useSellersPage } from "./useSellersPage";
import { initialSellerFilters, type SellerFilters } from "./sellersModel";

export interface SellersDirectoryProps { range: { from: Date; to: Date }; onOpen: (userId: string) => void; money: (value: number) => string; enabled: boolean; refreshKey: unknown }
const STATES = [["all", "Todas as contas"], ["kyc", "KYC pendente"], ["approved", "Aprovadas"], ["frozen", "Saldo congelado"], ["blocked", "Bloqueadas"], ["rejected", "KYC recusado"], ["white", "White"], ["black", "Black"], ["unset", "Sem classificação"]];
const RISKS = [["all", "Todos os riscos"], ["med", "Com MED PIX"], ["chargeback", "Com chargeback"], ["refund", "Com reembolso"], ["any", "Com ocorrências"]];
const SORTS = [["volume", "Maior volume"], ["sales", "Mais vendas"], ["med", "Mais MED PIX"], ["chargeback", "Mais chargebacks"], ["refund", "Mais reembolsos"], ["newest", "Cadastros recentes"]];
function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{options.map(([id, text]) => <SelectItem key={id} value={id}>{text}</SelectItem>)}</SelectContent></Select>;
}
export function SellersDirectory({ range, onOpen, money, enabled }: SellersDirectoryProps) {
  const [filters, setFilters] = useState<SellerFilters>(initialSellerFilters);
  const [search, setSearch] = useState("");
  const query = useSellersPage(range, filters, enabled);
  const change = (next: Partial<SellerFilters>) => setFilters(previous => ({ ...previous, ...next, page: 0 }));
  const summary = query.data?.summary;
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 25));
  return <section className="space-y-5" aria-label="Gestão de sellers">
    <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
      <div><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4" />Operação / Sellers</div><h1 className="font-display text-2xl font-semibold">Sellers</h1></div>
      <Button variant="outline" size="icon" aria-label="Atualizar sellers" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} /></Button>
    </header>
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border pb-5 lg:grid-cols-6">
      {[{ label: "Contas cadastradas", value: summary?.registered, icon: Users, state: "all" }, { label: "Vendendo no período", value: summary?.selling, icon: TrendingUp, sellingOnly: true }, { label: "KYC pendente", value: summary?.kyc, icon: FileCheck, state: "kyc" }, { label: "Volume aprovado", value: summary ? money(summary.volume) : undefined, icon: TrendingUp }, { label: "MED PIX", value: summary?.med, icon: ShieldAlert, risk: "med" }, { label: "Chargebacks", value: summary?.chargebacks, icon: ShieldAlert, risk: "chargeback" }].map(metric => <div key={metric.label}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><metric.icon className="h-3.5 w-3.5" />{metric.label}</div>
        <Button variant="ghost" className="mt-1 h-auto justify-start p-0 font-mono text-xl font-semibold" disabled={metric.value === undefined} onClick={() => change({ state: metric.state ?? "all", risk: metric.risk ?? "all", sellingOnly: metric.sellingOnly ?? false })}>{metric.value ?? "—"}</Button>
      </div>)}
    </div>
    <div className="space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={event => { event.preventDefault(); change({ search: search.trim() }); }}><Input aria-label="Buscar seller" placeholder="Nome, e-mail ou ID" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} /><Button variant="outline" size="icon" type="submit" aria-label="Aplicar busca"><Search className="h-4 w-4" /></Button></form>
        <Filter label="Situação do seller" value={filters.state} options={STATES} onChange={state => change({ state })} />
        <Filter label="Filtrar riscos" value={filters.risk} options={RISKS} onChange={risk => change({ risk })} />
        <Filter label="Ordenar sellers" value={filters.sort} options={SORTS} onChange={sort => change({ sort })} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><label className="flex items-center gap-2"><Checkbox checked={filters.sellingOnly} onCheckedChange={value => change({ sellingOnly: value === true })} />Só quem vendeu no período</label><span>{query.data?.total ?? "—"} sellers encontrados</span></div>
    </div>
    {query.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-card p-4 text-sm text-destructive">Não foi possível carregar os sellers.<Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div> : <div className="overflow-x-auto rounded-lg border border-border" aria-busy={query.isFetching}>
      <table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted"><tr>{["Seller", "Situação", "Vendas", "Volume aprovado", "Ticket médio", "Conversão", "MED PIX", "Chargebacks", "Reembolsos", ""].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 text-xs font-medium text-muted-foreground">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">
        {query.data?.rows.map(seller => <tr key={seller.user_id} className="bg-card transition-colors hover:bg-muted/40">
          <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-display text-primary">{(seller.full_name || seller.email || "S")[0].toUpperCase()}</span><div className="min-w-[150px]"><Button variant="link" className="h-auto max-w-[220px] truncate p-0 text-foreground" onClick={() => onOpen(seller.user_id)}>{seller.full_name || "Sem nome"}</Button><p className="max-w-[220px] truncate text-xs text-muted-foreground">{seller.email}</p><p className="mt-1 text-[10px] text-muted-foreground">{seller.seller_type?.toUpperCase() || "Sem classificação"}</p></div></div></td>
          <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={seller.account_status || "pending_review"} />{seller.balance_frozen && <p className="mt-1 text-xs text-destructive">Saldo congelado</p>}</td>
          <td className="px-4 py-3 font-mono">{seller.sales}<p className="whitespace-nowrap text-[10px] text-muted-foreground">{seller.attempts} tentativas</p></td><td className="whitespace-nowrap px-4 py-3 font-mono font-semibold">{money(seller.volume)}</td><td className="whitespace-nowrap px-4 py-3 font-mono">{money(seller.sales ? seller.volume / seller.sales : 0)}</td><td className="px-4 py-3 font-mono">{(seller.attempts ? seller.sales / seller.attempts * 100 : 0).toFixed(1)}%</td>
          {[{ count: seller.med, amount: seller.med_amount }, { count: seller.chargebacks, amount: seller.chargeback_amount }, { count: seller.refunds, amount: seller.refund_amount }].map((risk, index) => <td key={["med", "cb", "rf"][index]} className="px-4 py-3"><span className={cn("font-mono", risk.count > 0 && "text-destructive")}>{risk.count}</span><p className="whitespace-nowrap text-[10px] text-muted-foreground">{money(risk.amount)}</p></td>)}
          <td className="px-4 py-3"><Button variant="outline" size="icon" aria-label={`Ver detalhes de ${seller.full_name || seller.email}`} onClick={() => onOpen(seller.user_id)}><ArrowUpRight className="h-4 w-4" /></Button></td>
        </tr>)}
        {!query.data?.rows.length && <tr><td colSpan={10} className="py-12 text-center text-muted-foreground">{query.isPending ? "Carregando sellers…" : "Nenhum seller encontrado para estes filtros."}</td></tr>}
      </tbody></table>
    </div>}
    <footer className="flex items-center justify-between text-xs text-muted-foreground"><span>Página {filters.page + 1} de {pages}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={query.isFetching || !filters.page} onClick={() => setFilters(previous => ({ ...previous, page: previous.page - 1 }))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Próxima página" disabled={query.isFetching || filters.page + 1 >= pages} onClick={() => setFilters(previous => ({ ...previous, page: previous.page + 1 }))}><ChevronRight className="h-4 w-4" /></Button></div></footer>
  </section>;
}