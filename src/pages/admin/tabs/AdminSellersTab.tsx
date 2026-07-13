import { useState, useEffect } from "react";
import { NumberInput } from "@/components/ui/number-input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, Search, Ban, CheckCircle2, Eye, MoreHorizontal, Activity, Package,
  Trash2, Edit, Plus, Clock, Wallet, ArrowDownToLine, ShoppingCart,
  FileText, Globe, DollarSign, XCircle, Save, CreditCard, Shield, Landmark,
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
import { cn } from "@/lib/utils";
import { z } from "zod";
import { friendlyError } from "@/lib/friendlyError";

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

interface Acquirer {
  id: string; name: string; slug: string; type: string; is_active: boolean;
}

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
  set_seller_acquirer: { label: "Adquirente Alterada", color: "text-info", icon: Landmark },
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
}

export default function AdminSellersTab({ profiles, transactions, withdrawals, onReload, fmtCurrency, isAdmin = false }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sellerFilter, setSellerFilter] = useState<"all" | "white" | "black" | "unset" | "kyc" | "frozen" | "blocked" | "rejected" | "approved">("all");
  const [selectedUser, setSelectedUser] = useState<Tables<"profiles"> | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);
  const [piiRevealed, setPiiRevealed] = useState(false);
  const [revealedDoc, setRevealedDoc] = useState<string | null>(null);
  const [revealedPixKeys, setRevealedPixKeys] = useState<PixKey[] | null>(null);
  const [revealedLegacyPix, setRevealedLegacyPix] = useState<string | null>(null);
  const [sellerBalances, setSellerBalances] = useState<Map<string, number>>(new Map());
  const [userLogs, setUserLogs] = useState<ActivityLog[]>([]);
  const [userProducts, setUserProducts] = useState<Tables<"products">[]>([]);
  const [userWithdrawals, setUserWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [userTransactions, setUserTransactions] = useState<Tables<"transactions">[]>([]);
  const [userPixKeys, setUserPixKeys] = useState<PixKey[]>([]);
  const [customFees, setCustomFees] = useState({ pix_percentage: "", pix_fixed: "", card_percentage: "", card_fixed: "", boleto_percentage: "", boleto_fixed: "", withdrawal_fee: "", max_ticket: "" });
  const [effectiveMaxTicket, setEffectiveMaxTicket] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustReason, setAdjustReason] = useState("");
  const [balanceAdjustments, setBalanceAdjustments] = useState<BalanceAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [kycImages, setKycImages] = useState<string[]>([]);
  const [acquirers, setAcquirers] = useState<Acquirer[]>([]);
  const [selectedAcquirerId, setSelectedAcquirerId] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState("");
  const [userDisputes, setUserDisputes] = useState<Dispute[]>([]);
  const [kycRejectReason, setKycRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTargetUserId, setRejectTargetUserId] = useState<string>("");
  const [userRetention, setUserRetention] = useState<RetentionSettings | null>(null);
  const [retentionForm, setRetentionForm] = useState({ pix_pct: "", card_pct: "", days: "", card_release_days: "7" });
  const [impersonating, setImpersonating] = useState(false);
  const [ipHistory, setIpHistory] = useState<IpLog[]>([]);


  useEffect(() => {
    supabase.from("acquirers").select("id, name, slug, type, is_active").eq("is_active", true).then(({ data }) => {
      if (data) setAcquirers(data as Acquirer[]);
    });
    // Canonical seller balances (same fórmula do painel do vendedor)
    supabase.rpc("admin_get_seller_balances").then(({ data, error }) => {
      if (error) { console.warn("[AdminSellersTab] balances RPC failed", error.message); return; }
      const m = new Map<string, number>();
      (data || []).forEach((row: { user_id: string; balance: number | string }) =>
        m.set(row.user_id, Number(row.balance) || 0)
      );
      setSellerBalances(m);
    });
  }, []);

  const revealPii = async () => {
    if (!selectedUser) return;
    try {
      const [{ data: revealed }, { data: pixData }] = await Promise.all([
        supabase.rpc("admin_reveal_profile", { _user_id: selectedUser.user_id }),
        supabase.rpc("admin_reveal_pix_keys", { _user_id: selectedUser.user_id }),
      ]);
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
    setSelectedUser(profile);
    setLoading(true);
    setEmailVerified(null);
    supabase.functions
      .invoke("admin-set-email-verified", { body: { targetUserId: profile.user_id, action: "status" } })
      .then(({ data }) => {
        if (data?.success) setEmailVerified(!!data.verified);
      })
      .catch(() => { /* silent */ });
    setUserLogs([]); setUserProducts([]); setUserWithdrawals([]);
    setUserTransactions([]); setUserPixKeys([]); setUserDisputes([]);
    setBalanceAdjustments([]); setKycImages([]); setIpHistory([]);
    setUserRetention(null); setRetentionForm({ pix_pct: "", card_pct: "", days: "", card_release_days: "7" });
    setAdminNotes(""); setSelectedAcquirerId("");
    setPiiRevealed(false); setRevealedDoc(null); setRevealedPixKeys(null); setRevealedLegacyPix(null);

    try {
      const [logsRes, productsRes, wdRes, txRes, feesRes, adjRes, disputesRes, retRes, ipRes] = await Promise.all([
        supabase.from("activity_logs").select("id, user_id, action, entity_type, entity_id, old_data, new_data, created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(300),
        supabase.from("products").select("id, user_id, name, price, status, created_at, image_url").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
        supabase.from("withdrawals").select("id, user_id, amount, fee_amount, net_amount, status, created_at, withdrawal_type").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(500),
        supabase.from("transactions").select("id, user_id, product_id, amount, fee_amount, net_amount, status, payment_method, customer_name, customer_email, customer_phone, customer_document, created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(1000),
        supabase.from("custom_user_fees").select("id, user_id, pix_percentage, pix_fixed, card_percentage, card_fixed, boleto_percentage, boleto_fixed, withdrawal_fee, max_ticket, admin_user_id").eq("user_id", profile.user_id).maybeSingle(),
        supabase.from("balance_adjustments").select("id, user_id, amount, type, reason, admin_user_id, created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
        supabase.from("disputes").select("id, seller_user_id, transaction_id, amount, type, status, reason, created_at").eq("seller_user_id", profile.user_id).order("created_at", { ascending: false }).limit(200),
        supabase.from("retention_settings").select("id, user_id, pix_retention_pct, card_retention_pct, retention_days, card_release_days").eq("user_id", profile.user_id).maybeSingle(),
        supabase.from("ip_logs").select("ip, user_agent, country, source, created_at").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(100),
      ]);
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
      // Sensitive PIX keys are NOT auto-revealed; admin must click "Revelar dados".
      setUserPixKeys([]);

      setSelectedAcquirerId(profile.acquirer_id || "");
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
          setKycImages(signedUrls.filter(Boolean) as string[]);
        } else setKycImages([]);
      } catch { setKycImages([]); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "desconhecido";
      toast.error("Erro ao carregar dados do seller: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveKyc = async (userId: string) => {
    const { error } = await supabase.rpc("admin_approve_kyc", { _user_id: userId });
    if (error) { toast.error("Erro ao aprovar KYC"); return; }
    toast.success("KYC aprovado! Seller liberado.");
    onReload();
    if (selectedUser?.user_id === userId) setSelectedUser(null);
  };

  const handleRejectKyc = async () => {
    if (!kycRejectReason.trim()) { toast.error("Informe o motivo da recusa"); return; }
    const { error } = await supabase.rpc("admin_reject_kyc", { _user_id: rejectTargetUserId, _reason: kycRejectReason.trim() });
    if (error) { toast.error("Erro ao recusar KYC"); return; }
    toast.success("KYC recusado. Motivo registrado.");
    setShowRejectDialog(false);
    setKycRejectReason("");
    onReload();
    if (selectedUser?.user_id === rejectTargetUserId) setSelectedUser(null);
  };

  const handleFreezeBalance = async (userId: string, freeze: boolean) => {
    const { error } = await supabase.rpc("admin_freeze_account", { _user_id: userId, _freeze: freeze, _reason: null });
    if (error) { toast.error("Erro ao alterar status"); return; }
    toast.success(freeze ? "Saldo congelado! Saques bloqueados." : "Saldo descongelado! Saques liberados.");
    onReload();
  };

  const handleSetEmailVerified = async (userId: string, verified: boolean) => {
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

  const handleBanSeller = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("admin-ban-seller", { body: { targetUserId: userId } });
    if (error || !data?.success) { toast.error(data?.error || "Erro ao banir seller"); return; }
    toast.success("Seller banido! Conta bloqueada, saldo congelado e checkouts suspensos.");
    await logAdminAction("ban_seller", "profile", userId, { action: "atomic_block+freeze+suspend" });
    onReload();
    if (selectedUser?.user_id === userId) setSelectedUser(null);
  };

  const handleImpersonate = async (userId: string) => {
    setImpersonating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-impersonate", { body: { targetUserId: userId } });
      if (error || !data?.success) { toast.error(data?.error || "Erro ao acessar como usuário"); return; }
      const { access_token, refresh_token, target_email, target_name, target_user_id } = data;
      if (!access_token || !refresh_token) { toast.error("Tokens de impersonação não disponíveis"); return; }
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
            access_token,
            refresh_token,
            target_email,
            target_name,
            target_user_id,
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
    if (!selectedUser || !user) return;
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
    toast.success("Rolling Reserve atualizado!");
    await logAdminAction("update_retention", "retention_settings", selectedUser.user_id, payload);
  };

  const handleSaveAdminNotes = async () => {
    if (!selectedUser) return;
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
    onReload();
  };

  const handleSetSellerType = async (userId: string, sellerType: string | null) => {
    const { error } = await supabase.from("profiles").update({ seller_type: sellerType }).eq("user_id", userId);
    if (error) { toast.error("Erro ao classificar seller"); return; }
    toast.success(`Seller classificado como ${sellerType || "sem classificação"}!`);
    await logAdminAction("set_seller_type", "profile", userId, { seller_type: sellerType });
    onReload();
  };

  const handleSetAcquirer = async (userId: string, acquirerId: string | null) => {
    const { error } = await supabase.from("profiles").update({ acquirer_id: acquirerId }).eq("user_id", userId);
    if (error) { toast.error("Erro ao definir adquirente"); return; }
    const acqName = acquirers.find(a => a.id === acquirerId)?.name || "Padrão";
    toast.success(`Adquirente definida: ${acqName}`);
    await logAdminAction("set_seller_acquirer", "profile", userId, { acquirer_id: acquirerId });
    setSelectedAcquirerId(acquirerId || "");
  };

  const handleSaveCustomFees = async () => {
    if (!selectedUser || !user) return;
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
    const status = side === "seller" ? "resolved_seller" : "resolved_buyer";
    const label = side === "seller" ? "Vitória do seller — saldo devolvido." : "Vitória do comprador — débito mantido.";
    if (!window.confirm(side === "seller" ? "Confirmar vitória do seller? O saldo retido será devolvido." : "Confirmar vitória do comprador? O débito será mantido e a transação marcada como chargeback.")) return;
    const { error } = await supabase.from("disputes").update({ status, resolved_at: new Date().toISOString() }).eq("id", disputeId);
    if (error) { toast.error("Erro ao resolver disputa: " + friendlyError(error)); return; }
    toast.success(label);
    await logAdminAction(`resolve_dispute_${side}`, "dispute", disputeId, { status });
    if (selectedUser) {
      const { data } = await supabase.from("disputes").select("id, seller_user_id, transaction_id, amount, type, status, reason, created_at").eq("seller_user_id", selectedUser.user_id).order("created_at", { ascending: false }).limit(50);
      if (data) setUserDisputes(data as Dispute[]);
    }
    onReload();
  };

  const handleDeletePixKey = async (pixKeyId: string) => {
    if (!window.confirm("Remover esta chave PIX do seller?")) return;
    const { error } = await supabase.from("pix_keys").delete().eq("id", pixKeyId);
    if (error) { toast.error("Erro ao remover chave: " + friendlyError(error)); return; }
    toast.success("Chave PIX removida.");
    await logAdminAction("delete_pix_key", "pix_key", pixKeyId);
    setUserPixKeys(prev => prev.filter(k => k.id !== pixKeyId));
  };

  const handleBalanceAdjustment = async () => {
    if (!selectedUser || !user || !adjustAmount || !adjustReason) { toast.error("Preencha todos os campos"); return; }
    const amount = Number(adjustAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Valor deve ser positivo"); return; }
    if (amount > 1000000) { toast.error("Valor máximo excedido (R$ 1.000.000)"); return; }
    const sanitizedReason = adjustReason.replace(/[<>]/g, "").trim().slice(0, 500);
    if (sanitizedReason.length < 3) { toast.error("Justificativa muito curta (mín. 3 caracteres)"); return; }
    if (amount > 10000 && !window.confirm(`Confirma ajuste de R$ ${amount.toFixed(2)} (${adjustType})?`)) return;
    const { error } = await supabase.from("balance_adjustments").insert({
      user_id: selectedUser.user_id, admin_user_id: user.id,
      amount, type: adjustType, reason: sanitizedReason,
    });
    if (error) { toast.error("Erro ao ajustar saldo"); return; }
    toast.success(`Saldo ${adjustType === "credit" ? "creditado" : "debitado"}!`);
    await logAdminAction(`balance_${adjustType}`, "balance_adjustment", selectedUser.user_id, { amount: adjustAmount, reason: sanitizedReason });
    setAdjustAmount(""); setAdjustReason("");
    const { data } = await supabase.from("balance_adjustments").select("*").eq("user_id", selectedUser.user_id).order("created_at", { ascending: false });
    if (data) setBalanceAdjustments(data);
    onReload();
  };

  // ── Filtering ──
  const kycPendingProfiles = profiles.filter(p => p.account_status === "pending_review" || p.account_status === "pending");
  const filtered = profiles.filter((p) => {
    const st = p.seller_type;
    if (sellerFilter === "kyc" && !(p.account_status === "pending_review" || p.account_status === "pending")) return false;
    if (sellerFilter === "white" && st !== "white") return false;
    if (sellerFilter === "black" && st !== "black") return false;
    if (sellerFilter === "unset" && st != null) return false;
    if (sellerFilter === "frozen" && p.balance_frozen !== true) return false;
    if (sellerFilter === "blocked" && p.account_status !== "blocked") return false;
    if (sellerFilter === "rejected" && p.account_status !== "rejected") return false;
    if (sellerFilter === "approved" && p.account_status !== "approved") return false;
    if (!search) return true;
    const s = search.toLowerCase();
    const digits = search.replace(/\D/g, "");
    const docDigits = (p.document_number || "").replace(/\D/g, "");
    return (p.full_name?.toLowerCase().includes(s))
      || (p.email?.toLowerCase().includes(s))
      || (digits.length > 0 && docDigits.includes(digits));
  });

  const whiteCount = profiles.filter(p => p.seller_type === "white").length;
  const blackCount = profiles.filter(p => p.seller_type === "black").length;
  const unsetCount = profiles.filter(p => p.seller_type == null).length;
  const frozenCount = profiles.filter(p => p.balance_frozen === true).length;
  const blockedCount = profiles.filter(p => p.account_status === "blocked").length;
  const rejectedCount = profiles.filter(p => p.account_status === "rejected").length;
  const approvedCount = profiles.filter(p => p.account_status === "approved").length;

  // Top movers do dia (sellers que mais movimentaram hoje)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayMovers = (() => {
    const byUser = new Map<string, { gross: number; count: number }>();
    for (const t of transactions) {
      if (!t.created_at || new Date(t.created_at) < todayStart) continue;
      if (t.status !== "completed" && t.status !== "approved") continue;
      const cur = byUser.get(t.user_id) || { gross: 0, count: 0 };
      cur.gross += Number(t.amount); cur.count += 1;
      byUser.set(t.user_id, cur);
    }
    return Array.from(byUser.entries())
      .map(([user_id, s]) => ({ user_id, ...s, profile: profiles.find(p => p.user_id === user_id) }))
      .filter(m => m.profile)
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 8);
  })();

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

  const deletedProducts = userLogs.filter(l => l.action === "product_deleted").map(l => {
    const od = deletedProductDataSchema.safeParse(l.old_data ?? {});
    const data = od.success ? od.data : {};
    return {
      id: l.entity_id, name: data.name || "Desconhecido", price: data.price ?? 0,
      deletedAt: l.created_at, data: l.old_data,
    };
  });

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
  const userMedAmount = userDisputes.reduce((a, d) => a + Number(d.amount || 0), 0);
  const userMedRate = userApproved.length > 0 ? ((userMedTotal / userApproved.length) * 100).toFixed(2) : "0.00";

  type BuyerEntry = { name: string; email: string; phone: string; document: string; total: number; count: number; txs: Tables<"transactions">[]; lastAt: string };
  const buyersMap = new Map<string, BuyerEntry>();
  userTransactions.forEach(t => {
    const key = t.customer_email || t.customer_document || t.customer_name || "unknown";
    const existing: BuyerEntry = buyersMap.get(key) || { name: t.customer_name || "", email: t.customer_email || "", phone: t.customer_phone || "", document: t.customer_document || "", total: 0, count: 0, txs: [], lastAt: "" };
    existing.total += Number(t.amount); existing.count += 1;
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
      <FinanceiroHero
        eyebrow="Plataforma · Sellers"
        title="Vendedores"
        subtitle="Aprove KYC, classifique tiers, monitore saldo e gerencie acesso da base."
        status={{ tone: kycPendingProfiles.length > 0 ? "warning" : "success", label: `${profiles.length} cadastrados`, pulse: kycPendingProfiles.length > 0 }}
      />

      {/* ── KPI strip · clickable filters ── */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-4 xl:grid-cols-8 animate-fade-in stagger-1">
        <SellerKpi icon={Users}          label="Total"          value={String(profiles.length)}            sub="Base ativa"          tone="neutral"     active={sellerFilter === "all"}   onClick={() => setSellerFilter("all")} />
        <SellerKpi icon={FileText}       label="KYC Pendente"   value={String(kycPendingProfiles.length)}  sub="Aguardando análise"  tone="warning"     active={sellerFilter === "kyc"}   onClick={() => setSellerFilter("kyc")} />
        <SellerKpi icon={Shield}         label="Black"          value={String(blackCount)}                 sub="High-volume"          tone="neutral"     active={sellerFilter === "black"} onClick={() => setSellerFilter("black")} />
        <SellerKpi icon={CheckCircle2}   label="White"          value={String(whiteCount)}                 sub="Tier regulado"        tone="info"        active={sellerFilter === "white"} onClick={() => setSellerFilter("white")} />
        <SellerKpi icon={AlertTriangle}  label="Sem Tier"       value={String(unsetCount)}                 sub="Não classificados"    tone="warning"     active={sellerFilter === "unset"} onClick={() => setSellerFilter("unset")} />
        <SellerKpi icon={Snowflake}      label="Congelados"     value={String(frozenCount)}                sub="Saldo bloqueado"      tone="destructive" active={sellerFilter === "frozen"}  onClick={() => setSellerFilter("frozen")} />
        <SellerKpi icon={Ban}            label="Bloqueados"     value={String(blockedCount)}               sub="Conta banida"         tone="destructive" active={sellerFilter === "blocked"} onClick={() => setSellerFilter("blocked")} />
        <SellerKpi icon={TrendingUp}     label="Transações"     value={String(transactions.length)}        sub="Total registrado"     tone="primary" />
        <SellerKpi icon={ArrowDownToLine} label="Saques"        value={String(withdrawals.length)}         sub="Total registrado"     tone="neutral" />
      </div>


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
          <Button size="sm" variant="outline" className="rounded-xl text-xs border-warning/30 text-warning" onClick={() => setSellerFilter("kyc")}>
            Ver Fila KYC
          </Button>
        </div>
      )}

      {/* ── Top movers do dia ── */}
      {todayMovers.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-[11px] font-black uppercase tracking-widest text-foreground">Top Movers · Hoje</p>
            </div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {todayMovers.length} ativos · {fmtCurrency(todayMovers.reduce((a, m) => a + m.gross, 0))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {todayMovers.map(m => (
              <button
                key={m.user_id}
                onClick={() => openUserDetail(m.profile!)}
                className="group inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/20 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-black text-primary shrink-0">
                  {(m.profile!.full_name || m.profile!.email || "?")[0].toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-foreground leading-tight max-w-[160px] truncate">
                    {m.profile!.full_name || m.profile!.email}
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {m.count} venda{m.count > 1 ? "s" : ""} · <span className="font-black text-success">{fmtCurrency(m.gross)}</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
          {[
            { id: "all" as const, label: "Todos", count: profiles.length },
            { id: "kyc" as const, label: "Fila KYC", count: kycPendingProfiles.length },
            { id: "black" as const, label: "Black", count: blackCount },
            { id: "white" as const, label: "White", count: whiteCount },
            { id: "unset" as const, label: "Sem tipo", count: unsetCount },
            { id: "approved" as const, label: "Aprovados", count: approvedCount },
            { id: "frozen" as const, label: "Congelados", count: frozenCount },
            { id: "blocked" as const, label: "Bloqueados", count: blockedCount },
            { id: "rejected" as const, label: "Rejeitados", count: rejectedCount },
          ].map(f => (
            <button key={f.id} onClick={() => setSellerFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                sellerFilter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"
              }`}>
              {f.label} <span className="opacity-50 ml-1">{f.count}</span>
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
        <PremiumPanel title={`Fila de Aprovação KYC`} eyebrow={`${filtered.length} pendentes`} icon={FileText}>
          <div className="space-y-3">
            {filtered.map(p => (
              <div key={p.id} className="group rounded-xl border border-border bg-card p-4 flex items-center gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/20">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {(p.full_name || "U")[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{p.full_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{p.email} • {p.phone || "Sem tel"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground font-mono">{p.document_type?.toUpperCase()}: {maskDoc(p.document_number)}</span>
                    <span className="text-[10px] text-muted-foreground">• {new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-xs rounded-xl" onClick={() => openUserDetail(p)}>
                    <Eye className="h-3 w-3 mr-1" /> Detalhes
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl text-xs border-primary/30 text-primary" onClick={() => handleApproveKyc(p.user_id)}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar KYC
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl text-xs border-destructive/30 text-destructive"
                    onClick={() => { setRejectTargetUserId(p.user_id); setShowRejectDialog(true); }}>
                    <XCircle className="h-3 w-3 mr-1" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <PremiumEmpty icon={CheckCircle2} title="Nenhum KYC pendente" subtitle="Todos os sellers foram revisados." />
            )}
          </div>
        </PremiumPanel>
      ) : (
        /* ── Sellers Table ── */
        <PremiumPanel title="Vendedores" eyebrow={`${filtered.length} registros`} icon={Users}>
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  {["Vendedor", "Tipo", "Status", "Saldo", "Transações", "Conversão", "Ações"].map(h => (
                    <th key={h} className={premiumTable.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const stats = getSellerStats(p.user_id);
                  const frozen = isFrozen(p);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => openUserDetail(p)}
                      className={cn(premiumTable.row, "cursor-pointer")}
                    >
                      <td className={premiumTable.td}>
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20 flex items-center justify-center text-[12px] font-black text-primary transition-transform duration-300 group-hover:scale-[1.06]">
                              {(p.full_name || "U")[0].toUpperCase()}
                            </div>
                            {frozen && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-info text-background flex items-center justify-center ring-2 ring-background">
                                <Snowflake className="h-2 w-2" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-bold text-foreground truncate max-w-[220px]">{p.full_name || "Sem nome"}</p>
                            <p className="text-[10.5px] text-muted-foreground truncate max-w-[220px]">{p.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={premiumTable.td}><SellerTypeBadge type={p.seller_type} /></td>
                      <td className={premiumTable.td}><StatusBadge status={p.account_status || "pending_review"} /></td>
                      <td className={premiumTable.td}>
                        <span className="font-display text-[13px] font-black tabular-nums text-primary">{fmtCurrency(sellerBalances.get(p.user_id) ?? (stats.totalNet - stats.totalWithdrawn))}</span>
                      </td>
                      <td className={premiumTable.td}>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          <span className="text-foreground font-bold">{stats.completedCount}</span>
                          <span className="text-muted-foreground/50">/{stats.txCount}</span>
                        </span>
                      </td>
                      <td className={premiumTable.td}>
                        <span className={cn(
                          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-black tabular-nums border",
                          stats.conversionRate >= 50 ? "text-success bg-success/10 border-success/25"
                            : stats.conversionRate >= 20 ? "text-warning bg-warning/10 border-warning/25"
                            : "text-destructive bg-destructive/10 border-destructive/25"
                        )}>
                          {stats.conversionRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className={premiumTable.td} onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg opacity-60 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
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
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-10 text-center text-muted-foreground text-xs">Nenhum vendedor encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </PremiumPanel>
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
              <Button size="sm" variant="destructive" className="rounded-xl" onClick={handleRejectKyc}>
                <Send className="h-3 w-3 mr-1" /> Enviar Recusa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Seller Detail Dialog ═══ */}
      <Dialog open={!!selectedUser} onOpenChange={v => { if (!v) setSelectedUser(null); }}>
        <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border border-border">
          <DialogHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border pl-4 pr-14 sm:pl-6 sm:pr-16 pt-5 pb-4 space-y-0">
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
                  <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate">
                    ID {selectedUser?.user_id?.slice(0, 8)}…{selectedUser?.user_id?.slice(-4)} · IP {selectedUser?.last_ip || "—"}
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
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-[11px] gap-1.5 border-success/30 text-success hover:bg-success/10" onClick={() => handleApproveKyc(selectedUser!.user_id)}>
                    <CheckCircle2 className="h-3 w-3" /> Aprovar
                  </Button>
                )}
                {selectedUser && emailVerified === false && (
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

          <div className="px-6 pb-6 pt-4">


          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : (
            <>
              {/* Financial KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
                <MiniKpi label="Transacionou" value={fmtCurrency(userTotalGross)} tone="info" />
                <MiniKpi label="Receita Líquida" value={fmtCurrency(userTotalNet)} tone="success" />
                <MiniKpi label="Lucro c/ Taxas" value={fmtCurrency(userTotalFees)} tone="warning" />
                <MiniKpi label="Saldo Disponível" value={fmtCurrency(userAvailableBalance)} tone="primary" />
                <MiniKpi label="Conversão" value={`${userConversion}%`} tone="info" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-2">
                <MiniKpi label="Total Sacado" value={fmtCurrency(userTotalWithdrawn)} tone="warning" />
                <MiniKpi label="Taxa Saque Paga" value={fmtCurrency(userTotalWdFees)} tone="warning" />
                <MiniKpi label="Saque Pendente" value={fmtCurrency(userPendingWd)} tone="info" />
                <MiniKpi label="Clientes" value={String(buyers.length)} tone="primary" />
                <MiniKpi label={`Disputas (${userMedRate}%)`} value={`${userMedTotal} (${fmtCurrency(userMedAmount)})`} tone="warning" />
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
                    <InfoRow label="Documento" value={piiRevealed ? (revealedDoc ?? selectedUser?.document_number) : maskDoc(selectedUser?.document_number)} mono />
                    <InfoRow label="Tipo documento" value={selectedUser?.document_type} />
                    <InfoRow label="Status conta" value={selectedUser?.account_status} />
                    <InfoRow label="Tipo Seller" value={selectedUser?.seller_type || "Não classificado"} />
                    <InfoRow label="Último IP" value={selectedUser?.last_ip} mono />
                    <InfoRow label="Cadastro" value={selectedUser ? new Date(selectedUser.created_at).toLocaleString("pt-BR") : ""} />
                    <InfoRow label="Saldo Congelado" value={selectedUser && isFrozen(selectedUser) ? "SIM" : "NÃO"} />
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

                  {/* ── Métodos de Pagamento Permitidos ── */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Métodos de Pagamento</p>
                    <p className="text-[10px] text-muted-foreground/70 mb-3">Desativando aqui, o seller não verá a opção nos próprios produtos.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { key: "boleto_enabled", label: "Boleto" },
                        { key: "credit_card_enabled", label: "Cartão de Crédito" },
                      ] as const).map(opt => {
                        const enabled = selectedUser?.[opt.key] !== false;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={async () => {
                              if (!selectedUser) return;
                              const next = !enabled;
                              const { error } = await supabase
                                .from("profiles")
                                .update({ [opt.key]: next })
                                .eq("user_id", selectedUser.user_id);
                              if (error) { toast.error("Erro ao atualizar"); return; }
                              setSelectedUser({ ...selectedUser, [opt.key]: next });
                              toast.success(`${opt.label} ${next ? "ativado" : "desativado"}`);
                              await logAdminAction(`toggle_${opt.key}`, "profile", selectedUser.user_id, { enabled: next });
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
                          </button>
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
                          <SelectContent>
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
                    <MiniKpi label="Taxa Med (%)" value={`${userMedRate}%`} tone="info" />
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
                    title={`Chaves PIX${piiRevealed && revealedPixKeys ? ` (${revealedPixKeys.length})` : ""}`}
                    icon={Key}
                    action={!piiRevealed ? (
                      <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={revealPii}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Revelar PIX
                      </Button>
                    ) : null}
                  >
                    {!piiRevealed ? (
                      <PremiumEmpty icon={Lock} title="Chaves PIX ocultas" subtitle="Clique em 'Revelar PIX' para visualizar. A ação é registrada no audit log." />
                    ) : !revealedPixKeys || revealedPixKeys.length === 0 ? (
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
                              <p className="text-sm font-mono text-foreground mt-0.5">{pk.key_value ?? "•••"}</p>
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


                {/* ── Adquirente ── */}
                <TabsContent value="acquirer" className="mt-4 space-y-4">
                  <PremiumPanel title="Adquirente Atribuída" icon={Landmark}>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Adquirente para este seller</Label>
                        <Select value={selectedAcquirerId} onValueChange={(v) => setSelectedAcquirerId(v)}>
                          <SelectTrigger className="h-10 text-xs mt-1 rounded-xl bg-muted/30 border-border"><SelectValue placeholder="Usar padrão da plataforma" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Padrão da plataforma</SelectItem>
                            {acquirers.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.name} ({a.type.toUpperCase()})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs border-primary/30 text-primary" onClick={() => handleSetAcquirer(selectedUser!.user_id, selectedAcquirerId === "default" ? null : selectedAcquirerId)}>
                        <Save className="h-3 w-3 mr-1" /> Salvar Adquirente
                      </Button>
                    </div>
                  </PremiumPanel>
                </TabsContent>

                {/* ── Financeiro ── */}
                <TabsContent value="financial" className="mt-4 space-y-4">
                  <PremiumPanel title="Ajustar Saldo Manualmente" icon={DollarSign}>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                        <Select value={adjustType} onValueChange={(v: "credit" | "debit") => setAdjustType(v)}>
                          <SelectTrigger className="h-9 text-xs rounded-xl bg-muted/30 border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="credit">Crédito (+)</SelectItem>
                            <SelectItem value="debit">Débito (-)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                        <NumberInput step={0.01} min={0} value={adjustAmount} onChange={v => setAdjustAmount(v)} placeholder="0.00" className="text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Motivo (obrigatório)</Label>
                        <div className="flex gap-2">
                          <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Motivo do ajuste..."
                            className="flex-1 h-9 px-3 bg-muted/30 border border-border rounded-xl text-xs text-foreground" />
                          <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs border-primary/30 text-primary" onClick={handleBalanceAdjustment}>
                            <Save className="h-3 w-3 mr-1" /> Aplicar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PremiumPanel>
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
                  <PremiumPanel title={`Histórico de Saques (${userWithdrawals.length})`} icon={ArrowDownToLine}>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {userWithdrawals.map(w => (
                        <div key={w.id} className="flex items-center justify-between text-[11px] py-2 border-b border-border/50">
                          <div className="flex items-center gap-3">
                            <StatusBadge status={w.status} />
                            <span className="font-bold text-foreground">R$ {Number(w.amount).toFixed(2)}</span>
                            <span className="text-muted-foreground">Taxa: R$ {Number(w.fee_amount).toFixed(2)}</span>
                          </div>
                          <span className="text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      ))}
                      {userWithdrawals.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem saques</p>}
                    </div>
                  </PremiumPanel>
                </TabsContent>

                {/* ── Compliance ── */}
                <TabsContent value="compliance" className="mt-4 space-y-5">
                  <PremiumPanel title={`Produtos Ativos (${userProducts.length})`} icon={Package}>
                    <div className="space-y-3">
                      {userProducts.length === 0 && <PremiumEmpty icon={Package} title="Nenhum produto ativo" />}
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
                      <MiniKpi label="Produtos Ativos" value={String(userProducts.length)} tone="success" />
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
                          const lastCompleted = b.txs.find(t => t.status === "completed" || t.status === "approved");
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
                                        if (!lastCompleted || !selectedUser) return;
                                        if (!window.confirm(`Estornar a última transação aprovada (${fmtCurrency(Number(lastCompleted.amount))}) deste cliente?`)) return;
                                        const { error } = await supabase.from("transactions").update({ status: "refunded" }).eq("id", lastCompleted.id);
                                        if (error) { toast.error("Erro ao estornar: " + friendlyError(error)); return; }
                                        toast.success("Transação estornada.");
                                        await logAdminAction("manual_refund", "transaction", lastCompleted.id, { amount: lastCompleted.amount, buyer: b.email });
                                        openUserDetail(selectedUser);
                                      }}
                                      className="text-warning"
                                    >
                                      <DollarSign className="h-3.5 w-3.5 mr-2" /> Estornar última compra
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={!lastCompleted}
                                      onClick={async () => {
                                        if (!lastCompleted || !selectedUser || !user) return;
                                        if (!window.confirm(`Abrir MED/Chargeback nesta transação (${fmtCurrency(Number(lastCompleted.amount))})?`)) return;
                                        const { error } = await supabase.from("disputes").insert({
                                          transaction_id: lastCompleted.id,
                                          seller_user_id: selectedUser.user_id,
                                          buyer_name: b.name, buyer_email: b.email, buyer_phone: b.phone,
                                          type: "med", status: "open",
                                          amount: lastCompleted.amount,
                                          reason: "Aberto manualmente pelo admin",
                                          admin_user_id: user.id,
                                        });
                                        if (error) { toast.error("Erro ao abrir MED: " + friendlyError(error)); return; }
                                        toast.success("MED aberto. Saldo retido até resolução.");
                                        await logAdminAction("open_dispute", "transaction", lastCompleted.id, { amount: lastCompleted.amount });
                                        openUserDetail(selectedUser);
                                      }}
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Abrir MED na última
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
                  <p className="text-[10px] text-muted-foreground/60 mt-2 px-1">Estornos e MEDs disparam automaticamente os ajustes de saldo via triggers do ledger.</p>
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
                                    if (log.old_data![k] === log.new_data![k]) return null;
                                    return (<div key={k}><span className="text-muted-foreground">{k}:</span> <span className="line-through text-destructive/50">{String(log.old_data![k] ?? "—")}</span> → <span className="text-primary">{String(log.new_data![k] ?? "—")}</span></div>);
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
      <p className={`text-[12px] font-semibold ${mono ? "font-mono" : ""} ${value ? "text-foreground" : "text-muted-foreground/50 italic"}`}>{value || "Não informado"}</p>
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
  const valueCls: Record<SellerKpiTone, string> = {
    neutral: "text-foreground", primary: "text-primary", success: "text-success",
    warning: "text-warning", info: "text-info", destructive: "text-destructive",
  };
  const iconBg: Record<SellerKpiTone, string> = {
    neutral: "bg-secondary text-muted-foreground", primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info", destructive: "bg-destructive/10 text-destructive",
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
        "group relative w-full bg-card px-3 py-3.5 sm:px-4 sm:py-4 text-left flex flex-col gap-2 transition-colors",
        isInteractive && "cursor-pointer hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        active && "bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70 leading-tight">{label}</span>
        <div className={cn("h-6 w-6 sm:h-7 sm:w-7 rounded-md flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110", iconBg[tone])}>
          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} />
        </div>
      </div>
      <div className={cn("font-display text-[20px] sm:text-[24px] font-black leading-none tabular-nums tracking-tight", valueCls[tone])}>{value}</div>
      {sub && <div className="text-[10px] sm:text-[11px] text-muted-foreground/70 font-medium truncate">{sub}</div>}
      <span className={cn(
        "absolute inset-x-0 bottom-0 h-[2px] origin-left transition-transform duration-500",
        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
        barCls[tone],
      )} />
    </Tag>
  );
}
