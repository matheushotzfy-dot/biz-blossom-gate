import { useState } from "react";
import { MessageSquare, Copy, ExternalLink, Settings2, Link2, Smartphone, CheckCircle2, Zap, Globe, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getCheckoutLink } from "@/components/products/productPresentation";
import { copyText } from "@/features/public-checkout/copyText";

export default function CheckoutWhatsApp() {
 const { user } = useAuth();
 const [selectedProduct, setSelectedProduct] = useState("");
 const [whatsappNumber, setWhatsappNumber] = useState("");
 const [autoMessage, setAutoMessage] = useState(
 "Olá! Quero comprar *{{produto}}* por R$ {{preco}}. Segue meu link de pagamento: {{link}}"
 );

 const { data: products = [] } = useQuery({
 queryKey: ["products-whatsapp", user?.id],
 queryFn: async () => {
 if (!user?.id) return [];
 const { data } = await supabase
 .from("products")
 .select("id, name, price, checkout_url")
 .eq("user_id", user.id)
 .eq("status", "active")
 .is("deleted_at", null);
 return data || [];
 },
 enabled: !!user?.id,
 });

 const selectedProd = products.find((p) => p.id === selectedProduct);
 // `checkout_url` já vem como "/pay/<slug>" (ou só o slug): getCheckoutLink monta o endereço certo.
 const checkoutUrl = selectedProd?.checkout_url ? getCheckoutLink(selectedProd.checkout_url) : "";

 const whatsappLink = selectedProd
 ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
 autoMessage
 .replace("{{produto}}", selectedProd.name)
 .replace("{{preco}}", Number(selectedProd.price).toFixed(2))
 .replace("{{link}}", checkoutUrl)
 )}`
 : "";

 const copyLink = async (text: string) => {
 if (await copyText(text)) toast.success("Link copiado.");
 else toast.error("Não foi possível copiar. Selecione o link e copie.");
 };

 return (
 <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
 {/* Tracking notice */}
 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardContent className="flex items-center gap-3 p-4">
 <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-muted/50 text-muted-foreground">
 <Clock className="h-5 w-5" />
 </div>
 <div>
 <p className="text-sm font-semibold">Métricas de links e conversões via WhatsApp</p>
 <p className="text-[12px] text-muted-foreground">
 O rastreamento de cliques, conversões e receita por este canal chega em breve.
 </p>
 </div>
 </CardContent>
 </Card>

 <div className="grid gap-6 lg:grid-cols-2">
 {/* Generator */}
 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardHeader className="pb-4">
 <CardTitle className="flex items-center gap-2 text-base">
 <MessageSquare className="h-5 w-5 text-emerald-500" />
 Gerador de Link WhatsApp
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label className="text-sm">Produto</Label>
 <Select value={selectedProduct} onValueChange={setSelectedProduct}>
 <SelectTrigger className="rounded-xl">
 <SelectValue placeholder="Selecione um produto" />
 </SelectTrigger>
 <SelectContent>
 {products.map((p) => (
 <SelectItem key={p.id} value={p.id}>
 {p.name} — R$ {Number(p.price).toFixed(2)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label className="text-sm">Seu WhatsApp (com DDD)</Label>
 <Input
 placeholder="11999998888"
 value={whatsappNumber}
 onChange={(e) => setWhatsappNumber(e.target.value)}
 className="rounded-xl"
 />
 </div>

 <div className="space-y-2">
 <Label className="text-sm">Mensagem automática</Label>
 <Textarea
 value={autoMessage}
 onChange={(e) => setAutoMessage(e.target.value)}
 className="min-h-[80px] rounded-xl text-sm"
 />
 <p className="text-[11px] text-muted-foreground">
 Variáveis: {"{{produto}}"}, {"{{preco}}"}, {"{{link}}"}
 </p>
 </div>

 {selectedProduct && whatsappNumber && (
 <div className="space-y-3 rounded-xl border border-border/40 bg-muted/30 p-4">
 <p className="text-xs font-semibold text-muted-foreground">LINK GERADO</p>
 <div className="flex gap-2">
 <Input
 value={whatsappLink}
 readOnly
 className="rounded-xl text-xs"
 />
 <Button
 size="icon"
 variant="outline"
 className="shrink-0 rounded-xl"
 onClick={() => copyLink(whatsappLink)}
 >
 <Copy className="h-4 w-4" />
 </Button>
 </div>
 <div className="flex gap-2">
 <Button
 className="flex-1 gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
 onClick={() => window.open(whatsappLink, "_blank", "noopener,noreferrer")}
 >
 <ExternalLink className="h-4 w-4" /> Testar no WhatsApp
 </Button>
 <Button variant="outline" className="gap-2 rounded-xl" onClick={() => copyLink(checkoutUrl)}>
 <Link2 className="h-4 w-4" /> Copiar Checkout
 </Button>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Bot config */}
 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardHeader className="pb-4">
 <CardTitle className="flex items-center gap-2 text-base">
 <Settings2 className="h-5 w-5 text-primary" />
 Bot Automatizado
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/30 p-4">
 <Clock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
 <div>
 <p className="font-semibold text-sm">Em breve</p>
 <p className="text-[11px] text-muted-foreground">
 A resposta automática via bot exigirá conectar a API oficial do WhatsApp Business.
 Estamos preparando essa integração.
 </p>
 </div>
 </div>

 <div className="space-y-3">
 <p className="text-xs font-semibold text-muted-foreground">FLUXO DO CHECKOUT</p>
 {[
 { step: 1, label: "Cliente clica no link do WhatsApp", icon: Smartphone },
 { step: 2, label: "Conversa abre com mensagem pré-preenchida", icon: MessageSquare },
 { step: 3, label: "Vendedor (ou bot) envia link de pagamento", icon: Link2 },
 { step: 4, label: "Cliente paga via PIX, Cartão ou Boleto", icon: CheckCircle2 },
 { step: 5, label: "Confirmação automática no WhatsApp", icon: Zap },
 ].map((s) => (
 <div key={s.step} className="flex items-center gap-3">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
 {s.step}
 </div>
 <s.icon className="h-4 w-4 text-muted-foreground" />
 <p className="text-sm">{s.label}</p>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Quick share buttons */}
 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardHeader className="pb-4">
 <CardTitle className="flex items-center gap-2 text-base">
 <Globe className="h-5 w-5 text-primary" />
 Compartilhamento Rápido
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid gap-3 md:grid-cols-3">
 {products.slice(0, 6).map((p) => (
 <div
 key={p.id}
 className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 p-3"
 >
 <div>
 <p className="text-sm font-semibold truncate max-w-[180px]">{p.name}</p>
 <p className="text-xs text-muted-foreground">
 R$ {Number(p.price).toFixed(2)}
 </p>
 </div>
 <Button
 size="sm"
 variant="outline"
 className="gap-1 rounded-xl text-emerald-600 border-emerald-200 hover:bg-emerald-50"
 onClick={() => {
 const url = p.checkout_url ? getCheckoutLink(p.checkout_url) : "";
 if (!url) {
 toast.error("Configure a URL de checkout do produto primeiro");
 return;
 }
 const msg = `Confira *${p.name}* por apenas R$ ${Number(p.price).toFixed(2)}!\n\n${url}`;
 window.open(
 `https://wa.me/?text=${encodeURIComponent(msg)}`,
 "_blank",
 "noopener,noreferrer"
 );
 }}
 >
 <MessageSquare className="h-3.5 w-3.5" />
 Enviar
 </Button>
 </div>
 ))}
 {products.length === 0 && (
 <p className="col-span-3 text-center text-sm text-muted-foreground py-8">
 Nenhum produto aprovado. Crie um produto primeiro.
 </p>
 )}
 </div>
 </CardContent>
 </Card>
 </div>
 );
}
