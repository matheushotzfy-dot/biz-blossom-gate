import { WithdrawalBlockControl } from "@/features/staff/WithdrawalBlockControl";
import { useEffect, useState, useRef } from "react";
import { SellersDirectory } from "@/features/admin-finance/SellersDirectory";
import { BalanceAdjustCard } from "@/features/admin-finance/BalanceAdjustCard";
import { useKycDecision } from "@/features/admin-finance/useKycDecision";
import { useConfirm, useReason } from "@/components/seller-ui/confirm";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { validateSellerNumbers } from "@/features/admin-finance/sellersModel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { REFERRAL_OPTIONS, REVENUE_OPTIONS, SEGMENT_OPTIONS } from "@/features/auth/authModel";
import { SellerWithdrawalsSection } from "@/features/admin-finance/SellerDetailSections";
import { Seller360Panel } from "@/features/admin-finance/Seller360Panel";
import { NumberInput } from "@/components/ui/number-input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, Search, Ban, CheckCircle2, Eye, MoreHorizontal, Activity, Package,
  Trash2, Edit, Plus, Clock, Wallet, ArrowDownToLine, ShoppingCart,
  FileText, Globe, DollarSign, XCircle, Save, CreditCard, Shield,
  Key, TrendingUp, Percent, BarChart3, MessageSquareText, AlertTriangle,
  Snowflake, LogIn, Lock, Unlock, UserX, Send, CalendarClock, Copy,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";
import { PremiumPanel, PremiumEmpty, premiumTable } from "./AdminPremium";
import { logAdminAction } from "@/lib/auditLog";
import { SellerKycDocs } from "@/features/kyc/SellerKycDocs";
import { cn, isApprovedTransaction } from "@/lib/utils";
import { z } from "zod";
import { functionErrorMessage } from "@/lib/functionError";
import { friendlyError } from "@/lib/friendlyError";
import AdminPager from "@/components/admin/AdminPager";
import { displayPixKey } from "@/lib/financial-input";
import { dateKey } from "@/features/admin-finance/overviewModel";
import { formatPhone } from "@/features/kyc/kycReviewModel";
import { statusInfo as disputeStatus, typeLabel as disputeTypeLabel } from "@/features/admin-disputes/disputesModel";
import { SellerDialog as SellerReleaseDialog } from "@/features/admin-settings/ReleasePanel";
import { ReasonDialog } from "@/features/admin-settings/ReasonDialog";
import { callRpc } from "@/features/admin-settings/settingsApi";
import { REASON_PRESETS, releaseLabel } from "@/features/admin-settings/settingsModel";

type Dispute = Tables<"disputes"> & { buyer_name?: string | null };
type BalanceAdjustment = Tables<"balance_adjustments">;
type IpLog = { ip: string; user_agent: string | null; country: string | null; source: string | null; created_at: string };

// Zod schema to safely parse jsonb columns from activity_logs.
// Falls back to null when the payload doesn't match the expected shape,
// preventing fragile reads of missing fields.
const jsonRecordSchema = z.record(z.unknown()).nullable();
function displayLogValue(key: string, value: unknown): string {
  if (/cpf|cnpj|document|pix|bank|account_number|password|secret|token|api_key/i.test(key)) return "••••";
  if (value !== null && typeof value === "object") return "[dados estruturados]";
  return String(value ?? "—");
}
const activityLogSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  old_data: jsonRecordSchema.catch(null),
  new_data: jsonRecordSchema.catch(null),
  created_at: z.string(),
});
const deletedProductDataSchema = z
  .object({ name: z.string().optional(), price: z.coerce.number().optional() })
  .partial();

type ActivityLog = z.infer<typeof activityLogSchema>;

interface PixKey {
  id: string; key_type: string; key_value: string; created_at: string;
}

interface RetentionSettings {
  id?: string; user_id: string | null; pix_retention_pct: number; card_retention_pct: number; retention_days: number; card_release_days?: number;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  product_created: { label: "Produto Criado", color: "text-success", icon: Plus },
  product_updated: { label: "Produto Editado", color: "text-info", icon: Edit },
  product_deleted: { label: "Produto Excluído", color: "text-destructive", icon: Trash2 },
  course_created: { label: "Curso Criado", color: "text-success", icon: Plus },
  course_updated: { label: "Curso Editado", color: "text-info", icon: Edit },
  course_deleted: { label: "Curso Excluído", color: "text-destructive", icon: Trash2 },
  approve_kyc: { label: "KYC Aprovado", color: "text-success", icon: CheckCircle2 },
  reject_kyc: { label: "KYC Recusado", color: "text-destructive", icon: XCircle },
  freeze_balance: { label: "Saldo Congelado", color: "text-info", icon: Snowflake },
  unfreeze_balance: { label: "Saldo Descongelado", color: "text-success", icon: Unlock },
  ban_seller: { label: "Seller Banido", color: "text-destructive", icon: UserX },
  balance_credit: { label: "Crédito Manual", color: "text-success", icon: DollarSign },
  balance_debit: { label: "Débito Manual", color: "text-destructive", icon: DollarSign },
  update_retention: { label: "Rolling Reserve Atualizado", color: "text-info", icon: Lock },
  update_admin_notes: { label: "Observações Salvas", color: "text-muted-foreground", icon: MessageSquareText },
  update_custom_fees: { label: "Taxas Personalizadas", color: "text-warning", icon: Percent },
  set_seller_type: { label: "Tier Alterado", color: "text-info", icon: Shield },
  impersonate_user: { label: "Login Como Usuário", color: "text-warning", icon: LogIn },
  delete_pix_key: { label: "Chave PIX Removida", color: "text-destructive", icon: Trash2 },
  resolve_dispute_seller: { label: "Disputa: Vitória Seller", color: "text-success", icon: CheckCircle2 },
  resolve_dispute_buyer: { label: "Disputa: Vitória Comprador", color: "text-destructive", icon: XCircle },
  reply_ticket: { label: "Suporte Respondido", color: "text-info", icon: Send },
  close_ticket: { label: "Suporte Encerrado", color: "text-muted-foreground", icon: CheckCircle2 },
  manual_refund: { label: "Estorno Manual", color: "text-warning", icon: DollarSign },
  open_dispute: { label: "MED Aberto (Admin)", color: "text-warning", icon: AlertTriangle },
  blacklist_email: { label: "E-mail Blacklist", color: "text-destructive", icon: Ban },
  blacklist_cpf: { label: "CPF Blacklist", color: "text-destructive", icon: UserX },
  blacklist_cnpj: { label: "CNPJ Blacklist", color: "text-destructive", icon: UserX },

  reveal_pii: { label: "Dados Sensíveis Revelados", color: "text-warning", icon: Eye },
};

// Mask PII fields for default display; admin reveals on demand and the
// reveal click is audited via logAdminAction("reveal_pii", ...).
const maskDoc = (v?: string | null) => {
  if (!v) return "—";
  const clean = String(v).replace(/\D/g, "");
  if (clean.length < 4) return "•••";
  return `•••.•••.${clean.slice(-3)}`;
};
const maskPixValue = (v?: string | null) => {
  if (!v) return "—";
  const s = String(v);
  if (s.length <= 4) return "•••";
  return `${s.slice(0, 2)}••••${s.slice(-2)}`;
};

interface Props {
  profiles: Tables<"profiles">[];
  transactions: Tables<"transactions">[];
  withdrawals: Tables<"withdrawals">[];
  onReload: () => void;
  fmtCurrency: (v: number) => string;
  isAdmin?: boolean;
  dateRange: { from: Date; to: Date };
}

