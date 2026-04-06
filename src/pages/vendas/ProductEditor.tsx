import { useState, useRef, useEffect, useCallback } from "react";
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
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, Save, Package, DollarSign, ImagePlus, X, Settings, ShoppingCart,
  ArrowUpRight, Users, Handshake, Tag, Link2, Trash2, Plus, ExternalLink,
  CreditCard, QrCode, FileText, Mail, MapPin, Shield, Timer, Eye,
  Upload, CheckCircle2, Copy, Globe, Zap, Crosshair, Percent, Clock,
  Layers, UserPlus, Lock, Gift, BarChart3, Star, Palette, Sparkles,
  Check, ChevronRight, TrendingUp, MousePointerClick, GraduationCap, Video, Loader2,
  MessageSquare, Share2, Download, Smartphone, Monitor, AlertTriangle,
  RefreshCw, Hash, Target, Heart, Megaphone, Rocket, Award
} from "lucide-react";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type TabKey = "geral" | "configuracoes" | "conteudo" | "order-bump" | "upsell" | "checkout" | "co-producao" | "cupons" | "afiliados" | "links";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: "geral", label: "Geral", icon: Package, color: "primary" },
  { key: "configuracoes", label: "Configurações", icon: Settings, color: "info" },
  { key: "conteudo", label: "Conteúdo", icon: GraduationCap, color: "primary" },
  { key: "order-bump", label: "Order Bump", icon: Layers, color: "warning" },
  { key: "upsell", label: "Upsell / Downsell", icon: ArrowUpRight, color: "success" },
  { key: "checkout", label: "Checkout", icon: ShoppingCart, color: "primary" },
  { key: "co-producao", label: "Co-Produção", icon: Handshake, color: "info" },
  { key: "cupons", label: "Cupons", icon: Tag, color: "warning" },
  { key: "afiliados", label: "Afiliados", icon: Users, color: "success" },
  { key: "links", label: "Links", icon: Link2, color: "primary" },
];

