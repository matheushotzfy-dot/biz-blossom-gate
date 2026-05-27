/**
 * Webhooks — Editorial Dense Table + Drawer
 * No glow, no orbs, no pulsing — clean Stripe-style management.
 */
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebhooks, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Webhook, Plus, Trash2, Globe, Shield, Copy, Check, Search,
  Power, PowerOff, CircleDot, Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EVENT_GROUPS = [
  {
    label: "Pagamento",
    accent: "text-success",
    events: [
      { key: "payment.approved", label: "Pagamento aprovado" },
      { key: "payment.failed", label: "Pagamento falhou" },
      { key: "payment.refunded", label: "Reembolso realizado" },
    ],
  },
  {
    label: "Disputa",
    accent: "text-destructive",
    events: [{ key: "chargeback.received", label: "Chargeback recebido" }],
  },
  {
    label: "Assinatura",
    accent: "text-info",
    events: [{ key: "subscription.canceled", label: "Assinatura cancelada" }],
  },
  {
    label: "Saque",
    accent: "text-warning",
    events: [
      { key: "payout.approved", label: "Saque aprovado" },
      { key: "payout.rejected", label: "Saque rejeitado" },
    ],
  },
];

const ALL_EVENTS = EVENT_GROUPS.flatMap((g) => g.events.map((e) => e.key));
const labelFor = (k: string) =>
  EVENT_GROUPS.flatMap((g) => g.events).find((e) => e.key === k)?.label || k;

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const NODE_SAMPLE = `import crypto from "node:crypto";
import express from "express";

const app = express();

app.post("/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["x-hotzfy-signature"] as string;
    const expected = crypto
      .createHmac("sha256", process.env.WEBHOOK_SECRET!)
      .update(req.body)
      .digest("hex");

    if (!crypto.timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex"),
    )) return res.status(401).end();

    const event = JSON.parse(req.body.toString());
    // handle event.type...
    res.status(200).json({ received: true });
  });`;

