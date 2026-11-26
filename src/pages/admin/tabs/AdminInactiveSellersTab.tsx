import { lazy, Suspense, useState } from "react";
import { Download, RefreshCw, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PremiumMetric, PremiumMetricGrid } from "@/pages/admin/tabs/AdminPremium";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useInactive } from "@/features/admin-inactive/useInactive";
import { InactiveList } from "@/features/admin-inactive/InactiveList";
import { InactiveDetail } from "@/features/admin-inactive/InactiveDetail";
import { activityDate, inactiveCSV, validDays, sortSchema, type InactiveFilters } from "@/features/admin-inactive/model";
const Seller360 = lazy(() => import("@/features/admin-finance/Seller360Panel").then(m => ({ default: m.Seller360Panel })));
export interface AdminInactiveSellersTabProps { fmtCurrency: (value: number) => string }
export default function AdminInactiveSellersTab({ fmtCurrency: money }: AdminInactiveSellersTabProps) {
 const [filters, setFilters] = useState<InactiveFilters>({ days: 7, page: 0, search: "", sort: "days" });
 const [search, setSearch] = useState(""); const [days, setDays] = useState("7"); const [dayError, setDayError] = useState(false);
 const [selectedId, setSelectedId] = useState<string | null>(null); const [record, setRecord] = useState<{ id: string; name: string } | null>(null);
 const query = useInactive(filters); const data = query.data; const busy = query.isFetching;
 const selected = data?.sellers.find(s => s.user_id === selectedId) ?? data?.sellers[0] ?? null;
 const change = (next: Partial<InactiveFilters>) => { setSelectedId(null); setFilters(f => ({ ...f, ...next, page: 0 })); };
 const apply = (event: React.FormEvent) => { event.preventDefault(); const value = validDays(days); if (value === null) { setDayError(true); return; } setDayError(false); change({ days: value, search: search.trim() }); };
 const exportPage = () => { if (!data || busy || query.isError) return; try { const url = URL.createObjectURL(new Blob([inactiveCSV(data, filters.days)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `inativos-${filters.days}d-pagina-${data.page + 1}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch { toast.error("Não foi possível exportar esta página"); } };
 const values = data && !query.isError ? [["Sellers inativos", String(data.totals.count), `${filters.days}+ dias sem atividade`], ["30+ dias", String(data.totals.over30), "Dentro dos filtros aplicados"], ["Volume histórico", money(data.totals.volume), "Vendas aprovadas acumuladas"], ["Taxas históricas", money(data.totals.fees), "Das vendas aprovadas acumuladas"]] : [["Sellers inativos", "—", ""], ["30+ dias", "—", ""], ["Volume histórico", "—", ""], ["Taxas históricas", "—", ""]];
 return <section className="inactive-workspace min-w-0 text-foreground">
  <div className="space-y-5">
  <AdminPageHeader
   title="Sellers inativos"
   subtitle={`Sem login nem tentativa de venda há ${filters.days} dias ou mais. O cadastro inicia a contagem, e inatividade não quer dizer bloqueio nem perda confirmada.`}
   actions={<>
    <Button type="button" variant="outline" size="icon" disabled={busy} aria-label="Atualizar inativos" title="Atualizar inativos" onClick={() => void query.refetch()}><RefreshCw className={`h-4 w-4${busy ? " animate-spin" : ""}`} /></Button>
    <Button type="button" variant="outline" disabled={!data?.sellers.length || busy || query.isError} onClick={exportPage}><Download className="mr-2 h-4 w-4" />CSV desta página</Button>
   </>}
  />
  <PremiumMetricGrid cols={4}>{values.map(([label, value, sub]) => <PremiumMetric key={label} label={label} value={value} sub={sub} />)}</PremiumMetricGrid>
  <p className="-mt-2 text-xs text-muted-foreground">Histórico acumulado, sem vendas simuladas, e não representa saldo disponível. {data && !query.isError && `Atualizado em ${activityDate(data.as_of)} (Brasília).`}</p>
  <form onSubmit={apply} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
   <label className="min-w-[180px] flex-1 text-[13px] font-medium">Buscar seller<Input aria-label="Buscar seller inativo" className="mt-1.5 bg-card" value={search} maxLength={120} placeholder="Nome, e-mail ou ID" onChange={e => setSearch(e.target.value)} /></label>
   <label className="w-[120px] text-[13px] font-medium">Mínimo de dias<Input aria-label="Mínimo de dias inativo" aria-invalid={dayError} type="number" min={1} max={3650} step={1} className="mt-1.5 bg-card" value={days} onChange={e => setDays(e.target.value)} /></label>
   <Button type="submit" size="icon" variant="outline" aria-label="Aplicar filtros de inativos" title="Aplicar filtros"><Search className="h-4 w-4" /></Button>
   <Select value={filters.sort} onValueChange={value => { const parsed = sortSchema.safeParse(value); if (parsed.success) change({ sort: parsed.data }); }}><SelectTrigger aria-label="Ordenar inativos" className="w-[195px] bg-card"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="days">Mais dias inativo</SelectItem><SelectItem value="volume">Maior volume histórico</SelectItem><SelectItem value="fees">Mais taxas históricas</SelectItem><SelectItem value="sales">Mais vendas aprovadas</SelectItem></SelectContent></Select>
   {dayError && <p role="alert" className="w-full text-sm text-destructive">Informe um número inteiro entre 1 e 3650 dias.</p>}
  </form>
  {query.isError ? <div role="alert" className="py-12 text-center"><p className="mb-4 text-sm text-destructive">Não foi possível carregar Inativos. Dados ausentes não representam zero.</p><Button variant="outline" onClick={() => void query.refetch()} disabled={busy}>Tentar novamente</Button></div> : !data ? <div role="status" className="flex items-center justify-center gap-2 py-20"><Loader2 className="h-5 w-5 animate-spin" />Carregando sellers inativos…</div> : <div className="flex min-h-[600px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card xl:flex-row" aria-busy={busy}><InactiveList data={data} selected={selected?.user_id ?? null} onSelect={s => setSelectedId(s.user_id)} onPage={page => { setSelectedId(null); setFilters(f => ({ ...f, page })); }} busy={busy} money={money} /><InactiveDetail seller={selected} money={money} onRecord={() => { if (selected) setRecord({ id: selected.user_id, name: selected.full_name || "Sem nome" }); }} /></div>}
  <Dialog open={Boolean(record)} onOpenChange={open => { if (!open) setRecord(null); }}><DialogContent className="z-[100] max-h-[85dvh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>Ficha do seller · {record?.name}</DialogTitle></DialogHeader>{record && <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin" />}><Seller360 userId={record.id} /></Suspense>}</DialogContent></Dialog>
 </div>
 </section>;
}
