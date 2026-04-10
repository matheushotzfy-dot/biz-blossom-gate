import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 Plus, Power, PowerOff, Edit, Save, Shield, Globe, Eye, EyeOff, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle } from "./AdminOverviewTab";
import { logAdminAction } from "@/lib/auditLog";

interface Acquirer {
 id: string; name: string; slug: string; type: string; is_active: boolean;
 api_endpoint: string | null; description: string | null;
 conversion_rate: number; seller_visible: boolean;
 created_at: string; updated_at: string;
}

export default function AdminAcquirersTab() {
 const { user } = useAuth();
 const [acquirers, setAcquirers] = useState<Acquirer[]>([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form, setForm] = useState({
 name: "", slug: "", type: "black" as string,
 api_endpoint: "", description: "",
 conversion_rate: 0, seller_visible: false,
 });

 useEffect(() => { loadAcquirers(); }, []);

 const loadAcquirers = async () => {
 setLoading(true);
 const { data } = await supabase.from("acquirers").select("*").order("created_at", { ascending: true });
 if (data) setAcquirers(data as unknown as Acquirer[]);
 setLoading(false);
 };

 const whiteAcquirers = acquirers.filter(a => a.type === "white");
 const blackAcquirers = acquirers.filter(a => a.type === "black");

 const handleSave = async () => {
 if (!form.name || !form.slug) { toast.error("Nome e slug são obrigatórios"); return; }
 const payload = {
 name: form.name, slug: form.slug, type: form.type,
 api_endpoint: form.api_endpoint || null, description: form.description || null,
 conversion_rate: form.conversion_rate, seller_visible: form.seller_visible,
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
 setShowForm(false); setEditingId(null);
 resetForm();
 loadAcquirers();
 };

 const resetForm = () => setForm({ name: "", slug: "", type: "black", api_endpoint: "", description: "", conversion_rate: 0, seller_visible: false });

 const toggleActive = async (acq: Acquirer) => {
 const { error } = await supabase.from("acquirers").update({ is_active: !acq.is_active }).eq("id", acq.id);
 if (error) { toast.error("Erro"); return; }
 toast.success(acq.is_active ? "Desativada" : "Ativada");
 await logAdminAction("toggle_acquirer", "acquirer", acq.id, { is_active: !acq.is_active });
 loadAcquirers();
 };

 const toggleSellerVisible = async (acq: Acquirer) => {
 const { error } = await supabase.from("acquirers").update({ seller_visible: !acq.seller_visible }).eq("id", acq.id);
 if (error) { toast.error("Erro"); return; }
 toast.success(acq.seller_visible ? "Oculta para sellers" : "Visível para sellers");
 await logAdminAction("toggle_acquirer_visibility", "acquirer", acq.id, { seller_visible: !acq.seller_visible });
 loadAcquirers();
 };

 const openEdit = (acq: Acquirer) => {
 setForm({
 name: acq.name, slug: acq.slug, type: acq.type,
 api_endpoint: acq.api_endpoint || "", description: acq.description || "",
 conversion_rate: acq.conversion_rate || 0, seller_visible: acq.seller_visible,
 });
 setEditingId(acq.id); setShowForm(true);
 };

 const AcquirerCard = ({ acq }: { acq: Acquirer }) => (
 <div className={`rounded-2xl border p-5 transition-all hover:scale-[1.01] ${
 acq.is_active ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-50"
 }`}>
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-3">
 <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black ${
 acq.type === "black" ? "bg-muted text-foreground shadow-lg" : "bg-secondary text-secondary-foreground shadow-lg"
 }`}>{acq.name[0]}</div>
 <div>
 <h3 className="text-sm font-extrabold text-foreground">{acq.name}</h3>
 <p className="text-[10px] font-mono text-muted-foreground">{acq.slug}</p>
 </div>
 </div>
 <div className="flex items-center gap-2 flex-wrap justify-end">
 <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
 acq.type === "black" ? "bg-muted text-muted-foreground border border-border" : "bg-secondary text-secondary-foreground border border-border"
 }`}>{acq.type}</span>
 {acq.is_active ? (
 <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold">
 <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Ativa
 </span>
 ) : (
 <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[9px] font-bold">Inativa</span>
 )}
 </div>
 </div>

 {/* Conversion rate + visibility badges */}
 <div className="flex items-center gap-3 mt-3">
 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/20 border border-border/50">
 <TrendingUp className="h-3 w-3 text-primary" />
 <span className="text-[11px] font-bold text-foreground">{acq.conversion_rate}%</span>
 <span className="text-[9px] text-muted-foreground">conversão</span>
 </div>
 <button
 onClick={() => toggleSellerVisible(acq)}
 className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all text-[10px] font-bold ${
 acq.seller_visible
 ? "bg-primary/10 border-primary/30 text-primary"
 : "bg-muted/20 border-border/50 text-muted-foreground"
 }`}
 >
 {acq.seller_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
 {acq.seller_visible ? "Visível p/ Sellers" : "Oculta p/ Sellers"}
 </button>
 </div>

 {acq.description && <p className="text-[11px] text-muted-foreground mt-3">{acq.description}</p>}
 {acq.api_endpoint && <p className="text-[10px] font-mono text-muted-foreground/50 mt-1 truncate">{acq.api_endpoint}</p>}
 <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
 <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground hover:text-foreground gap-1" onClick={() => openEdit(acq)}>
 <Edit className="h-3 w-3" /> Editar
 </Button>
 <Button size="sm" variant="ghost" className={`h-7 text-[10px] gap-1 ${acq.is_active ? "text-destructive/60 hover:text-destructive" : "text-primary/60 hover:text-primary"}`} onClick={() => toggleActive(acq)}>
 {acq.is_active ? <><PowerOff className="h-3 w-3" /> Desativar</> : <><Power className="h-3 w-3" /> Ativar</>}
 </Button>
 </div>
 </div>
 );

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-extrabold text-foreground">Adquirentes</h2>
 <p className="text-[11px] text-muted-foreground mt-0.5">Gerencie adquirentes, taxa de conversão e visibilidade para sellers</p>
 </div>
 <Button size="sm" className="bg-muted/30 border border-border hover:bg-muted/50 text-foreground rounded-xl text-xs gap-1.5" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>
 <Plus className="h-3.5 w-3.5" /> Nova Adquirente
 </Button>
 </div>

 <div className="grid grid-cols-4 gap-4">
 <div className="rounded-2xl bg-card border border-border p-5">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Black</p>
 <p className="text-2xl font-black text-foreground mt-1">{blackAcquirers.length}</p>
 <p className="text-[10px] text-muted-foreground mt-1">{blackAcquirers.filter(a => a.is_active).length} ativas</p>
 </div>
 <div className="rounded-2xl bg-card border border-border p-5">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">White</p>
 <p className="text-2xl font-black text-foreground mt-1">{whiteAcquirers.length}</p>
 <p className="text-[10px] text-muted-foreground mt-1">{whiteAcquirers.filter(a => a.is_active).length} ativas</p>
 </div>
 <div className="rounded-2xl bg-card border border-border p-5">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total Ativas</p>
 <p className="text-2xl font-black text-primary mt-1">{acquirers.filter(a => a.is_active).length}</p>
 <p className="text-[10px] text-muted-foreground mt-1">de {acquirers.length}</p>
 </div>
 <div className="rounded-2xl bg-card border border-border p-5">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Visíveis p/ Sellers</p>
 <p className="text-2xl font-black text-primary mt-1">{acquirers.filter(a => a.seller_visible && a.is_active).length}</p>
 <p className="text-[10px] text-muted-foreground mt-1">disponíveis</p>
 </div>
 </div>

 <AdminPanel>
 <PanelTitle color="zinc" icon={<Shield className="h-4 w-4" />}>Adquirentes Black ({blackAcquirers.length})</PanelTitle>
 <p className="text-[10px] text-muted-foreground mt-1 mb-4">Processamento de alto risco / operação principal</p>
 {blackAcquirers.length === 0 ? (
 <p className="text-xs text-muted-foreground text-center py-8">Nenhuma adquirente black cadastrada</p>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{blackAcquirers.map(a => <AcquirerCard key={a.id} acq={a} />)}</div>
 )}
 </AdminPanel>

 <AdminPanel>
 <PanelTitle color="blue" icon={<Globe className="h-4 w-4" />}>Adquirentes White ({whiteAcquirers.length})</PanelTitle>
 <p className="text-[10px] text-muted-foreground mt-1 mb-4">Processamento padrão / operação regulada</p>
 {whiteAcquirers.length === 0 ? (
 <p className="text-xs text-muted-foreground text-center py-8">Nenhuma adquirente white cadastrada</p>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{whiteAcquirers.map(a => <AcquirerCard key={a.id} acq={a} />)}</div>
 )}
 </AdminPanel>

 <Dialog open={showForm} onOpenChange={setShowForm}>
 <DialogContent className="max-w-lg">
 <DialogHeader><DialogTitle className="text-sm font-bold">{editingId ? "Editar" : "Nova"} Adquirente</DialogTitle></DialogHeader>
 <div className="space-y-4 mt-2">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label className="text-[10px] text-muted-foreground">Nome</Label>
 <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="PodPay"
 className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-xs text-foreground mt-1" />
 </div>
 <div>
 <Label className="text-[10px] text-muted-foreground">Slug</Label>
 <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="podpay"
 className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-xs text-foreground mt-1 font-mono" />
 </div>
 </div>
 <div>
 <Label className="text-[10px] text-muted-foreground">Tipo</Label>
 <div className="flex gap-3 mt-1.5">
 {(["black", "white"] as const).map(t => (
 <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))}
 className={`flex-1 h-10 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
 form.type === t ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border text-muted-foreground"
 }`}>{t}</button>
 ))}
 </div>
 </div>
 <div>
 <Label className="text-[10px] text-muted-foreground">Taxa de Conversão (%)</Label>
 <input type="number" min="0" max="100" step="0.1" value={form.conversion_rate}
 onChange={e => setForm(p => ({ ...p, conversion_rate: parseFloat(e.target.value) || 0 }))}
 placeholder="95.5"
 className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-xs text-foreground mt-1 font-mono" />
 <p className="text-[9px] text-muted-foreground mt-1">Essa % será exibida para o seller ao escolher a adquirente</p>
 </div>
 <div className="flex items-center justify-between rounded-xl bg-muted/15 px-4 py-3 border border-border/50">
 <div>
 <p className="text-xs font-bold text-foreground">Visível para Sellers</p>
 <p className="text-[10px] text-muted-foreground">Sellers poderão selecionar esta adquirente</p>
 </div>
 <Switch checked={form.seller_visible} onCheckedChange={v => setForm(p => ({ ...p, seller_visible: v }))} />
 </div>
 <div>
 <Label className="text-[10px] text-muted-foreground">API Endpoint (opcional)</Label>
 <input value={form.api_endpoint} onChange={e => setForm(p => ({ ...p, api_endpoint: e.target.value }))} placeholder="https://api.podpay.com/v1"
 className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-xs text-foreground mt-1 font-mono" />
 </div>
 <div>
 <Label className="text-[10px] text-muted-foreground">Descrição</Label>
 <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição da adquirente..."
 className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-xs text-foreground mt-1" />
 </div>
 <div className="flex gap-3 pt-2">
 <Button size="sm" variant="ghost" className="flex-1 text-xs text-muted-foreground" onClick={() => setShowForm(false)}>Cancelar</Button>
 <Button size="sm" className="flex-1 rounded-xl text-xs" onClick={handleSave}>
 <Save className="h-3 w-3 mr-1" /> Salvar
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}
