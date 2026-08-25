import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebhooks, useInvalidateAll } from "@/hooks/useQueryData";
import type { Tables } from "@/integrations/supabase/types";
import {
  Plus, Trash2, Globe, Search, Pencil, Radio, Send,
  Power, PowerOff, Copy, Webhook, CheckCircle2, Clock, AlertTriangle, ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/friendlyError";
import { HDShell, HDHeader, HDStat, HDStatGrid, HDCard } from "@/components/hd/HDPage";

const EVENT_GROUPS = [
  {
    label: "Pagamentos",
    events: [
      { key: "payment.created", label: "Criada (Pendente)" },
      { key: "payment.approved", label: "Aprovada" },
      { key: "payment.failed", label: "Falha" },
      { key: "payment.expired", label: "Expirada" },
      { key: "payment.refunded", label: "Reembolso" },
    ],
  },
  {
    label: "Risco & Saques",
    events: [
      { key: "chargeback.received", label: "Chargeback" },
      { key: "payout.approved", label: "Saque aprovado" },
      { key: "payout.rejected", label: "Saque rejeitado" },
    ],
  },
];

type WebhookConfig = Tables<"webhook_configs_safe">;
type Delivery = Pick<
  Tables<"webhook_deliveries">,
 "id" | "event" | "status" | "attempt" | "response_status" | "error" | "created_at" | "delivered_at"
>;

/** Recent delivery attempts for the signed-in seller (RLS scoped). */
function useWebhookDeliveries() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["webhook-deliveries", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_deliveries")
        .select("id, event, status, attempt, response_status, error, created_at, delivered_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data || []) as Delivery[];
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

const DELIVERY_TONE: Record<string, { label: string; className: string; Icon: typeof Clock }> = {
  success: { label: "Entregue", className: "text-success", Icon: CheckCircle2 },
  pending: { label: "Na fila", className: "text-muted-foreground", Icon: Clock },
  exhausted: { label: "Falhou", className: "text-destructive", Icon: AlertTriangle },
};

export default function Webhooks() {
  const { user } = useAuth();
  const { data: webhooks = [], refetch: refetchWebhooks } = useWebhooks();
  const { data: deliveries = [], refetch: refetchDeliveries } = useWebhookDeliveries();
  const invalidateAll = useInvalidateAll();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const resetForm = () => {
    setUrl("");
    setSelectedEvents([]);
    setEditingId(null);
    setCreatedSecret(null);
  };

  const openCreate = () => { resetForm(); setCreateOpen(true); };
  const openEdit = (wh: WebhookConfig) => {
    if (!wh.id || !wh.url) return;
    setEditingId(wh.id);
    setUrl(wh.url);
    setSelectedEvents(wh.events ?? []);
    setCreateOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (selectedEvents.length === 0) { toast.error("Selecione ao menos um evento"); return; }
    if (!url.startsWith("https://")) { toast.error("URL deve começar com https://"); return; }

    setIsSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("webhook_configs")
          .update({ url, events: selectedEvents })
          .eq("id", editingId)
          .eq("user_id", user.id);
        if (error) { toast.error(friendlyError(error, "Erro ao atualizar")); return; }
        toast.success("Webhook atualizado");
      } else {
        const secret = "whsec_" + crypto.randomUUID().replace(/-/g, "") +
          crypto.randomUUID().replace(/-/g, "").slice(0, 8);
        const { error } = await supabase
          .from("webhook_configs")
          .insert({ user_id: user.id, url, events: selectedEvents, secret, is_active: true });
        if (error) { toast.error(friendlyError(error, "Erro ao criar webhook")); return; }
        setCreatedSecret(secret);
        toast.success("Webhook adicionado");
      }
      invalidateAll(["webhooks"]);
      await refetchWebhooks();
      if (editingId) {
        setCreateOpen(false);
        resetForm();
      } else {
        setUrl("");
        setSelectedEvents([]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!user) return;
    const { error } = await supabase.from("webhook_configs").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(friendlyError(error)); return; }
    invalidateAll(["webhooks"]);
    await refetchWebhooks();
    toast.success(current ? "Pausado" : "Ativado");
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Excluir este endpoint? Os eventos pendentes serão cancelados.")) return;
    const { error } = await supabase.from("webhook_configs").delete().eq("id", id);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Removido");
    invalidateAll(["webhooks"]);
    await refetchWebhooks();
  };

  /** Enqueues a signed `webhook.test` event delivered by the worker within ~1 min. */
  const sendTest = async (id: string) => {
    setTestingId(id);
    try {
      const { error } = await supabase.rpc("enqueue_test_webhook", { _config_id: id });
      if (error) { toast.error(friendlyError(error, "Não foi possível enviar o teste")); return; }
      toast.success("Evento de teste enfileirado", { description: "A entrega aparece no histórico em até 1 minuto." });
      await refetchDeliveries();
    } finally {
      setTestingId(null);
    }
  };

  const copyCreatedSecret = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret);
    toast.success("Secret copiado");
  };

  const filtered = useMemo(() =>
    webhooks.filter((w) => !query || (w.url ?? "").toLowerCase().includes(query.toLowerCase())),
    [webhooks, query]
  );

  const activeCount = webhooks.filter((w) => w.is_active).length;
  const delivered = deliveries.filter((d) => d.status === "success").length;
  const failing = deliveries.filter((d) => d.status === "exhausted").length;

  return (
    <HDShell>
      <HDHeader
        eyebrow={`${webhooks.length} ${webhooks.length === 1 ? "endpoint" : "endpoints"} configurados`}
        title="Webhooks"
        subtitle="Receba eventos de pagamento em tempo real no seu servidor, assinados com HMAC-SHA256 e isolados por conta."
        actions={
          <>
            <a
              href="/documentacao"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border/60 bg-card px-3.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
            >
              Documentação <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <button
                  onClick={openCreate}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> Novo endpoint
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg rounded-[12px] border-border/60 bg-card">
                <DialogHeader>
                  <DialogTitle className="font-display text-[19px] font-bold tracking-[-0.02em]">
                    {editingId ? "Editar endpoint" : "Novo endpoint"}
                  </DialogTitle>
                  <DialogDescription className="text-[12.5px] text-muted-foreground">
                    Enviamos um POST HTTPS a cada evento selecionado. Valide a assinatura no header
                    <span className="font-mono text-foreground"> X-Venxpay-Signature</span>.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                  {createdSecret && (
                    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
                      <Label className="text-[12px] text-muted-foreground">Secret do webhook</Label>
                      <div className="flex gap-2">
                        <Input value={createdSecret} readOnly className="h-10 rounded-lg font-mono text-xs" />
                        <Button type="button" onClick={copyCreatedSecret} variant="outline" className="h-10 rounded-lg px-3" aria-label="Copiar secret">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Guarde em local seguro — não será exibido novamente.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-[12px] text-muted-foreground">URL de destino</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                      <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://sua-api.com/webhook"
                        className="h-10 rounded-lg pl-9 font-mono text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[12px] text-muted-foreground">Eventos</Label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {EVENT_GROUPS.map((g) => (
                        <div key={g.label} className="space-y-2">
                          <p className="text-[11.5px] font-semibold text-foreground">{g.label}</p>
                          <div className="space-y-1">
                            {g.events.map((ev) => (
                              <label
                                key={ev.key}
                                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/60 px-2.5 py-2 hover:bg-muted/40"
                              >
                                <Checkbox
                                  checked={selectedEvents.includes(ev.key)}
                                  onCheckedChange={(c) => setSelectedEvents(c ? [...selectedEvents, ev.key] : selectedEvents.filter((e) => e !== ev.key))}
                                />
                                <span className="truncate text-xs text-foreground">{ev.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button type="submit" disabled={isSubmitting || !url} className="h-10 w-full rounded-lg">
                    {isSubmitting ? "Salvando…" : editingId ? "Atualizar endpoint" : "Salvar endpoint"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <HDStatGrid>
        <HDStat label="Endpoints" value={String(webhooks.length)} sub={`${activeCount} ativos`} icon={Webhook} />
        <HDStat label="Entregas recentes" value={String(delivered)} sub="respostas 2xx" icon={CheckCircle2} tone="success" />
        <HDStat label="Falhas" value={String(failing)} sub="tentativas esgotadas" icon={AlertTriangle} tone={failing ? "danger" : "neutral"} />
        <HDStat label="Assinatura" value="HMAC" sub="SHA-256 · HTTPS" icon={Radio} />
      </HDStatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <HDCard
          title="Endpoints"
          description={webhooks.length === 0 ? "Nenhum endpoint configurado" : `${webhooks.length} cadastrados`}
          actions={
            <div className="relative w-44 sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={14} />
              <input
                type="text"
                placeholder="Buscar URL…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-background pl-9 pr-3 text-[12.5px] outline-none focus:border-border"
              />
            </div>
          }
        >
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Webhook size={20} className="mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-[13px] text-foreground">Nenhum endpoint ativo</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Adicione um endpoint para começar a receber eventos.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((wh) => (
                <li key={wh.id ?? wh.url} className="group flex flex-col gap-3 px-6 py-4 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", wh.is_active ? "bg-success" : "bg-muted-foreground/40")} />
                      <span className="truncate font-mono text-[12.5px] text-foreground">{wh.url}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1 pl-4">
                      {(wh.events || []).slice(0, 4).map((ev: string) => (
                        <span key={ev} className="rounded-md bg-muted/50 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                          {ev}
                        </span>
                      ))}
                      {(wh.events?.length || 0) > 4 && (
                        <span className="text-[10.5px] text-muted-foreground/70">+{(wh.events?.length || 0) - 4}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 sm:opacity-60 sm:group-hover:opacity-100">
                    <button
                      onClick={() => wh.id && sendTest(wh.id)}
                      disabled={!wh.is_active || testingId === wh.id}
                      title="Enviar evento de teste"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 px-2.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      <Send size={13} /> {testingId === wh.id ? "Enviando…" : "Testar"}
                    </button>
                    <button onClick={() => openEdit(wh)} title="Editar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => wh.id && toggleActive(wh.id, Boolean(wh.is_active))}
                      title={wh.is_active ? "Pausar" : "Ativar"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {wh.is_active ? <PowerOff size={14} /> : <Power size={14} className="text-success" />}
                    </button>
                    <button
                      onClick={() => wh.id && deleteWebhook(wh.id)}
                      title="Excluir"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HDCard>

        <HDCard title="Entregas recentes" description="Atualiza a cada 30 segundos">
          {deliveries.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Clock size={20} className="mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-[13px] text-foreground">Nenhuma entrega ainda</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Use “Testar” para validar seu endpoint agora.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {deliveries.map((d) => {
                const tone = DELIVERY_TONE[d.status] ?? DELIVERY_TONE.pending;
                const Icon = tone.Icon;
                return (
                  <li key={d.id} className="flex items-center gap-3 px-6 py-3.5">
                    <Icon className={cn("h-4 w-4 shrink-0", tone.className)} strokeWidth={2} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[12px] text-foreground">{d.event}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                        {new Date(d.created_at).toLocaleString("pt-BR")}
                        {d.attempt > 0 ? ` · ${d.attempt} tentativa${d.attempt > 1 ? "s" : ""}` : ""}
                        {d.error ? ` · ${d.error}` : ""}
                      </p>
                    </div>
                    <span className={cn("shrink-0 text-[11.5px] font-semibold tabular-nums", tone.className)}>
                      {d.response_status ?? tone.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </HDCard>
      </div>
    </HDShell>
  );
}
