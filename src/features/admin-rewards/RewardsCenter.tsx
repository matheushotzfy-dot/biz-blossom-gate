import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, Package, Search, Timer, Trophy, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { agoLabel } from "@/features/admin-errors/errorsModel";
import { Chip } from "@/features/admin-settings/Chip";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { ClaimList } from "./ClaimList";
import { ClaimSheet } from "./ClaimSheet";
import { TiersPanel } from "./TiersPanel";
import { LIST_KEY, callRpc, useRefreshRewards } from "./rewardsApi";
import { FILTER_PILLS, PAGE_SIZE, daysLabel, emptyCopy, parseClaimsPage, type ClaimFilter } from "./rewardsModel";

type View = "pedidos" | "pecas";

/** Premiações: os pedidos de brinde dos sellers e as peças que aparecem na página deles. Só administrador. */
export default function RewardsCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={Trophy} title="A gestão de premiações é do administrador" subtitle="Peça ao administrador para acompanhar os pedidos." />;
  return <Center />;
}

function Center() {
  const refresh = useRefreshRewards();
  const [view, setView] = useState<View>("pedidos");
  const [filter, setFilter] = useState<ClaimFilter>("open");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: [...LIST_KEY, filter, debounced, page],
    queryFn: async () => parseClaimsPage(await callRpc("get_admin_reward_claims_page", { _status: filter, _search: debounced || null, _page: page, _page_size: PAGE_SIZE })),
    placeholderData: keepPreviousData,
  });

  // pedido novo, mudança de etapa feita por outra pessoa da equipe, peça editada: atualiza, mas espera a rajada passar
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(timer); timer = setTimeout(refresh, 800); };
    const ch = supabase.channel(uniqueChannelName("admin-rewards-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_claims" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "award_tiers" }, bump)
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prog = q.data?.program ?? null;
  const rows = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const counts = q.data?.counts;

  useEffect(() => { if (q.data && rows.length === 0 && page > 1) setPage(1); }, [q.data, rows.length, page]);

  const searching = !!debounced;
  const filtersActive = searching || filter !== "open";
  const clear = () => { setSearch(""); setFilter("open"); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";
  const empty = emptyCopy(filter, searching, (prog?.total ?? 0) > 0);
  const pills = useMemo(() => FILTER_PILLS.map((p) => ({ ...p, count: counts ? counts[p.value] : null })), [counts]);

  const heroStatus = !prog ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : prog.pending > 0 ? { tone: "warning" as const, label: `${prog.pending.toLocaleString("pt-BR")} ${prog.pending === 1 ? "pedido aguarda" : "pedidos aguardam"} análise`, pulse: true }
      : prog.total === 0 ? { tone: "neutral" as const, label: "Nenhum pedido ainda" }
        : { tone: "success" as const, label: "Nenhum pedido aguardando" };

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader eyebrow="Conteúdo" title="Premiações" status={heroStatus}
        subtitle="Os pedidos de brinde que os sellers fazem ao bater uma meta, e as peças que aparecem na página de Premiações deles." />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Clock} label="Aguardando análise" value={n(prog?.pending)} tone={prog && prog.pending > 0 ? "warning" : undefined}
          sub={prog ? (prog.pending_since ? `mais antigo ${agoLabel(prog.pending_since)}` : "nenhum esperando") : pending} />
        <PremiumMetric icon={Package} label="Em andamento" value={n(prog?.in_progress)} tone={prog && prog.in_progress > 0 ? "info" : undefined}
          sub={prog ? "em preparo ou a caminho" : pending} />
        <PremiumMetric icon={CheckCircle2} label="Entregues em 30 dias" value={n(prog?.delivered_30d)} sub={prog ? "pedidos concluídos" : pending} />
        <PremiumMetric icon={Timer} label="Pedido até a entrega" value={prog ? (prog.median_days_to_deliver === null ? "—" : daysLabel(prog.median_days_to_deliver)) : "—"}
          sub={prog ? (prog.delivered_sample > 0 ? "mediana, últimos 90 dias" : "sem entregas em 90 dias") : pending} />
      </PremiumMetricGrid>

      <PremiumSegmented<View> value={view} onChange={setView} options={[{ value: "pedidos", label: "Pedidos" }, { value: "pecas", label: "Peças" }]} />

      {view === "pecas" ? (
        <PremiumPanel title="Peças de premiação" icon={Trophy}><TiersPanel /></PremiumPanel>
      ) : (
        <PremiumPanel>
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input aria-label="Buscar pedidos" placeholder="Seller, destinatário, cidade, rastreio ou código" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
                  className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
              </div>
              {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
            </div>
            <div role="group" aria-label="Situação do pedido" className="flex flex-wrap gap-1.5">
              {pills.map((p) => (
                <Chip key={p.value} active={filter === p.value} onClick={() => { setFilter(p.value); setPage(1); }} className="!h-8 !px-3 !text-[12.5px]">
                  {p.label}{p.count !== null ? ` · ${p.count.toLocaleString("pt-BR")}` : ""}
                </Chip>
              ))}
            </div>
          </div>

          {q.isError && !q.isFetching ? (
            <ErrorBlock title="Não foi possível carregar os pedidos." error={q.error} onRetry={() => void q.refetch()} />
          ) : q.isPending ? (
            <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando os pedidos…</p>
          ) : rows.length === 0 ? (
            <div>
              <PremiumEmpty icon={Trophy} title={empty.title} subtitle={empty.subtitle} />
              {filtersActive && (prog?.total ?? 0) > 0 && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
            </div>
          ) : (
            <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
              <div className="overflow-hidden rounded-[12px] border border-border/60">
                <ClaimList rows={rows} selectedId={selectedId} onSelect={setSelectedId} />
              </div>
              <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
            </div>
          )}
        </PremiumPanel>
      )}

      <ClaimSheet id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