export default function Webhooks() {
  const { user } = useAuth();
  const { data: webhooks = [] } = useWebhooks();
  const invalidateAll = useInvalidateAll();
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (selectedEvents.length === 0) {
      toast.error("Selecione pelo menos um evento");
      return;
    }
    if (!url.startsWith("https://")) {
      toast.error("URL deve usar HTTPS");
      return;
    }
    if (/https:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(url)) {
      toast.error("URL não pode apontar para endereços internos");
      return;
    }
    const secret = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const { error } = await supabase
      .from("webhook_configs")
      .insert({ user_id: user.id, url, events: selectedEvents, secret });
    if (error) {
      toast.error("Erro ao criar webhook");
      return;
    }
    toast.success("Webhook criado");
    setCreateOpen(false);
    setUrl("");
    setSelectedEvents([]);
    invalidateAll(["webhooks"]);
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!user) return;
    await supabase
      .from("webhook_configs")
      .update({ is_active: !current })
      .eq("id", id)
      .eq("user_id", user.id);
    invalidateAll(["webhooks"]);
  };

  const deleteWebhook = async (id: string) => {
    if (!user) return;
    if (!confirm("Excluir este webhook?")) return;
    await supabase.from("webhook_configs").delete().eq("id", id).eq("user_id", user.id);
    toast.success("Webhook removido");
    setDrawerId(null);
    invalidateAll(["webhooks"]);
  };

  const toggleAll = () =>
    setSelectedEvents(
      selectedEvents.length === ALL_EVENTS.length ? [] : [...ALL_EVENTS],
    );

  const filtered = useMemo(
    () =>
      webhooks.filter(
        (w: any) => !query || w.url.toLowerCase().includes(query.toLowerCase()),
      ),
    [webhooks, query],
  );

  const drawerHook = webhooks.find((w: any) => w.id === drawerId);
  const activeCount = webhooks.filter((w: any) => w.is_active).length;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 pt-6 pb-20">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 pb-5 mb-5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/70 mb-1.5">
            <Webhook className="h-3 w-3" />
            <span className="uppercase tracking-[0.14em]">Integrações</span>
            <span className="text-border">/</span>
            <span className="text-foreground/80">Webhooks</span>
          </div>
          <h1 className="text-[22px] font-heading font-bold tracking-[-0.02em] text-foreground">
            Endpoints de webhook
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {webhooks.length} endpoint{webhooks.length !== 1 && "s"} ·{" "}
            {activeCount} ativo{activeCount !== 1 && "s"} · Notificações HTTPS assinadas com{" "}
            <code className="font-mono text-foreground/80">HMAC-SHA256</code>.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar endpoint</DialogTitle>
              <DialogDescription>
                Receberá eventos via POST. Apenas HTTPS é aceito.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5 pt-1">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  URL do endpoint
                </Label>
                <div className="relative mt-1.5">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://api.suaempresa.com/webhooks/hotzfy"
                    type="url"
                    required
                    className="h-10 pl-9 font-mono text-[12.5px]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Eventos
                  </Label>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    {selectedEvents.length === ALL_EVENTS.length ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                </div>
                <div className="border border-border/60 rounded-lg divide-y divide-border/40 max-h-[280px] overflow-y-auto">
                  {EVENT_GROUPS.map((g) => (
                    <div key={g.label}>
                      <div className="px-3 py-1.5 bg-muted/20 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        {g.label}
                      </div>
                      {g.events.map((ev) => {
                        const checked = selectedEvents.includes(ev.key);
                        return (
                          <label
                            key={ev.key}
                            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/15"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) =>
                                setSelectedEvents(
                                  c
                                    ? [...selectedEvents, ev.key]
                                    : selectedEvents.filter((e) => e !== ev.key),
                                )
                              }
                            />
                            <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                              <span className="text-[13px] text-foreground truncate">{ev.label}</span>
                              <code className="font-mono text-[10.5px] text-muted-foreground/70 shrink-0">
                                {ev.key}
                              </code>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={!url || selectedEvents.length === 0}>
                  Adicionar endpoint
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Search */}
      <div className="mb-3 relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por URL..."
          className="h-9 pl-8 text-[13px] bg-card border-border/50 rounded-lg"
        />
      </div>

      {/* Table */}
      <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
        <div className="grid grid-cols-[auto_1fr_140px_120px_80px] gap-4 px-4 py-2.5 border-b border-border/60 bg-background/30 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <div className="w-2" />
          <div>Endpoint</div>
          <div>Eventos</div>
          <div>Criado</div>
          <div className="text-right">Ações</div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-12 w-12 mx-auto rounded-xl border border-border/60 bg-background/40 flex items-center justify-center mb-3">
              <Webhook className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-semibold text-foreground">Nenhum endpoint configurado</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Adicione um para começar a receber eventos em tempo real.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {filtered.map((wh: any) => (
              <li
                key={wh.id}
                onClick={() => setDrawerId(wh.id)}
                className="grid grid-cols-[auto_1fr_140px_120px_80px] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-muted/15 transition-colors"
              >
                <div className="flex items-center">
                  <CircleDot
                    className={cn(
                      "h-3.5 w-3.5",
                      wh.is_active ? "text-success" : "text-muted-foreground/40",
                    )}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-mono text-foreground truncate">{wh.url}</p>
                  <p className="text-[10.5px] text-muted-foreground/70 mt-0.5">
                    {wh.is_active ? "Ativo · recebendo eventos" : "Pausado"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(wh.events || []).slice(0, 2).map((ev: string) => (
                    <span
                      key={ev}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 bg-background/40 text-muted-foreground"
                    >
                      {ev}
                    </span>
                  ))}
                  {(wh.events?.length || 0) > 2 && (
                    <span className="text-[10px] text-muted-foreground/70 font-medium">
                      +{wh.events.length - 2}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {wh.created_at ? `há ${relTime(wh.created_at)}` : "—"}
                </div>
                <div
                  className="flex items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => toggleActive(wh.id, wh.is_active)}
                    className={cn(
                      "h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/60 bg-background/40 hover:border-border",
                      wh.is_active ? "text-success" : "text-muted-foreground",
                    )}
                    title={wh.is_active ? "Pausar" : "Ativar"}
                  >
                    {wh.is_active ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteWebhook(wh.id)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/60 bg-background/40 text-destructive hover:border-destructive/40"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Integration guide */}
      <div className="mt-8 border border-border/60 rounded-xl bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border/60 bg-background/30">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[13px] font-heading font-bold text-foreground">
            Validar assinatura no seu servidor
          </h2>
          <span className="ml-auto text-[10.5px] font-mono text-muted-foreground">Node.js · Express</span>
        </div>
        <div className="relative">
          <button
            onClick={() => {
              navigator.clipboard.writeText(NODE_SAMPLE);
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 1600);
              toast.success("Código copiado");
            }}
            className="absolute top-3 right-3 inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-background/80 px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {copiedCode ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            {copiedCode ? "Copiado" : "Copiar"}
          </button>
          <pre className="p-5 overflow-x-auto text-[12px] font-mono text-foreground/85 leading-[1.6]">
{NODE_SAMPLE}
          </pre>
        </div>
        <div className="px-5 py-3 border-t border-border/60 bg-background/30 flex items-start gap-2.5">
          <Shield className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            A assinatura vem no header{" "}
            <code className="font-mono text-foreground/80">X-Hotzfy-Signature</code>. Use comparação
            em tempo constante (<code className="font-mono text-foreground/80">timingSafeEqual</code>)
            e responda com 200 em até 10s — caso contrário, reenviamos com backoff exponencial.
          </p>
        </div>
      </div>

      {/* Drawer */}
      <Sheet open={!!drawerHook} onOpenChange={(o) => !o && setDrawerId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          {drawerHook && (
            <>
              <SheetHeader className="px-5 py-4 border-b border-border/60">
                <SheetTitle className="text-[15px] font-heading font-bold tracking-[-0.01em]">
                  Detalhes do endpoint
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                <div>
                  <Label className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">URL</Label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                    <code className="flex-1 text-[12.5px] font-mono text-foreground break-all">{drawerHook.url}</code>
                  </div>
                </div>
                <div>
                  <Label className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Status</Label>
                  <div className="mt-1.5 flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <CircleDot className={cn("h-3.5 w-3.5", drawerHook.is_active ? "text-success" : "text-muted-foreground/40")} />
                      <span className="text-[13px] font-medium text-foreground">
                        {drawerHook.is_active ? "Ativo" : "Pausado"}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleActive(drawerHook.id, drawerHook.is_active)}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      {drawerHook.is_active ? "Pausar" : "Reativar"}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Eventos ({drawerHook.events?.length || 0})
                  </Label>
                  <ul className="mt-1.5 border border-border/60 rounded-lg divide-y divide-border/40">
                    {(drawerHook.events || []).map((ev: string) => (
                      <li key={ev} className="flex items-center justify-between px-3 py-2">
                        <span className="text-[12.5px] text-foreground">{labelFor(ev)}</span>
                        <code className="text-[10.5px] font-mono text-muted-foreground">{ev}</code>
                      </li>
                    ))}
                  </ul>
                </div>
                {drawerHook.secret_masked && (
                  <div>
                    <Label className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      Signing secret
                    </Label>
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                      <code className="flex-1 text-[12px] font-mono text-muted-foreground truncate">
                        {drawerHook.secret_masked}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(drawerHook.secret_masked);
                          setCopiedSecret(true);
                          setTimeout(() => setCopiedSecret(false), 1600);
                          toast.success("Secret copiado");
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                      >
                        {copiedSecret ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-5 py-3.5 border-t border-border/60 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5 gap-2"
                  onClick={() => deleteWebhook(drawerHook.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
                <Button className="flex-1" onClick={() => setDrawerId(null)}>
                  Fechar
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
