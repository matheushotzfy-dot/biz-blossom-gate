import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, CreditCard, DollarSign, Download, Loader2, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { brl } from "@/features/admin-finance/types";
import { SellerSelect } from "@/features/admin-finance/SellerSelect";
import { usePeople } from "@/features/admin-finance/usePeople";
import { friendlyError } from "@/lib/friendlyError";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "./AdminPremium";
import { TxCards, TxTable, type TxContext } from "@/features/admin-transactions/TransactionRows";
import { TransactionSheet } from "@/features/admin-transactions/TransactionSheet";
import {
  CHARGEBACK_ALERT_PCT, EXPORT_PAGE, PAGE_SIZE, approvalRate, chargebackRate, exportPlan, parsePage, pct, transactionsCsv,
  type StatusKey, type Tx, type TxPage,
} from "@/features/admin-transactions/transactionsModel";

interface Props {
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  dateRange: { from: Date; to: Date };
  /** Só para quem pode abrir as outras abas (Chargeback, Reembolsos). */
  onNavigate?: (tab: string) => void;
}

interface Filters { status: StatusKey; method: string; seller: string; search: string }

async function fetchPage(from: string, to: string, f: Filters, page: number, size: number): Promise<TxPage> {
  const { data, error } = await supabase.rpc("get_admin_transactions_page" as never, {
    _from: from, _to: to, _page: page, _page_size: size, _status: f.status, _method: f.method,
    _seller_id: f.seller || null, _search: f.search.trim() || null,
  } as never);
  if (error) throw error;
  return parsePage(data);
}

