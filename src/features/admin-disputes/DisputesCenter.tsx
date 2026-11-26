import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Lock, Loader2, Plus, Scale, Search, ShieldCheck, Undo2, X, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { brl } from "@/features/admin-finance/types";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { DisputeSheet } from "./DisputeSheet";
import { DisputesCards, DisputesTable } from "./DisputesList";
import { OpenDisputeDialog } from "./OpenDisputeDialog";
import { RefundDialog } from "./RefundDialog";
import { PAGE_COPY, PAGE_SIZE, STATUS_PILLS, TYPES, parseDisputesPage, type DisputeItem, type StatusFilter, type TypeFilter } from "./disputesModel";

interface Props { initialType?: TypeFilter; onNavigate?: (tab: string) => void }

/** MED Pix, pré-MED, chargeback e reembolsos: um lugar só, lido do servidor por página, com o valor congelado e a decisão registrada com senha. */
export default function DisputesCenter({ initialType = "all", onNavigate }: Props) {
  const qc = useQueryClient();
  const [type, setType] = useState<TypeFilter>(initialType);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [refundDialog, setRefundDialog] = useState(false);

  useEffect(() => { setType(initialType); setStatus("active"); setPage(1); }, [initialType]);

  const q = useQuery({
    queryKey: ["admin-disputes", type, status, debounced, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_disputes_page" as never, { _type: type === "all" ? null : type, _status: status, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseDisputesPage(data);
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const ch = supabase.channel(uniqueChannelName("admin-disputes-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => { void qc.invalidateQueries({ queryKey: ["admin-disputes"] }); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const s = q.data?.summary;
  const counts = q.data?.typeCounts;
  const now = useMemo(() => Date.now(), [q.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected: DisputeItem | null = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  const copy = PAGE_COPY[type];
  const filtersActive = status !== "active" || !!debounced;
  const clear = () => { setStatus("active"); setSearch(""); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";

  const heroStatus = !s ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : s.overdue > 0 ? { tone: "destructive" as const, label: `${s.overdue} com prazo vencido`, pulse: true }
      : s.active > 0 ? { tone: "warning" as const, label: `${s.active} em aberto` } : { tone: "success" as const, label: "Nada em aberto" };

  const withCount = (label: string, c?: number) => (c === undefined ? label : `${label} · ${c.toLocaleString("pt-BR")}`);
  const typePills = useMemo<{ value: TypeFilter; label: string }[]>(() => [
    { value: "all", label: withCount("Todos", counts?.all) },
    ...TYPES.map((t) => ({ value: t.value as TypeFilter, label: withCount(t.label, counts?.[t.value]) })),
  ], [counts]);
  const statusPills = useMemo(() => STATUS_PILLS.map((p) => ({
    ...p, label: withCount(p.label, s ? (p.value === "active" ? s.active : p.value === "seller" ? s.seller : p.value === "buyer" ? s.buyer : s.all) : undefined),
  })), [s]);

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader eyebrow="Financeiro" title={copy.title} subtitle={copy.subtitle} status={heroStatus}
        actions={<>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRefundDialog(true)}><Undo2 className="h-3.5 w-3.5" /> Reembolsar venda</Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setOpenDialog(true)}><Plus className="h-3.5 w-3.5" /> Abrir disputa</Button>
        </>} />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Scale} label="Em aberto" value={n(s?.active)} tone={s && s.active > 0 ? "warning" : "neutral"}
          sub={s ? `${s.open} ${s.open === 1 ? "nova" : "novas"} · ${s.in_review} em análise` : pending} />
        <PremiumMetric icon={Lock} label="Congelado nos sellers" value={s ? brl(s.held) : "—"} tone="info" sub={s ? `de ${brl(s.active_amount)} contestados` : pending} />
        <PremiumMetric icon={Clock} label="Prazo vencido" value={n(s?.overdue)} tone={s && s.overdue > 0 ? "destructive" : s && s.soon > 0 ? "warning" : "neutral"}
          sub={s ? (s.soon > 0 ? `${s.soon} vence${s.soon === 1 ? "" : "m"} em 48 h` : "nenhum vence em 48 h") : pending} />
        <PremiumMetric icon={CheckCheck} label="Já decididas" value={s ? (s.seller + s.buyer).toLocaleString("pt-BR") : "—"}
          sub={s ? `${s.seller} a favor · ${s.buyer} contra` : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Disputas" icon={Scale}>
        <div className="mb-4 space-y-3">
          <PremiumSegmented<TypeFilter> value={type} onChange={(v) => { setType(v); setPage(1); }} options={typePills} />
          <div className="flex flex-wrap items-center gap-3">
            <PremiumSegmented<StatusFilter> value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={statusPills} />
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Buscar disputas" placeholder="Seller, comprador, e-mail ou ID da venda" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
                className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
            </div>
            {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
          </div>
        </div>

        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar as disputas." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as disputas…</p>
        ) : items.length === 0 ? (
          <div>
            <PremiumEmpty icon={ShieldCheck} title={filtersActive ? "Nada por aqui" : status === "active" ? "Nenhuma disputa em aberto" : "Nenhuma disputa neste filtro"}
              subtitle={filtersActive ? "Nenhuma disputa bate com esses filtros." : "Quando um comprador contestar uma venda, ela aparece aqui com o valor congelado."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <DisputesTable rows={items} now={now} onOpen={(d) => setSelectedId(d.id)} />
            <DisputesCards rows={items} now={now} onOpen={(d) => setSelectedId(d.id)} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <DisputeSheet item={selected} onClose={() => setSelectedId(null)} />
      <OpenDisputeDialog open={openDialog} defaultType={type} onClose={() => setOpenDialog(false)} />
      <RefundDialog open={refundDialog} onClose={() => setRefundDialog(false)} onNavigate={onNavigate} />
    </div>
  );
}
