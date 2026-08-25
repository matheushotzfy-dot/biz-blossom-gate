import { useState } from "react";
import { MessageSquare, Phone, Clock, TrendingUp, Plus, ToggleLeft, ToggleRight, Zap, AlertCircle, CheckCircle2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Campaign = {
 id: string;
 name: string;
 trigger: string;
 delay_minutes: number;
 message: string;
 is_active: boolean;
 sent: number;
 recovered: number;
 revenue: number;
};

const MOCK_CAMPAIGNS: Campaign[] = [
 { id: "1", name: "Carrinho Abandonado - PIX", trigger: "abandoned_cart", delay_minutes: 5, message: "Oi {{nome}}! Vi que você estava quase finalizando a compra de {{produto}}. Posso te ajudar? 🚀", is_active: true, sent: 342, recovered: 87, revenue: 12450 },
 { id: "2", name: "Boleto Não Pago", trigger: "unpaid_boleto", delay_minutes: 60, message: "Olá {{nome}}! Seu boleto de {{produto}} está vencendo. Que tal pagar via PIX? É instantâneo! ⚡", is_active: true, sent: 156, recovered: 41, revenue: 6890 },
 { id: "3", name: "PIX Expirado", trigger: "expired_pix", delay_minutes: 30, message: "{{nome}}, seu PIX expirou! Gerei um novo código pra você: {{link}}. Aproveite! 💚", is_active: false, sent: 89, recovered: 23, revenue: 3200 },
];

const TRIGGERS = [
 { value: "abandoned_cart", label: "Carrinho Abandonado" },
 { value: "unpaid_boleto", label: "Boleto Não Pago" },
 { value: "expired_pix", label: "PIX Expirado" },
 { value: "failed_card", label: "Cartão Recusado" },
];

export default function RecuperacaoWhatsApp() {
 const [campaigns, setCampaigns] = useState(MOCK_CAMPAIGNS);
 const [showNew, setShowNew] = useState(false);

 const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
 const totalRecovered = campaigns.reduce((s, c) => s + c.recovered, 0);
 const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
 const conversionRate = totalSent > 0 ? ((totalRecovered / totalSent) * 100).toFixed(1) : "0";

 const toggleCampaign = (id: string) => {
 setCampaigns(prev => prev.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c));
 toast.success("Status atualizado!");
 };

 return (
 <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
 <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
 {[
 { label: "Mensagens Enviadas", value: totalSent.toLocaleString("pt-BR"), icon: Send, color: "text-primary" },
 { label: "Vendas Recuperadas", value: totalRecovered.toLocaleString("pt-BR"), icon: CheckCircle2, color: "text-emerald-500" },
 { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-amber-500" },
 { label: "Receita Recuperada", value: `R$ ${totalRevenue.toLocaleString("pt-BR")}`, icon: Zap, color: "text-primary" },
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

 <div className="flex items-center justify-between">
 <h2 className="text-lg font-bold">Campanhas de Recuperação</h2>
 <Button onClick={() => setShowNew(!showNew)} size="sm" className="gap-2 rounded-xl">
 <Plus className="h-4 w-4" /> Nova Campanha
 </Button>
 </div>

 {showNew && (
 <Card className="border-primary/20 bg-card/80 backdrop-blur-xl">
 <CardContent className="space-y-4 p-5">
 <div className="grid gap-4 md:grid-cols-3">
 <Input placeholder="Nome da campanha" className="rounded-xl" />
 <Select>
 <SelectTrigger className="rounded-xl"><SelectValue placeholder="Gatilho" /></SelectTrigger>
 <SelectContent>
 {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <Input type="number" placeholder="Delay (minutos)" defaultValue={5} className="rounded-xl" />
 </div>
 <Textarea placeholder="Mensagem (use {{nome}}, {{produto}}, {{link}})" className="min-h-[80px] rounded-xl" />
 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={() => setShowNew(false)} className="rounded-xl">Cancelar</Button>
 <Button onClick={() => { setShowNew(false); toast.success("Campanha criada!"); }} className="rounded-xl">Salvar</Button>
 </div>
 </CardContent>
 </Card>
 )}

 <div className="space-y-3">
 {campaigns.map(c => (
 <Card key={c.id} className="border-border/40 bg-card/60 backdrop-blur-xl transition-all hover:border-border/60">
 <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
 <div className="flex items-start gap-4">
 <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary/10">
 <MessageSquare className="h-5 w-5 text-primary" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h3 className="font-bold">{c.name}</h3>
 <Badge variant={c.is_active ? "default" : "secondary"} className="text-[10px]">
 {c.is_active ? "Ativa" : "Pausada"}
 </Badge>
 </div>
 <p className="mt-1 text-[12px] text-muted-foreground">
 <Clock className="mr-1 inline h-3 w-3" />
 Delay: {c.delay_minutes}min • Enviadas: {c.sent} • Recuperadas: {c.recovered}
 </p>
 <p className="mt-1 text-[12px] text-muted-foreground/70 italic line-clamp-1">"{c.message}"</p>
 </div>
 </div>
 <div className="flex items-center gap-4">
 <div className="text-right">
 <p className="text-[11px] text-muted-foreground">Receita</p>
 <p className="font-bold text-emerald-500">R$ {c.revenue.toLocaleString("pt-BR")}</p>
 </div>
 <Switch checked={c.is_active} onCheckedChange={() => toggleCampaign(c.id)} />
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </div>
 );
}
