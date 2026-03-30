import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateAll } from "@/hooks/useQueryData";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Save, Package, DollarSign, ImagePlus, X, Settings, ShoppingCart,
  ArrowUpRight, Users, Handshake, Tag, Link2, Trash2, Plus, ExternalLink,
  CreditCard, QrCode, FileText, Mail, MapPin, Shield, Timer, Eye,
  Upload, CheckCircle2, Copy, Globe, Zap, Crosshair, Percent, Clock,
  Layers, UserPlus, Lock, Gift, BarChart3, Star, Palette, Sparkles
} from "lucide-react";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type TabKey = "geral" | "configuracoes" | "order-bump" | "upsell" | "checkout" | "co-producao" | "cupons" | "afiliados" | "links";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "geral", label: "Geral", icon: Package },
  { key: "configuracoes", label: "Configurações", icon: Settings },
  { key: "order-bump", label: "Order Bump", icon: Layers },
  { key: "upsell", label: "Upsell / Downsell", icon: ArrowUpRight },
  { key: "checkout", label: "Checkout", icon: ShoppingCart },
  { key: "co-producao", label: "Co-Produção", icon: Handshake },
  { key: "cupons", label: "Cupons", icon: Tag },
  { key: "afiliados", label: "Afiliados", icon: Users },
  { key: "links", label: "Links", icon: Link2 },
];