export default function AdminTransactionsTab({ profiles, products, dateRange, onNavigate }: Props) {
  const [status, setStatus] = useState<StatusKey>("all");
  const [method, setMethod] = useState("all");
  const [seller, setSeller] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<Tx | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const fromIso = dateRange.from.toISOString();
  const toIso = dateRange.to.toISOString();
  const filters = useMemo<Filters>(() => ({ status, method, seller, search: debounced }), [status, method, seller, debounced]);

  const q = useInfiniteQuery({
    queryKey: ["admin-tx", fromIso, toIso, filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPage(fromIso, toIso, filters, pageParam, PAGE_SIZE),
    getNextPageParam: (last, all) => (all.reduce((n, p) => n + p.items.length, 0) < last.total && last.items.length > 0 ? all.length + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const pages = q.data?.pages ?? [];
  const items = useMemo(() => pages.flatMap((p) => p.items), [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const matching = pages[0]?.total ?? 0;
  const summary = pages[0]?.summary;

  /* ── Nomes de seller e de produto: o que o painel não carregou é buscado sob demanda ── */
  const { nameOf, lookupFailed, retry: retryPeople } = usePeople(profiles, useMemo(() => items.map((t) => t.user_id), [items]));
  const knownProducts = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const missingProducts = useMemo(() => [...new Set(items.map((t) => t.product_id).filter((id): id is string => !!id && !knownProducts.has(id)))].sort().slice(0, 100), [items, knownProducts]);
  const extraProducts = useQuery({
    queryKey: ["admin-tx-products", missingProducts.join(",")],
    enabled: missingProducts.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").in("id", missingProducts);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const productOf = useCallback((id: string | null) => {
    if (!id) return "Sem produto";
    return knownProducts.get(id) ?? extraProducts.data?.find((p) => p.id === id)?.name ?? `Produto ${id.slice(0, 8)}`;
  }, [knownProducts, extraProducts.data]);

  const ctx: TxContext = { nameOf: (id) => nameOf(id), productOf, onOpen: setSelected };

  const filtersActive = status !== "all" || method !== "all" || !!seller || !!search.trim();
  const clearFilters = () => { setStatus("all"); setMethod("all"); setSeller(""); setSearch(""); setDebounced(""); };

  const cbRate = summary ? chargebackRate(summary) : 0;
  const waiting = q.isError ? "Indisponível" : "Carregando…";
  const heroStatus = !summary ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : cbRate >= CHARGEBACK_ALERT_PCT ? { tone: "destructive" as const, label: `Chargeback em ${pct(cbRate, 2)}, acima de ${CHARGEBACK_ALERT_PCT}%`, pulse: true }
      : summary.chargeback > 0 ? { tone: "warning" as const, label: `${summary.chargeback} ${summary.chargeback === 1 ? "chargeback" : "chargebacks"} no período` }
        : { tone: "success" as const, label: "Sem chargebacks no período" };

  /* ── Exportação: busca TODAS as linhas do filtro (até o limite), não só as que estão na tela ── */
  const exportCsv = async () => {
    if (matching === 0) { toast.error("Não há transações para exportar."); return; }
    const plan = exportPlan(matching);
    setExporting(true);
    try {
      const rows: Tx[] = [];
      for (let page = 1; page <= plan.pages; page++) {
        const res = await fetchPage(fromIso, toIso, filters, page, EXPORT_PAGE);
        rows.push(...res.items);
        if (res.items.length === 0) break;
      }
      const names = new Map<string, string>();
      for (const t of rows) if (!names.has(t.user_id)) names.set(t.user_id, nameOf(t.user_id));
      const csv = transactionsCsv(rows.slice(0, plan.count), (id) => names.get(id) ?? "—", productOf);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url; a.download = `transacoes-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      const n = Math.min(rows.length, plan.count);
      if (plan.truncated) toast.warning(`${n.toLocaleString("pt-BR")} de ${matching.toLocaleString("pt-BR")} transações exportadas (limite de ${plan.count.toLocaleString("pt-BR")}). Estreite o período ou os filtros para o resto.`);
      else toast.success(`${n.toLocaleString("pt-BR")} ${n === 1 ? "transação exportada" : "transações exportadas"}.`);
    } catch (e) {
      toast.error("Não foi possível exportar. Nada foi baixado.", { description: friendlyError(e, "Tente de novo em instantes.") });
    } finally {
      setExporting(false);
    }
  };

  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} · ${n.toLocaleString("pt-BR")}`);
  const pills: { value: StatusKey; label: string }[] = [
    { value: "all", label: withCount("Tudo", summary?.total) },
    { value: "completed", label: withCount("Aprovadas", summary?.approved) },
    { value: "pending", label: withCount("Pendentes", summary?.pending) },
    { value: "failed", label: withCount("Recusadas e expiradas", summary?.failed) },
    { value: "refunded", label: withCount("Estornadas", summary?.refunded) },
    { value: "chargeback", label: withCount("Chargebacks", summary?.chargeback) },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero
        eyebrow="Financeiro · Transações" title="Transações"
        subtitle="Todas as vendas da plataforma no período escolhido no topo. Clique numa transação para ver o dossiê."
        status={heroStatus}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => void exportCsv()} disabled={exporting || q.isError}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {exporting ? "Exportando…" : "Exportar CSV"}
            </Button>
          </div>
        )}
      />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={DollarSign} label="Volume aprovado" value={summary ? brl(summary.gross) : "—"} sub={summary ? `${summary.approved.toLocaleString("pt-BR")} vendas aprovadas` : waiting} tone="info" />
        <PremiumMetric icon={CheckCircle2} label="Líquido dos sellers" value={summary ? brl(summary.net) : "—"} sub={summary ? `Taxas ${brl(summary.fees)}` : waiting} tone="success" />
        <PremiumMetric icon={CreditCard} label="Aprovação" value={summary ? pct(approvalRate(summary)) : "—"} sub={summary ? `${summary.approved.toLocaleString("pt-BR")} de ${summary.total.toLocaleString("pt-BR")}` : waiting} tone="primary" />
        <PremiumMetric icon={ShieldAlert} label="Chargeback" value={summary ? pct(cbRate, 2) : "—"} sub={summary ? `${summary.chargeback} ${summary.chargeback === 1 ? "chargeback" : "chargebacks"}` : waiting} tone={cbRate >= CHARGEBACK_ALERT_PCT ? "destructive" : "neutral"} />
      </PremiumMetricGrid>
      <p className="-mt-2 text-[12px] text-muted-foreground">Os números acima consideram o período inteiro e os filtros de método, seller e busca, não só as linhas que aparecem abaixo.</p>

      <PremiumPanel eyebrow="Vendas" title={summary ? `Transações · ${matching.toLocaleString("pt-BR")}` : "Transações"} icon={DollarSign}>
        <div className="mb-4 space-y-3">
          <PremiumSegmented<StatusKey> value={status} onChange={setStatus} options={pills} />
          <p className="text-[12px] text-muted-foreground">Pendente há mais de 24 horas (ou com o Pix vencido) conta como expirada. Mais recentes primeiro.</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Buscar transação" placeholder="Cliente, CPF, e-mail, seller ou código" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }}
                className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
            </div>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger aria-label="Filtrar por método" className="h-10 w-[180px] rounded-xl text-xs"><SelectValue placeholder="Método" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os métodos</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="credit_card">Cartão</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-[230px]"><SellerSelect profiles={profiles} value={seller} onChange={setSeller} allowAll /></div>
            {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
          </div>
          {(lookupFailed || extraProducts.isError) && (
            <p role="alert" className="flex flex-wrap items-center gap-2 text-[12.5px] text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> Alguns nomes de seller ou produto não carregaram.
              <button type="button" className="font-semibold underline" onClick={() => { retryPeople(); void extraProducts.refetch(); }}>Tentar de novo</button>
            </p>
          )}
        </div>

        {q.isError && !q.isFetching ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-[13px]">
            <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Não foi possível carregar as transações.</p>
            <p className="text-muted-foreground">{friendlyError(q.error, "Tente de novo em instantes.")}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void q.refetch()}>Tentar de novo</Button>
          </div>
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando transações…</p>
        ) : items.length === 0 ? (
          <div>
            <PremiumEmpty icon={CreditCard} title="Nenhuma transação aqui" subtitle={filtersActive ? "Nenhuma transação bate com esses filtros neste período." : "Ainda não houve transações neste período."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <TxTable rows={items} ctx={ctx} />
            <TxCards rows={items} ctx={ctx} />
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-[12px] tabular-nums text-muted-foreground">Mostrando {items.length.toLocaleString("pt-BR")} de {matching.toLocaleString("pt-BR")}</p>
              {q.hasNextPage && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                  {q.isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />} Carregar mais
                </Button>
              )}
              {q.isFetchNextPageError && <p role="alert" className="text-[12.5px] text-destructive">Não foi possível carregar mais. Tente de novo.</p>}
            </div>
          </div>
        )}
      </PremiumPanel>

      <TransactionSheet tx={selected} onClose={() => setSelected(null)} nameOf={(id) => nameOf(id)} productOf={productOf} onNavigate={onNavigate} />
    </div>
  );
}
