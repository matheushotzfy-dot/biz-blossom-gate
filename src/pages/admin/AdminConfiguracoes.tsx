import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Save, Zap, CreditCard, Globe, Shield, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export default function AdminConfiguracoes() {
 const [fees, setFees] = useState<Tables<"fees">[]>([]);

 useEffect(() => {
 supabase.from("fees").select("*").order("name")
 .then(({ data }) => { if (data) setFees(data); });
 }, []);

 return (
 <div className="space-y-6 dark">
 <div>
 <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
 <Settings className="h-6 w-6 text-primary" /> Configurações
 </h1>
 <p className="text-muted-foreground text-sm mt-1">Configurações gerais da plataforma</p>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Platform */}
 <div className="bg-card rounded-xl border border-border p-6">
 <h3 className="font-semibold mb-4 flex items-center gap-2">
 <Globe className="h-4 w-4 text-primary" /> Plataforma
 </h3>
 <div className="space-y-4">
 <ConfigRow label="Nome" value="HOTZFY" />
 <ConfigRow label="Versão" value="2.0.0" mono />
 <ConfigRow label="Status" value="Ativo" valueClass="text-primary font-medium" />
 <ConfigRow label="Ambiente" value="Produção" />
 </div>
 </div>

 {/* Payment Methods */}
 <div className="bg-card rounded-xl border border-border p-6">
 <h3 className="font-semibold mb-4 flex items-center gap-2">
 <CreditCard className="h-4 w-4 text-primary" /> Métodos de Pagamento
 </h3>
 <div className="space-y-4">
 <ToggleRow label="PIX" description="QR Code dinâmico" defaultChecked />
 <ToggleRow label="Cartão de Crédito" description="Até 12x" defaultChecked />
 <ToggleRow label="Boleto Bancário" description="Compensação em 1-3 dias" defaultChecked />
 </div>
 </div>

 {/* Fees */}
 <div className="bg-card rounded-xl border border-border p-6">
 <h3 className="font-semibold mb-4 flex items-center gap-2">
 <Zap className="h-4 w-4 text-primary" /> Taxas da Plataforma
 </h3>
 {fees.length === 0 ? (
 <p className="text-sm text-muted-foreground">Nenhuma taxa configurada</p>
 ) : (
 <div className="space-y-3">
 {fees.map((fee) => (
 <div key={fee.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
 <div>
 <p className="text-sm font-medium">{fee.name}</p>
 <p className="text-xs text-muted-foreground">{fee.description || fee.fee_type}</p>
 </div>
 <span className="font-mono text-sm font-semibold text-primary">
 {fee.fee_type === "percentage" ? `${Number(fee.value).toFixed(1)}%` : `R$ ${Number(fee.value).toFixed(2)}`}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Security */}
 <div className="bg-card rounded-xl border border-border p-6">
 <h3 className="font-semibold mb-4 flex items-center gap-2">
 <Shield className="h-4 w-4 text-primary" /> Segurança
 </h3>
 <div className="space-y-4">
 <ToggleRow label="SSL/TLS" description="Criptografia em trânsito" defaultChecked disabled />
 <ToggleRow label="2FA Admin" description="Autenticação em 2 fatores" />
 <ToggleRow label="Anti-fraude" description="Bloqueio automático" defaultChecked />
 <ToggleRow label="Rate Limit" description="Proteção contra abuso" defaultChecked />
 </div>
 </div>

 {/* Notifications */}
 <div className="bg-card rounded-xl border border-border p-6 lg:col-span-2">
 <h3 className="font-semibold mb-4 flex items-center gap-2">
 <Bell className="h-4 w-4 text-primary" /> Notificações
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <ToggleRow label="E-mail" description="Transações e saques" defaultChecked />
 <ToggleRow label="Webhooks" description="Eventos em tempo real" defaultChecked />
 <ToggleRow label="Push" description="Notificações no navegador" />
 </div>
 </div>
 </div>
 </div>
 );
}

function ConfigRow({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
 return (
 <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
 <span className="text-sm text-muted-foreground">{label}</span>
 <span className={`text-sm ${mono ? "font-mono" : ""} ${valueClass || "font-medium"}`}>{value}</span>
 </div>
 );
}

function ToggleRow({ label, description, defaultChecked, disabled }: { label: string; description: string; defaultChecked?: boolean; disabled?: boolean }) {
 const [checked, setChecked] = useState(defaultChecked ?? false);
 return (
 <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
 <div>
 <p className="text-sm font-medium">{label}</p>
 <p className="text-xs text-muted-foreground">{description}</p>
 </div>
 <Switch checked={checked} onCheckedChange={setChecked} disabled={disabled} />
 </div>
 );
}