/* ─── Completion Progress Ring ─── */
function CompletionRing({ percent }: { percent: number }) {
  const r = 16, c = 2 * Math.PI * r;
  const getColor = () => {
    if (percent >= 80) return "hsl(var(--success))";
    if (percent >= 50) return "hsl(var(--warning))";
    return "hsl(var(--primary))";
  };
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="hsl(var(--border)/0.15)" strokeWidth="2.5" />
        <motion.circle
          cx="20" cy="20" r={r} fill="none"
          stroke={getColor()}
          strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * percent / 100) }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 4px ${getColor()})` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-[9px] font-display font-black tabular-nums", percent >= 80 ? "text-success" : percent >= 50 ? "text-warning" : "text-primary")}>{percent}%</span>
      </div>
    </div>
  );
}

export default function ProductEditor() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const invalidateAll = useInvalidateAll();
  const isNew = productId === "novo";

  const [activeTab, setActiveTab] = useState<TabKey>("geral");
  const [saving, setSaving] = useState(false);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponType, setNewCouponType] = useState("percentage");
  const [newCouponValue, setNewCouponValue] = useState("");
  const [newCouponMaxUses, setNewCouponMaxUses] = useState("");
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  // Completion percentage
  const completionPercent = (() => {
    let score = 0, total = 8;
    if (name.trim()) score++;
    if (price && parseFloat(price) > 0) score++;
    if (description.trim().length >= 50) score++;
    if (imagePreview) score++;
    if (pageUrl) score++;
    if (supportEmail.trim()) score++;
    if (displayName.trim()) score++;
    if (status === "active") score++;
    return Math.round((score / total) * 100);
  })();

  const effectiveProductId = createdProductId || productId;
  const tabsLocked = isNew && !createdProductId;

  const tabCompleted = useCallback((key: TabKey): boolean => {
    switch (key) {
      case "geral": return !!(name && price && parseFloat(price) > 0);
      case "configuracoes": return true;
      case "checkout": return !isNew;
      case "links": return !isNew && !!product?.checkout_url;
      default: return false;
    }
  }, [name, price, isNew, product]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  useEffect(() => {
    if (isNew || !user?.id) { setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", productId!).eq("user_id", user.id).maybeSingle();
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
      setSupportEmail((data as any).support_email || "");
      setDisplayName((data as any).display_name || "");
      setDeliveryType((data as any).delivery_type || "digital");
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
    if (description.trim().length < 50) { toast.error("Descrição deve ter no mínimo 50 caracteres"); setActiveTab("geral"); return; }
    if (isNaN(priceNum) || priceNum < 1) { toast.error("Preço mínimo é R$ 1,00"); setActiveTab("geral"); return; }
    if (priceNum > 99999.99) { toast.error("Preço máximo é R$ 99.999,99"); setActiveTab("geral"); return; }
    if (!pageUrl.trim()) { toast.error("Página de vendas é obrigatória"); setActiveTab("geral"); return; }
    if (!supportEmail.trim()) { toast.error("E-mail de suporte é obrigatório"); setActiveTab("geral"); return; }
    if (!displayName.trim()) { toast.error("Nome de exibição é obrigatório"); setActiveTab("geral"); return; }

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
        support_email: supportEmail.trim() || null,
        display_name: displayName.trim() || null,
        delivery_type: deliveryType,
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

      if (isNew && !createdProductId) {
        const slug = crypto.randomUUID().slice(0, 8);
        const checkoutUrl = `${window.location.origin}/pay/${slug}`;
        const { data: newProduct, error } = await supabase.from("products").insert({ ...productData, user_id: user.id, checkout_url: checkoutUrl } as any).select("*").single();
        if (error || !newProduct) { toast.error("Erro ao criar produto"); return; }

        if (deliveryType === "digital") {
          await supabase.from("courses").insert({
            user_id: user.id,
            product_id: newProduct.id,
            title: name.trim(),
            description: description.trim() || null,
            is_published: false,
          } as any);
        }

        setCreatedProductId(newProduct.id);
        setProduct(newProduct as any);
        toast.success("Produto criado com sucesso! Continue configurando.");
        invalidateAll(["products", "courses"]);
        setActiveTab("configuracoes");
        window.history.replaceState(null, "", `/vendas/produtos/${newProduct.id}/editar`);
      } else {
        const { error } = await supabase.from("products").update(productData).eq("id", effectiveProductId!).eq("user_id", user.id);
        if (error) { toast.error("Erro ao salvar"); return; }

        if (deliveryType === "digital") {
          const { data: existingCourse } = await supabase.from("courses").select("id").eq("product_id", effectiveProductId!).eq("user_id", user.id).limit(1).maybeSingle();
          if (!existingCourse) {
            await supabase.from("courses").insert({
              user_id: user.id,
              product_id: effectiveProductId!,
              title: name.trim(),
              description: description.trim() || null,
              is_published: false,
            } as any);
          }
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        toast.success("Produto salvo!");
        invalidateAll(["products", "courses"]);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!user || tabsLocked) return;
    if (!window.confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("products").delete().eq("id", effectiveProductId!).eq("user_id", user.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Produto excluído");
    invalidateAll(["products"]);
    navigate("/vendas/produtos");
  };

  const handleDuplicate = async () => {
    if (!user || tabsLocked || !product) return;
    const slug = crypto.randomUUID().slice(0, 8);
    const checkoutUrl = `${window.location.origin}/pay/${slug}`;
    const { error } = await supabase.from("products").insert({
      user_id: user.id,
      name: `${product.name} (cópia)`,
      description: product.description,
      price: product.price,
      status: "pending_review",
      page_url: product.page_url,
      image_url: product.image_url,
      support_email: product.support_email,
      display_name: product.display_name,
      delivery_type: product.delivery_type,
      checkout_url: checkoutUrl,
      checkout_button_color: product.checkout_button_color,
      checkout_timer_enabled: product.checkout_timer_enabled,
      checkout_timer_minutes: product.checkout_timer_minutes,
      checkout_social_proof: product.checkout_social_proof,
      checkout_guarantee_enabled: product.checkout_guarantee_enabled,
      checkout_pix_enabled: product.checkout_pix_enabled,
      checkout_boleto_enabled: product.checkout_boleto_enabled,
      checkout_credit_card_enabled: product.checkout_credit_card_enabled,
      checkout_address_required: product.checkout_address_required,
      checkout_email_confirm: product.checkout_email_confirm,
      affiliate_enabled: product.affiliate_enabled,
      affiliate_commission: product.affiliate_commission,
    } as any).select("id").single();
    if (error) { toast.error("Erro ao duplicar"); return; }
    toast.success("Produto duplicado com sucesso!");
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Formato inválido"); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error("Máximo 10MB"); return; }
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
  }, []);

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

  const createCoupon = async () => {
    if (!user || isNew || !newCouponCode.trim()) return;
    const val = parseFloat(newCouponValue);
    if (isNaN(val) || val <= 0) { toast.error("Valor inválido"); return; }
    if (newCouponType === "percentage" && val > 100) { toast.error("Percentual máximo é 100%"); return; }
    setCreatingCoupon(true);
    try {
      const { data, error } = await supabase.from("coupons").insert({
        code: newCouponCode.trim().toUpperCase(),
        discount_type: newCouponType,
        discount_value: val,
        max_uses: newCouponMaxUses ? parseInt(newCouponMaxUses) : null,
        product_id: productId!,
        user_id: user.id,
        is_active: true,
      }).select().single();
      if (error) {
        if (error.code === "23505") toast.error("Código já existe");
        else toast.error("Erro ao criar cupom");
        return;
      }
      if (data) setCoupons(prev => [data, ...prev]);
      setNewCouponCode(""); setNewCouponValue(""); setNewCouponMaxUses("");
      toast.success("Cupom criado!");
    } finally { setCreatingCoupon(false); }
  };

  const toggleCoupon = async (coupon: Tables<"coupons">) => {
    const { error } = await supabase.from("coupons").update({ is_active: !coupon.is_active }).eq("id", coupon.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
  };

  const deleteCoupon = async (id: string) => {
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setCoupons(prev => prev.filter(c => c.id !== id));
    toast.success("Cupom excluído");
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
      <div className="h-[100dvh] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="h-12 w-12 border-2 border-border/20 border-t-primary rounded-full"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary/60" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-display font-bold text-foreground">Carregando produto</p>
            <p className="text-xs text-muted-foreground">Preparando editor...</p>
          </div>
        </div>
      </div>
    );
  }

  const availableForBump = allProducts.filter(p => !orderBumps.some(b => b.bump_product_id === p.id));
  const currentTabIdx = TABS.findIndex(t => t.key === activeTab);

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* ───── Progress Bar (Top) ───── */}
      <div className="shrink-0 h-[2px] bg-border/20 relative z-[60]">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${completionPercent}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* ───── Top Bar ───── */}
      <div className="shrink-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14 sm:h-[60px]">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/vendas/produtos")} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-card/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all active:scale-95">
              <ArrowLeft className="h-4 w-4" />
            </button>

            {/* Product chip */}
            {name && (
              <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-muted/20 border border-border/30">
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="h-6 w-6 rounded-md object-cover border border-border/20" />
                ) : (
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Package className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-foreground truncate max-w-[180px] leading-tight">{name}</p>
                  {price && (
                    <p className="text-[10px] font-numbers font-bold text-primary leading-tight flex items-center gap-1">
                      R$ {Number(price).toFixed(2)}
                      <span className={cn("h-1.5 w-1.5 rounded-full", status === "active" ? "bg-success animate-pulse" : "bg-muted-foreground/30")} />
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Step dots */}
            <div className="hidden lg:flex items-center gap-1 px-3 py-2 rounded-lg bg-muted/15 border border-border/20">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const locked = tab.key !== "geral" && tabsLocked;
                return (
                  <div
                    key={tab.key}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      isActive ? "w-5 bg-primary" : locked ? "w-1.5 bg-muted-foreground/10" : "w-1.5 bg-muted-foreground/25"
                    )}
                    title={tab.label}
                  />
                );
              })}
            </div>

            {/* Completion */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/15 border border-border/20">
              <CompletionRing percent={completionPercent} />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Completo</p>
                <p className="text-[11px] font-numbers font-bold text-foreground tabular-nums">{completionPercent}%</p>
              </div>
            </div>

            <div className="h-5 w-px bg-border/20 hidden sm:block" />

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              {!tabsLocked && (
                <>
                  <Button variant="ghost" size="sm" onClick={handleDuplicate} className="text-muted-foreground gap-1.5 text-xs rounded-lg h-8 hidden sm:flex">
                    <Copy className="h-3 w-3" /> <span className="hidden lg:inline">Duplicar</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive/60 hover:text-destructive hover:bg-destructive/5 h-8 rounded-lg hidden sm:flex">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
              <Button onClick={handleSave} disabled={saving} size="sm" className={cn(
                "gap-1.5 rounded-lg text-xs font-bold h-8 px-4 transition-all",
                saved ? "bg-success hover:bg-success" : ""
              )}>
                {saved ? (
                  <><Check className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Salvo!</span></>
                ) : saving ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> <span className="hidden sm:inline">Salvando...</span></>
                ) : (
                  <><Save className="h-3 w-3" /> {isNew ? "Criar" : "Salvar"}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ───── Main Area ───── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 w-full flex gap-6 py-5 min-h-0">

          {/* ───── Sidebar ───── */}
          <nav className="hidden lg:flex flex-col w-56 shrink-0 overflow-y-auto overscroll-contain pb-6 scrollbar-none">
            <div className="rounded-xl border border-border/40 bg-card/60 p-2 space-y-0.5">
              <div className="px-3 py-2 mb-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Navegação</p>
              </div>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const completed = tabCompleted(tab.key);
                const locked = tab.key !== "geral" && tabsLocked;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      if (locked) { toast.error("Preencha e salve a aba Geral primeiro"); return; }
                      setActiveTab(tab.key);
                    }}
                    disabled={locked}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all text-left relative",
                      locked
                        ? "opacity-35 cursor-not-allowed text-muted-foreground"
                        : isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                    )}
                  >
                    {isActive && (
                      <motion.div layoutId="sidebar-accent" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                    )}
                    {locked ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <tab.icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "")} />}
                    <span className="truncate">{tab.label}</span>
                    {completed && !isActive && !locked && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-success/60 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick info */}
            {!tabsLocked && product?.checkout_url && (
              <div className="mt-3 rounded-xl border border-border/30 bg-card/40 p-3 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Checkout</p>
                <Button
                  variant="outline" size="sm"
                  onClick={() => copyLink(getCheckoutLink())}
                  className="w-full gap-1.5 h-8 text-[11px] rounded-lg"
                >
                  <Copy className="h-3 w-3" /> Copiar Link
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => navigate(`/vendas/produtos/${effectiveProductId}/checkout-builder`)}
                  className="w-full gap-1.5 h-8 text-[11px] rounded-lg"
                >
                  <Palette className="h-3 w-3" /> Checkout Builder
                </Button>
              </div>
            )}
          </nav>

          {/* ── Mobile Tab Bar ── */}
          <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card/95 backdrop-blur-xl border-t border-border/40 safe-area-bottom">
            <div className="flex overflow-x-auto gap-0.5 px-2 py-1.5 scrollbar-none">
              {TABS.map(tab => {
                const locked = tab.key !== "geral" && tabsLocked;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      if (locked) { toast.error("Salve a aba Geral primeiro"); return; }
                      setActiveTab(tab.key);
                    }}
                    disabled={locked}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold whitespace-nowrap transition-all min-w-[50px]",
                      locked ? "opacity-30 text-muted-foreground" :
                      activeTab === tab.key ? "bg-primary/10 text-primary" : "text-muted-foreground/50"
                    )}
                  >
                    {locked ? <Lock className="h-3.5 w-3.5" /> : <tab.icon className="h-3.5 w-3.5" />}
                    <span className="truncate max-w-[48px]">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ───── Content Area ───── */}
          <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto pb-28 sm:pb-24 lg:pb-6 overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeTab === "geral" && <TabGeral
                  {...{ name, setName, description, setDescription, price, setPrice, status, setStatus, pageUrl, setPageUrl, imagePreview, setImagePreview, imageFile, setImageFile, fileInputRef, handleFileChange, category, setCategory, paymentType, setPaymentType, displayName, setDisplayName, supportEmail, setSupportEmail, warrantyDays, setWarrantyDays, isDragging, setIsDragging, handleDrop }}
                />}

                {activeTab === "configuracoes" && <TabConfiguracoes
                  {...{ price, pixEnabled, setPixEnabled, boletoEnabled, setBoletoEnabled, creditCardEnabled, setCreditCardEnabled, emailConfirm, setEmailConfirm, showCouponField, setShowCouponField, addressRequired, setAddressRequired, deliveryType, setDeliveryType }}
                />}

                {activeTab === "conteudo" && <TabConteudo productId={effectiveProductId} isNew={tabsLocked} />}

                {activeTab === "order-bump" && <TabOrderBump
                  {...{ isNew: tabsLocked, orderBumps, allProducts, availableForBump, selectedBumpProduct, setSelectedBumpProduct, addBump, removeBump }}
                />}

                {activeTab === "upsell" && <TabUpsell
                  {...{ hasCustomThankYou, setHasCustomThankYou, thankYouUrl, setThankYouUrl, sendConfirmationEmail, setSendConfirmationEmail, emailTiming, setEmailTiming }}
                />}

                {activeTab === "checkout" && <TabCheckout
                  {...{ isNew: tabsLocked, name, price, productId: effectiveProductId, buttonColor, setButtonColor, timerEnabled, setTimerEnabled, timerMinutes, setTimerMinutes, socialProof, setSocialProof, guaranteeEnabled, setGuaranteeEnabled, warrantyDays, bannerDesktopPreview, bannerMobilePreview, desktopBannerRef, mobileBannerRef, handleBannerFile, setBannerDesktopFile, setBannerDesktopPreview, setBannerMobileFile, setBannerMobilePreview, getCheckoutLink, copyLink, navigate, pixEnabled, boletoEnabled, creditCardEnabled }}
                />}

                {activeTab === "co-producao" && <TabCoProducao
                  {...{ isNew: tabsLocked, coProducerEmail, setCoProducerEmail, coProductionSplit, setCoProductionSplit, coProductionDuration, setCoProductionDuration, coProductionSalesType, setCoProductionSalesType }}
                />}

                {activeTab === "cupons" && <TabCupons
                  {...{ isNew: tabsLocked, coupons, newCouponCode, setNewCouponCode, newCouponType, setNewCouponType, newCouponValue, setNewCouponValue, newCouponMaxUses, setNewCouponMaxUses, creatingCoupon, createCoupon, toggleCoupon, deleteCoupon }}
                />}

                {activeTab === "afiliados" && <TabAfiliados
                  {...{ isNew: tabsLocked, productId: effectiveProductId, affiliateEnabled, setAffiliateEnabled, affiliateCommission, setAffiliateCommission, affiliateAttribution, setAffiliateAttribution, affiliateCookieDays, setAffiliateCookieDays, affiliateApprovalManual, setAffiliateApprovalManual, affiliateUpsellCommission, setAffiliateUpsellCommission, affiliateMarketplace, setAffiliateMarketplace, affiliateSupportEmail, setAffiliateSupportEmail, affiliateDescription, setAffiliateDescription, copyLink }}
                />}

                {activeTab === "links" && <TabLinks
                  {...{ isNew: tabsLocked, product, pageUrl, affiliateEnabled, productId: effectiveProductId, getCheckoutLink, copyLink, name, price }}
                />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB COMPONENTS
   ═══════════════════════════════════════════════ */

function TabGeral({ name, setName, description, setDescription, price, setPrice, status, setStatus, pageUrl, setPageUrl, imagePreview, setImagePreview, imageFile, setImageFile, fileInputRef, handleFileChange, category, setCategory, paymentType, setPaymentType, displayName, setDisplayName, supportEmail, setSupportEmail, warrantyDays, setWarrantyDays, isDragging, setIsDragging, handleDrop }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Package} title="Informações do Produto" subtitle="Dados principais exibidos na área de membros e programa de afiliados." />

      {/* ─── Interactive Image Upload with Drag & Drop ─── */}
      <div
        className={cn(
          "rounded-2xl border-2 border-dashed overflow-hidden transition-all duration-300 relative",
          isDragging ? "border-primary/50 bg-primary/5 scale-[1.01]" : "border-border/30 bg-card/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />

        {imagePreview ? (
          <div className="relative group/img">
            <img src={imagePreview} alt="Preview" className="w-full h-56 object-cover" />
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm opacity-0 group-hover/img:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button" onClick={() => fileInputRef.current?.click()} className="h-11 w-11 rounded-xl bg-card/90 border border-border/30 flex items-center justify-center hover:bg-primary/10 hover:border-primary/20 transition-all shadow-lg">
                <ImagePlus className="h-4 w-4 text-foreground" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="h-11 w-11 rounded-xl bg-card/90 border border-border/30 flex items-center justify-center text-destructive hover:bg-destructive/10 hover:border-destructive/20 transition-all shadow-lg">
                <X className="h-4 w-4" />
              </motion.button>
            </div>
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/80 backdrop-blur-xl border border-border/20 shadow-lg">
              <CheckCircle2 className="h-3 w-3 text-success" />
              <span className="text-[10px] font-display font-bold text-foreground">Imagem adicionada</span>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-48 flex flex-col items-center justify-center gap-4 text-muted-foreground/40 hover:text-primary/60 transition-all group/upload hover:bg-primary/[0.02]">
            <motion.div
              animate={isDragging ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
              className="h-16 w-16 rounded-2xl bg-muted/10 group-hover/upload:bg-primary/10 flex items-center justify-center transition-colors border border-dashed border-border/30 group-hover/upload:border-primary/20"
            >
              <Upload className="h-7 w-7" />
            </motion.div>
            <div className="text-center space-y-1">
              <span className="text-sm font-display font-bold block">{isDragging ? "Solte a imagem aqui" : "Arraste ou clique para enviar"}</span>
              <span className="text-[10px] text-muted-foreground/30 block">JPG, PNG, WebP, GIF • Máx: 10MB • Recomendado: 300×250px</span>
            </div>
          </button>
        )}
      </div>

      {/* ─── Product Details ─── */}
      <EditorCard accentColor="bg-primary">
        <div className="space-y-2">
          <EditorLabel icon={Package}>Nome do produto</EditorLabel>
          <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Ex: Curso Completo de Marketing Digital" className="h-11 bg-card/80 border-border/40 focus-visible:border-primary/40 text-base font-display font-bold" required maxLength={200} />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/30">{name.length > 0 ? "✓ Nome preenchido" : "Obrigatório"}</p>
            <p className="text-[10px] text-muted-foreground/30 font-numbers tabular-nums">{name.length}/200</p>
          </div>
        </div>

        <div className="space-y-2">
          <EditorLabel>Descrição <span className="text-destructive">*</span></EditorLabel>
          <Textarea value={description} onChange={(e: any) => setDescription(e.target.value)} rows={4} placeholder="Descreva seu produto em detalhes (mínimo 50 caracteres)..." className={cn("resize-none bg-card/80 border-border/40", description.length > 0 && description.length < 50 && "border-destructive/40")} maxLength={2000} />
          <div className="flex items-center justify-between">
            <p className={cn("text-[10px]", description.length >= 50 ? "text-success" : description.length > 0 ? "text-destructive" : "text-muted-foreground/30")}>
              {description.length >= 50 ? "✓ Descrição válida" : description.length > 0 ? `Faltam ${50 - description.length} caracteres (mín. 50)` : "Obrigatório • Mínimo 50 caracteres"}
            </p>
            <p className="text-[10px] text-muted-foreground/40 text-right font-numbers tabular-nums">{description.length}/2000</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <EditorLabel>Categoria</EditorLabel>
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
            <EditorLabel>Tipo de pagamento</EditorLabel>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger className="h-11 bg-card/80 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unico">Único</SelectItem>
                <SelectItem value="assinatura">Assinatura</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </EditorCard>

      {/* ─── Interactive Pricing Card ─── */}
      <EditorCard accentColor="bg-success">
        <div className="flex items-center justify-between">
          <EditorLabel icon={DollarSign}>Preço</EditorLabel>
          <div className="flex items-center gap-2">
            <EditorLabel icon={Shield}>Garantia</EditorLabel>
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

        <div className="space-y-5">
          <div className="space-y-1.5">
            <span className="text-[10px] font-display font-bold text-muted-foreground/50 uppercase tracking-wider">Preço principal</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-display font-bold text-muted-foreground">R$</span>
              <Input type="number" step="0.01" min="1" max="99999.99" value={price} onChange={(e: any) => setPrice(e.target.value)} className="h-14 pl-10 text-2xl font-numbers font-black tracking-[-0.03em] bg-card/80 border-border/40" placeholder="0.00" />
            </div>
          </div>

          {/* Revenue estimate */}
          {price && parseFloat(price) > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-success/5 border border-success/15 p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0 ring-1 ring-success/20">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-[10px] font-display font-bold text-muted-foreground/60 uppercase tracking-wider">Estimativa de receita (100 vendas)</p>
                <p className="text-sm font-numbers font-black text-success">R$ {(parseFloat(price) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            </motion.div>
          )}
        </div>
      </EditorCard>

      {/* ─── Links & Support (Required) ─── */}
      <EditorCard accentColor="bg-info">
        <SectionHeader icon={Globe} title="Informações do Produtor" subtitle="Esses dados são obrigatórios e serão exibidos no checkout." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <EditorLabel icon={ExternalLink}>Página de vendas <span className="text-destructive">*</span></EditorLabel>
            <Input value={pageUrl} onChange={(e: any) => setPageUrl(e.target.value)} placeholder="https://..." type="url" className="h-11 bg-card/80 border-border/40" required />
            <p className={cn("text-[10px]", pageUrl.trim() ? "text-success" : "text-muted-foreground/30")}>{pageUrl.trim() ? "✓ Página preenchida" : "Obrigatório"}</p>
          </div>
          <div className="space-y-2">
            <EditorLabel icon={Mail}>E-mail de suporte <span className="text-destructive">*</span></EditorLabel>
            <Input value={supportEmail} onChange={(e: any) => setSupportEmail(e.target.value)} placeholder="suporte@seuproduto.com" type="email" className="h-11 bg-card/80 border-border/40" required />
            <p className={cn("text-[10px]", supportEmail.trim() ? "text-success" : "text-muted-foreground/30")}>{supportEmail.trim() ? "✓ E-mail preenchido" : "Obrigatório"}</p>
          </div>
        </div>
        <div className="space-y-2">
          <EditorLabel icon={Users}>Nome de exibição do produtor <span className="text-destructive">*</span></EditorLabel>
          <Input value={displayName} onChange={(e: any) => setDisplayName(e.target.value)} placeholder="Nome exibido ao comprador no checkout" className="h-11 bg-card/80 border-border/40" required />
          <p className={cn("text-[10px]", displayName.trim() ? "text-success" : "text-muted-foreground/30")}>{displayName.trim() ? "✓ Nome preenchido" : "Obrigatório • Aparecerá no rodapé do checkout"}</p>
        </div>
      </EditorCard>

      {/* ─── SEO Preview Card ─── */}
      {name && (
        <EditorCard accentColor="bg-warning">
          <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2 tracking-[-0.02em]">
            <Eye className="h-4 w-4 text-warning" /> Pré-visualização (Google)
          </h3>
          <div className="rounded-xl border border-border/30 bg-card/30 p-4 space-y-1">
            <p className="text-[13px] text-info font-medium truncate">{pageUrl || "https://seusite.com/produto"}</p>
            <p className="text-base text-primary font-display font-bold truncate">{name || "Nome do Produto"}{price ? ` — R$ ${Number(price).toFixed(2)}` : ""}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{description.slice(0, 160) || "Descrição do produto aparecerá aqui..."}</p>
          </div>
        </EditorCard>
      )}
    </div>
  );
}

function TabConfiguracoes({ price, pixEnabled, setPixEnabled, boletoEnabled, setBoletoEnabled, creditCardEnabled, setCreditCardEnabled, emailConfirm, setEmailConfirm, showCouponField, setShowCouponField, addressRequired, setAddressRequired, deliveryType, setDeliveryType }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Settings} title="Configurações" subtitle="Métodos de pagamento, formulário e entrega de conteúdo." />

      <EditorCard accentColor="bg-primary">
        <h3 className="text-[15px] font-display font-black text-foreground tracking-[-0.02em] flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Métodos de pagamento
        </h3>
        <div className="space-y-2">
          <PaymentMethodRow icon={QrCode} label="PIX" sublabel="Taxa: 2,49% • Aprovação imediata" color="text-success" checked={pixEnabled} onChange={setPixEnabled} />
          <PaymentMethodRow icon={FileText} label="Boleto" sublabel="Taxa: 2,49% + R$ 2,49" color="text-warning" checked={boletoEnabled} onChange={setBoletoEnabled} />
          <PaymentMethodRow icon={CreditCard} label="Cartão de Crédito" sublabel="Taxa: 6,38% • Até 12x" color="text-info" checked={creditCardEnabled} onChange={setCreditCardEnabled} />
        </div>

        {/* Payment summary */}
        {price && parseFloat(price) > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-muted/5 border border-border/20 p-3 space-y-2">
            <p className="text-[9px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/40">Simulação de taxas (R$ {Number(price).toFixed(2)})</p>
            <div className="grid grid-cols-3 gap-3">
              {pixEnabled && (
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground/50">PIX</p>
                  <p className="text-xs font-numbers font-black text-success">R$ {(parseFloat(price) * 0.9751).toFixed(2)}</p>
                  <p className="text-[9px] text-muted-foreground/30">líquido</p>
                </div>
              )}
              {boletoEnabled && (
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground/50">Boleto</p>
                  <p className="text-xs font-numbers font-black text-warning">R$ {(parseFloat(price) * 0.9751 - 2.49).toFixed(2)}</p>
                  <p className="text-[9px] text-muted-foreground/30">líquido</p>
                </div>
              )}
              {creditCardEnabled && (
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground/50">Cartão</p>
                  <p className="text-xs font-numbers font-black text-info">R$ {(parseFloat(price) * 0.9362).toFixed(2)}</p>
                  <p className="text-[9px] text-muted-foreground/30">líquido</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </EditorCard>

      <EditorCard accentColor="bg-info">
        <h3 className="text-[15px] font-display font-black text-foreground tracking-[-0.02em]">Configurações do formulário</h3>
        <div className="space-y-2">
          <ToggleRow label="Pedir para o comprador repetir o e-mail" checked={emailConfirm} onChange={setEmailConfirm} />
          <ToggleRow label="Exibir campo de cupom de desconto" checked={showCouponField} onChange={setShowCouponField} />
          <ToggleRow label="Solicitar endereço do comprador" sublabel="CEP com preenchimento automático" checked={addressRequired} onChange={setAddressRequired} />
        </div>
      </EditorCard>

      <EditorCard accentColor="bg-success">
        <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2 tracking-[-0.02em]"><Globe className="h-4 w-4 text-success" /> Entrega de conteúdo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { value: "digital", label: "Área de Membros", desc: "Plataforma integrada com player e módulos", icon: Star },
            { value: "email", label: "Acesso por e-mail", desc: "Links e arquivos enviados por e-mail", icon: Mail },
            { value: "link", label: "Link de pagamento", desc: "Apenas receba pagamentos", icon: Link2 },
            { value: "external", label: "Área externa", desc: "Plataforma de terceiros", icon: ExternalLink },
          ].map((opt) => (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => setDeliveryType(opt.value)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden",
                deliveryType === opt.value
                  ? "bg-primary/5 border-primary/20 shadow-sm"
                  : "bg-card/30 border-border/20 hover:border-border/40"
              )}
            >
              {deliveryType === opt.value && <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />}
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ring-1 transition-all", deliveryType === opt.value ? "bg-primary/10 ring-primary/20" : "bg-muted/10 ring-border/20")}>
                <opt.icon className={cn("h-4 w-4", deliveryType === opt.value ? "text-primary" : "text-muted-foreground/40")} />
              </div>
              <div>
                <p className="text-sm font-display font-bold text-foreground">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{opt.desc}</p>
              </div>
              {deliveryType === opt.value && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2">
                  <div className="h-5 w-5 rounded-full bg-primary/15 ring-1 ring-primary/25 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </EditorCard>
    </div>
  );
}

function TabOrderBump({ isNew, orderBumps, allProducts, availableForBump, selectedBumpProduct, setSelectedBumpProduct, addBump, removeBump }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Layers} title="Order Bump" subtitle="Adicione produtos complementares que aparecem como oferta no checkout." />

      {/* How it works */}
      <EditorCard accentColor="bg-info">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-info/10 ring-1 ring-info/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-info" />
          </div>
          <div>
            <p className="text-sm font-display font-bold text-foreground">Como funciona?</p>
            <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">
              Order bumps são ofertas extras que aparecem no checkout antes da compra. O comprador pode adicionar com apenas um clique, aumentando seu ticket médio em até 30%.
            </p>
          </div>
        </div>
      </EditorCard>

      {isNew ? (
        <EmptyCard icon={Layers} message="Salve o produto primeiro para configurar Order Bumps." />
      ) : (
        <>
          {orderBumps.length > 0 ? (
            <div className="space-y-2">
              {orderBumps.map((bump: any, i: number) => {
                const prod = allProducts.find((p: any) => p.id === bump.bump_product_id);
                return (
                  <motion.div
                    key={bump.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl shadow-[0_2px_12px_hsl(var(--foreground)/0.04)] p-4 relative overflow-hidden group/bump hover:border-primary/20 transition-all"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-warning" />
                    <div className="flex items-center gap-3 min-w-0 flex-1 pl-1">
                      {prod?.image_url ? (
                        <img src={prod.image_url} alt={prod.name} className="h-11 w-11 rounded-xl object-cover ring-1 ring-border/20 shrink-0" />
                      ) : (
                        <div className="h-11 w-11 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-display font-bold truncate">{prod?.name || "Produto"}</p>
                        <p className="text-xs text-primary font-numbers font-black">R$ {Number(prod?.price || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeBump(bump.id)} className="text-destructive hover:text-destructive h-9 w-9 p-0 rounded-xl opacity-50 group-hover/bump:opacity-100 transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <EmptyCard icon={Layers} message="Nenhum bump adicionado" />
          )}

          {availableForBump.length > 0 && orderBumps.length < 5 && (
            <div className="flex gap-2">
              <Select value={selectedBumpProduct} onValueChange={setSelectedBumpProduct}>
                <SelectTrigger className="flex-1 h-10 bg-card/80 border-border/40"><SelectValue placeholder="Selecione um produto..." /></SelectTrigger>
                <SelectContent>
                  {availableForBump.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addBump} disabled={!selectedBumpProduct} className="gap-1.5 rounded-xl"><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground/40 text-right font-numbers tabular-nums">{orderBumps.length}/5</p>
        </>
      )}
    </div>
  );
}

function TabUpsell({ hasCustomThankYou, setHasCustomThankYou, thankYouUrl, setThankYouUrl, sendConfirmationEmail, setSendConfirmationEmail, emailTiming, setEmailTiming }: any) {
  const [upsellType, setUpsellType] = useState("none");
  const [downsellEnabled, setDownsellEnabled] = useState(false);
  const [downsellUrl, setDownsellUrl] = useState("");
  const [downsellDelay, setDownsellDelay] = useState("5");

  return (
    <div className="space-y-6">
      <SectionHeader icon={ArrowUpRight} title="Upsell / Downsell" subtitle="Maximize o valor de cada venda com ofertas pós-compra inteligentes." />

      {/* Strategy info */}
      <EditorCard accentColor="bg-success">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-success/10 ring-1 ring-success/20 flex items-center justify-center shrink-0">
            <Rocket className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-sm font-display font-bold text-foreground">Aumente seu LTV</p>
            <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">
              Vendedores que usam upsell aumentam o valor médio por cliente em até 40%. Configure sua estratégia de pós-venda para maximizar a receita.
            </p>
          </div>
        </div>
      </EditorCard>

      {/* Upsell Type Selection */}
      <EditorCard accentColor="bg-primary">
        <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2 tracking-[-0.02em]">
          <Target className="h-4 w-4 text-primary" /> Tipo de Upsell
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { value: "none", label: "Sem Upsell", desc: "Redirecionar para obrigado padrão", icon: Check },
            { value: "page", label: "Página Custom", desc: "Redirecionar para URL personalizada", icon: ExternalLink },
            { value: "popup", label: "Popup Upsell", desc: "Exibir oferta em popup na página", icon: Sparkles },
          ].map((opt) => (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => { setUpsellType(opt.value); if (opt.value !== "none") setHasCustomThankYou(opt.value === "page"); }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden",
                upsellType === opt.value
                  ? "bg-primary/5 border-primary/20 shadow-sm"
                  : "bg-card/30 border-border/20 hover:border-border/40"
              )}
            >
              {upsellType === opt.value && <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />}
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center ring-1 transition-all", upsellType === opt.value ? "bg-primary/10 ring-primary/20" : "bg-muted/10 ring-border/20")}>
                <opt.icon className={cn("h-4 w-4", upsellType === opt.value ? "text-primary" : "text-muted-foreground/40")} />
              </div>
              <p className="text-xs font-display font-bold text-foreground">{opt.label}</p>
              <p className="text-[9px] text-muted-foreground/50">{opt.desc}</p>
            </motion.button>
          ))}
        </div>
      </EditorCard>

      {/* Custom Thank You URL */}
      <AnimatePresence>
        {(upsellType === "page" || hasCustomThankYou) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <EditorCard accentColor="bg-warning">
              <h4 className="text-[15px] font-display font-black flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-warning" /> Página de obrigado / upsell
              </h4>
              <div className="space-y-2">
                <EditorLabel>URL da página</EditorLabel>
                <Input value={thankYouUrl} onChange={(e: any) => setThankYouUrl(e.target.value)} placeholder="https://seusite.com/obrigado" type="url" className="h-11 bg-card/80 border-border/40" />
                <p className="text-[10px] text-muted-foreground/40">O comprador será redirecionado para esta URL após a compra</p>
              </div>
            </EditorCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Downsell */}
      <EditorCard accentColor="bg-info">
        <ToggleRow icon={ArrowUpRight} label="Downsell (oferta de recuperação)" sublabel="Se o comprador recusar o upsell, exiba uma oferta com desconto" checked={downsellEnabled} onChange={setDownsellEnabled} />
        <AnimatePresence>
          {downsellEnabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-4 pt-2">
              <div className="space-y-2 pl-4 border-l-2 border-info/20">
                <EditorLabel>URL da oferta downsell</EditorLabel>
                <Input value={downsellUrl} onChange={(e: any) => setDownsellUrl(e.target.value)} placeholder="https://..." type="url" className="h-11 bg-card/80 border-border/40" />
              </div>
              <div className="space-y-2 pl-4 border-l-2 border-info/20">
                <EditorLabel icon={Timer}>Delay antes de exibir (segundos)</EditorLabel>
                <Input type="number" min="0" max="30" value={downsellDelay} onChange={(e: any) => setDownsellDelay(e.target.value)} className="w-24 h-10 text-center font-numbers bg-card/80 border-border/40" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </EditorCard>

      {/* Email confirmation */}
      <EditorCard accentColor="bg-success">
        <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2 tracking-[-0.02em]">
          <Mail className="h-4 w-4 text-success" /> E-mail pós-compra
        </h3>
        <ToggleRow icon={Mail} label="Enviar e-mail de confirmação" checked={sendConfirmationEmail} onChange={setSendConfirmationEmail} />
        <AnimatePresence>
          {sendConfirmationEmail && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="space-y-3 pl-4 border-l-2 border-success/20">
                {[
                  { val: "immediate", label: "Enviar imediatamente após o pagamento", icon: Zap },
                  { val: "after_upsell", label: "Enviar após concluir as ofertas de upsell", icon: Clock },
                ].map(opt => (
                  <label key={opt.val} className={cn(
                    "flex items-center gap-3 cursor-pointer rounded-xl p-3 border transition-all",
                    emailTiming === opt.val ? "border-primary/20 bg-primary/5" : "border-transparent hover:bg-muted/10"
                  )}>
                    <div className={cn(
                      "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all",
                      emailTiming === opt.val ? "border-primary" : "border-muted-foreground/30"
                    )}>
                      {emailTiming === opt.val && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <opt.icon className={cn("h-3.5 w-3.5", emailTiming === opt.val ? "text-primary" : "text-muted-foreground/40")} />
                    <span className="text-sm font-display font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </EditorCard>
    </div>
  );
}

function TabCheckout({ isNew, name, price, productId, buttonColor, setButtonColor, timerEnabled, setTimerEnabled, timerMinutes, setTimerMinutes, socialProof, setSocialProof, guaranteeEnabled, setGuaranteeEnabled, warrantyDays, bannerDesktopPreview, bannerMobilePreview, desktopBannerRef, mobileBannerRef, handleBannerFile, setBannerDesktopFile, setBannerDesktopPreview, setBannerMobileFile, setBannerMobilePreview, getCheckoutLink, copyLink, navigate, pixEnabled, boletoEnabled, creditCardEnabled }: any) {
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="space-y-6">
      <SectionHeader icon={ShoppingCart} title="Checkout" subtitle="Gerencie e personalize seus checkouts." />
      {isNew ? (
        <EmptyCard icon={ShoppingCart} message="Salve o produto primeiro para personalizar o checkout." />
      ) : (
        <>
          {/* Checkout Quick Actions Card */}
          <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl shadow-[0_2px_12px_hsl(var(--foreground)/0.04)] overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[15px] font-display font-black text-foreground">Checkout Padrão</p>
                  <p className="text-sm font-numbers font-black text-primary">R$ {Number(price || 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/vendas/produtos/${productId}/checkout-builder`)} className="h-9 text-xs gap-1.5 rounded-xl font-display font-bold">
                  <Palette className="h-3.5 w-3.5" /> Personalizar
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyLink(getCheckoutLink())} className="h-9 text-xs gap-1.5 rounded-xl font-display font-bold">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(getCheckoutLink(), "_blank")} className="h-9 text-xs gap-1.5 rounded-xl font-display font-bold">
                  <Eye className="h-3.5 w-3.5" /> Abrir
                </Button>
              </div>
            </div>
          </div>

          {/* Live Mini Preview */}
          <EditorCard accentColor="bg-primary">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> Pré-visualização
              </h3>
              <div className="flex items-center gap-1 rounded-lg border border-border/30 bg-card/30 p-0.5">
                <button
                  onClick={() => setPreviewDevice("desktop")}
                  className={cn("h-7 w-7 rounded-md flex items-center justify-center transition-all", previewDevice === "desktop" ? "bg-primary/10 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground")}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setPreviewDevice("mobile")}
                  className={cn("h-7 w-7 rounded-md flex items-center justify-center transition-all", previewDevice === "mobile" ? "bg-primary/10 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground")}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Mini checkout preview */}
            <div className={cn(
              "mx-auto rounded-xl border border-border/30 bg-background overflow-hidden transition-all duration-300",
              previewDevice === "mobile" ? "max-w-[320px]" : "max-w-full"
            )}>
              {/* Banner area */}
              {(previewDevice === "desktop" ? bannerDesktopPreview : bannerMobilePreview) && (
                <img src={previewDevice === "desktop" ? bannerDesktopPreview : bannerMobilePreview} alt="" className="w-full h-20 object-cover" />
              )}
              <div className="p-4 space-y-3">
                {/* Timer preview */}
                {timerEnabled && (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-destructive/10 border border-destructive/15 py-1.5 px-3">
                    <Timer className="h-3 w-3 text-destructive" />
                    <span className="text-[10px] font-numbers font-bold text-destructive">{timerMinutes}:00</span>
                    <span className="text-[9px] text-destructive/60">restantes</span>
                  </div>
                )}

                {/* Product */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted/10 flex items-center justify-center shrink-0 border border-border/20">
                    <Package className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-display font-bold truncate text-foreground">{name || "Produto"}</p>
                    <p className="text-xs font-numbers font-black text-primary">R$ {Number(price || 0).toFixed(2)}</p>
                  </div>
                </div>

                {/* Payment methods preview */}
                <div className="flex items-center gap-2">
                  {pixEnabled && <span className="text-[9px] px-2 py-0.5 rounded bg-success/10 text-success border border-success/20 font-display font-bold">PIX</span>}
                  {creditCardEnabled && <span className="text-[9px] px-2 py-0.5 rounded bg-info/10 text-info border border-info/20 font-display font-bold">Cartão</span>}
                  {boletoEnabled && <span className="text-[9px] px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 font-display font-bold">Boleto</span>}
                </div>

                {/* Social proof */}
                {socialProof && (
                  <p className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" /> 127 pessoas compraram recentemente
                  </p>
                )}

                {/* CTA Button preview */}
                <div className="rounded-lg py-2.5 text-center text-xs font-display font-black text-primary-foreground shadow-md" style={{ backgroundColor: buttonColor }}>
                  Comprar Agora
                </div>

                {/* Guarantee badge */}
                {guaranteeEnabled && (
                  <div className="flex items-center justify-center gap-1.5 py-1.5">
                    <Shield className="h-3 w-3 text-success/50" />
                    <span className="text-[9px] text-muted-foreground/50 font-display">Garantia de {warrantyDays} dias</span>
                  </div>
                )}
              </div>
            </div>
          </EditorCard>

          {/* Visual customization */}
          <EditorCard accentColor="bg-info">
            <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2">
              <Palette className="h-4 w-4 text-info" /> Personalização visual
            </h3>

            <div className="space-y-2">
              <EditorLabel icon={Palette}>Cor do botão de compra</EditorLabel>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input type="color" value={buttonColor} onChange={(e: any) => setButtonColor(e.target.value)} className="w-12 h-12 rounded-xl border border-border cursor-pointer" />
                </div>
                <Input value={buttonColor} onChange={(e: any) => setButtonColor(e.target.value)} className="flex-1 font-mono text-sm bg-card/80 border-border/40 h-11" />
                <motion.div whileHover={{ scale: 1.02 }} className="h-11 px-8 rounded-xl flex items-center justify-center text-sm font-display font-black text-primary-foreground shadow-lg cursor-default" style={{ backgroundColor: buttonColor }}>
                  Comprar Agora
                </motion.div>
              </div>
              {/* Quick color presets */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider mr-1">Cores populares</span>
                {["#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b", "#ec4899", "#06b6d4", "#000000"].map(c => (
                  <button
                    key={c}
                    onClick={() => setButtonColor(c)}
                    className={cn("h-6 w-6 rounded-lg border-2 transition-all hover:scale-110", buttonColor === c ? "border-foreground ring-1 ring-foreground/20 scale-110" : "border-border/30")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </EditorCard>

          <EditorCard accentColor="bg-warning">
            <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" /> Elementos de conversão
            </h3>
            <div className="space-y-2">
              <ToggleRow icon={Timer} label="Timer de urgência" sublabel="Contador regressivo no checkout" checked={timerEnabled} onChange={setTimerEnabled}>
                {timerEnabled && (
                  <div className="flex items-center gap-1.5">
                    <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e: any) => setTimerMinutes(e.target.value)} className="w-16 h-8 text-center text-xs bg-card/80 border-border/40" />
                    <span className="text-[10px] text-muted-foreground">min</span>
                  </div>
                )}
              </ToggleRow>
              <ToggleRow icon={Users} label="Prova social" sublabel="'X pessoas compraram'" checked={socialProof} onChange={setSocialProof} />
              <ToggleRow icon={Shield} label="Selo de garantia" sublabel={`${warrantyDays} dias no checkout`} checked={guaranteeEnabled} onChange={setGuaranteeEnabled} />
            </div>
          </EditorCard>

          {/* Banners */}
          <EditorCard accentColor="bg-success">
            <h3 className="text-[15px] font-display font-black text-foreground flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-success" /> Banners do Checkout
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <BannerUpload label="Banner Desktop" sublabel="Recomendado: 1200×200px" preview={bannerDesktopPreview} inputRef={desktopBannerRef} onFile={(e: any) => handleBannerFile(e, "desktop")} onClear={() => { setBannerDesktopFile(null); setBannerDesktopPreview(""); }} />
              <BannerUpload label="Banner Mobile" sublabel="Recomendado: 600×200px" preview={bannerMobilePreview} inputRef={mobileBannerRef} onFile={(e: any) => handleBannerFile(e, "mobile")} onClear={() => { setBannerMobileFile(null); setBannerMobilePreview(""); }} />
            </div>
          </EditorCard>
        </>
      )}
    </div>
  );
}

