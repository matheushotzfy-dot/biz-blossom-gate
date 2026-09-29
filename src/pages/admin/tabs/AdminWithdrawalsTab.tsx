import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
 ArrowDownToLine, Search, CheckCircle2, XCircle, Clock, Wallet, UserCog,
 ToggleLeft, AlertTriangle, ShieldAlert, DollarSign, ArrowUpDown, Filter,
 CheckSquare, Plus, Minus, FileText, TrendingUp, TrendingDown, Banknote,
 Eye, ChevronDown, ChevronUp, Users, Copy,
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
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented, PremiumEmpty, premiumTable } from "./AdminPremium";
import { formatCurrency } from "@/lib/utils";
import { friendlyError } from "@/lib/friendlyError";
import AdminPager from "@/components/admin/AdminPager";

/* ── Types ── */
interface AuditLog { id: string; admin_user_id: string; action: string; entity_id: string | null; created_at: string; }
interface AutoWithdrawConfig { id: string; user_id: string; enabled: boolean; max_amount: number; admin_user_id: string; }
interface BalanceAdjustment { id: string; user_id: string; amount: number; type: string; reason: string; admin_user_id: string; created_at: string; }

interface Props {
 withdrawals: Tables<"withdrawals">[];
 profiles: Tables<"profiles">[];
 onWithdrawalAction: (id: string, action: "approved" | "rejected") => void;
 onReload: () => void;
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

/* ── PIX key labels ── */
const PIX_KEY_LABEL: Record<string, string> = {
  email: "E-mail",
  cpf: "CPF",
  cnpj: "CNPJ",
  phone: "Telefone",
  celular: "Telefone",
  random: "Aleatória",
  evp: "Aleatória",
};

/**
 * Destino do pagamento — revela sob demanda a chave PIX (ou endereço cripto)
 * do vendedor, deixando explícito o TIPO da chave e facilitando a cópia.
 */
function PayoutTarget({ withdrawal }: { withdrawal: Tables<"withdrawals"> }) {
  const [revealed, setRevealed] = useState<{ type: string; value: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };

  const chip = (label: string, tone: "primary" | "warning" | "muted" = "muted") => (
    <span className={
      tone === "primary" ? "rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary"
        : tone === "warning" ? "rounded-md border border-warning/25 bg-warning/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-warning"
          : "rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground"
    }>{label}</span>
  );

  const copyBtn = (value: string, label: string) => (
    <button
      type="button"
      onClick={() => copy(value, label)}
      title={value}
      className="flex max-w-[190px] items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-left transition-colors hover:border-border hover:bg-muted/60"
    >
      <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate font-mono text-[10px] text-foreground/80">{value}</span>
    </button>
  );

  if (withdrawal.withdrawal_type === "crypto") {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          {chip(withdrawal.crypto_currency || "Cripto", "warning")}
          {withdrawal.crypto_network ? chip(withdrawal.crypto_network) : null}
        </div>
        {withdrawal.crypto_address ? copyBtn(withdrawal.crypto_address, "Endereço") : <span className="text-[10px] text-muted-foreground">—</span>}
      </div>
    );
  }

  if (withdrawal.pix_copy_paste_code) {
    return (
      <div className="flex flex-col gap-1">
        {chip("Copia e Cola", "primary")}
        {copyBtn(withdrawal.pix_copy_paste_code, "Código PIX")}
      </div>
    );
  }

  const reveal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_reveal_pix_keys", { _user_id: withdrawal.user_id });
      if (error) { toast.error("Sem permissão para revelar a chave"); return; }
      const rows = (data as { id: string; key_type: string; key_value: string; is_default: boolean }[]) || [];
      const match = rows.find(r => r.id === withdrawal.pix_key_id) || rows.find(r => r.is_default) || rows[0];
      if (!match) { toast.error("Vendedor sem chave PIX cadastrada"); return; }
      setRevealed({ type: match.key_type, value: match.key_value });
    } finally {
      setLoading(false);
    }
  };

  if (revealed) {
    return (
      <div className="flex flex-col gap-1">
        {chip(PIX_KEY_LABEL[revealed.type?.toLowerCase()] || revealed.type || "PIX", "primary")}
        {copyBtn(revealed.value, "Chave PIX")}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={reveal}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
    >
      <Eye className="h-3 w-3" /> {loading ? "Abrindo..." : "Ver chave PIX"}
    </button>
  );
}

