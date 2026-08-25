import { useState } from "react";
import { MessageSquare, Copy, ExternalLink, QrCode, Settings2, Phone, Link2, Smartphone, CheckCircle2, Zap, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function CheckoutWhatsApp() {
 const { user } = useAuth();
 const [selectedProduct, setSelectedProduct] = useState("");
 const [whatsappNumber, setWhatsappNumber] = useState("");
 const [autoMessage, setAutoMessage] = useState(
 "Olá! Quero comprar *{{produto}}* por R$ {{preco}}. Segue meu link de pagamento: {{link}}"
 );
 const [botEnabled, setBotEnabled] = useState(false);
 const [autoReply, setAutoReply] = useState(
 "Oi {{nome}}! 🎉 Aqui está seu link de pagamento seguro:\n\n{{link}}\n\nÉ só clicar e escolher PIX ou Cartão. Qualquer dúvida, estou aqui!"
 );

 const { data: products = [] } = useQuery({
 queryKey: ["products-whatsapp", user?.id],
 queryFn: async () => {
 if (!user?.id) return [];
 const { data } = await supabase
 .from("products")
 .select("id, name, price, checkout_url")
 .eq("user_id", user.id)
 .eq("status", "approved");
 return data || [];
 },
 enabled: !!user?.id,
 });

 const selectedProd = products.find((p) => p.id === selectedProduct);
 const checkoutUrl = selectedProd?.checkout_url
 ? `${window.location.origin}/pay/${selectedProd.checkout_url}`
 : "";

 const whatsappLink = selectedProd
 ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
 autoMessage
 .replace("{{produto}}", selectedProd.name)
 .replace("{{preco}}", (selectedProd.price / 100).toFixed(2))
 .replace("{{link}}", checkoutUrl)
 )}`
 : "";

 const copyLink = (text: string) => {
 navigator.clipboard.writeText(text);
 toast.success("Link copiado!");
 };

 return (
 <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
 {/* KPIs */}
 <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
 {[
 { label: "Links Gerados", value: "0", icon: Link2, color: "text-primary" },
 { label: "Cliques WhatsApp", value: "0", icon: Smartphone, color: "text-emerald-500" },
 { label: "Conversões", value: "0", icon: CheckCircle2, color: "text-amber-500" },
 { label: "Receita via WhatsApp", value: "R$ 0", icon: Zap, color: "text-primary" },
 ].map((kpi) => (
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
 {p.name} — R$ {(p.price / 100).toFixed(2)}
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
 onClick={() => window.open(whatsappLink, "_blank")}
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
 <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 p-4">
 <div>
 <p className="font-semibold text-sm">Resposta automática</p>
 <p className="text-[11px] text-muted-foreground">
 Quando alguém enviar mensagem, responder automaticamente com link de pagamento
 </p>
 </div>
 <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
 </div>

 {botEnabled && (
 <>
 <div className="space-y-2">
 <Label className="text-sm">Mensagem de resposta automática</Label>
 <Textarea
 value={autoReply}
 onChange={(e) => setAutoReply(e.target.value)}
 className="min-h-[100px] rounded-xl text-sm"
 />
 <p className="text-[11px] text-muted-foreground">
 Variáveis: {"{{nome}}"}, {"{{link}}"}, {"{{produto}}"}, {"{{preco}}"}
 </p>
 </div>

 <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
 <div className="flex gap-2">
 <Phone className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
 <div>
 <p className="text-sm font-semibold text-amber-600">Integração via API</p>
 <p className="text-[11px] text-muted-foreground">
 Para ativar o bot automatizado, você precisa conectar sua conta da API do WhatsApp Business.
 Vá em Integrações → Apps para configurar.
 </p>
 </div>
 </div>
 </div>
 </>
 )}

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
 R$ {(p.price / 100).toFixed(2)}
 </p>
 </div>
 <Button
 size="sm"
 variant="outline"
 className="gap-1 rounded-xl text-emerald-600 border-emerald-200 hover:bg-emerald-50"
 onClick={() => {
 const url = p.checkout_url
 ? `${window.location.origin}/pay/${p.checkout_url}`
 : "";
 if (!url) {
 toast.error("Configure a URL de checkout do produto primeiro");
 return;
 }
 const msg = `Confira *${p.name}* por apenas R$ ${(p.price / 100).toFixed(2)}!\n\n${url}`;
 window.open(
 `https://wa.me/?text=${encodeURIComponent(msg)}`,
 "_blank"
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
