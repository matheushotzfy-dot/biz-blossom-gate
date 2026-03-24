import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, Plus, Trash2, Settings, Shield, Search,
  UserPlus, Save, MessageSquare, Send, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Profile = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  account_status: string;
};

type Assignment = {
  id: string;
  manager_user_id: string;
  seller_user_id: string;
  assigned_by: string;
  created_at: string;
  notes: string | null;
};

type FeeLimits = {
  id: string;
  min_transaction_percentage: number;
  min_transaction_fixed: number;
  min_withdrawal_fee: number;
};

type SellerNote = {
  id: string;
  seller_user_id: string;
  author_user_id: string;
  author_role: string;
  content: string;
  created_at: string;
};

interface Props {
  profiles: Profile[];
  onReload: () => void;
}

export default function AdminManagersTab({ profiles, onReload }: Props) {
  const { user } = useAuth();
  const [managers, setManagers] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [feeLimits, setFeeLimits] = useState<FeeLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showAddManager, setShowAddManager] = useState(false);
  const [showAssignSeller, setShowAssignSeller] = useState(false);
  const [showFeeLimits, setShowFeeLimits] = useState(false);
  const [showSellerNotes, setShowSellerNotes] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [newManagerEmail, setNewManagerEmail] = useState("");
  const [feeForm, setFeeForm] = useState({ percentage: "", fixed: "", withdrawal: "" });
  const [sellerNotes, setSellerNotes] = useState<SellerNote[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [noteSellerId, setNoteSellerId] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: rolesData } = await supabase
        .from("user_roles").select("user_id").eq("role", "manager" as any);
      const managerIds = (rolesData || []).map(r => r.user_id);
      const managerProfiles = profiles.filter(p => managerIds.includes(p.user_id));
      setManagers(managerProfiles);

      const { data: assignData } = await supabase
        .from("manager_seller_assignments" as any).select("*") as any;
      setAssignments((assignData || []) as Assignment[]);

      const { data: limitsData } = await supabase
        .from("manager_fee_limits" as any).select("*").limit(1) as any;
      if (limitsData && limitsData.length > 0) {
        setFeeLimits(limitsData[0]);
        setFeeForm({
          percentage: limitsData[0].min_transaction_percentage.toString(),
          fixed: limitsData[0].min_transaction_fixed.toString(),
          withdrawal: limitsData[0].min_withdrawal_fee.toString(),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddManager = async () => {
    if (!newManagerEmail.trim()) return;
    const profile = profiles.find(p => p.email?.toLowerCase() === newManagerEmail.toLowerCase());
    if (!profile) { toast.error("Usuário não encontrado"); return; }
    const { error } = await supabase.from("user_roles").insert({ user_id: profile.user_id, role: "manager" as any });
    if (error) {
      if (error.code === "23505") toast.error("Usuário já é gerente");
      else toast.error("Erro ao adicionar gerente");
      return;
    }
    toast.success(`${profile.full_name || profile.email} agora é Gerente!`);
    setShowAddManager(false);
    setNewManagerEmail("");
    loadData();
    onReload();
  };

  const handleRemoveManager = async (userId: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "manager" as any);
    await (supabase.from("manager_seller_assignments" as any) as any).delete().eq("manager_user_id", userId);
    toast.success("Gerente removido");
    loadData();
    onReload();
  };

  const handleAssignSeller = async () => {
    if (!selectedManagerId || !selectedSellerId) return;
    const { error } = await supabase.from("manager_seller_assignments" as any).insert({
      manager_user_id: selectedManagerId, seller_user_id: selectedSellerId, assigned_by: user!.id,
    } as any);
    if (error) {
      if (error.code === "23505") toast.error("Seller já atribuído a este gerente");
      else toast.error("Erro ao atribuir seller");
      return;
    }
    toast.success("Seller atribuído ao gerente!");
    setShowAssignSeller(false);
    loadData();
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    await (supabase.from("manager_seller_assignments" as any) as any).delete().eq("id", assignmentId);
    toast.success("Atribuição removida");
    loadData();
  };

  const handleSaveFeeLimits = async () => {
    const pct = Number(feeForm.percentage);
    const fixed = Number(feeForm.fixed);
    const withdrawal = Number(feeForm.withdrawal);
    if (pct < 0 || fixed < 0 || withdrawal < 0) { toast.error("Valores não podem ser negativos"); return; }
    if (feeLimits) {
      await (supabase.from("manager_fee_limits" as any) as any)
        .update({ min_transaction_percentage: pct, min_transaction_fixed: fixed, min_withdrawal_fee: withdrawal, updated_by: user!.id })
        .eq("id", feeLimits.id);
    } else {
      await (supabase.from("manager_fee_limits" as any) as any).insert({
        min_transaction_percentage: pct, min_transaction_fixed: fixed, min_withdrawal_fee: withdrawal, updated_by: user!.id,
      });
    }
    toast.success("Limites de taxa atualizados!");
    setShowFeeLimits(false);
    loadData();
  };

  const loadSellerNotes = async (sellerId: string) => {
    const { data } = await supabase
      .from("seller_notes" as any).select("*")
      .eq("seller_user_id", sellerId)
      .order("created_at", { ascending: false }) as any;
    setSellerNotes((data || []) as SellerNote[]);
  };

  const handleAddNote = async () => {
    if (!noteContent.trim() || !noteSellerId) return;
    await (supabase.from("seller_notes" as any) as any).insert({
      seller_user_id: noteSellerId, author_user_id: user!.id, author_role: "admin", content: noteContent.trim(),
    });
    toast.success("Nota adicionada!");
    setNoteContent("");
    setShowAddNote(false);
    loadSellerNotes(noteSellerId);
  };

  const getManagerName = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.full_name || p?.email || userId.slice(0, 8);
  };
  const getSellerName = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.full_name || p?.email || userId.slice(0, 8);
  };
  const sellersNotManagers = profiles.filter(p => !managers.some(m => m.user_id === p.user_id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Gerentes de Contas
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">{managers.length} gerentes ativos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowFeeLimits(true)} className="h-8 bg-muted/30 border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 text-[11px]">
            <Settings className="h-3.5 w-3.5 mr-1" /> Limites de Taxas
          </Button>
          <Button size="sm" onClick={() => setShowAddManager(true)} className="h-8 bg-gradient-to-r from-primary to-emerald-600 text-white text-[11px]">
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Gerente
          </Button>
        </div>
      </div>

      {feeLimits && (
        <div className="flex items-center gap-4 p-3 rounded-xl bg-warning/5 border border-warning/15">
          <Settings className="h-4 w-4 text-warning shrink-0" />
          <p className="text-[11px] text-warning">
            <strong>Limites de taxa mínima para gerentes:</strong> {feeLimits.min_transaction_percentage}% + R$ {feeLimits.min_transaction_fixed} por transação | Saque: R$ {feeLimits.min_withdrawal_fee}
          </p>
        </div>
      )}

      {managers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-[14px] font-medium">Nenhum gerente cadastrado</p>
          <p className="text-[12px] mt-1">Adicione gerentes para delegar gestão de sellers.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {managers.map(manager => {
            const managerAssignments = assignments.filter(a => a.manager_user_id === manager.user_id);
            return (
              <div key={manager.user_id} className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                      {(manager.full_name || manager.email || "G")[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-foreground">{manager.full_name || "Sem nome"}</h3>
                      <p className="text-[11px] text-muted-foreground">{manager.email} • {managerAssignments.length} sellers</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedManagerId(manager.user_id); setShowAssignSeller(true); }} className="h-8 text-info hover:bg-info/10 text-[11px]">
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Atribuir Seller
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveManager(manager.user_id)} className="h-8 text-destructive hover:bg-destructive/10 text-[11px]">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                    </Button>
                  </div>
                </div>
                {managerAssignments.length > 0 && (
                  <div className="border-t border-border px-5 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Sellers atribuídos</p>
                    <div className="flex flex-wrap gap-2">
                      {managerAssignments.map(assignment => (
                        <div key={assignment.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border group">
                          <span className="text-[11px] text-muted-foreground">{getSellerName(assignment.seller_user_id)}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setNoteSellerId(assignment.seller_user_id); setShowAddNote(true); }} className="text-info hover:text-info/80" title="Adicionar nota">
                              <MessageSquare className="h-3 w-3" />
                            </button>
                            <button onClick={() => { setNoteSellerId(assignment.seller_user_id); loadSellerNotes(assignment.seller_user_id); setShowSellerNotes(true); }} className="text-warning hover:text-warning/80" title="Ver notas">
                              <Eye className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleRemoveAssignment(assignment.id)} className="text-destructive hover:text-destructive/80" title="Remover">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Manager Dialog */}
      <Dialog open={showAddManager} onOpenChange={setShowAddManager}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Gerente</DialogTitle></DialogHeader>
          <div>
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">E-mail do usuário</Label>
            <Input value={newManagerEmail} onChange={e => setNewManagerEmail(e.target.value)} type="email" placeholder="gerente@email.com" className="mt-1" />
            <p className="text-[10px] text-muted-foreground mt-2">O usuário deve estar cadastrado na plataforma.</p>
          </div>
          <DialogFooter>
            <Button onClick={handleAddManager} className="bg-gradient-to-r from-primary to-emerald-600 text-white">
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Gerente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Seller Dialog */}
      <Dialog open={showAssignSeller} onOpenChange={setShowAssignSeller}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Atribuir Seller ao Gerente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">Gerente: <strong className="text-primary">{getManagerName(selectedManagerId)}</strong></p>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Selecionar Seller</Label>
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Escolha um seller..." /></SelectTrigger>
                <SelectContent>
                  {sellersNotManagers.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || p.user_id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAssignSeller} className="bg-gradient-to-r from-info to-indigo-600 text-white">
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Limits Dialog */}
      <Dialog open={showFeeLimits} onOpenChange={setShowFeeLimits}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Limites de Taxa para Gerentes</DialogTitle></DialogHeader>
          <p className="text-[11px] text-muted-foreground">Defina os valores mínimos que os gerentes podem aplicar aos sellers.</p>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Taxa Percentual Mínima (%)</Label>
              <Input value={feeForm.percentage} onChange={e => setFeeForm(p => ({ ...p, percentage: e.target.value }))} type="number" step="0.01" min="0" className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Taxa Fixa Mínima (R$)</Label>
              <Input value={feeForm.fixed} onChange={e => setFeeForm(p => ({ ...p, fixed: e.target.value }))} type="number" step="0.01" min="0" className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Taxa de Saque Mínima (R$)</Label>
              <Input value={feeForm.withdrawal} onChange={e => setFeeForm(p => ({ ...p, withdrawal: e.target.value }))} type="number" step="0.01" min="0" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveFeeLimits} className="bg-gradient-to-r from-warning to-orange-600 text-white">
              <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar Limites
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seller Notes View Dialog */}
      <Dialog open={showSellerNotes} onOpenChange={setShowSellerNotes}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader><DialogTitle>Observações — {getSellerName(noteSellerId)}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
            {sellerNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-[12px]">Nenhuma observação ainda</p>
              </div>
            ) : (
              sellerNotes.map(note => (
                <div key={note.id} className="p-4 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md font-semibold border",
                      note.author_role === "admin"
                        ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                        : "bg-primary/10 text-primary border-primary/20"
                    )}>
                      {note.author_role === "admin" ? "Admin" : "Gerente"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                  <p className="text-[12px] text-foreground/60 leading-relaxed">{note.content}</p>
                </div>
              ))
            )}
          </div>
          <Button size="sm" onClick={() => { setShowSellerNotes(false); setShowAddNote(true); }} className="w-full bg-info/10 text-info hover:bg-info/20 border border-info/20">
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Nota
          </Button>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Nota — {getSellerName(noteSellerId)}</DialogTitle></DialogHeader>
          <Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Escreva sua observação..." className="min-h-[120px]" />
          <DialogFooter>
            <Button onClick={handleAddNote} disabled={!noteContent.trim()} className="bg-gradient-to-r from-info to-indigo-600 text-white">
              <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
