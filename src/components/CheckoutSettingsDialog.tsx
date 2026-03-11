import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Palette, Timer, Image, ShieldCheck, CreditCard, QrCode, FileText, MapPin, Mail, X, Upload, Package, Plus, Trash2 } from "lucide-react";
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
  const [boletoEnabled, setBoletoEnabled] = useState(product.checkout_boleto_enabled ?? true);
  const [creditCardEnabled, setCreditCardEnabled] = useState(product.checkout_credit_card_enabled ?? true);
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
  }, [user?.id, open, product.id]);

  const uploadBanner = async (file: File, type: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
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
    }).select("id, bump_product_id").single();
    if (error) { toast.error("Erro ao adicionar"); return; }
    if (data) setOrderBumps(prev => [...prev, data]);
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Personalizar Checkout
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="visual" className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="visual" className="text-xs gap-1"><Palette className="h-3 w-3" /> Visual</TabsTrigger>
            <TabsTrigger value="payment" className="text-xs gap-1"><CreditCard className="h-3 w-3" /> Pagamento</TabsTrigger>
            <TabsTrigger value="form" className="text-xs gap-1"><Mail className="h-3 w-3" /> Form</TabsTrigger>
            <TabsTrigger value="bumps" className="text-xs gap-1"><Package className="h-3 w-3" /> Bumps</TabsTrigger>
          </TabsList>

          {/* VISUAL TAB */}
          <TabsContent value="visual" className="space-y-5 mt-4">
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                <Palette className="h-3.5 w-3.5" /> Cor do botão de compra
              </Label>
              <div className="flex items-center gap-3">
                <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="flex-1 font-mono text-sm" />
                <div className="h-10 px-6 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: buttonColor }}>
                  Comprar
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Timer de urgência</p>
                  <p className="text-xs text-muted-foreground">Contador regressivo no checkout</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {timerEnabled && (
                  <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} className="w-16 h-8 text-center text-xs" />
                )}
                <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                <Image className="h-3.5 w-3.5" /> Banner Desktop
              </Label>
              <input ref={desktopRef} type="file" accept="image/*" onChange={(e) => handleFile(e, "desktop")} className="hidden" />
              {bannerDesktopPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={bannerDesktopPreview} alt="Desktop" className="w-full h-28 object-cover" />
                  <button type="button" onClick={() => { setBannerDesktopFile(null); setBannerDesktopPreview(""); }} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => desktopRef.current?.click()} className="w-full h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary text-xs transition-colors">
                  <Upload className="h-4 w-4" /> Upload banner desktop
                </button>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                <Image className="h-3.5 w-3.5" /> Banner Mobile
              </Label>
              <input ref={mobileRef} type="file" accept="image/*" onChange={(e) => handleFile(e, "mobile")} className="hidden" />
              {bannerMobilePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={bannerMobilePreview} alt="Mobile" className="w-full h-28 object-cover" />
                  <button type="button" onClick={() => { setBannerMobileFile(null); setBannerMobilePreview(""); }} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => mobileRef.current?.click()} className="w-full h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary text-xs transition-colors">
                  <Upload className="h-4 w-4" /> Upload banner mobile
                </button>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm">👥</span>
                <div>
                  <p className="text-sm font-medium">Prova social</p>
                  <p className="text-xs text-muted-foreground">"X pessoas compraram"</p>
                </div>
              </div>
              <Switch checked={socialProof} onCheckedChange={setSocialProof} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium">Selo de garantia 7 dias</p>
                  <p className="text-xs text-muted-foreground">Mostra selo de garantia no checkout</p>
                </div>
              </div>
              <Switch checked={guaranteeEnabled} onCheckedChange={setGuaranteeEnabled} />
            </div>
          </TabsContent>

          {/* PAYMENT TAB */}
          <TabsContent value="payment" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">Métodos de pagamento disponíveis no checkout.</p>
            <div className="flex items-center justify-between p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2"><QrCode className="h-4 w-4 text-emerald-500" /><p className="text-sm font-medium">PIX</p></div>
              <Switch checked={pixEnabled} onCheckedChange={setPixEnabled} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-amber-500" /><p className="text-sm font-medium">Boleto Bancário</p></div>
              <Switch checked={boletoEnabled} onCheckedChange={setBoletoEnabled} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-500" /><p className="text-sm font-medium">Cartão de Crédito</p></div>
              <Switch checked={creditCardEnabled} onCheckedChange={setCreditCardEnabled} />
            </div>
          </TabsContent>

          {/* FORM TAB */}
          <TabsContent value="form" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">Configure campos do formulário do checkout.</p>
            <div className="flex items-center justify-between p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-sm font-medium">Solicitar endereço</p><p className="text-xs text-muted-foreground">CEP com preenchimento automático</p></div>
              </div>
              <Switch checked={addressRequired} onCheckedChange={setAddressRequired} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-sm font-medium">Confirmação de e-mail</p><p className="text-xs text-muted-foreground">Pede para digitar o e-mail 2x</p></div>
              </div>
              <Switch checked={emailConfirm} onCheckedChange={setEmailConfirm} />
            </div>
          </TabsContent>

          {/* ORDER BUMPS TAB */}
          <TabsContent value="bumps" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Adicione outros produtos como ofertas especiais no checkout. O cliente pode adicionar ao pedido com um clique.
            </p>

            {/* Existing bumps */}
            {orderBumps.length > 0 && (
              <div className="space-y-2">
                {orderBumps.map(bump => {
                  const prod = allProducts.find(p => p.id === bump.bump_product_id);
                  return (
                    <div key={bump.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {prod?.image_url ? (
                          <img src={prod.image_url} alt={prod.name} className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{prod?.name || "Produto"}</p>
                          <p className="text-xs text-muted-foreground">R$ {Number(prod?.price || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeBump(bump.id)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new bump */}
            {availableForBump.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={selectedBumpProduct}
                  onChange={e => setSelectedBumpProduct(e.target.value)}
                  className="flex-1 h-10 rounded-xl border border-border bg-background text-foreground text-sm px-3 appearance-none"
                >
                  <option value="">Selecione um produto...</option>
                  {availableForBump.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</option>
                  ))}
                </select>
                <Button onClick={addBump} disabled={!selectedBumpProduct} size="sm" className="gap-1 rounded-xl">
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
            )}

            {allProducts.length <= 1 && orderBumps.length === 0 && (
              <div className="text-center py-6 space-y-3">
                <p className="text-muted-foreground text-sm">Cadastre outros produtos para usar como order bumps</p>
                <a href="/vendas/produtos" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                  <Plus className="h-4 w-4" /> Cadastrar Produto
                </a>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Button onClick={handleSave} disabled={saving} className="w-full mt-4 gradient-primary text-primary-foreground font-bold rounded-xl">
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
