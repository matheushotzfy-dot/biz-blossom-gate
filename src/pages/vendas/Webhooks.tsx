import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Webhook, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const AVAILABLE_EVENTS = [
  "payment.approved",
  "payment.failed",
  "payment.refunded",
  "chargeback.received",
  "subscription.canceled",
  "payout.approved",
  "payout.rejected",
];

export default function Webhooks() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("webhook_configs").select("*").order("created_at", { ascending: false });
    if (data) setWebhooks(data);
  };

  useEffect(() => { load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (selectedEvents.length === 0) { toast.error("Selecione pelo menos um evento"); return; }
    const secret = crypto.randomUUID().slice(0, 16);
    const { error } = await supabase.from("webhook_configs").insert({
      user_id: user.id,
      url,
      events: selectedEvents,
      secret,
    });
    if (error) { toast.error("Erro ao criar webhook"); return; }
    toast.success("Webhook criado!");
    setOpen(false);
    setUrl("");
    setSelectedEvents([]);
    load();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("webhook_configs").update({ is_active: !current }).eq("id", id);
    load();
  };

  const deleteWebhook = async (id: string) => {
    await supabase.from("webhook_configs").delete().eq("id", id);
    toast.success("Webhook removido");
    load();
  };

  return (
    <div className="space-y-6 dark">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Webhook className="h-6 w-6 text-primary" /> Webhooks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Configure endpoints para receber eventos em tempo real</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Novo Webhook</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo Webhook</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>URL do Endpoint</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://seusite.com/webhook" type="url" required className="mt-1" />
              </div>
              <div>
                <Label className="mb-2 block">Eventos</Label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map((ev) => (
                    <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedEvents.includes(ev)}
                        onCheckedChange={(checked) => {
                          setSelectedEvents(checked ? [...selectedEvents, ev] : selectedEvents.filter((e) => e !== ev));
                        }}
                      />
                      <span className="font-mono text-xs">{ev}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground">Criar Webhook</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum webhook configurado</p>
          </div>
        ) : (
          webhooks.map((wh) => (
            <div key={wh.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full ${wh.is_active ? "bg-primary" : "bg-muted-foreground"}`} />
                  <span className="font-mono text-sm truncate">{wh.url}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(wh.id, wh.is_active)}>
                    {wh.is_active ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteWebhook(wh.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(wh.events || []).map((ev: string) => (
                  <span key={ev} className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded">{ev}</span>
                ))}
              </div>
              {wh.secret && (
                <p className="text-xs text-muted-foreground mt-2">Secret: <span className="font-mono">••••{wh.secret.slice(-4)}</span></p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
