import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Handshake, Loader2, MousePointerClick, Receipt, Search, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { brl } from "@/features/admin-finance/types";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { AffiliateSheet } from "./AffiliateSheet";
import { AffiliatesCards, AffiliatesTable, ProductsCards, ProductsTable } from "./AffiliatesList";
import { FILTER_PILLS, PAGE_SIZE, parseAffiliatesPage, parseProductsPage, type AffiliateItem, type FilterValue, type View } from "./affiliatesModel";

const VIEWS: { value: View; label: string }[] = [{ value: "affiliates", label: "Afiliados" }, { value: "products", label: "Produtos" }];

/** Programa de afiliados de todos os sellers: quem divulga, quanto vendeu e a ação de pausar quem abusa. Só administrador. */
export default function AffiliatesCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={Handshake} title="A curadoria de afiliados é do administrador" subtitle="Peça ao administrador para revisar ou pausar um afiliado." />;
  return <Center />;
}

function Center() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("affiliates");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const byAffiliate = view === "affiliates";

  const aq = useQuery({
    queryKey: ["admin-affiliates", filter, debounced, page],
    enabled: byAffiliate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_affiliates_page" as never, { _filter: filter, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseAffiliatesPage(data);
    },
    placeholderData: keepPreviousData,
  });

  const pq = useQuery({
    queryKey: ["admin-affiliate-products", debounced, page],
    enabled: !byAffiliate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_affiliate_products_page" as never, { _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseProductsPage(data);
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ["admin-affiliates"] });
      void qc.invalidateQueries({ queryKey: ["admin-affiliate-products"] });
    };
    const ch = supabase.channel(uniqueChannelName("admin-affiliates-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliate_links" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliate_sales" }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const q = byAffiliate ? aq : pq;
  const aItems = aq.data?.items ?? [];
  const pItems = pq.data?.items ?? [];
  const count = byAffiliate ? aItems.length : pItems.length;
  const total = (byAffiliate ? aq.data?.total : pq.data?.total) ?? 0;
  // Os números do topo vêm da aba de afiliados; na aba de produtos usam o que já carregou.
  const prog = aq.data?.program ?? null;
  const s = aq.data?.summary;
  const seed: AffiliateItem | null = useMemo(() => aItems.find((i) => i.user_id === selectedId) ?? null, [aItems, selectedId]);

  const filtersActive = (byAffiliate && filter !== "all") || !!debounced;
  const clear = () => { setFilter("all"); setSearch(""); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = aq.isError ? "Indisponível" : "Carregando…";

  const heroStatus = !prog ? (aq.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : prog.links_held > 0 ? { tone: "warning" as const, label: `${prog.links_held} ${prog.links_held === 1 ? "link pausado pela equipe" : "links pausados pela equipe"}`, pulse: true }
      : { tone: "success" as const, label: `${prog.links_active} ${prog.links_active === 1 ? "link no ar" : "links no ar"}` };

  const pills = useMemo(() => FILTER_PILLS.map((p) => ({ ...p, label: s ? `${p.label} · ${s[p.value].toLocaleString("pt-BR")}` : p.label })), [s]);

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero eyebrow="Conteúdo" title="Afiliados" subtitle="Quem divulga os produtos dos sellers. Veja quanto cada afiliado vendeu e pause quem estiver burlando o programa." status={heroStatus} />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Handshake} label="Afiliados" value={n(prog?.affiliates)} sub={prog ? `${prog.links.toLocaleString("pt-BR")} ${prog.links === 1 ? "link criado" : "links criados"}` : pending} />
        <PremiumMetric icon={CheckCircle2} label="Links no ar" value={n(prog?.links_active)} tone="success" sub={prog ? `${prog.clicks.toLocaleString("pt-BR")} ${prog.clicks === 1 ? "clique" : "cliques"}` : pending} />
        <PremiumMetric icon={Wallet} label="Comissão líquida" value={prog ? brl(prog.commission) : "—"} sub={prog ? (prog.reversed > 0 ? `${brl(prog.reversed)} estornados` : "nenhum estorno") : pending} />
        <PremiumMetric icon={Receipt} label="Vendas por afiliado" value={n(prog?.sales)} sub={prog ? `${brl(prog.revenue)} vendidos` : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Programa de afiliados" icon={MousePointerClick}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PremiumSegmented<View> value={view} onChange={(v) => { setView(v); setPage(1); setSelectedId(null); }} options={VIEWS} />
          {byAffiliate && <PremiumSegmented<FilterValue> value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={pills} />}
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label={byAffiliate ? "Buscar afiliados" : "Buscar produtos"} placeholder={byAffiliate ? "Nome ou e-mail do afiliado" : "Produto, seller ou e-mail"} value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>

        {q.isError && !q.isFetching ? (
          <ErrorBlock title={byAffiliate ? "Não foi possível carregar os afiliados." : "Não foi possível carregar os produtos."} error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {byAffiliate ? "Carregando os afiliados…" : "Carregando os produtos…"}</p>
        ) : count === 0 ? (
          <div>
            <PremiumEmpty icon={Handshake} title={filtersActive ? "Nada por aqui" : byAffiliate ? "Nenhum afiliado ainda" : "Nenhum produto aberto a afiliados"}
              subtitle={filtersActive ? "Nada bate com esses filtros." : byAffiliate ? "Quando alguém criar um link de afiliado, ele aparece aqui." : "Quando um seller abrir um produto para afiliados, ele aparece aqui."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            {byAffiliate ? (
              <>
                <AffiliatesTable rows={aItems} onOpen={(a) => setSelectedId(a.user_id)} />
                <AffiliatesCards rows={aItems} onOpen={(a) => setSelectedId(a.user_id)} />
              </>
            ) : (
              <>
                <ProductsTable rows={pItems} />
                <ProductsCards rows={pItems} />
              </>
            )}
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <AffiliateSheet id={selectedId} seed={seed} onClose={() => setSelectedId(null)} />
    </div>
  );
}
