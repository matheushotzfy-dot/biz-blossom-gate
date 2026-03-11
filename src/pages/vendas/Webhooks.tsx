import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebhooks, useInvalidateAll } from "@/hooks/useQueryData";
import { Webhook, Plus, Trash2, ToggleLeft, ToggleRight, Zap, Globe, Shield, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, Panel, GlowPanel, PageTitle, SectionHeader, EmptyState } from "@/components/PageShell";
import { cn } from "@/lib/utils";

const EVENT_CATEGORIES = [
  {
    label: "Pagamento",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
    dot: "bg-success",
    events: ["payment.approved", "payment.failed", "payment.refunded"],
  },
  {
    label: "Disputa",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    dot: "bg-destructive",
    events: ["chargeback.received"],
  },
  {
    label: "Assinatura",
    color: "text-info",
    bg: "bg-info/10",
    border: "border-info/20",
    dot: "bg-info",
    events: ["subscription.canceled"],
  },
  {
    label: "Saque",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/20",
    dot: "bg-warning",
    events: ["payout.approved", "payout.rejected"],
  },
];

const ALL_EVENTS = EVENT_CATEGORIES.flatMap((c) => c.events);

function getEventCategory(ev: string) {
  return EVENT_CATEGORIES.find((c) => c.events.includes(ev));
}

