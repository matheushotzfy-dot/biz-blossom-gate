/**
 * Webhooks: o servidor do vendedor recebe cada evento (pagamento, reembolso, saque) assinado com HMAC.
 * Endpoints vivem em `webhook_configs`; o histórico vem de `webhook_deliveries`, que o worker (a cada minuto)
 * preenche com 5 tentativas e esperas crescentes. O teste usa a RPC `enqueue_test_webhook`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, ListChecks, Plus, Webhook } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateAll, useWebhooks } from "@/hooks/useQueryData";
import { Seo } from "@/components/Seo";
import { PageHead } from "@/components/seller-ui/PageHead";
import { StatBand } from "@/components/seller-ui/StatBand";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { Pager } from "@/components/seller-ui/Pager";
import { copyText } from "@/components/seller-ui/copy";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EndpointDialog, WebhookSecretDialog, type EndpointTarget, type EndpointValues, type RevealedSecret } from "@/components/integrations/EndpointDialog";
import { EndpointList, type EndpointHealth } from "@/components/integrations/EndpointList";
import { DeliveryLedger } from "@/components/integrations/DeliveryLedger";
import { DeliveryDialog } from "@/components/integrations/DeliveryDialog";
import { SignatureGuide } from "@/components/integrations/SignatureGuide";
import type { SaveResult } from "@/components/integrations/KeyDialogs";
import { ago } from "@/components/integrations/intMeta";
import {
  deliveryKind, eventLabel, generateWebhookSecret, hostOf, webhookErrorMessage,
  type DeliveryRow, type WebhookRow,
} from "@/components/integrations/webhookMeta";

type View = "endpoints" | "deliveries";
type StatusFilter = "all" | "success" | "open" | "failed";
type Confirm = { kind: "rotate" | "delete"; w: WebhookRow } | null;

const LIST_LIMIT = 200;
const PAGE_SIZE = 10;
const DAY = 86_400_000;
const LIST_COLUMNS = "id, webhook_config_id, transaction_id, event, attempt, status, response_status, error, next_retry_at, delivered_at, created_at";

export default function Webhooks() {
  const { user } = useAuth();
  const invalidateAll = useInvalidateAll();
  const { data: configs = [], isLoading: loadingConfigs, isError: configsError, refetch: refetchConfigs } = useWebhooks();
  const hooks = configs as unknown as WebhookRow[];

  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "deliveries" ? "deliveries" : "endpoints";
  const setView = (v: View) => { const next = new URLSearchParams(params); if (v === "endpoints") next.delete("view"); else next.set("view", v); setParams(next, { replace: true }); };

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [recent, setRecent] = useState<Array<{ status: string; attempt: number; created_at: string }>>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);
  const [deliveriesError, setDeliveriesError] = useState(false);

  const [target, setTarget] = useState<EndpointTarget | null>(null);
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState<DeliveryRow | null>(null);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [endpointFilter, setEndpointFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [page, setPage] = useState(1);

  const loadDeliveries = useCallback(async () => {
    if (!user) return;
    const since = new Date(Date.now() - 7 * DAY).toISOString();
    const [list, week] = await Promise.all([
      supabase.from("webhook_deliveries").select(LIST_COLUMNS).eq("user_id", user.id).order("created_at", { ascending: false }).limit(LIST_LIMIT),
      supabase.from("webhook_deliveries").select("status, attempt, created_at").eq("user_id", user.id).gte("created_at", since).limit(5000),
    ]);
    if (list.error) { setDeliveriesError(true); } else {
      setDeliveries((list.data ?? []) as DeliveryRow[]);
      setRecent(((week.data ?? []) as Array<{ status: string; attempt: number; created_at: string }>).filter((r) => new Date(r.created_at).getTime() >= Date.now() - 7 * DAY));
      setDeliveriesError(false);
    }
    setLoadingDeliveries(false);
  }, [user]);

  useEffect(() => { void loadDeliveries(); }, [loadDeliveries]);

  // Enquanto algo está na fila ou sendo reenviado, confere de novo a cada 5 s (só com a aba visível).
  const hasOpen = useMemo(() => deliveries.some((d) => ["queued", "sending", "retrying"].includes(deliveryKind(d))), [deliveries]);
  const loadRef = useRef(loadDeliveries);
  loadRef.current = loadDeliveries;
  useEffect(() => {
    if (!hasOpen) return;
    const id = window.setInterval(() => { if (!document.hidden) void loadRef.current(); }, 5000);
    return () => window.clearInterval(id);
  }, [hasOpen]);

  useEffect(() => { setPage(1); }, [status, endpointFilter, eventFilter]);

  const hostById = useMemo(() => new Map(hooks.map((w) => [w.id, hostOf(w.url)])), [hooks]);

  const health = useMemo(() => {
    const map = new Map<string, EndpointHealth>();
    const dayAgo = Date.now() - DAY;
    for (const d of deliveries) { // já vem da mais nova para a mais antiga
      const cur = map.get(d.webhook_config_id) ?? { last: null, failed: 0 };
      if (!cur.last) cur.last = d;
      if (deliveryKind(d) === "exhausted" && new Date(d.created_at).getTime() >= dayAgo) cur.failed += 1;
      map.set(d.webhook_config_id, cur);
    }
    return map;
  }, [deliveries]);

  const stats = useMemo(() => {
    const ok = recent.filter((r) => r.status === "success").length;
    const bad = recent.filter((r) => r.status === "exhausted" || r.status === "failed").length;
    const rate = ok + bad > 0 ? Math.round((ok / (ok + bad)) * 100) : null;
    return { ok, bad, rate, active: hooks.filter((w) => w.is_active).length };
  }, [recent, hooks]);

  const counts = useMemo(() => ({
    all: deliveries.length,
    success: deliveries.filter((d) => deliveryKind(d) === "success").length,
    open: deliveries.filter((d) => ["queued", "sending", "retrying"].includes(deliveryKind(d))).length,
    failed: deliveries.filter((d) => deliveryKind(d) === "exhausted").length,
  }), [deliveries]);

  const shown = useMemo(() => deliveries.filter((d) => {
    const k = deliveryKind(d);
    if (status === "success" && k !== "success") return false;
    if (status === "open" && !["queued", "sending", "retrying"].includes(k)) return false;
    if (status === "failed" && k !== "exhausted") return false;
    if (endpointFilter !== "all" && d.webhook_config_id !== endpointFilter) return false;
    if (eventFilter !== "all" && d.event !== eventFilter) return false;
    return true;
  }), [deliveries, status, endpointFilter, eventFilter]);

  const pageRows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const usedEvents = useMemo(() => Array.from(new Set(deliveries.map((d) => d.event))).sort(), [deliveries]);

  const refreshConfigs = async () => { invalidateAll(["webhooks"]); await refetchConfigs(); };

  const saveEndpoint = async (values: EndpointValues): Promise<SaveResult> => {
    if (!user) return { ok: false, message: "Sessão expirada. Entre de novo." };
    if (target?.mode === "edit" && target.id) {
      const { error } = await supabase.from("webhook_configs").update({ url: values.url, events: values.events }).eq("id", target.id).eq("user_id", user.id);
      if (error) return { ok: false, message: webhookErrorMessage(error, "Não foi possível salvar o endpoint.") };
      setTarget(null); toast.success("Endpoint atualizado.");
    } else {
      const secret = generateWebhookSecret();
      const { error } = await supabase.from("webhook_configs").insert({ user_id: user.id, url: values.url, events: values.events, secret, is_active: true });
      if (error) return { ok: false, message: webhookErrorMessage(error, "Não foi possível criar o endpoint.") };
      setTarget(null); setRevealed({ url: values.url, secret, rotated: false });
    }
    await refreshConfigs();
    return { ok: true };
  };

  const toggle = async (w: WebhookRow) => {
    if (!user || busyId) return;
    setBusyId(w.id);
    const { error } = await supabase.from("webhook_configs").update({ is_active: !w.is_active }).eq("id", w.id).eq("user_id", user.id);
    setBusyId(null);
    if (error) { toast.error(w.is_active ? "Não foi possível pausar o endpoint." : "Não foi possível reativar o endpoint."); return; }
    toast.success(w.is_active ? "Endpoint pausado. Ele não recebe eventos enquanto estiver assim." : "Endpoint reativado.");
    await refreshConfigs();
  };

  const sendTest = async (w: WebhookRow) => {
    if (busyId) return;
    setBusyId(w.id);
    const { error } = await supabase.rpc("enqueue_test_webhook", { _config_id: w.id });
    setBusyId(null);
    if (error) { toast.error(webhookErrorMessage(error, "Não foi possível enviar o teste.")); return; }
    toast.success("Teste na fila. Ele sai em até 1 minuto.");
    setView("deliveries");
    await loadDeliveries();
  };

  const runConfirm = async () => {
    if (!confirm || !user) return;
    const { kind, w } = confirm;
    setConfirmBusy(true);
    if (kind === "rotate") {
      const secret = generateWebhookSecret();
      const { error } = await supabase.from("webhook_configs").update({ secret }).eq("id", w.id).eq("user_id", user.id);
      setConfirmBusy(false);
      if (error) { toast.error("Não foi possível gerar a nova chave. A anterior continua valendo."); return; }
      setConfirm(null); setRevealed({ url: w.url, secret, rotated: true });
    } else {
      const { error } = await supabase.from("webhook_configs").delete().eq("id", w.id).eq("user_id", user.id);
      setConfirmBusy(false);
      if (error) { toast.error("Não foi possível excluir o endpoint."); return; }
      setConfirm(null); toast.success("Endpoint excluído.");
      await loadDeliveries();
    }
    await refreshConfigs();
  };

  const openDeliveriesOf = (w: WebhookRow) => { setEndpointFilter(w.id); setStatus("all"); setEventFilter("all"); setView("deliveries"); };

  const noEndpoints = !loadingConfigs && !configsError && hooks.length === 0;
  const lastDelivery = deliveries[0]?.created_at;

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Webhooks | Vemprapay" description="Receba pagamentos, reembolsos e saques no seu servidor, em tempo real." path="/integracoes?tab=webhooks" noindex />

      <PageHead
        title="Webhooks"
        subtitle="Receba cada pagamento, reembolso e saque no seu servidor assim que acontece. Cada envio vai assinado, e você acompanha o que foi entregue."
        actions={<button type="button" className="vp-cta" onClick={() => setTarget({ mode: "create" })}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Novo endpoint</button>}
      />

      <StatBand
        label="Resumo dos webhooks"
        cells={[
          { label: "Endpoints ativos", featured: true, loading: loadingConfigs, value: `${stats.active} de ${hooks.length}`, sub: hooks.length - stats.active > 0 ? `${hooks.length - stats.active} pausado${hooks.length - stats.active > 1 ? "s" : ""}` : "Recebendo eventos" },
          { label: "Entregues em 7 dias", loading: loadingDeliveries, value: stats.ok.toLocaleString("pt-BR"), sub: lastDelivery ? `Última ${ago(lastDelivery)}` : "Nenhuma entrega ainda" },
          { label: "Falharam em 7 dias", loading: loadingDeliveries, value: stats.bad.toLocaleString("pt-BR"), sub: stats.bad > 0 ? "Esgotaram as 5 tentativas" : "Nada falhou" },
          { label: "Taxa de entrega", loading: loadingDeliveries, value: stats.rate === null ? "Sem dados" : `${stats.rate}%`, sub: "Entregues entre os que terminaram" },
        ]}
      />

      {configsError ? (
        <section className="vp-sheet">
          <EmptyPanel icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />} title="Não foi possível carregar os endpoints" text="Confira sua conexão e tente de novo. Seus endpoints continuam salvos." action={<button type="button" className="vp-ghost" onClick={() => { void refetchConfigs(); }}>Tentar de novo</button>} />
        </section>
      ) : noEndpoints ? (
        <section className="vp-sheet">
          <EmptyPanel
            icon={<Webhook className="h-7 w-7" strokeWidth={1.8} />}
            title="Receba seus eventos em tempo real"
            text="Cadastre a URL do seu servidor e escolha os eventos. A gente envia cada um assinado e tenta de novo se algo falhar."
            action={<button type="button" className="vp-cta" onClick={() => setTarget({ mode: "create" })}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Novo endpoint</button>}
          />
        </section>
      ) : (
        <>
          <FilterPills<View>
            label="Visão dos webhooks" value={view} onChange={setView}
            options={[{ value: "endpoints", label: "Endpoints" }, { value: "deliveries", label: "Entregas" }]}
          />

          {view === "endpoints" ? (
            <>
              {loadingConfigs ? (
                <div className="space-y-3" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <div key={i} className="vp-skel h-[84px] !rounded-[22px]" />)}</div>
              ) : (
                <EndpointList
                  rows={hooks} health={health} busyId={busyId}
                  onTest={(w) => void sendTest(w)}
                  onEdit={(w) => setTarget({ mode: "edit", id: w.id, url: w.url, events: w.events ?? [] })}
                  onToggle={(w) => void toggle(w)}
                  onRotate={(w) => setConfirm({ kind: "rotate", w })}
                  onCopyUrl={(w) => { void copyText(w.url, "URL copiada."); }}
                  onDeliveries={openDeliveriesOf}
                  onDelete={(w) => setConfirm({ kind: "delete", w })}
                />
              )}
              <SignatureGuide />
            </>
          ) : deliveriesError ? (
            <section className="vp-sheet">
              <EmptyPanel icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />} title="Não foi possível carregar as entregas" text="Confira sua conexão e tente de novo." action={<button type="button" className="vp-ghost" onClick={() => { setLoadingDeliveries(true); void loadDeliveries(); }}>Tentar de novo</button>} />
            </section>
          ) : loadingDeliveries ? (
            <div className="space-y-3" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <div key={i} className="vp-skel h-[72px] !rounded-[22px]" />)}</div>
          ) : deliveries.length === 0 ? (
            <section className="vp-sheet">
              <EmptyPanel
                icon={<ListChecks className="h-7 w-7" strokeWidth={1.8} />}
                title="Nenhuma entrega ainda"
                text="Quando houver uma venda ou você enviar um teste, cada envio aparece aqui com a resposta do seu servidor."
                action={stats.active > 0 ? <button type="button" className="vp-cta" onClick={() => { const w = hooks.find((h) => h.is_active); if (w) void sendTest(w); }}>Enviar um teste</button> : undefined}
              />
            </section>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <FilterPills<StatusFilter>
                  label="Filtrar entregas por situação" value={status} onChange={setStatus}
                  options={[{ value: "all", label: "Todas", count: counts.all }, { value: "success", label: "Entregues", count: counts.success }, { value: "open", label: "Em andamento", count: counts.open }, { value: "failed", label: "Falharam", count: counts.failed }]}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {hooks.length > 1 && (
                    <Select value={endpointFilter} onValueChange={setEndpointFilter}>
                      <SelectTrigger aria-label="Filtrar por endpoint" className="vp-r16 h-11 sm:w-[240px]"><SelectValue /></SelectTrigger>
                      <SelectContent collisionPadding={16}>
                        <SelectItem value="all">Todos os endpoints</SelectItem>
                        {hooks.map((w) => <SelectItem key={w.id} value={w.id}>{hostOf(w.url)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={eventFilter} onValueChange={setEventFilter}>
                    <SelectTrigger aria-label="Filtrar por evento" className="vp-r16 h-11 sm:w-[220px]"><SelectValue /></SelectTrigger>
                    <SelectContent collisionPadding={16}>
                      <SelectItem value="all">Todos os eventos</SelectItem>
                      {usedEvents.map((e) => <SelectItem key={e} value={e}>{eventLabel(e)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {shown.length === 0 ? (
                <section className="vp-sheet">
                  <EmptyPanel title="Nenhuma entrega encontrada" text="Tente outro filtro." action={<button type="button" className="vp-ghost" onClick={() => { setStatus("all"); setEndpointFilter("all"); setEventFilter("all"); }}>Limpar filtros</button>} />
                </section>
              ) : (
                <div className="space-y-3">
                  <DeliveryLedger rows={pageRows} hostById={hostById} onOpen={setOpen} footer={<Pager page={page} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} />} />
                  {deliveries.length >= LIST_LIMIT && <p className="px-1 text-[13px] text-muted-foreground">Mostrando as {LIST_LIMIT} entregas mais recentes.</p>}
                </div>
              )}
            </>
          )}
        </>
      )}

      <EndpointDialog
        target={target}
        existingUrls={hooks.filter((w) => w.id !== target?.id).map((w) => w.url)}
        onOpenChange={(o) => { if (!o) setTarget(null); }}
        onSave={saveEndpoint}
      />
      <WebhookSecretDialog value={revealed} onClose={() => setRevealed(null)} />
      <DeliveryDialog delivery={open} url={open ? hooks.find((w) => w.id === open.webhook_config_id)?.url ?? "" : ""} onClose={() => setOpen(null)} />

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o && !confirmBusy) setConfirm(null); }}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "rotate" ? "Gerar uma nova chave de assinatura?" : `Excluir ${confirm ? hostOf(confirm.w.url) : "o endpoint"}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "rotate"
                ? "A chave atual para de valer na hora. Os próximos envios já saem com a nova, então atualize o seu servidor logo depois de copiá-la. Entregas na fila também usam a nova."
                : "O endpoint deixa de receber eventos e o histórico de entregas dele é apagado. Isso não pode ser desfeito."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className={confirm?.kind === "delete" ? "vp-cta vp-cta-danger" : "vp-cta"} disabled={confirmBusy} onClick={(e) => { e.preventDefault(); void runConfirm(); }}>
              {confirmBusy ? "Aguarde…" : confirm?.kind === "rotate" ? "Gerar nova chave" : "Excluir endpoint"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

