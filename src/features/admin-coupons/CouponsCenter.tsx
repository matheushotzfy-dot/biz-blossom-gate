import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Receipt, Search, ShieldOff, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { brl } from "@/features/admin-finance/types";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { CouponSheet } from "./CouponSheet";
import { CouponsCards, CouponsTable } from "./CouponsList";
import { PAGE_SIZE, STATUS_PILLS, parseCouponsPage, type CouponItem, type StatusFilter } from "./couponsModel";

/** Cupons de todos os sellers: o uso real, o desconto dado e a ação de pausar quem abusa. Só administrador. */
export default function CouponsCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={Tag} title="A curadoria de cupons é do administrador" subtitle="Peça ao administrador para revisar ou pausar um cupom." />;
  return <Center />;
}

function Center() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-coupons", status, debounced, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_coupons_page" as never, { _status: status, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseCouponsPage(data);
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const ch = supabase.channel(uniqueChannelName("admin-coupons-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, () => { void qc.invalidateQueries({ queryKey: ["admin-coupons"] }); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const items = q.data?.items ?? [];
  const s = q.data?.summary;
  const seed: CouponItem | null = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  const filtersActive = status !== "all" || !!debounced;
  const clear = () => { setStatus("all"); setSearch(""); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";

  const heroStatus = !s ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : s.full_discount > 0 ? { tone: "warning" as const, label: `${s.full_discount} ${s.full_discount === 1 ? "cupom de 100% no ar" : "cupons de 100% no ar"}`, pulse: true }
      : { tone: "success" as const, label: `${s.active} no ar, nenhum de 100%` };

  const pills = useMemo(() => STATUS_PILLS.map((p) => ({ ...p, label: s ? `${p.label} · ${s[p.value].toLocaleString("pt-BR")}` : p.label })), [s]);

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero eyebrow="Conteúdo" title="Cupons" subtitle="Os cupons que os sellers criaram. Veja quanto desconto saiu e pause o que estiver sendo usado de forma indevida." status={heroStatus} />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={CheckCircle2} label="No ar" value={n(s?.active)} tone="success" sub={s ? `de ${s.all.toLocaleString("pt-BR")} ${s.all === 1 ? "cupom" : "cupons"}` : pending} />
        <PremiumMetric icon={Receipt} label="Vendas com cupom" value={n(s?.sales)} sub={s ? `${s.buyers.toLocaleString("pt-BR")} ${s.buyers === 1 ? "comprador" : "compradores"}` : pending} />
        <PremiumMetric icon={Tag} label="Desconto dado" value={s ? brl(s.discount) : "—"} tone={s && s.discount > 0 ? "warning" : "neutral"} sub={s ? "só vendas pagas" : pending} />
        <PremiumMetric icon={s && s.held > 0 ? ShieldOff : AlertTriangle} label="Pausados pela equipe" value={n(s?.held)} tone={s && s.held > 0 ? "destructive" : "neutral"} sub={s ? (s.held > 0 ? "seller não reativa" : "nenhum") : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Cupons" icon={Tag}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PremiumSegmented<StatusFilter> value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={pills} />
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar cupons" placeholder="Código, produto, seller ou e-mail" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>

        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar os cupons." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando os cupons…</p>
        ) : items.length === 0 ? (
          <div>
            <PremiumEmpty icon={Tag} title={filtersActive ? "Nada por aqui" : "Nenhum cupom criado ainda"}
              subtitle={filtersActive ? "Nenhum cupom bate com esses filtros." : "Quando um seller criar um cupom, ele aparece aqui."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <CouponsTable rows={items} onOpen={(c) => setSelectedId(c.id)} />
            <CouponsCards rows={items} onOpen={(c) => setSelectedId(c.id)} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={q.data?.total ?? 0} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <CouponSheet id={selectedId} seed={seed} onClose={() => setSelectedId(null)} />
    </div>
  );
}