export default function Webhooks() {
  const { user } = useAuth();
  const { data: webhooks = [], refetch: load } = useWebhooks();
  const invalidateAll = useInvalidateAll();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (selectedEvents.length === 0) { toast.error("Selecione pelo menos um evento"); return; }
    
    if (!url.startsWith("https://")) {
      toast.error("URL deve usar HTTPS"); return;
    }
    if (/https:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(url)) {
      toast.error("URL não pode apontar para endereços internos"); return;
    }

    const secret = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    const { error } = await supabase.from("webhook_configs").insert({ user_id: user.id, url, events: selectedEvents, secret });
    if (error) { toast.error("Erro ao criar webhook"); return; }
    toast.success("Webhook criado!"); setOpen(false); setUrl(""); setSelectedEvents([]); invalidateAll(["webhooks"]);
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!user) return;
    await supabase.from("webhook_configs").update({ is_active: !current }).eq("id", id).eq("user_id", user.id);
    invalidateAll(["webhooks"]);
  };

  const deleteWebhook = async (id: string) => {
    if (!user) return;
    await supabase.from("webhook_configs").delete().eq("id", id).eq("user_id", user.id);
    toast.success("Webhook removido");
    invalidateAll(["webhooks"]);
  };

  const toggleAll = () => {
    setSelectedEvents(selectedEvents.length === ALL_EVENTS.length ? [] : [...ALL_EVENTS]);
  };

  const copySecret = (secret: string, id: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Secret copiado!");
  };

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<Webhook className="h-6 w-6" />} title="Webhooks" subtitle="Configure endpoints para eventos em tempo real" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-bold gradient-primary text-primary-foreground h-11 px-6 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-[1px] transition-all">
              <Plus className="h-4 w-4" /> Novo Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg rounded-2xl border-border/60 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none rounded-2xl" />
            <div className="relative px-6 pt-6 pb-4 border-b border-border/20">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <Zap className="h-4 w-4 text-primary-foreground" />
                  </div>
                  Novo Webhook
                </DialogTitle>
              </DialogHeader>
            </div>
            <form onSubmit={handleCreate} className="relative p-6 space-y-6">
              <div>
                <Label className="kicker flex items-center gap-1.5 mb-2">
                  <Globe className="h-3 w-3" /> URL do Endpoint (HTTPS)
                </Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://seusite.com/webhook"
                  type="url"
                  required
                  className="h-12 rounded-xl border-border/40 font-mono text-sm"
                  pattern="https://.*"
                  title="URL deve começar com https://"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="kicker flex items-center gap-1.5">
                    <Zap className="h-3 w-3" /> Eventos
                  </Label>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    {selectedEvents.length === ALL_EVENTS.length ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                </div>

                <div className="space-y-3">
                  {EVENT_CATEGORIES.map((cat) => (
                    <div key={cat.label} className="space-y-1.5">
                      <p className={cn("text-[10px] font-bold uppercase tracking-[0.15em]", cat.color)}>{cat.label}</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {cat.events.map((ev) => {
                          const checked = selectedEvents.includes(ev);
                          return (
                            <label
                              key={ev}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                                checked
                                  ? `${cat.bg} ${cat.border}`
                                  : "bg-muted/20 border-border/20 hover:border-border/40"
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) =>
                                  setSelectedEvents(c ? [...selectedEvents, ev] : selectedEvents.filter((e) => e !== ev))
                                }
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cat.dot)} />
                                <span className="font-mono text-[12px] text-foreground/80 font-medium">{ev}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground font-bold h-12 rounded-xl shadow-xl shadow-primary/15 text-sm"
              >
                <Webhook className="h-4 w-4 mr-2" /> Criar Webhook
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <div className="panel-enterprise p-0">
            <EmptyState
              icon={<Webhook className="h-8 w-8" />}
              title="Nenhum webhook configurado"
              subtitle="Crie seu primeiro webhook para receber notificações em tempo real"
            />
          </div>
        ) : (
          webhooks.map((wh, i) => (
            <div
              key={wh.id}
              className="panel-enterprise p-5 animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                    wh.is_active
                      ? "bg-success/10 border-success/20"
                      : "bg-muted/30 border-border/30"
                  )}>
                    <Webhook className={cn("h-4.5 w-4.5", wh.is_active ? "text-success" : "text-muted-foreground/30")} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        wh.is_active ? "bg-success shadow-[0_0_8px_hsl(var(--success)/0.5)]" : "bg-muted-foreground/20"
                      )} />
                      <span className={cn(
                        "text-[11px] font-bold uppercase tracking-wider",
                        wh.is_active ? "text-success" : "text-muted-foreground/40"
                      )}>
                        {wh.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="font-mono text-[13px] text-foreground/70 truncate mt-0.5 max-w-[300px]">{wh.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl h-9 w-9"
                    onClick={() => toggleActive(wh.id, wh.is_active)}
                  >
                    {wh.is_active ? (
                      <ToggleRight className="h-5 w-5 text-success" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-muted-foreground/30" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-xl h-9 w-9"
                    onClick={() => deleteWebhook(wh.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {(wh.events || []).map((ev: string) => {
                  const cat = getEventCategory(ev);
                  return (
                    <span
                      key={ev}
                      className={cn(
                        "text-[10px] font-mono px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1.5",
                        cat ? `${cat.bg} ${cat.border} ${cat.color}` : "bg-muted/30 border-border/30 text-muted-foreground"
                      )}
                    >
                      <span className={cn("h-1 w-1 rounded-full", cat?.dot || "bg-muted-foreground")} />
                      {ev}
                    </span>
                  );
                })}
              </div>

              {wh.secret_masked && (
                <div className="flex items-center gap-2 pt-3 border-t border-border/15">
                  <Shield className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                  <span className="text-[11px] text-muted-foreground/40">Secret:</span>
                  <span className="font-mono text-[11px] text-muted-foreground/50">{wh.secret_masked}</span>
                  <button
                    onClick={() => copySecret(wh.secret_masked, wh.id)}
                    className="ml-auto text-muted-foreground/30 hover:text-primary transition-colors"
                  >
                    {copiedId === wh.id ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="panel-enterprise-subtle p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary/50 shrink-0" />
          <p className="text-[11px] text-muted-foreground/50">
            Webhooks utilizam assinaturas HMAC-SHA256 para validação. Verifique o header <code className="font-mono text-primary/60">X-Webhook-Signature</code> em cada request.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