export default function AdminSellersTab({ profiles, transactions, withdrawals, onReload, fmtCurrency, isAdmin = false, dateRange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, dialog: sensitiveDialog } = useSensitiveConfirm();
  const { ask: askReason, dialog: reasonDialog } = useReason();
  const { ask: askConfirm, dialog: confirmDialog } = useConfirm();
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const reloadSeller = () => { void queryClient.invalidateQueries({ queryKey: ["admin-sellers-page"] }); onReload(); };
  const [selectedUser, setSelectedUser] = useState<Tables<"profiles"> | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);
  const [piiRevealed, setPiiRevealed] = useState(false);
  const [revealedDoc, setRevealedDoc] = useState<string | null>(null);
  const [revealedPixKeys, setRevealedPixKeys] = useState<PixKey[] | null>(null);
  const [revealedLegacyPix, setRevealedLegacyPix] = useState<string | null>(null);
  const [userLogs, setUserLogs] = useState<ActivityLog[]>([]);
  const [userProducts, setUserProducts] = useState<Tables<"products">[]>([]);
  const [userWithdrawals, setUserWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [userTransactions, setUserTransactions] = useState<Tables<"transactions">[]>([]);
  const [userPixKeys, setUserPixKeys] = useState<PixKey[]>([]);
  const [customFees, setCustomFees] = useState({ pix_percentage: "", pix_fixed: "", card_percentage: "", card_fixed: "", boleto_percentage: "", boleto_fixed: "", withdrawal_fee: "", max_ticket: "" });
  const [effectiveMaxTicket, setEffectiveMaxTicket] = useState<number | null>(null);
  const [balanceAdjustments, setBalanceAdjustments] = useState<BalanceAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [userDisputes, setUserDisputes] = useState<Dispute[]>([]);
  const [kycRejectReason, setKycRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTargetUserId, setRejectTargetUserId] = useState<string>("");
  const [managerOptions, setManagerOptions] = useState<{ user_id: string; label: string }[]>([]);
  const [approvalManager, setApprovalManager] = useState("default");
  const [userRetention, setUserRetention] = useState<RetentionSettings | null>(null);
  const [releaseEdit, setReleaseEdit] = useState<{ seller: { user_id: string; name: string; email: string | null }; days: number | null } | null>(null);
  const [releaseClear, setReleaseClear] = useState(false);
  const [notesFailed, setNotesFailed] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [ipHistory, setIpHistory] = useState<IpLog[]>([]);
  const detailRequestRef = useRef(0);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "manager");
      const ids = (roles ?? []).map(row => row.user_id);
      if (!ids.length) { setManagerOptions([]); return; }
      const { data } = await supabase.from("profiles").select("user_id,full_name,email").in("user_id", ids);
      setManagerOptions((data ?? []).map(row => ({ user_id: row.user_id, label: row.full_name || row.email || row.user_id })));
    })();
  }, [isAdmin]);


  const revealPii = async () => {
    if (!selectedUser || !isAdmin) return;
    const requestId = detailRequestRef.current;
    try {
      const [{ data: revealed, error: profileError }, { data: pixData, error: pixError }] = await Promise.all([
        supabase.rpc("admin_reveal_profile", { _user_id: selectedUser.user_id }),
        supabase.rpc("admin_reveal_pix_keys", { _user_id: selectedUser.user_id }),
      ]);
      if (requestId !== detailRequestRef.current) return;
      if (profileError || pixError) throw profileError || pixError;
      const r = Array.isArray(revealed) ? revealed[0] : revealed;
      if (r) {
        setRevealedDoc(r.document_number ?? null);
        setRevealedLegacyPix(r.pix_key ?? null);
      }
      if (pixData) setRevealedPixKeys(pixData as PixKey[]);
      setPiiRevealed(true);
      await logAdminAction("reveal_pii", "profile", selectedUser.user_id, {
        revealed_fields: ["document_number", "pix_key", "pix_keys"],
      });
      toast.success("Dados sensíveis revelados — ação auditada");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "desconhecido";
      toast.error("Erro ao revelar dados: " + msg);
    }
  };

  const openUserDetail = async (profile: Tables<"profiles">) => {
    if (!isAdmin) return;
    const requestId = ++detailRequestRef.current;
    setDetailError(null);
    setDetailTab("overview");
    setEffectiveMaxTicket(null);
    setSelectedUser(profile);
    setLoading(true);
    setEmailVerified(null);
    supabase.functions
      .invoke("admin-set-email-verified", { body: { targetUserId: profile.user_id, action: "status" } })
      .then(({ data }) => {
        if (requestId === detailRequestRef.current && data?.success) setEmailVerified(!!data.verified);
      })
      .catch(() => { /* silent */ });
    setUserLogs([]); setUserProducts([]); setUserWithdrawals([]);
    setUserTransactions([]); setUserPixKeys([]); setUserDisputes([]);
    setBalanceAdjustments([]); setIpHistory([]);
    setUserRetention(null);
    setAdminNotes("");
    setPiiRevealed(false); setRevealedDoc(null); setRevealedPixKeys(null); setRevealedLegacyPix(null);

    try {
      const [logsRes, productsRes, wdRes, txRes, feesRes, adjRes, disputesRes, retRes, ipRes, notesRes] = await Promise.all([
        supabase.from("activity_logs").select("id, user_id, action, entity_type, entity_id, old_data, new_data, created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(300),
        supabase.from("products").select("id, user_id, name, price, status, created_at, image_url").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
        supabase.from("withdrawals").select("id, user_id, amount, fee_amount, net_amount, status, created_at, withdrawal_type").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(500),
        supabase.from("transactions").select("id, user_id, product_id, amount, fee_amount, net_amount, status, payment_method, customer_name, customer_email, customer_phone, customer_document, created_at").eq("user_id", profile.user_id).eq("is_simulated", false).order("created_at", { ascending: false }).limit(1000),
        supabase.from("custom_user_fees").select("id, user_id, pix_percentage, pix_fixed, card_percentage, card_fixed, boleto_percentage, boleto_fixed, withdrawal_fee, max_ticket, admin_user_id").eq("user_id", profile.user_id).maybeSingle(),
        supabase.from("balance_adjustments").select("id, user_id, amount, type, reason, admin_user_id, created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
        supabase.from("disputes").select("id, seller_user_id, transaction_id, amount, type, status, reason, created_at").eq("seller_user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
        supabase.from("retention_settings").select("id, user_id, pix_retention_pct, card_retention_pct, retention_days, card_release_days").eq("user_id", profile.user_id).maybeSingle(),
        supabase.from("ip_logs").select("ip, user_agent, country, source, created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(100),
        // Observações internas ficam fora de `profiles` (o próprio seller lê a linha inteira do perfil dele).
        supabase.from("seller_admin_notes").select("notes").eq("user_id", profile.user_id).maybeSingle(),
      ]);
      if (requestId !== detailRequestRef.current) return;
      // As observações carregam à parte: se falharem, o resto da ficha abre e só o salvar das observações fica travado.
      const failed = [logsRes, productsRes, wdRes, txRes, feesRes, adjRes, disputesRes, retRes, ipRes].find(result => result.error);
      if (failed?.error) throw failed.error;
      if (logsRes.data) {
        const parsed = z.array(activityLogSchema).safeParse(logsRes.data);
        setUserLogs(parsed.success ? parsed.data : []);
      }

      if (productsRes.data) setUserProducts(productsRes.data as Tables<"products">[]);
      if (wdRes.data) setUserWithdrawals(wdRes.data as Tables<"withdrawals">[]);
      if (txRes.data) setUserTransactions(txRes.data as Tables<"transactions">[]);
      if (adjRes.data) setBalanceAdjustments(adjRes.data);
      if (disputesRes.data) setUserDisputes(disputesRes.data as Dispute[]);
      if (ipRes.data) setIpHistory(ipRes.data as IpLog[]);
      setUserPixKeys([]);

      setNotesFailed(Boolean(notesRes.error));
      setAdminNotes(notesRes.data?.notes ?? "");
      setUserRetention(retRes.data ? (retRes.data as RetentionSettings) : null);
      if (feesRes.data) {
        setCustomFees({
          pix_percentage:    feesRes.data.pix_percentage?.toString()    || "",
          pix_fixed:         feesRes.data.pix_fixed?.toString()         || "",
          card_percentage:   feesRes.data.card_percentage?.toString()   || "",
          card_fixed:        feesRes.data.card_fixed?.toString()        || "",
          boleto_percentage: feesRes.data.boleto_percentage?.toString() || "",
          boleto_fixed:      feesRes.data.boleto_fixed?.toString()      || "",
          withdrawal_fee:    feesRes.data.withdrawal_fee?.toString()    || "",
          max_ticket:        feesRes.data.max_ticket?.toString()        || "",
        });
      } else {
        setCustomFees({ pix_percentage: "", pix_fixed: "", card_percentage: "", card_fixed: "", boleto_percentage: "", boleto_fixed: "", withdrawal_fee: "", max_ticket: "" });
      }
      try {
        const { data: eff } = await supabase.rpc("get_user_max_ticket", { _user_id: profile.user_id });
        if (requestId !== detailRequestRef.current) return;
        setEffectiveMaxTicket(eff != null ? Number(eff) : null);
      } catch { setEffectiveMaxTicket(null); }
    } catch (e) {
      if (requestId !== detailRequestRef.current) return;
      const msg = e instanceof Error ? e.message : "desconhecido";
      setDetailError("Não foi possível carregar a ficha completa. Tente novamente.");
      toast.error("Erro ao carregar dados do seller: " + msg);
    } finally {
      if (requestId === detailRequestRef.current) setLoading(false);
    }
  };

  const { busy: kycBusy, approve: approveKyc, reject: rejectKyc } = useKycDecision({
    enabled: isAdmin,
    onDone: (userId, kind) => {
      if (kind === "approved") setApprovalManager("default");
      else { setShowRejectDialog(false); setKycRejectReason(""); }
      reloadSeller();
      if (selectedUser?.user_id === userId) setSelectedUser(null);
    },
  });
  // `admin_approve_seller_with_manager` exige senha confirmada nos últimos 10 minutos (`assert_recent_auth`):
  // sem a confirmação aqui o servidor recusava e o botão só mostrava erro.
  const handleApproveKyc = (userId: string) => {
    if (!userId || kycBusy) return;
    const blocked = selectedUser?.user_id === userId && selectedUser.account_status === "blocked";
    confirm(blocked ? "Aprovar esta conta bloqueada. Ela volta a operar e o seller é avisado." : "Aprovar a verificação deste seller. Ele é avisado e passa a operar.",
      async () => { await approveKyc(userId, approvalManager); });
  };
  const handleRejectKyc = () => { void rejectKyc(rejectTargetUserId, kycRejectReason); };

  const handleFreezeBalance = async (userId: string, freeze: boolean) => {
    if (!isAdmin) return;
    const reason = await askReason({
      title: freeze ? "Congelar esta conta?" : "Descongelar esta conta?",
      description: freeze ? "Os saques do seller ficam bloqueados até você descongelar." : "Os saques do seller voltam a ser liberados.",
      label: "Justificativa",
      minLength: 5,
      confirmLabel: freeze ? "Continuar e congelar" : "Continuar e descongelar",
      tone: freeze ? "danger" : "default",
    });
    if (!reason) return;
    confirm(freeze ? "Congelar a conta e bloquear saques deste seller." : "Descongelar a conta e liberar saques deste seller.", async () => {
      const { error } = await supabase.rpc("admin_freeze_account", { _user_id: userId, _freeze: freeze, _reason: reason.trim() });
      if (error) { toast.error(friendlyError(error)); return; }
      setSelectedUser(previous => previous?.user_id === userId ? { ...previous, balance_frozen: freeze } : previous);
      toast.success(freeze ? "Saldo congelado. Saques bloqueados." : "Saldo descongelado."); reloadSeller();
    });
  };

  const handleSetEmailVerified = async (userId: string, verified: boolean) => {
    if (!isAdmin) return;
    setEmailVerifyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-set-email-verified", {
        body: { targetUserId: userId, action: "set", verified },
      });
      if (error || !data?.success) { toast.error(await functionErrorMessage(error, data, "Não foi possível alterar a verificação do e-mail.")); return; }
      setEmailVerified(verified);
      toast.success(verified ? "E-mail marcado como verificado." : "Verificação de e-mail removida.");
      await logAdminAction(verified ? "email_verify" : "email_unverify", "auth.user", userId, { verified });
    } finally {
      setEmailVerifyLoading(false);
    }
  };

  const handleBanSeller = (userId: string) => {
    if (!isAdmin) return;
    confirm("Banir este seller, congelar seu saldo e suspender seus checkouts.", async () => {
      const { data, error } = await supabase.functions.invoke("admin-ban-seller", { body: { targetUserId: userId } });
      if (error || !data?.success) { toast.error(await functionErrorMessage(error, data, "Não foi possível banir o seller.")); return; }
      toast.success("Seller banido. Conta bloqueada, saldo congelado e checkouts suspensos.");
      await logAdminAction("ban_seller", "profile", userId, { action: "atomic_block+freeze+suspend" });
      reloadSeller(); ++detailRequestRef.current; setSelectedUser(null);
    });
  };

  const handleImpersonate = async (userId: string) => {
    if (!isAdmin) return;
    setImpersonating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-impersonate", { body: { targetUserId: userId } });
      if (error || !data?.success) { toast.error(await functionErrorMessage(error, data, "Não foi possível acessar como este usuário.")); return; }
       const { impersonation_token, target_email, target_name, target_user_id, expires_at } = data;
       if (!impersonation_token || !expires_at) { toast.error("Sessão de impersonação indisponível"); return; }
      const expectedOrigin = window.location.origin;
      const target = window.open(expectedOrigin + "/impersonate-receiver", "_blank");
      if (!target) { toast.error("Permita pop-ups para impersonar este usuário"); return; }
      let delivered = false;
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== expectedOrigin) return;
        if (event.source !== target) return;
        if (event.data?.type !== "IMPERSONATE_READY") return;
        if (delivered) return;
        delivered = true;
        try {
          target.postMessage({
            type: "IMPERSONATE_TOKENS",
             impersonation_token,
            target_email,
            target_name,
            target_user_id,
             expires_at,
          }, expectedOrigin);
        } catch { /* noop */ }
        window.removeEventListener("message", onMessage);
      };
      window.addEventListener("message", onMessage);
      setTimeout(() => { window.removeEventListener("message", onMessage); }, 15_000);
      toast.success(`Abrindo dashboard como ${target_email || target_name || userId.slice(0, 8)}`);

    } catch {
      toast.error("Erro na impersonação");
    } finally {
      setImpersonating(false);
    }
  };

  const handleSaveAdminNotes = async () => {
    if (!selectedUser || !isAdmin || notesFailed) return;
    const notes = adminNotes.trim().slice(0, 5000);
    const { error } = await supabase.from("seller_admin_notes").upsert({ user_id: selectedUser.user_id, notes }, { onConflict: "user_id" });
    if (error) { toast.error("Não foi possível salvar as observações."); return; }
    toast.success("Observações salvas.");
    await logAdminAction("update_admin_notes", "profile", selectedUser.user_id, { length: notes.length });
  };

  const handleUserStatus = async (userId: string, status: string) => {
    if (!isAdmin) { toast.error("Sem permissão"); return; }
    const approving = status === "approved";
    const ok = await askConfirm({
      title: approving ? "Aprovar esta conta?" : "Bloquear esta conta?",
      description: approving ? "O seller passa a poder vender e sacar." : "O seller perde o acesso até você liberar de novo.",
      confirmLabel: approving ? "Aprovar conta" : "Bloquear conta",
      tone: approving ? "default" : "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("user_id", userId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Conta ${status === "approved" ? "aprovada" : "bloqueada"}!`);
    await logAdminAction(status === "approved" ? "approve_user" : "block_user", "profile", userId, { new_status: status });
    reloadSeller();
  };

  const handleSetSellerType = async (userId: string, sellerType: string | null) => {
    if (!isAdmin) return;
    const ok = await askConfirm({
      title: sellerType ? `Classificar como ${sellerType}?` : "Remover a classificação?",
      description: sellerType ? "A classificação fica registrada na auditoria." : "O seller fica sem classificação.",
      confirmLabel: sellerType ? "Classificar" : "Remover classificação",
      tone: "default",
    });
    if (!ok) return;
    const { error } = await supabase.from("profiles").update({ seller_type: sellerType }).eq("user_id", userId);
    if (error) { toast.error("Erro ao classificar seller"); return; }
    toast.success(`Seller classificado como ${sellerType || "sem classificação"}!`);
    setSelectedUser(previous => previous?.user_id === userId ? { ...previous, seller_type: sellerType } : previous);
    await logAdminAction("set_seller_type", "profile", userId, { seller_type: sellerType });
    reloadSeller();
  };

  const handleSaveCustomFees = async () => {
    if (!selectedUser || !user || !isAdmin) return;
    if (!validateSellerNumbers(customFees, ["pix_percentage", "card_percentage", "boleto_percentage"])) { toast.error("Informe valores válidos e percentuais de 0 a 100"); return; }
    const payload: TablesInsert<"custom_user_fees"> = {
      user_id: selectedUser.user_id, admin_user_id: user.id,
      pix_percentage:    customFees.pix_percentage    ? Number(customFees.pix_percentage)    : null,
      pix_fixed:         customFees.pix_fixed         ? Number(customFees.pix_fixed)         : null,
      card_percentage:   customFees.card_percentage   ? Number(customFees.card_percentage)   : null,
      card_fixed:        customFees.card_fixed        ? Number(customFees.card_fixed)        : null,
      boleto_percentage: customFees.boleto_percentage ? Number(customFees.boleto_percentage) : null,
      boleto_fixed:      customFees.boleto_fixed      ? Number(customFees.boleto_fixed)      : null,
      withdrawal_fee:    customFees.withdrawal_fee    ? Number(customFees.withdrawal_fee)    : null,
      max_ticket:        customFees.max_ticket        ? Number(customFees.max_ticket)        : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("custom_user_fees").upsert(payload, { onConflict: "user_id" });
    if (error) { toast.error("Erro ao salvar taxas: " + friendlyError(error)); return; }
    toast.success("Taxas personalizadas salvas!");
    await logAdminAction("update_custom_fees", "custom_user_fees", selectedUser.user_id, payload);
  };

  const handleResolveDispute = async (disputeId: string, side: "seller" | "buyer") => {
    if (!isAdmin || !selectedUser) return;
    const profile = selectedUser;
    const reason = await askReason({
      title: side === "seller" ? "Disputa a favor do seller" : "Disputa perdida pelo seller",
      description: side === "seller" ? "O saldo retido volta para o seller." : "O débito do seller continua.",
      label: "Justificativa da decisão",
      minLength: 5,
      confirmLabel: "Continuar",
      tone: side === "seller" ? "default" : "danger",
    });
    if (!reason) return;
    confirm(side === "seller" ? "Liberar o saldo retido desta disputa para o seller." : "Confirmar a perda da disputa, mantendo o débito do seller.", async () => {
      const { error } = await supabase.rpc("admin_resolve_dispute", { _dispute_id: disputeId, _outcome: side, _fee: 0, _note: reason.trim() });
      if (error) { toast.error(friendlyError(error)); return; }
      toast.success("Decisão registrada e saldo conciliado");
      reloadSeller(); await openUserDetail(profile);
    });
  };

  const handleDeletePixKey = async (pixKeyId: string) => {
    if (!isAdmin) return;
    const ok = await askConfirm({
      title: "Remover esta chave Pix?",
      description: "A chave sai do cadastro do seller. Ele precisará cadastrar outra para sacar.",
      confirmLabel: "Remover chave",
    });
    if (!ok) return;
    const { error } = await supabase.from("pix_keys").delete().eq("id", pixKeyId);
    if (error) { toast.error("Erro ao remover chave: " + friendlyError(error)); return; }
    toast.success("Chave PIX removida.");
    await logAdminAction("delete_pix_key", "pix_key", pixKeyId);
    setUserPixKeys(prev => prev.filter(k => k.id !== pixKeyId));
    setRevealedPixKeys(prev => prev?.filter(k => k.id !== pixKeyId) ?? null);
  };

  const deletedProducts = userLogs.filter(l => l.action === "product_deleted").map(l => {
    const od = deletedProductDataSchema.safeParse(l.old_data ?? {});
    const data = od.success ? od.data : {};
    return {
      id: l.entity_id, name: data.name || "Desconhecido", price: data.price ?? 0,
      deletedAt: l.created_at, data: l.old_data,
    };
  });

  const userApproved = userTransactions.filter(t => isApprovedTransaction(t.status));
  const userMedTotal = userDisputes.length;
  const userMedOpen = userDisputes.filter(d => ["open", "in_review", "pending_recorrer"].includes(d.status)).length;
  const userMedResolved = userDisputes.filter(d => d.status.startsWith("resolved") || d.status === "closed").length;
  const userMedAmount = userDisputes.reduce((a, d) => a + Number(d.amount || 0), 0);
  const userMedRate = userApproved.length > 0 ? ((userMedTotal / userApproved.length) * 100).toFixed(2) : "0.00";

  type BuyerEntry = { name: string; email: string; phone: string; document: string; total: number; count: number; txs: Tables<"transactions">[]; lastAt: string };
  const buyersMap = new Map<string, BuyerEntry>();
  userTransactions.forEach(t => {
    const key = t.customer_email?.trim().toLowerCase() || t.customer_document || t.id;
    const existing: BuyerEntry = buyersMap.get(key) || { name: t.customer_name || "", email: t.customer_email || "", phone: t.customer_phone || "", document: t.customer_document || "", total: 0, count: 0, txs: [], lastAt: "" };
    if (isApprovedTransaction(t.status)) { existing.total += Number(t.amount); existing.count += 1; }
    existing.txs.push(t);
    if (!existing.lastAt || new Date(t.created_at) > new Date(existing.lastAt)) existing.lastAt = t.created_at;
    buyersMap.set(key, existing);
  });
  const buyers = Array.from(buyersMap.values()).sort((a, b) => b.total - a.total);


  const isFrozen = (p: Tables<"profiles">) => p.balance_frozen === true;

  const SellerTypeBadge = ({ type }: { type: string | null }) => {
    if (type === "black") return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-muted text-muted-foreground border border-border">Black</span>;
    if (type === "white") return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-secondary text-secondary-foreground border border-border">White</span>;
    return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-warning/10 text-warning border border-warning/20">Não classificado</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {isAdmin ? <SellersDirectory key={`${dateKey(dateRange.from)}:${dateKey(dateRange.to)}`} range={dateRange} enabled={isAdmin} money={fmtCurrency} onOpen={async userId => {
        const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
        if (error || !data) { toast.error("Não foi possível abrir este seller"); return; }
        await openUserDetail(data);
      }} /> : <WithdrawalBlockControl sellers={profiles} />}
      {isAdmin && <WithdrawalBlockControl sellers={profiles} owner />}
      {sensitiveDialog}
      {reasonDialog}
      {confirmDialog}

      {/* ═══ KYC Reject Dialog ═══ */}
      <Dialog open={showRejectDialog} onOpenChange={(open) => { if (!kycBusy) setShowRejectDialog(open); }}>
        <DialogContent className="z-[120] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> Recusar KYC
            </DialogTitle>
            <DialogDescription>O seller recebe o motivo na notificação e pode corrigir e reenviar os documentos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label htmlFor="kyc-reject-reason" className="text-sm font-medium text-foreground">Motivo da recusa</label>
            <textarea id="kyc-reject-reason" value={kycRejectReason} maxLength={500} onChange={e => setKycRejectReason(e.target.value)} rows={4}
              placeholder="Ex: Documento ilegível, foto cortada, nome divergente..."
              className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30 resize-none" />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" disabled={kycBusy} onClick={() => setShowRejectDialog(false)}>Cancelar</Button>
              <Button size="sm" variant="destructive" className="rounded-xl" disabled={kycBusy || kycRejectReason.trim().length < 5} onClick={handleRejectKyc}>
                <Send className="h-3 w-3 mr-1" /> {kycBusy ? "Enviando..." : "Enviar recusa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Seller Detail Dialog ═══ */}
      <Dialog open={!!selectedUser} onOpenChange={v => { if (!v) { ++detailRequestRef.current; setSelectedUser(null); } }}>
        <DialogContent className="seller-detail-dialog z-[100] flex h-[min(92dvh,1000px)] w-[calc(100vw-32px)] max-w-6xl flex-col overflow-hidden rounded-lg border border-border p-0 gap-0">
          <div className="min-h-0 flex-1 overflow-y-auto lg:flex lg:flex-col lg:overflow-hidden">
          <DialogHeader className="shrink-0 bg-card border-b border-border pl-4 pr-14 sm:pl-6 sm:pr-16 pt-5 pb-4 space-y-0">
            <DialogTitle className="sr-only">
              Detalhes do seller {selectedUser?.full_name || selectedUser?.email || ""}
            </DialogTitle>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/25 flex items-center justify-center text-[15px] font-black text-primary">
                    {(selectedUser?.full_name || "U")[0].toUpperCase()}
                  </div>
                  {selectedUser && isFrozen(selectedUser) && (
                    <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-info text-background flex items-center justify-center ring-2 ring-card">
                      <Snowflake className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-black tracking-tight text-foreground truncate">{selectedUser?.full_name || "Sem nome"}</span>
                    <SellerTypeBadge type={selectedUser?.seller_type ?? null} />
                    {selectedUser && (
                      <StatusBadge status={selectedUser.account_status || "pending_review"} />
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
                    <span className="min-w-0 truncate">{selectedUser?.email}</span>
                    {selectedUser?.phone ? <span className="tabular-nums">{formatPhone(selectedUser.phone)}</span> : null}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>ID <span className="font-mono">{selectedUser?.user_id ? `${selectedUser.user_id.slice(0, 8)}…` : "—"}</span></span>
                    {selectedUser?.user_id && (
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => { navigator.clipboard.writeText(selectedUser.user_id).then(() => toast.success("ID copiado"), () => toast.error("Não foi possível copiar")); }}
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                        aria-label="Copiar o ID completo do seller"
                      >
                        <Copy className="h-3 w-3" /> Copiar ID
                      </Button>
                    )}
                    <span>IP <span className="font-mono">{selectedUser?.last_ip || "não registrado"}</span></span>
                  </div>

                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:justify-end shrink-0">
                <Button size="sm" variant="outline" className="h-8 rounded-lg text-[11px] gap-1.5" onClick={() => selectedUser && handleImpersonate(selectedUser.user_id)} disabled={impersonating}>
                  <LogIn className="h-3 w-3" /> Entrar como o seller
                </Button>
                {selectedUser && !isFrozen(selectedUser) ? (
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-[11px] gap-1.5 border-info/30 text-info hover:bg-info/10" onClick={() => handleFreezeBalance(selectedUser.user_id, true)}>
                    <Snowflake className="h-3 w-3" /> Congelar
                  </Button>
                ) : selectedUser && (
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10" onClick={() => handleFreezeBalance(selectedUser.user_id, false)}>
                    <Unlock className="h-3 w-3" /> Descongelar
                  </Button>
                )}
                {selectedUser?.account_status !== "approved" && <div className="flex gap-1.5"><Select value={approvalManager} onValueChange={setApprovalManager}><SelectTrigger className="h-8 w-48 text-[11px]" aria-label="Gerente na aprovação"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Gerente padrão</SelectItem><SelectItem value="none">Sem gerente</SelectItem>{managerOptions.map(manager => <SelectItem key={manager.user_id} value={manager.user_id}>{manager.label}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" className="h-8 gap-1.5 border-success/30 text-success hover:bg-success/10" disabled={kycBusy} onClick={() => handleApproveKyc(selectedUser?.user_id ?? "")}><CheckCircle2 className="h-3 w-3" /> {kycBusy ? "Aprovando..." : "Aprovar"}</Button></div>}
                {selectedUser && ["pending", "pending_review"].includes(selectedUser.account_status || "") && <Button size="sm" variant="outline" className="h-8 gap-1.5 text-destructive" onClick={() => { setRejectTargetUserId(selectedUser.user_id); setKycRejectReason(""); setShowRejectDialog(true); }}><XCircle className="h-3 w-3" />Recusar KYC</Button>}
                {selectedUser && emailVerified !== true && (
                  <Button size="sm" variant="outline" disabled={emailVerifyLoading} className="h-8 rounded-lg text-[11px] gap-1.5 border-success/30 text-success hover:bg-success/10" onClick={() => handleSetEmailVerified(selectedUser.user_id, true)}>
                    <CheckCircle2 className="h-3 w-3" /> Verificar e-mail
                  </Button>
                )}
                {selectedUser && emailVerified === true && (
                  <Button size="sm" variant="outline" disabled={emailVerifyLoading} className="h-8 rounded-lg text-[11px] gap-1.5 border-warning/30 text-warning hover:bg-warning/10" onClick={() => handleSetEmailVerified(selectedUser.user_id, false)}>
                    <AlertTriangle className="h-3 w-3" /> Remover verificação
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8 rounded-lg text-[11px] gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => selectedUser && handleBanSeller(selectedUser.user_id)}>
                  <UserX className="h-3 w-3" /> Banir
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="px-4 pb-6 pt-4 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pt-0">
          {detailError ? <div role="alert" className="space-y-3 border border-destructive/30 p-5 text-sm text-destructive">{detailError}<Button variant="outline" onClick={() => selectedUser && openUserDetail(selectedUser)}>Tentar novamente</Button></div> : loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : (
            <>
              {(userTransactions.length >= 1000 || userWithdrawals.length >= 500 || userProducts.length >= 200 || userDisputes.length >= 200 || userLogs.length >= 300) && <p role="status" className="mb-4 text-xs text-warning">Históricos exibem os registros mais recentes: até 1.000 transações, 500 saques, 200 produtos/disputas e 300 logs. Os totais da Visão 360 usam todos os registros.</p>}
              <Tabs value={detailTab} onValueChange={setDetailTab} className="min-w-0 lg:pt-4">
                <TabsList className="seller-detail-tabs sticky top-0 z-10 flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-card p-1 lg:flex-wrap lg:overflow-visible">
                  {[
                    { v: "overview", l: "Visão 360", i: Activity },
                    { v: "info", l: "Info & KYC", i: FileText },
                    { v: "notes", l: "Observações", i: MessageSquareText },
                    { v: "retention", l: "Liberação do cartão", i: CalendarClock },
                    { v: "compliance", l: "Compliance", i: Shield },
                    { v: "disputes", l: `Disputas (${userMedTotal})`, i: AlertTriangle },
                    { v: "pix", l: "Chaves PIX", i: Key },
                    { v: "financial", l: "Financeiro", i: Wallet },
                    { v: "buyers", l: "Clientes", i: ShoppingCart },
                    { v: "logs", l: "Logs", i: Activity },
                    { v: "fees", l: "Taxas", i: CreditCard },
                  ].map(t => (
                    <TabsTrigger key={t.v} value={t.v} className="shrink-0 gap-1.5 rounded-md px-3 py-2 text-[13px]">
                      <t.i className="h-3.5 w-3.5" />{t.l}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                  {selectedUser && <Seller360Panel userId={selectedUser.user_id} onChanged={reloadSeller} />}
                </TabsContent>

                {/* ── Info & KYC ── */}
                <TabsContent value="info" className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoRow label="Nome completo" value={selectedUser?.full_name} />
                    <InfoRow label="E-mail" value={selectedUser?.email} />
                    <InfoRow label="Telefone" value={formatPhone(selectedUser?.phone ?? null)} />
                    <InfoRow label="Documento" value={piiRevealed ? (revealedDoc ?? selectedUser?.document_number) : maskDoc(selectedUser?.document_number)} mono />
                    <InfoRow label="Tipo de documento" value={docTypeLabel(selectedUser?.document_type)} />
                    <InfoRow label="Situação da conta" value={accountStatusLabel(selectedUser?.account_status)} />
                    <InfoRow label="Classificação" value={sellerTypeLabel(selectedUser?.seller_type)} />
                    <InfoRow label="Último IP" value={selectedUser?.last_ip} mono />
                    <InfoRow label="Cadastro" value={selectedUser ? new Date(selectedUser.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""} />
                    <InfoRow label="Saldo congelado" value={selectedUser ? (isFrozen(selectedUser) ? "Sim" : "Não") : null} />
                    <InfoRow label="E-mail verificado" value={emailVerified === null ? "Conferindo…" : emailVerified ? "Sim" : "Não"} />
                    {selectedUser && <SignupInfoRows userId={selectedUser.user_id} />}
                  </div>

                  {/* ── Histórico de IP ── */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-foreground">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Histórico de IP ({ipHistory.length})
                    </p>
                    {ipHistory.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground">Nenhum acesso registrado ainda.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {ipHistory.map((h, i) => (
                          <div key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border/40 px-2 py-2 text-[12.5px] last:border-0">
                            <span className="font-mono text-foreground">{h.ip}</span>
                            <span className="min-w-0 max-w-[220px] truncate text-muted-foreground" title={h.user_agent || ""}>{h.user_agent?.split(" ").slice(-2).join(" ") || "Navegador não informado"}</span>
                            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[11.5px] text-muted-foreground">{h.source === "signup" ? "Cadastro" : "Login"}</span>
                            {h.country && <span className="text-[11.5px] font-medium text-muted-foreground">{h.country}</span>}
                            <span className="tabular-nums text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>


                  {selectedUser?.kyc_rejection_reason && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                      <p className="mb-1 text-[13px] font-semibold text-destructive">Motivo da última recusa da verificação</p>
                      <p className="text-sm text-foreground">{selectedUser.kyc_rejection_reason}</p>
                    </div>
                  )}
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="mb-1 text-[13px] font-semibold text-foreground">Classificação do seller</p>
                    <p className="mb-3 text-[12.5px] text-muted-foreground">Marcação interna de risco. Agora: {sellerTypeLabel(selectedUser?.seller_type)}.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => handleSetSellerType(selectedUser?.user_id ?? "", "black")}>
                        <Shield className="h-3 w-3 mr-1" /> Black
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => handleSetSellerType(selectedUser?.user_id ?? "", "white")}>
                        <Globe className="h-3 w-3 mr-1" /> White
                      </Button>
                      <Button size="sm" variant="ghost" className="text-warning text-xs" onClick={() => handleSetSellerType(selectedUser?.user_id ?? "", null)}>
                        <XCircle className="h-3 w-3 mr-1" /> Remover
                      </Button>
                    </div>
                  </div>

                  {/* ── Métodos de Pagamento Permitidos ── */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="mb-1 text-[13px] font-semibold text-foreground">Formas de pagamento</p>
                    <p className="mb-3 text-[12.5px] text-muted-foreground">O bloqueio vale para produtos, links e checkouts públicos.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([
                        { key: "pix_enabled", label: "Pix" },
                        { key: "boleto_enabled", label: "Boleto" },
                        { key: "credit_card_enabled", label: "Cartão de Crédito" },
                      ] as const).map(opt => {
                        const enabled = selectedUser?.[opt.key] !== false;
                        return (
                          <Button variant="outline"
                            key={opt.key}
                            type="button"
                            onClick={async () => {
                              if (!selectedUser || !isAdmin) return;
                              const next = !enabled;
                              const previous = selectedUser;
                              setSelectedUser({ ...selectedUser, [opt.key]: next });
                              const methodUpdate: TablesUpdate<"profiles"> = {};
                              methodUpdate[opt.key] = next;
                              const { error } = await supabase
                                .from("profiles")
                                .update(methodUpdate)
                                .eq("user_id", selectedUser.user_id);
                               if (error) { setSelectedUser(previous); toast.error("Erro ao atualizar método"); return; }
                              toast.success(`${opt.label} ${next ? "ativado" : "desativado"}`);
                               reloadSeller();
                            }}
                            className={cn(
                              "flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors",
                              enabled
                                ? "border-success/30 bg-success/5 hover:bg-success/10"
                                : "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                            )}
                          >
                            <span className="text-[13px] font-semibold text-foreground">{opt.label}</span>
                            <span className={cn(
                              "rounded px-1.5 py-0.5 text-[11.5px] font-semibold",
                              enabled ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                            )}>
                              {enabled ? "Ativo" : "Bloqueado"}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  {selectedUser && <SellerKycDocs sellerId={selectedUser.user_id} />}
                </TabsContent>

                {/* ── Observações Admin ── */}
                <TabsContent value="notes" className="mt-4 space-y-4">
                  <PremiumPanel title="Observações internas" icon={MessageSquareText} description="Só a administração vê. O seller nunca tem acesso a este texto.">
                    <div className="space-y-3">
                      {notesFailed && <p role="alert" className="text-[13px] text-destructive">Não conseguimos carregar as observações salvas. Para não apagar o que já existe, salvar fica travado até a ficha abrir de novo.</p>}
                      <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={8} maxLength={5000} disabled={notesFailed}
                        aria-label="Observações internas sobre o seller"
                        placeholder="Anotações internas, combinados com o seller, histórico de contato…"
                        className="w-full resize-y rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/30 focus:outline-none disabled:opacity-60" />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs tabular-nums text-muted-foreground">{adminNotes.length.toLocaleString("pt-BR")} de 5.000 caracteres</span>
                        <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 text-primary" disabled={notesFailed} onClick={handleSaveAdminNotes}>
                          <Save className="h-3.5 w-3.5" /> Salvar observações
                        </Button>
                      </div>
                    </div>
                  </PremiumPanel>
                </TabsContent>

                {/* ── Liberação do cartão ── */}
                <TabsContent value="retention" className="mt-4 space-y-4">
                  <PremiumPanel title="Liberação do cartão" icon={CalendarClock}>
                    <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
                      Quanto tempo o valor de uma venda no cartão deste seller fica retido antes de virar saldo. A mudança vale só para as vendas feitas depois dela.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="mr-2">
                        <p className="text-xs text-muted-foreground">Prazo deste seller</p>
                        <p className="text-[15px] font-semibold tabular-nums text-foreground">
                          {userRetention?.card_release_days ? `${releaseLabel(userRetention.card_release_days)}, prazo próprio` : "Segue o padrão da plataforma"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5" disabled={!isAdmin || !selectedUser}
                        onClick={() => selectedUser && setReleaseEdit({ seller: { user_id: selectedUser.user_id, name: selectedUser.full_name || selectedUser.email || "Seller", email: selectedUser.email }, days: userRetention?.card_release_days ?? null })}>
                        <Edit className="h-3.5 w-3.5" /> {userRetention?.card_release_days ? "Alterar prazo" : "Definir prazo próprio"}
                      </Button>
                      {userRetention?.card_release_days ? (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={!isAdmin} onClick={() => setReleaseClear(true)}>Voltar ao padrão</Button>
                      ) : null}
                    </div>
                    <p className="mt-4 text-[12.5px] text-muted-foreground">O prazo padrão e a lista de quem tem prazo próprio ficam em Configurações. Reter uma porcentagem das vendas (rolling reserve) ainda não existe na plataforma.</p>
                  </PremiumPanel>
                </TabsContent>

                {/* ── Disputas do Seller ── */}
                <TabsContent value="disputes" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <MiniKpi label="Disputas" value={String(userMedTotal)} />
                    <MiniKpi label="Abertas" value={String(userMedOpen)} tone={userMedOpen > 0 ? "warning" : "neutral"} />
                    <MiniKpi label="Encerradas" value={String(userMedResolved)} />
                    <MiniKpi label="Valor contestado" value={fmtCurrency(userMedAmount)} />
                    <MiniKpi label="Disputas por venda paga" value={pctLabel(userMedRate)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {(["medpix", "pre_med_pix", "chargeback", "refund"] as const).map(type => {
                      const list = userDisputes.filter(d => d.type === type);
                      return (
                        <div key={type} className="rounded-xl border border-border bg-muted/20 p-4">
                          <p className="text-xs text-muted-foreground">{disputeTypeLabel(type)}</p>
                          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{list.length}</p>
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{fmtCurrency(list.reduce((a, d) => a + Number(d.amount || 0), 0))}</p>
                        </div>
                      );
                    })}
                  </div>
                  <PremiumPanel title="Histórico de disputas" icon={AlertTriangle}>
                    <div className={premiumTable.wrapper}>
                      <table className={premiumTable.table}>
                        <thead>
                          <tr className={premiumTable.headRow}>
                            {["Tipo", "Valor", "Situação", "Comprador", "Motivo", "Aberta em", "Decisão"].map(h => <th key={h} className={premiumTable.th}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {userDisputes.map(d => {
                            const isOpen = d.status === "open" || d.status === "in_review" || d.status === "pending_recorrer";
                            return (
                              <tr key={d.id} className={premiumTable.row}>
                                <td className={premiumTable.td}><span className="text-[13px] font-medium text-foreground">{disputeTypeLabel(d.type)}</span></td>
                                <td className={premiumTable.td}><span className="text-[13px] font-semibold tabular-nums text-foreground">{fmtCurrency(Number(d.amount))}</span></td>
                                <td className={premiumTable.td}>{(() => { const st = disputeStatus({ status: d.status, seller_response: (d as { seller_response?: string | null }).seller_response ?? null }); return <span className="ax-tag" data-tone={st.tone === "neutral" ? undefined : st.tone}>{st.label}</span>; })()}</td>
                                <td className={premiumTable.td}><span className="text-[13px] text-muted-foreground">{d.buyer_name || "—"}</span></td>
                                <td className={premiumTable.td}><span className="block max-w-[220px] truncate text-[13px] text-muted-foreground" title={d.reason || ""}>{d.reason || "—"}</span></td>
                                <td className={premiumTable.td}><span className="text-[13px] tabular-nums text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")}</span></td>
                                <td className={premiumTable.td}>
                                  {isOpen ? (
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs border-success/30 text-success" title="Decidir a favor do seller" onClick={() => handleResolveDispute(d.id, "seller")}>
                                        <CheckCircle2 className="h-3.5 w-3.5" /> A favor do seller
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs border-destructive/30 text-destructive" title="Decidir a favor do comprador" onClick={() => handleResolveDispute(d.id, "buyer")}>
                                        <XCircle className="h-3.5 w-3.5" /> A favor do comprador
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-[13px] text-muted-foreground">Decidida</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {userDisputes.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-[13px] text-muted-foreground">Nenhuma disputa deste seller.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </PremiumPanel>
                </TabsContent>

                {/* ── Chaves PIX ── */}
                <TabsContent value="pix" className="mt-4 space-y-4">
                  <PremiumPanel
                    title={`Chaves PIX${revealedPixKeys ? ` (${revealedPixKeys.length})` : ""}`}
                    icon={Key}
                    action={!piiRevealed ? (
                      <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={revealPii}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Ver chaves e documento
                      </Button>
                    ) : null}
                  >
                    {!piiRevealed ? <p className="text-sm text-muted-foreground">Chaves protegidas. Revele os dados para consultar.</p> : !revealedPixKeys || revealedPixKeys.length === 0 ? (
                      <PremiumEmpty icon={Key} title="Nenhuma chave PIX cadastrada" />
                    ) : (
                      <div className="space-y-3">
                        {revealedPixKeys.map(pk => (
                          <div key={pk.id} className="rounded-xl border border-border bg-muted/10 p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Key className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground">{pixTypeLabel(pk.key_type)}</p>
                              <p className="break-all text-sm font-mono text-foreground mt-0.5">{displayPixKey(pk.key_value, pk.key_type)}</p>
                            </div>
                            <p className="text-xs tabular-nums text-muted-foreground">{new Date(pk.created_at).toLocaleDateString("pt-BR")}</p>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePixKey(pk.id)} title="Remover chave" aria-label="Remover esta chave Pix">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedUser?.pix_key && (
                      <div className="mt-4 rounded-xl border border-warning/15 bg-warning/5 p-3">
                        <p className="mb-1 text-[13px] font-semibold text-warning">Chave Pix antiga, salva no perfil</p>
                        <p className="text-[13px] text-muted-foreground">
                          {pixTypeLabel(selectedUser.pix_key_type)}: <span className="font-mono">{piiRevealed ? (revealedLegacyPix ?? selectedUser.pix_key) : maskPixValue(selectedUser.pix_key)}</span>
                        </p>
                      </div>
                    )}
                  </PremiumPanel>
                </TabsContent>


                {/* ── Financeiro ── */}
                <TabsContent value="financial" className="mt-4 space-y-4">
                  {selectedUser && <BalanceAdjustCard userId={selectedUser.user_id} onDone={() => { reloadSeller(); if (selectedUser) void openUserDetail(selectedUser); }} />}
                  {balanceAdjustments.length > 0 && (
                    <PremiumPanel title="Histórico de ajustes" icon={DollarSign}>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {balanceAdjustments.map(adj => (
                          <div key={adj.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-b border-border/50 py-2 text-[13px]">
                            <div className="min-w-0">
                              <span className={cn("font-semibold tabular-nums", adj.type === "credit" ? "text-success" : "text-destructive")}>
                                {adj.type === "credit" ? "+" : "−"} {fmtCurrency(Number(adj.amount))}
                              </span>
                              <span className="ml-2 text-muted-foreground">{adj.reason}</span>
                            </div>
                            <span className="tabular-nums text-muted-foreground">{new Date(adj.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                          </div>
                        ))}
                      </div>
                    </PremiumPanel>
                  )}
                  {selectedUser && <SellerWithdrawalsSection userId={selectedUser.user_id} onChanged={reloadSeller} />}
                </TabsContent>

                {/* ── Compliance ── */}
                <TabsContent value="compliance" className="mt-4 space-y-5">
                  <PremiumPanel title={`Produtos (${userProducts.length})`} icon={Package}>
                    <div className="space-y-3">
                      {userProducts.length === 0 && <PremiumEmpty icon={Package} title="Nenhum produto cadastrado" />}
                      {userProducts.map(p => {
                        const prodTxs = userTransactions.filter(t => t.product_id === p.id);
                        const prodApproved = prodTxs.filter(t => isApprovedTransaction(t.status));
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
                                  <p className="text-sm font-bold text-foreground">{p.name}</p>
                                  <StatusBadge status={p.status} />
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">ID <span className="font-mono">{p.id.slice(0, 8)}…</span></p>
                              </div>
                              <p className="text-base font-semibold tabular-nums text-foreground">{fmtCurrency(Number(p.price))}</p>
                            </div>
                            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                              {[
                                { l: "Vendas", v: String(prodApproved.length), c: "text-foreground" },
                                { l: "Bruto", v: fmtCurrency(prodGross), c: "text-foreground" },
                                { l: "Líquido", v: fmtCurrency(prodNet), c: "text-foreground" },
                                { l: "Taxas", v: fmtCurrency(prodFees), c: "text-foreground" },
                                { l: "Estornos", v: String(prodRefunds), c: prodRefunds > 0 ? "text-destructive" : "text-foreground" },
                                { l: "Chargebacks", v: String(prodChargebacks), c: prodChargebacks > 0 ? "text-destructive" : "text-foreground" },
                              ].map(k => (
                                <div key={k.l} className="rounded-lg border border-border/50 bg-muted/20 p-2">
                                  <p className="text-xs text-muted-foreground">{k.l}</p>
                                  <p className={`mt-0.5 text-[13px] font-semibold tabular-nums ${k.c}`}>{k.v}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </PremiumPanel>

                  {deletedProducts.length > 0 && (
                    <PremiumPanel title={`Produtos excluídos (${deletedProducts.length})`} icon={Trash2}>
                      <div className="space-y-2">
                        {deletedProducts.map((dp, i) => (
                          <div key={i} className="rounded-xl border border-destructive/15 bg-destructive/5 p-3">
                            <p className="text-sm font-bold text-destructive">{dp.name}</p>
                            <p className="text-xs text-muted-foreground">Preço {fmtCurrency(Number(dp.price))}, excluído em {new Date(dp.deletedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                          </div>
                        ))}
                      </div>
                    </PremiumPanel>
                  )}

                  <PremiumPanel title="Resumo" icon={BarChart3} description="Contado sobre o histórico carregado nesta ficha.">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <MiniKpi label="Produtos ativos" value={String(userProducts.filter(product => product.status === "active").length)} />
                      <MiniKpi label="Produtos excluídos" value={String(deletedProducts.length)} />
                      <MiniKpi label="Transações" value={String(userTransactions.length)} />
                      <MiniKpi label="Estornos e chargebacks" value={pctLabel(userTransactions.length > 0 ? (userTransactions.filter(t => t.status === "refunded" || t.status === "chargeback").length / userTransactions.length) * 100 : 0)} />
                    </div>
                  </PremiumPanel>
                </TabsContent>

                {/* ── Clientes ── */}
                <TabsContent value="buyers" className="mt-4">
                  <div className={premiumTable.wrapper}>
                    <table className={premiumTable.table}>
                      <thead>
                        <tr className={premiumTable.headRow}>
                          {["Cliente", "Telefone", "Documento", "Compras", "Total", "Última compra", "Ações"].map(h => <th key={h} className={premiumTable.th}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {buyers.map((b, i) => {
                          const lastTx = b.txs[0];
                          const lastCompleted = b.txs.find(t => isApprovedTransaction(t.status));
                          return (
                            <tr key={i} className={premiumTable.row}>
                              <td className={premiumTable.td}>
                                <div className="flex flex-col">
                                  <span className="text-[13px] font-semibold text-foreground">{b.name || "—"}</span>
                                  <span className="text-xs text-muted-foreground">{b.email || "—"}</span>
                                </div>
                              </td>
                              <td className={premiumTable.td}><span className="text-[13px] tabular-nums text-muted-foreground">{formatPhone(b.phone || null) || "—"}</span></td>
                              <td className={premiumTable.td}><span className="font-mono text-xs text-muted-foreground">{b.document || "—"}</span></td>
                              <td className={premiumTable.td}><span className="text-[13px] font-semibold tabular-nums text-foreground">{b.count}</span></td>
                              <td className={premiumTable.td}><span className="text-[13px] font-semibold tabular-nums text-foreground">{fmtCurrency(b.total)}</span></td>
                              <td className={premiumTable.td}><span className="text-[13px] tabular-nums text-muted-foreground">{b.lastAt ? new Date(b.lastAt).toLocaleDateString("pt-BR") : "—"}</span></td>
                              <td className={premiumTable.td}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label={`Ações para ${b.name || b.email || "este cliente"}`}><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem
                                      disabled={!lastCompleted}
                                      onClick={async () => {
                                        if (!lastCompleted || !selectedUser || !isAdmin) return;
                                        const profile = selectedUser;
                                        const reason = await askReason({ title: "Estornar a última compra", description: "O pedido vai para a fila de aprovação manual; nenhum dinheiro sai agora.", label: "Motivo do reembolso", minLength: 5, confirmLabel: "Continuar", tone: "danger" });
                                        if (!reason) return;
                                        confirm(`Reservar ${fmtCurrency(Number(lastCompleted.amount))} do saldo do seller e enviar à fila de aprovação manual. Nenhum dinheiro será enviado automaticamente.`, async () => {
                                          const { error } = await supabase.rpc("admin_refund_transaction", { _transaction_id: lastCompleted.id, _amount: Number(lastCompleted.amount), _reason: reason.trim() });
                                          if (error) { toast.error(friendlyError(error)); return; }
                                          toast.success("Reembolso enviado à aprovação manual"); reloadSeller(); await openUserDetail(profile);
                                        });
                                      }}
                                      className="text-warning"
                                    >
                                      <DollarSign className="h-3.5 w-3.5 mr-2" /> Estornar última compra
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={!lastCompleted}
                                      onClick={async () => {
                                        if (!lastCompleted || !selectedUser || !isAdmin) return;
                                        const profile = selectedUser;
                                        const reason = await askReason({ title: "Abrir MED Pix ou chargeback", description: "O valor desta venda fica retido enquanto a disputa estiver aberta.", label: "Motivo da reclamação da adquirente", minLength: 5, confirmLabel: "Continuar", tone: "danger" });
                                        if (!reason) return;
                                        const type = lastCompleted.payment_method === "pix" ? "medpix" : "chargeback";
                                        confirm(`Abrir ${type === "medpix" ? "MED PIX" : "chargeback"} e congelar o valor desta venda, sem devolução automática.`, async () => {
                                          const { error } = await supabase.rpc("admin_open_dispute", { _transaction_id: lastCompleted.id, _type: type, _reason: reason.trim(), _deadline_days: 7 });
                                          if (error) { toast.error(friendlyError(error)); return; }
                                          toast.success("Disputa registrada com retenção auditada"); reloadSeller(); await openUserDetail(profile);
                                        });
                                      }}
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Abrir MED / chargeback
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      disabled={!b.email}
                                      onClick={async () => {
                                        if (!b.email || !user) return;
                                        const reason = await askReason({ title: "Adicionar e-mail à blacklist", description: b.email, label: "Motivo da blacklist", defaultValue: "Comportamento abusivo", minLength: 5, confirmLabel: "Adicionar à blacklist", tone: "danger" });
                                        if (!reason) return;
                                        const { error } = await supabase.from("global_blacklist").upsert({
                                          entry_type: "email", entry_value: b.email.toLowerCase(),
                                          reason: reason.slice(0, 500), added_by: user.id, is_active: true,
                                        }, { onConflict: "entry_type,entry_value" });
                                        if (error) { toast.error("Erro: " + friendlyError(error)); return; }
                                        toast.success(`E-mail ${b.email} adicionado à blacklist global.`);
                                        await logAdminAction("blacklist_email", "global_blacklist", b.email, { reason });
                                      }}
                                      className="text-destructive"
                                    >
                                      <Ban className="h-3.5 w-3.5 mr-2" /> Adicionar e-mail à blacklist
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={!b.document}
                                      onClick={async () => {
                                        if (!b.document || !user) return;
                                        const doc = b.document.replace(/\D/g, "");
                                        const type = doc.length === 11 ? "cpf" : "cnpj";
                                        const reason = await askReason({ title: `Adicionar ${type.toUpperCase()} à blacklist`, label: "Motivo da blacklist", defaultValue: "Fraude confirmada", minLength: 5, confirmLabel: "Adicionar à blacklist", tone: "danger" });
                                        if (!reason) return;
                                        const { error } = await supabase.from("global_blacklist").upsert({
                                          entry_type: type, entry_value: doc,
                                          reason: reason.slice(0, 500), added_by: user.id, is_active: true,
                                        }, { onConflict: "entry_type,entry_value" });
                                        if (error) { toast.error("Erro: " + friendlyError(error)); return; }
                                        toast.success(`${type.toUpperCase()} adicionado à blacklist.`);
                                        await logAdminAction(`blacklist_${type}`, "global_blacklist", doc, { reason });
                                      }}
                                      className="text-destructive"
                                    >
                                      <UserX className="h-3.5 w-3.5 mr-2" /> Adicionar documento à blacklist
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                        {buyers.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-[13px] text-muted-foreground">Nenhum cliente comprou deste seller ainda.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 px-1 text-xs text-muted-foreground">Reembolsos seguem para aprovação manual. MED Pix e chargeback retêm o valor da venda e ficam registrados na auditoria.</p>
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
                                <span className={`text-[13px] font-semibold ${meta.color}`}>{meta.label}</span>
                                <span className="text-xs tabular-nums text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                              </div>
                              {log.old_data && log.action.includes("deleted") && (
                                <div className="mt-2 rounded-lg bg-destructive/5 border border-destructive/10 p-2 text-[10px]">
                                  {Object.entries(log.old_data).map(([k, v]) => (<div key={k}><span className="text-muted-foreground">{k}:</span> <span className="text-foreground">{displayLogValue(k, v)}</span></div>))}
                                </div>
                              )}
                              {log.old_data && log.new_data && log.action.includes("updated") && (
                                <div className="mt-2 rounded-lg bg-info/5 border border-info/10 p-2 text-[10px] space-y-0.5">
                                  {Object.keys(log.new_data).map(k => {
                                    if (log.old_data?.[k] === log.new_data?.[k]) return null;
                                    return (<div key={k}><span className="text-muted-foreground">{k}:</span> <span className="line-through text-destructive/50">{displayLogValue(k, log.old_data?.[k])}</span> → <span className="text-primary">{displayLogValue(k, log.new_data?.[k])}</span></div>);
                                  })}
                                </div>
                              )}
                              {log.new_data && log.action.includes("created") && (
                                <div className="mt-2 rounded-lg bg-primary/5 border border-primary/10 p-2 text-[10px]">
                                  {Object.entries(log.new_data).map(([k, v]) => (<div key={k}><span className="text-muted-foreground">{k}:</span> <span className="text-foreground">{displayLogValue(k, v)}</span></div>))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {userLogs.length === 0 && <p className="py-8 text-center text-[13px] text-muted-foreground">Nenhuma alteração registrada nos produtos e cursos deste seller.</p>}
                  </div>
                </TabsContent>

                {/* ── Taxas Customizadas ── */}
                <TabsContent value="fees" className="mt-4">
                  <PremiumPanel title="Taxas deste seller" icon={CreditCard}>
                    <p className="mb-1 text-[13px] text-muted-foreground">Campo em branco usa a taxa padrão da plataforma.</p>
                    <p className="mb-4 text-[13px] text-muted-foreground">Hoje só a taxa de saque e o limite por venda são aplicados. As taxas de venda ficam guardadas e passam a valer quando houver adquirente.</p>
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <p className="text-[13px] font-semibold text-foreground">Pix</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Percentual (%)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.pix_percentage}
                              onChange={v => setCustomFees(p => ({ ...p, pix_percentage: v }))}
                              placeholder="4.99" className="mt-1 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Valor fixo (R$)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.pix_fixed}
                              onChange={v => setCustomFees(p => ({ ...p, pix_fixed: v }))}
                              placeholder="3.99" className="mt-1 text-xs" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[13px] font-semibold text-foreground">Cartão</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Percentual (%)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.card_percentage}
                              onChange={v => setCustomFees(p => ({ ...p, card_percentage: v }))}
                              placeholder="5.99" className="mt-1 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Valor fixo (R$)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.card_fixed}
                              onChange={v => setCustomFees(p => ({ ...p, card_fixed: v }))}
                              placeholder="0.00" className="mt-1 text-xs" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[13px] font-semibold text-foreground">Boleto</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Percentual (%)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.boleto_percentage}
                              onChange={v => setCustomFees(p => ({ ...p, boleto_percentage: v }))}
                              placeholder="0.00" className="mt-1 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Valor fixo (R$)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.boleto_fixed}
                              onChange={v => setCustomFees(p => ({ ...p, boleto_fixed: v }))}
                              placeholder="3.49" className="mt-1 text-xs" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[13px] font-semibold text-foreground">Saque</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Taxa por saque (R$)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.withdrawal_fee}
                              onChange={v => setCustomFees(p => ({ ...p, withdrawal_fee: v }))}
                              placeholder="5.00" className="mt-1 text-xs" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[13px] font-semibold text-foreground">Limite por venda</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Valor máximo por venda (R$)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.max_ticket}
                              onChange={v => setCustomFees(p => ({ ...p, max_ticket: v }))}
                              placeholder="10000.00" className="mt-1 text-xs" />
                            <p className="mt-1 text-xs text-muted-foreground">
                              Em vigor: <span className="tabular-nums text-foreground">{fmtCurrency(effectiveMaxTicket ?? 0)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs border-primary/30 text-primary" onClick={handleSaveCustomFees}>
                        <Save className="h-3 w-3 mr-1" /> Salvar taxas
                      </Button>
                    </div>
                  </PremiumPanel>
                </TabsContent>
              </Tabs>
            </>
          )}
          </div>
          </div>
        </DialogContent>
      </Dialog>
      <SellerReleaseDialog
        state={releaseEdit}
        onClose={() => setReleaseEdit(null)}
        globalDays={null}
        onSaved={() => { if (selectedUser) void openUserDetail(selectedUser); }}
      />
      <ReasonDialog open={releaseClear} onClose={() => setReleaseClear(false)} icon={<CalendarClock className="h-5 w-5" />} title="Voltar ao prazo padrão?"
        subtitle={selectedUser?.full_name || selectedUser?.email || undefined} confirmLabel="Voltar ao padrão" reason="required" presets={REASON_PRESETS.release}
        confirmText={`Remover o prazo próprio de ${selectedUser?.full_name || "este seller"}: ele volta ao prazo padrão da plataforma.`}
        onSubmit={async (reason) => {
          await callRpc("admin_clear_card_release", { _user_id: selectedUser!.user_id, _reason: reason });
          toast.success("Prazo próprio removido. O seller foi avisado.");
          if (selectedUser) await openUserDetail(selectedUser);
        }}>
        <p className="text-[14px] leading-relaxed text-foreground/90">As próximas vendas no cartão deste seller seguem o prazo padrão da plataforma, e ele é avisado. As vendas já feitas mantêm a data que tinham.</p>
      </ReasonDialog>

    </div>
  );
}

const optionLabel = (options: ReadonlyArray<{ value: string; label: string }>, value: string | null | undefined) =>
  value ? options.find((o) => o.value === value)?.label ?? value : null;

/** O que o seller respondeu no cadastro (tabela `seller_signup_info`; contas antigas não têm). */
function SignupInfoRows({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-seller-signup-info", userId],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("seller_signup_info")
        .select("company_name, business_segment, monthly_revenue_band, referral_source")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return row;
    },
    staleTime: 60_000,
  });
  const fallback = isLoading ? "Carregando…" : isError ? "Não foi possível carregar" : null;
  return (
    <>
      <InfoRow label="Razão social" value={fallback ?? data?.company_name} />
      <InfoRow label="O que vende" value={fallback ?? optionLabel(SEGMENT_OPTIONS, data?.business_segment)} />
      <InfoRow label="Faturamento mensal (informado)" value={fallback ?? optionLabel(REVENUE_OPTIONS, data?.monthly_revenue_band)} />
      <InfoRow label="Como conheceu" value={fallback ?? optionLabel(REFERRAL_OPTIONS, data?.referral_source)} />
    </>
  );
}

const ACCOUNT_STATUS_LABEL: Record<string, string> = { approved: "Aprovada", pending: "Pendente, sem documentos enviados", pending_review: "Em análise", rejected: "Recusada", blocked: "Bloqueada" };
function accountStatusLabel(v?: string | null) { return v ? ACCOUNT_STATUS_LABEL[v] ?? v : null; }
function sellerTypeLabel(v?: string | null) { return v === "white" ? "White" : v === "black" ? "Black" : v === "gray" ? "Gray" : "Não classificado"; }
function docTypeLabel(v?: string | null) { return v === "cpf" ? "CPF" : v === "cnpj" ? "CNPJ" : v ? v.toUpperCase() : null; }
const PIX_TYPE_LABEL: Record<string, string> = { cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Telefone", random: "Chave aleatória", evp: "Chave aleatória" };
function pixTypeLabel(v?: string | null) { return v ? PIX_TYPE_LABEL[v.toLowerCase()] ?? v : "Chave"; }
function pctLabel(v: number | string) { return `${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`; }

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
      <p className={cn("break-words text-[13.5px]", mono && "font-mono", value ? "font-medium text-foreground" : "text-muted-foreground")}>{value || "Não informado"}</p>
    </div>
  );
}

type MiniTone = "success" | "warning" | "info" | "primary" | "destructive" | "neutral";
function MiniKpi({ label, value, tone = "neutral" }: { label: string; value: string; tone?: MiniTone }) {
  const valueCls: Record<MiniTone, string> = {
    success: "text-success",
    warning: "text-warning",
    info: "text-info",
    primary: "text-primary",
    destructive: "text-destructive",
    neutral: "text-foreground",
  };
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-[19px] font-semibold leading-tight tabular-nums ${valueCls[tone]}`}>{value}</p>
    </div>
  );
}


/* ── SellerKpi: 1px-divider clickable KPI in seller hero strip ── */
type SellerKpiTone = "neutral" | "primary" | "success" | "warning" | "info" | "destructive";
function SellerKpi({ icon: Icon, label, value, sub, tone = "neutral", active, onClick }: {
  icon: LucideIcon; label: string; value: string; sub?: string; tone?: SellerKpiTone;
  active?: boolean; onClick?: () => void;
}) {
  const iconTint: Record<SellerKpiTone, string> = {
    neutral: "text-muted-foreground", primary: "text-primary", success: "text-success",
    warning: "text-warning", info: "text-info", destructive: "text-destructive",
  };
  const barCls: Record<SellerKpiTone, string> = {
    neutral: "bg-foreground/40", primary: "bg-primary", success: "bg-success",
    warning: "bg-warning", info: "bg-info", destructive: "bg-destructive",
  };
  const isInteractive = typeof onClick === "function";
  const Tag = (isInteractive ? "button" : "div") as "button" | "div";
  return (
    <Tag
      type={isInteractive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group relative w-full bg-card px-4 py-4 text-left flex flex-col gap-2 transition-colors",
        isInteractive && "cursor-pointer hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
        active && "bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/70 leading-tight">{label}</span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-90", iconTint[tone])} strokeWidth={2.2} />
      </div>
      <div className="font-display text-[24px] font-black leading-none tabular-nums tracking-tight text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground/75 font-medium truncate">{sub}</div>}
      <span className={cn(
        "absolute inset-x-0 bottom-0 h-[1.5px] origin-left transition-transform duration-300",
        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
        barCls[tone],
      )} />
    </Tag>
  );
}
