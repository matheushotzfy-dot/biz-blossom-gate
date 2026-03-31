import { useState, useEffect } from "react";
import { NumberInput } from "@/components/ui/number-input";
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
  UserPlus, Save, MessageSquare, Send, Eye, Mail,
  ChevronRight, CheckCircle2, XCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

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
  const [expandedManager, setExpandedManager] = useState<string | null>(null);

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
    if (!profile) { toast.error("Usuário não encontrado. Ele precisa estar cadastrado."); return; }
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

  const getName = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.full_name || p?.email || userId.slice(0, 8);
  };
  const getEmail = (userId: string) => profiles.find(pr => pr.user_id === userId)?.email || "";
  const sellersNotManagers = profiles.filter(p => !managers.some(m => m.user_id === p.user_id));

  const managerPermissions = [
    { label: "Visualizar sellers atribuídos", allowed: true },
    { label: "Aprovar KYC de sellers", allowed: true },
    { label: "Alterar taxas (com limite)", allowed: true },
    { label: "Notas internas", allowed: true },
    { label: "Ver todos os sellers", allowed: false },
    { label: "Acessar painel admin", allowed: false },
    { label: "Gerenciar saques", allowed: false },
    { label: "Editar configurações", allowed: false },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="h-4.5 w-4.5 text-white" />
            </div>
            Gerentes de Contas
          </h2>
          <p className="text-[12px] text-muted-foreground mt-1 ml-[46px]">
            {managers.length} gerente{managers.length !== 1 ? "s" : ""} ativo{managers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowFeeLimits(true)}
            className="h-9 bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 text-[11px] rounded-xl gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Limites
          </Button>
          <Button size="sm" onClick={() => setShowAddManager(true)}
            className="h-9 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[12px] rounded-xl gap-1.5 shadow-lg shadow-emerald-500/20">
            <Plus className="h-3.5 w-3.5" /> Novo Gerente
          </Button>
        </div>
      </div>

      {/* Permissions */}
      <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02] p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          Permissões do Gerente
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {managerPermissions.map(p => (
            <div key={p.label} className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium",
              p.allowed
                ? "bg-emerald-500/[0.06] text-emerald-400 border border-emerald-500/10"
                : "bg-red-500/[0.04] text-red-400/60 border border-red-500/8"
            )}>
              {p.allowed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {p.label}
            </div>
          ))}
        </div>
      </div>

      {/* Login info */}
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0">
            <Mail className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">Como o Gerente faz login?</h3>
            <p className="text-[12px] text-muted-foreground mt-1">
              Gerentes acessam pelo <strong className="text-foreground/80">painel exclusivo</strong> em{" "}
              <code className="bg-muted/40 px-1.5 py-0.5 rounded text-[11px]">/gerentes</code>.
              Autenticação server-side com rate limiting e log de auditoria.
            </p>
          </div>
        </div>
      </div>

      {/* Fee limits banner */}
      {feeLimits && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/10">
          <Zap className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-[12px] text-amber-300/80">
            <strong className="text-amber-400">Taxas mínimas:</strong>{" "}
            {feeLimits.min_transaction_percentage}% + R$ {feeLimits.min_transaction_fixed} por transação · Saque: R$ {feeLimits.min_withdrawal_fee}
          </p>
        </div>
      )}

      {/* Manager list */}
      {loading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">Carregando...</div>
      ) : managers.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/5 flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 opacity-20" />
          </div>
          <p className="text-[14px] font-medium">Nenhum gerente cadastrado</p>
          <p className="text-[12px] mt-1 text-muted-foreground/60">Adicione gerentes para delegar gestão de sellers</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {managers.map((manager, i) => {
              const managerAssignments = assignments.filter(a => a.manager_user_id === manager.user_id);
              const isExpanded = expandedManager === manager.user_id;

              return (
                <motion.div
                  key={manager.user_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-border bg-card overflow-hidden hover:border-emerald-500/15 transition-all"
                >
                  {/* Manager header */}
                  <div
                    className="p-5 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedManager(isExpanded ? null : manager.user_id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/15 flex items-center justify-center text-[16px] font-bold text-emerald-400">
                        {(manager.full_name || manager.email || "G")[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-[14px] font-semibold text-foreground">{manager.full_name || "Sem nome"}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[12px] text-muted-foreground">{manager.email}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                            <Users className="h-2.5 w-2.5" />
                            {managerAssignments.length} seller{managerAssignments.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); setSelectedManagerId(manager.user_id); setShowAssignSeller(true); }}
                        className="h-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-[11px] rounded-xl gap-1.5"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Atribuir
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleRemoveManager(manager.user_id); }}
                        className="h-8 text-destructive hover:bg-destructive/10 text-[11px] rounded-xl gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                    </div>
                  </div>

                  {/* Sellers assigned (expanded) */}
                  <AnimatePresence>
                    {isExpanded && managerAssignments.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border px-5 py-4 bg-muted/[0.02]">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">Sellers atribuídos</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {managerAssignments.map(assignment => (
                              <div key={assignment.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-card border border-border group hover:border-emerald-500/10 transition-all">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                                    {getName(assignment.seller_user_id)[0].toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-medium text-foreground truncate">{getName(assignment.seller_user_id)}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{getEmail(assignment.seller_user_id)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button
                                    onClick={() => { setNoteSellerId(assignment.seller_user_id); setShowAddNote(true); }}
                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                    title="Nota"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => { setNoteSellerId(assignment.seller_user_id); loadSellerNotes(assignment.seller_user_id); setShowSellerNotes(true); }}
                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-amber-400 hover:bg-amber-500/10 transition-colors"
                                    title="Ver notas"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveAssignment(assignment.id)}
                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Remover"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Manager Dialog */}
      <Dialog open={showAddManager} onOpenChange={setShowAddManager}>
        <DialogContent className="max-w-md border-emerald-500/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Plus className="h-4 w-4 text-white" />
              </div>
              Adicionar Gerente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-xl bg-muted/20 border border-border p-3">
              <p className="text-[11px] text-muted-foreground">
                Digite o e-mail de um <strong className="text-foreground/70">usuário já cadastrado</strong>. Ele poderá acessar via <code className="bg-muted/40 px-1 py-0.5 rounded text-[10px]">/gerentes</code>.
              </p>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">E-mail do usuário</Label>
              <Input value={newManagerEmail} onChange={e => setNewManagerEmail(e.target.value)} type="email" placeholder="gerente@email.com" className="mt-2 h-11 rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddManager} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 gap-2">
              <UserPlus className="h-4 w-4" /> Adicionar Gerente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Seller Dialog */}
      <Dialog open={showAssignSeller} onOpenChange={setShowAssignSeller}>
        <DialogContent className="max-w-md border-emerald-500/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Atribuir Seller</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-[12px] text-muted-foreground">Gerente: <strong className="text-emerald-400">{getName(selectedManagerId)}</strong></p>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Selecionar Seller</Label>
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue placeholder="Escolha um seller..." /></SelectTrigger>
                <SelectContent>
                  {sellersNotManagers.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || p.user_id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAssignSeller} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl gap-2">
              <UserPlus className="h-4 w-4" /> Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Limits Dialog */}
      <Dialog open={showFeeLimits} onOpenChange={setShowFeeLimits}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Settings className="h-5 w-5 text-amber-400" />
              Limites de Taxa
            </DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-muted-foreground">Valores mínimos que gerentes podem aplicar.</p>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Taxa Percentual Mínima (%)</Label>
              <NumberInput value={feeForm.percentage} onChange={v => setFeeForm(p => ({ ...p, percentage: v }))} step={0.01} min={0} className="mt-2" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Taxa Fixa Mínima (R$)</Label>
              <NumberInput value={feeForm.fixed} onChange={v => setFeeForm(p => ({ ...p, fixed: v }))} step={0.01} min={0} className="mt-2" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Taxa de Saque Mínima (R$)</Label>
              <NumberInput value={feeForm.withdrawal} onChange={v => setFeeForm(p => ({ ...p, withdrawal: v }))} step={0.01} min={0} className="mt-2" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveFeeLimits} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl gap-2">
              <Save className="h-4 w-4" /> Salvar Limites
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seller Notes Dialog */}
      <Dialog open={showSellerNotes} onOpenChange={setShowSellerNotes}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Notas — {getName(noteSellerId)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
            {sellerNotes.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-20" />
                <p className="text-[13px] font-medium">Nenhuma nota</p>
              </div>
            ) : (
              sellerNotes.map(note => (
                <div key={note.id} className="p-4 rounded-xl bg-muted/20 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                      note.author_role === "admin" ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"
                    )}>
                      {note.author_role}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-[13px] text-foreground/80">{note.content}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Nova Nota</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[12px] text-muted-foreground">Seller: <strong className="text-foreground/70">{getName(noteSellerId)}</strong></p>
            <Textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Escreva sua observação..."
              className="min-h-[100px] rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleAddNote} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl gap-2">
              <Send className="h-4 w-4" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
