import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCircle2, Clock, Loader2, Package, PackageX, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { ProductSheet } from "./ProductSheet";
import { ProductsCards, ProductsTable } from "./ProductsList";
import { CLASS_PILLS, PAGE_SIZE, STATUS_PILLS, parseProductsPage, type ClassFilter, type ProductItem, type StatusFilter } from "./productsModel";

/** Curadoria de produtos: fila de análise, produtos no ar, inativos e apagados. Tudo lido do servidor por página; toda ação passa por RPC com senha e auditoria. */
export default function ProductsCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={Package} title="A curadoria de produtos é do administrador" subtitle="Peça ao administrador para aprovar, desativar ou classificar produtos." />;
  return <Center />;
}

function Center() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("live");
  const [cls, setCls] = useState<ClassFilter>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-products", status, cls, debounced, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_products_page" as never, { _status: status, _class: cls === "all" ? null : cls, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseProductsPage(data);
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const ch = supabase.channel(uniqueChannelName("admin-products-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => { void qc.invalidateQueries({ queryKey: ["admin-products"] }); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const s = q.data?.summary;
  const counts = q.data?.classCounts;
  const seed: ProductItem | null = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  const filtersActive = status !== "live" || cls !== "all" || !!debounced;
  const clear = () => { setStatus("live"); setCls("all"); setSearch(""); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";

  const heroStatus = !s ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : s.pending_review > 0 ? { tone: "warning" as const, label: `${s.pending_review} esperando análise`, pulse: true }
      : { tone: "success" as const, label: "Nenhum esperando análise" };

  const withCount = (label: string, c?: number) => (c === undefined ? label : `${label} · ${c.toLocaleString("pt-BR")}`);
  const statusPills = useMemo(() => STATUS_PILLS.map((p) => ({ ...p, label: withCount(p.label, s?.[p.value]) })), [s]);
  const classPills = useMemo(() => CLASS_PILLS.map((p) => ({ ...p, label: withCount(p.label, counts?.[p.value]) })), [counts]);

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader eyebrow="Conteúdo" title="Produtos" subtitle="Aprove o que entra no ar, tire o que não deveria estar e acompanhe as vendas de cada produto."
        status={heroStatus} />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Clock} label="Esperando análise" value={n(s?.pending_review)} tone={s && s.pending_review > 0 ? "warning" : "neutral"}
          sub={s ? (s.pending_review > 0 ? "os mais antigos primeiro" : "fila vazia") : pending} />
        <PremiumMetric icon={CheckCircle2} label="No ar" value={n(s?.active)} tone="success" sub={s ? "ativos no checkout" : pending} />
        <PremiumMetric icon={PackageX} label="Inativos" value={n(s?.inactive)} sub={s ? "fora do ar" : pending} />
        <PremiumMetric icon={Archive} label="Apagados" value={n(s?.deleted)} sub={s ? "dá para restaurar" : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Produtos" icon={Package}>
        <div className="mb-4 space-y-3">
          <PremiumSegmented<StatusFilter> value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={statusPills} />
          <div className="flex flex-wrap items-center gap-3">
            <PremiumSegmented<ClassFilter> value={cls} onChange={(v) => { setCls(v); setPage(1); }} options={classPills} />
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Buscar produtos" placeholder="Produto, seller, e-mail ou código" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
                className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
            </div>
            {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
          </div>
        </div>

        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar os produtos." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando os produtos…</p>
        ) : items.length === 0 ? (
          <div>
            <PremiumEmpty icon={status === "deleted" ? Trash2 : ShieldCheck} title={filtersActive ? "Nada por aqui" : "Nenhum produto cadastrado ainda"}
              subtitle={filtersActive ? "Nenhum produto bate com esses filtros." : "Quando um seller criar um produto, ele aparece aqui."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <ProductsTable rows={items} onOpen={(p) => setSelectedId(p.id)} />
            <ProductsCards rows={items} onOpen={(p) => setSelectedId(p.id)} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <ProductSheet id={selectedId} seed={seed} onClose={() => setSelectedId(null)} />
    </div>
  );
}
