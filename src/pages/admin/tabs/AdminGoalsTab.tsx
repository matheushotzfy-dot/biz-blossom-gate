import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Target, Calendar, Trash2, Edit3, Users, TrendingUp, Trophy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_amount: number;
  period_type: string;
  starts_at: string;
  ends_at: string;
  reward_title: string;
  reward_description: string | null;
  reward_image_url: string | null;
  is_active: boolean;
  created_at: string;
};

type Progress = { seller_id: string; seller_name: string; revenue: number; achieved: boolean };

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toInput = (iso: string) => new Date(iso).toISOString().slice(0, 16);

export default function AdminGoalsTab() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);

  const emptyForm = {
    title: "", description: "", target_amount: "",
    starts_at: toInput(new Date().toISOString()),
    ends_at: toInput(new Date(Date.now() + 30 * 86400000).toISOString()),
    reward_title: "", reward_description: "", is_active: true,
  };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("revenue_goals").select("*").order("created_at", { ascending: false });
    setGoals((data as Goal[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (g: Goal) => {
    setEditing(g);
    setForm({
      title: g.title, description: g.description || "",
      target_amount: String(g.target_amount),
      starts_at: toInput(g.starts_at), ends_at: toInput(g.ends_at),
      reward_title: g.reward_title, reward_description: g.reward_description || "",
      is_active: g.is_active,
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      target_amount: Number(form.target_amount.replace(",", ".")),
      period_type: "custom",
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      reward_title: form.reward_title.trim(),
      reward_description: form.reward_description.trim() || null,
      is_active: form.is_active,
    };
    if (!payload.title || !payload.reward_title || !payload.target_amount) { toast.error("Preencha os campos obrigatórios"); return; }

    const { error } = editing
      ? await supabase.from("revenue_goals").update(payload).eq("id", editing.id)
      : await supabase.from("revenue_goals").insert(payload as never);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(editing ? "Meta atualizada!" : "Meta criada!");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta meta e seus registros?")) return;
    const { error } = await supabase.from("revenue_goals").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Meta removida");
    load();
  };

  const toggleActive = async (g: Goal) => {
    await supabase.from("revenue_goals").update({ is_active: !g.is_active }).eq("id", g.id);
    load();
  };

  const openProgress = async (g: Goal) => {
    setSelectedGoal(g); setProgressLoading(true); setProgress([]);
    const { data } = await supabase.rpc("get_goal_progress", { _goal_id: g.id });
    setProgress((data as Progress[]) || []);
    setProgressLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-black text-2xl">Metas de Faturamento</h2>
          <p className="text-sm text-muted-foreground">Configure metas com prêmios para os sellers que atingirem</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2 rounded-xl gradient-primary text-primary-foreground font-bold">
              <Plus className="h-4 w-4" /> Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar Meta" : "Nova Meta de Faturamento"}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3 pt-2">
              <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Meta Novembro" required className="mt-1.5" /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Regras adicionais..." className="mt-1.5" rows={2} /></div>
              <div><Label>Valor da meta (R$) *</Label><Input inputMode="decimal" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })} placeholder="100000" required className="mt-1.5" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início *</Label><Input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} required className="mt-1.5" /></div>
                <div><Label>Fim *</Label><Input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} required className="mt-1.5" /></div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Recompensa</p>
                <div><Label className="text-xs">Prêmio *</Label><Input value={form.reward_title} onChange={e => setForm({ ...form, reward_title: e.target.value })} placeholder="iPhone 16 Pro" required className="mt-1" /></div>
                <div><Label className="text-xs">Detalhes</Label><Textarea value={form.reward_description} onChange={e => setForm({ ...form, reward_description: e.target.value })} placeholder="Como será entregue..." className="mt-1" rows={2} /></div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <span className="text-sm font-bold">Meta ativa (visível aos sellers)</span>
                <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-bold">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
      ) : goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center">
          <Target className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-bold">Nenhuma meta criada</p>
          <p className="text-sm text-muted-foreground mt-1">Crie sua primeira meta de faturamento com prêmios</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {goals.map(g => {
            const now = Date.now();
            const isEnded = new Date(g.ends_at).getTime() < now;
            const isFuture = new Date(g.starts_at).getTime() > now;
            const statusTone = isEnded ? "bg-muted text-muted-foreground" : isFuture ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500";
            const statusLabel = isEnded ? "Encerrada" : isFuture ? "Agendada" : "Ativa";
            return (
              <div key={g.id} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold truncate">{g.title}</h3>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${statusTone}`}>{statusLabel}</span>
                      {!g.is_active && <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">Oculta</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {format(new Date(g.starts_at), "dd/MM", { locale: ptBR })} — {format(new Date(g.ends_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Switch checked={g.is_active} onCheckedChange={() => toggleActive(g)} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Meta</p>
                    <p className="font-display font-black text-base text-primary tabular-nums">{fmt(g.target_amount)}</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Trophy className="h-3 w-3" /> Prêmio</p>
                    <p className="font-bold text-sm truncate">{g.reward_title}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => openProgress(g)} className="flex-1 gap-1.5 rounded-lg text-xs">
                    <Users className="h-3.5 w-3.5" /> Ranking
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(g)} className="gap-1.5 rounded-lg text-xs">
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(g.id)} className="rounded-lg text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Progress dialog */}
      <Dialog open={!!selectedGoal} onOpenChange={(v) => !v && setSelectedGoal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> {selectedGoal?.title}</DialogTitle>
          </DialogHeader>
          {selectedGoal && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">Meta: <span className="font-black text-primary">{fmt(selectedGoal.target_amount)}</span></p>
              {progressLoading ? (
                <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
              ) : progress.length === 0 ? (
                <p className="text-sm text-center py-8 text-muted-foreground">Nenhum seller com vendas no período</p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {progress.map((p, i) => {
                    const pct = Math.min(100, (Number(p.revenue) / Number(selectedGoal.target_amount)) * 100);
                    return (
                      <div key={p.seller_id} className={`rounded-xl border p-3 ${p.achieved ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-border/60"}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-6 w-6 rounded-md bg-muted flex items-center justify-center text-[10px] font-black tabular-nums">{i + 1}</span>
                            <span className="font-bold text-sm truncate">{p.seller_name}</span>
                            {p.achieved && <Trophy className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                          </div>
                          <span className="font-black tabular-nums text-sm">{fmt(Number(p.revenue))}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${p.achieved ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{pct.toFixed(1)}% da meta</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
