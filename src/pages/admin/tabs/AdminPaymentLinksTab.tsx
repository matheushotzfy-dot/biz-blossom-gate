import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, CircleDollarSign, Link as LinkIcon, Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import AdminPager from "@/components/admin/AdminPager";
import { useConfirm, useReason } from "@/components/seller-ui/confirm";
import { brl } from "@/features/admin-finance/types";
import { friendlyError } from "@/lib/friendlyError";
import { logAdminAction } from "@/lib/auditLog";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "./AdminPremium";
import { LinkCards, LinkTable, type LinkContext } from "@/features/admin-payment-links/LinkRows";
import { LinkSheet } from "@/features/admin-payment-links/LinkSheet";
import {
  ACTION_DONE, ACTION_STATUS, MIN_BLOCK_REASON, PAGE_SIZE, parseLinksPage,
  type LinkFilter, type LinkRow, type LinksPage, type ModerationAction,
} from "@/features/admin-payment-links/linksModel";

async function fetchLinks(search: string, status: LinkFilter, page: number): Promise<LinksPage> {
  const { data, error } = await supabase.rpc("get_admin_payment_links_page" as never, {
    _search: search || null, _status: status, _billing_type: "all", _page: page, _page_size: PAGE_SIZE,
  } as never);
  if (error) throw error;
  return parseLinksPage(data);
}

