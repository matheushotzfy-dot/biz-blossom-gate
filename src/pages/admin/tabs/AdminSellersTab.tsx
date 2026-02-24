import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, Search, Ban, CheckCircle2, Eye, MoreHorizontal, Activity, Package,
  Trash2, Edit, Plus, Clock, Wallet, ArrowDownToLine, ShoppingCart,
  FileText, Globe, DollarSign, XCircle, Save, CreditCard, Shield, Landmark,
  Key, TrendingUp, Percent, BarChart3,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import { AdminPanel, PanelTitle } from "./AdminOverviewTab";
import { logAdminAction } from "@/lib/auditLog";

interface ActivityLog {
  id: string; user_id: string; action: string; entity_type: string;
  entity_id: string | null; old_data: Record<string, any> | null;
  new_data: Record<string, any> | null; created_at: string;
}

interface Acquirer {
  id: string; name: string; slug: string; type: string; is_active: boolean;
}

interface PixKey {
  id: string; key_type: string; key_value: string; created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  product_created: { label: "Produto Criado", color: "text-emerald-400", icon: Plus },
  product_updated: { label: "Produto Editado", color: "text-blue-400", icon: Edit },
  product_deleted: { label: "Produto Excluído", color: "text-red-400", icon: Trash2 },
  course_created: { label: "Curso Criado", color: "text-emerald-400", icon: Plus },
  course_updated: { label: "Curso Editado", color: "text-blue-400", icon: Edit },
  course_deleted: { label: "Curso Excluído", color: "text-red-400", icon: Trash2 },
};

interface Props {
  profiles: Tables<"profiles">[];
  transactions: Tables<"transactions">[];
  withdrawals: Tables<"withdrawals">[];
  onReload: () => void;
  fmtCurrency: (v: number) => string;
}

