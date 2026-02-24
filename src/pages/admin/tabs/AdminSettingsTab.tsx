import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Globe, CreditCard, Zap, Shield, Bell, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export default function AdminSettingsTab() {
  const [fees, setFees] = useState<Tables<"fees">[]>([]);

  useEffect(() => {
    supabase.from("fees").select("*").order("name").then(({ data }) => { if (data) setFees(data); });
  }, []);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform */}
        <SettingsCard icon={<Globe className="h-4 w-4" />} title="Plataforma">
          <ConfigRow label="Nome" value="PayGate" />
          <ConfigRow label="Versão" value="2.0.0" mono />
          <ConfigRow label="Status" value="Ativo" valueClass="text-emerald-400 font-bold" />
          <ConfigRow label="Ambiente" value="Produção" />
          <ConfigRow label="Uptime" value="99.97%" valueClass="text-emerald-400 font-bold" />
        </SettingsCard>

        {/* Payment Methods */}
        <SettingsCard icon={<CreditCard className="h-4 w-4" />} title="Métodos de Pagamento">
          <ToggleRow label="PIX" description="QR Code dinâmico via PodPay" defaultChecked />
          <ToggleRow label="Cartão de Crédito" description="Até 12x com juros" defaultChecked />
          <ToggleRow label="Boleto Bancário" description="Compensação 1-3 dias úteis" defaultChecked />
        </SettingsCard>

        {/* Fees */}
        <SettingsCard icon={<Zap className="h-4 w-4" />} title="Taxas da Plataforma">
          {fees.length === 0 ? (
            <p className="text-xs text-white/20">Nenhuma taxa configurada</p>
          ) : (
            <div className="space-y-2">
              {fees.map(fee => (
                <div key={fee.id} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                  <div><p className="text-xs font-medium text-white/80">{fee.name}</p><p className="text-[10px] text-white/25">{fee.description || fee.fee_type}</p></div>
                  <span className="font-mono text-sm font-bold text-emerald-400">{fee.fee_type === "percentage" ? `${Number(fee.value).toFixed(1)}%` : `R$ ${Number(fee.value).toFixed(2)}`}</span>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>

        {/* Security */}
        <SettingsCard icon={<Shield className="h-4 w-4" />} title="Segurança">
          <ToggleRow label="SSL/TLS" description="Criptografia em trânsito" defaultChecked disabled />
          <ToggleRow label="2FA Admin" description="Autenticação em 2 fatores" />
          <ToggleRow label="Anti-fraude" description="Bloqueio automático de transações suspeitas" defaultChecked />
          <ToggleRow label="Rate Limit" description="Proteção contra abuso de API" defaultChecked />
          <ToggleRow label="KYC Obrigatório" description="Verificação de identidade para saques" defaultChecked />
        </SettingsCard>

        {/* Notifications */}
        <SettingsCard icon={<Bell className="h-4 w-4" />} title="Notificações" fullWidth>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ToggleRow label="E-mail" description="Transações e saques" defaultChecked />
            <ToggleRow label="Webhooks" description="Eventos em tempo real" defaultChecked />
            <ToggleRow label="Push" description="Alertas do navegador" />
          </div>
        </SettingsCard>

        {/* API & Integrations */}
        <SettingsCard icon={<Zap className="h-4 w-4" />} title="APIs & Integrações" fullWidth>
          <ConfigRow label="Gateway Principal" value="PodPay" />
          <ConfigRow label="Chave Pública" value="••••••••" mono />
          <ConfigRow label="Webhook Postback" value="/podpay-postback" mono />
          <ConfigRow label="Cashout Endpoint" value="/podpay-cashout" mono />
          <ConfigRow label="Status API" value="Operacional" valueClass="text-emerald-400 font-bold" />
        </SettingsCard>
      </div>
    </div>
  );
}

function SettingsCard({ icon, title, children, fullWidth }: { icon: React.ReactNode; title: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-[hsl(228,18%,6%)] rounded-2xl border border-white/[0.04] p-5 hover:border-white/[0.06] transition-colors ${fullWidth ? "lg:col-span-2" : ""}`}>
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <h3 className="text-sm font-bold flex items-center gap-2 text-white mb-4">
        <span className="h-7 w-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/60">{icon}</span>
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ConfigRow({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/[0.03] last:border-0">
      <span className="text-xs text-white/30">{label}</span>
      <span className={`text-xs ${mono ? "font-mono" : ""} ${valueClass || "font-medium text-white/70"}`}>{value}</span>
    </div>
  );
}

function ToggleRow({ label, description, defaultChecked, disabled }: { label: string; description: string; defaultChecked?: boolean; disabled?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked ?? false);
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
      <div><p className="text-xs font-medium text-white/70">{label}</p><p className="text-[10px] text-white/25">{description}</p></div>
      <Switch checked={checked} onCheckedChange={setChecked} disabled={disabled} className="scale-90" />
    </div>
  );
}
