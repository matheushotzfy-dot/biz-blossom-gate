/**
 * Webhooks: o sistema do vendedor recebe cada evento (pagamento, reembolso, saque) assinado com HMAC.
 * Endpoints vivem em `webhook_configs`; o histórico vem de `webhook_deliveries`, que o worker (a cada minuto)
 * preenche com 5 tentativas e esperas crescentes. Teste e reenvio passam por RPCs (enqueue_test_webhook,
 * resend_webhook_delivery, resend_failed_webhook_deliveries): o vendedor não escreve na fila direto.
 *
 * A tela é um painel por endpoint: cartões com o "pulso" de cada um no topo, e embaixo o endpoint aberto com
 * chave, eventos, teste ao vivo e histórico em que cada entrega abre no lugar (payload, resposta, o que fazer, reenviar).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateAll, useWebhooks } from "@/hooks/useQueryData";
import { Seo } from "@/components/Seo";
import { PageHead } from "@/components/seller-ui/PageHead";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { EndpointDialog, WebhookSecretDialog, type EndpointTarget, type EndpointValues, type RevealedSecret } from "@/components/integrations/EndpointDialog";
import { EndpointDeck } from "@/components/integrations/EndpointDeck";
import { EndpointPanel } from "@/components/integrations/EndpointPanel";
import { DeliveryLog } from "@/components/integrations/DeliveryLog";
import { TestTracker } from "@/components/integrations/TestTracker";
import { WebhookWelcome } from "@/components/integrations/WebhookWelcome";
import { SignatureGuide } from "@/components/integrations/SignatureGuide";
import type { SaveResult } from "@/components/integrations/KeyDialogs";
import { LOG_PAGE, useDeliveryLog, usePulses } from "@/components/integrations/useWebhookFeed";
import { ConfirmDialog } from "@/components/seller-ui/confirm";
import {
  DEFAULT_TEST_EVENT, MAX_ENDPOINTS, generateWebhookSecret, hostOf, webhookErrorMessage,
  type DeliveryRow, type WebhookRow,
} from "@/components/integrations/webhookMeta";

type Confirm = { kind: "rotate" | "delete"; w: WebhookRow } | null;
interface Tracked { id: string; endpointId: string; event: string; verb: "Teste" | "Reenvio" }

export default function Webhooks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidateAll = useInvalidateAll();
  const { data: configs = [], isLoading: loadingConfigs, isError: configsError, refetch: refetchConfigs } = useWebhooks();
  const hooks = configs as unknown as WebhookRow[];

  // O endpoint aberto fica em estado local: o DashboardLayout remonta a página a cada mudança na URL (`pathname + search`),
  // o que apagaria o acompanhamento de um teste em andamento. `?e=<id>` só vale como link de entrada.
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("e"));
  const selected = hooks.find((h) => h.id === selectedId) ?? hooks[0] ?? null;
  const select = setSelectedId;

  const ids = useMemo(() => hooks.map((h) => h.id), [hooks]);
  const pulses = usePulses(user?.id, ids);
  const [limit, setLimit] = useState(LOG_PAGE);
  const log = useDeliveryLog(user?.id, selected?.id ?? null, limit);

  const [target, setTarget] = useState<EndpointTarget | null>(null);
  const [revealed, setRevealed] = useState<(RevealedSecret & { endpointId?: string }) | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tracked, setTracked] = useState<Tracked | null>(null);

  useEffect(() => { setLimit(LOG_PAGE); setExpandedId(null); }, [selected?.id]);

  const refreshFeed = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["webhook-pulses"] });
    void qc.invalidateQueries({ queryKey: ["webhook-log"] });
  }, [qc]);
  const refreshConfigs = async () => { invalidateAll(["webhooks"]); await refetchConfigs(); };

  const saveEndpoint = async (values: EndpointValues): Promise<SaveResult> => {
    if (!user) return { ok: false, message: "Sessão expirada. Entre de novo." };
    if (target?.mode === "edit" && target.id) {
      const { error } = await supabase.from("webhook_configs").update({ url: values.url, events: values.events }).eq("id", target.id).eq("user_id", user.id);
      if (error) return { ok: false, message: webhookErrorMessage(error, "Não foi possível salvar o endpoint.") };
      setTarget(null); toast.success("Endpoint atualizado.");
    } else {
      const secret = generateWebhookSecret();
      const id = crypto.randomUUID(); // a leitura da tabela é pela view segura: gerar o id aqui evita depender de um SELECT logo após o insert
      const { error } = await supabase.from("webhook_configs").insert({ id, user_id: user.id, url: values.url, events: values.events, secret, is_active: true });
      if (error) return { ok: false, message: webhookErrorMessage(error, "Não foi possível criar o endpoint.") };
      setTarget(null); setRevealed({ url: values.url, secret, rotated: false, endpointId: id }); select(id);
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

  const sendTest = async (endpointId: string, event: string = DEFAULT_TEST_EVENT) => {
    if (busyId) return;
    setBusyId(endpointId);
    // O evento padrão vai sem o segundo argumento: assim a tela também funciona com a versão antiga da função.
    const args = event === DEFAULT_TEST_EVENT ? { _config_id: endpointId } : { _config_id: endpointId, _event: event };
    const { data, error } = await supabase.rpc("enqueue_test_webhook", args);
    setBusyId(null);
    if (error || !data) { toast.error(webhookErrorMessage(error, "Não foi possível enviar o teste.")); return; }
    select(endpointId); setExpandedId(null);
    setTracked({ id: String(data), endpointId, event, verb: "Teste" });
    refreshFeed();
  };

  const resend = async (d: DeliveryRow) => {
    if (resendingId) return;
    setResendingId(d.id);
    const { error } = await supabase.rpc("resend_webhook_delivery", { _delivery_id: d.id });
    setResendingId(null);
    if (error) { toast.error(webhookErrorMessage(error, "Não foi possível reenviar essa entrega.")); return; }
    setExpandedId(null);
    setTracked({ id: d.id, endpointId: d.webhook_config_id, event: d.event, verb: "Reenvio" });
    refreshFeed();
  };

  const resendFailed = async (w: WebhookRow) => {
    if (bulkBusy) return;
    setBulkBusy(true);
    const { data, error } = await supabase.rpc("resend_failed_webhook_deliveries", { _config_id: w.id });
    setBulkBusy(false);
    if (error) { toast.error(webhookErrorMessage(error, "Não foi possível reenviar as entregas.")); return; }
    const n = Number(data ?? 0);
    toast.success(n === 0 ? "Não havia entregas falhadas para reenviar." : n === 1 ? "1 entrega reenviada. Ela sai em até 1 minuto." : `${n} entregas reenviadas. Elas saem em até 1 minuto.`);
    refreshFeed();
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
      setSelectedId(null);
      refreshFeed();
    }
    await refreshConfigs();
  };

  const openTracked = () => {
    if (!tracked) return;
    setExpandedId(tracked.id);
    window.setTimeout(() => document.getElementById(`dl-${tracked.id}`)?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 60);
  };

  const noEndpoints = !loadingConfigs && !configsError && hooks.length === 0;
  const activeTracked = tracked && selected && tracked.endpointId === selected.id ? tracked : null;
  const trackedRow = activeTracked ? (log.data ?? []).find((r) => r.id === activeTracked.id) ?? null : null;

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Webhooks | Vemprapay" description="Receba pagamentos, reembolsos e saques no seu sistema, em tempo real." path="/integracoes?tab=webhooks" noindex />

      <PageHead
        title="Webhooks"
        subtitle="Cada venda, reembolso e saque chega ao seu sistema assim que acontece, assinado. Você acompanha o que foi entregue e reenvia o que falhou."
        actions={hooks.length < MAX_ENDPOINTS ? <button type="button" className="vp-cta" onClick={() => setTarget({ mode: "create" })}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Novo endpoint</button> : undefined}
      />

      {configsError ? (
        <section className="vp-sheet">
          <EmptyPanel icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />} title="Não foi possível carregar os endpoints" text="Confira sua conexão e tente de novo. Seus endpoints continuam salvos." action={<button type="button" className="vp-ghost" onClick={() => { void refetchConfigs(); }}>Tentar de novo</button>} />
        </section>
      ) : loadingConfigs ? (
        <div className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(264px,1fr))] gap-3">{Array.from({ length: 2 }, (_, i) => <div key={i} className="vp-skel h-[132px] !rounded-[22px]" />)}</div>
          <div className="vp-skel h-[360px] !rounded-[22px]" />
        </div>
      ) : noEndpoints ? (
        <WebhookWelcome onCreate={() => setTarget({ mode: "create" })} />
      ) : (
        <>
          <EndpointDeck rows={hooks} pulses={pulses.data} selectedId={selected?.id ?? null} onSelect={select} />

          {selected && (
            <EndpointPanel
              key={selected.id}
              w={selected} busy={busyId === selected.id}
              onToggle={() => void toggle(selected)}
              onTest={(event) => void sendTest(selected.id, event)}
              onEdit={() => setTarget({ mode: "edit", id: selected.id, url: selected.url, events: selected.events ?? [] })}
              onRotate={() => setConfirm({ kind: "rotate", w: selected })}
              onDelete={() => setConfirm({ kind: "delete", w: selected })}
              tracker={activeTracked ? <TestTracker row={trackedRow} event={activeTracked.event} verb={activeTracked.verb} onOpen={openTracked} onDismiss={() => setTracked(null)} /> : undefined}
            >
              <DeliveryLog
                rows={log.data ?? []} loading={log.isLoading} error={log.isError} onRetry={() => { void log.refetch(); }}
                endpoint={selected} expandedId={expandedId} onExpand={setExpandedId} trackedId={activeTracked?.id ?? null}
                limit={limit} onLoadMore={() => setLimit((n) => n + LOG_PAGE)}
                onResend={(d) => void resend(d)} resendingId={resendingId}
                onResendFailed={() => void resendFailed(selected)} bulkBusy={bulkBusy}
                onTest={() => void sendTest(selected.id)}
              />
            </EndpointPanel>
          )}

          <SignatureGuide />
        </>
      )}

      <EndpointDialog
        target={target}
        existingUrls={hooks.filter((w) => w.id !== target?.id).map((w) => w.url)}
        onOpenChange={(o) => { if (!o) setTarget(null); }}
        onSave={saveEndpoint}
      />
      <WebhookSecretDialog
        value={revealed}
        onClose={() => setRevealed(null)}
        onTest={revealed?.endpointId ? () => { const id = revealed.endpointId!; setRevealed(null); void sendTest(id); } : undefined}
      />

      <ConfirmDialog
        open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }} busy={confirmBusy}
        tone={confirm?.kind === "rotate" ? "default" : "danger"} icon={confirm?.kind === "rotate" ? <KeyRound className="h-5 w-5" /> : undefined}
        title={confirm?.kind === "rotate" ? "Gerar uma nova chave de assinatura?" : `Excluir ${confirm ? hostOf(confirm.w.url) : "o endpoint"}?`}
        confirmLabel={confirm?.kind === "rotate" ? "Gerar nova chave" : "Excluir endpoint"}
        description={confirm?.kind === "rotate"
          ? "A chave atual para de valer na hora. Os próximos envios já saem com a nova, então atualize o seu servidor logo depois de copiá-la. Entregas na fila também usam a nova."
          : "O endpoint deixa de receber eventos e o histórico de entregas dele é apagado. Isso não pode ser desfeito."}
        onConfirm={runConfirm}
      />
    </div>
  );
}