type SubTab = "queue" | "adjustments" | "statement";


export default function AdminWithdrawalsTab({ withdrawals, profiles, onWithdrawalAction, onReload, fmtCurrency }: Props) {
 const { user } = useAuth();
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [riskFilter, setRiskFilter] = useState("all");
 const [originFilter, setOriginFilter] = useState("all");
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
 const [page, setPage] = useState(1);
 const PAGE_SIZE = 50;

  useEffect(() => {
    Promise.all([
      supabase.from("audit_logs").select("id,admin_user_id,action,entity_id,created_at")
        .or("action.eq.approve_withdrawal,action.eq.reject_withdrawal")
        .order("created_at", { ascending: false }).limit(500),
      supabase.from("seller_auto_withdraw").select("id, user_id, enabled, max_amount, admin_user_id"),
      supabase.from("balance_adjustments").select("id, user_id, amount, type, reason, admin_user_id, created_at").order("created_at", { ascending: false }).limit(300),
    ]).then(([auditRes, autoRes, adjRes]) => {
      if (auditRes.data) setAuditLogs(auditRes.data as AuditLog[]);
      if (autoRes.data) setAutoConfigs(autoRes.data as AutoWithdrawConfig[]);
      if (adjRes.data) setAdjustments(adjRes.data as BalanceAdjustment[]);
    }).catch((e) => {
      console.error("[AdminWithdrawalsTab] load error:", e);
      toast.error("Erro ao carregar dados de saques");
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
 if (originFilter !== "all" && ((w as any).origin || "manual") !== originFilter) return false;
 if (riskFilter === "new_seller" && !isNewSeller(getProfile(w.user_id))) return false;
 if (riskFilter === "high_value" && !isHighValue(Number(w.amount))) return false;
 if (riskFilter === "flagged" && !isNewSeller(getProfile(w.user_id)) && !isHighValue(Number(w.amount))) return false;
 if (!search) return true;
 const s = search.toLowerCase();
 return getSellerName(w.user_id).toLowerCase().includes(s) || w.id.includes(s);
 });
 }, [withdrawals, statusFilter, riskFilter, originFilter, search, profiles]);

 useEffect(() => { setPage(1); }, [statusFilter, riskFilter, originFilter, search]);

 const pagedFiltered = useMemo(() => {
 const from = (page - 1) * PAGE_SIZE;
 return filtered.slice(from, from + PAGE_SIZE);
 }, [filtered, page]);

 /* ── Batch Approval ── */
 const handleBatchApprove = async () => {
  toast.error("Saques estão indisponíveis sem uma adquirente configurada.");
 };

  const handleBatchReject = async () => {
  if (selectedIds.size === 0) { toast.error("Selecione ao menos 1 saque"); return; }
  const reason = window.prompt("Motivo da rejeição em lote (mín. 3 caracteres):", "Rejeitado em lote pela administração");
  if (!reason || reason.trim().length < 3) { toast.error("Motivo obrigatório (mín. 3 caracteres)"); return; }
  setBatchProcessing(true);
  let ok = 0, fail = 0;
  for (const id of selectedIds) {
  const { error } = await supabase.from("withdrawals")
    .update({ status: "rejected", rejection_reason: reason.trim(), processed_by: user?.id })
    .eq("id", id).eq("status", "pending");
  if (!error) { await logAdminAction("reject_withdrawal", "withdrawal", id, { method: "batch", reason: reason.trim() }); ok++; }
  else { fail++; }
  }
  let msg = `${ok} saques recusados em lote`;
  if (fail > 0) msg += `, ${fail} falhas`;
  toast.success(msg);
  setSelectedIds(new Set());
  setBatchProcessing(false);
  if (ok > 0) onReload();
  };

 /* ── Single Reject with Reason ── */
 const handleRejectWithReason = async () => {
 if (!rejectDialog || !rejectReason.trim()) { toast.error("Informe o motivo da rejeição"); return; }
 if (rejectReason.trim().length < 3) { toast.error("Motivo muito curto"); return; }
 const { error } = await supabase.from("withdrawals")
   .update({ status: "rejected", rejection_reason: rejectReason.trim(), processed_by: user?.id })
   .eq("id", rejectDialog).eq("status", "pending");
 if (error) { toast.error(friendlyError(error, "Erro ao recusar")); return; }
 await logAdminAction("reject_withdrawal", "withdrawal", rejectDialog, { reason: rejectReason.trim() });
 toast.success("Saque recusado com motivo registrado");
 setRejectDialog(null);
 setRejectReason("");
 onReload();
 };

 /* ── Proof upload ── */
 const handleProofUpload = async (withdrawalId: string, file: File) => {
   if (!user) return;
   if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo > 5MB"); return; }
   const path = `${withdrawalId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
   const { error: upErr } = await supabase.storage.from("withdrawal-proofs").upload(path, file, { upsert: true });
   if (upErr) { toast.error("Erro ao enviar: " + friendlyError(upErr)); return; }
   const { error } = await supabase.from("withdrawals").update({ payment_proof_url: path }).eq("id", withdrawalId);
   if (error) { toast.error("Erro ao salvar"); return; }
   await logAdminAction("upload_withdrawal_proof", "withdrawal", withdrawalId, { path });
   toast.success("Comprovante anexado");
   onReload();
 };

 const handleViewProof = async (path: string) => {
   const { data, error } = await supabase.storage.from("withdrawal-proofs").createSignedUrl(path, 300);
   if (error || !data?.signedUrl) { toast.error("Erro ao gerar link"); return; }
   window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
 const { error } = await supabase.from("seller_auto_withdraw").upsert(payload, { onConflict: "user_id" });
 if (error) { toast.error("Erro ao salvar"); return; }
 toast.success("Config salva!");
 await logAdminAction("update_seller_auto_withdraw", "seller_auto_withdraw", autoConfigDialog, payload);
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
 toast.success(`Ajuste de ${adjustType === "credit" ? "+" : "-"}${formatCurrency(amount)} aplicado`);
 await logAdminAction("balance_adjustment", "balance_adjustments", adjustUserId, { amount, type: adjustType, reason: adjustReason.trim() });
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
  {/* Hero */}
  <FinanceiroHero
    eyebrow="Operações · Saques"
    title="Fila de Saques"
    subtitle="Aprove pagamentos, monitore risco e gerencie ajustes de saldo."
    status={{ tone: pending.length > 0 ? "warning" : "success", label: pending.length > 0 ? `${pending.length} aguardando` : "Fila zerada", pulse: pending.length > 0 }}
  />

  <PremiumMetricGrid cols={4}>
    <PremiumMetric icon={ArrowDownToLine} label="Total Saques" value={String(withdrawals.length)} sub="Histórico" tone="neutral" />
    <PremiumMetric icon={Clock} label="Pendentes" value={fmtCurrency(totalPending)} sub={`${pending.length} solicitações`} tone="warning" />
    <PremiumMetric icon={CheckCircle2} label="Aprovados" value={fmtCurrency(totalApproved)} sub={`${approved.length} pagos`} tone="success" />
    <PremiumMetric icon={XCircle} label="Recusados" value={String(rejected.length)} sub="Negados" tone="destructive" />
    <PremiumMetric icon={Wallet} label="Taxas" value={fmtCurrency(totalFees)} sub="Coletadas" tone="primary" />
    <PremiumMetric icon={ShieldAlert} label="Risco" value={String(riskCount)} sub="Requer revisão" tone="destructive" />
    <PremiumMetric icon={TrendingUp} label="Ajustes +" value={fmtCurrency(totalAdjCredits)} sub="Créditos" tone="info" />
    <PremiumMetric icon={TrendingDown} label="Ajustes -" value={fmtCurrency(totalAdjDebits)} sub="Débitos" tone="warning" />
  </PremiumMetricGrid>

 {/* Sub-Tabs */}
  {/* Sub-Tabs */}
  <div className="flex flex-wrap items-center justify-between gap-3">
    <PremiumSegmented<SubTab>
      value={subTab}
      onChange={setSubTab}
      options={[
        { value: "queue", label: `Fila${pending.length > 0 ? ` · ${pending.length}` : ""}` },
        { value: "adjustments", label: "Ajustes de Saldo" },
        { value: "statement", label: "Extrato Global" },
      ]}
    />
    {subTab === "adjustments" && (
      <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => setAdjustDialog(true)}>
        <DollarSign className="h-3.5 w-3.5" /> Novo Ajuste
      </Button>
    )}
  </div>

  {/* ═══ SUB-TAB: QUEUE ═══ */}
  {subTab === "queue" && (
    <PremiumPanel
      eyebrow="Operações"
      title={`Fila de Saques · ${filtered.length}`}
      icon={ArrowDownToLine}
      action={
        selectedIds.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{selectedIds.size} selecionados</span>
            <Button size="sm" disabled onClick={handleBatchApprove}
              className="h-8 gap-1 rounded-xl border border-primary/20 bg-primary/10 text-[11px] text-primary shadow-none hover:bg-primary/20">
              <CheckCircle2 className="h-3 w-3" /> Indisponível
            </Button>
            <Button size="sm" disabled={batchProcessing} onClick={handleBatchReject}
              className="h-8 gap-1 rounded-xl border border-destructive/20 bg-destructive/10 text-[11px] text-destructive shadow-none hover:bg-destructive/20">
              <XCircle className="h-3 w-3" /> Recusar lote
            </Button>
          </div>
        ) : null
      }
    >
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar vendedor ou ID..." value={search} onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-muted/30 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-[140px] rounded-xl text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="h-10 w-[170px] rounded-xl text-xs"><SelectValue placeholder="Risco" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos riscos</SelectItem>
            <SelectItem value="flagged">Com flag</SelectItem>
            <SelectItem value="new_seller">Sellers novos</SelectItem>
            <SelectItem value="high_value">Acima R$ 50k</SelectItem>
          </SelectContent>
        </Select>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="h-10 w-[150px] rounded-xl text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda origem</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="auto">Automático</SelectItem>
          </SelectContent>
        </Select>
      </div>


      {/* Table */}
      <div className={premiumTable.wrapper}>
        <table className={premiumTable.table}>
          <thead><tr className={premiumTable.headRow}>
            <th className={`${premiumTable.th} w-10`}>
              <Checkbox checked={pendingFiltered.length > 0 && selectedIds.size === pendingFiltered.length} onCheckedChange={toggleSelectAll} />
            </th>
            {["ID", "Vendedor", "Tipo", "Destino", "Risco", "Bruto", "Taxa", "Líquido", "Status", "Admin", "Auto", "Data", "Ações"].map(h => (
              <th key={h} className={premiumTable.th}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {pagedFiltered.map(w => {
              const audit = getWithdrawalAudit(w.id);
              const autoConfig = getAutoConfig(w.user_id);
              const isPending = w.status === "pending";
              const isOver10k = Number(w.amount) > 10000;
              return (
                <tr key={w.id} className={`${premiumTable.row} ${isPending ? "bg-warning/[0.025]" : ""} ${isOver10k && isPending ? "ring-1 ring-destructive/30" : ""}`}>
                  <td className={premiumTable.td}>
                    {isPending && <Checkbox checked={selectedIds.has(w.id)} onCheckedChange={() => toggleSelect(w.id)} />}
                  </td>
                  <td className={`${premiumTable.td} font-mono text-[10px] text-muted-foreground`}>
                    <div className="flex items-center gap-1.5">
                      <span>{w.id.slice(0, 8)}</span>
                      {(w as any).origin === "auto" && (
                        <span className="rounded border border-primary/20 bg-primary/10 px-1 py-0.5 text-[8px] font-black uppercase text-primary">AUTO</span>
                      )}
                    </div>
                  </td>
                  <td className={premiumTable.td}>
                    <p className="text-xs font-bold text-foreground">{getSellerName(w.user_id)}</p>
                    <p className="text-[10px] text-muted-foreground">{getSellerEmail(w.user_id)}</p>
                  </td>
                  <td className={premiumTable.td}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <SellerTypeBadge type={getSellerType(w.user_id)} />
                        {w.withdrawal_type === "crypto" && (
                          <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-500">
                            {w.crypto_currency || "CRYPTO"}
                          </span>
                        )}
                        {w.withdrawal_type === "pix_copy_paste" && (
                          <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-primary" title="PIX Copia e Cola (cobrança única)">
                            Copia&nbsp;Cola
                          </span>
                        )}
                      </div>
                      {(w as any).pix_copy_paste_code && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText((w as any).pix_copy_paste_code);
                            toast.success("Código PIX copiado");
                          }}
                          className="max-w-[180px] truncate rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] text-foreground/80 hover:bg-muted"
                          title={(w as any).pix_copy_paste_code}
                        >
                          {(w as any).pix_copy_paste_code}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className={premiumTable.td}><PayoutTarget withdrawal={w} /></td>
                  <td className={premiumTable.td}><RiskBadge withdrawal={w} /></td>

                  <td className={`${premiumTable.td} text-xs font-extrabold tabular-nums ${isOver10k ? "text-destructive" : "text-foreground"}`}>
                    {formatCurrency(Number(w.amount))}
                    {isOver10k && <span className="ml-1 text-[8px] font-bold text-destructive">!</span>}
                  </td>
                  <td className={`${premiumTable.td} text-xs tabular-nums text-warning`}>{formatCurrency(Number(w.fee_amount))}</td>
                  <td className={`${premiumTable.td} text-xs font-bold tabular-nums text-primary`}>{formatCurrency(Number(w.net_amount))}</td>
                  <td className={premiumTable.td}><StatusBadge status={w.status} /></td>
                  <td className={premiumTable.td}>
                    {audit ? (
                      <div>
                        <p className="flex items-center gap-1 text-xs font-semibold text-foreground/80">
                          <UserCog className="h-3 w-3 text-primary" />{getAdminName(audit.admin_user_id)}
                        </p>
                        <p className="text-[9px] text-muted-foreground">{new Date(audit.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                    ) : <span className="text-[10px] text-muted-foreground">—</span>}
                  </td>
                  <td className={premiumTable.td}>
                    {autoConfig?.enabled ? (
                      <button onClick={() => openAutoConfigDialog(w.user_id)} className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary hover:bg-primary/20">
                        Até {formatCurrency(Number(autoConfig.max_amount))}
                      </button>
                    ) : (
                      <button onClick={() => openAutoConfigDialog(w.user_id)} className="text-[9px] text-muted-foreground underline hover:text-foreground">Configurar</button>
                    )}
                  </td>
                  <td className={`${premiumTable.td} text-[10px] text-muted-foreground`}>{new Date(w.created_at).toLocaleString("pt-BR")}</td>
                  <td className={premiumTable.td}>
                    {isPending && (
                      <div className="flex gap-2">
                        <Button size="sm" disabled className="h-7 gap-1 rounded-xl border border-primary/20 bg-primary/10 text-[11px] text-primary shadow-none" onClick={() => onWithdrawalAction(w.id, "approved")}>
                          <CheckCircle2 className="h-3 w-3" /> Indisponível
                        </Button>
                        <Button size="sm" className="h-7 gap-1 rounded-xl border border-destructive/20 bg-destructive/10 text-[11px] text-destructive shadow-none hover:bg-destructive/20" onClick={() => { setRejectDialog(w.id); setRejectReason(""); }}>
                          <XCircle className="h-3 w-3" /> Recusar
                        </Button>
                      </div>
                    )}
                    {w.status === "approved" && (
                      w.payment_proof_url ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-[10px]" onClick={() => handleViewProof(w.payment_proof_url)}>
                            <FileText className="h-3 w-3" /> Ver comprovante
                          </Button>
                          <label className="cursor-pointer text-[10px] text-muted-foreground underline">
                            Trocar
                            <input type="file" hidden accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && handleProofUpload(w.id, e.target.files[0])} />
                          </label>
                        </div>
                      ) : (
                        <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-xl border border-primary/20 bg-primary/10 px-2 text-[10px] text-primary hover:bg-primary/20">
                          <FileText className="h-3 w-3" /> Anexar comprovante
                          <input type="file" hidden accept="image/*,application/pdf" onChange={e => e.target.files?.[0] && handleProofUpload(w.id, e.target.files[0])} />
                        </label>
                      )
                    )}
                    {(w.rejection_reason || (w as any).failure_code) && (
                      <div className="max-w-[220px]">
                        <p className="text-[10px] font-bold uppercase text-destructive">
                          {w.status === "rejected" ? "Motivo" : "Última falha"}
                          {(w as any).failure_code ? ` · ${(w as any).failure_code}` : ""}
                        </p>
                        <p className="line-clamp-3 text-[10px] text-muted-foreground">{w.rejection_reason || "Falha na adquirente"}</p>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <PremiumEmpty icon={ArrowDownToLine} title="Nenhum saque encontrado" subtitle="Ajuste filtros ou aguarde novas solicitações" />
        )}
      </div>
      {filtered.length > 0 && (
        <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={filtered.length} onPageChange={setPage} />
      )}
    </PremiumPanel>
  )}

  {/* ═══ SUB-TAB: ADJUSTMENTS ═══ */}
  {subTab === "adjustments" && (
    <PremiumPanel
      eyebrow="Manual"
      title={`Histórico de Ajustes · ${adjustments.length}`}
      icon={ArrowUpDown}
    >
      <p className="mb-4 text-xs text-muted-foreground">Ajuste manual de saldo de vendedores. Toda movimentação é auditada.</p>
      <div className={premiumTable.wrapper}>
        <table className={premiumTable.table}>
          <thead><tr className={premiumTable.headRow}>
            {["Data", "Vendedor", "Tipo", "Valor", "Motivo", "Admin"].map(h => (
              <th key={h} className={premiumTable.th}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {adjustments.map(a => (
              <tr key={a.id} className={premiumTable.row}>
                <td className={`${premiumTable.td} text-[10px] text-muted-foreground`}>{new Date(a.created_at).toLocaleString("pt-BR")}</td>
                <td className={premiumTable.td}>
                  <p className="text-xs font-bold text-foreground">{getSellerName(a.user_id)}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{a.user_id.slice(0, 8)}</p>
                </td>
                <td className={premiumTable.td}>
                  {a.type === "credit" ? (
                    <span className="flex w-fit items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                      <Plus className="h-2.5 w-2.5" /> Crédito
                    </span>
                  ) : (
                    <span className="flex w-fit items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                      <Minus className="h-2.5 w-2.5" /> Débito
                    </span>
                  )}
                </td>
                <td className={`${premiumTable.td} text-xs font-extrabold tabular-nums ${a.type === "credit" ? "text-emerald-500" : "text-destructive"}`}>
                  {a.type === "credit" ? "+" : "-"}{formatCurrency(Number(a.amount))}
                </td>
                <td className={`${premiumTable.td} max-w-[260px] truncate text-xs text-foreground`}>{a.reason}</td>
                <td className={`${premiumTable.td} text-xs text-muted-foreground`}>
                  <span className="flex items-center gap-1"><UserCog className="h-3 w-3 text-primary" />{getAdminName(a.admin_user_id)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {adjustments.length === 0 && (
          <PremiumEmpty icon={ArrowUpDown} title="Nenhum ajuste" subtitle="Use 'Novo Ajuste' para registrar crédito ou débito" />
        )}
      </div>
    </PremiumPanel>
  )}

  {/* ═══ SUB-TAB: STATEMENT ═══ */}
  {subTab === "statement" && (
    <PremiumPanel
      eyebrow="Conta Mãe"
      title="Extrato Global"
      icon={FileText}
    >
      <p className="mb-4 text-xs text-muted-foreground">Movimentação consolidada de saques e ajustes da plataforma (últimos 100 lançamentos).</p>
      <div className={premiumTable.wrapper}>
        <table className={premiumTable.table}>
          <thead><tr className={premiumTable.headRow}>
            {["Data", "Tipo", "Descrição", "Valor"].map(h => (
              <th key={h} className={premiumTable.th}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {statementEntries.map((e, i) => (
              <tr key={i} className={premiumTable.row}>
                <td className={`${premiumTable.td} text-[10px] text-muted-foreground`}>{new Date(e.date).toLocaleString("pt-BR")}</td>
                <td className={premiumTable.td}>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${e.positive ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-500" : "border border-destructive/20 bg-destructive/10 text-destructive"}`}>{e.type}</span>
                </td>
                <td className={`${premiumTable.td} max-w-[360px] truncate text-xs text-foreground`}>{e.description}</td>
                <td className={`${premiumTable.td} text-xs font-extrabold tabular-nums ${e.positive ? "text-emerald-500" : "text-destructive"}`}>
                  {e.positive ? "+" : "-"}{formatCurrency(Math.abs(Number(e.amount)))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {statementEntries.length === 0 && (
          <PremiumEmpty icon={FileText} title="Sem movimentações" subtitle="As movimentações aparecerão aqui assim que houver atividade" />
        )}
      </div>
    </PremiumPanel>
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
