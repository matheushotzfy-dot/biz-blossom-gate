import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Hourglass, IdCard, Loader2, Search, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { QUEUE_FILTERS, parseQueue, waitingLabel, type QueueFilter, type QueueItem } from "@/features/kyc/kycReviewModel";
import { KycQueueList } from "./KycQueueList";
import { KycReviewSheet } from "./KycReviewSheet";

const PAGE_SIZE = 25;

/** Fila de verificação de identidade: quem enviou documentos, há quanto tempo espera e a análise de cada um. Só administrador. */
export default function KycCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={IdCard} title="A fila de verificação é do administrador" subtitle="A equipe analisa as contas da própria carteira em Sellers." />;
  return <Center />;
}

function Center() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<QueueFilter>("pending_review");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-kyc", filter, debounced, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_kyc_queue" as never, { _status: filter, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseQueue(data);
    },
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(t); t = setTimeout(() => { void qc.invalidateQueries({ queryKey: ["admin-kyc"] }); }, 800); };
    const ch = supabase.channel(uniqueChannelName("admin-kyc-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_submissions" }, bump)
      .subscribe();
    return () => { clearTimeout(t); void supabase.removeChannel(ch); };
  }, [qc]);

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const s = q.data?.summary;
  const seed: QueueItem | null = useMemo(() => items.find((i) => i.userId === openId) ?? null, [items, openId]);

  const filtersActive = filter !== "pending_review" || !!debounced;
  const clear = () => { setFilter("pending_review"); setSearch(""); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";

  const heroStatus = !s ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : s.pendingReview > 0 ? { tone: "warning" as const, label: `${s.pendingReview.toLocaleString("pt-BR")} esperando análise`, pulse: true }
      : { tone: "success" as const, label: "Fila em dia" };

  const pills = useMemo(() => QUEUE_FILTERS.map((p) => {
    if (!s) return p;
    const c = p.value === "pending_review" ? s.pendingReview : p.value === "pending" ? s.pending : p.value === "rejected" ? s.rejected : p.value === "approved" ? s.approved : s.pendingReview + s.pending + s.rejected + s.approved;
    return { ...p, label: `${p.label} · ${c.toLocaleString("pt-BR")}` };
  }), [s]);

  const onDecided = (kind: "approved" | "rejected") => {
    toast.success(kind === "approved" ? "Verificação aprovada. O seller foi avisado." : "Verificação reprovada. O seller recebeu o motivo.");
    void qc.invalidateQueries({ queryKey: ["admin-kyc"] });
    // Só marca como velha: refazer a leitura agora gravaria outra abertura na auditoria sem ninguém olhando.
    void qc.invalidateQueries({ queryKey: ["kyc-review"], refetchType: "none" });
    // Próximo da fila, para quem está analisando em sequência.
    const idx = items.findIndex((i) => i.userId === openId);
    const next = filter === "pending_review" ? items.find((i, k) => k > idx && i.status === "pending_review") ?? items.find((i, k) => k < idx && i.status === "pending_review") : null;
    setOpenId(next?.userId ?? null);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader eyebrow="Operacional" title="Verificações" status={heroStatus}
        subtitle="Documentos que os sellers enviaram para liberar a conta. Compare com o cadastro, aprove ou reprove com um motivo que o seller entenda." />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Hourglass} label="Esperando análise" value={n(s?.pendingReview)} tone={s && s.pendingReview > 0 ? "warning" : undefined}
          sub={s ? (s.pendingReview > 0 ? `a mais antiga ${waitingLabel(s.oldestWaitingAt)}` : "ninguém na fila") : pending}
          onClick={s && s.pendingReview > 0 ? () => { setFilter("pending_review"); setPage(1); } : undefined} />
        <PremiumMetric icon={Clock} label="Sem envio" value={n(s?.pending)} sub={s ? "contas que ainda não enviaram" : pending}
          onClick={s && s.pending > 0 ? () => { setFilter("pending"); setPage(1); } : undefined} />
        <PremiumMetric icon={XCircle} label="Reprovadas" value={n(s?.rejected)} sub={s ? "esperando novo envio" : pending}
          onClick={s && s.rejected > 0 ? () => { setFilter("rejected"); setPage(1); } : undefined} />
        <PremiumMetric icon={CheckCircle2} label="Decididas em 7 dias" value={n(s?.decided7d)} tone={s && s.approved7d > 0 ? "success" : undefined}
          sub={s ? `${s.approved7d.toLocaleString("pt-BR")} ${s.approved7d === 1 ? "aprovada" : "aprovadas"}` : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Fila de verificação" icon={IdCard}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PremiumSegmented<QueueFilter> value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={pills} />
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar verificações" placeholder="Nome, e-mail ou início do CPF/CNPJ" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>

        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar a fila." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando a fila…</p>
        ) : items.length === 0 ? (
          <div>
            <PremiumEmpty icon={IdCard}
              title={debounced ? "Ninguém com essa busca" : filter === "pending_review" ? "Nenhuma verificação esperando" : "Nada por aqui"}
              subtitle={debounced ? "Confira o nome, o e-mail ou os primeiros números do documento." : filter === "pending_review" ? "Quando um seller enviar os documentos, ele aparece aqui." : "Nenhuma conta nesta situação."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <KycQueueList rows={items} onOpen={(r) => setOpenId(r.userId)} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <KycReviewSheet sellerId={openId} seed={seed} onClose={() => setOpenId(null)} onDecided={onDecided} />
    </div>
  );
}
