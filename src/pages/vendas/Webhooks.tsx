import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebhooks, useInvalidateAll } from "@/hooks/useQueryData";
import type { Tables } from "@/integrations/supabase/types";
import {
  Plus, Trash2, Globe, Search, Pencil,
  Power, PowerOff, Copy, Webhook,
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

export default function Webhooks() {
  const { user } = useAuth();
  const { data: webhooks = [], refetch: refetchWebhooks } = useWebhooks();
  const invalidateAll = useInvalidateAll();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const copyCreatedSecret = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret);
    toast.success("Secret copiado");
  };

  const filtered = useMemo(() =>
    webhooks.filter((w) => !query || (w.url ?? "").toLowerCase().includes(query.toLowerCase())),
    [webhooks, query]
  );

  const activeCount = webhooks.filter(w => w.is_active).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header — clean */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-foreground">
            Webhooks
          </h1>
          <p className="text-sm text-muted-foreground">
            Receba eventos em tempo real assinados com HMAC-SHA256 no seu servidor.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="h-10 px-4 rounded-lg text-sm font-medium gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Novo endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-card border-border/60 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                {editingId ? "Editar webhook" : "Adicionar webhook"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Receba eventos via POST HTTPS. Cada evento é assinado com HMAC-SHA256 e isolado por conta.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              {createdSecret && (
                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/40 p-4">
                  <Label className="text-xs text-muted-foreground">Secret do webhook</Label>
                  <div className="flex gap-2">
                    <Input value={createdSecret} readOnly className="h-10 font-mono text-xs rounded-lg" />
                    <Button type="button" onClick={copyCreatedSecret} variant="outline" className="h-10 rounded-lg px-3" aria-label="Copiar secret">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Guarde em local seguro — não será exibido novamente.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">URL de destino</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://sua-api.com/webhook"
                    className="h-10 pl-9 font-mono text-xs rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Eventos</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {EVENT_GROUPS.map((g) => (
                    <div key={g.label} className="space-y-2">
                      <p className="text-[11px] font-medium text-foreground">{g.label}</p>
                      <div className="space-y-1">
                        {g.events.map((ev) => (
                          <label
                            key={ev.key}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border/60 hover:bg-muted/40 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedEvents.includes(ev.key)}
                              onCheckedChange={(c) => setSelectedEvents(c ? [...selectedEvents, ev.key] : selectedEvents.filter(e => e !== ev.key))}
                            />
                            <span className="text-xs text-foreground truncate">{ev.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting || !url} className="w-full h-10 rounded-lg">
                {isSubmitting ? "Salvando…" : editingId ? "Atualizar webhook" : "Salvar configuração"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Minimal metric strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 rounded-2xl border border-border/60 bg-card divide-x divide-border/60">
        {[
          { label: "Endpoints", value: String(webhooks.length) },
          { label: "Ativos", value: String(activeCount) },
          { label: "Protocolo", value: "HTTPS" },
          { label: "Assinatura", value: "HMAC-SHA256" },
        ].map((item, i) => (
          <div key={item.label} className={cn("px-5 py-4", i >= 2 && "hidden md:block")}>
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground tabular-nums tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Endpoints configurados</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {webhooks.length === 0 ? "Nenhum endpoint" : `${webhooks.length} ${webhooks.length === 1 ? "endpoint" : "endpoints"}`}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={14} />
            <input
              type="text"
              placeholder="Buscar URL…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-background border border-border/60 rounded-lg text-sm focus:outline-none focus:border-border"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border/60">
                <th className="px-5 py-3 font-medium">Endpoint</th>
                <th className="px-5 py-3 font-medium">Eventos</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-16 text-center">
                    <Webhook size={20} className="mx-auto text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-foreground">Nenhum endpoint ativo</p>
                    <p className="text-xs text-muted-foreground mt-1">Adicione um endpoint para começar a receber eventos.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((wh) => (
                  <tr key={wh.id ?? wh.url} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            wh.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"
                          )}
                        />
                        <span className="font-mono text-xs text-foreground truncate max-w-[380px]">{wh.url}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1">
                        {(wh.events || []).slice(0, 3).map((ev: string) => (
                          <span
                            key={ev}
                            className="px-1.5 py-0.5 rounded-md bg-muted/60 text-[10px] font-medium text-muted-foreground"
                          >
                            {ev}
                          </span>
                        ))}
                        {(wh.events?.length || 0) > 3 && (
                          <span className="text-[10px] font-medium text-muted-foreground/70">
                            +{wh.events.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(wh)}
                          title="Editar"
                          className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => wh.id && toggleActive(wh.id, Boolean(wh.is_active))}
                          title={wh.is_active ? "Pausar" : "Ativar"}
                          className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          {wh.is_active ? <PowerOff size={14} /> : <Power size={14} className="text-emerald-500" />}
                        </button>
                        <button
                          onClick={() => wh.id && deleteWebhook(wh.id)}
                          title="Excluir"
                          className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
