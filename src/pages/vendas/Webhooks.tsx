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
import { PageShell, Panel, PageTitle } from "@/components/PageShell";

const AVAILABLE_EVENTS = ["payment.approved", "payment.failed", "payment.refunded", "chargeback.received", "subscription.canceled", "payout.approved", "payout.rejected"];

export default function Webhooks() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const load = async () => { if (!user) return; const { data } = await supabase.from("webhook_configs").select("*").order("created_at", { ascending: false }); if (data) setWebhooks(data); };
  useEffect(() => { load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return;
    if (selectedEvents.length === 0) { toast.error("Selecione pelo menos um evento"); return; }
    const { error } = await supabase.from("webhook_configs").insert({ user_id: user.id, url, events: selectedEvents, secret: crypto.randomUUID().slice(0, 16) });
    if (error) { toast.error("Erro"); return; }
    toast.success("Webhook criado!"); setOpen(false); setUrl(""); setSelectedEvents([]); load();
  };
  const toggleActive = async (id: string, current: boolean) => { await supabase.from("webhook_configs").update({ is_active: !current }).eq("id", id); load(); };
  const deleteWebhook = async (id: string) => { await supabase.from("webhook_configs").delete().eq("id", id); toast.success("Removido"); load(); };

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={<Webhook className="h-6 w-6" />} title="Webhooks" subtitle="Configure endpoints para eventos em tempo real" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2 rounded-xl text-[13px] font-bold gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> Novo Webhook</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo Webhook</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://seusite.com/webhook" type="url" required /></div>
              <div><Label className="mb-2 block">Eventos</Label><div className="space-y-2">{AVAILABLE_EVENTS.map((ev) => (<label key={ev} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={selectedEvents.includes(ev)} onCheckedChange={(checked) => setSelectedEvents(checked ? [...selectedEvents, ev] : selectedEvents.filter((e) => e !== ev))} /><span className="font-mono text-xs">{ev}</span></label>))}</div></div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground">Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {webhooks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Webhook className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="text-[13px]">Nenhum webhook</p></div>
        ) : webhooks.map((wh) => (
          <Panel key={wh.id}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`h-2 w-2 rounded-full shrink-0 ${wh.is_active ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]" : "bg-muted-foreground/20"}`} />
                <span className="font-mono text-[13px] text-muted-foreground truncate">{wh.url}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => toggleActive(wh.id, wh.is_active)}>{wh.is_active ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground/30" />}</Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteWebhook(wh.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">{(wh.events || []).map((ev: string) => (<span key={ev} className="text-[10px] font-mono px-2 py-0.5 rounded-lg text-muted-foreground bg-muted/50">{ev}</span>))}</div>
            {wh.secret && <p className="text-[11px] text-muted-foreground/50 mt-2">Secret: <span className="font-mono">••••{wh.secret.slice(-4)}</span></p>}
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
