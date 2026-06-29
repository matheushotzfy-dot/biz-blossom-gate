import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  Users, LogOut, CreditCard, Shield, ChevronDown,
  MessageSquare, Percent, CheckCircle, XCircle, Search,
  DollarSign, Send, Clock, FileText, Plus, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ManagerKycRpc = (
  fn: "manager_update_seller_kyc",
  args: { _seller_user_id: string; _status: "approved" | "rejected" }
) => Promise<{ error: { message: string } | null }>;
const managerKycRpc = supabase.rpc as unknown as ManagerKycRpc;

type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  account_status: string;
  document_number: string | null;
  seller_type: string | null;
  created_at: string;
};

type SellerNote = {
  id: string;
  seller_user_id: string;
  author_user_id: string;
  author_role: string;
  content: string;
  created_at: string;
};

type Transaction = {
  id: string;
  amount: number;
  net_amount: number;
  status: string;
  payment_method: string | null;
  customer_name: string | null;
  created_at: string;
  user_id: string;
};

type CustomFee = {
  id: string;
  user_id: string;
  transaction_percentage: number | null;
  transaction_fixed: number | null;
  withdrawal_fee: number | null;
};

type FeeLimits = {
  min_transaction_percentage: number;
  min_transaction_fixed: number;
  min_withdrawal_fee: number;
};

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [sellerNotes, setSellerNotes] = useState<Record<string, SellerNote[]>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customFees, setCustomFees] = useState<Record<string, CustomFee>>({});
  const [feeLimits, setFeeLimits] = useState<FeeLimits>({ min_transaction_percentage: 2, min_transaction_fixed: 1, min_withdrawal_fee: 3 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSeller, setSelectedSeller] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<"sellers" | "transactions">("sellers");

  // Dialog states
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showFeeDialog, setShowFeeDialog] = useState(false);
  const [showNotesViewDialog, setShowNotesViewDialog] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [feeForm, setFeeForm] = useState({ percentage: "", fixed: "", withdrawal: "" });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load assigned sellers via assignments → profiles
      const { data: assignments } = await supabase
        .from("manager_seller_assignments")
        .select("seller_user_id, notes")
        .eq("manager_user_id", user!.id);

      if (!assignments || assignments.length === 0) {
        setSellers([]);
        setLoading(false);
        return;
      }

      const sellerIds = assignments.map((a) => a.seller_user_id);

      const [profilesRes, txRes, feeLimitsRes] = await Promise.all([
        supabase.from("profiles").select("*").in("user_id", sellerIds),
        supabase.from("transactions").select("*").in("user_id", sellerIds).order("created_at", { ascending: false }).limit(200),
        supabase.from("manager_fee_limits").select("*").limit(1),
      ]);

      setSellers((profilesRes.data || []) as Profile[]);
      setTransactions((txRes.data || []) as Transaction[]);

      if (feeLimitsRes.data && feeLimitsRes.data.length > 0) {
        const fl = feeLimitsRes.data[0];
        setFeeLimits({
          min_transaction_percentage: fl.min_transaction_percentage,
          min_transaction_fixed: fl.min_transaction_fixed,
          min_withdrawal_fee: fl.min_withdrawal_fee,
        });
      }

      // Load custom fees for each seller
      const { data: feesData } = await supabase
        .from("custom_user_fees")
        .select("*")
        .in("user_id", sellerIds);

      const feesMap: Record<string, CustomFee> = {};
      (feesData || []).forEach((f) => { feesMap[f.user_id] = f as CustomFee; });
      setCustomFees(feesMap);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async (sellerId: string) => {
    const { data } = await supabase
      .from("seller_notes")
      .select("*")
      .eq("seller_user_id", sellerId)
      .order("created_at", { ascending: false });
    setSellerNotes(prev => ({ ...prev, [sellerId]: (data || []) as SellerNote[] }));
  };

  const filteredSellers = useMemo(() => {
    if (!search) return sellers;
    const q = search.toLowerCase();
    return sellers.filter(s =>
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.document_number?.includes(q)
    );
  }, [sellers, search]);

  const getSellerStats = (userId: string) => {
    const stx = transactions.filter(t => t.user_id === userId);
    const completed = stx.filter(t => t.status === "completed");
    return {
      totalTx: stx.length,
      totalRevenue: completed.reduce((s, t) => s + Number(t.net_amount), 0),
      completedCount: completed.length,
    };
  };

  const handleApproveKYC = async (seller: Profile) => {
    const { error } = await supabase.rpc("manager_update_seller_kyc" as any, {
      _seller_user_id: seller.user_id,
      _status: "approved",
    });
    if (error) { toast.error("Erro ao aprovar conta"); return; }
    toast.success(`Conta de ${seller.full_name || seller.email} aprovada!`);
    loadData();
  };

  const handleRejectKYC = async (seller: Profile) => {
    if (!window.confirm(`Tem certeza que deseja rejeitar a conta de ${seller.full_name || seller.email}?`)) return;
    const { error } = await supabase.rpc("manager_update_seller_kyc" as any, {
      _seller_user_id: seller.user_id,
      _status: "rejected",
    });
    if (error) { toast.error("Erro ao rejeitar conta"); return; }
    toast.success(`Conta de ${seller.full_name || seller.email} rejeitada`);
    loadData();
  };

  const handleAddNote = async () => {
    if (!selectedSeller || !noteContent.trim()) return;
    const { error } = await supabase.from("seller_notes").insert({
      seller_user_id: selectedSeller.user_id,
      author_user_id: user!.id,
      author_role: "manager",
      content: noteContent.trim(),
    });
    if (error) { toast.error("Erro ao adicionar nota"); return; }
    toast.success("Nota adicionada!");
    setNoteContent("");
    setShowNoteDialog(false);
    loadNotes(selectedSeller.user_id);
  };

  const handleUpdateFees = async () => {
    if (!selectedSeller) return;
    const pct = feeForm.percentage ? Number(feeForm.percentage) : null;
    const fixed = feeForm.fixed ? Number(feeForm.fixed) : null;
    const withdrawal = feeForm.withdrawal ? Number(feeForm.withdrawal) : null;

    // Validate against limits
    if (pct !== null && pct < feeLimits.min_transaction_percentage) {
      toast.error(`Taxa percentual mínima: ${feeLimits.min_transaction_percentage}%`);
      return;
    }
    if (fixed !== null && fixed < feeLimits.min_transaction_fixed) {
      toast.error(`Taxa fixa mínima: R$ ${feeLimits.min_transaction_fixed}`);
      return;
    }
    if (withdrawal !== null && withdrawal < feeLimits.min_withdrawal_fee) {
      toast.error(`Taxa de saque mínima: R$ ${feeLimits.min_withdrawal_fee}`);
      return;
    }

    const existing = customFees[selectedSeller.user_id];
    if (existing) {
      const { error } = await supabase
        .from("custom_user_fees")
        .update({
          transaction_percentage: pct,
          transaction_fixed: fixed,
          withdrawal_fee: withdrawal,
          admin_user_id: user!.id,
        })
        .eq("id", existing.id);
      if (error) { toast.error("Erro ao atualizar taxas"); return; }
    } else {
      const { error } = await supabase
        .from("custom_user_fees")
        .insert({
          user_id: selectedSeller.user_id,
          transaction_percentage: pct,
          transaction_fixed: fixed,
          withdrawal_fee: withdrawal,
          admin_user_id: user!.id,
        });
      if (error) { toast.error("Erro ao criar taxas"); return; }
    }

    toast.success("Taxas atualizadas!");
    setShowFeeDialog(false);
    loadData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/gerentes");
  };

  const statusColors: Record<string, string> = {
    active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    pending_review: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rejected: "text-red-400 bg-red-500/10 border-red-500/20",
    suspended: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  const statusLabels: Record<string, string> = {
    active: "Ativa",
    pending_review: "Em Análise",
    rejected: "Rejeitada",
    suspended: "Suspensa",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse text-white/20">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Top Nav */}
      <div className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050505]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Shield className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-white">Gerente de Contas</h1>
              <p className="text-[10px] text-white/30">{sellers.length} sellers atribuídos</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab Switch */}
            <div className="flex items-center bg-white/[0.03] rounded-xl border border-white/[0.06] p-1">
              {(["sellers", "transactions"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[12px] font-semibold transition-all",
                    activeTab === tab
                      ? "bg-emerald-500 text-white shadow-lg"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab === "sellers" ? "Sellers" : "Transações"}
                </button>
              ))}
            </div>

            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/70 text-[12px] transition-all">
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Sellers", value: sellers.length, icon: Users, color: "from-emerald-500 to-teal-600" },
            { label: "Pendentes KYC", value: sellers.filter(s => s.account_status === "pending_review").length, icon: Clock, color: "from-amber-500 to-orange-600" },
            { label: "Transações", value: transactions.length, icon: CreditCard, color: "from-blue-500 to-indigo-600" },
            { label: "Receita Total", value: `R$ ${transactions.filter(t => t.status === "completed").reduce((s, t) => s + Number(t.net_amount), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "from-violet-500 to-purple-600" },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white/[0.02] rounded-2xl border border-white/[0.06] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center", kpi.color)}>
                  <kpi.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">{kpi.label}</span>
              </div>
              <p className="text-[22px] font-bold text-white">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar seller por nome, e-mail ou documento..."
            className="pl-11 bg-white/[0.02] border-white/[0.06] text-white placeholder:text-white/15 h-12 rounded-2xl"
          />
        </div>

        {activeTab === "sellers" ? (
          /* Sellers Grid */
          <div className="space-y-3">
            {filteredSellers.length === 0 ? (
              <div className="text-center py-20 text-white/20">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-[14px] font-medium">Nenhum seller atribuído</p>
                <p className="text-[12px] mt-1">Peça ao administrador para atribuir sellers.</p>
              </div>
            ) : (
              filteredSellers.map(seller => {
                const stats = getSellerStats(seller.user_id);
                const fee = customFees[seller.user_id];
                return (
                  <div key={seller.id} className="bg-white/[0.02] rounded-2xl border border-white/[0.06] p-5 hover:border-white/[0.12] transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-[16px]">
                          {(seller.full_name || seller.email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-[14px] font-semibold text-white">{seller.full_name || "Sem nome"}</h3>
                          <p className="text-[11px] text-white/30">{seller.email}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-md border font-semibold", statusColors[seller.account_status] || "text-white/40 bg-white/5 border-white/10")}>
                              {statusLabels[seller.account_status] || seller.account_status}
                            </span>
                            {seller.seller_type && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/40 font-semibold uppercase">{seller.seller_type}</span>
                            )}
                            {fee && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold">
                                {fee.transaction_percentage ?? "—"}% + R$ {fee.transaction_fixed ?? "—"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="text-[10px] text-white/30">Vendas</p>
                          <p className="text-[14px] font-bold text-white">{stats.completedCount}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/30">Receita</p>
                          <p className="text-[14px] font-bold text-emerald-400">R$ {stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/[0.04]">
                      {seller.account_status === "pending_review" && (
                        <>
                          <Button size="sm" onClick={() => handleApproveKYC(seller)} className="h-8 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-[11px]">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" onClick={() => handleRejectKYC(seller)} variant="ghost" className="h-8 text-red-400 hover:bg-red-500/10 text-[11px]">
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => {
                        setSelectedSeller(seller);
                        const fee = customFees[seller.user_id];
                        setFeeForm({
                          percentage: fee?.transaction_percentage?.toString() || "",
                          fixed: fee?.transaction_fixed?.toString() || "",
                          withdrawal: fee?.withdrawal_fee?.toString() || "",
                        });
                        setShowFeeDialog(true);
                      }} className="h-8 text-violet-400 hover:bg-violet-500/10 text-[11px]">
                        <Percent className="h-3.5 w-3.5 mr-1" /> Taxas
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setSelectedSeller(seller);
                        setShowNoteDialog(true);
                      }} className="h-8 text-blue-400 hover:bg-blue-500/10 text-[11px]">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Nota
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setSelectedSeller(seller);
                        loadNotes(seller.user_id);
                        setShowNotesViewDialog(true);
                      }} className="h-8 text-amber-400 hover:bg-amber-500/10 text-[11px]">
                        <Eye className="h-3.5 w-3.5 mr-1" /> Ver Notas
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Transactions Tab */
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="text-center py-20 text-white/20">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-[14px] font-medium">Nenhuma transação encontrada</p>
              </div>
            ) : (
              <div className="bg-white/[0.02] rounded-2xl border border-white/[0.06] overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left p-4 text-white/30 font-semibold text-[10px] uppercase tracking-wider">Seller</th>
                      <th className="text-left p-4 text-white/30 font-semibold text-[10px] uppercase tracking-wider">Cliente</th>
                      <th className="text-left p-4 text-white/30 font-semibold text-[10px] uppercase tracking-wider">Valor</th>
                      <th className="text-left p-4 text-white/30 font-semibold text-[10px] uppercase tracking-wider">Status</th>
                      <th className="text-left p-4 text-white/30 font-semibold text-[10px] uppercase tracking-wider">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 50).map(tx => {
                      const seller = sellers.find(s => s.user_id === tx.user_id);
                      const txStatusColors: Record<string, string> = {
                        completed: "text-emerald-400 bg-emerald-500/10",
                        pending: "text-amber-400 bg-amber-500/10",
                        failed: "text-red-400 bg-red-500/10",
                        refunded: "text-violet-400 bg-violet-500/10",
                      };
                      return (
                        <tr key={tx.id} className="border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 text-white/60 font-medium">{seller?.full_name || seller?.email || "—"}</td>
                          <td className="p-4 text-white/40">{tx.customer_name || "—"}</td>
                          <td className="p-4 text-white font-semibold">R$ {Number(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                          <td className="p-4">
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-md font-semibold", txStatusColors[tx.status] || "text-white/40 bg-white/5")}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="p-4 text-white/30">{format(new Date(tx.created_at), "dd/MM HH:mm", { locale: ptBR })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fee Dialog */}
      <Dialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
        <DialogContent className="bg-[#0A0A10] border-white/[0.08] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold">Ajustar Taxas — {selectedSeller?.full_name || selectedSeller?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-[11px] text-amber-400">
              Mínimos definidos pelo admin: {feeLimits.min_transaction_percentage}% + R$ {feeLimits.min_transaction_fixed} | Saque: R$ {feeLimits.min_withdrawal_fee}
            </div>
            <div>
              <Label className="text-[11px] text-white/40 uppercase tracking-wider">Taxa Percentual (%)</Label>
              <Input value={feeForm.percentage} onChange={e => setFeeForm(p => ({ ...p, percentage: e.target.value }))} type="number" step="0.01" min={feeLimits.min_transaction_percentage} placeholder={`Mín: ${feeLimits.min_transaction_percentage}%`} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" />
            </div>
            <div>
              <Label className="text-[11px] text-white/40 uppercase tracking-wider">Taxa Fixa (R$)</Label>
              <Input value={feeForm.fixed} onChange={e => setFeeForm(p => ({ ...p, fixed: e.target.value }))} type="number" step="0.01" min={feeLimits.min_transaction_fixed} placeholder={`Mín: R$ ${feeLimits.min_transaction_fixed}`} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" />
            </div>
            <div>
              <Label className="text-[11px] text-white/40 uppercase tracking-wider">Taxa de Saque (R$)</Label>
              <Input value={feeForm.withdrawal} onChange={e => setFeeForm(p => ({ ...p, withdrawal: e.target.value }))} type="number" step="0.01" min={feeLimits.min_withdrawal_fee} placeholder={`Mín: R$ ${feeLimits.min_withdrawal_fee}`} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateFees} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              Salvar Taxas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="bg-[#0A0A10] border-white/[0.08] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold">Adicionar Nota — {selectedSeller?.full_name || selectedSeller?.email}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            placeholder="Escreva sua observação sobre este seller..."
            className="bg-white/[0.03] border-white/[0.06] text-white min-h-[120px] placeholder:text-white/15"
          />
          <DialogFooter>
            <Button onClick={handleAddNote} disabled={!noteContent.trim()} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
              <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Notes Dialog */}
      <Dialog open={showNotesViewDialog} onOpenChange={setShowNotesViewDialog}>
        <DialogContent className="bg-[#0A0A10] border-white/[0.08] text-white max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold">Observações — {selectedSeller?.full_name || selectedSeller?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
            {(!selectedSeller || !(sellerNotes[selectedSeller.user_id]?.length)) ? (
              <div className="text-center py-8 text-white/20">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-[12px]">Nenhuma observação ainda</p>
              </div>
            ) : (
              sellerNotes[selectedSeller.user_id].map(note => (
                <div key={note.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md font-semibold",
                      note.author_role === "admin"
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    )}>
                      {note.author_role === "admin" ? "Admin" : "Gerente"}
                    </span>
                    <span className="text-[10px] text-white/20">{format(new Date(note.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                  <p className="text-[12px] text-white/60 leading-relaxed">{note.content}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
