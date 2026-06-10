import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebhooks, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Webhook, Plus, Trash2, Globe, Shield, Copy, Check, Search,
  Power, PowerOff, CircleDot, Code2, Zap, LayoutGrid, Clock, ShieldCheck
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
import { StatCard } from "@/components/StatCard";

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

const ALL_EVENTS = EVENT_GROUPS.flatMap((g) => g.events.map((e) => e.key));


export default function Webhooks() {
  const { user } = useAuth();
  const { data: webhooks = [] } = useWebhooks();
  const invalidateAll = useInvalidateAll();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setUrl("");
    setSelectedEvents([]);
    setEditingId(null);
  };

  const openCreate = () => { resetForm(); setCreateOpen(true); };
  const openEdit = (wh: any) => {
    setEditingId(wh.id);
    setUrl(wh.url);
    setSelectedEvents(wh.events || []);
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
        if (error) { toast.error(error.message || "Erro ao atualizar"); return; }
        toast.success("Webhook atualizado");
      } else {
        const secret = "whsec_" + crypto.randomUUID().replace(/-/g, "") +
          crypto.randomUUID().replace(/-/g, "").slice(0, 8);
        const { error } = await supabase
          .from("webhook_configs")
          .insert({ user_id: user.id, url, events: selectedEvents, secret, is_active: true });
        if (error) { toast.error(error.message || "Erro ao criar webhook"); return; }
        toast.success("Webhook adicionado");
      }
      setCreateOpen(false);
      resetForm();
      invalidateAll(["webhooks"]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!user) return;
    const { error } = await supabase.from("webhook_configs").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidateAll(["webhooks"]);
    toast.success(current ? "Pausado" : "Ativado");
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Excluir este endpoint? Os eventos pendentes serão cancelados.")) return;
    const { error } = await supabase.from("webhook_configs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido");
    invalidateAll(["webhooks"]);
  };


  const filtered = useMemo(() => 
    webhooks.filter((w: any) => !query || w.url.toLowerCase().includes(query.toLowerCase())),
    [webhooks, query]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">Webhooks</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Notificações HTTP em tempo real para seu servidor
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 rounded-xl font-black text-xs uppercase tracking-widest gap-2">
              <Plus className="h-4 w-4" /> Novo Endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-card border-border/60">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Adicionar Webhook</DialogTitle>
              <DialogDescription className="text-xs">
                Receba eventos da plataforma via POST HTTPS.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-6 pt-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">URL de Destino</Label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://sua-api.com/webhook"
                    className="h-12 pl-10 font-mono text-xs border-border/60 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Eventos</Label>
                <div className="grid grid-cols-2 gap-3">
                  {EVENT_GROUPS.map((g) => (
                    <div key={g.label} className="space-y-2">
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest">{g.label}</p>
                      {g.events.map((ev) => (
                        <label key={ev.key} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/60 cursor-pointer hover:bg-muted/50 transition-all">
                          <Checkbox
                            checked={selectedEvents.includes(ev.key)}
                            onCheckedChange={(c) => setSelectedEvents(c ? [...selectedEvents, ev.key] : selectedEvents.filter(e => e !== ev.key))}
                          />
                          <span className="text-[11px] font-bold text-foreground truncate">{ev.label}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting || !url} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs">
                {isSubmitting ? "Adicionando..." : "Salvar Configuração"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Endpoints" 
          value={webhooks.length} 
          icon={LayoutGrid} 
          color="primary" 
          description="Total cadastrados"
        />
        <StatCard 
          title="Status" 
          value={webhooks.filter((w: any) => w.is_active).length + " Ativos"} 
          icon={CircleDot} 
          color="success" 
          description="Processando agora"
        />
        <StatCard 
          title="Protocolo" 
          value="HTTPS" 
          icon={ShieldCheck} 
          color="info" 
          description="Conexão segura"
        />
        <StatCard 
          title="Segurança" 
          value="HMAC" 
          icon={Shield} 
          color="neutral" 
          description="Assinatura SHA256"
        />
      </div>

      {/* Table Section */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Code2 size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Configurações</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Sincronização de dados</p>
            </div>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
            <input 
              type="text" 
              placeholder="Buscar URL..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-11 pl-11 pr-4 bg-muted/30 border border-border/60 rounded-xl text-sm font-bold focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/30 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 border-b border-border/40">
                <th className="px-8 py-5">Endpoint URL</th>
                <th className="px-8 py-5 text-center">Eventos</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-8 py-20 text-center text-[11px] font-black uppercase tracking-widest opacity-30">
                    Nenhum endpoint ativo
                  </td>
                </tr>
              ) : (
                filtered.map((wh: any) => (
                  <tr key={wh.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-2 w-2 rounded-full", wh.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-muted-foreground/30")} />
                        <span className="text-[11px] font-mono font-bold text-foreground truncate max-w-[300px]">{wh.url}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex justify-center gap-1">
                        {(wh.events || []).slice(0, 2).map((ev: string) => (
                          <span key={ev} className="px-2 py-0.5 rounded-lg bg-primary/5 border border-primary/10 text-[9px] font-bold text-primary uppercase">
                            {ev.split('.')[1]}
                          </span>
                        ))}
                        {(wh.events?.length || 0) > 2 && (
                          <span className="text-[9px] font-black text-muted-foreground/40">+{wh.events.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right space-x-2">
                      <button onClick={() => toggleActive(wh.id, wh.is_active)} className="h-8 w-8 rounded-lg bg-muted/40 border border-border/60 inline-flex items-center justify-center hover:bg-muted transition-all">
                        {wh.is_active ? <PowerOff size={14} /> : <Power size={14} className="text-emerald-500" />}
                      </button>
                      <button onClick={() => deleteWebhook(wh.id)} className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 inline-flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all">
                        <Trash2 size={14} />
                      </button>
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