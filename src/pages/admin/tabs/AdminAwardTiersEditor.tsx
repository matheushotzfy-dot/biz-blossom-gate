import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/seller-ui/confirm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { logAdminAction } from "@/lib/auditLog";

interface Tier {
  id: string; title: string; tier: string; value: number; description: string; phrase: string;
  rewards: string[]; image_url: string | null; sort_order: number; is_active: boolean;
}

/** Admin editor for award milestones shown on the seller "Premiações" page. */
export function AdminAwardTiersEditor() {
  const { ask: askConfirm, dialog: confirmDialog } = useConfirm();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("award_tiers").select("*").order("sort_order");
    if (error) toast.error("Não foi possível carregar os marcos");
    setTiers((data ?? []) as Tier[]);
  };
  useEffect(() => { void load(); }, []);

  const patch = (id: string, p: Partial<Tier>) => setTiers((t) => t.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = async (t: Tier) => {
    const value = Number(t.value);
    if (!t.title.trim() || !Number.isFinite(value) || value <= 0 || value > 100_000_000) {
      toast.error("Informe nome e meta válida (até 100.000.000)");
      return;
    }
    setSaving(t.id);
    const { error } = await supabase.from("award_tiers").upsert({ ...t, value, rewards: t.rewards.filter(Boolean) });
    setSaving(null);
    if (error) { toast.error("Erro ao salvar marco"); return; }
    void logAdminAction("award_tier_saved", "award_tiers", t.id, { value: t.value, active: t.is_active });
    toast.success("Marco salvo");
  };

  const remove = async (id: string) => {
    const ok = await askConfirm({ title: "Remover este marco?", description: "Resgates já feitos continuam registrados.", confirmLabel: "Remover marco" });
    if (!ok) return;
    const { error } = await supabase.from("award_tiers").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    void logAdminAction("award_tier_deleted", "award_tiers", id, {});
    setTiers((t) => t.filter((x) => x.id !== id));
  };

  const add = () => {
    const id = `m${Date.now().toString(36)}`;
    setTiers((t) => [...t, { id, title: "Novo marco", tier: "", value: 50_000, description: "", phrase: "", rewards: [], image_url: null, sort_order: t.length + 1, is_active: false }]);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Premiações · seller</p>
          <h3 className="font-display text-lg font-bold text-foreground">Marcos de faturamento</h3>
          <p className="text-xs text-muted-foreground">Alterações aparecem ao vivo na página de Premiações dos sellers.</p>
        </div>
        <Button size="sm" onClick={add}><Plus className="h-4 w-4" />Novo marco</Button>
      </div>
      <div className="grid gap-2">
        {tiers.map((t) => (
          <div key={t.id} className="grid gap-2 rounded-lg border border-border bg-background p-3 lg:grid-cols-[60px_1.4fr_1fr_140px_1.6fr_1.2fr_auto] lg:items-center">
            <Input type="number" aria-label="Ordem" value={t.sort_order} onChange={(e) => patch(t.id, { sort_order: Number(e.target.value) })} />
            <Input aria-label="Nome" value={t.title} onChange={(e) => patch(t.id, { title: e.target.value })} />
            <Input aria-label="Nível" placeholder="Nível (ex. Elite)" value={t.tier} onChange={(e) => patch(t.id, { tier: e.target.value })} />
            <Input type="number" min={0} max={100_000_000} aria-label="Meta em reais" value={t.value} onChange={(e) => {
              const raw = Number(e.target.value);
              const clamped = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 100_000_000) : 0;
              patch(t.id, { value: clamped });
            }} />
            <Input aria-label="Recompensas" placeholder="Recompensas separadas por vírgula" value={t.rewards.join(", ")} onChange={(e) => patch(t.id, { rewards: e.target.value.split(",").map((s) => s.trim()) })} />
            <Input aria-label="URL da imagem" placeholder="URL da imagem (opcional)" value={t.image_url ?? ""} onChange={(e) => patch(t.id, { image_url: e.target.value || null })} />
            <div className="flex items-center gap-2">
              <Switch checked={t.is_active} onCheckedChange={(v) => patch(t.id, { is_active: v })} aria-label="Ativo" />
              <Button size="icon" variant="outline" disabled={saving === t.id} onClick={() => save(t)} aria-label="Salvar"><Save className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(t.id)} aria-label="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
      {confirmDialog}
    </section>
  );
}
