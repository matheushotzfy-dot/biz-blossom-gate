import { useState, useRef } from "react";
import { SellersDirectory } from "@/features/admin-finance/SellersDirectory";
import { BalanceAdjustCard } from "@/features/admin-finance/BalanceAdjustCard";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { validateSellerNumbers } from "@/features/admin-finance/sellersModel";
import { useQueryClient } from "@tanstack/react-query";
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
  Snowflake, LogIn, Lock, Unlock, UserX, Send,
  type LucideIcon,
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
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";
import { PremiumPanel, PremiumEmpty, premiumTable } from "./AdminPremium";
import { logAdminAction } from "@/lib/auditLog";
import { cn, isApprovedTransaction } from "@/lib/utils";
import { z } from "zod";
import { friendlyError } from "@/lib/friendlyError";
import AdminPager from "@/components/admin/AdminPager";
import { displayPixKey } from "@/lib/financial-input";

type Dispute = Tables<"disputes"> & { buyer_name?: string | null };
type BalanceAdjustment = Tables<"balance_adjustments">;
type IpLog = { ip: string; user_agent: string | null; country: string | null; source: string | null; created_at: string };

// Zod schema to safely parse jsonb columns from activity_logs.
// Falls back to null when the payload doesn't match the expected shape,
// preventing fragile reads of missing fields.
const jsonRecordSchema = z.record(z.unknown()).nullable();
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
  const [kycImages, setKycImages] = useState<string[]>([]);
  const [adminNotes, setAdminNotes] = useState("");
  const [userDisputes, setUserDisputes] = useState<Dispute[]>([]);
  const [kycRejectReason, setKycRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTargetUserId, setRejectTargetUserId] = useState<string>("");
  const [userRetention, setUserRetention] = useState<RetentionSettings | null>(null);
  const [retentionForm, setRetentionForm] = useState({ pix_pct: "", card_pct: "", days: "", card_release_days: "7" });
  const [impersonating, setImpersonating] = useState(false);
  const [ipHistory, setIpHistory] = useState<IpLog[]>([]);
  const detailRequestRef = useRef(0);


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
    setBalanceAdjustments([]); setKycImages([]); setIpHistory([]);
    setUserRetention(null); setRetentionForm({ pix_pct: "", card_pct: "", days: "", card_release_days: "7" });
    setAdminNotes("");
    setPiiRevealed(false); setRevealedDoc(null); setRevealedPixKeys(null); setRevealedLegacyPix(null);

    try {
      const [logsRes, productsRes, wdRes, txRes, feesRes, adjRes, disputesRes, retRes, ipRes] = await Promise.all([
        supabase.from("activity_logs").select("id, user_id, action, entity_type, entity_id, old_data, new_data, created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(300),
        supabase.from("products").select("id, user_id, name, price, status, created_at, image_url").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
        supabase.from("withdrawals").select("id, user_id, amount, fee_amount, net_amount, status, created_at, withdrawal_type").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(500),
        supabase.from("transactions").select("id, user_id, product_id, amount, fee_amount, net_amount, status, payment_method, customer_name, customer_email, customer_phone, customer_document, created_at").eq("user_id", profile.user_id).eq("is_simulated", false).order("created_at", { ascending: false }).limit(1000),
        supabase.from("custom_user_fees").select("id, user_id, pix_percentage, pix_fixed, card_percentage, card_fixed, boleto_percentage, boleto_fixed, withdrawal_fee, max_ticket, admin_user_id").eq("user_id", profile.user_id).maybeSingle(),
        supabase.from("balance_adjustments").select("id, user_id, amount, type, reason, admin_user_id, created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
        supabase.from("disputes").select("id, seller_user_id, transaction_id, amount, type, status, reason, created_at").eq("seller_user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
        supabase.from("retention_settings").select("id, user_id, pix_retention_pct, card_retention_pct, retention_days, card_release_days").eq("user_id", profile.user_id).maybeSingle(),
        supabase.from("ip_logs").select("ip, user_agent, country, source, created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(100),
      ]);
      if (requestId !== detailRequestRef.current) return;
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

      setAdminNotes(profile.admin_notes || "");
      if (retRes.data) {
        setUserRetention(retRes.data as RetentionSettings);
        setRetentionForm({
          pix_pct: String(retRes.data.pix_retention_pct ?? ""),
          card_pct: String(retRes.data.card_retention_pct ?? ""),
          days: String(retRes.data.retention_days ?? ""),
          card_release_days: String(retRes.data.card_release_days ?? 7),
        });
      } else {
        setUserRetention(null);
        setRetentionForm({ pix_pct: "", card_pct: "", days: "", card_release_days: "7" });
      }
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
      try {
        const { data: kycFiles } = await supabase.storage.from("kyc-documents").list(profile.user_id);
        if (kycFiles && kycFiles.length > 0) {
          const signedUrls = await Promise.all(
            kycFiles.map(async (f) => {
              const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(`${profile.user_id}/${f.name}`, 3600);
              return data?.signedUrl || null;
            })
          );
          if (requestId !== detailRequestRef.current) return;
          setKycImages(signedUrls.filter(Boolean) as string[]);
        } else setKycImages([]);
      } catch { setKycImages([]); }
    } catch (e) {
      if (requestId !== detailRequestRef.current) return;
      const msg = e instanceof Error ? e.message : "desconhecido";
      setDetailError("Não foi possível carregar a ficha completa. Tente novamente.");
      toast.error("Erro ao carregar dados do seller: " + msg);
    } finally {
      if (requestId === detailRequestRef.current) setLoading(false);
    }
  };

  const handleApproveKyc = async (userId: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.rpc("admin_approve_kyc", { _user_id: userId });
    if (error) { toast.error("Erro ao aprovar KYC"); return; }
    toast.success("KYC aprovado! Seller liberado.");
    reloadSeller();
    if (selectedUser?.user_id === userId) setSelectedUser(null);
  };

  const handleRejectKyc = async () => {
    if (!isAdmin) return;
    if (!kycRejectReason.trim()) { toast.error("Informe o motivo da recusa"); return; }
    const { error } = await supabase.rpc("admin_reject_kyc", { _user_id: rejectTargetUserId, _reason: kycRejectReason.trim() });
    if (error) { toast.error("Erro ao recusar KYC"); return; }
    toast.success("KYC recusado. Motivo registrado.");
    setShowRejectDialog(false);
    setKycRejectReason("");
    reloadSeller();
    if (selectedUser?.user_id === rejectTargetUserId) setSelectedUser(null);
  };

  const handleFreezeBalance = (userId: string, freeze: boolean) => {
    if (!isAdmin) return;
    const reason = window.prompt("Justificativa (mínimo 5 caracteres)");
    if (!reason || reason.trim().length < 5) return;
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
      if (error || !data?.success) { toast.error(data?.error || "Erro ao alterar verificação"); return; }
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
      if (error || !data?.success) { toast.error(data?.error || "Erro ao banir seller"); return; }
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
      if (error || !data?.success) { toast.error(data?.error || "Erro ao acessar como usuário"); return; }
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

  const handleSaveRetention = async () => {
    if (!selectedUser || !user || !isAdmin) return;
    if (!validateSellerNumbers(retentionForm, ["pix_pct", "card_pct"], ["days", "card_release_days"])) { toast.error("Informe percentuais de 0 a 100 e dias inteiros de 1 a 365"); return; }
    const payload = {
      user_id: selectedUser.user_id,
      pix_retention_pct: retentionForm.pix_pct ? Number(retentionForm.pix_pct) : 0,
      card_retention_pct: retentionForm.card_pct ? Number(retentionForm.card_pct) : 0,
      retention_days: retentionForm.days ? Number(retentionForm.days) : 14,
      card_release_days: retentionForm.card_release_days ? Number(retentionForm.card_release_days) : 7,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("retention_settings").upsert(payload, { onConflict: "user_id" });
    if (error) { toast.error("Erro ao salvar retenção"); return; }
    setUserRetention({ ...payload });
    toast.success("Rolling Reserve atualizado!");
    await logAdminAction("update_retention", "retention_settings", selectedUser.user_id, payload);
  };

  const handleSaveAdminNotes = async () => {
    if (!selectedUser || !isAdmin) return;
    const sanitized = adminNotes.replace(/[<>]/g, "").replace(/javascript:/gi, "").trim().slice(0, 5000);
    const { error } = await supabase.from("profiles").update({ admin_notes: sanitized }).eq("user_id", selectedUser.user_id);
    if (error) { toast.error("Erro ao salvar notas"); return; }
    toast.success("Observações salvas!");
    await logAdminAction("update_admin_notes", "profile", selectedUser.user_id, { notes: sanitized });
  };

  const handleUserStatus = async (userId: string, status: string) => {
    if (!isAdmin) { toast.error("Sem permissão"); return; }
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("user_id", userId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Conta ${status === "approved" ? "aprovada" : "bloqueada"}!`);
    await logAdminAction(status === "approved" ? "approve_user" : "block_user", "profile", userId, { new_status: status });
    reloadSeller();
  };

  const handleSetSellerType = async (userId: string, sellerType: string | null) => {
    if (!isAdmin) return;
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

  const handleResolveDispute = (disputeId: string, side: "seller" | "buyer") => {
    if (!isAdmin || !selectedUser) return;
    const profile = selectedUser;
    const reason = window.prompt("Justificativa da decisão (mínimo 5 caracteres)");
    if (!reason || reason.trim().length < 5) { toast.error("Informe uma justificativa válida"); return; }
    confirm(side === "seller" ? "Liberar o saldo retido desta disputa para o seller." : "Confirmar a perda da disputa, mantendo o débito do seller.", async () => {
      const { error } = await supabase.rpc("admin_resolve_dispute", { _dispute_id: disputeId, _outcome: side, _fee: 0, _note: reason.trim() });
      if (error) { toast.error(friendlyError(error)); return; }
      toast.success("Decisão registrada e saldo conciliado");
      reloadSeller(); await openUserDetail(profile);
    });
  };

  const handleDeletePixKey = async (pixKeyId: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Remover esta chave PIX do seller?")) return;
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
      {isAdmin ? <SellersDirectory range={dateRange} enabled={isAdmin} money={fmtCurrency} onOpen={async userId => {
        const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
        if (error || !data) { toast.error("Não foi possível abrir este seller"); return; }
        await openUserDetail(data);
      }} /> : <p className="p-6 text-muted-foreground">A gestão de sellers é exclusiva do dono.</p>}
      {sensitiveDialog}

      {/* ═══ KYC Reject Dialog ═══ */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="z-[120] max-w-md">
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
              <Button size="sm" variant="destructive" className="rounded-xl" disabled={!kycRejectReason.trim()} onClick={handleRejectKyc}>
                <Send className="h-3 w-3 mr-1" /> Enviar Recusa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Seller Detail Dialog ═══ */}
      <Dialog open={!!selectedUser} onOpenChange={v => { if (!v) { ++detailRequestRef.current; setSelectedUser(null); } }}>
        <DialogContent className="seller-detail-dialog z-[100] flex h-[min(92dvh,1000px)] w-[calc(100vw-32px)] max-w-6xl flex-col overflow-hidden rounded-lg border border-border p-0 gap-0">
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
                  <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
                    {selectedUser?.email}{selectedUser?.phone ? <> · <span className="font-mono">{selectedUser.phone}</span></> : null}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 break-all">
                    <Button variant="link"
                      onClick={() => { if (selectedUser?.user_id) { navigator.clipboard.writeText(selectedUser.user_id); toast.success("ID copiado"); } }}
                      className="h-auto p-0 text-[10px] text-muted-foreground"
                      title="Clique para copiar o ID completo"
                    >
                      ID {selectedUser?.user_id || "—"}
                    </Button>
                    <span className="text-muted-foreground/40"> · IP {selectedUser?.last_ip || "—"}</span>
                  </p>

                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:justify-end shrink-0">
                <Button size="sm" variant="outline" className="h-8 rounded-lg text-[11px] gap-1.5" onClick={() => selectedUser && handleImpersonate(selectedUser.user_id)} disabled={impersonating}>
                  <LogIn className="h-3 w-3" /> Login as
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
                {selectedUser?.account_status !== "approved" && (
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-[11px] gap-1.5 border-success/30 text-success hover:bg-success/10" onClick={() => handleApproveKyc(selectedUser?.user_id ?? "")}>
                    <CheckCircle2 className="h-3 w-3" /> Aprovar
                  </Button>
                )}
                {selectedUser && emailVerified !== true && (
                  <Button size="sm" variant="outline" disabled={emailVerifyLoading} className="h-8 rounded-lg text-[11px] gap-1.5 border-success/30 text-success hover:bg-success/10" onClick={() => handleSetEmailVerified(selectedUser.user_id, true)}>
                    <CheckCircle2 className="h-3 w-3" /> Verificar e-mail
                  </Button>
                )}
                {selectedUser && emailVerified !== false && (
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

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">


          {detailError ? <div role="alert" className="space-y-3 border border-destructive/30 p-5 text-sm text-destructive">{detailError}<Button variant="outline" onClick={() => selectedUser && openUserDetail(selectedUser)}>Tentar novamente</Button></div> : loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : (
            <>
              {(userTransactions.length >= 1000 || userWithdrawals.length >= 500 || userProducts.length >= 200 || userDisputes.length >= 200 || userLogs.length >= 300) && <p role="status" className="mb-4 text-xs text-warning">Históricos exibem os registros mais recentes: até 1.000 transações, 500 saques, 200 produtos/disputas e 300 logs. Os totais da Visão 360 usam todos os registros.</p>}
              <Tabs value={detailTab} onValueChange={setDetailTab} className="min-w-0">
                <TabsList className="seller-detail-tabs sticky top-0 z-10 flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-card p-1">
                  {[
                    { v: "overview", l: "Visão 360", i: Activity },
                    { v: "info", l: "Info & KYC", i: FileText },
                    { v: "notes", l: "Observações", i: MessageSquareText },
                    { v: "retention", l: "Rolling Reserve", i: Lock },
                    { v: "compliance", l: "Compliance", i: Shield },
                    { v: "disputes", l: `Disputas (${userMedTotal})`, i: AlertTriangle },
                    { v: "pix", l: "Chaves PIX", i: Key },
                    { v: "financial", l: "Financeiro", i: Wallet },
                    { v: "buyers", l: "Clientes", i: ShoppingCart },
                    { v: "logs", l: "Logs", i: Activity },
                    { v: "fees", l: "Taxas", i: CreditCard },
                  ].map(t => (
                    <TabsTrigger key={t.v} value={t.v} className="shrink-0 gap-1.5 rounded-md px-3 py-2 text-xs">
                      <t.i className="h-3 w-3" />{t.l}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                  {selectedUser && <Seller360Panel userId={selectedUser.user_id} onChanged={reloadSeller} />}
                </TabsContent>

                {/* ── Info & KYC ── */}
                <TabsContent value="info" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoRow label="Nome completo" value={selectedUser?.full_name} />
                    <InfoRow label="E-mail" value={selectedUser?.email} />
                    <InfoRow label="Telefone" value={selectedUser?.phone} />
                    <InfoRow label="Documento" value={piiRevealed ? (revealedDoc ?? selectedUser?.document_number) : maskDoc(selectedUser?.document_number)} mono />
                    <InfoRow label="Tipo documento" value={selectedUser?.document_type} />
                    <InfoRow label="Status conta" value={selectedUser?.account_status} />
                    <InfoRow label="Tipo Seller" value={selectedUser?.seller_type || "Não classificado"} />
                    <InfoRow label="Último IP" value={selectedUser?.last_ip} mono />
                    <InfoRow label="Cadastro" value={selectedUser ? new Date(selectedUser.created_at).toLocaleString("pt-BR") : ""} />
                    <InfoRow label="Saldo Congelado" value={selectedUser && isFrozen(selectedUser) ? "SIM" : "NÃO"} />
                    <InfoRow label="E-mail verificado" value={emailVerified === null ? "—" : emailVerified ? "SIM" : "NÃO"} />
                  </div>

                  {/* ── Histórico de IP ── */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      <Globe className="h-3 w-3" /> Histórico de IP ({ipHistory.length})
                    </p>
                    {ipHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70">Nenhum acesso registrado ainda.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {ipHistory.map((h, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-[11px] py-1.5 px-2 rounded-lg hover:bg-muted/30 border-b border-border/40 last:border-0">
                            <span className="font-mono text-foreground">{h.ip}</span>
                            <span className="text-muted-foreground/70 truncate max-w-[200px]" title={h.user_agent || ""}>{h.user_agent?.split(" ").slice(-2).join(" ") || "—"}</span>
                            <span className="text-[9px] uppercase font-bold text-muted-foreground/60 px-1.5 py-0.5 rounded bg-muted/50">{h.source || "login"}</span>
                            {h.country && <span className="text-[9px] uppercase font-bold text-info">{h.country}</span>}
                            <span className="text-muted-foreground/60 tabular-nums">{new Date(h.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>


                  {selectedUser?.kyc_rejection_reason && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                      <p className="text-xs font-bold text-destructive mb-1">Motivo da última recusa KYC:</p>
                      <p className="text-sm text-foreground">{selectedUser.kyc_rejection_reason}</p>
                    </div>
                  )}
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">Classificação do Seller</p>
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
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Métodos de Pagamento</p>
                    <p className="text-[10px] text-muted-foreground/70 mb-3">O bloqueio vale para produtos, links e checkouts públicos.</p>
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
                            <span className="text-xs font-bold text-foreground">{opt.label}</span>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                              enabled ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                            )}>
                              {enabled ? "Ativo" : "Bloqueado"}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  {kycImages.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Documentos KYC:</p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {kycImages.map((url, i) => {
                          const fileName = url.split("/").pop()?.split("?")[0] || "";
                          const label = fileName.startsWith("front") ? "Frente" : fileName.startsWith("back") ? "Verso" : fileName.startsWith("selfie") ? "Selfie" : fileName.startsWith("cnpj_card") ? "Cartão CNPJ" : `Doc ${i + 1}`;
                          return (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-colors">
                              <img src={url} alt={`KYC ${label}`} className="w-full h-40 object-cover" />
                              <div className="px-3 py-2 bg-muted/20 text-center">
                                <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                      {selectedUser?.document_type === "cnpj" && !kycImages.some(url => url.includes("cnpj_card")) && (
                        <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-warning/5 border border-warning/15">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                          <p className="text-[10px] text-warning font-medium">Seller é CNPJ mas não enviou o Cartão CNPJ.</p>
                        </div>
                      )}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">Nenhum documento KYC enviado</p>}
                </TabsContent>

                {/* ── Observações Admin ── */}
                <TabsContent value="notes" className="mt-4 space-y-4">
                  <PremiumPanel title="Observações sobre o Seller" icon={MessageSquareText}>
                    <div className="space-y-3">
                      <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={8}
                        placeholder="Escreva observações, anotações internas, histórico de comunicação..."
                        className="w-full px-4 py-3 bg-muted/20 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30 resize-none" />
                      <Button size="sm" variant="outline" className="rounded-xl text-xs border-primary/30 text-primary" onClick={handleSaveAdminNotes}>
                        <Save className="h-3 w-3 mr-1" /> Salvar Observações
                      </Button>
                    </div>
                  </PremiumPanel>
                </TabsContent>

                {/* ── Rolling Reserve ── */}
                <TabsContent value="retention" className="mt-4 space-y-4">
                  <PremiumPanel title="Rolling Reserve (Retenção de Segurança)" icon={Lock}>
                    <p className="text-xs text-muted-foreground mb-4">
                      Reserva de segurança (% retido por X dias) e janela de liberação do cartão (D+N). Deixe em branco para usar o global.
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Retenção PIX (%)</Label>
                        <NumberInput step={0.1} min={0} max={100} value={retentionForm.pix_pct}
                          onChange={v => setRetentionForm(p => ({ ...p, pix_pct: v }))}
                          placeholder="0" className="mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Retenção Cartão (%)</Label>
                        <NumberInput step={0.1} min={0} max={100} value={retentionForm.card_pct}
                          onChange={v => setRetentionForm(p => ({ ...p, card_pct: v }))}
                          placeholder="5" className="mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Dias Reserva</Label>
                        <NumberInput min={1} max={365} value={retentionForm.days}
                          onChange={v => setRetentionForm(p => ({ ...p, days: v }))}
                          placeholder="14" className="mt-1 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Liberação Cartão</Label>
                        <Select value={retentionForm.card_release_days} onValueChange={v => setRetentionForm(p => ({ ...p, card_release_days: v }))}>
                          <SelectTrigger className="mt-1 h-9 text-xs rounded-xl bg-muted/30 border-border"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[130]">
                            <SelectItem value="1">D+1</SelectItem>
                            <SelectItem value="7">D+7 (padrão)</SelectItem>
                            <SelectItem value="15">D+15</SelectItem>
                            <SelectItem value="30">D+30</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {userRetention && (
                      <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                        Atual: PIX {userRetention.pix_retention_pct}% | Cartão {userRetention.card_retention_pct}% | {userRetention.retention_days}d reserva | Liberação cartão D+{userRetention.card_release_days ?? 7}
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="rounded-xl text-xs border-primary/30 text-primary mt-4" onClick={handleSaveRetention}>
                      <Save className="h-3 w-3 mr-1" /> Salvar Rolling Reserve
                    </Button>
                  </PremiumPanel>
                </TabsContent>

                {/* ── Disputas do Seller ── */}
                <TabsContent value="disputes" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <MiniKpi label="Total Disputas" value={String(userMedTotal)} tone="warning" />
                    <MiniKpi label="Abertas" value={String(userMedOpen)} tone="warning" />
                    <MiniKpi label="Resolvidas" value={String(userMedResolved)} tone="success" />
                    <MiniKpi label="Valor Total" value={fmtCurrency(userMedAmount)} tone="warning" />
                    <MiniKpi label="Ocorrências (%)" value={`${userMedRate}%`} tone="info" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "MedPix", count: userDisputes.filter(d => d.type === "medpix").length, amount: userDisputes.filter(d => d.type === "medpix").reduce((a, d) => a + Number(d.amount || 0), 0), tone: "text-warning" },
                      { label: "Pre-Med PIX", count: userDisputes.filter(d => d.type === "pre_med_pix").length, amount: userDisputes.filter(d => d.type === "pre_med_pix").reduce((a, d) => a + Number(d.amount || 0), 0), tone: "text-warning" },
                      { label: "Reembolso", count: userDisputes.filter(d => d.type === "refund").length, amount: userDisputes.filter(d => d.type === "refund").reduce((a, d) => a + Number(d.amount || 0), 0), tone: "text-destructive" },
                    ].map(dt => (
                      <div key={dt.label} className="rounded-xl border border-border bg-muted/20 p-4 text-center">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{dt.label}</p>
                        <p className={`font-display text-xl font-black mt-1 ${dt.tone}`}>{dt.count}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{fmtCurrency(dt.amount)}</p>
                      </div>
                    ))}
                  </div>
                  <PremiumPanel title="Histórico de Disputas" icon={AlertTriangle}>
                    <div className={premiumTable.wrapper}>
                      <table className={premiumTable.table}>
                        <thead>
                          <tr className={premiumTable.headRow}>
                            {["Tipo", "Valor", "Status", "Comprador", "Motivo", "Data", "Ações"].map(h => <th key={h} className={premiumTable.th}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {userDisputes.map(d => {
                            const isOpen = d.status === "open" || d.status === "in_review" || d.status === "pending_recorrer";
                            return (
                              <tr key={d.id} className={premiumTable.row}>
                                <td className={premiumTable.td}><span className="text-[10px] font-bold uppercase text-foreground">{d.type}</span></td>
                                <td className={premiumTable.td}><span className="font-display text-[12px] font-black tabular-nums text-warning">{fmtCurrency(Number(d.amount))}</span></td>
                                <td className={premiumTable.td}><StatusBadge status={d.status} /></td>
                                <td className={premiumTable.td}><span className="text-[11px] text-muted-foreground">{d.buyer_name || "—"}</span></td>
                                <td className={premiumTable.td}><span className="text-[11px] text-muted-foreground max-w-[200px] truncate block">{d.reason || "—"}</span></td>
                                <td className={premiumTable.td}><span className="text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")}</span></td>
                                <td className={premiumTable.td}>
                                  {isOpen ? (
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg border-success/30 text-success" onClick={() => handleResolveDispute(d.id, "seller")}>
                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Seller
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg border-destructive/30 text-destructive" onClick={() => handleResolveDispute(d.id, "buyer")}>
                                        <XCircle className="h-3 w-3 mr-1" /> Comprador
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {userDisputes.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">Sem disputas</td></tr>}
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
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{pk.key_type}</p>
                              <p className="break-all text-sm font-mono text-foreground mt-0.5">{displayPixKey(pk.key_value, pk.key_type)}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{new Date(pk.created_at).toLocaleDateString("pt-BR")}</p>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePixKey(pk.id)} title="Remover chave">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedUser?.pix_key && (
                      <div className="mt-4 rounded-xl border border-warning/15 bg-warning/5 p-3">
                        <p className="text-[10px] text-warning font-bold mb-1">PIX Legado (perfil)</p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {selectedUser.pix_key_type}: {piiRevealed ? (revealedLegacyPix ?? selectedUser.pix_key) : maskPixValue(selectedUser.pix_key)}
                        </p>
                      </div>
                    )}
                  </PremiumPanel>
                </TabsContent>


                {/* ── Financeiro ── */}
                <TabsContent value="financial" className="mt-4 space-y-4">
                  {selectedUser && <BalanceAdjustCard userId={selectedUser.user_id} onDone={() => { reloadSeller(); if (selectedUser) void openUserDetail(selectedUser); }} />}
                  {balanceAdjustments.length > 0 && (
                    <PremiumPanel title="Histórico de Ajustes" icon={DollarSign}>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {balanceAdjustments.map(adj => (
                          <div key={adj.id} className="flex items-center justify-between text-[11px] py-2 border-b border-border/50">
                            <div>
                              <span className={adj.type === "credit" ? "text-success font-bold" : "text-destructive font-bold"}>
                                {adj.type === "credit" ? "+" : "-"} R$ {Number(adj.amount).toFixed(2)}
                              </span>
                              <span className="text-muted-foreground ml-2">{adj.reason}</span>
                            </div>
                            <span className="text-muted-foreground">{new Date(adj.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                        ))}
                      </div>
                    </PremiumPanel>
                  )}
                  {selectedUser && <SellerWithdrawalsSection userId={selectedUser.user_id} onChanged={reloadSeller} />}
                </TabsContent>

                {/* ── Compliance ── */}
                <TabsContent value="compliance" className="mt-4 space-y-5">
                  <PremiumPanel title={`Produtos cadastrados (${userProducts.length})`} icon={Package}>
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
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {p.id}</p>
                              </div>
                              <p className="font-display text-lg font-black text-primary">R$ {Number(p.price).toFixed(2)}</p>
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
                                <div key={k.l} className="bg-muted/20 rounded-lg p-2 text-center border border-border/50">
                                  <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{k.l}</p>
                                  <p className={`text-xs font-black mt-0.5 ${k.c}`}>{k.v}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </PremiumPanel>

                  {deletedProducts.length > 0 && (
                    <PremiumPanel title={`Produtos Excluídos (${deletedProducts.length})`} icon={Trash2}>
                      <div className="space-y-2">
                        {deletedProducts.map((dp, i) => (
                          <div key={i} className="rounded-xl border border-destructive/15 bg-destructive/5 p-3">
                            <p className="text-sm font-bold text-destructive">{dp.name}</p>
                            <p className="text-[10px] text-muted-foreground">Preço: R$ {Number(dp.price).toFixed(2)} • Excluído em {new Date(dp.deletedAt).toLocaleString("pt-BR")}</p>
                          </div>
                        ))}
                      </div>
                    </PremiumPanel>
                  )}

                  <PremiumPanel title="Resumo de Compliance" icon={BarChart3}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <MiniKpi label="Produtos Ativos" value={String(userProducts.filter(product => product.status === "active").length)} tone="success" />
                      <MiniKpi label="Produtos Excluídos" value={String(deletedProducts.length)} tone="warning" />
                      <MiniKpi label="Transações Totais" value={String(userTransactions.length)} tone="info" />
                      <MiniKpi label="Taxa Estorno" value={`${userTransactions.length > 0 ? ((userTransactions.filter(t => t.status === "refunded" || t.status === "chargeback").length / userTransactions.length) * 100).toFixed(2) : "0.00"}%`} tone="warning" />
                    </div>
                  </PremiumPanel>
                </TabsContent>

                {/* ── Clientes ── */}
                <TabsContent value="buyers" className="mt-4">
                  <div className={premiumTable.wrapper}>
                    <table className={premiumTable.table}>
                      <thead>
                        <tr className={premiumTable.headRow}>
                          {["Cliente", "Contato", "Doc", "Compras", "Total", "Última", "Ações"].map(h => <th key={h} className={premiumTable.th}>{h}</th>)}
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
                                  <span className="text-[12px] font-bold text-foreground">{b.name || "—"}</span>
                                  <span className="text-[10px] text-muted-foreground">{b.email || "—"}</span>
                                </div>
                              </td>
                              <td className={premiumTable.td}><span className="text-[11px] text-muted-foreground font-mono">{b.phone || "—"}</span></td>
                              <td className={premiumTable.td}><span className="text-[10px] text-muted-foreground font-mono">{b.document || "—"}</span></td>
                              <td className={premiumTable.td}><span className="text-[11px] font-bold text-foreground bg-muted/30 px-2 py-0.5 rounded-md">{b.count}</span></td>
                              <td className={premiumTable.td}><span className="font-display text-[13px] font-black tabular-nums text-primary">{fmtCurrency(b.total)}</span></td>
                              <td className={premiumTable.td}><span className="text-[10px] text-muted-foreground tabular-nums">{b.lastAt ? new Date(b.lastAt).toLocaleDateString("pt-BR") : "—"}</span></td>
                              <td className={premiumTable.td}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem
                                      disabled={!lastCompleted}
                                      onClick={async () => {
                                        if (!lastCompleted || !selectedUser || !isAdmin) return;
                                        const profile = selectedUser;
                                        const reason = window.prompt("Motivo do reembolso (mínimo 5 caracteres)");
                                        if (!reason || reason.trim().length < 5) return;
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
                                        const reason = window.prompt("Motivo da reclamação da adquirente (mínimo 5 caracteres)");
                                        if (!reason || reason.trim().length < 5) return;
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
                                        const reason = window.prompt("Motivo da blacklist:", "Comportamento abusivo");
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
                                        const reason = window.prompt(`Motivo da blacklist (${type.toUpperCase()}):`, "Fraude confirmada");
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
                        {buyers.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">Nenhum cliente</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-2 px-1">Reembolsos seguem para aprovação manual; MED PIX e chargebacks retêm o valor da venda com registro auditável.</p>
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
                                  {Object.entries(log.old_data).map(([k, v]) => (<div key={k}><span className="text-muted-foreground">{k}:</span> <span className="text-foreground">{String(v)}</span></div>))}
                                </div>
                              )}
                              {log.old_data && log.new_data && log.action.includes("updated") && (
                                <div className="mt-2 rounded-lg bg-info/5 border border-info/10 p-2 text-[10px] space-y-0.5">
                                  {Object.keys(log.new_data).map(k => {
                                    if (log.old_data?.[k] === log.new_data?.[k]) return null;
                                    return (<div key={k}><span className="text-muted-foreground">{k}:</span> <span className="line-through text-destructive/50">{String(log.old_data?.[k] ?? "—")}</span> → <span className="text-primary">{String(log.new_data?.[k] ?? "—")}</span></div>);
                                  })}
                                </div>
                              )}
                              {log.new_data && log.action.includes("created") && (
                                <div className="mt-2 rounded-lg bg-primary/5 border border-primary/10 p-2 text-[10px]">
                                  {Object.entries(log.new_data).map(([k, v]) => (<div key={k}><span className="text-muted-foreground">{k}:</span> <span className="text-foreground">{String(v)}</span></div>))}
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
                  <PremiumPanel title="Taxas Personalizadas" eyebrow="Override por seller" icon={CreditCard}>
                    <p className="text-[11px] text-muted-foreground mb-4">Em branco = usa a taxa padrão da plataforma</p>
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-success">PIX</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">PIX — Percentual (%)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.pix_percentage}
                              onChange={v => setCustomFees(p => ({ ...p, pix_percentage: v }))}
                              placeholder="4.99" className="mt-1 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">PIX — Fixa (R$)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.pix_fixed}
                              onChange={v => setCustomFees(p => ({ ...p, pix_fixed: v }))}
                              placeholder="3.99" className="mt-1 text-xs" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-info">Cartão</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Cartão — Percentual (%)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.card_percentage}
                              onChange={v => setCustomFees(p => ({ ...p, card_percentage: v }))}
                              placeholder="5.99" className="mt-1 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Cartão — Fixa (R$)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.card_fixed}
                              onChange={v => setCustomFees(p => ({ ...p, card_fixed: v }))}
                              placeholder="0.00" className="mt-1 text-xs" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-warning">Boleto</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Boleto — Percentual (%)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.boleto_percentage}
                              onChange={v => setCustomFees(p => ({ ...p, boleto_percentage: v }))}
                              placeholder="0.00" className="mt-1 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Boleto — Fixa (R$)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.boleto_fixed}
                              onChange={v => setCustomFees(p => ({ ...p, boleto_fixed: v }))}
                              placeholder="3.49" className="mt-1 text-xs" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-warning">Saque</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Saque PIX (R$)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.withdrawal_fee}
                              onChange={v => setCustomFees(p => ({ ...p, withdrawal_fee: v }))}
                              placeholder="5.00" className="mt-1 text-xs" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-success">Limites Operacionais</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Ticket Máximo (R$)</Label>
                            <NumberInput step={0.01} min={0} value={customFees.max_ticket}
                              onChange={v => setCustomFees(p => ({ ...p, max_ticket: v }))}
                              placeholder="10000.00" className="mt-1 text-xs" />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Em vigor: <span className="font-mono text-foreground">R$ {(effectiveMaxTicket ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs border-primary/30 text-primary" onClick={handleSaveCustomFees}>
                        <Save className="h-3 w-3 mr-1" /> Salvar Taxas
                      </Button>
                    </div>
                  </PremiumPanel>
                </TabsContent>
              </Tabs>
            </>
          )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="group/info relative overflow-hidden rounded-xl border border-border bg-card p-3 transition-all duration-200 hover:border-primary/40 hover:-translate-y-px hover:bg-muted/20">
      <span className="absolute inset-y-0 left-0 w-0.5 bg-primary scale-y-0 group-hover/info:scale-y-100 transition-transform duration-300 origin-top" />
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 mb-1">{label}</p>
      <p className={`break-words text-[12px] font-semibold ${mono ? "font-mono" : ""} ${value ? "text-foreground" : "text-muted-foreground/50 italic"}`}>{value || "Não informado"}</p>
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
  const barCls: Record<MiniTone, string> = {
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-info",
    primary: "bg-primary",
    destructive: "bg-destructive",
    neutral: "bg-foreground/40",
  };
  return (
    <div className="group/kpi relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/20">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">{label}</p>
      <p className={`font-display text-[19px] font-black mt-1 tabular-nums leading-tight ${valueCls[tone]}`}>{value}</p>
      <span className={cn("absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-300 group-hover/kpi:scale-x-100", barCls[tone])} />
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