function TabCoProducao({ isNew, coProducerEmail, setCoProducerEmail, coProductionSplit, setCoProductionSplit, coProductionDuration, setCoProductionDuration, coProductionSalesType, setCoProductionSalesType }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Handshake} title="Co-Produção" subtitle="Divida receitas com parceiros de produção." />

      {/* Info card */}
      <EditorCard accentColor="bg-info">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-info/10 ring-1 ring-info/20 flex items-center justify-center shrink-0">
            <Award className="h-4 w-4 text-info" />
          </div>
          <div>
            <p className="text-sm font-display font-bold text-foreground">Co-produção simplificada</p>
            <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">
              Divida a receita automaticamente com seu co-produtor. Cada venda terá o split calculado e creditado em tempo real.
            </p>
          </div>
        </div>
      </EditorCard>

      {isNew ? (
        <EmptyCard icon={Handshake} message="Salve o produto primeiro para configurar co-produção." />
      ) : (
        <>
          <EditorCard accentColor="bg-info">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <EditorLabel icon={Mail}>E-mail do co-produtor</EditorLabel>
                <Input value={coProducerEmail} onChange={(e: any) => setCoProducerEmail(e.target.value)} placeholder="email@coprodutor.com" type="email" className="h-11 bg-card/80 border-border/40" />
              </div>
              <div className="space-y-2">
                <EditorLabel icon={Clock}>Tempo de duração</EditorLabel>
                <Select value={coProductionDuration} onValueChange={setCoProductionDuration}>
                  <SelectTrigger className="h-11 bg-card/80 border-border/40"><SelectValue /></SelectTrigger>
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
          </EditorCard>

          <EditorCard accentColor="bg-primary">
            <EditorLabel icon={Percent}>Comissão do co-produtor</EditorLabel>
            <div className="flex items-center gap-3">
              <Input type="number" min="1" max="99" value={coProductionSplit} onChange={(e: any) => setCoProductionSplit(e.target.value)} className="w-24 h-11 text-center font-numbers font-black text-lg bg-card/80 border-border/40" />
              <span className="text-lg font-display font-black text-muted-foreground">%</span>
              <div className="flex-1">
                <div className="h-3 rounded-full bg-muted/20 overflow-hidden flex">
                  <motion.div animate={{ width: `${100 - Number(coProductionSplit)}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-l-full bg-primary/60" />
                  <motion.div animate={{ width: `${Math.min(Number(coProductionSplit), 100)}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-r-full bg-info/60" />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] font-display font-bold text-primary/60">Você: {100 - Number(coProductionSplit)}%</span>
                  <span className="text-[10px] font-display font-bold text-info/60">Co-produtor: {coProductionSplit}%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <EditorLabel>Comissões de quais vendas?</EditorLabel>
              <Select value={coProductionSalesType} onValueChange={setCoProductionSalesType}>
                <SelectTrigger className="h-11 bg-card/80 border-border/40"><SelectValue /></SelectTrigger>
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
          </EditorCard>

          <EmptyCard icon={Handshake} message="Nenhum co-produtor cadastrado" />
        </>
      )}
    </div>
  );
}

