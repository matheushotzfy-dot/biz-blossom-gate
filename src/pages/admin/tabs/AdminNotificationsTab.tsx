import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
 Bell, Send, Users, User, Megaphone, Info, AlertTriangle,
 CheckCircle2, Clock, Plus, Trash2, Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { logAdminAction } from "@/lib/auditLog";

type Profile = { user_id: string; full_name: string | null; email: string | null; };
type Notification = { id: string; title: string; message: string; type: string; user_id: string | null; is_read: boolean; created_at: string; created_by: string | null; };

interface Props { profiles: Profile[]; }

const NOTIF_TYPES = [
 { value: "info", label: "Informação", icon: Info, color: "text-info bg-info/10" },
 { value: "announcement", label: "Anúncio", icon: Megaphone, color: "text-primary bg-primary/10" },
 { value: "warning", label: "Alerta", icon: AlertTriangle, color: "text-warning bg-warning/10" },
 { value: "success", label: "Sucesso", icon: CheckCircle2, color: "text-primary bg-primary/10" },
];

export default function AdminNotificationsTab({ profiles }: Props) {
 const { user } = useAuth();
 const [notifications, setNotifications] = useState<Notification[]>([]);
 const [loading, setLoading] = useState(true);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [sendTarget, setSendTarget] = useState<"all_sellers" | "active_sellers" | "specific">("all_sellers");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [sendTitle, setSendTitle] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendType, setSendType] = useState("info");
  const [sending, setSending] = useState(false);
  const [sellerSearch, setSellerSearch] = useState("");
  const [purging, setPurging] = useState(false);

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
  setLoading(true);
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) toast.error("Erro ao carregar: " + error.message);
  setNotifications((data || []) as Notification[]);
  setLoading(false);
  };

  const handleSend = async () => {
  if (!sendTitle.trim() || !sendMessage.trim()) { toast.error("Preencha título e mensagem"); return; }
  setSending(true);
  try {
  if (sendTarget === "specific") {
    if (!selectedUserId) { toast.error("Selecione um seller"); setSending(false); return; }
    const { error } = await supabase.from("notifications").insert({ title: sendTitle.trim(), message: sendMessage.trim(), type: sendType, user_id: selectedUserId, created_by: user!.id });
    if (error) throw error;
    const sellerName = profiles.find(p => p.user_id === selectedUserId)?.full_name || "Seller";
    await logAdminAction("send_notification", "notification", selectedUserId, { title: sendTitle.trim(), type: sendType, target: sellerName });
    toast.success(`Notificação enviada para ${sellerName}!`);
  } else {
    const { data, error } = await (supabase as any).rpc("admin_broadcast_notification", {
      _title: sendTitle.trim(),
      _message: sendMessage.trim(),
      _type: sendType,
      _target: sendTarget, // 'all_sellers' | 'active_sellers'
    });
    if (error) throw error;
    const count = Number(data || 0);
    await logAdminAction("send_global_notification", "notification", null, { title: sendTitle.trim(), type: sendType, target: sendTarget, delivered: count });
    toast.success(`Notificação entregue a ${count} ${count === 1 ? "seller" : "sellers"}!`);
  }
  setShowSendDialog(false);
  setSendTitle(""); setSendMessage(""); setSendType("info"); setSelectedUserId("");
  loadNotifications();
  } catch (e: any) { toast.error("Erro ao enviar: " + (e?.message || "desconhecido")); } finally { setSending(false); }
  };

  const handlePurgeOrphans = async () => {
    if (!window.confirm("Remover notificações antigas que nenhum seller conseguia ler (user_id nulo)?")) return;
    setPurging(true);
    const { data, error } = await (supabase as any).rpc("admin_purge_orphan_notifications");
    setPurging(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`${Number(data || 0)} notificação(ões) órfã(s) removida(s)`);
    loadNotifications();
  };

 const handleDelete = async (id: string) => {
 if (!window.confirm("Excluir esta notificação?")) return;
 const { error } = await supabase.from("notifications").delete().eq("id", id);
 if (error) { toast.error("Erro ao excluir notificação"); return; }
 toast.success("Notificação excluída");
 setNotifications(prev => prev.filter(n => n.id !== id));
 };

 const filteredNotifications = notifications.filter(n => {
 if (!search) return true;
 const q = search.toLowerCase();
 return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
 });

 const filteredSellers = profiles.filter(p => {
 if (!sellerSearch) return true;
 const q = sellerSearch.toLowerCase();
 return p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
 });

 const typeColors: Record<string, string> = {
 info: "text-info bg-info/10 border-info/20",
 announcement: "text-primary bg-primary/10 border-primary/20",
 warning: "text-warning bg-warning/10 border-warning/20",
 success: "text-primary bg-primary/10 border-primary/20",
 alert: "text-destructive bg-destructive/10 border-destructive/20",
 withdrawal: "text-violet-500 bg-violet-500/10 border-violet-500/20",
 };
 const typeLabels: Record<string, string> = { info: "Info", announcement: "Anúncio", warning: "Alerta", success: "Sucesso", alert: "Alerta", withdrawal: "Saque" };

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-[18px] font-bold text-foreground flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Central de Notificações</h2>
 <p className="text-[11px] text-muted-foreground mt-1">{notifications.length} notificações enviadas</p>
 </div>
  <div className="flex items-center gap-2">
  <Button variant="outline" onClick={handlePurgeOrphans} disabled={purging} className="h-9 text-[12px] rounded-xl gap-1.5">
    <Trash2 className="h-3.5 w-3.5" /> {purging ? "Limpando..." : "Limpar órfãs"}
  </Button>
  <Button onClick={() => setShowSendDialog(true)} className="h-9 bg-gradient-to-r from-primary to-emerald-600 text-white text-[12px] font-semibold rounded-xl shadow-lg shadow-primary/20">
    <Send className="h-3.5 w-3.5 mr-1.5" /> Nova Notificação
  </Button>
  </div>
 </div>

 <div className="relative">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar notificações..." className="pl-11 h-11 rounded-xl" />
 </div>

 {loading ? (
 <div className="py-12 text-center"><div className="h-6 w-6 mx-auto border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
 ) : filteredNotifications.length === 0 ? (
 <div className="text-center py-16 text-muted-foreground"><Bell className="h-12 w-12 mx-auto mb-4 opacity-30" /><p className="text-[14px] font-medium">Nenhuma notificação</p></div>
 ) : (
 <div className="space-y-2">
 {filteredNotifications.map(notif => {
 const isGlobal = notif.user_id === null;
 const seller = notif.user_id ? profiles.find(p => p.user_id === notif.user_id) : null;
 const created = format(new Date(notif.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
 return (
 <div key={notif.id} className="bg-card rounded-xl border border-border p-4 hover:border-primary/20 transition-all group">
 <div className="flex items-start gap-3">
 <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", typeColors[notif.type]?.split(" ").slice(1, 2).join(" ") || "bg-info/10")}>
 {notif.type === "withdrawal" ? <Clock className="h-4 w-4 text-violet-500" /> : notif.type === "announcement" ? <Megaphone className="h-4 w-4 text-primary" /> : <Info className="h-4 w-4 text-info" />}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="text-[13px] font-semibold text-foreground truncate">{notif.title}</h4>
 <span className={cn("text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider shrink-0", typeColors[notif.type] || typeColors.info)}>{typeLabels[notif.type] || notif.type}</span>
 {isGlobal ? (
 <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-bold uppercase tracking-wider shrink-0"><Users className="h-2.5 w-2.5 inline mr-0.5" /> Todos</span>
 ) : (
 <span className="text-[8px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-bold uppercase tracking-wider shrink-0"><User className="h-2.5 w-2.5 inline mr-0.5" /> {seller?.full_name || seller?.email || "Individual"}</span>
 )}
 </div>
 <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{notif.message}</p>
 <div className="flex items-center gap-2 mt-2">
 <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
 <span className="text-[9px] text-muted-foreground/60">{created}</span>
 {notif.is_read && (<><span className="text-muted-foreground/30">•</span><span className="text-[9px] text-primary/40">Lida</span></>)}
 </div>
 </div>
 <button onClick={() => handleDelete(notif.id)} className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all">
 <Trash2 className="h-3.5 w-3.5 text-destructive" />
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* Send Notification Dialog */}
 <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle className="text-[16px] font-bold flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Enviar Notificação</DialogTitle>
 </DialogHeader>
 <div className="space-y-5 mt-2">
 <div>
 <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Destinatário</Label>
  <div className="grid grid-cols-3 gap-2 mt-2">
  <button onClick={() => setSendTarget("all_sellers")} className={cn("py-3 rounded-xl border text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5", sendTarget === "all_sellers" ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground")}>
  <Users className="h-4 w-4" /> Todos
  </button>
  <button onClick={() => setSendTarget("active_sellers")} className={cn("py-3 rounded-xl border text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5", sendTarget === "active_sellers" ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground")}>
  <CheckCircle2 className="h-4 w-4" /> Só ativos
  </button>
  <button onClick={() => setSendTarget("specific")} className={cn("py-3 rounded-xl border text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5", sendTarget === "specific" ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground")}>
  <User className="h-4 w-4" /> Específico
  </button>
  </div>
 </div>
 {sendTarget === "specific" && (
 <div>
 <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Selecionar Seller</Label>
 <Input value={sellerSearch} onChange={e => setSellerSearch(e.target.value)} placeholder="Buscar por nome ou email..." className="mt-1 h-10 rounded-xl text-[12px]" />
 <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-border bg-muted/20">
 {filteredSellers.slice(0, 20).map(p => (
 <button key={p.user_id} onClick={() => { setSelectedUserId(p.user_id); setSellerSearch(p.full_name || p.email || ""); }}
 className={cn("w-full text-left px-3 py-2 text-[11px] hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0", selectedUserId === p.user_id ? "bg-primary/5 text-primary" : "text-muted-foreground")}>
 <span className="font-medium">{p.full_name || "Sem nome"}</span>
 <span className="text-muted-foreground/50 ml-2">{p.email}</span>
 </button>
 ))}
 </div>
 </div>
 )}
 <div>
 <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Tipo</Label>
 <div className="flex gap-2 mt-2">
 {NOTIF_TYPES.map(t => {
 const Icon = t.icon;
 return (
 <button key={t.value} onClick={() => setSendType(t.value)} className={cn("flex-1 py-2.5 rounded-xl border text-[10px] font-semibold transition-all flex flex-col items-center gap-1", sendType === t.value ? cn(t.color, "border-current/30") : "bg-muted/30 border-border text-muted-foreground hover:text-foreground")}>
 <Icon className="h-4 w-4" />{t.label}
 </button>
 );
 })}
 </div>
 </div>
 <div>
 <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Título</Label>
 <Input value={sendTitle} onChange={e => setSendTitle(e.target.value)} placeholder="Ex: Manutenção Programada" className="mt-1 h-11 rounded-xl" maxLength={100} />
 </div>
 <div>
 <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Mensagem</Label>
 <Textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)} placeholder="Escreva a mensagem da notificação..." className="mt-1 min-h-[100px] rounded-xl" maxLength={500} />
 <p className="text-[9px] text-muted-foreground/50 mt-1 text-right">{sendMessage.length}/500</p>
 </div>
 </div>
 <DialogFooter>
 <Button onClick={handleSend} disabled={sending || !sendTitle.trim() || !sendMessage.trim()} className="w-full h-11 bg-gradient-to-r from-primary to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 text-[13px]">
 <Send className="h-4 w-4 mr-2" />{sending ? "Enviando..." : sendTarget === "all" ? "Enviar para Todos" : "Enviar para Seller"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
