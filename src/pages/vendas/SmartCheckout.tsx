import { useState } from "react";
import { Globe, MapPin, DollarSign, TrendingUp, Languages, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type GeoRule = {
 id: string;
 country: string;
 flag: string;
 currency: string;
 multiplier: number;
 language: string;
 is_active: boolean;
 conversions: number;
};

const RULES: GeoRule[] = [
 { id: "1", country: "Brasil", flag: "🇧🇷", currency: "BRL", multiplier: 1.0, language: "pt-BR", is_active: true, conversions: 1240 },
 { id: "2", country: "Portugal", flag: "🇵🇹", currency: "EUR", multiplier: 0.18, language: "pt-PT", is_active: true, conversions: 186 },
 { id: "3", country: "Estados Unidos", flag: "🇺🇸", currency: "USD", multiplier: 0.20, language: "en-US", is_active: true, conversions: 89 },
 { id: "4", country: "Espanha", flag: "🇪🇸", currency: "EUR", multiplier: 0.18, language: "es-ES", is_active: false, conversions: 34 },
 { id: "5", country: "Angola", flag: "🇦🇴", currency: "AOA", multiplier: 100, language: "pt-AO", is_active: true, conversions: 67 },
 { id: "6", country: "Moçambique", flag: "🇲🇿", currency: "MZN", multiplier: 12.5, language: "pt-MZ", is_active: false, conversions: 23 },
];

const SETTINGS = [
 { key: "auto_detect", label: "Detectar País Automaticamente", description: "Usa geolocalização IP para adaptar moeda e idioma", enabled: true },
 { key: "auto_currency", label: "Conversão de Moeda em Tempo Real", description: "Atualiza preços com base nas taxas de câmbio atuais", enabled: true },
 { key: "auto_language", label: "Tradução Automática do Checkout", description: "Traduz campos e botões automaticamente", enabled: false },
 { key: "local_payment", label: "Métodos de Pagamento Locais", description: "Exibe métodos de pagamento populares de cada país", enabled: false },
];

export default function SmartCheckout() {
 const [rules, setRules] = useState(RULES);
 const [settings, setSettings] = useState(SETTINGS);

 const totalConversions = rules.filter(r => r.is_active).reduce((s, r) => s + r.conversions, 0);

 return (
 <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
 <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
 {[
 { label: "Países Ativos", value: rules.filter(r => r.is_active).length, icon: Globe, color: "text-primary" },
 { label: "Moedas Suportadas", value: new Set(rules.filter(r => r.is_active).map(r => r.currency)).size, icon: DollarSign, color: "text-emerald-500" },
 { label: "Conversões Globais", value: totalConversions, icon: TrendingUp, color: "text-amber-500" },
 { label: "Idiomas", value: new Set(rules.filter(r => r.is_active).map(r => r.language)).size, icon: Languages, color: "text-purple-500" },
 ].map(kpi => (
 <Card key={kpi.label} className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardContent className="flex items-center gap-3 p-4">
 <div className={`flex h-10 w-10 items-center justify-center rounded-[12px] bg-muted/50 ${kpi.color}`}>
 <kpi.icon className="h-5 w-5" />
 </div>
 <div>
 <p className="text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
 <p className="text-lg font-black">{kpi.value}</p>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>

 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-bold">Configurações Globais</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {settings.map((s, i) => (
 <div key={s.key} className="flex items-center justify-between rounded-xl bg-muted/15 px-4 py-3">
 <div>
 <p className="text-[13px] font-semibold">{s.label}</p>
 <p className="text-[11px] text-muted-foreground">{s.description}</p>
 </div>
 <Switch
 checked={s.enabled}
 onCheckedChange={() => {
 setSettings(prev => prev.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x));
 toast.success("Configuração atualizada!");
 }}
 />
 </div>
 ))}
 </CardContent>
 </Card>

 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardHeader className="pb-2">
 <CardTitle className="flex items-center gap-2 text-sm font-bold">
 <MapPin className="h-4 w-4 text-primary" /> Regras por País
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-2">
 {rules.map(r => (
 <div key={r.id} className="flex items-center justify-between rounded-xl bg-muted/15 px-4 py-3 transition-all hover:bg-muted/25">
 <div className="flex items-center gap-3">
 <span className="text-2xl">{r.flag}</span>
 <div>
 <div className="flex items-center gap-2">
 <p className="text-[13px] font-bold">{r.country}</p>
 <Badge variant="outline" className="text-[10px]">{r.currency}</Badge>
 </div>
 <p className="text-[11px] text-muted-foreground">
 Multiplicador: {r.multiplier}x • {r.conversions} conversões • {r.language}
 </p>
 </div>
 </div>
 <Switch
 checked={r.is_active}
 onCheckedChange={() => {
 setRules(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !x.is_active } : x));
 toast.success("Atualizado!");
 }}
 />
 </div>
 ))}
 </CardContent>
 </Card>
 </div>
 );
}
