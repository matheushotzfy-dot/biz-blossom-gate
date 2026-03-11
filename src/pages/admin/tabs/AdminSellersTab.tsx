import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, Search, Ban, CheckCircle2, Eye, MoreHorizontal, Activity, Package,
  Trash2, Edit, Plus, Clock, Wallet, ArrowDownToLine, ShoppingCart,
  FileText, Globe, DollarSign, XCircle, Save, CreditCard, Shield, Landmark,
  Key, TrendingUp, Percent, BarChart3, MessageSquareText, AlertTriangle,
  Snowflake, LogIn, Lock, Unlock, UserX, Send,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
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

interface RetentionSettings {
  id?: string; user_id: string | null; pix_retention_pct: number; card_retention_pct: number; retention_days: number;
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
  const [sellerFilter, setSellerFilter] = useState<"all" | "white" | "black" | "unset" | "kyc">("all");
  const [selectedUser, setSelectedUser] = useState<Tables<"profiles"> | null>(null);
  const [userLogs, setUserLogs] = useState<ActivityLog[]>([]);
  const [userProducts, setUserProducts] = useState<Tables<"products">[]>([]);
  const [userWithdrawals, setUserWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [userTransactions, setUserTransactions] = useState<Tables<"transactions">[]>([]);
  const [userPixKeys, setUserPixKeys] = useState<PixKey[]>([]);
  const [customFees, setCustomFees] = useState({ transaction_percentage: "", transaction_fixed: "", withdrawal_fee: "", pix_percentage: "", boleto_percentage: "", card_percentage: "" });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustReason, setAdjustReason] = useState("");
  const [balanceAdjustments, setBalanceAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [kycImages, setKycImages] = useState<string[]>([]);
  const [acquirers, setAcquirers] = useState<Acquirer[]>([]);
  const [selectedAcquirerId, setSelectedAcquirerId] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState("");
  const [userDisputes, setUserDisputes] = useState<any[]>([]);
  const [kycRejectReason, setKycRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTargetUserId, setRejectTargetUserId] = useState<string>("");
  const [userRetention, setUserRetention] = useState<RetentionSettings | null>(null);
  const [retentionForm, setRetentionForm] = useState({ pix_pct: "", card_pct: "", days: "" });
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    supabase.from("acquirers").select("*").eq("is_active", true).then(({ data }) => {
      if (data) setAcquirers(data as Acquirer[]);
    });
  }, []);

  const openUserDetail = async (profile: Tables<"profiles">) => {
    setSelectedUser(profile);
    setLoading(true);
    const [logsRes, productsRes, wdRes, txRes, feesRes, adjRes, pixRes, disputesRes, retRes] = await Promise.all([
      supabase.from("activity_logs").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(100),
      supabase.from("products").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(100),
      supabase.from("withdrawals").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(100),
      supabase.from("transactions").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
      supabase.from("custom_user_fees").select("*").eq("user_id", profile.user_id).maybeSingle(),
      supabase.from("balance_adjustments").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(50),
      supabase.from("pix_keys").select("*").eq("user_id", profile.user_id),
      supabase.from("disputes").select("*").eq("seller_user_id", profile.user_id).order("created_at", { ascending: false }).limit(50),
      supabase.from("retention_settings").select("*").eq("user_id", profile.user_id).maybeSingle(),
    ]);
    if (logsRes.data) setUserLogs(logsRes.data as any);
    if (productsRes.data) setUserProducts(productsRes.data);
    if (wdRes.data) setUserWithdrawals(wdRes.data);
    if (txRes.data) setUserTransactions(txRes.data);
    if (adjRes.data) setBalanceAdjustments(adjRes.data);
    if (pixRes.data) setUserPixKeys(pixRes.data as PixKey[]);
    if (disputesRes.data) setUserDisputes(disputesRes.data as any[]);
    setSelectedAcquirerId(profile.acquirer_id || "");
    setAdminNotes((profile as any).admin_notes || "");
    if (retRes.data) {
      setUserRetention(retRes.data as any);
      setRetentionForm({
        pix_pct: String(retRes.data.pix_retention_pct ?? ""),
        card_pct: String(retRes.data.card_retention_pct ?? ""),
        days: String(retRes.data.retention_days ?? ""),
      });
    } else {
      setUserRetention(null);
      setRetentionForm({ pix_pct: "", card_pct: "", days: "" });
    }
    if (feesRes.data) {
      setCustomFees({
        transaction_percentage: feesRes.data.transaction_percentage?.toString() || "",
        transaction_fixed: feesRes.data.transaction_fixed?.toString() || "",
        withdrawal_fee: feesRes.data.withdrawal_fee?.toString() || "",
        pix_percentage: "", boleto_percentage: "", card_percentage: "",
      });
    } else {
      setCustomFees({ transaction_percentage: "", transaction_fixed: "", withdrawal_fee: "", pix_percentage: "", boleto_percentage: "", card_percentage: "" });
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

  // ── KYC Actions ──
  const handleApproveKyc = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: "approved", kyc_rejection_reason: null } as any).eq("user_id", userId);
    if (error) { toast.error("Erro ao aprovar KYC"); return; }
    toast.success("KYC aprovado! Seller liberado.");
    await logAdminAction("approve_kyc", "profile", userId);
    onReload();
    if (selectedUser?.user_id === userId) setSelectedUser(null);
  };

  const handleRejectKyc = async () => {
    if (!kycRejectReason.trim()) { toast.error("Informe o motivo da recusa"); return; }
    const { error } = await supabase.from("profiles").update({
      account_status: "rejected",
      kyc_rejection_reason: kycRejectReason.trim(),
    } as any).eq("user_id", rejectTargetUserId);
    if (error) { toast.error("Erro ao recusar KYC"); return; }
    toast.success("KYC recusado. Motivo registrado.");
    await logAdminAction("reject_kyc", "profile", rejectTargetUserId, { reason: kycRejectReason });
    setShowRejectDialog(false);
    setKycRejectReason("");
    onReload();
    if (selectedUser?.user_id === rejectTargetUserId) setSelectedUser(null);
  };

  // ── Balance Freeze ──
  const handleFreezeBalance = async (userId: string, freeze: boolean) => {
    const { error } = await supabase.from("profiles").update({ balance_frozen: freeze } as any).eq("user_id", userId);
    if (error) { toast.error("Erro ao alterar status"); return; }
    toast.success(freeze ? "🧊 Saldo congelado! Saques bloqueados." : "🔓 Saldo descongelado! Saques liberados.");
    await logAdminAction(freeze ? "freeze_balance" : "unfreeze_balance", "profile", userId);
    onReload();
  };

  // ── Ban Seller ──
  const handleBanSeller = async (userId: string) => {
    // Block account + freeze balance + suspend all products
    const [profileRes, productsRes] = await Promise.all([
      supabase.from("profiles").update({ account_status: "blocked", balance_frozen: true } as any).eq("user_id", userId),
      supabase.from("products").update({ status: "suspended" }).eq("user_id", userId),
    ]);
    if (profileRes.error || productsRes.error) { toast.error("Erro ao banir seller"); return; }
    toast.success("⛔ Seller banido! Conta bloqueada, saldo congelado e checkouts suspensos.");
    await logAdminAction("ban_seller", "profile", userId, { action: "block+freeze+suspend_products" });
    onReload();
    if (selectedUser?.user_id === userId) setSelectedUser(null);
  };

  // ── Impersonation ──
  const handleImpersonate = async (userId: string) => {
    setImpersonating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-impersonate", {
        body: { targetUserId: userId },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Erro ao acessar como usuário");
        return;
      }
      // Open dashboard in new tab with impersonation session
      const { access_token, refresh_token } = data;
      if (access_token && refresh_token) {
        // Store tokens securely in sessionStorage (not URL params) and open
        const impersonationData = JSON.stringify({ access_token, refresh_token, admin_id: user?.id, timestamp: Date.now() });
        // Use postMessage to new window instead of URL params
        const newWindow = window.open(window.location.origin + "/dashboard", "_blank");
        if (newWindow) {
          // Send tokens via postMessage after window loads (avoids URL/history leak)
          setTimeout(() => {
            newWindow.postMessage({ type: "IMPERSONATE_SESSION", ...JSON.parse(impersonationData) }, window.location.origin);
          }, 2000);
        }
        toast.success(`🎭 Abrindo dashboard como ${data.email}`);
      } else {
        toast.error("Tokens de impersonação não disponíveis");
      }
    } catch (e: any) {
      toast.error("Erro na impersonação");
    } finally {
      setImpersonating(false);
    }
  };

  // ── Rolling Reserve ──
  const handleSaveRetention = async () => {
    if (!selectedUser || !user) return;
    const payload = {
      user_id: selectedUser.user_id,
      pix_retention_pct: retentionForm.pix_pct ? Number(retentionForm.pix_pct) : 0,
      card_retention_pct: retentionForm.card_pct ? Number(retentionForm.card_pct) : 0,
      retention_days: retentionForm.days ? Number(retentionForm.days) : 14,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("retention_settings").upsert(payload, { onConflict: "user_id" });
    if (error) { toast.error("Erro ao salvar retenção"); return; }
    toast.success("Rolling Reserve atualizado!");
    await logAdminAction("update_retention", "retention_settings", selectedUser.user_id, payload);
  };

  const handleSaveAdminNotes = async () => {
    if (!selectedUser) return;
    const { error } = await supabase.from("profiles").update({ admin_notes: adminNotes } as any).eq("user_id", selectedUser.user_id);
    if (error) { toast.error("Erro ao salvar notas"); return; }
    toast.success("Observações salvas!");
    await logAdminAction("update_admin_notes", "profile", selectedUser.user_id, { notes: adminNotes });
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

  // ── Filtering ──
  const kycPendingProfiles = profiles.filter(p => p.account_status === "pending_review" || p.account_status === "pending");
  const filtered = profiles.filter((p) => {
    const st = (p as any).seller_type;
    if (sellerFilter === "kyc") return p.account_status === "pending_review" || p.account_status === "pending";
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

  const getSellerStats = (userId: string) => {
    const txs = transactions.filter(t => t.user_id === userId);
    const completed = txs.filter(t => t.status === "completed" || t.status === "approved");
    const totalGross = completed.reduce((a, t) => a + Number(t.amount), 0);
    const totalNet = completed.reduce((a, t) => a + Number(t.net_amount), 0);
    const totalFees = completed.reduce((a, t) => a + Number(t.fee_amount), 0);
    const wds = withdrawals.filter(w => w.user_id === userId);
    const totalWithdrawn = wds.filter(w => w.status === "approved").reduce((a, w) => a + Number(w.amount), 0);
    const conversionRate = txs.length > 0 ? (completed.length / txs.length) * 100 : 0;
    return { totalGross, totalNet, totalFees, totalWithdrawn, txCount: txs.length, completedCount: completed.length, conversionRate };
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

  const userMedTotal = userDisputes.length;
  const userMedOpen = userDisputes.filter(d => d.status === "open" || d.status === "in_review").length;
  const userMedResolved = userDisputes.filter(d => d.status.startsWith("resolved") || d.status === "closed").length;
  const userMedAmount = userDisputes.reduce((a: number, d: any) => a + Number(d.amount || 0), 0);
  const userMedRate = userApproved.length > 0 ? ((userMedTotal / userApproved.length) * 100).toFixed(2) : "0.00";

  const buyersMap = new Map<string, { name: string; email: string; phone: string; total: number; count: number }>();
  userTransactions.forEach(t => {
    const key = t.customer_email || t.customer_name || "unknown";
    const existing = buyersMap.get(key) || { name: t.customer_name || "", email: t.customer_email || "", phone: t.customer_phone || "", total: 0, count: 0 };
    existing.total += Number(t.amount); existing.count += 1;
    buyersMap.set(key, existing);
  });
  const buyers = Array.from(buyersMap.values()).sort((a, b) => b.total - a.total);

  const isFrozen = (p: Tables<"profiles">) => (p as any).balance_frozen === true;

  const SellerTypeBadge = ({ type }: { type: string | null }) => {
    if (type === "black") return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-muted text-muted-foreground border border-border">Black</span>;
    if (type === "white") return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-secondary text-secondary-foreground border border-border">White</span>;
    return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-warning/10 text-warning border border-warning/20">Não classificado</span>;
  };

  return (
    <div className="space-y-4">
      {/* ── KYC Alert Banner ── */}
      {kycPendingProfiles.length > 0 && sellerFilter !== "kyc" && (
        <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{kycPendingProfiles.length} sellers aguardando aprovação KYC</p>
              <p className="text-xs text-muted-foreground">Documentos pendentes de revisão</p>
            </div>
          </div>
          <Button size="sm" className="bg-warning/10 text-warning border border-warning/20 rounded-xl text-xs" onClick={() => setSellerFilter("kyc")}>
            Ver Fila KYC
          </Button>
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
          {[
            { id: "all" as const, label: "Todos", count: profiles.length },
            { id: "kyc" as const, label: "🔍 Fila KYC", count: kycPendingProfiles.length },
            { id: "black" as const, label: "Black", count: blackCount },
            { id: "white" as const, label: "White", count: whiteCount },
            { id: "unset" as const, label: "Sem tipo", count: unsetCount },
          ].map(f => (
            <button key={f.id} onClick={() => setSellerFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                sellerFilter === f.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}>
              {f.label} <span className="text-muted-foreground/50 ml-1">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar por nome, e-mail ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
        </div>
      </div>

      {/* ── KYC Queue Mode ── */}
      {sellerFilter === "kyc" ? (
        <AdminPanel>
          <PanelTitle color="amber" icon={<FileText className="h-4 w-4" />}>Fila de Aprovação KYC ({filtered.length})</PanelTitle>
          <div className="space-y-3 mt-4">
            {filtered.map(p => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {(p.full_name || "U")[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{p.full_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{p.email} • {p.phone || "Sem tel"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground font-mono">{p.document_type?.toUpperCase()}: {p.document_number || "N/A"}</span>
                    <span className="text-[10px] text-muted-foreground">• Cadastro: {new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => openUserDetail(p)}>
                    <Eye className="h-3 w-3 mr-1" /> Detalhes
                  </Button>
                  <Button size="sm" className="bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs" onClick={() => handleApproveKyc(p.user_id)}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar KYC
                  </Button>
                  <Button size="sm" className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-xs"
                    onClick={() => { setRejectTargetUserId(p.user_id); setShowRejectDialog(true); }}>
                    <XCircle className="h-3 w-3 mr-1" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle2 className="h-8 w-8 text-primary/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum KYC pendente 🎉</p>
              </div>
            )}
          </div>
        </AdminPanel>
      ) : (
        /* ── Sellers Table ── */
        <AdminPanel>
          <PanelTitle color="blue" icon={<Users className="h-4 w-4" />}>Vendedores ({filtered.length})</PanelTitle>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">{["Vendedor","Tipo","Status","Saldo","Transações","Conversão","Ações"].map(h=>(<th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>))}</tr></thead>
              <tbody>
                {filtered.map((p) => {
                  const stats = getSellerStats(p.user_id);
                  const frozen = isFrozen(p);
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{(p.full_name || "U")[0].toUpperCase()}</div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-foreground">{p.full_name || "Sem nome"}</p>
                              {frozen && <span title="Saldo Congelado"><Snowflake className="h-3 w-3 text-info" /></span>}
                            </div>
                            <p className="text-[10px] text-muted-foreground">{p.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3"><SellerTypeBadge type={(p as any).seller_type} /></td>
                      <td className="p-3"><StatusBadge status={p.account_status || "pending_review"} /></td>
                      <td className="p-3 text-xs font-bold text-primary">{fmtCurrency(stats.totalNet - stats.totalWithdrawn)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{stats.completedCount}/{stats.txCount}</td>
                      <td className="p-3">
                        <span className={`text-xs font-bold ${stats.conversionRate >= 50 ? "text-primary" : stats.conversionRate >= 20 ? "text-warning" : "text-destructive"}`}>
                          {stats.conversionRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem className="gap-2" onClick={() => openUserDetail(p)}><Eye className="h-3.5 w-3.5" /> Ver detalhes</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onClick={() => handleImpersonate(p.user_id)} disabled={impersonating}>
                              <LogIn className="h-3.5 w-3.5" /> Login as User
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 text-primary" onClick={() => handleApproveKyc(p.user_id)}><CheckCircle2 className="h-3.5 w-3.5" /> Aprovar KYC</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-warning" onClick={() => { setRejectTargetUserId(p.user_id); setShowRejectDialog(true); }}>
                              <XCircle className="h-3.5 w-3.5" /> Recusar KYC
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {frozen ? (
                              <DropdownMenuItem className="gap-2 text-info" onClick={() => handleFreezeBalance(p.user_id, false)}><Unlock className="h-3.5 w-3.5" /> Descongelar Saldo</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="gap-2 text-info" onClick={() => handleFreezeBalance(p.user_id, true)}><Snowflake className="h-3.5 w-3.5" /> Congelar Saldo</DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleBanSeller(p.user_id)}><UserX className="h-3.5 w-3.5" /> Banir Seller</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2" onClick={() => handleSetSellerType(p.user_id, "black")}><Shield className="h-3.5 w-3.5" /> Black</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onClick={() => handleSetSellerType(p.user_id, "white")}><Globe className="h-3.5 w-3.5" /> White</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground text-xs">Nenhum vendedor</td></tr>}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      )}

      {/* ═══ KYC Reject Dialog ═══ */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> Recusar KYC
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Informe o motivo da recusa. O seller será notificado.</p>
            <textarea value={kycRejectReason} onChange={e => setKycRejectReason(e.target.value)} rows={4}
              placeholder="Ex: Documento ilegível, foto cortada, nome divergente..."
              className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30 resize-none" />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowRejectDialog(false)}>Cancelar</Button>
              <Button size="sm" className="bg-destructive text-destructive-foreground rounded-xl" onClick={handleRejectKyc}>
                <Send className="h-3 w-3 mr-1" /> Enviar Recusa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Seller Detail Dialog ═══ */}
      <Dialog open={!!selectedUser} onOpenChange={v => { if (!v) setSelectedUser(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{(selectedUser?.full_name || "U")[0].toUpperCase()}</div>
              <div>
                <div className="flex items-center gap-2">
                  <span>{selectedUser?.full_name || "Sem nome"}</span>
                  <SellerTypeBadge type={(selectedUser as any)?.seller_type} />
                  {selectedUser && isFrozen(selectedUser) && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-info/10 text-info border border-info/20 flex items-center gap-1">
                      <Snowflake className="h-2.5 w-2.5" /> Congelado
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">{selectedUser?.email} • {selectedUser?.phone || "Sem telefone"}</p>
                <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">ID: {selectedUser?.user_id} • IP: {(selectedUser as any)?.last_ip || "N/A"}</p>
              </div>
              <div className="ml-auto flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => selectedUser && handleImpersonate(selectedUser.user_id)} disabled={impersonating}>
                  <LogIn className="h-3 w-3 mr-1" /> Login as User
                </Button>
                {selectedUser && !isFrozen(selectedUser) ? (
                  <Button size="sm" className="bg-info/10 text-info border border-info/20 rounded-xl text-xs" onClick={() => handleFreezeBalance(selectedUser.user_id, true)}>
                    <Snowflake className="h-3 w-3 mr-1" /> Congelar
                  </Button>
                ) : selectedUser && (
                  <Button size="sm" className="bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs" onClick={() => handleFreezeBalance(selectedUser.user_id, false)}>
                    <Unlock className="h-3 w-3 mr-1" /> Descongelar
                  </Button>
                )}
                {selectedUser?.account_status !== "approved" && (
                  <Button size="sm" className="bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs" onClick={() => { handleApproveKyc(selectedUser!.user_id); }}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                  </Button>
                )}
                <Button size="sm" className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-xs" onClick={() => selectedUser && handleBanSeller(selectedUser.user_id)}>
                  <UserX className="h-3 w-3 mr-1" /> Banir
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
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
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-2">
                <MiniKpi label="Total Sacado" value={fmtCurrency(userTotalWithdrawn)} color="amber" />
                <MiniKpi label="Taxa Saque Paga" value={fmtCurrency(userTotalWdFees)} color="amber" />
                <MiniKpi label="Saque Pendente" value={fmtCurrency(userPendingWd)} color="blue" />
                <MiniKpi label="Clientes" value={String(buyers.length)} color="violet" />
                <MiniKpi label={`Disputas (${userMedRate}%)`} value={`${userMedTotal} (${fmtCurrency(userMedAmount)})`} color="amber" />
              </div>

              <Tabs defaultValue="info" className="mt-4">
                <TabsList className="bg-muted/30 border border-border rounded-xl p-1 flex-wrap h-auto gap-1">
                  {[
                    { v: "info", l: "Info & KYC", i: FileText },
                    { v: "notes", l: "Observações", i: MessageSquareText },
                    { v: "retention", l: "Rolling Reserve", i: Lock },
                    { v: "compliance", l: "Compliance", i: Shield },
                    { v: "disputes", l: `Disputas (${userMedTotal})`, i: AlertTriangle },
                    { v: "pix", l: "Chaves PIX", i: Key },
                    { v: "acquirer", l: "Adquirente", i: Landmark },
                    { v: "financial", l: "Financeiro", i: Wallet },
                    { v: "buyers", l: "Clientes", i: ShoppingCart },
                    { v: "logs", l: "Logs", i: Activity },
                    { v: "fees", l: "Taxas", i: CreditCard },
                  ].map(t => (
                    <TabsTrigger key={t.v} value={t.v} className="gap-1.5 text-[11px] rounded-lg">
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
                    <InfoRow label="Saldo Congelado" value={selectedUser && isFrozen(selectedUser) ? "SIM" : "NÃO"} />
                  </div>
                  {(selectedUser as any)?.kyc_rejection_reason && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                      <p className="text-xs font-bold text-destructive mb-1">Motivo da última recusa KYC:</p>
                      <p className="text-sm text-foreground">{(selectedUser as any).kyc_rejection_reason}</p>
                    </div>
                  )}
                  <div className="bg-muted/20 rounded-xl border border-border p-4">
                    <p className="text-xs font-bold text-muted-foreground mb-3">Classificação do Seller</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => handleSetSellerType(selectedUser!.user_id, "black")}>
                        <Shield className="h-3 w-3 mr-1" /> Black
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => handleSetSellerType(selectedUser!.user_id, "white")}>
                        <Globe className="h-3 w-3 mr-1" /> White
                      </Button>
                      <Button size="sm" variant="ghost" className="text-warning text-xs" onClick={() => handleSetSellerType(selectedUser!.user_id, null)}>
                        <XCircle className="h-3 w-3 mr-1" /> Remover
                      </Button>
                    </div>
                  </div>
                  {kycImages.length > 0 ? (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground mb-2">Documentos KYC:</p>
                      <div className="grid grid-cols-3 gap-3">
                        {kycImages.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-colors">
                            <img src={url} alt={`KYC ${i+1}`} className="w-full h-40 object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : <p className="text-xs text-muted-foreground">Nenhum documento KYC enviado</p>}
                </TabsContent>

                {/* ── Observações Admin ── */}
                <TabsContent value="notes" className="mt-4 space-y-4">
                  <AdminPanel>
                    <PanelTitle color="violet" icon={<MessageSquareText className="h-4 w-4" />}>Observações sobre o Seller</PanelTitle>
                    <div className="mt-4 space-y-3">
                      <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={8}
                        placeholder="Escreva observações, anotações internas, histórico de comunicação..."
                        className="w-full px-4 py-3 bg-muted/20 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30 resize-none" />
                      <Button size="sm" className="bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs" onClick={handleSaveAdminNotes}>
                        <Save className="h-3 w-3 mr-1" /> Salvar Observações
                      </Button>
                    </div>
                  </AdminPanel>
                </TabsContent>

                {/* ── Rolling Reserve ── */}
                <TabsContent value="retention" className="mt-4 space-y-4">
                  <AdminPanel>
                    <PanelTitle color="amber" icon={<Lock className="h-4 w-4" />}>Rolling Reserve (Retenção de Segurança)</PanelTitle>
                    <p className="text-xs text-muted-foreground mt-2 mb-4">
                      Configure o percentual do saldo retido para cobrir chargebacks. Deixe em branco para usar a configuração global.
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Retenção PIX (%)</Label>
                        <input type="number" step="0.1" min="0" max="100" value={retentionForm.pix_pct}
                          onChange={e => setRetentionForm(p => ({ ...p, pix_pct: e.target.value }))}
                          placeholder="0" className="w-full h-9 px-3 bg-muted/20 border border-border rounded-md text-xs text-foreground mt-1" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Retenção Cartão (%)</Label>
                        <input type="number" step="0.1" min="0" max="100" value={retentionForm.card_pct}
                          onChange={e => setRetentionForm(p => ({ ...p, card_pct: e.target.value }))}
                          placeholder="5" className="w-full h-9 px-3 bg-muted/20 border border-border rounded-md text-xs text-foreground mt-1" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Dias de Retenção</Label>
                        <input type="number" min="1" max="365" value={retentionForm.days}
                          onChange={e => setRetentionForm(p => ({ ...p, days: e.target.value }))}
                          placeholder="14" className="w-full h-9 px-3 bg-muted/20 border border-border rounded-md text-xs text-foreground mt-1" />
                      </div>
                    </div>
                    {userRetention && (
                      <div className="mt-3 rounded-lg border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
                        Configuração atual: PIX {userRetention.pix_retention_pct}% | Cartão {userRetention.card_retention_pct}% | {userRetention.retention_days} dias
                      </div>
                    )}
                    <Button size="sm" className="bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs mt-4" onClick={handleSaveRetention}>
                      <Save className="h-3 w-3 mr-1" /> Salvar Rolling Reserve
                    </Button>
                  </AdminPanel>
                </TabsContent>

                {/* ── Disputas do Seller ── */}
                <TabsContent value="disputes" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <MiniKpi label="Total Disputas" value={String(userMedTotal)} color="amber" />
                    <MiniKpi label="Abertas" value={String(userMedOpen)} color="amber" />
                    <MiniKpi label="Resolvidas" value={String(userMedResolved)} color="emerald" />
                    <MiniKpi label="Valor Total" value={fmtCurrency(userMedAmount)} color="amber" />
                    <MiniKpi label="Taxa Med (%)" value={`${userMedRate}%`} color="blue" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "MedPix", count: userDisputes.filter((d: any) => d.type === "medpix").length, amount: userDisputes.filter((d: any) => d.type === "medpix").reduce((a: number, d: any) => a + Number(d.amount || 0), 0), color: "text-warning" },
                      { label: "Pre-Med PIX", count: userDisputes.filter((d: any) => d.type === "pre_med_pix").length, amount: userDisputes.filter((d: any) => d.type === "pre_med_pix").reduce((a: number, d: any) => a + Number(d.amount || 0), 0), color: "text-warning" },
                      { label: "Reembolso", count: userDisputes.filter((d: any) => d.type === "refund").length, amount: userDisputes.filter((d: any) => d.type === "refund").reduce((a: number, d: any) => a + Number(d.amount || 0), 0), color: "text-destructive" },
                    ].map(dt => (
                      <div key={dt.label} className="bg-muted/20 rounded-xl border border-border p-4 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{dt.label}</p>
                        <p className={`text-xl font-black mt-1 ${dt.color}`}>{dt.count}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{fmtCurrency(dt.amount)}</p>
                      </div>
                    ))}
                  </div>
                  <AdminPanel>
                    <PanelTitle color="amber" icon={<AlertTriangle className="h-4 w-4" />}>Histórico de Disputas</PanelTitle>
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border">{["Tipo","Valor","Status","Comprador","Motivo","Data"].map(h=>(<th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>))}</tr></thead>
                        <tbody>
                          {userDisputes.map((d: any) => (
                            <tr key={d.id} className="border-b border-border hover:bg-muted/20">
                              <td className="p-3 text-[10px] font-bold uppercase">{d.type}</td>
                              <td className="p-3 text-xs font-bold text-warning">{fmtCurrency(Number(d.amount))}</td>
                              <td className="p-3"><StatusBadge status={d.status} /></td>
                              <td className="p-3 text-xs">{d.buyer_name || "—"}</td>
                              <td className="p-3 text-[11px] text-muted-foreground max-w-[200px] truncate">{d.reason || "—"}</td>
                              <td className="p-3 text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")}</td>
                            </tr>
                          ))}
                          {userDisputes.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">Sem disputas</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </AdminPanel>
                </TabsContent>

                {/* ── Chaves PIX ── */}
                <TabsContent value="pix" className="mt-4 space-y-4">
                  <AdminPanel>
                    <PanelTitle color="emerald" icon={<Key className="h-4 w-4" />}>Chaves PIX ({userPixKeys.length})</PanelTitle>
                    {userPixKeys.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8 mt-4">Nenhuma chave PIX cadastrada</p>
                    ) : (
                      <div className="space-y-3 mt-4">
                        {userPixKeys.map(pk => (
                          <div key={pk.id} className="rounded-xl border border-border bg-muted/10 p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Key className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold uppercase text-muted-foreground">{pk.key_type}</p>
                              <p className="text-sm font-mono text-foreground mt-0.5">{pk.key_value}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{new Date(pk.created_at).toLocaleDateString("pt-BR")}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedUser?.pix_key && (
                      <div className="mt-4 rounded-xl border border-warning/10 bg-warning/5 p-3">
                        <p className="text-[10px] text-warning font-bold mb-1">PIX Legado (perfil)</p>
                        <p className="text-xs font-mono text-muted-foreground">{selectedUser.pix_key_type}: {selectedUser.pix_key}</p>
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
                        <Label className="text-[10px] text-muted-foreground">Adquirente para este seller</Label>
                        <Select value={selectedAcquirerId} onValueChange={(v) => setSelectedAcquirerId(v)}>
                          <SelectTrigger className="h-10 text-xs mt-1"><SelectValue placeholder="Usar padrão da plataforma" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Padrão da plataforma</SelectItem>
                            {acquirers.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.name} ({a.type.toUpperCase()})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" className="bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs" onClick={() => handleSetAcquirer(selectedUser!.user_id, selectedAcquirerId === "default" ? null : selectedAcquirerId)}>
                        <Save className="h-3 w-3 mr-1" /> Salvar Adquirente
                      </Button>
                    </div>
                  </AdminPanel>
                </TabsContent>

                {/* ── Financeiro ── */}
                <TabsContent value="financial" className="mt-4 space-y-4">
                  <div className="bg-muted/20 rounded-xl border border-border p-4">
                    <p className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Ajustar Saldo Manualmente</p>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                        <Select value={adjustType} onValueChange={(v: "credit" | "debit") => setAdjustType(v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="credit">Crédito (+)</SelectItem>
                            <SelectItem value="debit">Débito (-)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                        <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="0.00"
                          className="w-full h-9 px-3 bg-muted/20 border border-border rounded-md text-xs text-foreground" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Motivo (obrigatório)</Label>
                        <div className="flex gap-2">
                          <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Motivo do ajuste..."
                            className="flex-1 h-9 px-3 bg-muted/20 border border-border rounded-md text-xs text-foreground" />
                          <Button size="sm" className="h-9 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs" onClick={handleBalanceAdjustment}>
                            <Save className="h-3 w-3 mr-1" /> Aplicar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {balanceAdjustments.length > 0 && (
                    <div className="bg-muted/20 rounded-xl border border-border p-4">
                      <p className="text-xs font-bold text-muted-foreground mb-3">Histórico de Ajustes</p>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {balanceAdjustments.map((adj: any) => (
                          <div key={adj.id} className="flex items-center justify-between text-[11px] py-2 border-b border-border">
                            <div>
                              <span className={adj.type === "credit" ? "text-primary font-bold" : "text-destructive font-bold"}>
                                {adj.type === "credit" ? "+" : "-"} R$ {Number(adj.amount).toFixed(2)}
                              </span>
                              <span className="text-muted-foreground ml-2">{adj.reason}</span>
                            </div>
                            <span className="text-muted-foreground">{new Date(adj.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="bg-muted/20 rounded-xl border border-border p-4">
                    <p className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5"><ArrowDownToLine className="h-3.5 w-3.5" /> Histórico de Saques ({userWithdrawals.length})</p>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {userWithdrawals.map(w => (
                        <div key={w.id} className="flex items-center justify-between text-[11px] py-2 border-b border-border">
                          <div className="flex items-center gap-3">
                            <StatusBadge status={w.status} />
                            <span className="font-bold">R$ {Number(w.amount).toFixed(2)}</span>
                            <span className="text-muted-foreground">Taxa: R$ {Number(w.fee_amount).toFixed(2)}</span>
                          </div>
                          <span className="text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      ))}
                      {userWithdrawals.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem saques</p>}
                    </div>
                  </div>
                </TabsContent>

                {/* ── Compliance ── */}
                <TabsContent value="compliance" className="mt-4 space-y-5">
                  <AdminPanel>
                    <PanelTitle color="emerald" icon={<Package className="h-4 w-4" />}>Produtos Ativos ({userProducts.length})</PanelTitle>
                    <div className="space-y-3 mt-4">
                      {userProducts.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhum produto ativo</p>}
                      {userProducts.map(p => {
                        const prodTxs = userTransactions.filter(t => t.product_id === p.id);
                        const prodApproved = prodTxs.filter(t => t.status === "completed" || t.status === "approved");
                        const prodGross = prodApproved.reduce((a, t) => a + Number(t.amount), 0);
                        const prodNet = prodApproved.reduce((a, t) => a + Number(t.net_amount), 0);
                        const prodFees = prodApproved.reduce((a, t) => a + Number(t.fee_amount), 0);
                        const prodRefunds = prodTxs.filter(t => t.status === "refunded").length;
                        const prodChargebacks = prodTxs.filter(t => t.status === "chargeback").length;
                        return (
                          <div key={p.id} className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              {p.image_url && <img src={p.image_url} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold">{p.name}</p>
                                  <StatusBadge status={p.status} />
                                </div>
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {p.id}</p>
                              </div>
                              <p className="text-lg font-black text-primary">R$ {Number(p.price).toFixed(2)}</p>
                            </div>
                            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                              {[
                                { l: "Vendas", v: String(prodApproved.length), c: "text-primary" },
                                { l: "Bruto", v: fmtCurrency(prodGross), c: "text-info" },
                                { l: "Líquido", v: fmtCurrency(prodNet), c: "text-primary" },
                                { l: "Taxas", v: fmtCurrency(prodFees), c: "text-warning" },
                                { l: "Estornos", v: String(prodRefunds), c: "text-destructive" },
                                { l: "Chargebacks", v: String(prodChargebacks), c: "text-destructive" },
                              ].map(k => (
                                <div key={k.l} className="bg-muted/20 rounded-lg p-2 text-center">
                                  <p className="text-[9px] text-muted-foreground uppercase">{k.l}</p>
                                  <p className={`text-xs font-black mt-0.5 ${k.c}`}>{k.v}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AdminPanel>

                  {deletedProducts.length > 0 && (
                    <AdminPanel>
                      <PanelTitle color="red" icon={<Trash2 className="h-4 w-4" />}>Produtos Excluídos ({deletedProducts.length})</PanelTitle>
                      <div className="space-y-2 mt-4">
                        {deletedProducts.map((dp, i) => (
                          <div key={i} className="rounded-xl border border-destructive/10 bg-destructive/5 p-3">
                            <p className="text-sm font-bold text-destructive">{dp.name}</p>
                            <p className="text-[10px] text-muted-foreground">Preço: R$ {Number(dp.price).toFixed(2)} • Excluído em {new Date(dp.deletedAt).toLocaleString("pt-BR")}</p>
                          </div>
                        ))}
                      </div>
                    </AdminPanel>
                  )}

                  <AdminPanel>
                    <PanelTitle color="blue" icon={<BarChart3 className="h-4 w-4" />}>Resumo de Compliance</PanelTitle>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                      <MiniKpi label="Produtos Ativos" value={String(userProducts.length)} color="emerald" />
                      <MiniKpi label="Produtos Excluídos" value={String(deletedProducts.length)} color="amber" />
                      <MiniKpi label="Transações Totais" value={String(userTransactions.length)} color="blue" />
                      <MiniKpi label="Taxa Estorno" value={`${userTransactions.length > 0 ? ((userTransactions.filter(t => t.status === "refunded" || t.status === "chargeback").length / userTransactions.length) * 100).toFixed(2) : "0.00"}%`} color="amber" />
                    </div>
                  </AdminPanel>
                </TabsContent>

                {/* ── Clientes ── */}
                <TabsContent value="buyers" className="mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border">{["Cliente","E-mail","WhatsApp","Compras","Total"].map(h=>(<th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>))}</tr></thead>
                      <tbody>
                        {buyers.map((b, i) => (
                          <tr key={i} className="border-b border-border hover:bg-muted/20">
                            <td className="p-3 text-xs font-bold">{b.name || "—"}</td>
                            <td className="p-3 text-[11px] text-muted-foreground">{b.email || "—"}</td>
                            <td className="p-3 text-[11px] text-muted-foreground">{b.phone || "—"}</td>
                            <td className="p-3"><span className="text-xs font-bold bg-muted/30 px-2 py-0.5 rounded">{b.count}</span></td>
                            <td className="p-3 text-xs font-bold text-primary">{fmtCurrency(b.total)}</td>
                          </tr>
                        ))}
                        {buyers.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-xs">Nenhum cliente</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* ── Logs ── */}
                <TabsContent value="logs" className="mt-4">
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {userLogs.map(log => {
                      const meta = ACTION_LABELS[log.action] || { label: log.action, color: "text-muted-foreground", icon: Activity };
                      const Icon = meta.icon;
                      return (
                        <div key={log.id} className="rounded-xl border border-border bg-muted/10 p-3 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={`h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 ${meta.color}`}><Icon className="h-3.5 w-3.5" /></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`text-[11px] font-bold ${meta.color}`}>{meta.label}</span>
                                <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                              </div>
                              {log.old_data && log.action.includes("deleted") && (
                                <div className="mt-2 rounded-lg bg-destructive/5 border border-destructive/10 p-2 text-[10px]">
                                  {Object.entries(log.old_data).map(([k,v])=>(<div key={k}><span className="text-muted-foreground">{k}:</span> <span className="text-foreground">{String(v)}</span></div>))}
                                </div>
                              )}
                              {log.old_data && log.new_data && log.action.includes("updated") && (
                                <div className="mt-2 rounded-lg bg-info/5 border border-info/10 p-2 text-[10px] space-y-0.5">
                                  {Object.keys(log.new_data).map(k => {
                                    if (log.old_data![k] === log.new_data![k]) return null;
                                    return (<div key={k}><span className="text-muted-foreground">{k}:</span> <span className="line-through text-destructive/50">{String(log.old_data![k]??"—")}</span> → <span className="text-primary">{String(log.new_data![k]??"—")}</span></div>);
                                  })}
                                </div>
                              )}
                              {log.new_data && log.action.includes("created") && (
                                <div className="mt-2 rounded-lg bg-primary/5 border border-primary/10 p-2 text-[10px]">
                                  {Object.entries(log.new_data).map(([k,v])=>(<div key={k}><span className="text-muted-foreground">{k}:</span> <span className="text-foreground">{String(v)}</span></div>))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {userLogs.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Sem logs</p>}
                  </div>
                </TabsContent>

                {/* ── Taxas Customizadas ── */}
                <TabsContent value="fees" className="mt-4">
                  <div className="bg-muted/20 rounded-xl border border-border p-4 space-y-4">
                    <p className="text-xs font-bold text-muted-foreground">Taxas personalizadas (deixe em branco para usar a taxa padrão)</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Taxa por transação (%)</Label>
                        <input type="number" step="0.01" value={customFees.transaction_percentage} onChange={e => setCustomFees(p => ({ ...p, transaction_percentage: e.target.value }))}
                          placeholder="4.99" className="w-full h-9 px-3 bg-muted/20 border border-border rounded-md text-xs text-foreground mt-1" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Taxa fixa por transação (R$)</Label>
                        <input type="number" step="0.01" value={customFees.transaction_fixed} onChange={e => setCustomFees(p => ({ ...p, transaction_fixed: e.target.value }))}
                          placeholder="2.50" className="w-full h-9 px-3 bg-muted/20 border border-border rounded-md text-xs text-foreground mt-1" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Taxa de saque (R$)</Label>
                        <input type="number" step="0.01" value={customFees.withdrawal_fee} onChange={e => setCustomFees(p => ({ ...p, withdrawal_fee: e.target.value }))}
                          placeholder="5.00" className="w-full h-9 px-3 bg-muted/20 border border-border rounded-md text-xs text-foreground mt-1" />
                      </div>
                    </div>
                    <Button size="sm" className="bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs" onClick={handleSaveCustomFees}>
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
    <div className="bg-muted/20 rounded-lg p-3 border border-border">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xs font-medium ${mono ? "font-mono" : ""} ${value ? "text-foreground" : "text-muted-foreground"}`}>{value || "—"}</p>
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: "from-primary/20 to-primary/5 text-primary",
    amber: "from-warning/20 to-warning/5 text-warning",
    blue: "from-info/20 to-info/5 text-info",
    violet: "from-accent/20 to-accent/5 text-accent-foreground",
  };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${colors[color] || colors.blue} border border-border p-4`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-lg font-extrabold mt-1">{value}</p>
    </div>
  );
}