function TabCupons({ isNew, coupons, newCouponCode, setNewCouponCode, newCouponType, setNewCouponType, newCouponValue, setNewCouponValue, newCouponMaxUses, setNewCouponMaxUses, creatingCoupon, createCoupon, toggleCoupon, deleteCoupon }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Tag} title="Cupons de Desconto" subtitle="Crie cupons exclusivos para este produto." />
      {isNew ? (
        <EmptyCard icon={Tag} message="Salve o produto primeiro para criar cupons." />
      ) : (
        <>
          <EditorCard accentColor="bg-warning">
            <h4 className="text-[15px] font-display font-black flex items-center gap-2"><Plus className="h-4 w-4 text-warning" /> Criar novo cupom</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <EditorLabel>Código do cupom</EditorLabel>
                <Input value={newCouponCode} onChange={(e: any) => setNewCouponCode(e.target.value.toUpperCase())} placeholder="EX: DESCONTO20" className="h-11 bg-card/80 border-border/40 font-mono uppercase" maxLength={30} />
              </div>
              <div className="space-y-2">
                <EditorLabel>Tipo de desconto</EditorLabel>
                <Select value={newCouponType} onValueChange={setNewCouponType}>
                  <SelectTrigger className="h-11 bg-card/80 border-border/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <EditorLabel>{newCouponType === "percentage" ? "Percentual (%)" : "Valor (R$)"}</EditorLabel>
                <Input type="number" min="0.01" max={newCouponType === "percentage" ? "100" : "99999"} step="0.01" value={newCouponValue} onChange={(e: any) => setNewCouponValue(e.target.value)} className="h-11 bg-card/80 border-border/40 font-numbers font-black" placeholder="0" />
              </div>
              <div className="space-y-2">
                <EditorLabel>Usos máximos</EditorLabel>
                <Input type="number" min="1" value={newCouponMaxUses} onChange={(e: any) => setNewCouponMaxUses(e.target.value)} className="h-11 bg-card/80 border-border/40 font-numbers" placeholder="Ilimitado" />
              </div>
            </div>
            <Button onClick={createCoupon} disabled={creatingCoupon || !newCouponCode.trim()} className="gap-2 rounded-xl font-display font-bold w-full sm:w-auto">
              <Plus className="h-4 w-4" /> {creatingCoupon ? "Criando..." : "Criar Cupom"}
            </Button>
          </EditorCard>

          {coupons.length > 0 ? (
            <div className="space-y-2">
              {coupons.map((coupon: any, i: number) => (
                <motion.div
                  key={coupon.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    "rounded-2xl border bg-card/50 backdrop-blur-xl p-4 flex items-center justify-between relative overflow-hidden transition-all",
                    coupon.is_active ? "border-border/50" : "border-border/20 opacity-60"
                  )}
                >
                  <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", coupon.is_active ? "bg-warning" : "bg-muted-foreground/20")} />
                  <div className="flex items-center gap-3 pl-1">
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center ring-1", coupon.is_active ? "bg-warning/10 ring-warning/20" : "bg-muted/10 ring-border/20")}>
                      <Tag className={cn("h-4 w-4", coupon.is_active ? "text-warning" : "text-muted-foreground/40")} />
                    </div>
                    <div>
                      <p className="text-sm font-mono font-bold">{coupon.code}</p>
                      <p className="text-[10px] text-muted-foreground/50 font-numbers">
                        {coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `R$ ${coupon.discount_value.toFixed(2)}`}
                        {coupon.max_uses ? ` • ${coupon.current_uses}/${coupon.max_uses} usos` : ` • ${coupon.current_uses} usos`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={coupon.is_active} onCheckedChange={() => toggleCoupon(coupon)} />
                    <Button variant="ghost" size="sm" onClick={() => deleteCoupon(coupon.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive rounded-xl">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <EmptyCard icon={Tag} message="Nenhum cupom criado para este produto" />
          )}
        </>
      )}
    </div>
  );
}

function TabAfiliados({ isNew, productId, affiliateEnabled, setAffiliateEnabled, affiliateCommission, setAffiliateCommission, affiliateAttribution, setAffiliateAttribution, affiliateCookieDays, setAffiliateCookieDays, affiliateApprovalManual, setAffiliateApprovalManual, affiliateUpsellCommission, setAffiliateUpsellCommission, affiliateMarketplace, setAffiliateMarketplace, affiliateSupportEmail, setAffiliateSupportEmail, affiliateDescription, setAffiliateDescription, copyLink }: any) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Users} title="Programa de Afiliados" subtitle="Configure comissões e regras para afiliados." />
      <ToggleRow icon={Zap} label="Habilitar programa de afiliados" checked={affiliateEnabled} onChange={setAffiliateEnabled} />
      <AnimatePresence>
        {affiliateEnabled && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-5 overflow-hidden">
            <EditorCard accentColor="bg-success">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <EditorLabel icon={Percent}>Comissão (%)</EditorLabel>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="1" max="80" value={affiliateCommission} onChange={(e: any) => setAffiliateCommission(e.target.value)} className="w-24 h-11 text-center font-numbers font-black text-lg bg-card/80 border-border/40" />
                    <span className="text-lg font-display font-black text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <EditorLabel>Atribuição</EditorLabel>
                  <Select value={affiliateAttribution} onValueChange={setAffiliateAttribution}>
                    <SelectTrigger className="h-11 bg-card/80 border-border/40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_click">Último clique</SelectItem>
                      <SelectItem value="first_click">Primeiro clique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <EditorLabel icon={Clock}>Duração dos cookies</EditorLabel>
                <Select value={affiliateCookieDays} onValueChange={setAffiliateCookieDays}>
                  <SelectTrigger className="h-11 w-40 bg-card/80 border-border/40"><SelectValue /></SelectTrigger>
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
            </EditorCard>

            <EditorCard accentColor="bg-primary">
              <h4 className="text-[15px] font-display font-black flex items-center gap-2">Regras avançadas</h4>
              <div className="space-y-2">
                <ToggleRow label="Aprovar cada solicitação manualmente" checked={affiliateApprovalManual} onChange={setAffiliateApprovalManual} />
                <ToggleRow label="Recebe comissão de Upsell" checked={affiliateUpsellCommission} onChange={setAffiliateUpsellCommission} />
                <ToggleRow label="Mostrar no marketplace público" checked={affiliateMarketplace} onChange={setAffiliateMarketplace} />
              </div>
            </EditorCard>

            <EditorCard accentColor="bg-info">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <EditorLabel icon={Mail}>E-mail de suporte para afiliados</EditorLabel>
                  <Input value={affiliateSupportEmail} onChange={(e: any) => setAffiliateSupportEmail(e.target.value)} placeholder="suporte@..." type="email" className="h-11 bg-card/80 border-border/40" />
                </div>
                <div className="space-y-2">
                  <EditorLabel>Descrição para afiliados</EditorLabel>
                  <Textarea value={affiliateDescription} onChange={(e: any) => setAffiliateDescription(e.target.value)} rows={2} placeholder="Descreva os benefícios..." className="resize-none bg-card/80 border-border/40" />
                </div>
              </div>
            </EditorCard>

            {!isNew && (
              <EditorCard accentColor="bg-success">
                <h4 className="text-[15px] font-display font-black flex items-center gap-2"><UserPlus className="h-4 w-4 text-success" /> Convidar afiliados</h4>
                <p className="text-xs text-muted-foreground/60">Compartilhe esse link para convidar os seus afiliados:</p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={`${window.location.origin}/affiliate/invite/${productId?.slice(0, 8)}`} className="h-9 font-mono text-xs bg-muted/10 border-border/30" />
                  <Button variant="outline" size="sm" onClick={() => copyLink(`${window.location.origin}/affiliate/invite/${productId?.slice(0, 8)}`)} className="gap-1.5 h-9 shrink-0 rounded-xl">
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
              </EditorCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabLinks({ isNew, product, pageUrl, affiliateEnabled, productId, getCheckoutLink, copyLink, name, price }: any) {
  const [showQR, setShowQR] = useState(false);
  const checkoutLink = getCheckoutLink();

  const shareLinks = [
    { label: "WhatsApp", icon: MessageSquare, color: "bg-success/10 text-success ring-success/20", url: `https://wa.me/?text=${encodeURIComponent(`Confira: ${name} por apenas R$ ${Number(price || 0).toFixed(2)}! ${checkoutLink}`)}` },
    { label: "Telegram", icon: Share2, color: "bg-info/10 text-info ring-info/20", url: `https://t.me/share/url?url=${encodeURIComponent(checkoutLink)}&text=${encodeURIComponent(`${name} — R$ ${Number(price || 0).toFixed(2)}`)}` },
    { label: "Twitter/X", icon: Megaphone, color: "bg-foreground/5 text-foreground ring-border/20", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${name} — R$ ${Number(price || 0).toFixed(2)}`)}&url=${encodeURIComponent(checkoutLink)}` },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader icon={Link2} title="Links de Venda" subtitle="Gerencie, compartilhe e monitore seus links de checkout." />
      {isNew ? (
        <EmptyCard icon={Link2} message="Salve o produto primeiro para gerar links." />
      ) : (
        <div className="space-y-4">
          {/* Main checkout link with QR */}
          {product?.checkout_url && (
            <EditorCard accentColor="bg-primary">
              <div className="flex items-center justify-between">
                <h4 className="text-[15px] font-display font-black flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /> Link do Checkout</h4>
                <button
                  onClick={() => setShowQR(!showQR)}
                  className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-all ring-1", showQR ? "bg-primary/10 ring-primary/20 text-primary" : "bg-muted/10 ring-border/20 text-muted-foreground/50 hover:text-foreground")}
                >
                  <QrCode className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={checkoutLink} className="h-10 font-mono text-xs bg-muted/10 border-border/30" />
                <Button variant="outline" size="sm" onClick={() => copyLink(checkoutLink)} className="gap-1.5 h-10 shrink-0 rounded-xl font-display font-bold">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(checkoutLink, "_blank")} className="gap-1.5 h-10 shrink-0 rounded-xl font-display font-bold">
                  <Eye className="h-3.5 w-3.5" /> Abrir
                </Button>
              </div>

              {/* QR Code */}
              <AnimatePresence>
                {showQR && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col items-center gap-3 py-4 border-t border-border/20 mt-2">
                      <div className="bg-background p-4 rounded-xl border border-border/20 shadow-sm">
                        <QRCodeSVG
                          value={checkoutLink}
                          size={180}
                          level="M"
                          bgColor="transparent"
                          fgColor="hsl(var(--foreground))"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground/40 font-display">Escaneie para acessar o checkout</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </EditorCard>
          )}

          {/* Social sharing */}
          {checkoutLink && (
            <EditorCard accentColor="bg-success">
              <h4 className="text-[15px] font-display font-black flex items-center gap-2">
                <Share2 className="h-4 w-4 text-success" /> Compartilhar
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {shareLinks.map(sl => (
                  <motion.a
                    key={sl.label}
                    href={sl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/20 hover:border-border/40 bg-card/30 transition-all"
                  >
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center ring-1 shrink-0", sl.color)}>
                      <sl.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-display font-bold text-foreground">{sl.label}</span>
                  </motion.a>
                ))}
              </div>
            </EditorCard>
          )}

          {pageUrl && (
            <EditorCard accentColor="bg-info">
              <h4 className="text-[15px] font-display font-black flex items-center gap-2"><Globe className="h-4 w-4 text-info" /> Página de Vendas</h4>
              <div className="flex items-center gap-2">
                <Input readOnly value={pageUrl} className="h-10 font-mono text-xs bg-muted/10 border-border/30" />
                <Button variant="outline" size="sm" onClick={() => copyLink(pageUrl)} className="gap-1.5 h-10 shrink-0 rounded-xl font-display font-bold">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
            </EditorCard>
          )}

          {affiliateEnabled && (
            <EditorCard accentColor="bg-warning">
              <h4 className="text-[15px] font-display font-black flex items-center gap-2"><Users className="h-4 w-4 text-warning" /> Link de Afiliado</h4>
              <div className="flex items-center gap-2">
                <Input readOnly value={`${window.location.origin}/affiliate/invite/${productId?.slice(0, 8)}`} className="h-10 font-mono text-xs bg-muted/10 border-border/30" />
                <Button variant="outline" size="sm" onClick={() => copyLink(`${window.location.origin}/affiliate/invite/${productId?.slice(0, 8)}`)} className="gap-1.5 h-10 shrink-0 rounded-xl font-display font-bold">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
            </EditorCard>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB CONTEUDO (Courses linked to this product)
   ═══════════════════════════════════════════════ */

function TabConteudo({ productId, isNew }: { productId?: string; isNew: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleStats, setModuleStats] = useState<Record<string, { modules: number; lessons: number }>>({});

  useEffect(() => {
    if (isNew || !productId) { setLoading(false); return; }
    (async () => {
      const { data: coursesData } = await supabase.from("courses").select("*").eq("product_id", productId).order("created_at", { ascending: false });
      const courses = coursesData || [];
      setCourses(courses);
      if (courses.length > 0) {
        const courseIds = courses.map(c => c.id);
        const { data: mods } = await supabase.from("modules").select("id, course_id").in("course_id", courseIds);
        const modsData = mods || [];
        const modIds = modsData.map(m => m.id);
        let lessonsCount: Record<string, number> = {};
        if (modIds.length > 0) {
          const { data: lessons } = await supabase.from("lessons").select("id, module_id").in("module_id", modIds);
          (lessons || []).forEach(l => { lessonsCount[l.module_id] = (lessonsCount[l.module_id] || 0) + 1; });
        }
        const stats: Record<string, { modules: number; lessons: number }> = {};
        courses.forEach(c => {
          const courseMods = modsData.filter(m => m.course_id === c.id);
          stats[c.id] = { modules: courseMods.length, lessons: courseMods.reduce((a, m) => a + (lessonsCount[m.id] || 0), 0) };
        });
        setModuleStats(stats);
      }
      setLoading(false);
    })();
  }, [productId, isNew]);

  if (isNew) {
    return (
      <div className="space-y-6">
        <SectionHeader icon={GraduationCap} title="Conteúdo do Produto" subtitle="Salve o produto primeiro para gerenciar o conteúdo." />
        <EmptyCard icon={Lock} message="Salve o produto para acessar esta seção" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader icon={GraduationCap} title="Conteúdo do Produto" subtitle="Cursos e aulas vinculados a este produto." />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : courses.length === 0 ? (
        <EditorCard accentColor="bg-primary">
          <div className="flex flex-col items-center py-10 gap-5">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <GraduationCap className="h-7 w-7 text-primary/40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-display font-bold text-foreground/50 mb-1">Nenhum curso vinculado</p>
              <p className="text-xs text-muted-foreground/40">Crie um curso para entregar conteúdo aos compradores</p>
            </div>
            <Button
              onClick={async () => {
                if (!user) return;
                const { data } = await supabase.from("courses").insert({
                  user_id: user.id, product_id: productId, title: "Novo Curso", is_published: false
                } as any).select().single();
                if (data) navigate(`/vendas/conteudo/${data.id}/builder`);
              }}
              className="gap-2 rounded-xl font-display font-bold text-sm h-10 shadow-lg shadow-primary/15"
            >
              <Plus className="h-4 w-4" /> Criar Curso
            </Button>
          </div>
        </EditorCard>
      ) : (
        <div className="space-y-3">
          {courses.map(c => {
            const stats = moduleStats[c.id] || { modules: 0, lessons: 0 };
            return (
              <EditorCard key={c.id} accentColor={c.is_published ? "bg-success" : "bg-muted-foreground/20"}>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-28 rounded-xl overflow-hidden shrink-0 bg-muted/5 border border-border/15">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent">
                        <GraduationCap className="h-6 w-6 text-primary/15" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-display font-black text-foreground truncate">{c.title}</h3>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[9px] font-display font-black uppercase tracking-[0.08em] border",
                        c.is_published
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-muted/10 text-muted-foreground/50 border-border/20"
                      )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", c.is_published ? "bg-success animate-pulse" : "bg-muted-foreground/30")} />
                        {c.is_published ? "Live" : "Rascunho"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Layers className="h-3 w-3 text-primary/50" /> {stats.modules} módulo{stats.modules !== 1 ? "s" : ""}</span>
                      <span className="flex items-center gap-1"><Video className="h-3 w-3 text-info/50" /> {stats.lessons} aula{stats.lessons !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                    className="gap-2 rounded-xl text-xs font-display font-bold text-primary hover:text-primary hover:bg-primary/8"
                  >
                    Gerenciar <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </EditorCard>
            );
          })}

          <Button
            variant="ghost"
            onClick={async () => {
              if (!user) return;
              const { data } = await supabase.from("courses").insert({
                user_id: user.id, product_id: productId, title: "Novo Curso", is_published: false
              } as any).select().single();
              if (data) navigate(`/vendas/conteudo/${data.id}/builder`);
            }}
            className="w-full gap-2 rounded-xl font-display font-bold text-sm h-10 border-2 border-dashed border-border/20 hover:border-primary/20 hover:bg-primary/[0.02] text-muted-foreground/40 hover:text-primary"
          >
            <Plus className="h-4 w-4" /> Adicionar Curso
          </Button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════ */

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-base font-display font-bold text-foreground tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function EditorCard({ children, accentColor = "bg-primary" }: { children: React.ReactNode; accentColor?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border/40 bg-card/80 p-5 space-y-4 shadow-sm relative overflow-hidden hover:border-border/60 transition-all duration-300"
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", accentColor)} />
      {children}
    </motion.div>
  );
}

function EditorLabel({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground/50" />}
      {children}
    </Label>
  );
}

function EmptyCard({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-card/40 flex flex-col items-center justify-center py-14 gap-3">
      <div className="h-14 w-14 rounded-xl bg-muted/15 flex items-center justify-center border border-border/20">
        <Icon className="h-6 w-6 text-muted-foreground/20" />
      </div>
      <p className="text-sm font-medium text-muted-foreground/50">{message}</p>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, sublabel, checked, onChange, children }: {
  icon?: React.ComponentType<{ className?: string }>; label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 relative",
      checked ? "border-primary/20 bg-primary/[0.03]" : "border-border/30 bg-card/40 hover:border-border/50"
    )}>
      {checked && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />}
      <div className="flex items-center gap-3 flex-1">
        {Icon && (
          <div className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border",
            checked ? "bg-primary/10 border-primary/15" : "bg-muted/15 border-transparent"
          )}>
            <Icon className={cn("h-3.5 w-3.5", checked ? "text-primary" : "text-muted-foreground/40")} />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {sublabel && <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>}
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
  const accentBg = color === "text-success" ? "bg-success" : color === "text-warning" ? "bg-warning" : "bg-info";
  const ringColor = color === "text-success" ? "ring-success/20" : color === "text-warning" ? "ring-warning/20" : "ring-info/20";
  const bgColor = color === "text-success" ? "bg-success/10" : color === "text-warning" ? "bg-warning/10" : "bg-info/10";

  return (
    <motion.div
      layout
      className={cn(
        "flex items-center justify-between p-4 rounded-xl border transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden",
        checked
          ? "bg-card/60 border-border/40 shadow-sm"
          : "bg-card/15 border-border/15 opacity-50"
      )}
    >
      {checked && <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", accentBg)} />}
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl transition-all ring-1", bgColor, ringColor)}>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <div>
          <p className="text-sm font-display font-bold">{label}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-numbers">{sublabel}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </motion.div>
  );
}

function BannerUpload({ label, sublabel, preview, inputRef, onFile, onClear }: {
  label: string; sublabel?: string; preview: string; inputRef: React.RefObject<HTMLInputElement>; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <EditorLabel>{label}</EditorLabel>
      {sublabel && <p className="text-[9px] text-muted-foreground/30">{sublabel}</p>}
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border/40 shadow-sm group/banner">
          <img src={preview} alt={label} className="w-full h-28 object-cover" />
          <div className="absolute inset-0 bg-background/40 opacity-0 group-hover/banner:opacity-100 transition-all flex items-center justify-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="h-8 w-8 rounded-lg bg-card/90 border border-border/30 flex items-center justify-center hover:bg-primary/10 transition-all">
              <ImagePlus className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onClear} className="h-8 w-8 rounded-lg bg-card/90 border border-border/30 flex items-center justify-center text-destructive hover:bg-destructive/10 transition-all">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="button" onClick={() => inputRef.current?.click()} className="w-full h-24 rounded-xl border-2 border-dashed border-border/20 hover:border-primary/30 hover:bg-primary/[0.02] flex items-center justify-center gap-2 text-muted-foreground/40 hover:text-primary text-xs transition-all">
          <Upload className="h-4 w-4" /> Upload {label.toLowerCase()}
        </motion.button>
      )}
    </div>
  );
}
