import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowDownToLine, Search, CheckCircle2, XCircle, Clock, Wallet, UserCog,
  ToggleLeft, AlertTriangle, ShieldAlert, DollarSign, ArrowUpDown, Filter,
  CheckSquare, Plus, Minus, FileText, TrendingUp, TrendingDown, Banknote,
  Eye, ChevronDown, ChevronUp, Users,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/auditLog";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle, AdminKpi } from "./AdminOverviewTab";

/* ── Types ── */
interface AuditLog { id: string; admin_user_id: string; action: string; entity_id: string | null; created_at: string; }
interface AutoWithdrawConfig { id: string; user_id: string; enabled: boolean; max_amount: number; admin_user_id: string; }
interface BalanceAdjustment { id: string; user_id: string; amount: number; type: string; reason: string; admin_user_id: string; created_at: string; }

interface Props {
  withdrawals: Tables<"withdrawals">[];
  profiles: Tables<"profiles">[];
  onWithdrawalAction: (id: string, action: "approved" | "rejected") => void;
  fmtCurrency: (v: number) => string;
}

/* ── Risk helpers ── */
const isNewSeller = (profile: Tables<"profiles"> | undefined) => {
  if (!profile) return true;
  const created = new Date(profile.created_at);
  const daysOld = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  return daysOld < 30;
};
const isHighValue = (amount: number) => amount >= 50000;

type SubTab = "queue" | "adjustments" | "statement";

