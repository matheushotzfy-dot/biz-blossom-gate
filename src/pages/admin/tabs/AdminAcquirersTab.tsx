import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Landmark, Plus, Power, PowerOff, Edit, Save, X, Shield, Globe,
  CheckCircle2, XCircle, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminPanel, PanelTitle } from "./AdminOverviewTab";
import { logAdminAction } from "@/lib/auditLog";

interface Acquirer {
  id: string;
  name: string;
  slug: string;
  type: "white" | "black";
  is_active: boolean;
  api_endpoint: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminAcquirersTab() {
  const { user } = useAuth();
  const [acquirers, setAcquirers] = useState<Acquirer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", type: "black" as "white" | "black", api_endpoint: "", description: "" });

  useEffect(() => { loadAcquirers(); }, []);

  const loadAcquirers = async () => {
    setLoading(true);
    const { data } = await supabase.from("acquirers").select("*").order("created_at", { ascending: true });
    if (data) setAcquirers(data as Acquirer[]);
    setLoading(false);
  };

  const whiteAcquirers = acquirers.filter(a => a.type === "white");
  const blackAcquirers = acquirers.filter(a => a.type === "black");

  const handleSave = async () => {
    if (!form.name || !form.slug) { toast.error("Nome e slug são obrigatórios"); return; }
    const payload = {
      name: form.name,
      slug: form.slug,
      type: form.type,
      api_endpoint: form.api_endpoint || null,
      description: form.description || null,
    };

    if (editingId) {
      const { error } = await supabase.from("acquirers").update(payload).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Adquirente atualizada!");
      await logAdminAction("update_acquirer", "acquirer", editingId, payload);
    } else {
      const { error } = await supabase.from("acquirers").insert(payload);
      if (error) { toast.error("Erro ao criar: " + error.message); return; }
      toast.success("Adquirente criada!");
      await logAdminAction("create_acquirer", "acquirer", null, payload);
    }
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", slug: "", type: "black", api_endpoint: "", description: "" });
    loadAcquirers();
  };

  const toggleActive = async (acq: Acquirer) => {
    const { error } = await supabase.from("acquirers").update({ is_active: !acq.is_active }).eq("id", acq.id);
    if (error) { toast.error("Erro"); return; }
    toast.success(acq.is_active ? "Desativada" : "Ativada");
    await logAdminAction("toggle_acquirer", "acquirer", acq.id, { is_active: !acq.is_active });
    loadAcquirers();
  };

  const openEdit = (acq: Acquirer) => {
    setForm({ name: acq.name, slug: acq.slug, type: acq.type, api_endpoint: acq.api_endpoint || "", description: acq.description || "" });
    setEditingId(acq.id);
    setShowForm(true);
  };

  const AcquirerCard = ({ acq }: { acq: Acquirer }) => (
    <div className={`rounded-2xl border p-5 transition-all hover:scale-[1.01] ${
      acq.is_active
        ? "border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01]"
        : "border-white/[0.04] bg-white/[0.01] opacity-50"
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black ${
            acq.type === "black"
              ? "bg-gradient-to-br from-zinc-700 to-zinc-900 text-white shadow-lg shadow-black/30"
              : "bg-gradient-to-br from-slate-100 to-slate-300 text-slate-800 shadow-lg shadow-white/10"
          }`}>
            {acq.name[0]}
          </div>
          <div>
            <h3 className="text-sm font-extrabold">{acq.name}</h3>
            <p className="text-[10px] font-mono text-white/25">{acq.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
            acq.type === "black"
              ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
              : "bg-slate-200/10 text-slate-300 border border-slate-500/20"
          }`}>
            {acq.type}
          </span>
          {acq.is_active ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ativa
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[9px] font-bold">Inativa</span>
          )}
        </div>
      </div>

      {acq.description && <p className="text-[11px] text-white/30 mt-3">{acq.description}</p>}
      {acq.api_endpoint && <p className="text-[10px] font-mono text-white/15 mt-1 truncate">{acq.api_endpoint}</p>}

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.04]">
        <Button size="sm" variant="ghost" className="h-7 text-[10px] text-white/40 hover:text-white gap-1" onClick={() => openEdit(acq)}>
          <Edit className="h-3 w-3" /> Editar
        </Button>
        <Button size="sm" variant="ghost" className={`h-7 text-[10px] gap-1 ${acq.is_active ? "text-red-400/60 hover:text-red-400" : "text-emerald-400/60 hover:text-emerald-400"}`} onClick={() => toggleActive(acq)}>
          {acq.is_active ? <><PowerOff className="h-3 w-3" /> Desativar</> : <><Power className="h-3 w-3" /> Ativar</>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold">Adquirentes</h2>
          <p className="text-[11px] text-white/30 mt-0.5">Gerencie suas adquirentes de pagamento White e Black</p>
        </div>
        <Button size="sm" className="bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] text-white rounded-xl text-xs gap-1.5" onClick={() => { setForm({ name: "", slug: "", type: "black", api_endpoint: "", description: "" }); setEditingId(null); setShowForm(true); }}>
          <Plus className="h-3.5 w-3.5" /> Nova Adquirente
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-zinc-800/40 to-zinc-900/20 border border-zinc-700/20 p-5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Black</p>
          <p className="text-2xl font-black mt-1">{blackAcquirers.length}</p>
          <p className="text-[10px] text-white/20 mt-1">{blackAcquirers.filter(a => a.is_active).length} ativas</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-slate-200/5 to-slate-400/5 border border-slate-500/10 p-5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold">White</p>
          <p className="text-2xl font-black mt-1">{whiteAcquirers.length}</p>
          <p className="text-[10px] text-white/20 mt-1">{whiteAcquirers.filter(a => a.is_active).length} ativas</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/10 p-5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Total Ativas</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{acquirers.filter(a => a.is_active).length}</p>
          <p className="text-[10px] text-white/20 mt-1">de {acquirers.length} cadastradas</p>
        </div>
      </div>

      {/* Black Acquirers */}
      <AdminPanel>
        <PanelTitle color="zinc" icon={<Shield className="h-4 w-4" />}>
          Adquirentes Black ({blackAcquirers.length})
        </PanelTitle>
        <p className="text-[10px] text-white/20 mt-1 mb-4">Processamento de alto risco / operação principal</p>
        {blackAcquirers.length === 0 ? (
          <p className="text-xs text-white/20 text-center py-8">Nenhuma adquirente black cadastrada</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {blackAcquirers.map(a => <AcquirerCard key={a.id} acq={a} />)}
          </div>
        )}
      </AdminPanel>

      {/* White Acquirers */}
      <AdminPanel>
        <PanelTitle color="blue" icon={<Globe className="h-4 w-4" />}>
          Adquirentes White ({whiteAcquirers.length})
        </PanelTitle>
        <p className="text-[10px] text-white/20 mt-1 mb-4">Processamento padrão / operação regulada</p>
        {whiteAcquirers.length === 0 ? (
          <p className="text-xs text-white/20 text-center py-8">Nenhuma adquirente white cadastrada</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {whiteAcquirers.map(a => <AcquirerCard key={a.id} acq={a} />)}
          </div>
        )}
      </AdminPanel>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-[hsl(228,18%,6%)] border-white/[0.06] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">{editingId ? "Editar" : "Nova"} Adquirente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] text-white/40">Nome</Label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="PodPay"
                  className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white mt-1" />
              </div>
              <div>
                <Label className="text-[10px] text-white/40">Slug</Label>
                <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="podpay"
                  className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white mt-1 font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-white/40">Tipo</Label>
              <div className="flex gap-3 mt-1.5">
                {(["black", "white"] as const).map(t => (
                  <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))}
                    className={`flex-1 h-10 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                      form.type === t
                        ? t === "black" ? "bg-zinc-800 border-zinc-600 text-white" : "bg-slate-200/10 border-slate-400/30 text-white"
                        : "bg-white/[0.02] border-white/[0.06] text-white/30"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-white/40">API Endpoint (opcional)</Label>
              <input value={form.api_endpoint} onChange={e => setForm(p => ({ ...p, api_endpoint: e.target.value }))} placeholder="https://api.podpay.com/v1"
                className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white mt-1 font-mono" />
            </div>
            <div>
              <Label className="text-[10px] text-white/40">Descrição</Label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição da adquirente..."
                className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-white mt-1" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button size="sm" variant="ghost" className="flex-1 text-xs text-white/40" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="flex-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs" onClick={handleSave}>
                <Save className="h-3 w-3 mr-1" /> Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
