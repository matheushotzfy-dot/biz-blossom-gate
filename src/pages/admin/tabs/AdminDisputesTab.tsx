import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, Search, Plus, Save, MessageSquare, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import { AdminPanel, PanelTitle } from "./AdminOverviewTab";
import { logAdminAction } from "@/lib/auditLog";

interface Dispute {
  id: string; transaction_id: string | null; seller_user_id: string;
  buyer_name: string | null; buyer_email: string | null; buyer_phone: string | null;
  type: string; status: string; reason: string | null; admin_notes: string | null;
  amount: number; resolved_at: string | null; admin_user_id: string | null;
  created_at: string; updated_at: string;
}

interface Props {
  type: "medpix" | "pre_med_pix" | "refund";
  title: string;
  profiles: Tables<"profiles">[];
  fmtCurrency: (v: number) => string;
}

export default function AdminDisputesTab({ type, title, profiles, fmtCurrency }: Props) {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Dispute | null>(null);
  const [form, setForm] = useState({ seller_user_id: "", buyer_name: "", buyer_email: "", buyer_phone: "", reason: "", amount: "", transaction_id: "" });
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const load = async () => {
    const { data } = await supabase.from("disputes").select("*").eq("type", type).order("created_at", { ascending: false });
    if (data) setDisputes(data as any);
  };

  useEffect(() => { load(); }, [type]);

  const handleCreate = async () => {
    if (!user || !form.seller_user_id || !form.amount) { toast.error("Preencha os campos obrigatórios"); return; }
    const { error } = await supabase.from("disputes").insert({
      type,
      seller_user_id: form.seller_user_id,
      buyer_name: form.buyer_name || null,
      buyer_email: form.buyer_email || null,
      buyer_phone: form.buyer_phone || null,
      reason: form.reason || null,
      amount: Number(form.amount),
      transaction_id: form.transaction_id || null,
      admin_user_id: user.id,
    } as any);
    if (error) { toast.error("Erro ao criar"); return; }
    toast.success("Disputa criada!");
    await logAdminAction(`create_${type}`, "dispute", form.seller_user_id, { amount: form.amount, reason: form.reason });
    setCreating(false);
    setForm({ seller_user_id: "", buyer_name: "", buyer_email: "", buyer_phone: "", reason: "", amount: "", transaction_id: "" });
    load();
  };

  const handleUpdate = async () => {
    if (!editing || !user) return;
    const update: any = { status: editStatus, admin_notes: editNotes, updated_at: new Date().toISOString() };
    if (editStatus === "resolved_seller" || editStatus === "resolved_buyer" || editStatus === "closed") {
      update.resolved_at = new Date().toISOString();
      update.admin_user_id = user.id;
    }
    const { error } = await supabase.from("disputes").update(update).eq("id", editing.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Disputa atualizada!");
    await logAdminAction(`update_${type}`, "dispute", editing.id, { status: editStatus, notes: editNotes });
    setEditing(null);
    load();
  };

  const filtered = disputes.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.buyer_name?.toLowerCase().includes(s) || d.buyer_email?.toLowerCase().includes(s) || d.reason?.toLowerCase().includes(s);
  });

  const getSellerName = (id: string) => profiles.find(p => p.user_id === id)?.full_name || "—";

  const statusColors: Record<string, string> = { open: "text-amber-400 bg-amber-500/10", in_review: "text-blue-400 bg-blue-500/10", resolved_seller: "text-emerald-400 bg-emerald-500/10", resolved_buyer: "text-emerald-400 bg-emerald-500/10", closed: "text-white/30 bg-white/[0.04]" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.12]" />
        </div>
        <Button size="sm" className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-xs gap-1" onClick={() => setCreating(true)}>
          <Plus className="h-3 w-3" /> Nova Disputa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Total", v: disputes.length, c: "text-white" },
          { l: "Abertas", v: disputes.filter(d => d.status === "open").length, c: "text-amber-400" },
          { l: "Em Análise", v: disputes.filter(d => d.status === "in_review").length, c: "text-blue-400" },
          { l: "Resolvidas", v: disputes.filter(d => d.status.startsWith("resolved") || d.status === "closed").length, c: "text-emerald-400" },
        ].map(s => (
          <div key={s.l} className="bg-[hsl(228,18%,6%)] rounded-xl border border-white/[0.04] p-4">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">{s.l}</p>
            <p className={`text-2xl font-extrabold mt-1 ${s.c}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <AdminPanel>
        <PanelTitle color="amber" icon={<AlertTriangle className="h-4 w-4" />}>{title} ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">{["Vendedor","Comprador","Valor","Motivo","Status","Data",""].map(h=>(<th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>))}</tr></thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => { setEditing(d); setEditStatus(d.status); setEditNotes(d.admin_notes || ""); }}>
                  <td className="p-3 text-xs font-bold">{getSellerName(d.seller_user_id)}</td>
                  <td className="p-3"><div><p className="text-xs">{d.buyer_name || "—"}</p><p className="text-[10px] text-white/30">{d.buyer_email}</p></div></td>
                  <td className="p-3 text-xs font-bold text-amber-400">{fmtCurrency(d.amount)}</td>
                  <td className="p-3 text-[11px] text-white/40 max-w-[200px] truncate">{d.reason || "—"}</td>
                  <td className="p-3"><span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${statusColors[d.status] || ""}`}>{d.status}</span></td>
                  <td className="p-3 text-[11px] text-white/30">{new Date(d.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3"><MessageSquare className="h-3.5 w-3.5 text-white/20" /></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-white/20 text-xs">Nenhuma disputa</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg bg-[hsl(228,18%,6%)] border-white/[0.06] text-white">
          <DialogHeader><DialogTitle>Nova {title}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-[10px] text-white/40">Vendedor</Label>
              <Select value={form.seller_user_id} onValueChange={v => setForm(f => ({ ...f, seller_user_id: v }))}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-xs"><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                <SelectContent className="bg-[hsl(228,18%,8%)] border-white/[0.08] max-h-[200px]">
                  {profiles.map(p => (<SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || p.user_id.slice(0,8)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[10px] text-white/40">Nome comprador</Label><input value={form.buyer_name} onChange={e => setForm(f => ({...f, buyer_name: e.target.value}))} className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white mt-1" /></div>
              <div><Label className="text-[10px] text-white/40">E-mail comprador</Label><input value={form.buyer_email} onChange={e => setForm(f => ({...f, buyer_email: e.target.value}))} className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[10px] text-white/40">WhatsApp</Label><input value={form.buyer_phone} onChange={e => setForm(f => ({...f, buyer_phone: e.target.value}))} className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white mt-1" /></div>
              <div><Label className="text-[10px] text-white/40">Valor (R$)</Label><input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white mt-1" /></div>
            </div>
            <div><Label className="text-[10px] text-white/40">Motivo</Label><textarea value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} rows={3} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white mt-1 resize-none" /></div>
            <Button className="w-full bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl" onClick={handleCreate}>Criar Disputa</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={v => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg bg-[hsl(228,18%,6%)] border-white/[0.06] text-white">
          <DialogHeader><DialogTitle>Detalhes da Disputa</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]"><p className="text-white/30 text-[10px]">Vendedor</p><p className="font-bold">{getSellerName(editing.seller_user_id)}</p></div>
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]"><p className="text-white/30 text-[10px]">Comprador</p><p className="font-bold">{editing.buyer_name || "—"}</p><p className="text-white/30">{editing.buyer_email}</p></div>
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]"><p className="text-white/30 text-[10px]">Valor</p><p className="font-bold text-amber-400">{fmtCurrency(editing.amount)}</p></div>
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]"><p className="text-white/30 text-[10px]">Data</p><p className="font-bold">{new Date(editing.created_at).toLocaleString("pt-BR")}</p></div>
              </div>
              {editing.reason && <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] text-xs"><p className="text-white/30 text-[10px] mb-1">Motivo</p><p>{editing.reason}</p></div>}
              <div>
                <Label className="text-[10px] text-white/40">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[hsl(228,18%,8%)] border-white/[0.08]">
                    <SelectItem value="open">Aberta</SelectItem>
                    <SelectItem value="in_review">Em Análise</SelectItem>
                    <SelectItem value="resolved_seller">Resolvida (Vendedor)</SelectItem>
                    <SelectItem value="resolved_buyer">Resolvida (Comprador)</SelectItem>
                    <SelectItem value="closed">Fechada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-white/40">Notas do Admin</Label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white mt-1 resize-none" />
              </div>
              <Button className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl" onClick={handleUpdate}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
