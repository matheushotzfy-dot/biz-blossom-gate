import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Settings, Globe, CreditCard, Zap, Shield, Bell, Save, RefreshCw,
  ToggleLeft, DollarSign, Percent, ArrowDownToLine, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/auditLog";
import { AdminPanel, PanelTitle, AdminKpi } from "./AdminOverviewTab";
import type { Tables } from "@/integrations/supabase/types";

interface PlatformSetting {
  id: string;
  key: string;
  value: any;
  updated_at: string;
  updated_by: string | null;
}

export default function AdminSettingsTab() {
  const { user } = useAuth();
  const [fees, setFees] = useState<Tables<"fees">[]>([]);
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fee form states
  const [whitePercentage, setWhitePercentage] = useState("4.99");
  const [whiteFixed, setWhiteFixed] = useState("2.50");
  const [whiteWithdrawal, setWhiteWithdrawal] = useState("5.00");
  const [blackPercentage, setBlackPercentage] = useState("4.99");
  const [blackFixed, setBlackFixed] = useState("2.50");
  const [blackWithdrawal, setBlackWithdrawal] = useState("5.00");

  // Auto-approve states
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveMaxAmount, setAutoApproveMaxAmount] = useState("100");

  // Editable platform fees
  const [editingFees, setEditingFees] = useState<Record<string, string>>({});

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [feesRes, settingsRes] = await Promise.all([
      supabase.from("fees").select("*").order("name"),
      supabase.from("platform_settings").select("*"),
    ]);
    if (feesRes.data) {
      setFees(feesRes.data);
      const feeMap: Record<string, string> = {};
      feesRes.data.forEach(f => { feeMap[f.id] = String(f.value); });
      setEditingFees(feeMap);
    }
    if (settingsRes.data) {
      setSettings(settingsRes.data as PlatformSetting[]);
      const autoApprove = settingsRes.data.find((s: any) => s.key === "auto_approve_withdrawals");
      if (autoApprove) {
        const val = (autoApprove as any).value;
        setAutoApproveEnabled(val.enabled ?? false);
        setAutoApproveMaxAmount(String(val.max_amount ?? 100));
      }
      const whiteSettings = settingsRes.data.find((s: any) => s.key === "fees_white");
      if (whiteSettings) {
        const v = (whiteSettings as any).value;
        setWhitePercentage(String(v.percentage ?? 4.99));
        setWhiteFixed(String(v.fixed ?? 2.50));
        setWhiteWithdrawal(String(v.withdrawal ?? 5.00));
      }
      const blackSettings = settingsRes.data.find((s: any) => s.key === "fees_black");
      if (blackSettings) {
        const v = (blackSettings as any).value;
        setBlackPercentage(String(v.percentage ?? 4.99));
        setBlackFixed(String(v.fixed ?? 2.50));
        setBlackWithdrawal(String(v.withdrawal ?? 5.00));
      }
    }
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
      .update({ value: val as any, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("key", key);
    if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    toast.success(`Taxas ${tier.toUpperCase()} salvas!`);
    await logAdminAction(`update_fees_${tier}`, "platform_settings", key, val as any);
    setSaving(false);
  };

  const saveAutoApprove = async () => {
    if (!user) return;
    setSaving(true);
    const val = { enabled: autoApproveEnabled, max_amount: Number(autoApproveMaxAmount) };
    const { error } = await supabase.from("platform_settings")
      .update({ value: val as any, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("key", "auto_approve_withdrawals");
    if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    toast.success("Configuração de auto-aprovação salva!");
    await logAdminAction("update_auto_approve", "platform_settings", "auto_approve_withdrawals", val as any);
    setSaving(false);
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
    await logAdminAction("update_global_fee", "fees", feeId, { name: fee.name, old_value: fee.value, new_value: newValue } as any);
    loadAll();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpi icon={<Zap className="h-5 w-5" />} label="Taxas Cadastradas" value={String(fees.length)} sub="Na plataforma" gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" />
        <AdminKpi icon={<ArrowDownToLine className="h-5 w-5" />} label="Auto-Aprovar" value={autoApproveEnabled ? "Ativo" : "Inativo"} sub={autoApproveEnabled ? `Até R$ ${autoApproveMaxAmount}` : "Desabilitado"} gradient={autoApproveEnabled ? "from-emerald-500 to-emerald-600" : "from-zinc-500 to-zinc-600"} glowColor={autoApproveEnabled ? "rgba(52,211,153,0.15)" : "rgba(100,100,100,0.1)"} />
        <AdminKpi icon={<Globe className="h-5 w-5" />} label="Tier White" value={`${whitePercentage}%`} sub={`+ R$ ${whiteFixed} fixo`} gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<Shield className="h-5 w-5" />} label="Tier Black" value={`${blackPercentage}%`} sub={`+ R$ ${blackFixed} fixo`} gradient="from-zinc-500 to-zinc-700" glowColor="rgba(100,100,100,0.15)" />
      </div>

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
              <p className="text-[10px] text-muted-foreground">Saques acima desse valor entram para aprovação manual</p>
            </div>
            <Button onClick={saveAutoApprove} disabled={saving} className="w-full gap-2">
              <Save className="h-4 w-4" /> Salvar Configuração
            </Button>
          </div>
        </AdminPanel>

        {/* Global Platform Fees (from fees table) */}
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
                      type="number"
                      step="0.01"
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
            <ConfigRow label="Uptime" value="99.97%" valueClass="text-primary font-bold" />
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
            <ToggleRow label="2FA Admin" description="Autenticação em 2 fatores" />
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
