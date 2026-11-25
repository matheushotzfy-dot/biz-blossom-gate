import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Download, Loader2, Package, RefreshCw, Search, ShoppingCart, Undo2, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { dateKey } from "@/features/admin-finance/overviewModel";
import { ClassTag, Thumb, ToneTag } from "@/features/admin-products/parts";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { cn } from "@/lib/utils";
import { PAGE_SIZE, SORT_NOTE, SORT_PILLS, approval, parseTopProducts, pct, productStateLabel, share, ticket, topProductsCSV, type SortKey, type TopProduct } from "./topProductsModel";

type Money = (v: number) => string;
export interface TopProductsProps { dateRange: { from: Date; to: Date }; fmtCurrency: Money }

const dm = (key: string) => key.split("-").reverse().join("/");
const int = (v: number) => v.toLocaleString("pt-BR");

/** Ranking de produtos do período escolhido no topo do painel. Tudo calculado no servidor, em dias de São Paulo. */
export default function TopProductsCenter(props: TopProductsProps) {
  // trocar o período recomeça a lista na primeira página
  return <Center key={`${dateKey(props.dateRange.from)}:${dateKey(props.dateRange.to)}`} {...props} />;
}

function Center({ dateRange, fmtCurrency: money }: TopProductsProps) {
  const from = dateKey(dateRange.from), to = dateKey(dateRange.to);
  const [sort, setSort] = useState<SortKey>("gross");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ["admin-top-products", from, to, sort, debounced, page],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_top_products" as never, { _from: from, _to: to, _search: debounced || null, _sort: sort, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseTopProducts(data);
    },
    placeholderData: keepPreviousData,
  });

  const data = q.data;
  const items = data?.items ?? [];
  const s = data?.summary;
  const totalGross = s?.gross ?? 0;
  const filtersActive = !!debounced || sort !== "gross";
  const clear = () => { setSort("gross"); setSearch(""); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : int(v));
  const pending = q.isError ? "Indisponível" : "Carregando…";
  const podium = useMemo(() => (page === 1 && !debounced && sort !== "risk" ? items.slice(0, 3) : []), [items, page, debounced, sort]);

  const heroStatus = !s ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : s.sales === 0 ? { tone: "neutral" as const, label: "Nenhuma venda no período" }
      : { tone: s.chargebacks > 0 ? "warning" as const : "success" as const, label: `${int(s.sales)} ${s.sales === 1 ? "venda" : "vendas"} em ${int(s.selling)} ${s.selling === 1 ? "produto" : "produtos"}` };

  const exportPage = () => {
    if (!data || !items.length || q.isFetching) return;
    const blob = new Blob([topProductsCSV(items, from, to, totalGross)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `top-produtos-${from}-${to}-pagina-${page}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" className="gap-2" disabled={q.isFetching} onClick={() => void q.refetch()}>
        <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} /> Atualizar
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-2" disabled={!items.length || q.isFetching || q.isError} onClick={exportPage}>
        <Download className="h-4 w-4" /> CSV desta página
      </Button>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero eyebrow="Conteúdo" title="Top Produtos" subtitle={`Quais produtos mais venderam ${from === to ? `em ${dm(from)}` : `de ${dm(from)} a ${dm(to)}`}, no horário de Brasília.`} status={heroStatus} actions={actions} />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Wallet} label="Faturamento" value={s ? money(s.gross) : "—"} tone="primary" sub={s ? `${money(s.net)} líquido` : pending} />
        <PremiumMetric icon={ShoppingCart} label="Vendas pagas" value={n(s?.sales)} tone="success" sub={s ? `ticket médio ${money(s.sales ? s.gross / s.sales : 0)}` : pending} />
        <PremiumMetric icon={Undo2} label="Reembolsos" value={n(s?.refunds)} tone={s && s.refunds > 0 ? "warning" : "neutral"} sub={s ? (s.refunds > 0 ? `${money(s.refunded)} devolvidos` : "nenhum no período") : pending} />
        <PremiumMetric icon={AlertTriangle} label="Chargebacks" value={n(s?.chargebacks)} tone={s && s.chargebacks > 0 ? "destructive" : "neutral"} sub={s ? (s.chargebacks > 0 ? `${money(s.chargeback_amount)} contestados` : "nenhum no período") : pending} />
      </PremiumMetricGrid>

      {podium.length > 0 && !q.isError && (
        <ol aria-label="Os três primeiros do ranking" className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
          {podium.map((p) => <PodiumCard key={p.product_id} p={p} totalGross={totalGross} money={money} />)}
        </ol>
      )}

      <PremiumPanel title="Ranking completo" icon={BarChart3}>
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <PremiumSegmented<SortKey> value={sort} onChange={(v) => { setSort(v); setPage(1); }} options={SORT_PILLS} />
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Buscar no ranking" placeholder="Produto, seller, e-mail ou código" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
                className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
            </div>
            {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
          </div>
          <p className="text-[13px] text-muted-foreground">{SORT_NOTE[sort]}</p>
        </div>

        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar o ranking." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o ranking…</p>
        ) : items.length === 0 ? (
          <div>
            <PremiumEmpty icon={Package} title={debounced ? "Nada por aqui" : "Nenhuma venda no período"}
              subtitle={debounced ? "Nenhum produto com venda no período bate com essa busca." : "Quando um produto vender nesse período, ele entra no ranking. Troque as datas no topo do painel para ver outros dias."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <RankTable rows={items} totalGross={totalGross} money={money} />
            <RankCards rows={items} totalGross={totalGross} money={money} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={data?.total ?? 0} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      {data && !q.isError && (
        <p className="text-[12.5px] text-muted-foreground">
          Os totais de cima são de toda a operação no período, sem depender da busca. Conta como venda o que está pago agora; reembolso e chargeback contam pelo status atual da venda. Vendas simuladas ficam de fora.
          {data.summary.without_sales > 0 ? ` ${int(data.summary.without_sales)} ${data.summary.without_sales === 1 ? "produto teve tentativas e nenhuma venda" : "produtos tiveram tentativas e nenhuma venda"} no período, e por isso não aparece${data.summary.without_sales === 1 ? "" : "m"} no ranking.` : ""}
          {data.generatedAt ? ` Consultado em ${new Date(data.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` : ""}
        </p>
      )}
    </div>
  );
}

function PodiumCard({ p, totalGross, money }: { p: TopProduct; totalGross: number; money: Money }) {
  const first = p.rank === 1;
  return (
    <li className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-[16px] border bg-card p-5 md:grid-cols-[repeat(2,minmax(0,1fr))] md:items-center md:gap-x-8 xl:grid-cols-[minmax(0,1fr)]", first ? "border-primary/50 shadow-sm" : "border-border/60")}>
      <div className="flex min-w-0 items-center gap-3">
        <Thumb url={p.image_url} name={p.name} size={52} />
        <div className="min-w-0">
          <p className={cn("text-[13px] font-semibold tabular-nums", first ? "text-primary" : "text-muted-foreground")}>{p.rank}º lugar</p>
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground" title={p.name}>{p.name}</p>
          <p className="truncate text-[13px] text-muted-foreground">{p.seller_name}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <p className="font-display text-[26px] font-semibold leading-none tabular-nums text-foreground">{money(p.gross)}</p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{int(p.sales)} {p.sales === 1 ? "venda" : "vendas"} · ticket médio {money(ticket(p))}</p>
        </div>
        <ShareBar value={share(p.gross, totalGross)} long />
      </div>
      <div className="md:col-span-2 xl:col-span-1 empty:hidden"><Flags p={p} /></div>
    </li>
  );
}

function ShareBar({ value, long }: { value: number; long?: boolean }) {
  const width = `${Math.min(100, Math.max(value > 0 ? 2 : 0, value))}%`;
  return (
    <div title="Parte do faturamento de todos os produtos no período">
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width }} />
        </div>
        {!long && <span className="w-[52px] shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">{pct(value)}</span>}
      </div>
      {long && <p className="mt-1.5 text-[13px] text-muted-foreground">{pct(value)} do faturamento do período</p>}
    </div>
  );
}

/** Situação do produto e contestações, só quando há algo a dizer. */
function Flags({ p }: { p: TopProduct }) {
  const state = productStateLabel(p);
  if (!state && p.classification === "white" && p.refunds === 0 && p.chargebacks === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {state && <ToneTag tone={p.deleted ? "destructive" : "warning"}>{state}</ToneTag>}
      {p.classification !== "white" && <ClassTag value={p.classification} />}
      {p.chargebacks > 0 && <ToneTag tone="destructive">{p.chargebacks} {p.chargebacks === 1 ? "chargeback" : "chargebacks"}</ToneTag>}
      {p.refunds > 0 && <ToneTag tone="neutral">{p.refunds} {p.refunds === 1 ? "reembolso" : "reembolsos"}</ToneTag>}
    </div>
  );
}

const Name = ({ p }: { p: TopProduct }) => (
  <div className="flex min-w-0 items-center gap-3">
    <Thumb url={p.image_url} name={p.name} size={40} />
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-foreground" title={p.name}>{p.name}</p>
      <p className="truncate text-[13px] text-muted-foreground" title={p.seller_email ?? undefined}>{p.seller_name}</p>
    </div>
  </div>
);

const Rank = ({ n }: { n: number }) => <span className="text-[14px] font-semibold tabular-nums text-muted-foreground">{n}º</span>;

function Issues({ p }: { p: TopProduct }) {
  if (p.chargebacks === 0 && p.refunds === 0) return <span className="text-[13px] text-muted-foreground">Nenhuma</span>;
  return (
    <div className="space-y-0.5 text-[13px]">
      {p.chargebacks > 0 && <p className="font-semibold text-destructive">{p.chargebacks} {p.chargebacks === 1 ? "chargeback" : "chargebacks"}</p>}
      {p.refunds > 0 && <p className="text-muted-foreground">{p.refunds} {p.refunds === 1 ? "reembolso" : "reembolsos"}</p>}
    </div>
  );
}

function RankTable({ rows, totalGross, money }: { rows: TopProduct[]; totalGross: number; money: Money }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["", "Produto e seller", "Vendas", "Faturamento", "Aprovação", "Contestações", "Participação"].map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.product_id} className={cn("border-b border-border/40 align-middle last:border-b-0", p.deleted && "opacity-75")}>
              <td className="w-10 px-4 py-3"><Rank n={p.rank} /></td>
              <td className="max-w-[300px] px-4 py-3">
                <Name p={p} />
                {(productStateLabel(p) || p.classification !== "white") && <div className="mt-1.5 pl-[52px]"><Flags p={{ ...p, refunds: 0, chargebacks: 0 }} /></div>}
              </td>
              <td className="whitespace-nowrap px-4 py-3"><p className="text-[14px] font-semibold tabular-nums text-foreground">{int(p.sales)}</p><p className="text-[12.5px] tabular-nums text-muted-foreground">ticket {money(ticket(p))}</p></td>
              <td className="whitespace-nowrap px-4 py-3"><p className="text-[14px] font-semibold tabular-nums text-foreground">{money(p.gross)}</p><p className="text-[12.5px] tabular-nums text-muted-foreground">{money(p.net)} líquido</p></td>
              <td className="whitespace-nowrap px-4 py-3 text-[14px] tabular-nums text-muted-foreground" title={`${int(p.sales)} pagas em ${int(p.attempts)} tentativas`}>{pct(approval(p))}</td>
              <td className="whitespace-nowrap px-4 py-3"><Issues p={p} /></td>
              <td className="min-w-[200px] px-4 py-3"><ShareBar value={share(p.gross, totalGross)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankCards({ rows, totalGross, money }: { rows: TopProduct[]; totalGross: number; money: Money }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((p) => (
        <li key={p.product_id} className={cn("flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4", p.deleted && "opacity-75")}>
          <div className="flex items-start gap-3">
            <div className="pt-2.5"><Rank n={p.rank} /></div>
            <div className="min-w-0 flex-1"><Name p={p} /></div>
          </div>
          <Flags p={{ ...p, refunds: 0, chargebacks: 0 }} />
          <dl className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 border-t border-border/40 pt-3">
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Vendas</dt><dd className="text-[14px] font-semibold tabular-nums text-foreground">{int(p.sales)}</dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Faturamento</dt><dd className="break-words text-[14px] font-semibold tabular-nums text-foreground">{money(p.gross)}</dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Líquido</dt><dd className="break-words text-[14px] tabular-nums text-foreground">{money(p.net)}</dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Ticket médio</dt><dd className="break-words text-[14px] tabular-nums text-foreground">{money(ticket(p))}</dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Aprovação</dt><dd className="text-[14px] tabular-nums text-foreground">{pct(approval(p))}</dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Contestações</dt><dd><Issues p={p} /></dd></div>
          </dl>
          <ShareBar value={share(p.gross, totalGross)} />
        </li>
      ))}
    </ul>
  );
}