export default function AdminWithdrawalsTab({ withdrawals, profiles, onWithdrawalAction, fmtCurrency }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [autoConfigs, setAutoConfigs] = useState<AutoWithdrawConfig[]>([]);
  const [adjustments, setAdjustments] = useState<BalanceAdjustment[]>([]);
  const [autoConfigDialog, setAutoConfigDialog] = useState<string | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoMaxAmount, setAutoMaxAmount] = useState("100");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustReason, setAdjustReason] = useState("");
  const [subTab, setSubTab] = useState<SubTab>("queue");
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("audit_logs").select("id,admin_user_id,action,entity_id,created_at")
        .or("action.eq.approve_withdrawal,action.eq.reject_withdrawal")
        .order("created_at", { ascending: false }).limit(500),
      supabase.from("seller_auto_withdraw").select("*"),
      supabase.from("balance_adjustments").select("*").order("created_at", { ascending: false }).limit(300),
    ]).then(([auditRes, autoRes, adjRes]) => {
      if (auditRes.data) setAuditLogs(auditRes.data as AuditLog[]);
      if (autoRes.data) setAutoConfigs(autoRes.data as AutoWithdrawConfig[]);
      if (adjRes.data) setAdjustments(adjRes.data as BalanceAdjustment[]);
    });
  }, []);

  /* ── Helpers ── */
  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);
  const getSellerName = (userId: string) => getProfile(userId)?.full_name || "—";
  const getSellerEmail = (userId: string) => getProfile(userId)?.email || "";
  const getSellerType = (userId: string) => getProfile(userId)?.seller_type || null;
  const getAutoConfig = (userId: string) => autoConfigs.find(c => c.user_id === userId);
  const getAdminName = (adminUserId: string) => getProfile(adminUserId)?.full_name || adminUserId.slice(0, 8);
  const getWithdrawalAudit = (withdrawalId: string) => auditLogs.find(l => l.entity_id === withdrawalId);

  /* ── KPIs ── */
  const pending = withdrawals.filter(w => w.status === "pending");
  const approved = withdrawals.filter(w => w.status === "approved");
  const rejected = withdrawals.filter(w => w.status === "rejected");
  const totalPending = pending.reduce((a, w) => a + Number(w.amount), 0);
  const totalApproved = approved.reduce((a, w) => a + Number(w.amount), 0);
  const totalFees = withdrawals.reduce((a, w) => a + Number(w.fee_amount), 0);
  const autoEnabledCount = autoConfigs.filter(c => c.enabled).length;
  const riskCount = pending.filter(w => isNewSeller(getProfile(w.user_id)) || isHighValue(Number(w.amount))).length;
  const totalAdjCredits = adjustments.filter(a => a.type === "credit").reduce((s, a) => s + Number(a.amount), 0);
  const totalAdjDebits = adjustments.filter(a => a.type === "debit").reduce((s, a) => s + Number(a.amount), 0);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    return withdrawals.filter(w => {
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (riskFilter === "new_seller" && !isNewSeller(getProfile(w.user_id))) return false;
      if (riskFilter === "high_value" && !isHighValue(Number(w.amount))) return false;
      if (riskFilter === "flagged" && !isNewSeller(getProfile(w.user_id)) && !isHighValue(Number(w.amount))) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return getSellerName(w.user_id).toLowerCase().includes(s) || w.id.includes(s);
    });
  }, [withdrawals, statusFilter, riskFilter, search, profiles]);

  /* ── Batch Approval ── */
  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) { toast.error("Selecione ao menos 1 saque"); return; }
    if (!window.confirm(`Confirma aprovação em lote de ${selectedIds.size} saque(s)?`)) return;
    setBatchProcessing(true);
    let ok = 0, fail = 0, frozen = 0;
    for (const id of selectedIds) {
      try {
        // Check if seller balance is frozen
        const withdrawal = withdrawals.find(w => w.id === id);
        if (withdrawal) {
          const profile = getProfile(withdrawal.user_id);
          if (profile?.balance_frozen) { frozen++; continue; }
        }
        const { data, error } = await supabase.functions.invoke("podpay-cashout", { body: { withdrawalId: id } });
        if (error || !data?.success) { fail++; continue; }
        await logAdminAction("approve_withdrawal", "withdrawal", id, { method: "batch_podpay_pix" });
        ok++;
      } catch { fail++; }
    }
    let msg = `Lote processado: ${ok} aprovados`;
    if (fail > 0) msg += `, ${fail} falhas`;
    if (frozen > 0) msg += `, ${frozen} ignorados (saldo congelado)`;
    toast.success(msg);
    setSelectedIds(new Set());
    setBatchProcessing(false);
    if (ok > 0) onWithdrawalAction("", "approved");
  };

  const handleBatchReject = async () => {
    if (selectedIds.size === 0) { toast.error("Selecione ao menos 1 saque"); return; }
    setBatchProcessing(true);
    let ok = 0;
    for (const id of selectedIds) {
      const { error } = await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", id).eq("status", "pending");
      if (!error) { await logAdminAction("reject_withdrawal", "withdrawal", id, { method: "batch" }); ok++; }
    }
    toast.success(`${ok} saques recusados em lote`);
    setSelectedIds(new Set());
    setBatchProcessing(false);
    if (ok > 0) onWithdrawalAction("", "rejected"); // trigger parent reload
  };

  /* ── Single Reject with Reason ── */
  const handleRejectWithReason = async () => {
    if (!rejectDialog || !rejectReason.trim()) { toast.error("Informe o motivo da rejeição"); return; }
    const { error } = await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", rejectDialog).eq("status", "pending");
    if (error) { toast.error("Erro ao recusar"); return; }
    await logAdminAction("reject_withdrawal", "withdrawal", rejectDialog, { reason: rejectReason.trim() } as any);
    toast.success("Saque recusado com motivo registrado");
    setRejectDialog(null);
    setRejectReason("");
    onWithdrawalAction("", "rejected"); // trigger parent reload
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleSelectAll = () => {
    const pendingFiltered = filtered.filter(w => w.status === "pending");
    if (selectedIds.size === pendingFiltered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingFiltered.map(w => w.id)));
  };

  /* ── Auto Config ── */
  const openAutoConfigDialog = (userId: string) => {
    const config = getAutoConfig(userId);
    setAutoEnabled(config?.enabled ?? false);
    setAutoMaxAmount(String(config?.max_amount ?? 100));
    setAutoConfigDialog(userId);
  };
  const saveAutoConfig = async () => {
    if (!autoConfigDialog || !user) return;
    const payload = { user_id: autoConfigDialog, enabled: autoEnabled, max_amount: Number(autoMaxAmount), admin_user_id: user.id, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("seller_auto_withdraw").upsert(payload as any, { onConflict: "user_id" });
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Config salva!");
    await logAdminAction("update_seller_auto_withdraw", "seller_auto_withdraw", autoConfigDialog, payload as any);
    setAutoConfigDialog(null);
    const { data } = await supabase.from("seller_auto_withdraw").select("*");
    if (data) setAutoConfigs(data as AutoWithdrawConfig[]);
  };

  /* ── Balance Adjustment ── */
  const handleAdjustment = async () => {
    if (!adjustUserId || !adjustAmount || !adjustReason.trim()) { toast.error("Preencha todos os campos obrigatórios"); return; }
    if (!user) return;
    const amount = Number(adjustAmount);
    if (amount <= 0) { toast.error("Valor deve ser positivo"); return; }
    const { error } = await supabase.from("balance_adjustments").insert({
      user_id: adjustUserId,
      amount,
      type: adjustType,
      reason: adjustReason.trim(),
      admin_user_id: user.id,
    });
    if (error) { toast.error("Erro ao salvar ajuste"); return; }
    toast.success(`Ajuste de ${adjustType === "credit" ? "+" : "-"}R$ ${amount.toFixed(2)} aplicado`);
    await logAdminAction("balance_adjustment", "balance_adjustments", adjustUserId, { amount, type: adjustType, reason: adjustReason.trim() } as any);
    setAdjustDialog(false);
    setAdjustUserId(""); setAdjustAmount(""); setAdjustReason("");
    const { data } = await supabase.from("balance_adjustments").select("*").order("created_at", { ascending: false }).limit(300);
    if (data) setAdjustments(data as BalanceAdjustment[]);
  };

  /* ── Seller Type Badge ── */
  const SellerTypeBadge = ({ type }: { type: string | null }) => {
    if (type === "black") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">B</span>;
    if (type === "white") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-muted text-muted-foreground border border-border">W</span>;
    return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-warning/10 text-warning border border-warning/20">?</span>;
  };

  /* ── Risk Badge ── */
  const RiskBadge = ({ withdrawal }: { withdrawal: Tables<"withdrawals"> }) => {
    const flags: string[] = [];
    if (isNewSeller(getProfile(withdrawal.user_id))) flags.push("Novo");
    if (isHighValue(Number(withdrawal.amount))) flags.push("Alto Valor");
    if (flags.length === 0) return null;
    return (
      <div className="flex flex-col gap-0.5">
        {flags.map(f => (
          <span key={f} className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 whitespace-nowrap">{f}</span>
        ))}
      </div>
    );
  };

  /* ── Global Statement Data ── */
  const statementEntries = useMemo(() => {
    const entries: { date: string; type: string; description: string; amount: number; positive: boolean }[] = [];
    // Completed transactions = money IN
    // We don't have full tx data here, so we show withdrawals and adjustments
    withdrawals.filter(w => w.status === "approved").forEach(w => {
      entries.push({ date: w.processed_at || w.created_at, type: "Saque", description: `Saque para ${getSellerName(w.user_id)}`, amount: -Number(w.net_amount), positive: false });
      entries.push({ date: w.processed_at || w.created_at, type: "Taxa Saque", description: `Taxa de saque - ${getSellerName(w.user_id)}`, amount: Number(w.fee_amount), positive: true });
    });
    adjustments.forEach(a => {
      entries.push({ date: a.created_at, type: `Ajuste ${a.type === "credit" ? "Crédito" : "Débito"}`, description: `${a.reason} - ${getSellerName(a.user_id)}`, amount: a.type === "credit" ? -Number(a.amount) : Number(a.amount), positive: a.type !== "credit" });
    });
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 100);
  }, [withdrawals, adjustments, profiles]);

  const pendingFiltered = filtered.filter(w => w.status === "pending");

  return (
    <div className="space-y-5 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <AdminKpi icon={<ArrowDownToLine className="h-5 w-5" />} label="Total Saques" value={String(withdrawals.length)} sub="Histórico" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<Clock className="h-5 w-5" />} label="Pendentes" value={fmtCurrency(totalPending)} sub={`${pending.length} solicitações`} gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" alert={pending.length > 0} />
        <AdminKpi icon={<CheckCircle2 className="h-5 w-5" />} label="Aprovados" value={fmtCurrency(totalApproved)} sub={`${approved.length} pagos`} gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<XCircle className="h-5 w-5" />} label="Recusados" value={String(rejected.length)} sub="Negados" gradient="from-red-500 to-rose-600" glowColor="rgba(239,68,68,0.15)" />
        <AdminKpi icon={<Wallet className="h-5 w-5" />} label="Taxas" value={fmtCurrency(totalFees)} sub="Coletadas" gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" highlight />
        <AdminKpi icon={<ShieldAlert className="h-5 w-5" />} label="Risco" value={String(riskCount)} sub="Requer revisão" gradient="from-red-600 to-pink-600" glowColor="rgba(239,68,68,0.2)" alert={riskCount > 0} />
        <AdminKpi icon={<TrendingUp className="h-5 w-5" />} label="Ajustes +" value={fmtCurrency(totalAdjCredits)} sub="Créditos" gradient="from-teal-500 to-cyan-600" glowColor="rgba(6,182,212,0.15)" />
        <AdminKpi icon={<TrendingDown className="h-5 w-5" />} label="Ajustes -" value={fmtCurrency(totalAdjDebits)} sub="Débitos" gradient="from-orange-500 to-red-500" glowColor="rgba(249,115,22,0.15)" />
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border w-fit">
        {([
          { id: "queue" as SubTab, label: "Fila de Saques", icon: ArrowDownToLine, count: pending.length },
          { id: "adjustments" as SubTab, label: "Ajustes de Saldo", icon: ArrowUpDown },
          { id: "statement" as SubTab, label: "Extrato Global", icon: FileText },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === tab.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
            }`}>
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="h-4 min-w-[16px] px-1 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ SUB-TAB: QUEUE ═══ */}
      {subTab === "queue" && (
        <>
          {/* Filters + Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input placeholder="Buscar vendedor ou ID..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-10 text-xs rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="rejected">Recusados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[160px] h-10 text-xs rounded-xl"><SelectValue placeholder="Filtro de Risco" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="flagged">Com Flag</SelectItem>
                <SelectItem value="new_seller">Sellers Novos</SelectItem>
                <SelectItem value="high_value">Acima R$ 50k</SelectItem>
              </SelectContent>
            </Select>

            {/* Batch Actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-muted-foreground font-medium">{selectedIds.size} selecionados</span>
                <Button size="sm" disabled={batchProcessing} onClick={handleBatchApprove}
                  className="h-8 text-[11px] bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 gap-1 rounded-xl shadow-none">
                  <CheckCircle2 className="h-3 w-3" /> Aprovar Lote
                </Button>
                <Button size="sm" disabled={batchProcessing} onClick={handleBatchReject}
                  className="h-8 text-[11px] bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 gap-1 rounded-xl shadow-none">
                  <XCircle className="h-3 w-3" /> Recusar Lote
                </Button>
              </div>
            )}
          </div>

          {/* Table */}
          <AdminPanel>
            <PanelTitle color="amber" icon={<ArrowDownToLine className="h-4 w-4" />}>Saques ({filtered.length})</PanelTitle>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="p-3 w-8">
                    <Checkbox checked={pendingFiltered.length > 0 && selectedIds.size === pendingFiltered.length} onCheckedChange={toggleSelectAll} />
                  </th>
                  {["ID", "Vendedor", "Tipo", "Risco", "Bruto", "Taxa", "Líquido", "Status", "Admin", "Auto", "Data", "Ações"].map(h => (
                    <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(w => {
                    const audit = getWithdrawalAudit(w.id);
                    const autoConfig = getAutoConfig(w.user_id);
                    const isPending = w.status === "pending";
                        const isOver10k = Number(w.amount) > 10000;
                        return (
                      <tr key={w.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${isPending ? "bg-warning/[0.03]" : ""} ${isOver10k && isPending ? "ring-1 ring-destructive/30 bg-destructive/[0.04]" : ""}`}>
                        <td className="p-3">
                          {isPending && <Checkbox checked={selectedIds.has(w.id)} onCheckedChange={() => toggleSelect(w.id)} />}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-muted-foreground">{w.id.slice(0, 8)}</td>
                        <td className="p-3">
                          <div>
                            <p className="text-xs font-bold text-foreground">{getSellerName(w.user_id)}</p>
                            <p className="text-[10px] text-muted-foreground">{getSellerEmail(w.user_id)}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <SellerTypeBadge type={getSellerType(w.user_id)} />
                          {(w as any).withdrawal_type === "crypto" && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              {(w as any).crypto_currency || "CRYPTO"}
                            </span>
                          )}
                        </td>
                        <td className="p-3"><RiskBadge withdrawal={w} /></td>
                        <td className={`p-3 text-xs font-extrabold ${isOver10k ? "text-destructive" : "text-foreground"}`}>
                          R$ {Number(w.amount).toFixed(2)}
                          {isOver10k && <span className="ml-1 text-[8px] text-destructive font-bold">!</span>}
                        </td>
                        <td className="p-3 text-xs text-warning">R$ {Number(w.fee_amount).toFixed(2)}</td>
                        <td className="p-3 text-xs text-primary font-bold">R$ {Number(w.net_amount).toFixed(2)}</td>
                        <td className="p-3"><StatusBadge status={w.status} /></td>
                        <td className="p-3">
                          {audit ? (
                            <div>
                              <p className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                                <UserCog className="h-3 w-3 text-primary" />{getAdminName(audit.admin_user_id)}
                              </p>
                              <p className="text-[9px] text-muted-foreground">{new Date(audit.created_at).toLocaleString("pt-BR")}</p>
                            </div>
                          ) : <span className="text-[10px] text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3">
                          {autoConfig?.enabled ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Até R$ {autoConfig.max_amount}</span>
                          ) : (
                            <button onClick={() => openAutoConfigDialog(w.user_id)} className="text-[9px] text-muted-foreground hover:text-foreground underline">Configurar</button>
                          )}
                        </td>
                        <td className="p-3 text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</td>
                        <td className="p-3">
                          {isPending && (
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7 text-[11px] bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 gap-1 rounded-xl shadow-none" onClick={() => onWithdrawalAction(w.id, "approved")}>
                                <CheckCircle2 className="h-3 w-3" /> Aprovar
                              </Button>
                              <Button size="sm" className="h-7 text-[11px] bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 gap-1 rounded-xl shadow-none" onClick={() => { setRejectDialog(w.id); setRejectReason(""); }}>
                                <XCircle className="h-3 w-3" /> Recusar
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && <tr><td colSpan={13} className="p-10 text-center text-muted-foreground text-xs">Nenhum saque encontrado</td></tr>}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </>
      )}

      {/* ═══ SUB-TAB: ADJUSTMENTS ═══ */}
      {subTab === "adjustments" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Ajuste manual de saldo de vendedores. Toda movimentação é auditada.</p>
            <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => setAdjustDialog(true)}>
              <DollarSign className="h-3.5 w-3.5" /> Novo Ajuste
            </Button>
          </div>
          <AdminPanel>
            <PanelTitle color="teal" icon={<ArrowUpDown className="h-4 w-4" />}>Histórico de Ajustes ({adjustments.length})</PanelTitle>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  {["Data", "Vendedor", "Tipo", "Valor", "Motivo", "Admin"].map(h => (
                    <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {adjustments.map(a => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-3">
                        <p className="text-xs font-bold text-foreground">{getSellerName(a.user_id)}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{a.user_id.slice(0, 8)}</p>
                      </td>
                      <td className="p-3">
                        {a.type === "credit" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1 w-fit">
                            <Plus className="h-2.5 w-2.5" /> Crédito
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1 w-fit">
                            <Minus className="h-2.5 w-2.5" /> Débito
                          </span>
                        )}
                      </td>
                      <td className={`p-3 text-xs font-extrabold ${a.type === "credit" ? "text-emerald-500" : "text-destructive"}`}>
                        {a.type === "credit" ? "+" : "-"}R$ {Number(a.amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-xs text-foreground max-w-[200px] truncate">{a.reason}</td>
                      <td className="p-3 text-xs text-muted-foreground flex items-center gap-1">
                        <UserCog className="h-3 w-3 text-primary" />{getAdminName(a.admin_user_id)}
                      </td>
                    </tr>
                  ))}
                  {adjustments.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground text-xs">Nenhum ajuste</td></tr>}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </>
      )}

      {/* ═══ SUB-TAB: STATEMENT ═══ */}
      {subTab === "statement" && (
        <AdminPanel>
          <PanelTitle color="blue" icon={<FileText className="h-4 w-4" />}>Extrato Global — Conta Mãe</PanelTitle>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Movimentação de saques e ajustes da plataforma.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                {["Data", "Tipo", "Descrição", "Valor"].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {statementEntries.map((e, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3 text-[10px] text-muted-foreground">{new Date(e.date).toLocaleString("pt-BR")}</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        e.positive ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"
                      }`}>{e.type}</span>
                    </td>
                    <td className="p-3 text-xs text-foreground max-w-[300px] truncate">{e.description}</td>
                    <td className={`p-3 text-xs font-extrabold ${e.positive ? "text-emerald-500" : "text-destructive"}`}>
                      {e.positive ? "+" : "-"}R$ {Math.abs(e.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {statementEntries.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-muted-foreground text-xs">Sem movimentações</td></tr>}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      )}

      {/* ═══ AUTO-WITHDRAW DIALOG ═══ */}
      <Dialog open={!!autoConfigDialog} onOpenChange={() => setAutoConfigDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ToggleLeft className="h-5 w-5 text-primary" /> Auto-Aprovação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground"><strong className="text-foreground">{autoConfigDialog ? getSellerName(autoConfigDialog) : ""}</strong></p>
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
              <div>
                <p className="text-sm font-semibold">Ativar Auto-Aprovação</p>
                <p className="text-xs text-muted-foreground">Saques auto-aprovados até o limite</p>
              </div>
              <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Limite máximo (R$)</Label>
              <Input type="number" step="1" value={autoMaxAmount} onChange={e => setAutoMaxAmount(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Acima desse valor → revisão manual</p>
            </div>
            <Button onClick={saveAutoConfig} className="w-full gap-2"><CheckCircle2 className="h-4 w-4" /> Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ BALANCE ADJUSTMENT DIALOG ═══ */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Ajuste Manual de Saldo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs">Vendedor</Label>
              <Select value={adjustUserId} onValueChange={setAdjustUserId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione um vendedor" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || p.user_id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/30">
              <button onClick={() => setAdjustType("credit")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  adjustType === "credit" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "text-muted-foreground"
                }`}>
                <Plus className="h-3.5 w-3.5" /> Crédito
              </button>
              <button onClick={() => setAdjustType("debit")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  adjustType === "debit" ? "bg-destructive/10 text-destructive border border-destructive/20" : "text-muted-foreground"
                }`}>
                <Minus className="h-3.5 w-3.5" /> Débito
              </button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" min="0.01" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Motivo da Movimentação <span className="text-destructive">*</span></Label>
              <Textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Ex: Compensação de chargeback indevido..." className="min-h-[80px]" />
              <p className="text-[10px] text-muted-foreground">Campo obrigatório. Ficará registrado permanentemente no Audit Trail.</p>
            </div>
            <Button onClick={handleAdjustment} className="w-full gap-2" disabled={!adjustUserId || !adjustAmount || !adjustReason.trim()}>
              <CheckCircle2 className="h-4 w-4" /> Aplicar Ajuste
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ REJECT WITH REASON DIALOG ═══ */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-destructive" /> Recusar Saque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Saque <strong className="text-foreground font-mono">{rejectDialog?.slice(0, 8)}</strong> será recusado.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Motivo da Rejeição <span className="text-destructive">*</span></Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Ex: Documentação pendente, dados bancários incorretos..." className="min-h-[80px]" />
              <p className="text-[10px] text-muted-foreground">O motivo será registrado no Audit Trail.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRejectDialog(null)} className="flex-1 rounded-xl">Cancelar</Button>
              <Button onClick={handleRejectWithReason} disabled={!rejectReason.trim()} className="flex-1 gap-1.5 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <XCircle className="h-4 w-4" /> Confirmar Rejeição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
