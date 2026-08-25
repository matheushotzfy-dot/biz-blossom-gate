import { useState } from "react";
import { ArrowUpRight, Gift, TrendingUp, Plus, Trash2, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type UpsellOffer = {
 id: string;
 name: string;
 product_name: string;
 discount_pct: number;
 is_active: boolean;
 views: number;
 conversions: number;
 revenue: number;
};

const MOCK: UpsellOffer[] = [
 { id: "1", name: "Upgrade VIP", product_name: "Curso Avançado", discount_pct: 30, is_active: true, views: 520, conversions: 78, revenue: 15600 },
 { id: "2", name: "Mentoria 1:1", product_name: "Mentoria Premium", discount_pct: 20, is_active: true, views: 340, conversions: 34, revenue: 27200 },
 { id: "3", name: "Kit Completo", product_name: "Pack Templates", discount_pct: 50, is_active: false, views: 180, conversions: 45, revenue: 4500 },
];

export default function UpsellPosPagamento() {
 const [offers, setOffers] = useState(MOCK);

 const totalRevenue = offers.reduce((s, o) => s + o.revenue, 0);
 const totalConversions = offers.reduce((s, o) => s + o.conversions, 0);
 const totalViews = offers.reduce((s, o) => s + o.views, 0);
 const avgConversion = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : "0";

 return (
 <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
 <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
 {[
 { label: "Receita Upsell", value: `R$ ${totalRevenue.toLocaleString("pt-BR")}`, icon: TrendingUp, color: "text-primary" },
 { label: "Conversões", value: totalConversions, icon: ArrowUpRight, color: "text-emerald-500" },
 { label: "Taxa Média", value: `${avgConversion}%`, icon: Gift, color: "text-amber-500" },
 { label: "Ofertas Ativas", value: offers.filter(o => o.is_active).length, icon: Gift, color: "text-primary" },
 ].map(kpi => (
 <Card key={kpi.label} className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardContent className="flex items-center gap-3 p-4">
 <div className={`flex h-10 w-10 items-center justify-center rounded-[12px] bg-muted/50 ${kpi.color}`}>
 <kpi.icon className="h-5 w-5" />
 </div>
 <div>
 <p className="text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
 <p className="text-lg font-black">{String(kpi.value)}</p>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>

 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-bold">Ofertas de Upsell</h2>
 <p className="text-sm text-muted-foreground">Exibidas na página de obrigado após o pagamento</p>
 </div>
 <Button size="sm" className="gap-2 rounded-xl" onClick={() => toast.info("Em breve: criador de ofertas")}>
 <Plus className="h-4 w-4" /> Nova Oferta
 </Button>
 </div>

 <div className="space-y-3">
 {offers.map(o => (
 <Card key={o.id} className="border-border/40 bg-card/60 backdrop-blur-xl transition-all hover:border-border/60">
 <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
 <div className="flex items-start gap-4">
 <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary/10">
 <ArrowUpRight className="h-5 w-5 text-primary" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h3 className="font-bold">{o.name}</h3>
 <Badge variant={o.is_active ? "default" : "secondary"} className="text-[10px]">
 {o.is_active ? "Ativa" : "Pausada"}
 </Badge>
 <Badge variant="outline" className="text-[10px] text-primary">{o.discount_pct}% OFF</Badge>
 </div>
 <p className="mt-1 text-[12px] text-muted-foreground">
 Produto: {o.product_name} • Views: {o.views} • Conversões: {o.conversions}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-4">
 <div className="text-right">
 <p className="text-[11px] text-muted-foreground">Receita</p>
 <p className="font-bold text-emerald-500">R$ {o.revenue.toLocaleString("pt-BR")}</p>
 </div>
 <Switch
 checked={o.is_active}
 onCheckedChange={() => {
 setOffers(prev => prev.map(x => x.id === o.id ? { ...x, is_active: !x.is_active } : x));
 toast.success("Atualizado!");
 }}
 />
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </div>
 );
}
