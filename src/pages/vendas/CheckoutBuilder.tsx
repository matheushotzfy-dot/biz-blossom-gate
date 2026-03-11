/**
 * Checkout Builder — Split-screen immersive checkout customizer
 * @module CheckoutBuilder
 * @version 1.0.0
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Palette, CreditCard, Mail, Package, Plus, Trash2, ArrowLeft,
  Timer, Image, ShieldCheck, QrCode, FileText, MapPin, X, Upload,
  Zap, Video, Users, LogOut as ExitIcon, BarChart3, Monitor, Smartphone, Check, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const TABS = [
  { id: "visual", label: "Visual", icon: Palette },
  { id: "payment", label: "Pagamento", icon: CreditCard },
  { id: "form", label: "Formulário", icon: Mail },
  { id: "bumps", label: "Bumps", icon: Package },
  { id: "cro", label: "Conversão", icon: Zap },
] as const;

type TabId = typeof TABS[number]["id"];

const PRESET_COLORS = [
  { name: "Esmeralda", hex: "#10b981" },
  { name: "Laranja", hex: "#f97316" },
  { name: "Royal", hex: "#3b82f6" },
  { name: "Roxo", hex: "#8b5cf6" },
  { name: "Rosa", hex: "#ec4899" },
  { name: "Vermelho", hex: "#ef4444" },
];

export default function CheckoutBuilder() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Tables<"products"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("visual");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Settings state
  const [buttonColor, setButtonColor] = useState("#10b981");
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState("15");
  const [socialProof, setSocialProof] = useState(false);
  const [guaranteeEnabled, setGuaranteeEnabled] = useState(true);
  const [pixEnabled, setPixEnabled] = useState(true);
  const [boletoEnabled, setBoletoEnabled] = useState(true);
  const [creditCardEnabled, setCreditCardEnabled] = useState(true);
  const [addressRequired, setAddressRequired] = useState(false);
  const [emailConfirm, setEmailConfirm] = useState(true);
  const [bannerDesktopPreview, setBannerDesktopPreview] = useState("");
  const [bannerMobilePreview, setBannerMobilePreview] = useState("");
  const [bannerDesktopFile, setBannerDesktopFile] = useState<File | null>(null);
  const [bannerMobileFile, setBannerMobileFile] = useState<File | null>(null);
  const desktopRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  // CRO state
  const [vslEnabled, setVslEnabled] = useState(false);
  const [vslUrl, setVslUrl] = useState("");
  const [fakeViewersEnabled, setFakeViewersEnabled] = useState(false);
  const [exitIntentEnabled, setExitIntentEnabled] = useState(false);
  const [progressBarEnabled, setProgressBarEnabled] = useState(false);

  // Order bumps
  const [allProducts, setAllProducts] = useState<Tables<"products">[]>([]);
  const [orderBumps, setOrderBumps] = useState<{ id: string; bump_product_id: string }[]>([]);
  const [selectedBumpProduct, setSelectedBumpProduct] = useState("");

  // Load product
  useEffect(() => {
    if (!user?.id || !productId) return;
    setLoading(true);
    supabase.from("products").select("*").eq("id", productId).eq("user_id", user.id).single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error("Produto não encontrado"); navigate("/vendas/produtos"); return; }
        setProduct(data);
        setButtonColor(data.checkout_button_color || "#10b981");
        setTimerEnabled(data.checkout_timer_enabled ?? true);
        setTimerMinutes(String(data.checkout_timer_minutes ?? 15));
        setSocialProof(data.checkout_social_proof ?? false);
        setGuaranteeEnabled(data.checkout_guarantee_enabled ?? true);
        setPixEnabled(data.checkout_pix_enabled ?? true);
        setBoletoEnabled(data.checkout_boleto_enabled ?? true);
        setCreditCardEnabled(data.checkout_credit_card_enabled ?? true);
        setAddressRequired(data.checkout_address_required ?? false);
        setEmailConfirm(data.checkout_email_confirm ?? true);
        setBannerDesktopPreview(data.checkout_banner_desktop_url || "");
        setBannerMobilePreview(data.checkout_banner_mobile_url || "");
        setLoading(false);
      });
    // Load other products for bumps
    supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").neq("id", productId)
      .then(({ data }) => { if (data) setAllProducts(data); });
    supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", productId)
      .then(({ data }) => { if (data) setOrderBumps(data); });
  }, [user?.id, productId, navigate]);

  // Auto-save with debounce
  const autoSave = useCallback(async () => {
    if (!user?.id || !productId) return;
    setSaving(true);

    let desktopUrl = bannerDesktopPreview;
    let mobileUrl = bannerMobilePreview;
    if (bannerDesktopFile) {
      const ext = bannerDesktopFile.name.split(".").pop();
      const path = `${user.id}/${productId}-desktop.${ext}`;
      const { error } = await supabase.storage.from("checkout-banners").upload(path, bannerDesktopFile, { upsert: true });
      if (!error) { const { data } = supabase.storage.from("checkout-banners").getPublicUrl(path); desktopUrl = data.publicUrl; }
      setBannerDesktopFile(null);
    }
    if (bannerMobileFile) {
      const ext = bannerMobileFile.name.split(".").pop();
      const path = `${user.id}/${productId}-mobile.${ext}`;
      const { error } = await supabase.storage.from("checkout-banners").upload(path, bannerMobileFile, { upsert: true });
      if (!error) { const { data } = supabase.storage.from("checkout-banners").getPublicUrl(path); mobileUrl = data.publicUrl; }
      setBannerMobileFile(null);
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
    }).eq("id", productId).eq("user_id", user.id);

    setSaving(false);
    if (!error) toast.success("Alterações salvas", { duration: 1500 });
  }, [user?.id, productId, buttonColor, timerEnabled, timerMinutes, socialProof, guaranteeEnabled, pixEnabled, boletoEnabled, creditCardEnabled, addressRequired, emailConfirm, bannerDesktopPreview, bannerMobilePreview, bannerDesktopFile, bannerMobileFile]);

  // Trigger auto-save on settings change
  useEffect(() => {
    if (loading || !product) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(autoSave, 1200);
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
  }, [buttonColor, timerEnabled, timerMinutes, socialProof, guaranteeEnabled, pixEnabled, boletoEnabled, creditCardEnabled, addressRequired, emailConfirm]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: "desktop" | "mobile") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
    if (type === "desktop") { setBannerDesktopFile(file); setBannerDesktopPreview(URL.createObjectURL(file)); }
    else { setBannerMobileFile(file); setBannerMobilePreview(URL.createObjectURL(file)); }
  };

  const addBump = async () => {
    if (!selectedBumpProduct) return;
    if (orderBumps.some(b => b.bump_product_id === selectedBumpProduct)) { toast.error("Já adicionado"); return; }
    const { data, error } = await supabase.from("order_bumps").insert({ product_id: productId!, bump_product_id: selectedBumpProduct, sort_order: orderBumps.length }).select("id, bump_product_id").single();
    if (error) { toast.error("Erro ao adicionar"); return; }
    if (data) setOrderBumps(prev => [...prev, data]);
    setSelectedBumpProduct("");
    toast.success("Bump adicionado!");
  };

  const removeBump = async (id: string) => {
    await supabase.from("order_bumps").delete().eq("id", id).eq("product_id", productId!);
    setOrderBumps(prev => prev.filter(b => b.id !== id));
    toast.success("Bump removido");
  };

  const availableForBump = allProducts.filter(p => !orderBumps.some(b => b.bump_product_id === p.id));

  const checkoutUrl = product?.checkout_url ? `${window.location.origin}/pay/${product.checkout_url.split("/").pop()}` : "";

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Carregando...</div>
    </div>
  );

  /* ── Toggle Row component ── */
  const ToggleRow = ({ icon: Icon, iconColor, title, desc, checked, onChange, extra }: {
    icon: React.ComponentType<{ className?: string }>; iconColor?: string; title: string; desc: string;
    checked: boolean; onChange: (v: boolean) => void; extra?: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/50 hover:border-border transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", iconColor ? `bg-${iconColor}/10` : "bg-muted/30")}>
          <Icon className={cn("h-4 w-4", iconColor ? `text-${iconColor}` : "text-muted-foreground")} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground/70 leading-snug">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {extra}
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* ─── LEFT: Control Panel ─── */}
      <aside className="w-[380px] shrink-0 border-r border-border/60 bg-card/30 backdrop-blur-xl flex flex-col h-screen sticky top-0 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/vendas/produtos")} className="h-8 w-8 p-0 rounded-lg hover:bg-muted/50">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-foreground truncate">{product?.name}</h1>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Checkout Builder</p>
            </div>
            {saving && (
              <span className="text-[10px] text-muted-foreground/50 animate-pulse font-medium">Salvando...</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 p-2 border-b border-border/40">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* ── VISUAL TAB ── */}
              {activeTab === "visual" && (
                <>
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-2.5 block">Cor do botão</Label>
                    <div className="flex gap-2 mb-2.5 flex-wrap">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c.hex}
                          onClick={() => setButtonColor(c.hex)}
                          className={cn(
                            "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all hover:scale-110",
                            buttonColor === c.hex ? "ring-primary" : "ring-transparent"
                          )}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="w-9 h-9 rounded-lg border border-border cursor-pointer" />
                      <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="flex-1 font-mono text-xs h-9 rounded-lg" />
                    </div>
                    <div className="mt-2.5 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg transition-colors" style={{ backgroundColor: buttonColor }}>
                      Comprar agora
                    </div>
                  </div>

                  <ToggleRow icon={Timer} iconColor="amber-500" title="Timer de urgência" desc="Contador regressivo no checkout"
                    checked={timerEnabled} onChange={setTimerEnabled}
                    extra={timerEnabled ? <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} className="w-14 h-7 text-center text-[11px] rounded-md" /> : undefined}
                  />

                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-2 block flex items-center gap-1.5"><Image className="h-3 w-3" /> Banner Desktop</Label>
                    <input ref={desktopRef} type="file" accept="image/*" onChange={(e) => handleFile(e, "desktop")} className="hidden" />
                    {bannerDesktopPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-border/60">
                        <img src={bannerDesktopPreview} alt="Desktop" className="w-full h-24 object-cover" />
                        <button type="button" onClick={() => { setBannerDesktopFile(null); setBannerDesktopPreview(""); }} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => desktopRef.current?.click()} className="w-full h-16 rounded-xl border border-dashed border-border/60 hover:border-primary/30 flex items-center justify-center gap-2 text-muted-foreground/50 hover:text-primary text-[11px] transition-colors">
                        <Upload className="h-3.5 w-3.5" /> Upload
                      </button>
                    )}
                  </div>

                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-2 block flex items-center gap-1.5"><Image className="h-3 w-3" /> Banner Mobile</Label>
                    <input ref={mobileRef} type="file" accept="image/*" onChange={(e) => handleFile(e, "mobile")} className="hidden" />
                    {bannerMobilePreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-border/60">
                        <img src={bannerMobilePreview} alt="Mobile" className="w-full h-24 object-cover" />
                        <button type="button" onClick={() => { setBannerMobileFile(null); setBannerMobilePreview(""); }} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => mobileRef.current?.click()} className="w-full h-16 rounded-xl border border-dashed border-border/60 hover:border-primary/30 flex items-center justify-center gap-2 text-muted-foreground/50 hover:text-primary text-[11px] transition-colors">
                        <Upload className="h-3.5 w-3.5" /> Upload
                      </button>
                    )}
                  </div>

                  <ToggleRow icon={Users} title="Prova social" desc='"X pessoas compraram"' checked={socialProof} onChange={setSocialProof} />
                  <ToggleRow icon={ShieldCheck} iconColor="emerald-500" title="Selo de garantia 7 dias" desc="Exibe selo no checkout" checked={guaranteeEnabled} onChange={setGuaranteeEnabled} />
                </>
              )}

              {/* ── PAYMENT TAB ── */}
              {activeTab === "payment" && (
                <>
                  <p className="text-[11px] text-muted-foreground/60">Métodos aceitos no checkout.</p>
                  <ToggleRow icon={QrCode} iconColor="emerald-500" title="PIX" desc="Pagamento instantâneo" checked={pixEnabled} onChange={setPixEnabled} />
                  <ToggleRow icon={FileText} iconColor="amber-500" title="Boleto Bancário" desc="Vencimento em 3 dias" checked={boletoEnabled} onChange={setBoletoEnabled} />
                  <ToggleRow icon={CreditCard} iconColor="blue-500" title="Cartão de Crédito" desc="Até 12x sem juros" checked={creditCardEnabled} onChange={setCreditCardEnabled} />
                </>
              )}

              {/* ── FORM TAB ── */}
              {activeTab === "form" && (
                <>
                  <p className="text-[11px] text-muted-foreground/60">Campos do formulário de compra.</p>
                  <ToggleRow icon={MapPin} title="Solicitar endereço" desc="CEP com preenchimento automático" checked={addressRequired} onChange={setAddressRequired} />
                  <ToggleRow icon={Mail} title="Confirmação de e-mail" desc="Pede para digitar o e-mail 2x" checked={emailConfirm} onChange={setEmailConfirm} />
                </>
              )}

              {/* ── BUMPS TAB ── */}
              {activeTab === "bumps" && (
                <>
                  <p className="text-[11px] text-muted-foreground/60">Ofertas especiais exibidas no checkout.</p>
                  {orderBumps.map(bump => {
                    const prod = allProducts.find(p => p.id === bump.bump_product_id);
                    return (
                      <div key={bump.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/50">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {prod?.image_url ? (
                            <img src={prod.image_url} alt={prod.name} className="h-9 w-9 rounded-lg object-cover" />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="h-4 w-4 text-primary" /></div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{prod?.name || "Produto"}</p>
                            <p className="text-[10px] text-muted-foreground">R$ {Number(prod?.price || 0).toFixed(2)}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeBump(bump.id)} className="text-destructive/70 hover:text-destructive h-7 w-7 p-0 rounded-lg">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  {availableForBump.length > 0 && (
                    <div className="flex gap-2">
                      <select value={selectedBumpProduct} onChange={e => setSelectedBumpProduct(e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-border/60 bg-background text-foreground text-xs px-2.5">
                        <option value="">Selecione...</option>
                        {availableForBump.map(p => <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</option>)}
                      </select>
                      <Button onClick={addBump} disabled={!selectedBumpProduct} size="sm" className="gap-1 rounded-lg h-9 text-xs">
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    </div>
                  )}
                  {allProducts.length === 0 && orderBumps.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground/50 text-xs">Cadastre outros produtos para usar como bumps</div>
                  )}
                </>
              )}

              {/* ── CRO TAB ── */}
              {activeTab === "cro" && (
                <>
                  <p className="text-[11px] text-muted-foreground/60">Gatilhos de conversão avançados.</p>
                  <ToggleRow icon={Video} iconColor="red-500" title="VSL no Checkout" desc="Exibir vídeo de vendas no topo" checked={vslEnabled} onChange={setVslEnabled} />
                  {vslEnabled && (
                    <Input value={vslUrl} onChange={(e) => setVslUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="h-9 rounded-lg text-xs" />
                  )}
                  <ToggleRow icon={Users} iconColor="orange-500" title="Fake Live Viewers" desc='"🔥 14 pessoas comprando agora"' checked={fakeViewersEnabled} onChange={setFakeViewersEnabled} />
                  <ToggleRow icon={ExitIcon} iconColor="red-500" title="Exit Intent Popup" desc="Oferecer desconto ao sair da página" checked={exitIntentEnabled} onChange={setExitIntentEnabled} />
                  <ToggleRow icon={BarChart3} iconColor="blue-500" title="Barra de Progresso" desc='"Você está a 1 passo..."' checked={progressBarEnabled} onChange={setProgressBarEnabled} />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </aside>

      {/* ─── RIGHT: Live Preview ─── */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Preview header */}
        <div className="h-12 border-b border-border/40 bg-card/20 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Preview</span>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/30 border border-border/40">
            <button onClick={() => setPreviewMode("desktop")} className={cn("p-1.5 rounded-md transition-all", previewMode === "desktop" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground")}>
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setPreviewMode("mobile")} className={cn("p-1.5 rounded-md transition-all", previewMode === "mobile" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground")}>
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
          {checkoutUrl && (
            <Button variant="ghost" size="sm" onClick={() => window.open(checkoutUrl, "_blank")} className="gap-1.5 text-[11px] h-7 rounded-lg text-muted-foreground/60 hover:text-primary">
              <Eye className="h-3 w-3" /> Abrir checkout
            </Button>
          )}
        </div>

        {/* Preview area */}
        <div className="flex-1 bg-muted/10 flex items-start justify-center p-6 overflow-auto"
          style={{ backgroundImage: "radial-gradient(circle, hsl(var(--border)/0.3) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
        >
          <div className={cn(
            "bg-card rounded-2xl border border-border/60 shadow-2xl shadow-black/20 overflow-hidden transition-all duration-300",
            previewMode === "desktop" ? "w-full max-w-2xl" : "w-[375px]"
          )}>
            {/* Preview: Banner */}
            {(previewMode === "desktop" ? bannerDesktopPreview : bannerMobilePreview) && (
              <img src={previewMode === "desktop" ? bannerDesktopPreview : bannerMobilePreview} alt="Banner" className="w-full h-32 object-cover" />
            )}

            {/* Preview: VSL */}
            {vslEnabled && vslUrl && (
              <div className="p-4 pb-0">
                <div className="aspect-video rounded-xl bg-black/90 border border-border/40 flex items-center justify-center text-muted-foreground/30">
                  <Video className="h-10 w-10" />
                </div>
              </div>
            )}

            {/* Preview: Progress bar */}
            {progressBarEnabled && (
              <div className="px-4 pt-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground mb-1.5">
                  <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-black">1</span>
                  Você está a 1 passo de garantir sua vaga
                </div>
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full w-2/3 rounded-full bg-primary animate-pulse" />
                </div>
              </div>
            )}

            {/* Preview: Fake viewers */}
            {fakeViewersEnabled && (
              <div className="px-4 pt-3">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full bg-orange-500/10 text-orange-400 px-3 py-1.5 border border-orange-500/20">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-400" /></span>
                  🔥 14 pessoas estão finalizando a compra agora
                </div>
              </div>
            )}

            {/* Preview: Timer */}
            {timerEnabled && (
              <div className="px-4 pt-3">
                <div className="flex items-center justify-center gap-2 text-[12px] font-bold text-amber-400 bg-amber-500/10 rounded-lg py-2 border border-amber-500/15">
                  <Timer className="h-3.5 w-3.5" /> Oferta expira em {timerMinutes}:00
                </div>
              </div>
            )}

            <div className="p-4 space-y-4">
              {/* Product info */}
              <div className="flex items-center gap-3">
                {product?.image_url ? (
                  <img src={product.image_url} className="h-12 w-12 rounded-xl object-cover border border-border/40" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"><Package className="h-5 w-5 text-primary" /></div>
                )}
                <div>
                  <p className="text-sm font-bold text-foreground">{product?.name}</p>
                  <p className="text-lg font-black text-primary">R$ {Number(product?.price || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Social proof */}
              {socialProof && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <div className="flex -space-x-1.5">
                    {[1,2,3].map(i => <div key={i} className="h-5 w-5 rounded-full bg-muted border-2 border-card" />)}
                  </div>
                  +127 compraram nas últimas 24h
                </div>
              )}

              {/* Form preview */}
              <div className="space-y-2.5">
                <div className="h-10 rounded-lg bg-muted/20 border border-border/40" />
                <div className="h-10 rounded-lg bg-muted/20 border border-border/40" />
                {emailConfirm && <div className="h-10 rounded-lg bg-muted/20 border border-border/40" />}
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-10 rounded-lg bg-muted/20 border border-border/40" />
                  <div className="h-10 rounded-lg bg-muted/20 border border-border/40" />
                </div>
                {addressRequired && <div className="h-10 rounded-lg bg-muted/20 border border-border/40" />}
              </div>

              {/* Payment methods preview */}
              <div className="flex gap-2">
                {pixEnabled && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PIX</span>}
                {boletoEnabled && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">Boleto</span>}
                {creditCardEnabled && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">Cartão</span>}
              </div>

              {/* Order bumps preview */}
              {orderBumps.length > 0 && (
                <div className="space-y-2">
                  {orderBumps.map(bump => {
                    const prod = allProducts.find(p => p.id === bump.bump_product_id);
                    return (
                      <div key={bump.id} className="p-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03]">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded border-2 border-primary" />
                          <span className="text-xs font-bold text-foreground">{prod?.name || "Bump"}</span>
                          <span className="text-xs font-bold text-primary ml-auto">+ R$ {Number(prod?.price || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CTA button */}
              <button className="w-full h-12 rounded-xl text-white font-bold text-sm shadow-lg transition-all hover:opacity-90" style={{ backgroundColor: buttonColor }}>
                COMPRAR AGORA
              </button>

              {/* Guarantee seal */}
              {guaranteeEnabled && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" /> Garantia de 7 dias ou seu dinheiro de volta
                </div>
              )}
            </div>

            {/* Exit intent preview */}
            {exitIntentEnabled && (
              <div className="border-t border-border/40 p-3 bg-muted/10 text-center">
                <p className="text-[10px] text-muted-foreground/40">⚡ Exit Intent ativo — popup ao sair</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
