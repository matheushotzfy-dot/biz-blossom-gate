/**
 * Checkout Builder — Split-screen immersive checkout customizer
 * @module CheckoutBuilder
 * @version 2.0.0
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Palette, CreditCard, Mail, Package, Plus, Trash2, ArrowLeft,
  Timer, Image, ShieldCheck, QrCode, FileText, MapPin, X, Upload,
  Zap, Video, Users, LogOut as ExitIcon, BarChart3, Monitor, Smartphone, Check, Eye,
  MessageSquare, Gift, Clock, Star, Lock, Heart, Megaphone, Percent,
  Sparkles, Phone, Hash,
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
  { name: "Dourado", hex: "#eab308" },
  { name: "Cyan", hex: "#06b6d4" },
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
  // New CRO options
  const [testimonialEnabled, setTestimonialEnabled] = useState(false);
  const [scarcityEnabled, setScarcityEnabled] = useState(false);
  const [scarcityUnits, setScarcityUnits] = useState("17");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [discountBadgeEnabled, setDiscountBadgeEnabled] = useState(false);
  const [discountOriginalPrice, setDiscountOriginalPrice] = useState("");
  const [trustBadgesEnabled, setTrustBadgesEnabled] = useState(false);

  // Form extras
  const [phoneRequired, setPhoneRequired] = useState(true);
  const [cpfRequired, setCpfRequired] = useState(true);
  const [nameOnCardRequired, setNameOnCardRequired] = useState(false);

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
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando builder...</p>
      </div>
    </div>
  );

  /* ── Section Header ── */
  const SectionHeader = ({ title, desc }: { title: string; desc: string }) => (
    <div className="mb-1">
      <p className="text-[13px] font-bold text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground/50">{desc}</p>
    </div>
  );

  /* ── Toggle Row component ── */
  const ToggleRow = ({ icon: Icon, iconColor, title, desc, checked, onChange, extra, badge }: {
    icon: React.ComponentType<{ className?: string }>; iconColor?: string; title: string; desc: string;
    checked: boolean; onChange: (v: boolean) => void; extra?: React.ReactNode; badge?: string;
  }) => (
    <div className={cn(
      "flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200",
      checked
        ? "border-primary/20 bg-primary/[0.03] shadow-sm shadow-primary/5"
        : "border-border/40 dark:border-foreground/[0.06] bg-card/30 dark:bg-foreground/[0.01] hover:border-border/60"
    )}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
          checked
            ? (iconColor ? `bg-${iconColor}/15` : "bg-primary/15")
            : "bg-muted/20"
        )}>
          <Icon className={cn("h-4 w-4 transition-colors", checked ? (iconColor ? `text-${iconColor}` : "text-primary") : "text-muted-foreground/50")} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground">{title}</p>
            {badge && <span className="text-[8px] font-black uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{badge}</span>}
          </div>
          <p className="text-[10px] text-muted-foreground/50 leading-snug">{desc}</p>
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
      <aside className="w-[400px] shrink-0 border-r border-border/40 dark:border-foreground/[0.06] bg-card/20 dark:bg-foreground/[0.01] backdrop-blur-xl flex flex-col h-screen sticky top-0 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border/40 dark:border-foreground/[0.06]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/vendas/produtos")} className="h-9 w-9 p-0 rounded-xl hover:bg-muted/30">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-foreground truncate">{product?.name}</h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.16em] font-bold">Checkout Builder</p>
                {saving && (
                  <span className="inline-flex items-center gap-1 text-[9px] text-primary font-semibold animate-pulse">
                    <span className="h-1 w-1 rounded-full bg-primary animate-ping" />
                    Salvando
                  </span>
                )}
              </div>
            </div>
            <span className="text-sm font-black text-primary">R$ {Number(product?.price || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-0.5 p-2 border-b border-border/30 dark:border-foreground/[0.04]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-[9px] font-bold uppercase tracking-[0.14em] transition-all relative",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/20"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {/* ── VISUAL TAB ── */}
              {activeTab === "visual" && (
                <>
                  <SectionHeader title="Aparência" desc="Personalize as cores e banners do checkout" />
                  
                  <div className="p-4 rounded-xl border border-border/40 dark:border-foreground/[0.06] bg-card/30 space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60 block">Cor do botão CTA</Label>
                    <div className="flex gap-2 flex-wrap">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c.hex}
                          onClick={() => setButtonColor(c.hex)}
                          className={cn(
                            "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all hover:scale-110 shadow-sm",
                            buttonColor === c.hex ? "ring-primary scale-110" : "ring-transparent"
                          )}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="w-9 h-9 rounded-lg border border-border cursor-pointer" />
                      <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="flex-1 font-mono text-xs h-9 rounded-xl" />
                    </div>
                    <div className="mt-1 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg transition-all" style={{ backgroundColor: buttonColor, boxShadow: `0 8px 25px -8px ${buttonColor}60` }}>
                      <Sparkles className="h-4 w-4 mr-2" /> Comprar agora
                    </div>
                  </div>

                  <ToggleRow icon={Timer} iconColor="amber-500" title="Timer de urgência" desc="Contador regressivo no checkout"
                    checked={timerEnabled} onChange={setTimerEnabled}
                    extra={timerEnabled ? <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} className="w-14 h-7 text-center text-[11px] rounded-md" /> : undefined}
                  />

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl border border-border/40 dark:border-foreground/[0.06] bg-card/30 space-y-2.5">
                      <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60 flex items-center gap-1.5"><Monitor className="h-3 w-3" /> Banner Desktop</Label>
                      <input ref={desktopRef} type="file" accept="image/*" onChange={(e) => handleFile(e, "desktop")} className="hidden" />
                      {bannerDesktopPreview ? (
                        <div className="relative rounded-xl overflow-hidden border border-border/30">
                          <img src={bannerDesktopPreview} alt="Desktop" className="w-full h-24 object-cover" />
                          <button type="button" onClick={() => { setBannerDesktopFile(null); setBannerDesktopPreview(""); }} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => desktopRef.current?.click()} className="w-full h-14 rounded-xl border border-dashed border-border/40 hover:border-primary/30 flex items-center justify-center gap-2 text-muted-foreground/40 hover:text-primary text-[11px] transition-colors">
                          <Upload className="h-3.5 w-3.5" /> Enviar imagem
                        </button>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl border border-border/40 dark:border-foreground/[0.06] bg-card/30 space-y-2.5">
                      <Label className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60 flex items-center gap-1.5"><Smartphone className="h-3 w-3" /> Banner Mobile</Label>
                      <input ref={mobileRef} type="file" accept="image/*" onChange={(e) => handleFile(e, "mobile")} className="hidden" />
                      {bannerMobilePreview ? (
                        <div className="relative rounded-xl overflow-hidden border border-border/30">
                          <img src={bannerMobilePreview} alt="Mobile" className="w-full h-24 object-cover" />
                          <button type="button" onClick={() => { setBannerMobileFile(null); setBannerMobilePreview(""); }} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => mobileRef.current?.click()} className="w-full h-14 rounded-xl border border-dashed border-border/40 hover:border-primary/30 flex items-center justify-center gap-2 text-muted-foreground/40 hover:text-primary text-[11px] transition-colors">
                          <Upload className="h-3.5 w-3.5" /> Enviar imagem
                        </button>
                      )}
                    </div>
                  </div>

                  <ToggleRow icon={Users} title="Prova social" desc='"X pessoas compraram nas últimas 24h"' checked={socialProof} onChange={setSocialProof} />
                  <ToggleRow icon={ShieldCheck} iconColor="emerald-500" title="Selo de garantia" desc="Garantia de 7 dias com ícone" checked={guaranteeEnabled} onChange={setGuaranteeEnabled} />
                </>
              )}

              {/* ── PAYMENT TAB ── */}
              {activeTab === "payment" && (
                <>
                  <SectionHeader title="Métodos de Pagamento" desc="Escolha quais formas de pagamento aceitar" />
                  <ToggleRow icon={QrCode} iconColor="emerald-500" title="PIX" desc="Pagamento instantâneo via QR Code" checked={pixEnabled} onChange={setPixEnabled} />
                  <ToggleRow icon={FileText} iconColor="amber-500" title="Boleto Bancário" desc="Vencimento em 3 dias úteis" checked={boletoEnabled} onChange={setBoletoEnabled} />
                  <ToggleRow icon={CreditCard} iconColor="blue-500" title="Cartão de Crédito" desc="Até 12x sem juros" checked={creditCardEnabled} onChange={setCreditCardEnabled} />
                  
                  <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[10px] text-primary/70 font-medium">💡 Habilite PIX para maior conversão — taxa de aprovação de 99%</p>
                  </div>
                </>
              )}

              {/* ── FORM TAB ── */}
              {activeTab === "form" && (
                <>
                  <SectionHeader title="Campos do Formulário" desc="Configure quais dados o comprador precisa informar" />
                  <ToggleRow icon={Mail} title="Confirmação de e-mail" desc="Pede para digitar o e-mail 2 vezes" checked={emailConfirm} onChange={setEmailConfirm} />
                  <ToggleRow icon={Phone} title="Telefone / WhatsApp" desc="Solicita número de telefone" checked={phoneRequired} onChange={setPhoneRequired} />
                  <ToggleRow icon={Hash} title="CPF / CNPJ" desc="Solicita documento do comprador" checked={cpfRequired} onChange={setCpfRequired} />
                  <ToggleRow icon={MapPin} title="Endereço completo" desc="CEP com preenchimento automático" checked={addressRequired} onChange={setAddressRequired} />
                  <ToggleRow icon={CreditCard} title="Nome no cartão" desc="Campo separado para nome impresso" checked={nameOnCardRequired} onChange={setNameOnCardRequired} badge="Novo" />
                </>
              )}

              {/* ── BUMPS TAB ── */}
              {activeTab === "bumps" && (
                <>
                  <SectionHeader title="Order Bumps" desc="Ofertas adicionais exibidas no checkout" />
                  {orderBumps.map(bump => {
                    const prod = allProducts.find(p => p.id === bump.bump_product_id);
                    return (
                      <div key={bump.id} className="flex items-center justify-between p-3.5 rounded-xl border border-primary/20 bg-primary/[0.03]">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {prod?.image_url ? (
                            <img src={prod.image_url} alt={prod.name} className="h-10 w-10 rounded-xl object-cover border border-border/20" />
                          ) : (
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Package className="h-4 w-4 text-primary" /></div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate text-foreground">{prod?.name || "Produto"}</p>
                            <p className="text-[10px] text-primary font-semibold">+ R$ {Number(prod?.price || 0).toFixed(2)}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeBump(bump.id)} className="text-destructive/60 hover:text-destructive h-8 w-8 p-0 rounded-xl">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  {availableForBump.length > 0 && (
                    <div className="flex gap-2">
                      <select value={selectedBumpProduct} onChange={e => setSelectedBumpProduct(e.target.value)}
                        className="flex-1 h-9 rounded-xl border border-border/40 bg-background text-foreground text-xs px-2.5">
                        <option value="">Selecione um produto...</option>
                        {availableForBump.map(p => <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</option>)}
                      </select>
                      <Button onClick={addBump} disabled={!selectedBumpProduct} size="sm" className="gap-1.5 rounded-xl h-9 text-xs font-semibold">
                        <Plus className="h-3.5 w-3.5" /> Adicionar
                      </Button>
                    </div>
                  )}
                  {allProducts.length === 0 && orderBumps.length === 0 && (
                    <div className="text-center py-10">
                      <Package className="h-8 w-8 text-muted-foreground/15 mx-auto mb-2" />
                      <p className="text-muted-foreground/40 text-xs">Cadastre outros produtos para usar como bumps</p>
                    </div>
                  )}
                </>
              )}

              {/* ── CRO TAB ── */}
              {activeTab === "cro" && (
                <>
                  <SectionHeader title="Gatilhos de Conversão" desc="Aumente suas vendas com táticas avançadas de CRO" />
                  
                  <ToggleRow icon={Video} iconColor="red-500" title="VSL no Checkout" desc="Exibir vídeo de vendas no topo" checked={vslEnabled} onChange={setVslEnabled} />
                  {vslEnabled && (
                    <div className="ml-12 -mt-1">
                      <Input value={vslUrl} onChange={(e) => setVslUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="h-8 rounded-lg text-xs" />
                    </div>
                  )}
                  
                  <ToggleRow icon={Users} iconColor="orange-500" title="Compradores ao vivo" desc='"14 pessoas comprando agora"' checked={fakeViewersEnabled} onChange={setFakeViewersEnabled} />
                  <ToggleRow icon={ExitIcon} iconColor="red-500" title="Exit Intent Popup" desc="Oferecer desconto ao sair da página" checked={exitIntentEnabled} onChange={setExitIntentEnabled} badge="CRO" />
                  <ToggleRow icon={BarChart3} iconColor="blue-500" title="Barra de Progresso" desc='"Você está a 1 passo de garantir..."' checked={progressBarEnabled} onChange={setProgressBarEnabled} />
                  
                  {/* NEW OPTIONS */}
                  <div className="border-t border-border/20 dark:border-foreground/[0.04] pt-3 mt-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary/60 mb-3">Novas opções</p>
                  </div>
                  
                  <ToggleRow icon={Star} iconColor="amber-500" title="Depoimentos" desc="Exibir depoimentos de clientes no checkout" checked={testimonialEnabled} onChange={setTestimonialEnabled} badge="Novo" />
                  
                  <ToggleRow icon={Clock} iconColor="red-500" title="Escassez de vagas" desc='"Apenas X vagas restantes"' checked={scarcityEnabled} onChange={setScarcityEnabled} badge="Novo" />
                  {scarcityEnabled && (
                    <div className="ml-12 -mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Vagas:</span>
                      <Input type="number" min="1" max="999" value={scarcityUnits} onChange={(e) => setScarcityUnits(e.target.value)} className="w-16 h-7 text-center text-[11px] rounded-md" />
                    </div>
                  )}
                  
                  <ToggleRow icon={MessageSquare} iconColor="emerald-500" title="Botão WhatsApp" desc="Atendimento via WhatsApp no checkout" checked={whatsappEnabled} onChange={setWhatsappEnabled} badge="Novo" />
                  {whatsappEnabled && (
                    <div className="ml-12 -mt-1">
                      <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="11999999999" className="h-8 rounded-lg text-xs" />
                    </div>
                  )}
                  
                  <ToggleRow icon={Percent} iconColor="emerald-500" title="Badge de desconto" desc="Mostra preço original riscado + desconto" checked={discountBadgeEnabled} onChange={setDiscountBadgeEnabled} badge="Novo" />
                  {discountBadgeEnabled && (
                    <div className="ml-12 -mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">De R$</span>
                      <Input type="number" step="0.01" value={discountOriginalPrice} onChange={(e) => setDiscountOriginalPrice(e.target.value)} placeholder="297.00" className="w-24 h-7 text-[11px] rounded-md" />
                    </div>
                  )}
                  
                  <ToggleRow icon={Lock} iconColor="blue-500" title="Selos de confiança" desc="SSL, compra segura, dados protegidos" checked={trustBadgesEnabled} onChange={setTrustBadgesEnabled} badge="Novo" />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </aside>

      {/* ─── RIGHT: Live Preview ─── */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Preview header */}
        <div className="h-12 border-b border-border/30 dark:border-foreground/[0.04] bg-card/10 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.16em]">Live Preview</span>
          </div>
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-muted/20 border border-border/30">
            <button onClick={() => setPreviewMode("desktop")} className={cn("p-1.5 rounded-lg transition-all", previewMode === "desktop" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground")}>
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setPreviewMode("mobile")} className={cn("p-1.5 rounded-lg transition-all", previewMode === "mobile" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground")}>
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
          {checkoutUrl && (
            <Button variant="ghost" size="sm" onClick={() => window.open(checkoutUrl, "_blank")} className="gap-1.5 text-[10px] h-7 rounded-lg text-muted-foreground/40 hover:text-primary font-semibold">
              <Eye className="h-3 w-3" /> Abrir checkout
            </Button>
          )}
        </div>

        {/* Preview area */}
        <div className="flex-1 bg-muted/5 flex items-start justify-center p-6 overflow-auto"
          style={{ backgroundImage: "radial-gradient(circle, hsl(var(--border)/0.15) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        >
          <motion.div
            layout
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "bg-card rounded-2xl border border-border/40 dark:border-foreground/[0.06] shadow-2xl shadow-black/10 overflow-hidden",
              previewMode === "desktop" ? "w-full max-w-2xl" : "w-[375px]"
            )}
          >
            {/* Preview: Banner */}
            {(previewMode === "desktop" ? bannerDesktopPreview : bannerMobilePreview) && (
              <img src={previewMode === "desktop" ? bannerDesktopPreview : bannerMobilePreview} alt="Banner" className="w-full h-32 object-cover" />
            )}

            {/* Preview: VSL */}
            {vslEnabled && vslUrl && (
              <div className="p-4 pb-0">
                <div className="aspect-video rounded-xl bg-black/90 border border-border/20 flex items-center justify-center text-muted-foreground/20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
                      <Video className="h-5 w-5" />
                    </div>
                    <span className="text-[10px]">Vídeo de vendas</span>
                  </div>
                </div>
              </div>
            )}

            {/* Preview: Progress bar */}
            {progressBarEnabled && (
              <div className="px-4 pt-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground/70 mb-1.5">
                  <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-black">1</span>
                  Você está a 1 passo de garantir sua vaga
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: "66%" }} transition={{ duration: 1.5, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70" />
                </div>
              </div>
            )}

            {/* Preview: Fake viewers */}
            {fakeViewersEnabled && (
              <div className="px-4 pt-3">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full bg-orange-500/10 text-orange-400 px-3 py-1.5 border border-orange-500/15">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-400" /></span>
                  14 pessoas estão comprando agora
                </div>
              </div>
            )}

            {/* Preview: Scarcity */}
            {scarcityEnabled && (
              <div className="px-4 pt-3">
                <div className="flex items-center gap-2 text-[11px] font-bold text-red-400 bg-red-500/10 rounded-lg py-2 px-3 border border-red-500/15">
                  <Clock className="h-3.5 w-3.5" />
                  Apenas {scarcityUnits} vagas restantes
                </div>
              </div>
            )}

            {/* Preview: Timer */}
            {timerEnabled && (
              <div className="px-4 pt-3">
                <div className="flex items-center justify-center gap-2 text-[12px] font-bold text-amber-400 bg-amber-500/10 rounded-xl py-2.5 border border-amber-500/10">
                  <Timer className="h-3.5 w-3.5" /> Oferta expira em {timerMinutes}:00
                </div>
              </div>
            )}

            {/* Preview: Discount badge */}
            {discountBadgeEnabled && discountOriginalPrice && (
              <div className="px-4 pt-3">
                <div className="inline-flex items-center gap-2 text-[11px] font-bold bg-success/10 text-success px-3 py-1.5 rounded-full border border-success/15">
                  <Percent className="h-3 w-3" />
                  De <span className="line-through text-muted-foreground">R$ {Number(discountOriginalPrice).toFixed(2)}</span> por <span className="text-success">R$ {Number(product?.price || 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="p-4 space-y-4">
              {/* Product info */}
              <div className="flex items-center gap-3">
                {product?.image_url ? (
                  <img src={product.image_url} className="h-14 w-14 rounded-xl object-cover border border-border/20 shadow-sm" />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center"><Package className="h-6 w-6 text-primary" /></div>
                )}
                <div>
                  <p className="text-sm font-bold text-foreground">{product?.name}</p>
                  <p className="text-xl font-black text-primary">R$ {Number(product?.price || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Testimonials */}
              {testimonialEnabled && (
                <div className="space-y-2">
                  {[
                    { name: "Maria S.", text: "Melhor investimento que fiz!", rating: 5 },
                    { name: "João P.", text: "Conteúdo incrível, recomendo!", rating: 5 },
                  ].map((t, i) => (
                    <div key={i} className="p-3 rounded-xl bg-muted/20 border border-border/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="flex">
                          {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />)}
                        </div>
                        <span className="text-[10px] font-bold text-foreground/60">{t.name}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground italic">"{t.text}"</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Social proof */}
              {socialProof && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <div className="flex -space-x-1.5">
                    {[1,2,3,4].map(i => <div key={i} className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-card" />)}
                  </div>
                  <span className="font-medium">+127 compraram nas últimas 24h</span>
                </div>
              )}

              {/* Form preview */}
              <div className="space-y-2.5">
                <PreviewField label="Nome completo" />
                <PreviewField label="E-mail" />
                {emailConfirm && <PreviewField label="Confirme seu e-mail" />}
                {phoneRequired && <PreviewField label="WhatsApp" />}
                {cpfRequired && <PreviewField label="CPF / CNPJ" />}
                {nameOnCardRequired && creditCardEnabled && <PreviewField label="Nome impresso no cartão" />}
                {addressRequired && (
                  <div className="grid grid-cols-3 gap-2">
                    <PreviewField label="CEP" />
                    <div className="col-span-2"><PreviewField label="Endereço" /></div>
                  </div>
                )}
              </div>

              {/* Payment methods preview */}
              <div className="flex gap-2 flex-wrap">
                {pixEnabled && <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 inline-flex items-center gap-1.5"><QrCode className="h-3 w-3" /> PIX</span>}
                {boletoEnabled && <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/15 inline-flex items-center gap-1.5"><FileText className="h-3 w-3" /> Boleto</span>}
                {creditCardEnabled && <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/15 inline-flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Cartão</span>}
              </div>

              {/* Order bumps preview */}
              {orderBumps.length > 0 && (
                <div className="space-y-2">
                  {orderBumps.map(bump => {
                    const prod = allProducts.find(p => p.id === bump.bump_product_id);
                    return (
                      <div key={bump.id} className="p-3.5 rounded-xl border-2 border-dashed border-primary/25 bg-primary/[0.03]">
                        <div className="flex items-center gap-2.5">
                          <div className="h-5 w-5 rounded border-2 border-primary/40" />
                          <div className="flex-1">
                            <span className="text-xs font-bold text-foreground">{prod?.name || "Bump"}</span>
                          </div>
                          <span className="text-xs font-black text-primary">+ R$ {Number(prod?.price || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CTA button */}
              <button
                className="w-full h-13 py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: buttonColor, boxShadow: `0 10px 30px -10px ${buttonColor}50` }}
              >
                <Lock className="h-3.5 w-3.5" />
                COMPRAR AGORA
              </button>

              {/* Trust badges */}
              {trustBadgesEnabled && (
                <div className="flex items-center justify-center gap-4 py-2">
                  {[
                    { icon: Lock, label: "SSL Seguro" },
                    { icon: ShieldCheck, label: "Compra Protegida" },
                    { icon: CreditCard, label: "Dados Criptografados" },
                  ].map((b, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <b.icon className="h-4 w-4 text-muted-foreground/30" />
                      <span className="text-[8px] font-medium text-muted-foreground/30">{b.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Guarantee seal */}
              {guaranteeEnabled && (
                <div className="flex items-center justify-center gap-2 py-1 text-[11px] text-emerald-400 font-semibold">
                  <ShieldCheck className="h-4 w-4" /> Garantia de 7 dias ou seu dinheiro de volta
                </div>
              )}

              {/* WhatsApp button */}
              {whatsappEnabled && (
                <div className="flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/15 cursor-pointer hover:bg-emerald-500/15 transition-colors">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Dúvidas? Fale no WhatsApp
                  </div>
                </div>
              )}
            </div>

            {/* Exit intent preview */}
            {exitIntentEnabled && (
              <div className="border-t border-border/20 p-3 bg-muted/5 text-center">
                <p className="text-[10px] text-muted-foreground/30 font-medium">Exit Intent ativo — popup ao sair da página</p>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

/* ── Preview Field ── */
function PreviewField({ label }: { label: string }) {
  return (
    <div>
      <p className="text-[9px] font-medium text-muted-foreground/40 mb-1">{label}</p>
      <div className="h-9 rounded-lg bg-muted/15 border border-border/20" />
    </div>
  );
}
