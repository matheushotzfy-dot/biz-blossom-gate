import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, PackageCheck, RefreshCw, Search, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import AdminPager from "@/components/admin/AdminPager";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { waitingLabel } from "@/features/admin-finance/format";
import { friendlyError } from "@/lib/friendlyError";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "./AdminPremium";
import { DeliveryCards, DeliveryTable, type DeliveryContext } from "@/features/admin-deliveries/DeliveryRows";
import { PAGE_SIZE, parseDeliveriesPage, retryOutcome, type Delivery, type DeliveriesPage, type DeliveryFilter } from "@/features/admin-deliveries/deliveriesModel";

async function fetchDeliveries(search: string, status: DeliveryFilter, page: number): Promise<DeliveriesPage> {
  const { data, error } = await supabase.rpc("get_admin_checkout_deliveries_page" as never, { _search: search || null, _status: status, _page: page, _page_size: PAGE_SIZE } as never);
  if (error) throw error;
  return parseDeliveriesPage(data);
}

export default function AdminCheckoutDeliveriesTab() {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm();
  const [status, setStatus] = useState<DeliveryFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ["admin-checkout-deliveries", debounced, status, page],
    queryFn: () => fetchDeliveries(debounced, status, page),
    placeholderData: keepPreviousData,
  });
  const items = q.data?.items ?? [];
  const summary = q.data?.summary;
  const total = q.data?.total ?? 0;

  const retry = useMutation({
    mutationFn: async (d: Delivery) => {
      const { data, error } = await supabase.rpc("admin_retry_checkout_delivery", { _delivery_id: d.id });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, d) => {
      const out = retryOutcome(data, d.customer_email);
      if (out.kind === "success") toast.success(out.message); else toast.warning(out.message);
      void qc.invalidateQueries({ queryKey: ["admin-checkout-deliveries"] });
    },
    onError: (e) => toast.error("Não foi possível reprocessar a entrega.", { description: friendlyError(e, "Tente de novo em instantes.") }),
    onSettled: () => setRetrying(null),
  });

  const onRetry = (d: Delivery) => sensitive.confirm(
    `Reprocessar a entrega de "${d.product_name || "produto removido"}" para ${d.customer_email}. Se o comprador já tiver conta com e-mail confirmado, o acesso ao curso é liberado agora.`,
    async () => { setRetrying(d.id); await retry.mutateAsync(d).catch(() => undefined); },
  );

  const ctx: DeliveryContext = { retrying, busy: retry.isPending, onRetry };
  const filtersActive = status !== "all" || !!debounced;
  const clear = () => { setStatus("all"); setSearch(""); setDebounced(""); setPage(1); };
  const waiting = q.isError ? "Indisponível" : "Carregando…";
  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} · ${n.toLocaleString("pt-BR")}`);
  const pills = useMemo<{ value: DeliveryFilter; label: string }[]>(() => [
    { value: "all", label: withCount("Todas", summary?.total) },
    { value: "failed", label: withCount("Falhas", summary?.failed) },
    { value: "pending", label: withCount("Aguardando", summary?.pending) },
    { value: "delivered", label: withCount("Entregues", summary?.delivered) },
    { value: "revoked", label: withCount("Revogadas", summary?.revoked) },
  ], [summary]);

  const heroStatus = !summary ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : summary.failed > 0 ? { tone: "destructive" as const, label: `${summary.failed} ${summary.failed === 1 ? "entrega falhou" : "entregas falharam"}`, pulse: true }
      : summary.pending > 0 ? { tone: "warning" as const, label: `${summary.pending} aguardando o comprador` }
        : { tone: "success" as const, label: summary.total === 0 ? "Nenhuma entrega ainda" : "Tudo entregue" };

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader
        eyebrow="Pós-venda · Entregas" title="Entregas do checkout"
        subtitle="Cada compra confirmada vira acesso ao curso. Aqui você vê o que ficou preso e reprocessa sem duplicar o acesso."
        status={heroStatus}
        actions={<Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void q.refetch()} disabled={q.isFetching}><RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar</Button>}
      />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={TriangleAlert} label="Falhas" value={summary ? summary.failed.toLocaleString("pt-BR") : "—"} sub={summary ? "precisam de ação" : waiting} tone={summary && summary.failed > 0 ? "destructive" : "neutral"} />
        <PremiumMetric icon={Clock3} label="Aguardando" value={summary ? summary.pending.toLocaleString("pt-BR") : "—"} sub={summary ? "comprador sem conta" : waiting} tone={summary && summary.pending > 0 ? "warning" : "neutral"} />
        <PremiumMetric icon={CheckCircle2} label="Entregues" value={summary ? summary.delivered.toLocaleString("pt-BR") : "—"} sub={summary ? `de ${summary.total.toLocaleString("pt-BR")} compras` : waiting} tone="success" />
        <PremiumMetric icon={PackageCheck} label="Mais antiga em aberto" value={summary ? (summary.oldest_open ? waitingLabel(summary.oldest_open).replace("há ", "") : "Nenhuma") : "—"} sub={summary ? "entre falhas e aguardando" : waiting} tone="info" />
      </PremiumMetricGrid>
      <p className="-mt-2 text-[12px] text-muted-foreground">Os números consideram todas as entregas que batem com a busca, não só esta página. Falhas e aguardando aparecem primeiro.</p>

      <PremiumPanel eyebrow="Área de membros" title={summary ? `Entregas · ${total.toLocaleString("pt-BR")}` : "Entregas"} icon={PackageCheck}>
        <div className="mb-4 space-y-3">
          <PremiumSegmented<DeliveryFilter> value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={pills} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Buscar entrega" placeholder="E-mail, produto, vendedor ou código da compra" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }}
                className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
            </div>
            {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
          </div>
        </div>

        {q.isError && !q.isFetching ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-[13px]">
            <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Não foi possível carregar as entregas.</p>
            <p className="text-muted-foreground">{friendlyError(q.error, "Tente de novo em instantes.")}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void q.refetch()}>Tentar de novo</Button>
          </div>
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando entregas…</p>
        ) : items.length === 0 ? (
          <div>
            <PremiumEmpty icon={PackageCheck} title="Nenhuma entrega aqui" subtitle={filtersActive ? "Nenhuma entrega bate com esses filtros." : "Quando uma compra for confirmada, a liberação do acesso aparece aqui."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <DeliveryTable rows={items} ctx={ctx} />
            <DeliveryCards rows={items} ctx={ctx} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>
      {sensitive.dialog}
    </div>
  );
}