export default function AdminSellersTab({ profiles, transactions, withdrawals, onReload, fmtCurrency }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sellerFilter, setSellerFilter] = useState<"all" | "white" | "black" | "unset">("all");
  const [selectedUser, setSelectedUser] = useState<Tables<"profiles"> | null>(null);
  const [userLogs, setUserLogs] = useState<ActivityLog[]>([]);
  const [userProducts, setUserProducts] = useState<Tables<"products">[]>([]);
  const [userWithdrawals, setUserWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [userTransactions, setUserTransactions] = useState<Tables<"transactions">[]>([]);
  const [userPixKeys, setUserPixKeys] = useState<PixKey[]>([]);
  const [customFees, setCustomFees] = useState({ transaction_percentage: "", transaction_fixed: "", withdrawal_fee: "" });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustReason, setAdjustReason] = useState("");
  const [balanceAdjustments, setBalanceAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [kycImages, setKycImages] = useState<string[]>([]);
  const [acquirers, setAcquirers] = useState<Acquirer[]>([]);
  const [selectedAcquirerId, setSelectedAcquirerId] = useState<string>("");

  useEffect(() => {
    supabase.from("acquirers").select("*").eq("is_active", true).then(({ data }) => {
      if (data) setAcquirers(data as Acquirer[]);
    });
  }, []);

  const openUserDetail = async (profile: Tables<"profiles">) => {
    setSelectedUser(profile);
    setLoading(true);
    const [logsRes, productsRes, wdRes, txRes, feesRes, adjRes, pixRes] = await Promise.all([
      supabase.from("activity_logs").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
      supabase.from("products").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }),
      supabase.from("transactions").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }),
      supabase.from("custom_user_fees").select("*").eq("user_id", profile.user_id).maybeSingle(),
      supabase.from("balance_adjustments").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }),
      supabase.from("pix_keys").select("*").eq("user_id", profile.user_id),
    ]);
    if (logsRes.data) setUserLogs(logsRes.data as any);
    if (productsRes.data) setUserProducts(productsRes.data);
    if (wdRes.data) setUserWithdrawals(wdRes.data);
    if (txRes.data) setUserTransactions(txRes.data);
    if (adjRes.data) setBalanceAdjustments(adjRes.data);
    if (pixRes.data) setUserPixKeys(pixRes.data as PixKey[]);
    setSelectedAcquirerId((profile as any).acquirer_id || "");
    if (feesRes.data) {
      setCustomFees({
        transaction_percentage: feesRes.data.transaction_percentage?.toString() || "",
        transaction_fixed: feesRes.data.transaction_fixed?.toString() || "",
        withdrawal_fee: feesRes.data.withdrawal_fee?.toString() || "",
      });
    } else {
      setCustomFees({ transaction_percentage: "", transaction_fixed: "", withdrawal_fee: "" });
    }
    try {
      const { data: kycFiles } = await supabase.storage.from("kyc-documents").list(profile.user_id);
      if (kycFiles && kycFiles.length > 0) {
        const urls = kycFiles.map(f => supabase.storage.from("kyc-documents").getPublicUrl(`${profile.user_id}/${f.name}`).data.publicUrl);
        setKycImages(urls);
      } else setKycImages([]);
    } catch { setKycImages([]); }
    setLoading(false);
  };

  const handleUserStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("user_id", userId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Conta ${status === "approved" ? "aprovada" : "bloqueada"}!`);
    await logAdminAction(status === "approved" ? "approve_user" : "block_user", "profile", userId, { new_status: status });
    onReload();
  };

  const handleSetSellerType = async (userId: string, sellerType: string | null) => {
    const { error } = await supabase.from("profiles").update({ seller_type: sellerType } as any).eq("user_id", userId);
    if (error) { toast.error("Erro ao classificar seller"); return; }
    toast.success(`Seller classificado como ${sellerType || "sem classificação"}!`);
    await logAdminAction("set_seller_type", "profile", userId, { seller_type: sellerType });
    onReload();
  };

  const handleSetAcquirer = async (userId: string, acquirerId: string | null) => {
    const { error } = await supabase.from("profiles").update({ acquirer_id: acquirerId } as any).eq("user_id", userId);
    if (error) { toast.error("Erro ao definir adquirente"); return; }
    const acqName = acquirers.find(a => a.id === acquirerId)?.name || "Padrão";
    toast.success(`Adquirente definida: ${acqName}`);
    await logAdminAction("set_seller_acquirer", "profile", userId, { acquirer_id: acquirerId });
    setSelectedAcquirerId(acquirerId || "");
  };

  const handleSaveCustomFees = async () => {
    if (!selectedUser || !user) return;
    const payload = {
      user_id: selectedUser.user_id, admin_user_id: user.id,
      transaction_percentage: customFees.transaction_percentage ? Number(customFees.transaction_percentage) : null,
      transaction_fixed: customFees.transaction_fixed ? Number(customFees.transaction_fixed) : null,
      withdrawal_fee: customFees.withdrawal_fee ? Number(customFees.withdrawal_fee) : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("custom_user_fees").upsert(payload, { onConflict: "user_id" });
    if (error) { toast.error("Erro ao salvar taxas"); return; }
    toast.success("Taxas personalizadas salvas!");
    await logAdminAction("update_custom_fees", "custom_user_fees", selectedUser.user_id, payload);
  };

  const handleBalanceAdjustment = async () => {
    if (!selectedUser || !user || !adjustAmount || !adjustReason) { toast.error("Preencha todos os campos"); return; }
    const { error } = await supabase.from("balance_adjustments").insert({
      user_id: selectedUser.user_id, admin_user_id: user.id,
      amount: Number(adjustAmount), type: adjustType, reason: adjustReason,
    });
    if (error) { toast.error("Erro ao ajustar saldo"); return; }
    toast.success(`Saldo ${adjustType === "credit" ? "creditado" : "debitado"}!`);
    await logAdminAction(`balance_${adjustType}`, "balance_adjustment", selectedUser.user_id, { amount: adjustAmount, reason: adjustReason });
    setAdjustAmount(""); setAdjustReason("");
    const { data } = await supabase.from("balance_adjustments").select("*").eq("user_id", selectedUser.user_id).order("created_at", { ascending: false });
    if (data) setBalanceAdjustments(data);
  };

  // Filtering
  const filtered = profiles.filter((p) => {
    const st = (p as any).seller_type;
    if (sellerFilter === "white" && st !== "white") return false;
    if (sellerFilter === "black" && st !== "black") return false;
    if (sellerFilter === "unset" && st != null) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.full_name?.toLowerCase().includes(s)) || (p.email?.toLowerCase().includes(s)) || (p.document_number?.includes(s));
  });

  const whiteCount = profiles.filter(p => (p as any).seller_type === "white").length;
  const blackCount = profiles.filter(p => (p as any).seller_type === "black").length;
  const unsetCount = profiles.filter(p => (p as any).seller_type == null).length;

  // Seller financial helpers
  const getSellerStats = (userId: string) => {
    const txs = transactions.filter(t => t.user_id === userId);
    const completed = txs.filter(t => t.status === "completed" || t.status === "approved");
    const totalGross = completed.reduce((a, t) => a + Number(t.amount), 0);
    const totalNet = completed.reduce((a, t) => a + Number(t.net_amount), 0);
    const totalFees = completed.reduce((a, t) => a + Number(t.fee_amount), 0);
    const wds = withdrawals.filter(w => w.user_id === userId);
    const totalWithdrawn = wds.filter(w => w.status === "approved").reduce((a, w) => a + Number(w.amount), 0);
    const totalWdFees = wds.reduce((a, w) => a + Number(w.fee_amount), 0);
    const conversionRate = txs.length > 0 ? (completed.length / txs.length) * 100 : 0;
    return { totalGross, totalNet, totalFees, totalWithdrawn, totalWdFees, txCount: txs.length, completedCount: completed.length, conversionRate };
  };

  const deletedProducts = userLogs.filter(l => l.action === "product_deleted").map(l => ({
    id: l.entity_id, name: l.old_data?.name || "Desconhecido", price: l.old_data?.price || 0,
    deletedAt: l.created_at, data: l.old_data,
  }));

  const userApproved = userTransactions.filter(t => t.status === "approved" || t.status === "completed");
  const userTotalGross = userApproved.reduce((a, t) => a + Number(t.amount), 0);
  const userTotalNet = userApproved.reduce((a, t) => a + Number(t.net_amount), 0);
  const userTotalFees = userApproved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const userTotalWithdrawn = userWithdrawals.filter(w => w.status === "approved").reduce((a, w) => a + Number(w.amount), 0);
  const userTotalWdFees = userWithdrawals.reduce((a, w) => a + Number(w.fee_amount), 0);
  const userPendingWd = userWithdrawals.filter(w => w.status === "pending").reduce((a, w) => a + Number(w.amount), 0);
  const adjustmentsTotal = balanceAdjustments.reduce((a, adj) => a + (adj.type === "credit" ? Number(adj.amount) : -Number(adj.amount)), 0);
  const userAvailableBalance = userTotalNet - userTotalWithdrawn - userPendingWd + adjustmentsTotal;
  const userConversion = userTransactions.length > 0 ? ((userApproved.length / userTransactions.length) * 100).toFixed(1) : "0.0";

  const buyersMap = new Map<string, { name: string; email: string; phone: string; total: number; count: number }>();
  userTransactions.forEach(t => {
    const key = t.customer_email || t.customer_name || "unknown";
    const existing = buyersMap.get(key) || { name: t.customer_name || "", email: t.customer_email || "", phone: t.customer_phone || "", total: 0, count: 0 };
    existing.total += Number(t.amount); existing.count += 1;
    buyersMap.set(key, existing);
  });
  const buyers = Array.from(buyersMap.values()).sort((a, b) => b.total - a.total);

  const SellerTypeBadge = ({ type }: { type: string | null }) => {
    if (type === "black") return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">Black</span>;
    if (type === "white") return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-200/10 text-slate-300 border border-slate-500/20">White</span>;
    return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">Não classificado</span>;
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs + search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {[
            { id: "all" as const, label: "Todos", count: profiles.length },
            { id: "black" as const, label: "Black", count: blackCount },
            { id: "white" as const, label: "White", count: whiteCount },
            { id: "unset" as const, label: "Sem tipo", count: unsetCount },
          ].map(f => (
            <button key={f.id} onClick={() => setSellerFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                sellerFilter === f.id ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"
              }`}>
              {f.label} <span className="text-white/20 ml-1">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input placeholder="Buscar por nome, e-mail ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.12]" />
        </div>
      </div>

      {/* Table */}
      <AdminPanel>
        <PanelTitle color="blue" icon={<Users className="h-4 w-4" />}>Vendedores ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">{["Vendedor","Tipo","Transações","Receita Líq.","Lucro Taxas","Conversão","Status","Ações"].map(h=>(<th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>))}</tr></thead>
            <tbody>
              {filtered.map((p) => {
                const stats = getSellerStats(p.user_id);
                return (
                  <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center text-xs font-bold text-blue-400">{(p.full_name || "U")[0].toUpperCase()}</div>
                        <div><p className="text-xs font-bold text-white">{p.full_name || "Sem nome"}</p><p className="text-[10px] text-white/30">{p.email}</p></div>
                      </div>
                    </td>
                    <td className="p-3"><SellerTypeBadge type={(p as any).seller_type} /></td>
                    <td className="p-3 text-xs font-bold text-white/60">{stats.completedCount}/{stats.txCount}</td>
                    <td className="p-3 text-xs font-bold text-emerald-400">{fmtCurrency(stats.totalNet)}</td>
                    <td className="p-3 text-xs font-bold text-amber-400">{fmtCurrency(stats.totalFees)}</td>
                    <td className="p-3">
                      <span className={`text-xs font-bold ${stats.conversionRate >= 50 ? "text-emerald-400" : stats.conversionRate >= 20 ? "text-amber-400" : "text-red-400"}`}>
                        {stats.conversionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3"><StatusBadge status={p.account_status || "pending_review"} /></td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/40"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[hsl(228,18%,8%)] border-white/[0.08]">
                          <DropdownMenuItem className="gap-2 text-white/70" onClick={() => openUserDetail(p)}><Eye className="h-3.5 w-3.5" /> Ver detalhes</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-emerald-400" onClick={() => handleUserStatus(p.user_id, "approved")}><CheckCircle2 className="h-3.5 w-3.5" /> Aprovar</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-red-400" onClick={() => handleUserStatus(p.user_id, "blocked")}><Ban className="h-3.5 w-3.5" /> Bloquear</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-zinc-300" onClick={() => handleSetSellerType(p.user_id, "black")}><Shield className="h-3.5 w-3.5" /> Classificar Black</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-slate-300" onClick={() => handleSetSellerType(p.user_id, "white")}><Globe className="h-3.5 w-3.5" /> Classificar White</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-amber-400" onClick={() => handleSetSellerType(p.user_id, null)}><XCircle className="h-3.5 w-3.5" /> Remover tipo</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-white/20 text-xs">Nenhum vendedor</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {/* ═══ Seller Detail Dialog ═══ */}
      <Dialog open={!!selectedUser} onOpenChange={v => { if (!v) setSelectedUser(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-[hsl(228,18%,6%)] border-white/[0.06] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500/30 to-blue-500/10 flex items-center justify-center text-sm font-bold text-blue-400">{(selectedUser?.full_name || "U")[0].toUpperCase()}</div>
              <div>
                <div className="flex items-center gap-2">
                  <span>{selectedUser?.full_name || "Sem nome"}</span>
                  <SellerTypeBadge type={(selectedUser as any)?.seller_type} />
                </div>
                <p className="text-xs text-white/40 font-normal mt-0.5">{selectedUser?.email} • {selectedUser?.phone || "Sem telefone"}</p>
                <p className="text-[10px] text-white/20 font-mono mt-0.5">ID: {selectedUser?.user_id} • IP: {(selectedUser as any)?.last_ip || "N/A"}</p>
              </div>
              <div className="ml-auto flex gap-2">
                {selectedUser?.account_status !== "approved" && <Button size="sm" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs" onClick={() => { handleUserStatus(selectedUser!.user_id, "approved"); setSelectedUser(null); }}><CheckCircle2 className="h-3 w-3 mr-1" />Aprovar</Button>}
                {selectedUser?.account_status !== "blocked" && <Button size="sm" className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs" onClick={() => { handleUserStatus(selectedUser!.user_id, "blocked"); setSelectedUser(null); }}><Ban className="h-3 w-3 mr-1" />Bloquear</Button>}
              </div>
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-12 text-white/30">Carregando...</div>
          ) : (
            <>
              {/* Financial KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
                <MiniKpi label="Transacionou" value={fmtCurrency(userTotalGross)} color="blue" />
                <MiniKpi label="Receita Líquida" value={fmtCurrency(userTotalNet)} color="emerald" />
                <MiniKpi label="Lucro c/ Taxas" value={fmtCurrency(userTotalFees)} color="amber" />
                <MiniKpi label="Saldo Disponível" value={fmtCurrency(userAvailableBalance)} color="violet" />
                <MiniKpi label="Conversão" value={`${userConversion}%`} color="blue" />
              </div>

              {/* Secondary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                <MiniKpi label="Total Sacado" value={fmtCurrency(userTotalWithdrawn)} color="amber" />
                <MiniKpi label="Taxa Saque Paga" value={fmtCurrency(userTotalWdFees)} color="amber" />
                <MiniKpi label="Saque Pendente" value={fmtCurrency(userPendingWd)} color="blue" />
                <MiniKpi label="Clientes" value={String(buyers.length)} color="violet" />
              </div>

              <Tabs defaultValue="info" className="mt-4">
                <TabsList className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-1 flex-wrap h-auto gap-1">
                  {[
                    { v: "info", l: "Info & KYC", i: FileText },
                    { v: "pix", l: "Chaves PIX", i: Key },
                    { v: "acquirer", l: "Adquirente", i: Landmark },
                    { v: "financial", l: "Financeiro", i: Wallet },
                    { v: "products", l: "Produtos", i: Package },
                    { v: "buyers", l: "Clientes", i: ShoppingCart },
                    { v: "logs", l: "Logs", i: Activity },
                    { v: "fees", l: "Taxas", i: CreditCard },
                  ].map(t => (
                    <TabsTrigger key={t.v} value={t.v} className="gap-1.5 text-[11px] data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-white/40 rounded-lg">
                      <t.i className="h-3 w-3" />{t.l}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* ── Info & KYC ── */}
                <TabsContent value="info" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoRow label="Nome completo" value={selectedUser?.full_name} />
                    <InfoRow label="E-mail" value={selectedUser?.email} />
                    <InfoRow label="Telefone" value={selectedUser?.phone} />
                    <InfoRow label="Documento" value={selectedUser?.document_number} mono />
                    <InfoRow label="Tipo documento" value={selectedUser?.document_type} />
                    <InfoRow label="Status conta" value={selectedUser?.account_status} />
                    <InfoRow label="Tipo Seller" value={(selectedUser as any)?.seller_type || "Não classificado"} />
                    <InfoRow label="Último IP" value={(selectedUser as any)?.last_ip} mono />
                    <InfoRow label="Cadastro" value={selectedUser ? new Date(selectedUser.created_at).toLocaleString("pt-BR") : ""} />
                  </div>
                  {/* Classification buttons */}
                  <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
                    <p className="text-xs font-bold text-white/60 mb-3">Classificação do Seller</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xl text-xs" onClick={() => handleSetSellerType(selectedUser!.user_id, "black")}>
                        <Shield className="h-3 w-3 mr-1" /> Black
                      </Button>
                      <Button size="sm" className="bg-slate-200/10 text-slate-300 border border-slate-500/20 rounded-xl text-xs" onClick={() => handleSetSellerType(selectedUser!.user_id, "white")}>
                        <Globe className="h-3 w-3 mr-1" /> White
                      </Button>
                      <Button size="sm" variant="ghost" className="text-amber-400 text-xs" onClick={() => handleSetSellerType(selectedUser!.user_id, null)}>
                        <XCircle className="h-3 w-3 mr-1" /> Remover
                      </Button>
                    </div>
                  </div>
                  {kycImages.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-white/60 mb-2">Documentos KYC:</p>
                      <div className="grid grid-cols-3 gap-3">
                        {kycImages.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-white/[0.06] hover:border-white/[0.15] transition-colors">
                            <img src={url} alt={`KYC ${i+1}`} className="w-full h-40 object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {kycImages.length === 0 && <p className="text-xs text-white/20">Nenhum documento KYC enviado</p>}
                </TabsContent>

                {/* ── Chaves PIX ── */}
                <TabsContent value="pix" className="mt-4 space-y-4">
                  <AdminPanel>
                    <PanelTitle color="emerald" icon={<Key className="h-4 w-4" />}>Chaves PIX ({userPixKeys.length})</PanelTitle>
                    {userPixKeys.length === 0 ? (
                      <p className="text-xs text-white/20 text-center py-8 mt-4">Nenhuma chave PIX cadastrada</p>
                    ) : (
                      <div className="space-y-3 mt-4">
                        {userPixKeys.map(pk => (
                          <div key={pk.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                              <Key className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold uppercase text-white/60">{pk.key_type}</p>
                              <p className="text-sm font-mono text-white mt-0.5">{pk.key_value}</p>
                            </div>
                            <p className="text-[10px] text-white/20">{new Date(pk.created_at).toLocaleDateString("pt-BR")}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Also show legacy pix from profile */}
                    {selectedUser?.pix_key && (
                      <div className="mt-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-3">
                        <p className="text-[10px] text-amber-400 font-bold mb-1">PIX Legado (perfil)</p>
                        <p className="text-xs font-mono text-white/60">{selectedUser.pix_key_type}: {selectedUser.pix_key}</p>
                      </div>
                    )}
                  </AdminPanel>
                </TabsContent>

                {/* ── Adquirente ── */}
                <TabsContent value="acquirer" className="mt-4 space-y-4">
                  <AdminPanel>
                    <PanelTitle color="violet" icon={<Landmark className="h-4 w-4" />}>Adquirente Atribuída</PanelTitle>
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label className="text-[10px] text-white/40">Adquirente para este seller</Label>
                        <Select value={selectedAcquirerId} onValueChange={(v) => setSelectedAcquirerId(v)}>
                          <SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.06] text-xs mt-1"><SelectValue placeholder="Usar padrão da plataforma" /></SelectTrigger>
                          <SelectContent className="bg-[hsl(228,18%,8%)] border-white/[0.08]">
                            <SelectItem value="default">Padrão da plataforma</SelectItem>
                            {acquirers.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name} ({a.type.toUpperCase()})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs" onClick={() => handleSetAcquirer(selectedUser!.user_id, selectedAcquirerId === "default" ? null : selectedAcquirerId)}>
                        <Save className="h-3 w-3 mr-1" /> Salvar Adquirente
                      </Button>
                      {selectedAcquirerId && selectedAcquirerId !== "default" && (
                        <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                          <p className="text-xs text-white/40">Adquirente atual:</p>
                          <p className="text-sm font-bold mt-1">{acquirers.find(a => a.id === selectedAcquirerId)?.name || "—"}</p>
                          <p className="text-[10px] text-white/20 mt-0.5">Tipo: {acquirers.find(a => a.id === selectedAcquirerId)?.type?.toUpperCase()}</p>
                        </div>
                      )}
                    </div>
                  </AdminPanel>
                </TabsContent>

                {/* ── Financeiro ── */}
                <TabsContent value="financial" className="mt-4 space-y-4">
                  <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
                    <p className="text-xs font-bold text-white/60 mb-3 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Ajustar Saldo Manualmente</p>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <Label className="text-[10px] text-white/40">Tipo</Label>
                        <Select value={adjustType} onValueChange={(v: "credit" | "debit") => setAdjustType(v)}>
                          <SelectTrigger className="h-9 bg-white/[0.04] border-white/[0.06] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-[hsl(228,18%,8%)] border-white/[0.08]">
                            <SelectItem value="credit">Crédito (+)</SelectItem>
                            <SelectItem value="debit">Débito (-)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-white/40">Valor (R$)</Label>
                        <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="0.00"
                          className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] text-white/40">Motivo</Label>
                        <div className="flex gap-2">
                          <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Motivo do ajuste..."
                            className="flex-1 h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white" />
                          <Button size="sm" className="h-9 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs" onClick={handleBalanceAdjustment}>
                            <Save className="h-3 w-3 mr-1" /> Aplicar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {balanceAdjustments.length > 0 && (
                    <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
                      <p className="text-xs font-bold text-white/60 mb-3">Histórico de Ajustes</p>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {balanceAdjustments.map((adj: any) => (
                          <div key={adj.id} className="flex items-center justify-between text-[11px] py-2 border-b border-white/[0.03]">
                            <div>
                              <span className={adj.type === "credit" ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                                {adj.type === "credit" ? "+" : "-"} R$ {Number(adj.amount).toFixed(2)}
                              </span>
                              <span className="text-white/30 ml-2">{adj.reason}</span>
                            </div>
                            <span className="text-white/20">{new Date(adj.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
                    <p className="text-xs font-bold text-white/60 mb-3 flex items-center gap-1.5"><ArrowDownToLine className="h-3.5 w-3.5" /> Histórico de Saques ({userWithdrawals.length})</p>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {userWithdrawals.map(w => (
                        <div key={w.id} className="flex items-center justify-between text-[11px] py-2 border-b border-white/[0.03]">
                          <div className="flex items-center gap-3">
                            <StatusBadge status={w.status} />
                            <span className="font-bold">R$ {Number(w.amount).toFixed(2)}</span>
                            <span className="text-white/20">Taxa: R$ {Number(w.fee_amount).toFixed(2)}</span>
                          </div>
                          <span className="text-white/20">{new Date(w.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      ))}
                      {userWithdrawals.length === 0 && <p className="text-xs text-white/20 text-center py-4">Sem saques</p>}
                    </div>
                  </div>
                </TabsContent>

                {/* ── Produtos ── */}
                <TabsContent value="products" className="mt-4 space-y-4">
                  <p className="text-xs font-bold text-white/60 mb-2">Produtos Ativos ({userProducts.length})</p>
                  {userProducts.length === 0 ? <p className="text-xs text-white/20">Nenhum produto</p> : (
                    <div className="space-y-2">
                      {userProducts.map(p => (
                        <div key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex items-center gap-3">
                          {p.image_url && <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />}
                          <div className="flex-1"><p className="text-xs font-bold">{p.name}</p><p className="text-[10px] text-white/30">{p.description?.slice(0,60)||"—"}</p></div>
                          <div className="text-right"><p className="text-sm font-bold text-emerald-400">R$ {Number(p.price).toFixed(2)}</p><StatusBadge status={p.status} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {deletedProducts.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-red-400/60 mt-4 mb-2 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Produtos Excluídos ({deletedProducts.length})</p>
                      <div className="space-y-2">
                        {deletedProducts.map((dp, i) => (
                          <div key={i} className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-3">
                            <p className="text-xs font-bold text-red-400">{dp.name}</p>
                            <p className="text-[10px] text-white/30">Preço: R$ {Number(dp.price).toFixed(2)} • Excluído em {new Date(dp.deletedAt).toLocaleString("pt-BR")}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* ── Clientes ── */}
                <TabsContent value="buyers" className="mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-white/[0.04]">{["Cliente","E-mail","WhatsApp","Compras","Total"].map(h=>(<th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>))}</tr></thead>
                      <tbody>
                        {buyers.map((b, i) => (
                          <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                            <td className="p-3 text-xs font-bold">{b.name || "—"}</td>
                            <td className="p-3 text-[11px] text-white/40">{b.email || "—"}</td>
                            <td className="p-3 text-[11px] text-white/40">{b.phone || "—"}</td>
                            <td className="p-3"><span className="text-xs font-bold bg-white/[0.04] px-2 py-0.5 rounded">{b.count}</span></td>
                            <td className="p-3 text-xs font-bold text-emerald-400">{fmtCurrency(b.total)}</td>
                          </tr>
                        ))}
                        {buyers.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-white/20 text-xs">Nenhum cliente</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* ── Logs ── */}
                <TabsContent value="logs" className="mt-4">
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {userLogs.map(log => {
                      const meta = ACTION_LABELS[log.action] || { label: log.action, color: "text-white/40", icon: Activity };
                      const Icon = meta.icon;
                      return (
                        <div key={log.id} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 hover:bg-white/[0.03] transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={`h-7 w-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 ${meta.color}`}><Icon className="h-3.5 w-3.5" /></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`text-[11px] font-bold ${meta.color}`}>{meta.label}</span>
                                <span className="text-[10px] text-white/20">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                              </div>
                              {log.old_data && log.action.includes("deleted") && (
                                <div className="mt-2 rounded-lg bg-red-500/[0.05] border border-red-500/10 p-2 text-[10px]">
                                  {Object.entries(log.old_data).map(([k,v])=>(<div key={k}><span className="text-white/30">{k}:</span> <span className="text-white/60">{String(v)}</span></div>))}
                                </div>
                              )}
                              {log.old_data && log.new_data && log.action.includes("updated") && (
                                <div className="mt-2 rounded-lg bg-blue-500/[0.05] border border-blue-500/10 p-2 text-[10px] space-y-0.5">
                                  {Object.keys(log.new_data).map(k => {
                                    if (log.old_data![k] === log.new_data![k]) return null;
                                    return (<div key={k}><span className="text-white/30">{k}:</span> <span className="line-through text-red-400/50">{String(log.old_data![k]??"—")}</span> → <span className="text-emerald-400">{String(log.new_data![k]??"—")}</span></div>);
                                  })}
                                </div>
                              )}
                              {log.new_data && log.action.includes("created") && (
                                <div className="mt-2 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/10 p-2 text-[10px]">
                                  {Object.entries(log.new_data).map(([k,v])=>(<div key={k}><span className="text-white/30">{k}:</span> <span className="text-white/60">{String(v)}</span></div>))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {userLogs.length === 0 && <p className="text-xs text-white/20 text-center py-8">Sem logs</p>}
                  </div>
                </TabsContent>

                {/* ── Taxas ── */}
                <TabsContent value="fees" className="mt-4">
                  <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4 space-y-4">
                    <p className="text-xs font-bold text-white/60">Taxas personalizadas (deixe em branco para usar a taxa padrão)</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-[10px] text-white/40">Taxa por transação (%)</Label>
                        <input type="number" step="0.01" value={customFees.transaction_percentage} onChange={e => setCustomFees(p => ({ ...p, transaction_percentage: e.target.value }))}
                          placeholder="4.99" className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white mt-1" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-white/40">Taxa fixa por transação (R$)</Label>
                        <input type="number" step="0.01" value={customFees.transaction_fixed} onChange={e => setCustomFees(p => ({ ...p, transaction_fixed: e.target.value }))}
                          placeholder="2.50" className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white mt-1" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-white/40">Taxa de saque (R$)</Label>
                        <input type="number" step="0.01" value={customFees.withdrawal_fee} onChange={e => setCustomFees(p => ({ ...p, withdrawal_fee: e.target.value }))}
                          placeholder="5.00" className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-white mt-1" />
                      </div>
                    </div>
                    <Button size="sm" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs" onClick={handleSaveCustomFees}>
                      <Save className="h-3 w-3 mr-1" /> Salvar Taxas
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xs font-medium ${mono ? "font-mono" : ""} ${value ? "text-white" : "text-white/20"}`}>{value || "—"}</p>
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = { emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400", amber: "from-amber-500/20 to-amber-500/5 text-amber-400", blue: "from-blue-500/20 to-blue-500/5 text-blue-400", violet: "from-violet-500/20 to-violet-500/5 text-violet-400" };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${colors[color]} border border-white/[0.04] p-4`}>
      <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-extrabold mt-1">{value}</p>
    </div>
  );
}
