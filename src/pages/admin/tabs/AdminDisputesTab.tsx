import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, Search, Plus, Save, MessageSquare, Clock, CheckCircle2, XCircle, Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle } from "./AdminOverviewTab";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid } from "./AdminPremium";
import { logAdminAction } from "@/lib/auditLog";

interface EvidenceUrl { path: string; name: string; uploaded_at: string; }

interface Dispute {
 id: string; transaction_id: string | null; seller_user_id: string;
 buyer_name: string | null; buyer_email: string | null; buyer_phone: string | null;
 type: string; status: string; reason: string | null; admin_notes: string | null;
 amount: number; resolved_at: string | null; admin_user_id: string | null;
 created_at: string; updated_at: string;
 evidence_urls?: EvidenceUrl[]; won_by_seller?: boolean | null;
}

interface Props {
 type: "medpix" | "pre_med_pix" | "refund" | "chargeback";
 title: string;
 profiles: Tables<"profiles">[];
 transactions: Tables<"transactions">[];
 products: Tables<"products">[];
 fmtCurrency: (v: number) => string;
}

export default function AdminDisputesTab({ type, title, profiles, transactions, products, fmtCurrency }: Props) {
 const { user } = useAuth();
 const [disputes, setDisputes] = useState<Dispute[]>([]);
 const [search, setSearch] = useState("");
 const [creating, setCreating] = useState(false);
 const [editing, setEditing] = useState<Dispute | null>(null);
 const [form, setForm] = useState({ seller_user_id: "", buyer_name: "", buyer_email: "", buyer_phone: "", reason: "", amount: "", transaction_id: "" });
 const [editNotes, setEditNotes] = useState("");
 const [editStatus, setEditStatus] = useState("");

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("disputes")
        .select("*")
        .eq("type", type)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setDisputes((data || []) as unknown as Dispute[]);
    } catch (e) {
      console.error("[AdminDisputesTab] load error:", e);
      toast.error("Erro ao carregar disputas");
    }
  };

  useEffect(() => { load(); }, [type]);

  const handleCreate = async () => {
    if (!user || !form.seller_user_id || !form.amount) { toast.error("Preencha os campos obrigatórios"); return; }
    const { data: inserted, error } = await supabase.from("disputes").insert({
      type,
      seller_user_id: form.seller_user_id,
      buyer_name: form.buyer_name || null,
      buyer_email: form.buyer_email || null,
      buyer_phone: form.buyer_phone || null,
      reason: form.reason || null,
      amount: Number(form.amount),
      transaction_id: form.transaction_id || null,
      admin_user_id: user.id,
    } as any).select("id").maybeSingle();
    if (error) { toast.error("Erro ao criar"); return; }
    toast.success("Disputa criada!");
    await logAdminAction(`create_${type}`, "dispute", inserted?.id ?? form.seller_user_id, { amount: form.amount, reason: form.reason, seller_user_id: form.seller_user_id });
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
 update.won_by_seller = editStatus === "resolved_seller";
 }
 const { error } = await supabase.from("disputes").update(update).eq("id", editing.id);
 if (error) { toast.error("Erro ao atualizar"); return; }
 toast.success("Disputa atualizada!");
 await logAdminAction(`update_${type}`, "dispute", editing.id, { status: editStatus, notes: editNotes });
 setEditing(null);
 load();
 };

 const handleEvidenceUpload = async (file: File) => {
   if (!editing || !user) return;
   if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo > 10MB"); return; }
   const path = `${editing.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
   const { error: upErr } = await supabase.storage.from("dispute-evidence").upload(path, file);
   if (upErr) { toast.error("Erro ao enviar: " + upErr.message); return; }
   const next = [ ...((editing as any).evidence_urls || []), { path, name: file.name, uploaded_at: new Date().toISOString() } ];
   const { error } = await supabase.from("disputes").update({ evidence_urls: next } as any).eq("id", editing.id);
   if (error) { toast.error("Erro ao salvar"); return; }
   toast.success("Evidência anexada");
   setEditing({ ...editing, evidence_urls: next } as any);
   load();
 };

 const handleViewEvidence = async (path: string) => {
   const { data, error } = await supabase.storage.from("dispute-evidence").createSignedUrl(path, 300);
   if (error || !data?.signedUrl) { toast.error("Erro ao gerar link"); return; }
   window.open(data.signedUrl, "_blank", "noopener,noreferrer");
 };

 const filtered = disputes.filter(d => {
 if (!search) return true;
 const s = search.toLowerCase();
 return d.buyer_name?.toLowerCase().includes(s) || d.buyer_email?.toLowerCase().includes(s) || d.reason?.toLowerCase().includes(s) || d.id.toLowerCase().includes(s) || d.transaction_id?.toLowerCase().includes(s);
 });

 const getSellerName = (id: string) => profiles.find(p => p.user_id === id)?.full_name || "—";
 const getSellerEmail = (id: string) => profiles.find(p => p.user_id === id)?.email || "";
 const getSellerType = (id: string) => profiles.find(p => p.user_id === id)?.seller_type || null;

 const getTransactionDetails = (txId: string | null) => {
 if (!txId) return null;
 return transactions.find(t => t.id === txId) || null;
 };

 const getProductName = (productId: string | null) => {
 if (!productId) return "—";
 return products.find(p => p.id === productId)?.name || "—";
 };

 const statusColors: Record<string, string> = { open: "text-warning bg-warning/10", in_review: "text-info bg-info/10", resolved_seller: "text-primary bg-primary/10", resolved_buyer: "text-primary bg-primary/10", closed: "text-muted-foreground bg-muted/30" };

 const SellerTypeBadge = ({ type: t }: { type: string | null }) => {
 if (t === "black") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-muted text-muted-foreground border border-border">B</span>;
 if (t === "white") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-secondary text-secondary-foreground border border-border">W</span>;
 return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-warning/10 text-warning border border-warning/20">?</span>;
 };

 return (
 <div className="space-y-5">
 {/* Hero */}
 <FinanceiroHero
   eyebrow={`Operações · ${title}`}
   title={title}
   subtitle="Gerencie disputas, evidências e resoluções com agilidade."
   status={{ tone: disputes.filter(d => d.status === "open").length > 0 ? "warning" : "success", label: `${disputes.filter(d => d.status === "open").length} abertas`, pulse: disputes.filter(d => d.status === "open").length > 0 }}
   actions={
     <Button size="sm" className="bg-info/10 text-info border border-info/20 rounded-xl text-xs gap-1 hover:bg-info/20" onClick={() => setCreating(true)}>
       <Plus className="h-3 w-3" /> Nova Disputa
     </Button>
   }
 />

  {/* KPIs */}
  <PremiumMetricGrid cols={4}>
    <PremiumMetric icon={AlertTriangle} label="Total" value={String(disputes.length)} sub="Histórico" tone="neutral" />
    <PremiumMetric icon={Clock} label="Abertas" value={String(disputes.filter(d => d.status === "open").length)} sub="Requer ação" tone="warning" />
    <PremiumMetric icon={MessageSquare} label="Em Análise" value={String(disputes.filter(d => d.status === "in_review").length)} sub="Avaliando" tone="info" />
    <PremiumMetric icon={CheckCircle2} label="Resolvidas" value={String(disputes.filter(d => d.status.startsWith("resolved") || d.status === "closed").length)} sub="Encerradas" tone="success" />
  </PremiumMetricGrid>

 {/* Search */}
 <div className="relative max-w-md">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <input placeholder="Buscar por nome, e-mail, ID..." value={search} onChange={e => setSearch(e.target.value)}
 className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
 </div>

 {/* Table */}
 <AdminPanel>
 <PanelTitle color="amber" icon={<AlertTriangle className="h-4 w-4" />}>{title} ({filtered.length})</PanelTitle>
 <div className="overflow-x-auto mt-4">
 <table className="w-full text-sm">
 <thead><tr className="border-b border-border">{["ID Venda","Vendedor","Tipo","Produto","Comprador","Valor","Status","Data",""].map(h=>(<th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>))}</tr></thead>
 <tbody>
 {filtered.map(d => {
 const tx = getTransactionDetails(d.transaction_id);
 const productName = tx ? getProductName(tx.product_id) : "—";
 const sellerType = getSellerType(d.seller_user_id);
 return (
 <tr key={d.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => { setEditing(d); setEditStatus(d.status); setEditNotes(d.admin_notes || ""); }}>
 <td className="p-3">
 <div>
 <p className="text-[10px] font-mono text-muted-foreground">{d.transaction_id?.slice(0, 8) || "—"}</p>
 <p className="text-[9px] font-mono text-muted-foreground/50">{d.id.slice(0, 8)}</p>
 </div>
 </td>
 <td className="p-3">
 <div className="flex items-center gap-2">
 <SellerTypeBadge type={sellerType} />
 <div>
 <p className="text-xs font-bold text-foreground">{getSellerName(d.seller_user_id)}</p>
 <p className="text-[10px] text-muted-foreground">{getSellerEmail(d.seller_user_id)}</p>
 </div>
 </div>
 </td>
 <td className="p-3 text-[10px] uppercase text-muted-foreground">{type}</td>
 <td className="p-3">
 <p className="text-[11px] text-foreground/60">{productName}</p>
 </td>
 <td className="p-3">
 <div>
 <p className="text-xs text-foreground">{d.buyer_name || "—"}</p>
 <p className="text-[10px] text-muted-foreground">{d.buyer_email}</p>
 </div>
 </td>
 <td className="p-3 text-xs font-bold text-warning">{fmtCurrency(d.amount)}</td>
 <td className="p-3"><span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${statusColors[d.status] || ""}`}>{d.status}</span></td>
 <td className="p-3 text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")}</td>
 <td className="p-3"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground/40" /></td>
 </tr>
 );
 })}
 {filtered.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-muted-foreground text-xs">Nenhuma disputa</td></tr>}
 </tbody>
 </table>
 </div>
 </AdminPanel>

 {/* Create Dialog */}
 <Dialog open={creating} onOpenChange={setCreating}>
 <DialogContent className="max-w-lg">
 <DialogHeader><DialogTitle>Nova {title}</DialogTitle></DialogHeader>
 <div className="space-y-3 mt-2">
 <div>
 <Label className="text-[10px] text-muted-foreground">Vendedor</Label>
 <Select value={form.seller_user_id} onValueChange={v => setForm(f => ({ ...f, seller_user_id: v }))}>
 <SelectTrigger className="text-xs"><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
 <SelectContent className="max-h-[200px]">
 {profiles.map(p => (<SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || p.user_id.slice(0,8)}</SelectItem>))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label className="text-[10px] text-muted-foreground">ID da Transação (opcional)</Label>
 <input value={form.transaction_id} onChange={e => setForm(f => ({...f, transaction_id: e.target.value}))} placeholder="ID da transação..." className="w-full h-9 px-3 bg-muted/30 border border-border rounded-md text-xs text-foreground mt-1" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label className="text-[10px] text-muted-foreground">Nome comprador</Label><input value={form.buyer_name} onChange={e => setForm(f => ({...f, buyer_name: e.target.value}))} className="w-full h-9 px-3 bg-muted/30 border border-border rounded-md text-xs text-foreground mt-1" /></div>
 <div><Label className="text-[10px] text-muted-foreground">E-mail comprador</Label><input value={form.buyer_email} onChange={e => setForm(f => ({...f, buyer_email: e.target.value}))} className="w-full h-9 px-3 bg-muted/30 border border-border rounded-md text-xs text-foreground mt-1" /></div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label className="text-[10px] text-muted-foreground">WhatsApp</Label><input value={form.buyer_phone} onChange={e => setForm(f => ({...f, buyer_phone: e.target.value}))} className="w-full h-9 px-3 bg-muted/30 border border-border rounded-md text-xs text-foreground mt-1" /></div>
 <div><Label className="text-[10px] text-muted-foreground">Valor (R$)</Label><input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} className="w-full h-9 px-3 bg-muted/30 border border-border rounded-md text-xs text-foreground mt-1" /></div>
 </div>
 <div><Label className="text-[10px] text-muted-foreground">Motivo</Label><textarea value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} rows={3} className="w-full px-3 py-2 bg-muted/30 border border-border rounded-md text-xs text-foreground mt-1 resize-none" /></div>
 <Button className="w-full rounded-xl" onClick={handleCreate}>Criar Disputa</Button>
 </div>
 </DialogContent>
 </Dialog>

 {/* Edit Dialog */}
 <Dialog open={!!editing} onOpenChange={v => { if (!v) setEditing(null); }}>
 <DialogContent className="max-w-2xl">
 <DialogHeader><DialogTitle>Detalhes da Disputa</DialogTitle></DialogHeader>
 {editing && (() => {
 const tx = getTransactionDetails(editing.transaction_id);
 const productName = tx ? getProductName(tx.product_id) : "—";
 const seller = profiles.find(p => p.user_id === editing.seller_user_id);
 return (
 <div className="space-y-4 mt-2">
 {/* Seller info */}
 <div className="bg-muted/30 rounded-xl border border-border p-4">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><User className="h-3 w-3" /> Vendedor</p>
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{(seller?.full_name || "?")[0].toUpperCase()}</div>
 <div>
 <p className="text-sm font-bold text-foreground">{seller?.full_name || "—"}</p>
 <p className="text-xs text-muted-foreground">{seller?.email} • {seller?.phone || "Sem tel."}</p>
 <p className="text-[10px] text-muted-foreground/50 font-mono">{seller?.document_number || "—"} • PIX: {seller?.pix_key || "—"}</p>
 </div>
 <div className="ml-auto">
 <SellerTypeBadge type={seller?.seller_type || null} />
 </div>
 </div>
 </div>

 {/* Transaction & Product info */}
 {tx && (
 <div className="bg-muted/30 rounded-xl border border-border p-4">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><Package className="h-3 w-3" /> Transação & Produto</p>
 <div className="grid grid-cols-2 gap-3 text-[11px]">
 <div><span className="text-muted-foreground">ID Transação:</span> <span className="font-mono font-bold text-foreground">{tx.id.slice(0, 12)}...</span></div>
 <div><span className="text-muted-foreground">Produto:</span> <span className="font-bold text-foreground">{productName}</span></div>
 <div><span className="text-muted-foreground">Valor:</span> <span className="font-bold text-primary">{fmtCurrency(Number(tx.amount))}</span></div>
 <div><span className="text-muted-foreground">Método:</span> <span className="font-bold text-foreground">{tx.payment_method || "—"}</span></div>
 <div><span className="text-muted-foreground">Comprador:</span> <span className="font-bold text-foreground">{tx.customer_name} ({tx.customer_email})</span></div>
 <div><span className="text-muted-foreground">Status TX:</span> <StatusBadge status={tx.status} /></div>
 </div>
 </div>
 )}

 <div className="grid grid-cols-2 gap-3 text-[11px]">
 <div className="bg-muted/30 rounded-lg p-3 border border-border"><p className="text-muted-foreground text-[10px]">Comprador (disputa)</p><p className="font-bold text-foreground">{editing.buyer_name || "—"}</p><p className="text-muted-foreground">{editing.buyer_email} • {editing.buyer_phone || "Sem tel."}</p></div>
 <div className="bg-muted/30 rounded-lg p-3 border border-border"><p className="text-muted-foreground text-[10px]">Valor Disputado</p><p className="font-bold text-warning text-lg">{fmtCurrency(editing.amount)}</p><p className="text-muted-foreground">Criada em {new Date(editing.created_at).toLocaleString("pt-BR")}</p></div>
 </div>

 {editing.reason && <div className="bg-muted/30 rounded-lg p-3 border border-border text-xs"><p className="text-muted-foreground text-[10px] mb-1">Motivo</p><p className="text-foreground">{editing.reason}</p></div>}
 <div>
 <Label className="text-[10px] text-muted-foreground">Status</Label>
 <Select value={editStatus} onValueChange={setEditStatus}>
 <SelectTrigger className="text-xs mt-1"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="open">Aberta</SelectItem>
 <SelectItem value="in_review">Em Análise</SelectItem>
 <SelectItem value="resolved_seller">Resolvida (Vendedor)</SelectItem>
 <SelectItem value="resolved_buyer">Resolvida (Comprador)</SelectItem>
 <SelectItem value="closed">Fechada</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label className="text-[10px] text-muted-foreground">Notas do Admin</Label>
 <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} className="w-full px-3 py-2 bg-muted/30 border border-border rounded-md text-xs text-foreground mt-1 resize-none" />
 </div>

 {/* Evidence */}
 <div className="bg-muted/30 rounded-xl border border-border p-3">
   <div className="flex items-center justify-between mb-2">
     <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Evidências / Comprovantes</p>
     <label className="inline-flex items-center gap-1 h-7 px-2 text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/20">
       + Anexar
       <input type="file" hidden accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && handleEvidenceUpload(e.target.files[0])} />
     </label>
   </div>
   <div className="space-y-1">
     {(((editing as any).evidence_urls as any[]) || []).length === 0 && (
       <p className="text-[10px] text-muted-foreground italic">Sem evidências anexadas</p>
     )}
     {(((editing as any).evidence_urls as any[]) || []).map((ev: any, i: number) => (
       <button key={i} onClick={() => handleViewEvidence(ev.path)}
         className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg bg-background/50 border border-border hover:bg-muted/30 text-[11px]">
         <Package className="h-3 w-3 text-primary" />
         <span className="flex-1 truncate text-foreground">{ev.name || ev.path}</span>
         <span className="text-[9px] text-muted-foreground">{new Date(ev.uploaded_at).toLocaleDateString("pt-BR")}</span>
       </button>
     ))}
   </div>
 </div>

 {editing.resolved_at && (
   <div className={`rounded-xl border p-3 ${editing.won_by_seller ? "bg-primary/[0.06] border-primary/30" : "bg-destructive/[0.06] border-destructive/30"}`}>
     <p className="text-[10px] uppercase font-bold text-muted-foreground">Desfecho</p>
     <p className={`text-sm font-black ${editing.won_by_seller ? "text-primary" : "text-destructive"}`}>
       {editing.won_by_seller ? "✓ Ganha pelo vendedor" : "✗ Perdida (favor ao comprador)"}
     </p>
   </div>
 )}
 <Button className="w-full rounded-xl" onClick={handleUpdate}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
 </div>
 );
 })()}
 </DialogContent>
 </Dialog>
 </div>
 );
}
