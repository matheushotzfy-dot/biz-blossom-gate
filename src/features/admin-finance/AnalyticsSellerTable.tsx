import { lazy, Suspense, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PremiumPanel, premiumTable } from "@/pages/admin/tabs/AdminPremium";
import { ratio } from "./overviewModel";
import { sellerPageCount, type AnalyticsData, type AnalyticsFilters, type AnalyticsSort } from "./analyticsModel";

const Seller360 = lazy(() => import("./Seller360Panel").then(module => ({ default: module.Seller360Panel })));
export interface AnalyticsSellerTableProps { data: AnalyticsData; filters: AnalyticsFilters; onFilters: (filters: AnalyticsFilters) => void; fmtCurrency: (value: number) => string; busy: boolean; ranked?: boolean }
export function AnalyticsSellerTable({ data, filters, onFilters, fmtCurrency: money, busy, ranked = false }: AnalyticsSellerTableProps) {
  const [search, setSearch] = useState(filters.search);
  const [selected, setSelected] = useState<{ userId: string; name: string } | null>(null);
  const pages = sellerPageCount(data.seller_count, data.page_size);
  const change = (next: Partial<AnalyticsFilters>) => onFilters({ ...filters, ...next, page: 0 });
  return <>
    <PremiumPanel title={ranked ? "Ranking de sellers" : "Desempenho de cada seller"} eyebrow={`${data.seller_count.toLocaleString("pt-BR")} contas · período selecionado`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={event => { event.preventDefault(); change({ search: search.trim() }); }}>
          <Input value={search} onChange={event => setSearch(event.target.value)} maxLength={120} aria-label="Buscar seller" placeholder="Nome, e-mail ou ID do seller" className="min-w-0" />
          <Button type="submit" variant="outline" size="icon" aria-label="Aplicar busca"><Search className="h-4 w-4" /></Button>
        </form>
        <Select value={filters.sort} onValueChange={value => change({ sort: value as AnalyticsSort })}><SelectTrigger className="w-[170px]" aria-label="Ordenar sellers"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="volume">Maior volume</SelectItem><SelectItem value="sales">Mais vendas</SelectItem><SelectItem value="risk">Mais ocorrências</SelectItem>{!ranked && <SelectItem value="newest">Mais recentes</SelectItem>}</SelectContent></Select>
        <label className="flex items-center gap-2 text-xs"><Checkbox checked={filters.sellingOnly} onCheckedChange={value => change({ sellingOnly: value === true })} />Só quem vendeu</label>
      </div>
      <div className={premiumTable.wrapper}><table className={premiumTable.table}><thead><tr className={premiumTable.headRow}>{["Seller", "Situação atual", "Vendas", "Movimentado", "Clientes", "Ticket médio", "Conversão", "Taxas", "Adquirente", "Resultado de taxas", "Reembolsos", "Chargebacks", "MED PIX", "Ficha"].map(label => <th key={label} className={premiumTable.th}>{label}</th>)}</tr></thead><tbody>
        {data.sellers.map((seller, index) => <tr key={seller.user_id} className={premiumTable.row}>
          <td className={premiumTable.td}><p className="max-w-[220px] truncate text-sm font-semibold">{ranked && <span className="mr-2 font-mono text-primary">#{data.page * data.page_size + index + 1}</span>}{seller.name}</p><p className="max-w-[220px] truncate text-xs text-muted-foreground">{seller.email}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{seller.user_id}</p></td>
          <td className={premiumTable.td}><span className="whitespace-nowrap text-xs">{seller.active ? "Ativa" : "Não ativa"}</span></td>
          <td className={premiumTable.td}>{seller.sales.toLocaleString("pt-BR")}</td>
          <td className={premiumTable.td}>{money(seller.volume)}</td><td className={premiumTable.td}>{seller.clients}</td>
          <td className={premiumTable.td}>{money(seller.sales ? seller.volume / seller.sales : 0)}</td>
          <td className={premiumTable.td}>{ratio(seller.sales, seller.attempts).toFixed(1)}%<p className="whitespace-nowrap text-[10px] text-muted-foreground">{seller.attempts} tentativas</p></td>
          <td className={premiumTable.td}>{money(seller.fees)}</td><td className={premiumTable.td}>{money(seller.acquirer)}</td><td className={premiumTable.td}>{money(seller.fees - seller.acquirer)}</td>
          <td className={premiumTable.td}>{seller.refunds}<p className="whitespace-nowrap text-xs text-muted-foreground">{money(seller.refund_amount)}</p></td>
          <td className={premiumTable.td}>{seller.chargebacks}<p className="whitespace-nowrap text-xs text-muted-foreground">{money(seller.chargeback_amount)}</p></td>
          <td className={premiumTable.td}>{seller.med}<p className="whitespace-nowrap text-xs text-muted-foreground">{money(seller.med_amount)}</p></td>
          <td className={premiumTable.td}><Button variant="ghost" size="icon" aria-label={`Abrir ficha de ${seller.name}`} onClick={() => setSelected({ userId: seller.user_id, name: seller.name })}><ExternalLink className="h-4 w-4" /></Button></td>
        </tr>)}
        {!data.sellers.length && <tr><td colSpan={14} className="py-10 text-center text-sm text-muted-foreground">Nenhum seller encontrado para estes filtros.</td></tr>}
      </tbody></table></div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>Página {data.page + 1} de {pages} · {data.page_size} por página</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={busy || filters.page === 0} onClick={() => onFilters({ ...filters, page: filters.page - 1 })}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Próxima página" disabled={busy || filters.page + 1 >= pages} onClick={() => onFilters({ ...filters, page: filters.page + 1 })}><ChevronRight className="h-4 w-4" /></Button></div></div>
    </PremiumPanel>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="z-[100] max-h-[85dvh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>Ficha do seller · {selected?.name}</DialogTitle></DialogHeader>{selected && <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin text-primary" />}><Seller360 userId={selected.userId} /></Suspense>}</DialogContent></Dialog>
  </>;
}