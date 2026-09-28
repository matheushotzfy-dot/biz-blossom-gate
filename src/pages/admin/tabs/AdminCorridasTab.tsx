import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flag, Plus, Trash2, Upload, Gift, Save, Eye, EyeOff, RefreshCw, Users, Sparkles, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";
import { logAdminAction } from "@/lib/auditLog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Race = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  banner_url: string | null;
  logo_url: string | null;
};

type Prize = {
  id: string;
  race_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  min_revenue_cents: number;
  target_position: number | null;
  sort_order: number;
};

type Override = {
  id: string;
  race_id: string;
  seller_id: string | null;
  display_name: string;
  avatar_url: string | null;
  revenue_cents: number;
  sales_count: number;
};

const toDateInput = (iso: string) => {
  try { return new Date(iso).toISOString().slice(0, 16); } catch { return ""; }
};

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminCorridasTab() {
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const selected = races.find(r => r.id === selectedId) || null;

  const loadRaces = async () => {
    setLoading(true);
    const { data } = await supabase.from("revenue_races").select("*").order("created_at", { ascending: false });
    setRaces((data || []) as Race[]);
    if (!selectedId && data && data.length) setSelectedId(data[0].id);
    setLoading(false);
  };

  const loadPrizes = async (raceId: string) => {
    const [{ data: pr }, { data: lb }, { data: ov }] = await Promise.all([
      supabase.from("revenue_race_prizes").select("*").eq("race_id", raceId).order("sort_order", { ascending: true }),
      supabase.rpc("race_leaderboard", { _race_id: raceId }),
      supabase.from("revenue_race_overrides").select("*").eq("race_id", raceId).order("revenue_cents", { ascending: false }),
    ]);
    setPrizes((pr || []) as Prize[]);
    setLeaderboard(lb || []);
    setOverrides((ov || []) as Override[]);
  };

  useEffect(() => { loadRaces(); }, []);
  useEffect(() => { if (selectedId) loadPrizes(selectedId); }, [selectedId]);

  const addOverride = async () => {
    if (!selected) return;
    const { data, error } = await supabase.from("revenue_race_overrides").insert({
      race_id: selected.id,
      display_name: "Novo participante",
      revenue_cents: 0,
      sales_count: 0,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setOverrides(prev => [data as Override, ...prev]);
    await logAdminAction("create_race_override", "revenue_race_override", data.id, { race_id: selected.id });
    loadPrizes(selected.id);
  };

  const updateOverride = async (id: string, patch: Partial<Override>) => {
    const { error } = await supabase.from("revenue_race_overrides").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setOverrides(prev => prev.map(o => o.id === id ? { ...o, ...patch } as Override : o));
    await logAdminAction("update_race_override", "revenue_race_override", id, patch as any);
    if (selected) loadPrizes(selected.id);
  };

  const deleteOverride = (id: string) => {
    setConfirmAction({
      title: "Remover entrada do ranking?",
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        const { error } = await supabase.from("revenue_race_overrides").delete().eq("id", id);
        if (error) { toast.error(error.message); return; }
        setOverrides(prev => prev.filter(o => o.id !== id));
        await logAdminAction("delete_race_override", "revenue_race_override", id);
        if (selected) loadPrizes(selected.id);
      },
    });
  };

  const seedDemoRanking = () => {
    if (!selected) return;
    setConfirmAction({
      title: "Preencher ranking de demonstração?",
      description: "Adiciona 5 participantes de exemplo. Isso NÃO remove os existentes.",
      onConfirm: async () => {
        if (!selected) return;
        const demo = [
          { display_name: "Bryan G.",    revenue_cents: 87500000, sales_count: 342 },
          { display_name: "Airis F.",    revenue_cents: 64200000, sales_count: 258 },
          { display_name: "Wdzin",       revenue_cents: 41800000, sales_count: 197 },
          { display_name: "Marina S.",   revenue_cents: 28900000, sales_count: 134 },
          { display_name: "Lucas P.",    revenue_cents: 19700000, sales_count: 88 },
        ].map(d => ({ ...d, race_id: selected.id }));
        const { error } = await supabase.from("revenue_race_overrides").insert(demo);
        if (error) { toast.error(error.message); return; }
        toast.success("Ranking de demonstração inserido");
        await logAdminAction("seed_demo_ranking", "revenue_race", selected.id, { count: demo.length });
        loadPrizes(selected.id);
      },
    });
  };


  const createRace = async () => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const { data, error } = await supabase.from("revenue_races").insert({
      title: "Nova Corrida",
      description: "",
      starts_at: now.toISOString(),
      ends_at: in30.toISOString(),
      is_active: true,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Corrida criada");
    await logAdminAction("create_race", "revenue_race", data.id, { title: data.title });
    setRaces(prev => [data as Race, ...prev]);
    setSelectedId(data.id);
  };

  const updateRace = async (patch: Partial<Race>) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("revenue_races").update(patch).eq("id", selected.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setRaces(prev => prev.map(r => r.id === selected.id ? { ...r, ...patch } as Race : r));
    toast.success("Salvo");
    await logAdminAction("update_race", "revenue_race", selected.id, patch as any);
  };

  const deleteRace = () => {
    if (!selected) return;
    const raceId = selected.id;
    setConfirmAction({
      title: "Excluir esta corrida?",
      description: "Todos os prêmios e o ranking associado serão removidos. Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        const { error } = await supabase.from("revenue_races").delete().eq("id", raceId);
        if (error) { toast.error(error.message); return; }
        setRaces(prev => prev.filter(r => r.id !== raceId));
        setSelectedId(races.find(r => r.id !== raceId)?.id ?? null);
        toast.success("Corrida excluída");
        await logAdminAction("delete_race", "revenue_race", raceId);
      },
    });
  };

  const uploadAsset = async (file: File, field: "banner_url" | "logo_url") => {
    if (!selected) return;
    const path = `${selected.id}/${field}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("race-assets").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("race-assets").getPublicUrl(path);
    await updateRace({ [field]: data.publicUrl } as Partial<Race>);
  };

  const uploadPrizeImage = async (file: File, prize: Prize) => {
    if (!selected) return;
    const path = `${selected.id}/prize-${prize.id}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("race-assets").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("race-assets").getPublicUrl(path);
    await updatePrize(prize.id, { image_url: data.publicUrl });
  };

  const addPrize = async () => {
    if (!selected) return;
    const { data, error } = await supabase.from("revenue_race_prizes").insert({
      race_id: selected.id,
      title: "Novo prêmio",
      min_revenue_cents: 10000000,
      sort_order: prizes.length,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setPrizes(prev => [...prev, data as Prize]);
    await logAdminAction("create_race_prize", "revenue_race_prize", data.id, { race_id: selected.id });
  };

  const updatePrize = async (id: string, patch: Partial<Prize>) => {
    const { error } = await supabase.from("revenue_race_prizes").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setPrizes(prev => prev.map(p => p.id === id ? { ...p, ...patch } as Prize : p));
    await logAdminAction("update_race_prize", "revenue_race_prize", id, patch as any);
  };

  const deletePrize = (id: string) => {
    setConfirmAction({
      title: "Remover este prêmio?",
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        const { error } = await supabase.from("revenue_race_prizes").delete().eq("id", id);
        if (error) { toast.error(error.message); return; }
        setPrizes(prev => prev.filter(p => p.id !== id));
        await logAdminAction("delete_race_prize", "revenue_race_prize", id);
      },
    });
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando corridas...</div>;

  const activeCount = races.filter(r => r.is_active).length;
  const prizeCount = prizes.length;
  const overrideCount = overrides.length;
  const leaderCount = Array.isArray(leaderboard) ? leaderboard.length : 0;

  return (
    <div className="space-y-6">
      <FinanceiroHero
        eyebrow="Torneios & prêmios"
        title="Corridas de Faturamento"
        subtitle="Gerencie torneios, prêmios e o ranking em tempo real dos sellers."
        status={{ tone: activeCount > 0 ? "success" : "neutral", label: `${races.length} corridas · ${activeCount} ativa(s)`, pulse: activeCount > 0 }}
        actions={
          <button onClick={createRace} className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 h-10 text-[11px] font-black uppercase tracking-wider hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Nova corrida
          </button>
        }
      />

      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi label="Corridas totais" value={String(races.length)} sub={`${activeCount} ativa(s)`} icon={Flag} tone="primary" />
        <FinanceiroKpi label="Prêmios (atual)" value={String(prizeCount)} sub="Da corrida selecionada" icon={Gift} tone="info" />
        <FinanceiroKpi label="Líderes no ranking" value={String(leaderCount)} sub="Top posições calculadas" icon={Trophy} tone="warning" />
        <FinanceiroKpi label="Overrides manuais" value={String(overrideCount)} sub="Sellers fictícios/injetados" icon={Sparkles} tone="neutral" />
      </FinanceiroKpiGrid>


      <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-4">
        {/* Race list */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Corridas
          </div>
          {races.length === 0 && <div className="p-6 text-xs text-muted-foreground text-center">Nenhuma corrida ainda.</div>}
          {races.map(r => (
            <button key={r.id} onClick={() => setSelectedId(r.id)}
              className={cn("w-full text-left px-4 py-3 border-b border-border/20 hover:bg-muted/40 flex items-center gap-2",
                selectedId === r.id && "bg-primary/[0.06]")}>
              <div className={cn("h-2 w-2 rounded-full shrink-0", r.is_active ? "bg-success" : "bg-muted-foreground/40")} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{r.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.starts_at).toLocaleDateString("pt-BR")} → {new Date(r.ends_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Editor */}
        {selected ? (
          <div className="space-y-4">
            {/* Race form */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm">Configurações da corrida</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateRace({ is_active: !selected.is_active })}
                    className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border",
                      selected.is_active ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground border-border")}>
                    {selected.is_active ? <><Eye className="h-3.5 w-3.5" /> Ativa</> : <><EyeOff className="h-3.5 w-3.5" /> Inativa</>}
                  </button>
                  <button onClick={deleteRace} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título</span>
                  <input defaultValue={selected.title} onBlur={e => updateRace({ title: e.target.value })}
                    className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descrição</span>
                  <input defaultValue={selected.description || ""} onBlur={e => updateRace({ description: e.target.value })}
                    className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Início</span>
                  <input type="datetime-local" defaultValue={toDateInput(selected.starts_at)}
                    onBlur={e => updateRace({ starts_at: new Date(e.target.value).toISOString() })}
                    className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3 text-sm tabular-nums" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fim</span>
                  <input type="datetime-local" defaultValue={toDateInput(selected.ends_at)}
                    onBlur={e => updateRace({ ends_at: new Date(e.target.value).toISOString() })}
                    className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3 text-sm tabular-nums" />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(["banner_url", "logo_url"] as const).map(field => (
                  <div key={field} className="rounded-xl border border-dashed border-border/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {field === "banner_url" ? "Banner" : "Logo"}
                      </span>
                      <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                        <Upload className="h-3.5 w-3.5" /> Enviar
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => e.target.files?.[0] && uploadAsset(e.target.files[0], field)} />
                      </label>
                    </div>
                    {selected[field] ? (
                      <img src={selected[field] as string} alt="" className="mt-2 h-24 w-full object-cover rounded-lg border border-border/40" />
                    ) : (
                      <div className="mt-2 h-24 rounded-lg bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                        Nenhuma imagem
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {saving && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Save className="h-3 w-3 animate-pulse" /> Salvando...</p>}
            </div>

            {/* Prizes */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> Faixas de prêmios</h3>
                <button onClick={addPrize} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              {prizes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum prêmio configurado.</p>
              ) : (
                <div className="space-y-2">
                  {prizes.map(p => (
                    <div key={p.id} className="grid grid-cols-1 md:grid-cols-[80px,1fr,140px,80px,40px] gap-2 items-center border border-border/40 rounded-xl p-2">
                      <div className="relative h-16 w-full md:w-20 rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center group">
                        {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Gift className="h-5 w-5 text-muted-foreground" />}
                        <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer">
                          <Upload className="h-4 w-4 text-white" />
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadPrizeImage(e.target.files[0], p)} />
                        </label>
                      </div>
                      <input defaultValue={p.title} placeholder="Título do prêmio" onBlur={e => updatePrize(p.id, { title: e.target.value })}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium" />
                      <input type="number" step="0.01" defaultValue={(p.min_revenue_cents / 100).toFixed(2)}
                        onBlur={e => updatePrize(p.id, { min_revenue_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-sm tabular-nums text-right"
                        placeholder="Meta R$" />
                      <input type="number" defaultValue={p.sort_order}
                        onBlur={e => updatePrize(p.id, { sort_order: parseInt(e.target.value || "0", 10) })}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-sm tabular-nums text-right"
                        placeholder="Ordem" />
                      <button onClick={() => deletePrize(p.id)} className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10 flex items-center justify-center">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual ranking manipulation */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Manipular Ranking</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Adicione entradas manuais ao ranking. Valores manuais substituem os reais para o mesmo vendedor.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={seedDemoRanking} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-muted text-foreground border border-border hover:bg-muted/70">
                    <Sparkles className="h-3.5 w-3.5" /> Preencher demo
                  </button>
                  <button onClick={addOverride} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20">
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </button>
                </div>
              </div>
              {overrides.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma entrada manual. Use "Preencher demo" para ver o pódio em ação.</p>
              ) : (
                <div className="space-y-2">
                  {overrides.map(o => (
                    <div key={o.id} className="grid grid-cols-1 md:grid-cols-[1fr,140px,90px,40px] gap-2 items-center border border-border/40 rounded-xl p-2">
                      <input defaultValue={o.display_name} placeholder="Nome exibido"
                        onBlur={e => updateOverride(o.id, { display_name: e.target.value })}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium" />
                      <input type="number" step="0.01" defaultValue={(o.revenue_cents / 100).toFixed(2)}
                        onBlur={e => updateOverride(o.id, { revenue_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-sm tabular-nums text-right"
                        placeholder="Faturamento R$" />
                      <input type="number" defaultValue={o.sales_count}
                        onBlur={e => updateOverride(o.id, { sales_count: parseInt(e.target.value || "0", 10) })}
                        className="h-9 rounded-lg border border-border bg-background px-3 text-sm tabular-nums text-right"
                        placeholder="Vendas" />
                      <button onClick={() => deleteOverride(o.id)} className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10 flex items-center justify-center">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live leaderboard preview */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Ranking (preview · Top 5)</h3>
                <button onClick={() => selectedId && loadPrizes(selectedId)} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                  <RefreshCw className="h-3.5 w-3.5" /> Atualizar
                </button>
              </div>
              {leaderboard.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma entrada no ranking ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/20 text-xs text-muted-foreground">
                        <th className="text-left py-2 px-2 w-12">#</th>
                        <th className="text-left py-2 px-2">Seller</th>
                        <th className="text-right py-2 px-2">Faturamento</th>
                        <th className="text-right py-2 px-2">Vendas</th>
                        <th className="text-right py-2 px-2 w-20">Origem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.slice(0, 5).map((l: any, idx: number) => (
                        <tr key={(l.seller_id ?? "manual") + "-" + idx} className="border-b border-border/10">
                          <td className="py-2 px-2 font-bold tabular-nums">{l.rank_position}</td>
                          <td className="py-2 px-2">{l.seller_name}</td>
                          <td className="py-2 px-2 text-right font-bold tabular-nums">{brl(Number(l.revenue_cents))}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{l.sales_count}</td>
                          <td className="py-2 px-2 text-right">
                            <span className={cn("text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                              l.is_manual ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                              {l.is_manual ? "Manual" : "Real"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
            Crie uma corrida para começar.
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(v) => !v && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction?.onConfirm(); setConfirmAction(null); }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
