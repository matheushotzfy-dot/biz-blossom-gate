import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 Settings, Globe, CreditCard, Zap, Shield, Bell, Save, RefreshCw,
 ToggleLeft, DollarSign, Percent, ArrowDownToLine, Users, Clock, Lock,
 Send, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/auditLog";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle } from "./AdminOverviewTab";
import { LinearHero, LinearStat, LinearStatRow } from "@/components/admin/LinearKit";
import type { Tables, Json } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PlatformSetting = Tables<"platform_settings">;
type RetentionSetting = Omit<Tables<"retention_settings">, "pix_retention_pct" | "card_retention_pct" | "retention_days" | "card_release_days"> & {
  pix_retention_pct: number | string;
  card_retention_pct: number | string;
  retention_days: number | string;
  card_release_days: number | string | null;
};
type NotificationRow = Tables<"notifications">;

type JsonObj = { [key: string]: Json | undefined };
const asObj = (v: Json | null | undefined): JsonObj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObj) : {};

export default function AdminSettingsTab() {
 const { user } = useAuth();
 const [fees, setFees] = useState<Tables<"fees">[]>([]);
 const [settings, setSettings] = useState<PlatformSetting[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);

 const [whitePercentage, setWhitePercentage] = useState("4.99");
 const [whiteFixed, setWhiteFixed] = useState("2.50");
 const [whiteWithdrawal, setWhiteWithdrawal] = useState("5.00");
 const [blackPercentage, setBlackPercentage] = useState("4.99");
 const [blackFixed, setBlackFixed] = useState("2.50");
 const [blackWithdrawal, setBlackWithdrawal] = useState("5.00");
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveMaxAmount, setAutoApproveMaxAmount] = useState("100");
  const [requireEmailVerification, setRequireEmailVerification] = useState(true);
  const [savingEmailVerif, setSavingEmailVerif] = useState(false);
 const [editingFees, setEditingFees] = useState<Record<string, string>>({});

 // Max Ticket
 const [maxTicketGlobal, setMaxTicketGlobal] = useState<string>("10000");
 const [maxTicketInput, setMaxTicketInput] = useState<string>("10000");
 const [savingMaxTicket, setSavingMaxTicket] = useState(false);

 // Retention settings
 const [globalRetention, setGlobalRetention] = useState({ pix_retention_pct: "0", card_retention_pct: "0", retention_days: "14", card_release_days: "7", id: "" });
 const [sellerRetentions, setSellerRetentions] = useState<RetentionSetting[]>([]);
 const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null; email: string | null }[]>([]);
 const [newRetentionSeller, setNewRetentionSeller] = useState("");

 // Notifications
 const [notifications, setNotifications] = useState<NotificationRow[]>([]);
 const [notifTitle, setNotifTitle] = useState("");
 const [notifMessage, setNotifMessage] = useState("");
 const [notifType, setNotifType] = useState("info");
 const [notifTarget, setNotifTarget] = useState("all");

 useEffect(() => { loadAll(); }, []);

 const loadAll = async () => {
 setLoading(true);
 const [feesRes, settingsRes, retentionRes, profilesRes, notifsRes] = await Promise.all([
 supabase.from("fees").select("*").order("name"),
 supabase.from("platform_settings").select("*"),
 supabase.from("retention_settings").select("*"),
 supabase.from("profiles").select("user_id, full_name, email").limit(500),
 supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
 ]);
 if (feesRes.data) {
 setFees(feesRes.data);
 const feeMap: Record<string, string> = {};
 feesRes.data.forEach(f => { feeMap[f.id] = String(f.value); });
 setEditingFees(feeMap);
 }
 if (settingsRes.data) {
 const data = settingsRes.data as PlatformSetting[];
 setSettings(data);
 const autoApprove = data.find(s => s.key === "auto_approve_withdrawals");
 if (autoApprove) {
 const val = asObj(autoApprove.value);
 setAutoApproveEnabled((val.enabled as boolean) ?? false);
 setAutoApproveMaxAmount(String(val.max_amount ?? 100));
 }
 const whiteSettings = data.find(s => s.key === "fees_white");
 if (whiteSettings) {
 const v = asObj(whiteSettings.value);
 setWhitePercentage(String(v.percentage ?? 4.99));
 setWhiteFixed(String(v.fixed ?? 2.50));
 setWhiteWithdrawal(String(v.withdrawal ?? 5.00));
 }
 const blackSettings = data.find(s => s.key === "fees_black");
 if (blackSettings) {
 const v = asObj(blackSettings.value);
 setBlackPercentage(String(v.percentage ?? 4.99));
 setBlackFixed(String(v.fixed ?? 2.50));
 setBlackWithdrawal(String(v.withdrawal ?? 5.00));
 }
   const maxTicketSet = data.find(s => s.key === "max_ticket_default");
 if (maxTicketSet) {
    const v = asObj(maxTicketSet.value).value ?? 10000;
    setMaxTicketGlobal(String(v));
    setMaxTicketInput(String(v));
  }
  const emailVerif = data.find(s => s.key === "require_email_verification");
  if (emailVerif) {
    setRequireEmailVerification((asObj(emailVerif.value).enabled ?? true) === true);
  }
 }
 if (retentionRes.data) {
 const rdata = retentionRes.data as RetentionSetting[];
 const global = rdata.find(r => r.user_id === null);
 if (global) {
          setGlobalRetention({
            id: global.id,
            pix_retention_pct: String(global.pix_retention_pct),
            card_retention_pct: String(global.card_retention_pct),
            retention_days: String(global.retention_days),
            card_release_days: String(global.card_release_days ?? 7),
          });
 }
 setSellerRetentions(rdata.filter(r => r.user_id !== null));
 }
 if (profilesRes.data) setProfiles(profilesRes.data);
 if (notifsRes.data) setNotifications(notifsRes.data);
 setLoading(false);
 };

 const saveFeeSettings = async (tier: "white" | "black") => {
 if (!user) return;
 setSaving(true);
 const key = `fees_${tier}`;
 const val = tier === "white"
 ? { percentage: Number(whitePercentage), fixed: Number(whiteFixed), withdrawal: Number(whiteWithdrawal) }
 : { percentage: Number(blackPercentage), fixed: Number(blackFixed), withdrawal: Number(blackWithdrawal) };
 const { error } = await supabase.from("platform_settings")
 .upsert({ key, value: val as unknown as Json, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: "key" });
 if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
 toast.success(`Taxas ${tier.toUpperCase()} salvas!`);
 await logAdminAction(`update_fees_${tier}`, "platform_settings", key, val as unknown as Record<string, Json>);
 setSaving(false);
 };

 const saveAutoApprove = async () => {
 if (!user) return;
 setSaving(true);
 const val = { enabled: autoApproveEnabled, max_amount: Number(autoApproveMaxAmount) };
 const { error } = await supabase.from("platform_settings")
 .upsert({ key: "auto_approve_withdrawals", value: val as unknown as Json, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: "key" });
 if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
 toast.success("Configuração de auto-aprovação salva!");
 await logAdminAction("update_auto_approve", "platform_settings", "auto_approve_withdrawals", val as unknown as Record<string, Json>);
 setSaving(false);
 };

 const saveEmailVerification = async (enabled: boolean) => {
   if (!user) return;
   setSavingEmailVerif(true);
   setRequireEmailVerification(enabled);
   const { error } = await supabase.from("platform_settings")
     .upsert({ key: "require_email_verification", value: { enabled } as unknown as Json, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: "key" });
   if (error) {
     toast.error("Erro ao salvar");
     setRequireEmailVerification(!enabled);
     setSavingEmailVerif(false);
     return;
   }
   toast.success(enabled ? "Verificação de e-mail ATIVADA" : "Verificação de e-mail DESATIVADA — contas serão criadas já confirmadas");
   await logAdminAction("update_require_email_verification", "platform_settings", "require_email_verification", { enabled } as Record<string, Json>);
   setSavingEmailVerif(false);
 };


  const updateGlobalFee = async (feeId: string) => {
    if (!user) return;
    const newValue = Number(editingFees[feeId]);
    if (isNaN(newValue) || newValue < 0) { toast.error("Valor inválido"); return; }
    const fee = fees.find(f => f.id === feeId);
    if (!fee) return;
    const { error } = await supabase.from("fees").update({ value: newValue }).eq("id", feeId);
    if (error) { toast.error("Erro ao atualizar taxa"); return; }
    toast.success(`Taxa "${fee.name}" atualizada!`);
    await logAdminAction("update_global_fee", "fees", feeId, { name: fee.name, old_value: fee.value, new_value: newValue } as Record<string, Json>);
    loadAll();
  };

  // Wipe all per-seller overrides → everyone (new and old) falls back to platform defaults
  const applyGlobalToAllSellers = async () => {
    if (!user) return;
    if (!window.confirm("Aplicar taxas globais a TODOS os sellers? Isso APAGA todas as taxas individuais (atuais e antigos).")) return;
    setSaving(true);
    const { error, count } = await supabase
      .from("custom_user_fees")
      .delete({ count: "exact" })
      .not("user_id", "is", null);
    if (error) { toast.error("Erro ao aplicar global: " + error.message); setSaving(false); return; }
    toast.success(`Taxas globais aplicadas. ${count ?? 0} overrides removidos.`);
    await logAdminAction("apply_global_fees_to_all", "custom_user_fees", "bulk", { removed: count } as Record<string, Json>);
    setSaving(false);
  };

  // Max Ticket: aplica apenas para novos usuários (snapshot do valor atual nos antigos)
  const saveMaxTicketNewOnly = async () => {
    const val = Number(maxTicketInput);
    if (!val || val <= 0) { toast.error("Informe um valor válido"); return; }
    if (!window.confirm(`Definir limite de R$ ${val.toLocaleString("pt-BR")} para novos usuários? Os usuários existentes mantêm o limite atual.`)) return;
    setSavingMaxTicket(true);
    const { data, error } = await supabase.rpc("set_max_ticket_new_users_only", { _new_value: val });
    if (error) { toast.error("Erro: " + error.message); setSavingMaxTicket(false); return; }
    toast.success(`Novo limite global: R$ ${val.toLocaleString("pt-BR")}. Limite anterior preservado nos usuários existentes.`);
    await logAdminAction("set_max_ticket_new_only", "platform_settings", "max_ticket_default", data as unknown as Record<string, Json>);
    setMaxTicketGlobal(String(val));
    setSavingMaxTicket(false);
  };

  // Max Ticket: aplica para TODOS (limpa overrides individuais)
  const saveMaxTicketForAll = async () => {
    const val = Number(maxTicketInput);
    if (!val || val <= 0) { toast.error("Informe um valor válido"); return; }
    if (!window.confirm(`Aplicar R$ ${val.toLocaleString("pt-BR")} a TODOS os sellers (novos e antigos)? Isso APAGA todos os limites individuais de ticket.`)) return;
    setSavingMaxTicket(true);
    const { data, error } = await supabase.rpc("set_max_ticket_for_all", { _new_value: val });
    if (error) { toast.error("Erro: " + error.message); setSavingMaxTicket(false); return; }
    toast.success(`Limite R$ ${val.toLocaleString("pt-BR")} aplicado a todos os sellers.`);
    await logAdminAction("set_max_ticket_for_all", "platform_settings", "max_ticket_default", data as unknown as Record<string, Json>);
    setMaxTicketGlobal(String(val));
    setSavingMaxTicket(false);
  };




 // Retention
 const saveGlobalRetention = async () => {
 if (!user) return;
 setSaving(true);
    const payload = {
      pix_retention_pct: Number(globalRetention.pix_retention_pct),
      card_retention_pct: Number(globalRetention.card_retention_pct),
      retention_days: Number(globalRetention.retention_days),
      card_release_days: Number(globalRetention.card_release_days),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
 let savedId = globalRetention.id;
 if (globalRetention.id) {
 const { error } = await supabase.from("retention_settings").update(payload).eq("id", globalRetention.id);
 if (error) { toast.error("Erro ao salvar retenção"); setSaving(false); return; }
 } else {
 const { data, error } = await supabase.from("retention_settings")
 .insert({ ...payload, user_id: null })
 .select("id").maybeSingle();
 if (error || !data) { toast.error("Erro ao criar retenção global"); setSaving(false); return; }
 savedId = data.id;
 setGlobalRetention(prev => ({ ...prev, id: data.id }));
 }
 toast.success("Retenção global salva!");
 await logAdminAction("update_global_retention", "retention_settings", savedId, payload as unknown as Record<string, Json>);
 setSaving(false);
 };

 const saveSellerRetention = async (r: any) => {
 if (!user) return;
    const { error } = await supabase.from("retention_settings").update({
      pix_retention_pct: Number(r.pix_retention_pct),
      card_retention_pct: Number(r.card_retention_pct),
      retention_days: Number(r.retention_days),
      card_release_days: Number(r.card_release_days ?? 7),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }).eq("id", r.id);
 if (error) { toast.error("Erro"); return; }
 toast.success("Retenção do seller salva!");
 };

 const addSellerRetention = async () => {
 if (!user || !newRetentionSeller) return;
    const { error } = await supabase.from("retention_settings").insert({
      user_id: newRetentionSeller,
      pix_retention_pct: 0,
      card_retention_pct: 0,
      retention_days: 14,
      card_release_days: 7,
      updated_by: user.id,
    });
 if (error) { toast.error((error as { code?: string }).code === "23505" ? "Seller já tem retenção individual" : "Erro"); return; }
 toast.success("Retenção individual adicionada!");
 setNewRetentionSeller("");
 loadAll();
 };

 const deleteSellerRetention = async (id: string) => {
 const { error } = await supabase.from("retention_settings").delete().eq("id", id);
 if (error) { toast.error("Erro"); return; }
 toast.success("Retenção removida");
 loadAll();
 };

 // Notifications
 const sendNotification = async () => {
 if (!user || !notifTitle || !notifMessage) { toast.error("Preencha título e mensagem"); return; }
 const { error } = await supabase.from("notifications").insert({
 user_id: notifTarget === "all" ? null : notifTarget,
 title: notifTitle,
 message: notifMessage,
 type: notifType,
 created_by: user.id,
 });
 if (error) { toast.error("Erro ao enviar"); return; }
 toast.success("Notificação enviada!");
 setNotifTitle("");
 setNotifMessage("");
 loadAll();
 };

 const deleteNotification = async (id: string) => {
 if (!window.confirm("Excluir esta notificação?")) return;
 const { error } = await supabase.from("notifications").delete().eq("id", id);
 if (error) { toast.error("Erro ao excluir"); return; }
 loadAll();
 };

 const getSellerName = (uid: string | null) => {
 if (!uid) return "Todos os sellers";
 const p = profiles.find(p => p.user_id === uid);
 return p?.full_name || p?.email || uid.slice(0, 8);
 };

 if (loading) return (
 <div className="flex items-center justify-center py-20">
 <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
 </div>
 );

 return (
 <div className="space-y-6 animate-fade-in">
 <LinearHero
   eyebrow="Plataforma · Configurações"
   title="Controles globais"
   subtitle="Taxas por tier, auto-aprovação de saques e regras de retenção financeira."
   status={{ tone: autoApproveEnabled ? "success" : "neutral", label: autoApproveEnabled ? "Auto-aprovar ativo" : "Auto-aprovar inativo" }}
 />

 {/* KPIs */}
 <LinearStatRow>
   <LinearStat icon={Zap} label="Taxas Cadastradas" value={String(fees.length)} sub="Na plataforma" tone="neutral" />
   <LinearStat icon={ArrowDownToLine} label="Auto-Aprovar" value={autoApproveEnabled ? "Ativo" : "Inativo"} sub={autoApproveEnabled ? `Até R$ ${autoApproveMaxAmount}` : "Desabilitado"} tone={autoApproveEnabled ? "success" : "neutral"} />
   <LinearStat icon={Lock} label="Retenção PIX" value={`${globalRetention.pix_retention_pct}%`} sub={`${globalRetention.retention_days} dias`} tone="warning" />
   <LinearStat icon={CreditCard} label="Retenção Cartão" value={`${globalRetention.card_retention_pct}%`} sub={`D+${globalRetention.card_release_days ?? 7} liberação`} tone="info" />
 </LinearStatRow>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 {/* White Tier Fees */}
 <AdminPanel>
 <PanelTitle color="blue" icon={<Globe className="h-4 w-4" />}>Taxas Tier WHITE</PanelTitle>
 <div className="space-y-4 mt-4">
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Taxa Percentual (%)</Label>
 <Input type="number" step="0.01" value={whitePercentage} onChange={e => setWhitePercentage(e.target.value)} className="h-10" />
 </div>
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Taxa Fixa (R$)</Label>
 <Input type="number" step="0.01" value={whiteFixed} onChange={e => setWhiteFixed(e.target.value)} className="h-10" />
 </div>
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Taxa de Saque (R$)</Label>
 <Input type="number" step="0.01" value={whiteWithdrawal} onChange={e => setWhiteWithdrawal(e.target.value)} className="h-10" />
 </div>
 <Button onClick={() => saveFeeSettings("white")} disabled={saving} className="w-full gap-2">
 <Save className="h-4 w-4" /> Salvar Taxas White
 </Button>
 </div>
 </AdminPanel>

 {/* Black Tier Fees */}
 <AdminPanel>
 <PanelTitle color="zinc" icon={<Shield className="h-4 w-4" />}>Taxas Tier BLACK</PanelTitle>
 <div className="space-y-4 mt-4">
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Taxa Percentual (%)</Label>
 <Input type="number" step="0.01" value={blackPercentage} onChange={e => setBlackPercentage(e.target.value)} className="h-10" />
 </div>
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Taxa Fixa (R$)</Label>
 <Input type="number" step="0.01" value={blackFixed} onChange={e => setBlackFixed(e.target.value)} className="h-10" />
 </div>
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Taxa de Saque (R$)</Label>
 <Input type="number" step="0.01" value={blackWithdrawal} onChange={e => setBlackWithdrawal(e.target.value)} className="h-10" />
 </div>
 <Button onClick={() => saveFeeSettings("black")} disabled={saving} className="w-full gap-2">
 <Save className="h-4 w-4" /> Salvar Taxas Black
 </Button>
 </div>
 </AdminPanel>

 {/* Auto-Approve Withdrawals */}
 <AdminPanel>
 <PanelTitle color="emerald" icon={<ToggleLeft className="h-4 w-4" />}>Auto-Aprovação de Saques (Global)</PanelTitle>
 <div className="space-y-4 mt-4">
 <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
 <div>
 <p className="text-sm font-semibold text-foreground">Ativar Auto-Aprovação</p>
 <p className="text-xs text-muted-foreground">Saques até o limite serão aprovados automaticamente</p>
 </div>
 <Switch checked={autoApproveEnabled} onCheckedChange={setAutoApproveEnabled} />
 </div>
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Limite máximo para auto-aprovação (R$)</Label>
 <Input type="number" step="1" value={autoApproveMaxAmount} onChange={e => setAutoApproveMaxAmount(e.target.value)} className="h-10" />
 </div>
 <Button onClick={saveAutoApprove} disabled={saving} className="w-full gap-2">
 <Save className="h-4 w-4" /> Salvar Configuração
 </Button>
 </div>
 </AdminPanel>

 {/* Email Verification Toggle */}
 <AdminPanel>
   <PanelTitle color="emerald" icon={<Lock className="h-4 w-4" />}>Verificação de E-mail no Cadastro</PanelTitle>
   <div className="space-y-4 mt-4">
     <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
       <div className="pr-4">
         <p className="text-sm font-semibold text-foreground">Exigir confirmação de e-mail</p>
         <p className="text-xs text-muted-foreground mt-0.5">
           Quando <strong>ativado</strong>, o usuário precisa clicar no link enviado por e-mail antes de logar.
           Quando <strong>desativado</strong>, novas contas são criadas já confirmadas e o login é liberado imediatamente.
         </p>
       </div>
       <Switch checked={requireEmailVerification} onCheckedChange={saveEmailVerification} disabled={savingEmailVerif} />
     </div>
     <p className="text-[11px] text-muted-foreground">
       Status atual: <strong className={requireEmailVerification ? "text-emerald-400" : "text-amber-400"}>
         {requireEmailVerification ? "Verificação OBRIGATÓRIA" : "Verificação DESATIVADA (auto-confirmação)"}
       </strong>
     </p>
   </div>
 </AdminPanel>

 {/* Global Platform Fees */}
 <AdminPanel>
 <PanelTitle color="amber" icon={<Zap className="h-4 w-4" />}>Taxas Globais da Plataforma</PanelTitle>
 {fees.length === 0 ? (
 <p className="text-xs text-muted-foreground mt-4">Nenhuma taxa configurada</p>
 ) : (
 <div className="space-y-3 mt-4">
 {fees.map(fee => (
 <div key={fee.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
 <div className="flex-1">
 <p className="text-sm font-semibold text-foreground">{fee.name}</p>
 <p className="text-[10px] text-muted-foreground">{fee.description || fee.fee_type}</p>
 </div>
 <div className="flex items-center gap-2">
 <Input
 type="number" step="0.01"
 value={editingFees[fee.id] ?? String(fee.value)}
 onChange={e => setEditingFees(prev => ({ ...prev, [fee.id]: e.target.value }))}
 className="h-8 w-24 text-sm"
 />
 <span className="text-xs text-muted-foreground font-mono">{fee.fee_type === "percentage" ? "%" : "R$"}</span>
 <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => updateGlobalFee(fee.id)}>
 <Save className="h-3 w-3" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 )}
 <div className="mt-5 pt-4 border-t border-border/50 space-y-2">
   <p className="text-[11px] text-muted-foreground">
     Por padrão, as taxas globais valem apenas para <strong>novos sellers</strong>. Sellers com taxa individual mantêm a deles. Use o botão abaixo para forçar a taxa global em <strong>TODOS</strong> (novos e antigos), apagando overrides individuais.
   </p>
   <Button onClick={applyGlobalToAllSellers} disabled={saving} variant="destructive" size="sm" className="w-full gap-2">
     <Users className="h-3.5 w-3.5" /> Aplicar taxa global a TODOS os sellers (apaga individuais)
   </Button>
 </div>
 </AdminPanel>

 {/* Ticket Máximo Global */}
 <AdminPanel>
   <PanelTitle color="emerald" icon={<DollarSign className="h-4 w-4" />}>Ticket Máximo — Limite por Transação</PanelTitle>
   <p className="text-[11px] text-muted-foreground mt-1 mb-4">
     Valor máximo permitido por transação. Vale para PIX, cartão e boleto, no checkout próprio e via API.
     Tentativas acima do limite são bloqueadas com erro.
   </p>

   <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-3 mb-4">
     <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-300/80">Limite Global Atual</p>
     <p className="text-2xl font-black text-white tabular-nums mt-1" style={{ fontFamily: "'Space Grotesk', monospace" }}>
       R$ {Number(maxTicketGlobal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
     </p>
   </div>

   <Label className="text-xs text-muted-foreground">Novo limite (R$)</Label>
   <Input
     type="number" step="0.01" min="1"
     value={maxTicketInput}
     onChange={e => setMaxTicketInput(e.target.value)}
     className="h-10 mt-1.5 mb-3 tabular-nums"
     placeholder="10000.00"
   />

   <div className="grid grid-cols-1 gap-2">
     <Button onClick={saveMaxTicketNewOnly} disabled={savingMaxTicket} size="sm" className="w-full gap-2">
       <Save className="h-3.5 w-3.5" />
       Aplicar SOMENTE para novos usuários
     </Button>
     <Button onClick={saveMaxTicketForAll} disabled={savingMaxTicket} variant="destructive" size="sm" className="w-full gap-2">
       <Users className="h-3.5 w-3.5" />
       Aplicar a TODOS (apaga limites individuais)
     </Button>
   </div>
   <p className="text-[10px] text-muted-foreground/70 mt-3">
     Dica: limites individuais por seller podem ser definidos na aba <strong>Sellers</strong> &rarr; abrir seller &rarr; campo <em>Ticket Máximo</em>.
   </p>
 </AdminPanel>
 </div>


 {/* ─── RETENTION SETTINGS ─── */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <AdminPanel>
 <PanelTitle color="violet" icon={<Lock className="h-4 w-4" />}>Retenção de Saldo — Global</PanelTitle>
 <p className="text-[11px] text-muted-foreground mt-1 mb-4">Aplica para todos os sellers sem retenção individual.</p>
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Retenção PIX (%)</Label>
 <Input type="number" step="0.1" value={globalRetention.pix_retention_pct} onChange={e => setGlobalRetention(p => ({ ...p, pix_retention_pct: e.target.value }))} className="h-10" />
 </div>
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Retenção Cartão (%)</Label>
 <Input type="number" step="0.1" value={globalRetention.card_retention_pct} onChange={e => setGlobalRetention(p => ({ ...p, card_retention_pct: e.target.value }))} className="h-10" />
 </div>
 </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Dias de Retenção (Reserva)</Label>
            <Input type="number" step="1" value={globalRetention.retention_days} onChange={e => setGlobalRetention(p => ({ ...p, retention_days: e.target.value }))} className="h-10" />
            <p className="text-[10px] text-muted-foreground">O saldo retido (rolling reserve) será liberado após esse número de dias</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Liberação Cartão (padrão D+7)</Label>
            <Select value={globalRetention.card_release_days} onValueChange={v => setGlobalRetention(p => ({ ...p, card_release_days: v }))}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">D+1 (1 dia)</SelectItem>
                <SelectItem value="7">D+7 (7 dias) — padrão</SelectItem>
                <SelectItem value="15">D+15 (15 dias)</SelectItem>
                <SelectItem value="30">D+30 (30 dias)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Quanto tempo o valor de vendas no cartão fica retido antes de virar saldo disponível.</p>
          </div>
 <Button onClick={saveGlobalRetention} disabled={saving} className="w-full gap-2">
 <Save className="h-4 w-4" /> Salvar Retenção Global
 </Button>
 </div>
 </AdminPanel>

 <AdminPanel>
 <PanelTitle color="violet" icon={<Users className="h-4 w-4" />}>Retenção Individual por Seller</PanelTitle>
 <div className="space-y-4 mt-4">
 <div className="flex gap-2">
 <Select value={newRetentionSeller} onValueChange={setNewRetentionSeller}>
 <SelectTrigger className="flex-1 h-10">
 <SelectValue placeholder="Selecionar seller..." />
 </SelectTrigger>
 <SelectContent>
 {profiles.filter(p => !sellerRetentions.some((r: any) => r.user_id === p.user_id)).map(p => (
 <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || p.user_id.slice(0, 8)}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Button onClick={addSellerRetention} disabled={!newRetentionSeller} className="gap-1 shrink-0">
 <Plus className="h-4 w-4" /> Adicionar
 </Button>
 </div>

 {sellerRetentions.length === 0 ? (
 <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma retenção individual configurada.</p>
 ) : (
 <div className="space-y-3 max-h-[400px] overflow-y-auto">
 {sellerRetentions.map((r: any) => (
 <div key={r.id} className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
 <div className="flex items-center justify-between">
 <p className="text-sm font-semibold text-foreground">{getSellerName(r.user_id)}</p>
 <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteSellerRetention(r.id)}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">PIX %</Label>
                        <Input type="number" step="0.1" value={r.pix_retention_pct} onChange={e => {
                          setSellerRetentions(prev => prev.map(s => s.id === r.id ? { ...s, pix_retention_pct: e.target.value } : s));
                        }} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Cartão %</Label>
                        <Input type="number" step="0.1" value={r.card_retention_pct} onChange={e => {
                          setSellerRetentions(prev => prev.map(s => s.id === r.id ? { ...s, card_retention_pct: e.target.value } : s));
                        }} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Dias Reserva</Label>
                        <Input type="number" step="1" value={r.retention_days} onChange={e => {
                          setSellerRetentions(prev => prev.map(s => s.id === r.id ? { ...s, retention_days: e.target.value } : s));
                        }} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Liberação Cartão</Label>
                        <Select value={String(r.card_release_days ?? 7)} onValueChange={v => {
                          setSellerRetentions(prev => prev.map(s => s.id === r.id ? { ...s, card_release_days: Number(v) } : s));
                        }}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">D+1</SelectItem>
                            <SelectItem value="7">D+7</SelectItem>
                            <SelectItem value="15">D+15</SelectItem>
                            <SelectItem value="30">D+30</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
 <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => saveSellerRetention(r)}>
 <Save className="h-3 w-3" /> Salvar
 </Button>
 </div>
 ))}
 </div>
 )}
 </div>
 </AdminPanel>
 </div>

 {/* ─── NOTIFICATIONS ─── */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <AdminPanel>
 <PanelTitle color="amber" icon={<Bell className="h-4 w-4" />}>Enviar Notificação</PanelTitle>
 <div className="space-y-4 mt-4">
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Destinatário</Label>
 <Select value={notifTarget} onValueChange={setNotifTarget}>
 <SelectTrigger className="h-10">
 <SelectValue placeholder="Selecionar..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">📢 Todos os sellers (broadcast)</SelectItem>
 {profiles.map(p => (
 <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || p.user_id.slice(0, 8)}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Tipo</Label>
 <Select value={notifType} onValueChange={setNotifType}>
 <SelectTrigger className="h-10">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="info">Informação</SelectItem>
 <SelectItem value="success">Sucesso</SelectItem>
 <SelectItem value="warning">Aviso</SelectItem>
 <SelectItem value="alert">Alerta</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Título</Label>
 <Input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="Ex: Novidade na plataforma!" className="h-10" />
 </div>
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Mensagem</Label>
 <textarea
 value={notifMessage}
 onChange={e => setNotifMessage(e.target.value)}
 placeholder="Escreva a mensagem..."
 className="w-full h-24 px-3 py-2 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
 />
 </div>
 <Button onClick={sendNotification} className="w-full gap-2">
 <Send className="h-4 w-4" /> Enviar Notificação
 </Button>
 </div>
 </AdminPanel>

 <AdminPanel>
 <PanelTitle color="amber" icon={<Bell className="h-4 w-4" />}>Notificações Enviadas</PanelTitle>
 <div className="space-y-2 mt-4 max-h-[500px] overflow-y-auto">
 {notifications.length === 0 ? (
 <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma notificação enviada</p>
 ) : notifications.map((n: any) => (
 <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
 n.type === "success" ? "bg-success/15 text-success" :
 n.type === "warning" ? "bg-warning/15 text-warning" :
 n.type === "alert" ? "bg-destructive/15 text-destructive" :
 "bg-info/15 text-info"
 }`}>{n.type}</span>
 <span className="text-[10px] text-muted-foreground">{n.user_id ? getSellerName(n.user_id) : "Todos"}</span>
 </div>
 <p className="text-sm font-semibold text-foreground">{n.title}</p>
 <p className="text-[11px] text-muted-foreground line-clamp-2">{n.message}</p>
 <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
 </div>
 <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive/60 hover:text-destructive shrink-0" onClick={() => deleteNotification(n.id)}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 ))}
 </div>
 </AdminPanel>
 </div>

 {/* Platform Info */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <AdminPanel>
 <PanelTitle color="cyan" icon={<Globe className="h-4 w-4" />}>Plataforma</PanelTitle>
 <div className="space-y-2 mt-3">
 <ConfigRow label="Nome" value="HOTZFY" />
 <ConfigRow label="Versão" value="2.0.0" mono />
 <ConfigRow label="Status" value="Operacional" valueClass="text-primary font-bold" />
 <ConfigRow label="Ambiente" value="Produção" />
 </div>
 </AdminPanel>

 <AdminPanel>
 <PanelTitle color="emerald" icon={<CreditCard className="h-4 w-4" />}>Métodos de Pagamento</PanelTitle>
 <div className="space-y-3 mt-3">
 <ToggleRow label="PIX" description="QR Code dinâmico via PodPay" defaultChecked />
 <ToggleRow label="Cartão de Crédito" description="Até 12x com juros" defaultChecked />
 <ToggleRow label="Boleto Bancário" description="Compensação 1-3 dias úteis" defaultChecked />
 </div>
 </AdminPanel>

 <AdminPanel>
 <PanelTitle color="violet" icon={<Shield className="h-4 w-4" />}>Segurança</PanelTitle>
 <div className="space-y-3 mt-3">
 <ToggleRow label="SSL/TLS" description="Criptografia em trânsito" defaultChecked disabled />
 <ToggleRow label="Anti-fraude" description="Bloqueio automático" defaultChecked />
 <ToggleRow label="Rate Limit" description="Proteção contra abuso" defaultChecked />
 </div>
 </AdminPanel>
 </div>
 </div>
 );
}

function ConfigRow({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
 return (
 <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
 <span className="text-xs text-muted-foreground">{label}</span>
 <span className={`text-xs ${mono ? "font-mono" : ""} ${valueClass || "font-medium text-foreground/80"}`}>{value}</span>
 </div>
 );
}

function ToggleRow({ label, description, defaultChecked, disabled }: { label: string; description: string; defaultChecked?: boolean; disabled?: boolean }) {
 const [checked, setChecked] = useState(defaultChecked ?? false);
 return (
 <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
 <div>
 <p className="text-xs font-medium text-foreground/80">{label}</p>
 <p className="text-[10px] text-muted-foreground">{description}</p>
 </div>
 <Switch checked={checked} onCheckedChange={setChecked} disabled={disabled} className="scale-90" />
 </div>
 );
}