export default function AdminPaymentLinksTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<LinkFilter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LinkRow | null>(null);
  const confirm = useConfirm();
  const reason = useReason();

  useEffect(() => {
    const t = window.setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ["admin-payment-links", debounced, status, page],
    queryFn: () => fetchLinks(debounced, status, page),
    placeholderData: keepPreviousData,
  });
  const items = q.data?.items ?? [];
  const summary = q.data?.summary;
  const total = q.data?.total ?? 0;

  const change = useMutation({
    mutationFn: async (v: { link: LinkRow; action: ModerationAction; reason?: string }) => {
      const { error } = await supabase.rpc("admin_set_payment_link_status" as never, { _payment_link_id: v.link.id, _status: ACTION_STATUS[v.action], _reason: v.reason ?? null } as never);
      if (error) throw error;
      await logAdminAction("payment_link_admin_status", "payment_link", v.link.id, { status: ACTION_STATUS[v.action], reason: v.reason ?? null }).catch(() => undefined);
    },
    onSuccess: (_d, v) => { toast.success(ACTION_DONE[v.action]); void qc.invalidateQueries({ queryKey: ["admin-payment-links"] }); void qc.invalidateQueries({ queryKey: ["admin-link-events"] }); },
    onError: (e) => toast.error("Não foi possível atualizar o link. Nada mudou.", { description: friendlyError(e, "Tente de novo em instantes.") }),
  });

  const onAction = async (link: LinkRow, action: ModerationAction) => {
    if (action === "block") {
      const text = await reason.ask({
        title: "Bloquear este link?", description: `Ninguém consegue pagar por "${link.title}" enquanto estiver bloqueado. O vendedor vê o motivo.`,
        label: "Motivo do bloqueio", minLength: MIN_BLOCK_REASON, confirmLabel: "Bloquear link", tone: "danger",
      });
      if (text === null) return;
      change.mutate({ link, action, reason: text.slice(0, 500) });
      return;
    }
    if (action === "unblock") {
      const ok = await confirm.ask({ title: "Desbloquear este link?", description: `"${link.title}" volta a aceitar pagamentos e o motivo do bloqueio deixa de aparecer para o vendedor.`, confirmLabel: "Desbloquear", tone: "warning" });
      if (!ok) return;
    }
    change.mutate({ link, action });
  };

  const ctx: LinkContext = { busy: change.isPending, onEvents: setSelected, onAction: (l, a) => void onAction(l, a) };
  const filtersActive = status !== "all" || !!debounced;
  const clear = () => { setStatus("all"); setSearch(""); setDebounced(""); setPage(1); };
  const waiting = q.isError ? "Indisponível" : "Carregando…";
  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} · ${n.toLocaleString("pt-BR")}`);
  const pills = useMemo<{ value: LinkFilter; label: string }[]>(() => [
    { value: "all", label: withCount("Tudo", summary?.total) },
    { value: "active", label: withCount("Ativos", summary?.active) },
    { value: "paused", label: withCount("Pausados", summary?.paused) },
    { value: "review", label: withCount("Em revisão", summary?.review) },
    { value: "blocked", label: withCount("Bloqueados", summary?.blocked) },
    { value: "archived", label: withCount("Arquivados", summary?.archived) },
  ], [summary]);

  const heroStatus = !summary ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : summary.review > 0 ? { tone: "warning" as const, label: `${summary.review} ${summary.review === 1 ? "link em revisão" : "links em revisão"}`, pulse: true }
      : { tone: "success" as const, label: summary.total === 0 ? "Nenhum link criado" : "Nada em revisão" };

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader
        eyebrow="Operação · Links de pagamento" title="Links de Pagamento"
        subtitle="Links de cobrança criados pelos vendedores. Daqui você revisa, bloqueia e acompanha o histórico de cada um."
        status={heroStatus}
        actions={<Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void q.refetch()} disabled={q.isFetching}><RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar</Button>}
      />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={LinkIcon} label="Links ativos" value={summary ? summary.active.toLocaleString("pt-BR") : "—"} sub={summary ? `de ${summary.total.toLocaleString("pt-BR")} no total` : waiting} tone="success" />
        <PremiumMetric icon={ShieldAlert} label="Em revisão" value={summary ? summary.review.toLocaleString("pt-BR") : "—"} sub={summary ? "continuam funcionando" : waiting} tone={summary && summary.review > 0 ? "warning" : "neutral"} />
        <PremiumMetric icon={Ban} label="Bloqueados" value={summary ? summary.blocked.toLocaleString("pt-BR") : "—"} sub={summary ? "não aceitam pagamento" : waiting} tone={summary && summary.blocked > 0 ? "destructive" : "neutral"} />
        <PremiumMetric icon={CircleDollarSign} label="Receita líquida" value={summary ? brl(summary.net_revenue) : "—"} sub={summary ? "vendas aprovadas" : waiting} tone="info" />
      </PremiumMetricGrid>
      <p className="-mt-2 text-[12px] text-muted-foreground">Os números consideram todos os links que batem com a busca, não só esta página.</p>

      <PremiumPanel eyebrow="Links" title={summary ? `Links · ${total.toLocaleString("pt-BR")}` : "Links"} icon={LinkIcon}>
        <div className="mb-4 space-y-3">
          <PremiumSegmented<LinkFilter> value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={pills} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Buscar link" placeholder="Título, endereço, vendedor ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }}
                className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
            </div>
            {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
          </div>
          <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Em revisão é só uma marca: o link continua recebendo. Bloqueado impede o pagamento e mostra o motivo ao vendedor.</p>
        </div>

        {q.isError && !q.isFetching ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-[13px]">
            <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Não foi possível carregar os links.</p>
            <p className="text-muted-foreground">{friendlyError(q.error, "Tente de novo em instantes.")}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void q.refetch()}>Tentar de novo</Button>
          </div>
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando links…</p>
        ) : items.length === 0 ? (
          <div>
            <PremiumEmpty icon={LinkIcon} title="Nenhum link aqui" subtitle={filtersActive ? "Nenhum link bate com esses filtros." : "Os vendedores ainda não criaram links de pagamento."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <LinkTable rows={items} ctx={ctx} />
            <LinkCards rows={items} ctx={ctx} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <LinkSheet link={selected} onClose={() => setSelected(null)} />
      {confirm.dialog}
      {reason.dialog}
    </div>
  );
}