export default function ProductEditor() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const invalidateAll = useInvalidateAll();
  const isNew = productId === "novo";

  const [activeTab, setActiveTab] = useState<TabKey>("geral");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState("pending_review");
  const [pageUrl, setPageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [category, setCategory] = useState("infoproduto");
  const [paymentType, setPaymentType] = useState("unico");
  const [displayName, setDisplayName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");

  const [warrantyDays, setWarrantyDays] = useState("7");
  const [deliveryType, setDeliveryType] = useState("digital");
  const [memberAreaEnabled, setMemberAreaEnabled] = useState(false);

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
  const [showCouponField, setShowCouponField] = useState(true);
  const [bannerDesktopPreview, setBannerDesktopPreview] = useState("");
  const [bannerMobilePreview, setBannerMobilePreview] = useState("");
  const [bannerDesktopFile, setBannerDesktopFile] = useState<File | null>(null);
  const [bannerMobileFile, setBannerMobileFile] = useState<File | null>(null);
  const desktopBannerRef = useRef<HTMLInputElement>(null);
  const mobileBannerRef = useRef<HTMLInputElement>(null);

  const [affiliateEnabled, setAffiliateEnabled] = useState(false);
  const [affiliateCommission, setAffiliateCommission] = useState("30");
  const [affiliateAttribution, setAffiliateAttribution] = useState("last_click");
  const [affiliateCookieDays, setAffiliateCookieDays] = useState("30");
  const [affiliateApprovalManual, setAffiliateApprovalManual] = useState(false);
  const [affiliateUpsellCommission, setAffiliateUpsellCommission] = useState(false);
  const [affiliateMarketplace, setAffiliateMarketplace] = useState(false);
  const [affiliateSupportEmail, setAffiliateSupportEmail] = useState("");
  const [affiliateDescription, setAffiliateDescription] = useState("");

  const [coProductionEnabled, setCoProductionEnabled] = useState(false);
  const [coProducerEmail, setCoProducerEmail] = useState("");
  const [coProductionSplit, setCoProductionSplit] = useState("50");
  const [coProductionDuration, setCoProductionDuration] = useState("30");
  const [coProductionSalesType, setCoProductionSalesType] = useState("all");

  const [hasCustomThankYou, setHasCustomThankYou] = useState(false);
  const [thankYouUrl, setThankYouUrl] = useState("");
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState(true);
  const [emailTiming, setEmailTiming] = useState("immediate");

  const [orderBumps, setOrderBumps] = useState<{ id: string; bump_product_id: string }[]>([]);
  const [allProducts, setAllProducts] = useState<Tables<"products">[]>([]);
  const [selectedBumpProduct, setSelectedBumpProduct] = useState("");

  const [coupons, setCoupons] = useState<Tables<"coupons">[]>([]);
  const [product, setProduct] = useState<Tables<"products"> | null>(null);

  useEffect(() => {
    if (isNew || !user?.id) { setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", productId!).eq("user_id", user.id).single();
      if (error || !data) { toast.error("Produto não encontrado"); navigate("/vendas/produtos"); return; }
      setProduct(data);
      setName(data.name);
      setDescription(data.description || "");
      setPrice(String(data.price));
      setStatus(data.status);
      setPageUrl(data.page_url || "");
      setImagePreview(data.image_url || null);
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
      setAffiliateEnabled(data.affiliate_enabled || false);
      setAffiliateCommission(String(data.affiliate_commission || 30));
      setCoProductionEnabled(data.co_production_enabled || false);
      setCoProducerEmail(data.co_producer_email || "");
      setCoProductionSplit(String(data.co_production_split || 50));
      setLoading(false);
    })();
  }, [productId, user?.id, isNew]);

  useEffect(() => {
    if (!user?.id || isNew) return;
    supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").neq("id", productId!)
      .then(({ data }) => { if (data) setAllProducts(data); });
    supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", productId!)
      .then(({ data }) => { if (data) setOrderBumps(data); });
    supabase.from("coupons").select("*").eq("user_id", user.id).eq("product_id", productId!).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setCoupons(data); });
  }, [user?.id, productId, isNew]);

  const uploadImage = async (file: File, bucket: string, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) { toast.error("Erro ao enviar imagem"); return null; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!user) return;
    const priceNum = parseFloat(price);
    if (!name.trim()) { toast.error("Nome é obrigatório"); setActiveTab("geral"); return; }
    if (isNaN(priceNum) || priceNum < 1) { toast.error("Preço mínimo é R$ 1,00"); setActiveTab("geral"); return; }
    if (priceNum > 99999.99) { toast.error("Preço máximo é R$ 99.999,99"); setActiveTab("geral"); return; }

    setSaving(true);
    try {
      let imageUrl: string | null = imagePreview;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        imageUrl = await uploadImage(imageFile, "product-images", path);
      }

      let desktopUrl = bannerDesktopPreview;
      let mobileUrl = bannerMobilePreview;
      if (bannerDesktopFile && !isNew) {
        const ext = bannerDesktopFile.name.split(".").pop();
        desktopUrl = await uploadImage(bannerDesktopFile, "checkout-banners", `${user.id}/${productId}-desktop.${ext}`) || desktopUrl;
      }
      if (bannerMobileFile && !isNew) {
        const ext = bannerMobileFile.name.split(".").pop();
        mobileUrl = await uploadImage(bannerMobileFile, "checkout-banners", `${user.id}/${productId}-mobile.${ext}`) || mobileUrl;
      }

      const productData = {
        name: name.trim(),
        description: description.trim() || null,
        price: priceNum,
        status,
        page_url: pageUrl || null,
        image_url: imageUrl,
        affiliate_enabled: affiliateEnabled,
        affiliate_commission: Number(affiliateCommission) || 30,
        co_production_enabled: coProductionEnabled,
        co_producer_email: coProductionEnabled ? coProducerEmail || null : null,
        co_production_split: Number(coProductionSplit) || 50,
        checkout_button_color: buttonColor,
        checkout_timer_enabled: timerEnabled,
        checkout_timer_minutes: parseInt(timerMinutes) || 15,
        checkout_social_proof: socialProof,
        checkout_guarantee_enabled: guaranteeEnabled,
        checkout_pix_enabled: pixEnabled,
        checkout_boleto_enabled: boletoEnabled,
        checkout_credit_card_enabled: creditCardEnabled,
        checkout_address_required: addressRequired,
        checkout_email_confirm: emailConfirm,
        checkout_banner_desktop_url: desktopUrl || null,
        checkout_banner_mobile_url: mobileUrl || null,
      };

      if (isNew) {
        const slug = crypto.randomUUID().slice(0, 8);
        const checkoutUrl = `${window.location.origin}/pay/${slug}`;
        const { error } = await supabase.from("products").insert({ ...productData, user_id: user.id, checkout_url: checkoutUrl } as any);
        if (error) { toast.error("Erro ao criar produto"); return; }
        toast.success("Produto criado com sucesso!");
        invalidateAll(["products"]);
        navigate("/vendas/produtos");
      } else {
        const { error } = await supabase.from("products").update(productData).eq("id", productId!).eq("user_id", user.id);
        if (error) { toast.error("Erro ao salvar"); return; }
        toast.success("Produto salvo!");
        invalidateAll(["products"]);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!user || isNew) return;
    if (!window.confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("products").delete().eq("id", productId!).eq("user_id", user.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Produto excluído");
    invalidateAll(["products"]);
    navigate("/vendas/produtos");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Formato inválido"); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error("Máximo 10MB"); return; }
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
  };

  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>, type: "desktop" | "mobile") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Formato inválido"); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error("Máximo 10MB"); return; }
    if (type === "desktop") { setBannerDesktopFile(file); setBannerDesktopPreview(URL.createObjectURL(file)); }
    else { setBannerMobileFile(file); setBannerMobilePreview(URL.createObjectURL(file)); }
  };

  const addBump = async () => {
    if (!selectedBumpProduct || isNew) return;
    if (orderBumps.length >= 5) { toast.error("Máximo de 5 order bumps"); return; }
    if (orderBumps.some(b => b.bump_product_id === selectedBumpProduct)) { toast.error("Produto já adicionado"); return; }
    const { data, error } = await supabase.from("order_bumps").insert({
      product_id: productId!, bump_product_id: selectedBumpProduct, sort_order: orderBumps.length,
    }).select("id, bump_product_id").single();
    if (error) { toast.error("Erro ao adicionar"); return; }
    if (data) setOrderBumps(prev => [...prev, data]);
    setSelectedBumpProduct("");
    toast.success("Order bump adicionado!");
  };

  const removeBump = async (id: string) => {
    await supabase.from("order_bumps").delete().eq("id", id);
    setOrderBumps(prev => prev.filter(b => b.id !== id));
    toast.success("Order bump removido");
  };

  const getCheckoutLink = () => {
    if (!product?.checkout_url) return "";
    const slug = product.checkout_url.split("/").pop()!;
    return `${window.location.origin}/pay/${slug}`;
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20" />
          <p className="text-sm text-muted-foreground">Carregando produto...</p>
        </div>
      </div>
    );
  }

  const availableForBump = allProducts.filter(p => !orderBumps.some(b => b.bump_product_id === p.id));

  return (
    <div className="min-h-screen bg-background">
      {/* ───── Top Bar ───── */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <button onClick={() => navigate("/vendas/produtos")} className="flex items-center gap-2.5 text-sm font-display font-bold text-muted-foreground hover:text-foreground transition-colors group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-card/50 backdrop-blur-xl group-hover:border-primary/20 transition-all">
              <ArrowLeft className="h-3.5 w-3.5" />
            </div>
            <span className="hidden sm:inline">Voltar aos Produtos</span>
          </button>
          <div className="flex items-center gap-2.5">
            {!isNew && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive gap-1.5 text-xs font-display font-bold rounded-xl">
                <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Excluir</span>
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl text-sm font-display font-black h-9 px-6 shadow-lg shadow-primary/20">
              <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar Produto"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-7">
          {/* ───── Premium Sidebar Tabs ───── */}
          <nav className="hidden lg:block w-60 shrink-0 sticky top-20 self-start">
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-3 space-y-1 shadow-[0_2px_12px_hsl(var(--foreground)/0.04)]">
              <p className="px-3 pt-1 pb-2 text-[9px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground/50">Navegação</p>
              {TABS.map((tab, i) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-display font-bold transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] text-left tracking-[-0.01em] relative overflow-hidden",
                    activeTab === tab.key
                      ? "bg-primary/10 text-primary border border-primary/15 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/15 border border-transparent"
                  )}
                >
                  {activeTab === tab.key && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
                  )}
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-all",
                    activeTab === tab.key
                      ? "bg-primary/15 ring-1 ring-primary/20"
                      : "bg-muted/15 ring-1 ring-border/20"
                  )}>
                    <tab.icon className={cn("h-3.5 w-3.5", activeTab === tab.key ? "text-primary" : "text-muted-foreground/60")} />
                  </div>
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          {/* ───── Mobile Bottom Tabs ───── */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border/40 px-2 py-2 flex gap-1 overflow-x-auto safe-area-bottom">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-display font-bold whitespace-nowrap transition-all",
                  activeTab === tab.key ? "bg-primary/10 text-primary border border-primary/15" : "text-muted-foreground border border-transparent"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ───── Content Area ───── */}
          <div className="flex-1 min-w-0 pb-20 lg:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeTab === "geral" && (
                  <div className="space-y-6">
                    <SectionHeader title="Informações do Produto" subtitle="Dados principais que serão exibidos na área de membros e programa de afiliados." />

                    {/* ── Image Upload Card ── */}
                    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden shadow-[0_2px_12px_hsl(var(--foreground)/0.04)]">
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
                      <div className="p-4 border-b border-border/30">
                        <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-2">
                          <ImagePlus className="h-3.5 w-3.5" /> Imagem do Produto
                        </Label>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Formatos aceitos: JPG, PNG, WebP, GIF. Máx: 10MB. Recomendado: 300×250px</p>
                      </div>
                      {imagePreview ? (
                        <div className="relative group/img">
                          <img src={imagePreview} alt="Preview" className="w-full h-56 object-cover" />
                          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center gap-3">
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 rounded-xl bg-card/90 border border-border/30 flex items-center justify-center hover:bg-primary/10 transition-all">
                              <ImagePlus className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="h-10 w-10 rounded-xl bg-card/90 border border-border/30 flex items-center justify-center text-destructive hover:bg-destructive/10 transition-all">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-44 flex flex-col items-center justify-center gap-3 text-muted-foreground/40 hover:text-primary/60 transition-all group/upload hover:bg-primary/[0.02]">
                          <div className="h-14 w-14 rounded-2xl bg-muted/10 group-hover/upload:bg-primary/10 flex items-center justify-center transition-all border border-dashed border-border/30 group-hover/upload:border-primary/20">
                            <Upload className="h-6 w-6" />
                          </div>
                          <div className="text-center">
                            <span className="block text-xs font-display font-bold">Arraste ou selecione o arquivo</span>
                            <span className="block text-[10px] text-muted-foreground/30 mt-0.5">Solte os arquivos aqui ou clique para buscar</span>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* ── Details Card ── */}
                    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 space-y-5 shadow-[0_2px_12px_hsl(var(--foreground)/0.04)] relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />

                      <div className="space-y-2">
                        <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-2">
                          <Package className="h-3.5 w-3.5" /> Nome do produto
                        </Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Curso Completo de Marketing Digital" className="h-11 bg-card/80 border-border/40 focus-visible:border-primary/40" required maxLength={200} />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">Descrição</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Descreva seu produto em detalhes..." className="resize-none bg-card/80 border-border/40" maxLength={2000} />
                        <p className="text-[10px] text-muted-foreground/40 text-right font-numbers tabular-nums">{description.length}/2000</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">Categoria</Label>
                          <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="h-11 bg-card/80 border-border/40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="infoproduto">Infoproduto</SelectItem>
                              <SelectItem value="curso">Curso Online</SelectItem>
                              <SelectItem value="ebook">E-book</SelectItem>
                              <SelectItem value="mentoria">Mentoria</SelectItem>
                              <SelectItem value="software">Software / SaaS</SelectItem>
                              <SelectItem value="servico">Serviço</SelectItem>
                              <SelectItem value="comunidade">Comunidade</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">Tipo de pagamento</Label>
                          <Select value={paymentType} onValueChange={setPaymentType}>
                            <SelectTrigger className="h-11 bg-card/80 border-border/40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unico">Único</SelectItem>
                              <SelectItem value="assinatura">Assinatura</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* ── Pricing Card ── */}
                    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 space-y-4 shadow-[0_2px_12px_hsl(var(--foreground)/0.04)] relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-2">
                          <DollarSign className="h-3.5 w-3.5" /> Preços
                        </Label>
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5" /> Garantia
                          </Label>
                          <Select value={warrantyDays} onValueChange={setWarrantyDays}>
                            <SelectTrigger className="h-8 w-24 text-xs bg-card/80 border-border/40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">7 dias</SelectItem>
                              <SelectItem value="14">14 dias</SelectItem>
                              <SelectItem value="30">30 dias</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/40 overflow-hidden bg-card/30">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/30 text-muted-foreground text-[10px] bg-muted/10">
                              <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Nome</th>
                              <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Preço</th>
                              <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Tipo</th>
                              <th className="px-4 py-2.5 w-12"></th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-border/10">
                              <td className="px-4 py-3 font-display font-bold text-foreground tracking-[-0.01em]">{name || "—"}</td>
                              <td className="px-4 py-3">
                                <Input type="number" step="0.01" min="1" max="99999.99" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-28 text-sm font-numbers font-black tracking-[-0.03em] bg-card/80 border-border/40" placeholder="0.00" />
                              </td>
                              <td className="px-4 py-3 text-muted-foreground capitalize font-display font-medium">{paymentType}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-[10px] text-muted-foreground/40 font-numbers">1/10</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ── Links & Support Card ── */}
                    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 space-y-4 shadow-[0_2px_12px_hsl(var(--foreground)/0.04)] relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-info" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-2">
                            <ExternalLink className="h-3.5 w-3.5" /> Página de vendas
                          </Label>
                          <Input value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://..." type="url" className="h-11 bg-card/80 border-border/40" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5" /> E-mail de suporte
                          </Label>
                          <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="suporte@..." type="email" className="h-11 bg-card/80 border-border/40" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">Nome de exibição do produtor</Label>
                        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome ou marca" className="h-11 bg-card/80 border-border/40" />
                      </div>
                    </div>

                    {/* ── Status Toggle Card ── */}
                    <div className={cn(
                      "rounded-2xl border bg-card/50 backdrop-blur-xl p-5 shadow-[0_2px_12px_hsl(var(--foreground)/0.04)] relative overflow-hidden transition-all duration-300",
                      status === "active" ? "border-success/30" : "border-border/50"
                    )}>
                      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", status === "active" ? "bg-success" : "bg-muted-foreground/20")} />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center ring-1 transition-all",
                            status === "active" ? "bg-success/10 ring-success/20" : "bg-muted/10 ring-border/20"
                          )}>
                            <Zap className={cn("h-4 w-4", status === "active" ? "text-success" : "text-muted-foreground/40")} />
                          </div>
                          <div>
                            <p className="text-sm font-display font-black tracking-[-0.02em]">Status do produto</p>
                            <p className="text-[10px] text-muted-foreground/50 font-medium">Ative para começar a vender</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("text-xs font-display font-black", status === "active" ? "text-success" : "text-muted-foreground/50")}>
                            {status === "active" ? "Ativo" : "Inativo"}
                          </span>
                          <Switch checked={status === "active"} onCheckedChange={(v) => setStatus(v ? "active" : "inactive")} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "configuracoes" && (
                  <div className="space-y-6">
                    <SectionHeader title="Configurações" subtitle="Pagamento, métodos aceitos e entrega de conteúdo." />

                    <div className="space-y-3">
                      <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2 tracking-[-0.02em]"><CreditCard className="h-4 w-4 text-primary" /> Métodos de pagamento</h3>
                      <p className="text-xs text-muted-foreground/60">Selecione os métodos de pagamento disponíveis no checkout.</p>
                      <div className="space-y-2">
                        <PaymentMethodRow icon={QrCode} label="PIX" sublabel={price ? `Valor líquido: R$ ${(parseFloat(price) * 0.9751).toFixed(2)}` : ""} color="text-success" checked={pixEnabled} onChange={setPixEnabled} />
                        <PaymentMethodRow icon={FileText} label="Boleto Bancário" sublabel={price ? `Valor líquido: R$ ${(parseFloat(price) * 0.9252).toFixed(2)}` : ""} color="text-warning" checked={boletoEnabled} onChange={setBoletoEnabled} />
                        <PaymentMethodRow icon={CreditCard} label="Cartão de Crédito" sublabel={price ? `Valor líquido: R$ ${(parseFloat(price) * 0.9362).toFixed(2)}` : ""} color="text-info" checked={creditCardEnabled} onChange={setCreditCardEnabled} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-[15px] font-display font-black text-foreground tracking-[-0.02em]">Configurações do formulário</h3>
                      <ToggleRow label="Pedir para o comprador repetir o e-mail" checked={emailConfirm} onChange={setEmailConfirm} />
                      <ToggleRow label="Exibir campo de cupom de desconto" checked={showCouponField} onChange={setShowCouponField} />
                      <ToggleRow label="Solicitar endereço do comprador" sublabel="CEP com preenchimento automático" checked={addressRequired} onChange={setAddressRequired} />
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2 tracking-[-0.02em]"><Globe className="h-4 w-4 text-primary" /> Entrega de conteúdo</h3>
                      <p className="text-xs text-muted-foreground/60">Selecione como o conteúdo será entregue ao comprador.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { value: "digital", label: "Área de Membros", desc: "Plataforma de cursos integrada", icon: Star },
                          { value: "email", label: "Acesso por e-mail", desc: "Envie links e arquivos por e-mail", icon: Mail },
                          { value: "telegram", label: "Telegram", desc: "Grupo ou canal privado", icon: Globe },
                          { value: "discord", label: "Discord", desc: "Monetize seu servidor", icon: Users },
                          { value: "link", label: "Link de pagamento", desc: "Apenas receba pagamentos", icon: Link2 },
                          { value: "external", label: "Área de membros externa", desc: "Plataforma de terceiros", icon: ExternalLink },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setDeliveryType(opt.value)}
                            className={cn(
                              "flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200",
                              deliveryType === opt.value
                                ? "bg-primary/5 border-primary/20 shadow-sm"
                                : "bg-card/30 border-border/20 hover:border-border/40"
                            )}
                          >
                            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", deliveryType === opt.value ? "bg-primary/10" : "bg-muted/10")}>
                              <opt.icon className={cn("h-4 w-4", deliveryType === opt.value ? "text-primary" : "text-muted-foreground/40")} />
                            </div>
                            <div>
                              <p className="text-sm font-display font-bold text-foreground tracking-[-0.01em]">{opt.label}</p>
                              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{opt.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2 tracking-[-0.02em]"><Crosshair className="h-4 w-4 text-primary" /> Pixels de conversão</h3>
                      <p className="text-xs text-muted-foreground/60">Configure os pixels diretamente na página de Produtos usando o botão "Pixels".</p>
                    </div>
                  </div>
                )}

                {activeTab === "order-bump" && (
                  <div className="space-y-6">
                    <SectionHeader title="Order Bump" subtitle="Adicione produtos complementares que aparecem como oferta no checkout." />

                    {isNew ? (
                      <EmptyCard icon={Layers} message="Salve o produto primeiro para configurar Order Bumps." />
                    ) : (
                      <>
                        {orderBumps.length > 0 ? (
                          <div className="space-y-2">
                            {orderBumps.map(bump => {
                              const prod = allProducts.find(p => p.id === bump.bump_product_id);
                              return (
                                <div key={bump.id} className="flex items-center justify-between panel-enterprise-subtle p-4">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {prod?.image_url ? (
                                      <img src={prod.image_url} alt={prod.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                                    ) : (
                                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Package className="h-4 w-4 text-primary" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-sm font-display font-bold truncate tracking-[-0.01em]">{prod?.name || "Produto"}</p>
                                      <p className="text-xs text-muted-foreground font-numbers">R$ {Number(prod?.price || 0).toFixed(2)}</p>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => removeBump(bump.id)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <EmptyCard icon={Layers} message="Nenhum bump adicionado" />
                        )}

                        {availableForBump.length > 0 && orderBumps.length < 5 && (
                          <div className="flex gap-2">
                            <select
                              value={selectedBumpProduct}
                              onChange={e => setSelectedBumpProduct(e.target.value)}
                              className="flex-1 h-10 rounded-xl border border-border bg-card text-foreground text-sm px-3"
                            >
                              <option value="">Selecione um produto...</option>
                              {availableForBump.map(p => (
                                <option key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</option>
                              ))}
                            </select>
                            <Button onClick={addBump} className="gap-1.5 rounded-xl"><Plus className="h-4 w-4" /> Adicionar</Button>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground/40 text-right">{orderBumps.length}/5</p>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "upsell" && (
                  <div className="space-y-6">
                    <SectionHeader title="Upsell / Downsell" subtitle="Configure página de obrigado personalizada e ofertas pós-compra." />

                    <ToggleRow label="Este produto tem uma página de obrigado personalizada ou upsell" checked={hasCustomThankYou} onChange={setHasCustomThankYou} />

                    {hasCustomThankYou && (
                      <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                        <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">URL da página de obrigado / upsell</Label>
                        <Input value={thankYouUrl} onChange={(e) => setThankYouUrl(e.target.value)} placeholder="https://..." type="url" className="h-11" />
                      </div>
                    )}

                    <div className="space-y-3">
                      <ToggleRow label="Este produto vai enviar um e-mail de confirmação" checked={sendConfirmationEmail} onChange={setSendConfirmationEmail} />
                      {sendConfirmationEmail && (
                        <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                          <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="emailTiming" checked={emailTiming === "immediate"} onChange={() => setEmailTiming("immediate")} className="accent-primary" />
                              <span className="text-sm font-display font-medium">Enviar imediatamente após o pagamento</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="emailTiming" checked={emailTiming === "after_upsell"} onChange={() => setEmailTiming("after_upsell")} className="accent-primary" />
                              <span className="text-sm font-display font-medium">Enviar após concluir as ofertas de upsell</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "checkout" && (
                  <div className="space-y-6">
                    <SectionHeader title="Checkout" subtitle="Gerencie e personalize seus checkouts." />

                    {isNew ? (
                      <EmptyCard icon={ShoppingCart} message="Salve o produto primeiro para personalizar o checkout." />
                    ) : (
                      <>
                        <div className="panel-enterprise-subtle overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/30 text-muted-foreground text-[10px]">
                                <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Nome</th>
                                <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Preço</th>
                                <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Oferta</th>
                                <th className="px-4 py-2.5 font-display font-black uppercase tracking-[0.15em] text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="px-4 py-3 font-display font-bold text-foreground tracking-[-0.01em]">Checkout Principal Padrão</td>
                                <td className="px-4 py-3 text-foreground font-numbers font-black tracking-[-0.03em]">R$ {Number(price || 0).toFixed(2)}</td>
                                <td className="px-4 py-3 text-muted-foreground font-display font-medium">{name}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center gap-1 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => navigate(`/vendas/produtos/${productId}/checkout-builder`)} className="h-7 text-[10px] gap-1">
                                      <Palette className="h-3 w-3" /> Personalizar
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => copyLink(getCheckoutLink())} className="h-7 text-[10px] gap-1">
                                      <Copy className="h-3 w-3" /> Copiar
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-[15px] font-display font-black text-foreground tracking-[-0.02em]">Personalização visual</h3>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-2">
                              <Palette className="h-3.5 w-3.5" /> Cor do botão de compra
                            </Label>
                            <div className="flex items-center gap-3">
                              <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                              <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="flex-1 font-mono text-sm" />
                              <div className="h-10 px-6 rounded-lg flex items-center justify-center text-sm font-display font-black" style={{ backgroundColor: buttonColor, color: '#fff' }}>
                                Comprar
                              </div>
                            </div>
                          </div>

                          <ToggleRow icon={Timer} label="Timer de urgência" sublabel="Contador regressivo no checkout" checked={timerEnabled} onChange={setTimerEnabled}>
                            {timerEnabled && (
                              <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} className="w-16 h-8 text-center text-xs" />
                            )}
                          </ToggleRow>

                          <ToggleRow icon={Users} label="Prova social" sublabel="'X pessoas compraram'" checked={socialProof} onChange={setSocialProof} />
                          <ToggleRow icon={Shield} label="Selo de garantia" sublabel={`Mostra selo de ${warrantyDays} dias no checkout`} checked={guaranteeEnabled} onChange={setGuaranteeEnabled} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <BannerUpload label="Banner Desktop" preview={bannerDesktopPreview} inputRef={desktopBannerRef} onFile={(e) => handleBannerFile(e, "desktop")} onClear={() => { setBannerDesktopFile(null); setBannerDesktopPreview(""); }} />
                          <BannerUpload label="Banner Mobile" preview={bannerMobilePreview} inputRef={mobileBannerRef} onFile={(e) => handleBannerFile(e, "mobile")} onClear={() => { setBannerMobileFile(null); setBannerMobilePreview(""); }} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "co-producao" && (
                  <div className="space-y-6">
                    <SectionHeader title="Co-Produção" subtitle="Divida receitas com parceiros de produção." />

                    {isNew ? (
                      <EmptyCard icon={Handshake} message="Salve o produto primeiro para configurar co-produção." />
                    ) : (
                      <>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">E-mail do co-produtor</Label>
                              <Input value={coProducerEmail} onChange={(e) => setCoProducerEmail(e.target.value)} placeholder="email@coprodutor.com" type="email" className="h-11" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">Tempo de duração</Label>
                              <Select value={coProductionDuration} onValueChange={setCoProductionDuration}>
                                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="30">30 dias</SelectItem>
                                  <SelectItem value="60">60 dias</SelectItem>
                                  <SelectItem value="90">90 dias</SelectItem>
                                  <SelectItem value="180">180 dias</SelectItem>
                                  <SelectItem value="365">1 ano</SelectItem>
                                  <SelectItem value="indefinido">Indefinido</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-2">
                              <Percent className="h-3.5 w-3.5" /> Comissão do co-produtor
                            </Label>
                            <div className="flex items-center gap-3">
                              <Input type="number" min="1" max="99" value={coProductionSplit} onChange={(e) => setCoProductionSplit(e.target.value)} className="w-24 h-11 text-center font-numbers font-black text-lg tracking-[-0.03em]" />
                              <span className="text-lg font-display font-black text-muted-foreground">%</span>
                              <div className="flex-1">
                                <div className="h-3 rounded-full bg-muted/20 overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-info transition-all duration-500" style={{ width: `${Math.min(Number(coProductionSplit), 100)}%` }} />
                                </div>
                                <div className="flex justify-between mt-1">
                                  <span className="text-[10px] font-display font-bold text-muted-foreground/50">Co-produtor: {coProductionSplit}%</span>
                                  <span className="text-[10px] font-display font-bold text-muted-foreground/50">Você: {100 - Number(coProductionSplit)}%</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">Deve receber comissões de quais vendas?</Label>
                            <Select value={coProductionSalesType} onValueChange={setCoProductionSalesType}>
                              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas as vendas</SelectItem>
                                <SelectItem value="producer_only">Vendas do produtor</SelectItem>
                                <SelectItem value="affiliate_only">Vendas dos afiliados</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <Button className="gap-2 rounded-xl font-display font-bold" disabled={!coProducerEmail}>
                            <UserPlus className="h-4 w-4" /> Convidar Co-Produtor
                          </Button>
                        </div>

                        <div className="panel-enterprise-subtle overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                               <tr className="border-b border-border/30 text-muted-foreground text-[10px]">
                                <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Data</th>
                                <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Nome</th>
                                <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Comissão</th>
                                <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Validade</th>
                                <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground/40">Nenhum co-produtor cadastrado</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "cupons" && (
                  <div className="space-y-6">
                    <SectionHeader title="Cupons de Desconto" subtitle="Crie cupons exclusivos para este produto." />

                    {isNew ? (
                      <EmptyCard icon={Tag} message="Salve o produto primeiro para criar cupons." />
                    ) : (
                      <>
                        {coupons.length > 0 ? (
                          <div className="panel-enterprise-subtle overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                 <tr className="border-b border-border/30 text-muted-foreground text-[10px]">
                                  <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Código</th>
                                  <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Desconto</th>
                                  <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Usos</th>
                                  <th className="text-left px-4 py-2.5 font-display font-black uppercase tracking-[0.15em]">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {coupons.map(c => (
                                  <tr key={c.id} className="border-b border-border/10">
                                    <td className="px-4 py-3 font-mono font-black text-primary tracking-wide">{c.code}</td>
                                    <td className="px-4 py-3 font-numbers font-bold">{c.discount_type === "percentage" ? `${c.discount_value}%` : `R$ ${c.discount_value.toFixed(2)}`}</td>
                                    <td className="px-4 py-3 text-muted-foreground font-numbers">{c.current_uses}{c.max_uses ? `/${c.max_uses}` : ""}</td>
                                    <td className="px-4 py-3">
                                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-display font-black", c.is_active ? "bg-success/10 text-success" : "bg-muted/10 text-muted-foreground")}>
                                        {c.is_active ? "Ativo" : "Inativo"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <EmptyCard icon={Tag} message="Nenhum cupom criado para este produto" />
                        )}

                        <p className="text-xs text-muted-foreground/50">Gerencie todos os seus cupons em <button onClick={() => navigate("/vendas/checkout")} className="text-primary hover:underline font-display font-bold">Checkout → Cupons</button>.</p>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "afiliados" && (
                  <div className="space-y-6">
                    <SectionHeader title="Programa de Afiliados" subtitle="Configure comissões e regras para afiliados." />

                    <ToggleRow label="Habilitar programa de afiliados" checked={affiliateEnabled} onChange={setAffiliateEnabled} />

                    {affiliateEnabled && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">Comissão (%)</Label>
                            <div className="flex items-center gap-2">
                              <Input type="number" min="1" max="80" value={affiliateCommission} onChange={(e) => setAffiliateCommission(e.target.value)} className="w-24 h-11 text-center font-numbers font-black text-lg tracking-[-0.03em]" />
                              <span className="text-lg font-display font-black text-muted-foreground">%</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">Atribuição</Label>
                            <Select value={affiliateAttribution} onValueChange={setAffiliateAttribution}>
                              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="last_click">Último clique (recomendado)</SelectItem>
                                <SelectItem value="first_click">Primeiro clique</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">Duração dos cookies</Label>
                          <Select value={affiliateCookieDays} onValueChange={setAffiliateCookieDays}>
                            <SelectTrigger className="h-11 w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">7 dias</SelectItem>
                              <SelectItem value="15">15 dias</SelectItem>
                              <SelectItem value="30">30 dias</SelectItem>
                              <SelectItem value="60">60 dias</SelectItem>
                              <SelectItem value="90">90 dias</SelectItem>
                              <SelectItem value="180">180 dias</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <ToggleRow label="Aprovar cada solicitação de afiliação manualmente" checked={affiliateApprovalManual} onChange={setAffiliateApprovalManual} />
                          <ToggleRow label="Recebe comissão de Upsell" checked={affiliateUpsellCommission} onChange={setAffiliateUpsellCommission} />
                          <ToggleRow label="Mostrar meu produto no marketplace público" checked={affiliateMarketplace} onChange={setAffiliateMarketplace} />
                          <ToggleRow label="Liberar acesso aos dados de contato dos compradores" checked={false} onChange={() => {}} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">E-mail de suporte para afiliados</Label>
                            <Input value={affiliateSupportEmail} onChange={(e) => setAffiliateSupportEmail(e.target.value)} placeholder="suporte@..." type="email" className="h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">Descrição para afiliados</Label>
                            <Textarea value={affiliateDescription} onChange={(e) => setAffiliateDescription(e.target.value)} rows={2} placeholder="Descreva os benefícios para afiliados..." className="resize-none" />
                          </div>
                        </div>

                        {!isNew && (
                          <div className="panel-enterprise-subtle p-4 space-y-3">
                            <h4 className="text-[15px] font-display font-black flex items-center gap-2 tracking-[-0.02em]"><UserPlus className="h-4 w-4 text-primary" /> Convidar afiliados</h4>
                            <p className="text-xs text-muted-foreground/60">Compartilhe esse link para convidar os seus afiliados:</p>
                            <div className="flex items-center gap-2">
                              <Input readOnly value={`${window.location.origin}/affiliate/invite/${productId?.slice(0, 8)}`} className="h-9 font-mono text-xs bg-muted/10" />
                              <Button variant="outline" size="sm" onClick={() => copyLink(`${window.location.origin}/affiliate/invite/${productId?.slice(0, 8)}`)} className="gap-1.5 h-9 shrink-0">
                                <Copy className="h-3.5 w-3.5" /> Copiar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "links" && (
                  <div className="space-y-6">
                    <SectionHeader title="Links de Venda" subtitle="Gerencie os links de checkout e vendas deste produto." />

                    {isNew ? (
                      <EmptyCard icon={Link2} message="Salve o produto primeiro para gerar links." />
                    ) : (
                      <div className="space-y-4">
                        {product?.checkout_url && (
                          <div className="panel-enterprise-subtle p-4 space-y-3">
                            <h4 className="text-[15px] font-display font-black flex items-center gap-2 tracking-[-0.02em]"><ShoppingCart className="h-4 w-4 text-primary" /> Link do Checkout</h4>
                            <div className="flex items-center gap-2">
                              <Input readOnly value={getCheckoutLink()} className="h-9 font-mono text-xs bg-muted/10" />
                              <Button variant="outline" size="sm" onClick={() => copyLink(getCheckoutLink())} className="gap-1.5 h-9 shrink-0">
                                <Copy className="h-3.5 w-3.5" /> Copiar
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => window.open(getCheckoutLink(), "_blank")} className="gap-1.5 h-9 shrink-0">
                                <Eye className="h-3.5 w-3.5" /> Abrir
                              </Button>
                            </div>
                          </div>
                        )}

                        {pageUrl && (
                          <div className="panel-enterprise-subtle p-4 space-y-3">
                            <h4 className="text-[15px] font-display font-black flex items-center gap-2 tracking-[-0.02em]"><Globe className="h-4 w-4 text-info" /> Página de Vendas</h4>
                            <div className="flex items-center gap-2">
                              <Input readOnly value={pageUrl} className="h-9 font-mono text-xs bg-muted/10" />
                              <Button variant="outline" size="sm" onClick={() => copyLink(pageUrl)} className="gap-1.5 h-9 shrink-0">
                                <Copy className="h-3.5 w-3.5" /> Copiar
                              </Button>
                            </div>
                          </div>
                        )}

                        {affiliateEnabled && (
                          <div className="panel-enterprise-subtle p-4 space-y-3">
                            <h4 className="text-[15px] font-display font-black flex items-center gap-2 tracking-[-0.02em]"><Users className="h-4 w-4 text-success" /> Link de Afiliado</h4>
                            <div className="flex items-center gap-2">
                              <Input readOnly value={`${window.location.origin}/affiliate/invite/${productId?.slice(0, 8)}`} className="h-9 font-mono text-xs bg-muted/10" />
                              <Button variant="outline" size="sm" onClick={() => copyLink(`${window.location.origin}/affiliate/invite/${productId?.slice(0, 8)}`)} className="gap-1.5 h-9 shrink-0">
                                <Copy className="h-3.5 w-3.5" /> Copiar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {!isNew && (
        <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border/40 z-40">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
            <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive gap-1.5 text-xs font-display font-bold">
              <Trash2 className="h-3.5 w-3.5" /> Excluir Produto
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl text-sm font-display font-black h-9 px-6 shadow-lg shadow-primary/20">
              <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar Produto"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3.5 mb-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-card/45 backdrop-blur-xl">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h2 className="text-[17px] font-display font-black text-foreground tracking-[-0.03em] leading-tight">{title}</h2>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyCard({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl flex flex-col items-center justify-center py-14 gap-3 shadow-[0_2px_12px_hsl(var(--foreground)/0.04)]">
      <div className="h-14 w-14 rounded-2xl bg-muted/10 flex items-center justify-center ring-1 ring-border/20">
        <Icon className="h-6 w-6 text-muted-foreground/25" />
      </div>
      <p className="text-sm font-display font-bold text-muted-foreground/50">{message}</p>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, sublabel, checked, onChange, children }: {
  icon?: React.ComponentType<{ className?: string }>; label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-xl border transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden",
      checked
        ? "border-primary/20 bg-card/60 shadow-sm"
        : "border-border/30 bg-card/20 hover:border-border/50"
    )}>
      {checked && <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />}
      <div className="flex items-center gap-3 flex-1">
        {Icon && (
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-all",
            checked ? "bg-primary/10 ring-1 ring-primary/20" : "bg-muted/10 ring-1 ring-border/20"
          )}>
            <Icon className={cn("h-3.5 w-3.5", checked ? "text-primary" : "text-muted-foreground/50")} />
          </div>
        )}
        <div>
          <p className="text-sm font-display font-bold text-foreground tracking-[-0.01em]">{label}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-medium">{sublabel}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

function PaymentMethodRow({ icon: Icon, label, sublabel, color, checked, onChange }: {
  icon: React.ComponentType<{ className?: string }>; label: string; sublabel?: string; color: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-xl border transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden",
      checked
        ? "bg-card/60 border-border/40 shadow-sm"
        : "bg-card/15 border-border/15 opacity-50"
    )}>
      {checked && <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", color === "text-success" ? "bg-success" : color === "text-warning" ? "bg-warning" : "bg-info")} />}
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
          checked ? "ring-1 ring-border/30" : "ring-1 ring-border/10",
          color === "text-success" ? "bg-success/10" : color === "text-warning" ? "bg-warning/10" : "bg-info/10"
        )}>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <div>
          <p className="text-sm font-display font-bold tracking-[-0.01em]">{label}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-numbers">{sublabel}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function BannerUpload({ label, preview, inputRef, onFile, onClear }: {
  label: string; preview: string; inputRef: React.RefObject<HTMLInputElement>; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/70">{label}</Label>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border/40 shadow-sm">
          <img src={preview} alt={label} className="w-full h-28 object-cover" />
          <button type="button" onClick={onClear} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-destructive">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="w-full h-24 rounded-xl border-2 border-dashed border-border/20 hover:border-primary/30 flex items-center justify-center gap-2 text-muted-foreground/40 hover:text-primary text-xs transition-all">
          <Upload className="h-4 w-4" /> Upload {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}
