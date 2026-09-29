import { useState, useRef, useEffect, ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Palette, Timer, Image as ImageIcon, ShieldCheck, CreditCard, QrCode, FileText, MapPin, Mail, X, Upload, Package, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
 product: Tables<"products">;
 open: boolean;
 onOpenChange: (v: boolean) => void;
 onSaved: () => void;
}

export default function CheckoutSettingsDialog({ product, open, onOpenChange, onSaved }: Props) {
 const { user } = useAuth();
 const [saving, setSaving] = useState(false);

 const [buttonColor, setButtonColor] = useState(product.checkout_button_color || "#10b981");
 const [timerEnabled, setTimerEnabled] = useState(product.checkout_timer_enabled ?? true);
 const [timerMinutes, setTimerMinutes] = useState(String(product.checkout_timer_minutes ?? 15));
 const [socialProof, setSocialProof] = useState(product.checkout_social_proof ?? false);
 const [guaranteeEnabled, setGuaranteeEnabled] = useState(product.checkout_guarantee_enabled ?? true);
 const [pixEnabled, setPixEnabled] = useState(product.checkout_pix_enabled ?? true);
 const [boletoEnabled, setBoletoEnabled] = useState(product.checkout_boleto_enabled ?? false);
 const [creditCardEnabled, setCreditCardEnabled] = useState(product.checkout_credit_card_enabled ?? true);
 const [allowedMethods, setAllowedMethods] = useState({ pix: true, boleto: false, card: true });
 const [addressRequired, setAddressRequired] = useState(product.checkout_address_required ?? false);
 const [emailConfirm, setEmailConfirm] = useState(product.checkout_email_confirm ?? true);

 const [bannerDesktopPreview, setBannerDesktopPreview] = useState(product.checkout_banner_desktop_url || "");
 const [bannerMobilePreview, setBannerMobilePreview] = useState(product.checkout_banner_mobile_url || "");
 const [bannerDesktopFile, setBannerDesktopFile] = useState<File | null>(null);
 const [bannerMobileFile, setBannerMobileFile] = useState<File | null>(null);
 const desktopRef = useRef<HTMLInputElement>(null);
 const mobileRef = useRef<HTMLInputElement>(null);

 // Order bumps
 const [allProducts, setAllProducts] = useState<Tables<"products">[]>([]);
 const [orderBumps, setOrderBumps] = useState<{ id: string; bump_product_id: string }[]>([]);
 const [selectedBumpProduct, setSelectedBumpProduct] = useState("");

 useEffect(() => {
 if (!user?.id || !open) return;
 // Load all products except current
 supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").neq("id", product.id)
 .then(({ data }) => { if (data) setAllProducts(data); });
 // Load existing order bumps
 supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", product.id)
 .then(({ data }) => { if (data) setOrderBumps(data); });
 supabase.from("profiles").select("pix_enabled, boleto_enabled, credit_card_enabled").eq("user_id", user.id).maybeSingle()
 .then(({ data }) => {
  if (!data) return;
  setAllowedMethods({ pix: data.pix_enabled, boleto: data.boleto_enabled, card: data.credit_card_enabled });
  if (!data.pix_enabled) setPixEnabled(false);
  if (!data.boleto_enabled) setBoletoEnabled(false);
  if (!data.credit_card_enabled) setCreditCardEnabled(false);
 });
 }, [user?.id, open, product.id]);

  const uploadBanner = async (file: File, type: string): Promise<string | null> => {
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED.includes(file.type)) { toast.error("Use JPG, PNG ou WebP"); return null; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Banner: máximo 5MB"); return null; }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${user!.id}/${product.id}-${type}.${ext}`;
    const { error } = await supabase.storage.from("checkout-banners").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro ao enviar banner"); return null; }
    const { data } = supabase.storage.from("checkout-banners").getPublicUrl(path);
    return data.publicUrl;
  };

 const handleSave = async () => {
 setSaving(true);
 try {
 let desktopUrl = bannerDesktopPreview;
 let mobileUrl = bannerMobilePreview;
 if (bannerDesktopFile) {
 const url = await uploadBanner(bannerDesktopFile, "desktop");
 if (url) desktopUrl = url;
 }
 if (bannerMobileFile) {
 const url = await uploadBanner(bannerMobileFile, "mobile");
 if (url) mobileUrl = url;
 }

 const { error } = await supabase.from("products").update({
 checkout_button_color: buttonColor,
 checkout_timer_enabled: timerEnabled,
 checkout_timer_minutes: parseInt(timerMinutes) || 15,
 checkout_banner_desktop_url: desktopUrl || null,
 checkout_banner_mobile_url: mobileUrl || null,
 checkout_social_proof: socialProof,
 checkout_guarantee_enabled: guaranteeEnabled,
 checkout_pix_enabled: pixEnabled,
 checkout_boleto_enabled: boletoEnabled,
 checkout_credit_card_enabled: creditCardEnabled,
 checkout_address_required: addressRequired,
 checkout_email_confirm: emailConfirm,
 }).eq("id", product.id).eq("user_id", user!.id);

 if (error) { toast.error("Erro ao salvar"); return; }
 toast.success("Checkout personalizado!");
 onSaved();
 onOpenChange(false);
 } finally { setSaving(false); }
 };

 const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: "desktop" | "mobile") => {
 const file = e.target.files?.[0];
 if (!file) return;
 const ALLOWED_BANNER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
 if (!ALLOWED_BANNER_TYPES.includes(file.type)) { toast.error("Formato inválido. Use JPEG, PNG, WebP ou GIF"); return; }
 if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
 if (type === "desktop") {
 setBannerDesktopFile(file);
 setBannerDesktopPreview(URL.createObjectURL(file));
 } else {
 setBannerMobileFile(file);
 setBannerMobilePreview(URL.createObjectURL(file));
 }
 };

 const addBump = async () => {
 if (!selectedBumpProduct) return;
 if (orderBumps.some(b => b.bump_product_id === selectedBumpProduct)) {
 toast.error("Produto já adicionado"); return;
 }
 const { data, error } = await supabase.from("order_bumps").insert({
 product_id: product.id,
 bump_product_id: selectedBumpProduct,
 sort_order: orderBumps.length,
 }).select("id, bump_product_id").maybeSingle();
 if (error || !data) { toast.error("Erro ao adicionar"); return; }
 setOrderBumps(prev => [...prev, data]);
 setSelectedBumpProduct("");
 toast.success("Order bump adicionado!");
 };

 const removeBump = async (id: string) => {
 await supabase.from("order_bumps").delete().eq("id", id).eq("product_id", product.id);
 setOrderBumps(prev => prev.filter(b => b.id !== id));
 toast.success("Order bump removido");
 };

 const availableForBump = allProducts.filter(p => !orderBumps.some(b => b.bump_product_id === p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-base font-display font-bold">
            <Settings className="h-4 w-4 text-primary" /> Personalizar Checkout
          </DialogTitle>
          <p className="text-[12px] text-muted-foreground mt-1 truncate">{product.name}</p>
        </DialogHeader>

        <Tabs defaultValue="visual" className="px-6 pt-4">
          <TabsList className="grid grid-cols-4 w-full h-9">
            <TabsTrigger value="visual" className="text-[11px] gap-1.5 font-semibold"><Palette className="h-3 w-3" /> Visual</TabsTrigger>
            <TabsTrigger value="payment" className="text-[11px] gap-1.5 font-semibold"><CreditCard className="h-3 w-3" /> Pagamento</TabsTrigger>
            <TabsTrigger value="form" className="text-[11px] gap-1.5 font-semibold"><Mail className="h-3 w-3" /> Formulário</TabsTrigger>
            <TabsTrigger value="bumps" className="text-[11px] gap-1.5 font-semibold"><Package className="h-3 w-3" /> Bumps</TabsTrigger>
          </TabsList>

          {/* VISUAL TAB */}
          <TabsContent value="visual" className="mt-5 space-y-6 pb-2">
            <Section title="Identidade visual" subtitle="Cor principal do botão de compra">
              <div className="flex items-center gap-2.5">
                <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="w-11 h-11 rounded-lg border border-border cursor-pointer bg-card shrink-0" />
                <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="flex-1 font-mono text-[13px] h-11" />
                <div className="h-11 px-5 rounded-lg flex items-center justify-center text-white text-[13px] font-bold shadow-sm" style={{ backgroundColor: buttonColor }}>
                  Comprar
                </div>
              </div>
            </Section>

            <Section title="Banners do checkout" subtitle="Imagens topo (5 MB · JPG, PNG, WebP)">
              <div className="grid grid-cols-2 gap-3">
                <BannerSlot label="Desktop" preview={bannerDesktopPreview} inputRef={desktopRef} onSelect={() => desktopRef.current?.click()} onClear={() => { setBannerDesktopFile(null); setBannerDesktopPreview(""); }} onChange={(e) => handleFile(e, "desktop")} />
                <BannerSlot label="Mobile" preview={bannerMobilePreview} inputRef={mobileRef} onSelect={() => mobileRef.current?.click()} onClear={() => { setBannerMobileFile(null); setBannerMobilePreview(""); }} onChange={(e) => handleFile(e, "mobile")} />
              </div>
            </Section>

            <Section title="Gatilhos de conversão" subtitle="Elementos persuasivos exibidos no checkout">
              <div className="rounded-xl border border-border/60 divide-y divide-border/60 overflow-hidden bg-card">
                <Row icon={<Timer className="h-4 w-4 text-warning" />} title="Timer de urgência" description="Contador regressivo no topo">
                  <div className="flex items-center gap-2">
                    {timerEnabled && (
                      <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} className="w-14 h-8 text-center text-[12px] font-numbers" />
                    )}
                    <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
                  </div>
                </Row>
                <Row icon={<Users className="h-4 w-4 text-primary" />} title="Prova social" description='"X pessoas compraram"'>
                  <Switch checked={socialProof} onCheckedChange={setSocialProof} />
                </Row>
                <Row icon={<ShieldCheck className="h-4 w-4 text-success" />} title="Garantia 7 dias" description="Selo de devolução garantida">
                  <Switch checked={guaranteeEnabled} onCheckedChange={setGuaranteeEnabled} />
                </Row>
              </div>
            </Section>
          </TabsContent>

          {/* PAYMENT TAB */}
          <TabsContent value="payment" className="mt-5 space-y-4 pb-2">
            <Section title="Métodos de pagamento" subtitle="Formas de pagamento aceitas no checkout">
              <div className="rounded-xl border border-border/60 divide-y divide-border/60 overflow-hidden bg-card">
                <Row icon={<QrCode className="h-4 w-4 text-success" />} title="PIX" description="Aprovação imediata · taxa baixa">
                  <Switch checked={pixEnabled} onCheckedChange={setPixEnabled} />
                </Row>
                <Row icon={<FileText className="h-4 w-4 text-warning" />} title="Boleto bancário" description="Compensação em 1–3 dias úteis">
                  <Switch checked={boletoEnabled} onCheckedChange={setBoletoEnabled} />
                </Row>
                <Row icon={<CreditCard className="h-4 w-4 text-primary" />} title="Cartão de crédito" description="Parcelamento em até 12x">
                  <Switch checked={creditCardEnabled} onCheckedChange={setCreditCardEnabled} />
                </Row>
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-2 px-1">Ao menos um método deve permanecer ativo.</p>
            </Section>
          </TabsContent>

          {/* FORM TAB */}
          <TabsContent value="form" className="mt-5 space-y-4 pb-2">
            <Section title="Campos do formulário" subtitle="Defina quais dados são solicitados ao cliente">
              <div className="rounded-xl border border-border/60 divide-y divide-border/60 overflow-hidden bg-card">
                <Row icon={<MapPin className="h-4 w-4 text-muted-foreground" />} title="Endereço de entrega" description="CEP com preenchimento automático">
                  <Switch checked={addressRequired} onCheckedChange={setAddressRequired} />
                </Row>
                <Row icon={<Mail className="h-4 w-4 text-muted-foreground" />} title="Confirmação de e-mail" description="Solicita digitar o e-mail duas vezes">
                  <Switch checked={emailConfirm} onCheckedChange={setEmailConfirm} />
                </Row>
              </div>
            </Section>
          </TabsContent>

          {/* ORDER BUMPS TAB */}
          <TabsContent value="bumps" className="mt-5 space-y-5 pb-2">
 {/* Header / Stats strip */}
 <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-border bg-border">
 <div className="bg-card px-3 py-2.5">
 <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Ofertas</p>
 <p className="text-lg font-semibold tabular-nums">{orderBumps.length}</p>
 </div>
 <div className="bg-card px-3 py-2.5">
 <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Receita extra</p>
 <p className="text-lg font-semibold tabular-nums">
 R$ {orderBumps.reduce((sum, b) => {
 const p = allProducts.find(ap => ap.id === b.bump_product_id);
 return sum + Number(p?.price || 0);
 }, 0).toFixed(0)}
 </p>
 </div>
 <div className="bg-card px-3 py-2.5">
 <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Disponíveis</p>
 <p className="text-lg font-semibold tabular-nums">{availableForBump.length}</p>
 </div>
 </div>

 {/* Linked products list */}
 {orderBumps.length > 0 ? (
 <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
 {orderBumps.map((bump, idx) => {
 const prod = allProducts.find(p => p.id === bump.bump_product_id);
 return (
 <div key={bump.id} className="flex items-center gap-3 p-3 bg-card hover:bg-muted/30 transition-colors">
 <div className="flex items-center justify-center h-6 w-6 rounded-md bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums flex-shrink-0">
 {idx + 1}
 </div>
 {prod?.image_url ? (
 <img src={prod.image_url} alt={prod.name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0 border border-border" />
 ) : (
 <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border">
 <Package className="h-5 w-5 text-muted-foreground" />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <p className="text-sm font-semibold truncate leading-tight">{prod?.name || "Produto"}</p>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-xs font-medium text-foreground tabular-nums">R$ {Number(prod?.price || 0).toFixed(2)}</span>
 <span className="text-[10px] text-muted-foreground">·</span>
 <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Posição {idx + 1}</span>
 </div>
 </div>
 <Button variant="ghost" size="icon" onClick={() => removeBump(bump.id)} className="text-muted-foreground hover:text-destructive h-8 w-8 flex-shrink-0">
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 );
 })}
 </div>
 ) : availableForBump.length > 0 ? (
 <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
 <Package className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
 <p className="text-sm font-medium text-foreground">Nenhuma oferta vinculada</p>
 <p className="text-xs text-muted-foreground mt-1">Selecione um produto abaixo para começar</p>
 </div>
 ) : null}

 {/* Add new bump control */}
 {availableForBump.length > 0 && (
 <div className="space-y-2">
 <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vincular produto</Label>
 <div className="flex gap-2">
 <Select value={selectedBumpProduct} onValueChange={setSelectedBumpProduct}>
 <SelectTrigger className="flex-1 h-10 rounded-lg">
 <SelectValue placeholder="Selecione da sua biblioteca..." />
 </SelectTrigger>
 <SelectContent>
 {availableForBump.map(p => (
 <SelectItem key={p.id} value={p.id}>
 <span className="font-medium">{p.name}</span>
 <span className="text-muted-foreground ml-2 tabular-nums">R$ {Number(p.price).toFixed(2)}</span>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Button onClick={addBump} disabled={!selectedBumpProduct} size="default" className="gap-1.5 rounded-lg h-10 px-4">
 <Plus className="h-4 w-4" /> Vincular
 </Button>
 </div>
 <p className="text-[11px] text-muted-foreground">
 Ofertas aparecem antes da finalização do pagamento. Adicione com 1 clique.
 </p>
 </div>
 )}

 {allProducts.length === 0 && orderBumps.length === 0 && (
 <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
 <Package className="h-6 w-6 text-muted-foreground mx-auto mb-3" />
 <p className="text-sm font-semibold text-foreground">Sem produtos disponíveis</p>
 <p className="text-xs text-muted-foreground mt-1 mb-4">Cadastre outros produtos para vincular como ofertas</p>
 <a href="/vendas/produtos" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
 <Plus className="h-3.5 w-3.5" /> Cadastrar produto
 </a>
 </div>
 )}
 </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 mt-6 px-6 py-4 border-t border-border/60 bg-card/95 backdrop-blur-md">
          <Button onClick={handleSave} disabled={saving} className="w-full h-11 gradient-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20">
            {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Internal layout helpers ─── */

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h4 className="text-[12px] font-display font-bold text-foreground tracking-tight">{title}</h4>
        {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-7 w-7 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground leading-tight">{title}</p>
          {description && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{description}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function BannerSlot({
  label, preview, inputRef, onSelect, onClear, onChange,
}: {
  label: string;
  preview: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onSelect: () => void;
  onClear: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">{label}</Label>
      <input ref={inputRef} type="file" accept="image/*" onChange={onChange} className="hidden" />
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border/60 bg-muted/20 aspect-[16/9]">
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <button type="button" onClick={onClear} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={onSelect} className="w-full aspect-[16/9] rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-primary text-[11px] font-medium transition-colors">
          <Upload className="h-4 w-4" />
          Enviar imagem
        </button>
      )}
    </div>
  );
}

