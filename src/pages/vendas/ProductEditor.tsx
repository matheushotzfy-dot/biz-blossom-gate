import { useState, useRef, useEffect, useCallback, type ChangeEvent, type Dispatch, type SetStateAction, type RefObject, type DragEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateAll } from "@/hooks/useQueryData";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as SelectPrimitive from "@radix-ui/react-select";
import { QRCodeSVG } from "qrcode.react";
import {
 ArrowLeft, Save, Package, DollarSign, ImagePlus, X, Settings, ShoppingCart,
 ArrowUpRight, Users, Handshake, Tag, Link2, Trash2, Plus, ExternalLink,
 CreditCard, QrCode, FileText, Mail, MapPin, Shield, Timer, Eye,
 Upload, CheckCircle2, Copy, Globe, Zap, Crosshair, Percent, Clock,
 Layers, UserPlus, Lock, Gift, BarChart3, Star, Palette, Sparkles,
 Check, ChevronRight, TrendingUp, MousePointerClick, GraduationCap, Video, Loader2,
 MessageSquare, Share2, Download, Smartphone, Monitor, AlertTriangle, Phone,
 RefreshCw, Hash, Target, Heart, Megaphone, Rocket, Award,
 BookOpen, Code2, Briefcase, type LucideIcon
} from "lucide-react";

/* Rich Select item — icon + label + description in the menu,
   but only the label shows in the trigger (via ItemText). */
function RichSelectItem({
  value, icon: Icon, label, desc,
}: { value: string; icon: LucideIcon; label: string; desc: string }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex w-full cursor-pointer select-none items-center gap-3 rounded-xl px-2.5 py-2.5 outline-none transition-colors hover:bg-primary/[0.06] focus:bg-primary/[0.08] data-[highlighted]:bg-primary/[0.08] data-[state=checked]:bg-primary/[0.08]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-colors group-hover:border-primary/30 group-data-[state=checked]:border-primary/30 group-data-[state=checked]:bg-primary/10 group-data-[state=checked]:text-primary [[data-state=checked]_&]:border-primary/30 [[data-state=checked]_&]:bg-primary/10 [[data-state=checked]_&]:text-primary">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0">
        <SelectPrimitive.ItemText asChild>
          <span className="block truncate font-display text-[12.5px] font-bold tracking-tight text-foreground">{label}</span>
        </SelectPrimitive.ItemText>
        <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">{desc}</span>
      </span>
      <SelectPrimitive.ItemIndicator className="ml-auto">
        <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.4} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type TabKey = "geral" | "configuracoes" | "conteudo" | "order-bump" | "upsell" | "checkout" | "co-producao" | "cupons" | "afiliados" | "links";

// Abas temporariamente desativadas — voltaremos a ativar futuramente.
const DISABLED_TABS: TabKey[] = ["conteudo", "cupons", "afiliados"];

const ALL_TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
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

const TABS = ALL_TABS.filter(t => !DISABLED_TABS.includes(t.key));

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
 // Admin pode desativar Boleto/Cartão por seller — quando desativado, não exibimos o toggle no produto.
 const [adminBoletoEnabled, setAdminBoletoEnabled] = useState(true);
 const [adminCardEnabled, setAdminCardEnabled] = useState(true);
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
  const [supportPhone, setSupportPhone] = useState("");

 const [warrantyDays, setWarrantyDays] = useState("7");
 const [deliveryType, setDeliveryType] = useState("link");
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
 const [showCouponField, setShowCouponField] = useState(false);
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

 // Upsell / Downsell (persistido em products)
 const [upsellEnabled, setUpsellEnabled] = useState(false);
 const [upsellType, setUpsellType] = useState<"none" | "page" | "popup">("none");
 const [upsellName, setUpsellName] = useState("");
 const [upsellPrice, setUpsellPrice] = useState("");
 const [upsellDiscount, setUpsellDiscount] = useState("30");
 const [upsellUrl, setUpsellUrl] = useState("");
 const [downsellEnabled, setDownsellEnabled] = useState(false);
 const [downsellUrl, setDownsellUrl] = useState("");
 const [downsellPrice, setDownsellPrice] = useState("");
 const [downsellDelay, setDownsellDelay] = useState("5");

 // Co-produções existentes
 const [coProductionsList, setCoProductionsList] = useState<Tables<"co_productions">[]>([]);
 const [invitingCoProducer, setInvitingCoProducer] = useState(false);


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
 let score = 0; const total = 8;
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
    setSupportEmail(data.support_email || "");
    setSupportPhone(data.support_phone || "");
    setDisplayName(data.display_name || "");
 setDeliveryType(data.delivery_type || "digital");
 // Upsell
 setUpsellEnabled(data.upsell_enabled || false);
 setUpsellType((data.upsell_type as typeof upsellType) || "none");
 setUpsellName(data.upsell_name || "");
 setUpsellPrice(data.upsell_price != null ? String(data.upsell_price) : "");
 setUpsellDiscount(String(data.upsell_discount ?? 30));
 setUpsellUrl(data.upsell_url || "");
 setDownsellEnabled(data.downsell_enabled || false);
 setDownsellUrl(data.downsell_url || "");
 setDownsellPrice(data.downsell_price != null ? String(data.downsell_price) : "");
 setDownsellDelay(String(data.downsell_delay ?? 5));
 setEmailTiming(data.email_timing || "immediate");
 setLoading(false);
 })();
   }, [productId, user?.id, isNew]);


  // Carrega gates de pagamento definidos pelo admin no perfil do seller
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("boleto_enabled, credit_card_enabled").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.boleto_enabled === false) { setAdminBoletoEnabled(false); setBoletoEnabled(false); }
        if (data.credit_card_enabled === false) { setAdminCardEnabled(false); setCreditCardEnabled(false); }
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || isNew) return;
 supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").neq("id", productId!)
 .then(({ data }) => { if (data) setAllProducts(data); });
 supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", productId!)
 .then(({ data }) => { if (data) setOrderBumps(data); });
 supabase.from("coupons").select("*").eq("user_id", user.id).eq("product_id", productId!).order("created_at", { ascending: false })
 .then(({ data }) => { if (data) setCoupons(data); });
 supabase.from("co_productions").select("*").eq("product_id", productId!).order("created_at", { ascending: false })
 .then(({ data }) => { if (data) setCoProductionsList(data); });
 }, [user?.id, productId, isNew]);


 const uploadImage = async (file: File, bucket: string, path: string): Promise<string | null> => {
 const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
 if (!ALLOWED.includes(file.type)) { toast.error("Use JPG, PNG, WebP ou GIF"); return null; }
 if (file.size > 5 * 1024 * 1024) { toast.error("Imagem: máximo 5MB"); return null; }
 const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
 if (error) { toast.error("Erro ao enviar imagem"); return null; }
 const { data } = supabase.storage.from(bucket).getPublicUrl(path);
 return data.publicUrl;
 };

   const handleSave = async () => {
     if (!user) return;
     // Normaliza preço aceitando "10,50", "10.50", "1.000,50", "R$ 1.000,50", etc.
     const cleanPrice = String(price).replace(/[^0-9,.-]/g, "");
     // Se tem vírgula, ela é o separador decimal e pontos são milhares (formato BR)
     const priceNum = cleanPrice.includes(",")
       ? parseFloat(cleanPrice.replace(/\./g, "").replace(",", "."))
       : parseFloat(cleanPrice);
     // Normaliza pageUrl: aceita sem https:// e adiciona automaticamente
     let normalizedPageUrl = pageUrl.trim();
     if (normalizedPageUrl && !/^https?:\/\//i.test(normalizedPageUrl)) {
       normalizedPageUrl = `https://${normalizedPageUrl}`;
     }
     if (!name.trim()) { toast.error("Nome é obrigatório"); setActiveTab("geral"); return; }
     if (description.trim().length < 50) { toast.error("Descrição deve ter no mínimo 50 caracteres"); setActiveTab("geral"); return; }
     if (isNaN(priceNum) || priceNum < 1) { toast.error("Preço mínimo é R$ 1,00"); setActiveTab("geral"); return; }
     if (priceNum > 99999.99) { toast.error("Preço máximo é R$ 99.999,99"); setActiveTab("geral"); return; }
     if (!normalizedPageUrl || !/^https?:\/\/.+\..+/.test(normalizedPageUrl)) { toast.error("Insira uma página de vendas válida (ex: seusite.com)"); setActiveTab("geral"); return; }
     if (!supportEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail.trim())) { toast.error("Insira um e-mail de suporte válido (ex: suporte@seusite.com)"); setActiveTab("geral"); return; }
     if (!supportPhone.trim() || supportPhone.replace(/\D/g, "").length < 10) { toast.error("Insira um telefone de suporte válido (com DDD)"); setActiveTab("geral"); return; }
     if (!displayName.trim()) { toast.error("Nome de exibição é obrigatório"); setActiveTab("geral"); return; }
     // sincroniza o input para refletir a URL normalizada (caso o usuário salve sem ter prefixo)
     if (normalizedPageUrl !== pageUrl) setPageUrl(normalizedPageUrl);

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
 page_url: normalizedPageUrl || null,
 image_url: imageUrl,
  support_email: supportEmail.trim() || null,
  support_phone: supportPhone.trim() || null,
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
 upsell_enabled: upsellEnabled,
 upsell_type: upsellEnabled ? upsellType : "none",
 upsell_name: upsellName.trim() || null,
 upsell_price: upsellPrice ? Number(String(upsellPrice).replace(",", ".")) : null,
 upsell_discount: parseInt(upsellDiscount) || 30,
 upsell_url: upsellUrl.trim() || null,
 downsell_enabled: downsellEnabled,
 downsell_url: downsellUrl.trim() || null,
 downsell_price: downsellPrice ? Number(String(downsellPrice).replace(",", ".")) : null,
 downsell_delay: parseInt(downsellDelay) || 5,
 email_timing: emailTiming,
 };


 if (isNew && !createdProductId) {
 const slug = crypto.randomUUID().slice(0, 8);
 const checkoutUrl = `${window.location.origin}/pay/${slug}`;
 const { data: newProduct, error } = await supabase.from("products").insert({ ...productData, status: "draft", user_id: user.id, checkout_url: checkoutUrl } as TablesInsert<"products">).select("*").maybeSingle();
 if (error || !newProduct) { toast.error("Erro ao criar produto"); return; }

 if (deliveryType === "digital") {
 await supabase.from("courses").insert({
 user_id: user.id,
 product_id: newProduct.id,
 title: name.trim(),
 description: description.trim() || null,
 is_published: false,
 } satisfies TablesInsert<"courses">);
 }

 setCreatedProductId(newProduct.id);
 setProduct(newProduct);
 toast.success("Produto criado com sucesso! Continue configurando.");
 invalidateAll(["products", "courses"]);
 setActiveTab("configuracoes");
 window.history.replaceState(null, "", `/vendas/produtos/${newProduct.id}/editar`);
  } else {
  // Auto-promove de 'draft' para 'active' quando todos os campos essenciais foram preenchidos.
  // Não toca em status definidos pelo admin (pending_review/inactive).
  const updatePayload: TablesUpdate<"products"> = { ...productData };
  const currentStatus = product?.status;
  const hasAllEssentials = name.trim().length > 1 && priceNum >= 1 && (description.trim().length >= 10) && !!imageUrl;
  if (currentStatus === "draft" && hasAllEssentials) {
    updatePayload.status = "active";
  } else {
    delete updatePayload.status; // preserva status do admin
  }
  const { error } = await supabase.from("products").update(updatePayload).eq("id", effectiveProductId!).eq("user_id", user.id);
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
 } satisfies TablesInsert<"courses">);
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
 } satisfies TablesInsert<"products">).select("id").maybeSingle();
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
 }).select("id, bump_product_id").maybeSingle();
 if (error || !data) { toast.error("Erro ao adicionar"); return; }
 setOrderBumps(prev => [...prev, data]);
 setSelectedBumpProduct("");
 toast.success("Order bump adicionado!");
 };

 const removeBump = async (id: string) => {
 await supabase.from("order_bumps").delete().eq("id", id);
 setOrderBumps(prev => prev.filter(b => b.id !== id));
 toast.success("Order bump removido");
 };

 const inviteCoProducer = async () => {
   if (!user || isNew || !effectiveProductId) return;
   const email = coProducerEmail.trim().toLowerCase();
   if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("E-mail inválido"); return; }
   const split = Number(coProductionSplit);
   if (isNaN(split) || split < 1 || split > 99) { toast.error("Percentual deve ser entre 1 e 99%"); return; }
   if (coProductionsList.some((c) => c.co_producer_email?.toLowerCase() === email && c.status !== "rejected")) {
     toast.error("Este co-produtor já foi convidado");
     return;
   }
   setInvitingCoProducer(true);
   try {
     const { data, error } = await supabase.from("co_productions").insert({
       product_id: effectiveProductId,
       owner_user_id: user.id,
       co_producer_email: email,
       split_percentage: split,
       status: "pending",
      } satisfies TablesInsert<"co_productions">).select().maybeSingle();
      if (error || !data) { toast.error("Erro ao convidar co-produtor"); return; }
      setCoProductionsList(prev => [data, ...prev]);
      await supabase.from("products").update({ co_production_enabled: true, co_producer_email: email, co_production_split: split } satisfies TablesUpdate<"products">).eq("id", effectiveProductId).eq("user_id", user.id);
     setCoProductionEnabled(true);
     toast.success("Convite enviado!");
   } finally {
     setInvitingCoProducer(false);
   }
 };

 const removeCoProducer = async (id: string) => {
   const { error } = await supabase.from("co_productions").delete().eq("id", id);
   if (error) { toast.error("Erro ao remover"); return; }
   setCoProductionsList(prev => prev.filter((c) => c.id !== id));
   toast.success("Co-produtor removido");
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
 }).select().maybeSingle();
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
  <div className="flex flex-col items-center gap-5">
  <div className="relative">
  <motion.div
  animate={{ rotate: 360 }}
  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
  className="h-14 w-14 border-2 border-border border-t-primary rounded-full"
  />
  <div className="absolute inset-0 flex items-center justify-center">
  <div className="h-9 w-9 rounded-xl bg-primary/10 border border-border flex items-center justify-center">
  <Package className="h-4.5 w-4.5 text-primary" />
  </div>
  </div>
  </div>
  <div className="text-center space-y-1">
  <p className="text-sm font-display font-bold text-foreground">Carregando produto</p>
  <p className="text-xs text-muted-foreground">Preparando o editor...</p>
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
 <div className="shrink-0 h-[2px] bg-border/10 relative z-[60]">
 <motion.div
 className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full relative"
 initial={{ width: "0%" }}
 animate={{ width: `${completionPercent}%` }}
 transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
 >
 {completionPercent > 5 && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />}
 </motion.div>
 </div>

 {/* ───── Top Bar ───── */}
  <div className="shrink-0 z-50 bg-card border-b border-border">
  <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14 sm:h-[60px]">
  <div className="flex items-center gap-3">
  <button onClick={() => navigate("/vendas/produtos")} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-[0.97]">
  <ArrowLeft className="h-4 w-4" />
  </button>

  {/* Product chip */}
  {name && (
  <div className="hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-secondary border border-border">
  {imagePreview ? (
  <img src={imagePreview} alt="" className="h-7 w-7 rounded-lg object-cover border border-border" />
  ) : (
  <div className="h-7 w-7 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
  <Package className="h-3.5 w-3.5 text-primary" />
  </div>
  )}
  <div>
  <p className="text-xs font-display font-bold text-foreground truncate max-w-[200px] leading-tight">{name}</p>
  {price && (
  <p className="text-[10px] font-numbers font-bold text-primary leading-tight flex items-center gap-1.5">
  R$ {Number(price).toFixed(2)}
  <span className={cn("h-1.5 w-1.5 rounded-full", status === "active" ? "bg-success" : "bg-muted-foreground/40")} />
  </p>
  )}
  </div>
  </div>
  )}
  </div>

  <div className="flex items-center gap-2.5">
  {/* Step indicator */}
  <div className="hidden lg:flex items-center gap-1 px-3 py-2.5 rounded-xl bg-secondary border border-border">
  {TABS.map((tab) => {
  const isActive = activeTab === tab.key;
  const locked = tab.key !== "geral" && tabsLocked;
  return (
  <motion.div
  key={tab.key}
  animate={{ width: isActive ? 20 : 6, opacity: locked ? 0.2 : 1 }}
  transition={{ duration: 0.25 }}
  className={cn(
  "h-1.5 rounded-full transition-colors duration-200",
  isActive ? "bg-primary" : "bg-muted-foreground/25"
  )}
  title={tab.label}
  />
  );
  })}
  </div>

  {/* Completion */}
  <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-secondary border border-border">
  <CompletionRing percent={completionPercent} />
  <div>
  <p className="text-[8px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground">Completo</p>
  <p className="text-[11px] font-numbers font-bold text-foreground tabular-nums leading-tight">{completionPercent}%</p>
  </div>
  </div>

  <div className="h-5 w-px bg-border hidden sm:block" />

  {/* Actions */}
  <div className="flex items-center gap-1.5">
  {!tabsLocked && (
  <>
  <Button variant="ghost" size="sm" onClick={handleDuplicate} className="text-muted-foreground gap-1.5 text-xs rounded-xl h-9 hidden sm:flex hover:text-foreground hover:bg-muted font-display font-bold transition-colors duration-200">
  <Copy className="h-3 w-3" /> <span className="hidden lg:inline">Duplicar</span>
  </Button>
  <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive/50 hover:text-destructive hover:bg-destructive/10 h-9 w-9 p-0 rounded-xl hidden sm:flex transition-colors duration-200">
  <Trash2 className="h-3.5 w-3.5" />
  </Button>
  </>
  )}
  <Button onClick={handleSave} disabled={saving} size="sm" className={cn(
  "gap-1.5 rounded-xl text-xs font-display font-bold h-9 px-5 transition-all duration-250",
  saved ? "bg-success hover:bg-success" : ""
  )}>
  {saved ? (
  <><Check className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Salvo!</span></>
  ) : saving ? (
  <><Loader2 className="h-3 w-3 animate-spin" /> <span className="hidden sm:inline">Salvando...</span></>
  ) : isNew && !createdProductId ? (
  <><ChevronRight className="h-3 w-3" /> <span>Próximo</span></>
  ) : (
  <><Save className="h-3 w-3" /> <span>Salvar</span></>
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
  <nav className="hidden lg:flex flex-col w-56 shrink-0 overflow-y-auto overscroll-contain pb-6 scrollbar-none space-y-3">
  <div className="rounded-2xl border border-border bg-card p-2.5 space-y-0.5">
  <div className="px-3 py-2.5 mb-1">
  <p className="text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground">Navegação</p>
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
  "w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] font-display font-bold transition-all duration-200 text-left relative group/tab",
  locked
  ? "opacity-25 cursor-not-allowed text-muted-foreground"
  : isActive
  ? "bg-primary/10 text-primary border border-primary/15"
  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
  )}
  >
  {isActive && (
  <motion.div layoutId="sidebar-accent" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
  )}
  {locked ? (
  <Lock className="h-3.5 w-3.5 shrink-0" />
  ) : (
  <div className={cn(
  "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-200",
  isActive ? "bg-primary/10 border-primary/20" : "bg-secondary border-border group-hover/tab:border-muted-foreground/20"
  )}>
  <tab.icon className={cn("h-3.5 w-3.5 transition-colors duration-200", isActive ? "text-primary" : "text-muted-foreground/50 group-hover/tab:text-muted-foreground")} />
  </div>
  )}
  <span className="truncate">{tab.label}</span>
  {completed && !isActive && !locked && (
  <div className="ml-auto h-2 w-2 rounded-full bg-success shrink-0" />
  )}
  </button>
  );
  })}
  </div>

  {/* Quick info — temporariamente desativado, voltaremos depois */}
  {false && !tabsLocked && product?.checkout_url && (
  <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5">
  <p className="text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground">Ações Rápidas</p>
  <Button
  variant="outline" size="sm"
  onClick={() => copyLink(getCheckoutLink())}
  className="w-full gap-1.5 h-9 text-[11px] rounded-xl font-display font-bold transition-colors duration-200"
  >
  <Copy className="h-3 w-3" /> Copiar Link
  </Button>
  <Button
  variant="outline" size="sm"
  onClick={() => navigate(`/vendas/produtos/${effectiveProductId}/checkout-builder`)}
  className="w-full gap-1.5 h-9 text-[11px] rounded-xl font-display font-bold transition-colors duration-200"
  >
  <Palette className="h-3 w-3" /> Checkout Builder
  </Button>
  </div>
  )}
  </nav>

 {/* ── Mobile Tab Bar ── */}
  <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card border-t border-border safe-area-bottom">
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
  "flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold whitespace-nowrap transition-colors duration-200 min-w-[50px]",
  locked ? "opacity-30 text-muted-foreground" :
  activeTab === tab.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
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
  {...{ name, setName, description, setDescription, price, setPrice, status, setStatus, pageUrl, setPageUrl, imagePreview, setImagePreview, imageFile, setImageFile, fileInputRef, handleFileChange, category, setCategory, paymentType, setPaymentType, displayName, setDisplayName, supportEmail, setSupportEmail, supportPhone, setSupportPhone, warrantyDays, setWarrantyDays, isDragging, setIsDragging, handleDrop, onNext: handleSave }}
  />}

{activeTab === "configuracoes" && <TabConfiguracoes
 {...{ price, pixEnabled, setPixEnabled, boletoEnabled, setBoletoEnabled, creditCardEnabled, setCreditCardEnabled, emailConfirm, setEmailConfirm, showCouponField, setShowCouponField, addressRequired, setAddressRequired, deliveryType, setDeliveryType, adminBoletoEnabled, adminCardEnabled }}
/>}

 {activeTab === "conteudo" && <TabConteudo productId={effectiveProductId} isNew={tabsLocked} />}

 {activeTab === "order-bump" && <TabOrderBump
 {...{ isNew: tabsLocked, orderBumps, allProducts, availableForBump, selectedBumpProduct, setSelectedBumpProduct, addBump, removeBump }}
 />}

    {activeTab === "upsell" && <TabUpsell
 {...{ isNew: tabsLocked, name, price, imagePreview, hasCustomThankYou, setHasCustomThankYou, thankYouUrl, setThankYouUrl, sendConfirmationEmail, setSendConfirmationEmail, emailTiming, setEmailTiming,
       upsellEnabled, setUpsellEnabled, upsellType, setUpsellType, upsellName, setUpsellName, upsellPrice, setUpsellPrice, upsellDiscount, setUpsellDiscount, upsellUrl, setUpsellUrl,
       downsellEnabled, setDownsellEnabled, downsellUrl, setDownsellUrl, downsellPrice, setDownsellPrice, downsellDelay, setDownsellDelay }}
 />}

 {activeTab === "checkout" && <TabCheckout
 {...{ isNew: tabsLocked, name, price, productId: effectiveProductId, buttonColor, setButtonColor, timerEnabled, setTimerEnabled, timerMinutes, setTimerMinutes, socialProof, setSocialProof, guaranteeEnabled, setGuaranteeEnabled, warrantyDays, bannerDesktopPreview, bannerMobilePreview, desktopBannerRef, mobileBannerRef, handleBannerFile, setBannerDesktopFile, setBannerDesktopPreview, setBannerMobileFile, setBannerMobilePreview, getCheckoutLink, copyLink, navigate, pixEnabled, boletoEnabled, creditCardEnabled }}
 />}

 {activeTab === "co-producao" && <TabCoProducao
 {...{ isNew: tabsLocked, coProducerEmail, setCoProducerEmail, coProductionSplit, setCoProductionSplit, coProductionDuration, setCoProductionDuration, coProductionSalesType, setCoProductionSalesType, coProductionsList, inviteCoProducer, removeCoProducer, invitingCoProducer }}
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

 {/* Navegação inferior — Anterior / Próximo em todas as abas */}
 {(() => {
   const idx = TABS.findIndex(t => t.key === activeTab);
   const prev = idx > 0 ? TABS[idx - 1] : null;
   const next = idx >= 0 && idx < TABS.length - 1 ? TABS[idx + 1] : null;
   const goNext = () => {
     if (!next) return;
     if (tabsLocked) { handleSave(); return; }
     setActiveTab(next.key);
   };
   const goPrev = () => { if (prev && !tabsLocked) setActiveTab(prev.key); };
   return (
     <div className="mt-8 flex items-center justify-between gap-3 pt-4 border-t border-border">
       <Button
         variant="outline"
         onClick={goPrev}
         disabled={!prev || tabsLocked}
         className="gap-2 rounded-xl font-display font-bold h-11 px-5"
       >
         <ChevronRight className="h-4 w-4 rotate-180" />
         {prev ? prev.label : "Anterior"}
       </Button>
       {next ? (
         <Button onClick={goNext} disabled={saving} className="gap-2 rounded-xl font-display font-bold h-11 px-6">
           {tabsLocked ? "Salvar e continuar" : `Próximo: ${next.label}`}
           <ChevronRight className="h-4 w-4" />
         </Button>
       ) : (
         <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl font-display font-bold h-11 px-6">
           <Save className="h-4 w-4" /> Salvar alterações
         </Button>
       )}
     </div>
   );
 })()}
 </div>
 </div>
 </div>
 </div>
 );
}

/* ═══════════════════════════════════════════════
 TAB COMPONENTS
 ═══════════════════════════════════════════════ */



type S<T> = Dispatch<SetStateAction<T>>;
type StrS = S<string>;
type BoolS = S<boolean>;
type AnyObj = Record<string, unknown>;

type TabGeralProps = {
  name: string; setName: StrS;
  description: string; setDescription: StrS;
  price: string; setPrice: StrS;
  status: string; setStatus: StrS;
  pageUrl: string; setPageUrl: StrS;
  imagePreview: string | null; setImagePreview: S<string | null>;
  imageFile: File | null; setImageFile: S<File | null>;
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  category: string; setCategory: StrS;
  paymentType: string; setPaymentType: StrS;
  displayName: string; setDisplayName: StrS;
  supportEmail: string; setSupportEmail: StrS;
  supportPhone: string; setSupportPhone: StrS;
  warrantyDays: string; setWarrantyDays: StrS;
  isDragging: boolean; setIsDragging: BoolS;
  handleDrop: (e: React.DragEvent) => void;
  onNext: () => void;
};

function TabGeral({ name, setName, description, setDescription, price, setPrice, status, setStatus, pageUrl, setPageUrl, imagePreview, setImagePreview, imageFile, setImageFile, fileInputRef, handleFileChange, category, setCategory, paymentType, setPaymentType, displayName, setDisplayName, supportEmail, setSupportEmail, supportPhone, setSupportPhone, warrantyDays, setWarrantyDays, isDragging, setIsDragging, handleDrop, onNext }: TabGeralProps) {
  const descValid = description.length >= 50;
  // Aceita URL sem https://
  const urlValid = pageUrl.trim().length > 3 && /\.[a-z]{2,}/i.test(pageUrl.trim());
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail.trim());
  const phoneDigits = (supportPhone || "").replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 11;
  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  };
  // Formata para BR: 1.000,00 / 10.500,50. Trabalha em centavos pra evitar bug de cursor.
  const handlePriceChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8); // até 99.999.999 centavos
    if (!digits) { setPrice(""); return; }
    const cents = parseInt(digits, 10);
    const value = cents / 100;
    setPrice(value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };
  const priceNumber = (() => {
    const s = String(price);
    if (!s) return 0;
    return s.includes(",")
      ? parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0
      : parseFloat(s) || 0;
  })();

  const CATEGORIES = [
    { value: "infoproduto", label: "Infoproduto",     desc: "Conteúdo digital genérico", icon: Package },
    { value: "curso",       label: "Curso Online",    desc: "Aulas em módulos",          icon: GraduationCap },
    { value: "ebook",       label: "E-book",          desc: "Material em PDF",           icon: BookOpen },
    { value: "mentoria",    label: "Mentoria",        desc: "Acompanhamento 1:1",        icon: Users },
    { value: "software",    label: "Software / SaaS", desc: "Aplicativo ou ferramenta",  icon: Code2 },
    { value: "servico",     label: "Serviço",         desc: "Trabalho prestado",         icon: Briefcase },
    { value: "comunidade",  label: "Comunidade",      desc: "Grupo recorrente",          icon: MessageSquare },
    { value: "outro",       label: "Outro",           desc: "Modelo personalizado",      icon: Layers },
  ];

  return (
    <div className="space-y-8">
      {/* Section 1: Identity */}
      <section>
        <header className="mb-4">
          <h2 className="text-[15px] font-display font-black tracking-[-0.02em] text-foreground">Identidade do produto</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Como seu produto aparece para clientes e afiliados.</p>
        </header>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
            <div
              className={cn("relative border-b md:border-b-0 md:border-r border-border transition-colors", isDragging ? "bg-primary/5" : "bg-secondary/40")}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
              {imagePreview ? (
                <div className="relative h-full min-h-[220px] group/img">
                  <img src={imagePreview} alt="Preview" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-background/85 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-9 px-3 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:border-primary/40 transition-colors flex items-center gap-1.5">
                      <ImagePlus className="h-3.5 w-3.5" /> Trocar
                    </button>
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="h-9 w-9 rounded-lg bg-card border border-border text-destructive hover:border-destructive/40 transition-colors flex items-center justify-center">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="h-full min-h-[220px] w-full flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-foreground transition-colors p-6">
                  <div className="h-12 w-12 rounded-xl bg-card border border-border flex items-center justify-center">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">{isDragging ? "Solte aqui" : "Adicionar imagem"}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">JPG, PNG, WebP — até 10MB</p>
                    <p className="text-[10px] text-muted-foreground/50">Recomendado 300×250px</p>
                  </div>
                </button>
              )}
            </div>
            <div className="p-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nome do produto</label>
                <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Ex: Curso Completo de Marketing Digital" className="h-12 bg-secondary border-border text-lg font-display font-bold tracking-[-0.01em]" required maxLength={200} />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                  <span>{name.length > 0 ? "Visível no checkout e área de membros" : "Obrigatório"}</span>
                  <span className="tabular-nums">{name.length}/200</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Descrição</label>
                <Textarea value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} rows={4} placeholder="Descreva o que o aluno vai receber, principais benefícios e diferenciais (mínimo 50 caracteres)..." className={cn("resize-none bg-secondary border-border text-sm leading-relaxed", description.length > 0 && !descValid && "border-destructive/50")} maxLength={2000} />
                <div className="flex items-center justify-between text-[10px]">
                  <span className={cn(descValid ? "text-success" : description.length > 0 ? "text-destructive" : "text-muted-foreground/60")}>
                    {descValid ? "Descrição válida" : description.length > 0 ? `Faltam ${50 - description.length} caracteres` : "Mínimo 50 caracteres"}
                  </span>
                  <span className="tabular-nums text-muted-foreground/60">{description.length}/2000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Classification & Pricing */}
      <section>
        <header className="mb-4">
          <h2 className="text-[15px] font-display font-black tracking-[-0.02em] text-foreground">Categoria e preço</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Como seu produto é classificado e cobrado.</p>
        </header>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          <div className="p-5 space-y-3">
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Categoria</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((opt) => {
                const Icon = opt.icon;
                const active = category === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={cn(
                      "relative flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-colors duration-200",
                      active
                        ? "bg-primary/5 border-primary/40"
                        : "bg-secondary/40 border-border hover:border-primary/20"
                    )}
                  >
                    {active && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />}
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center border", active ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-[12px] font-display font-bold leading-tight truncate", active ? "text-primary" : "text-foreground")}>{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5 line-clamp-1">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-5 space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tipo de pagamento</label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger className="h-12 bg-card border-border font-display font-bold text-[13px] tracking-tight">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)] max-w-none p-1.5">
                <RichSelectItem value="unico" icon={DollarSign} label="Pagamento único" desc="Cobrança única (uma vez)" />
                <SelectPrimitive.Item
                  value="assinatura"
                  disabled
                  className="relative flex w-full cursor-not-allowed select-none items-center gap-3 rounded-xl px-2.5 py-2.5 outline-none opacity-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <SelectPrimitive.ItemText asChild>
                      <span className="block font-display text-[12.5px] font-bold tracking-tight text-foreground">Assinatura recorrente</span>
                    </SelectPrimitive.ItemText>
                    <span className="mt-0.5 block text-[10.5px] text-muted-foreground">Cobrança automática mensal</span>
                  </span>
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.12em] text-warning px-1.5 py-0.5 rounded border border-warning/40 bg-warning/10">Em breve</span>
                </SelectPrimitive.Item>
              </SelectContent>
            </Select>
          </div>
          <div className="p-5">
            <div className="flex items-end justify-between gap-6">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preço de venda</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-display font-bold text-muted-foreground">R$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePriceChange(e.target.value)}
                    className="h-14 pl-12 text-3xl font-numbers font-black tracking-[-0.03em] bg-secondary border-border text-success"
                    placeholder="0,00"
                  />
                </div>
                {priceNumber > 0 && (
                  <p className="text-[10px] font-bold text-muted-foreground">
                    Valor cobrado: R$ {priceNumber.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div className="w-32 space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Garantia</label>
                <Select value={warrantyDays} onValueChange={setWarrantyDays}>
                  <SelectTrigger className="h-14 bg-secondary border-border text-sm font-semibold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="14">14 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Producer info */}
      <section>
        <header className="mb-4">
          <h2 className="text-[15px] font-display font-black tracking-[-0.02em] text-foreground">Informações do produtor</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Dados obrigatórios exibidos ao comprador no checkout.</p>
        </header>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <ExternalLink className="h-3 w-3" /> Página de vendas
              </label>
              <Input value={pageUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPageUrl(e.target.value)} placeholder="seuproduto.com" type="text" className={cn("h-11 bg-secondary border-border", pageUrl && !urlValid && "border-destructive/50")} required />
              <p className={cn("text-[10px]", urlValid ? "text-success" : "text-muted-foreground/60")}>{urlValid ? "URL válida — o https:// é adicionado automaticamente" : "Insira o domínio (ex: seusite.com.br) — o https:// é opcional"}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> E-mail de suporte
              </label>
              <Input value={supportEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupportEmail(e.target.value)} placeholder="suporte@seuproduto.com" type="email" className={cn("h-11 bg-secondary border-border", supportEmail && !emailValid && "border-destructive/50")} required />
              <p className={cn("text-[10px]", emailValid ? "text-success" : "text-muted-foreground/60")}>{emailValid ? "E-mail válido" : "Insira um e-mail válido"}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> Telefone de suporte
              </label>
              <Input
                value={supportPhone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupportPhone(formatPhone(e.target.value))}
                placeholder="(11) 91234-5678"
                inputMode="tel"
                className={cn("h-11 bg-secondary border-border", supportPhone && !phoneValid && "border-destructive/50")}
                required
              />
              <p className={cn("text-[10px]", phoneValid ? "text-success" : "text-muted-foreground/60")}>{phoneValid ? "Telefone válido" : "Insira o DDD + número (10 ou 11 dígitos)"}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Nome de exibição do produtor
              </label>
              <Input value={displayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)} placeholder="Nome que aparecerá no checkout" className="h-11 bg-secondary border-border" required />
              <p className="text-[10px] text-muted-foreground/60">Aparecerá no rodapé do checkout</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Next/Save button — easier than scrolling up */}
      {onNext && (
        <div className="flex justify-end pt-2">
          <Button onClick={onNext} size="lg" className="gap-2 rounded-xl font-display font-bold px-8 h-12">
            Salvar e continuar <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

type TabConfiguracoesProps = {
  price: string;
  pixEnabled: boolean; setPixEnabled: BoolS;
  boletoEnabled: boolean; setBoletoEnabled: BoolS;
  creditCardEnabled: boolean; setCreditCardEnabled: BoolS;
  emailConfirm: boolean; setEmailConfirm: BoolS;
  showCouponField: boolean; setShowCouponField: BoolS;
  addressRequired: boolean; setAddressRequired: BoolS;
  deliveryType: string; setDeliveryType: StrS;
  adminBoletoEnabled?: boolean;
  adminCardEnabled?: boolean;
};

function TabConfiguracoes({ price, pixEnabled, setPixEnabled, boletoEnabled, setBoletoEnabled, creditCardEnabled, setCreditCardEnabled, emailConfirm, setEmailConfirm, showCouponField, setShowCouponField, addressRequired, setAddressRequired, deliveryType, setDeliveryType, adminBoletoEnabled = true, adminCardEnabled = true }: TabConfiguracoesProps) {
 return (
 <div className="space-y-6">
 <SectionHeader icon={Settings} title="Configurações" subtitle="Métodos de pagamento, formulário e entrega de conteúdo." />

 <EditorCard accentColor="bg-primary">
 <h3 className="text-[15px] font-display font-black text-foreground tracking-[-0.02em] flex items-center gap-2">
 <CreditCard className="h-4 w-4 text-primary" /> Métodos de pagamento
 </h3>
 <div className="space-y-2">
 <PaymentMethodRow icon={QrCode} label="PIX" sublabel="Taxa: 2,49% • Aprovação imediata" color="text-success" checked={pixEnabled} onChange={setPixEnabled} />
 {adminBoletoEnabled && <PaymentMethodRow icon={FileText} label="Boleto" sublabel="Taxa: 2,49% + R$ 2,49" color="text-warning" checked={boletoEnabled} onChange={setBoletoEnabled} />}
 {adminCardEnabled && <PaymentMethodRow icon={CreditCard} label="Cartão de Crédito" sublabel="Taxa: 6,38% • Até 12x" color="text-info" checked={creditCardEnabled} onChange={setCreditCardEnabled} />}
 </div>

 {/* Simulação de taxas — temporariamente desativada, voltaremos depois */}
 {false && price && parseFloat(price) > 0 && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-muted/5 border border-border p-3 space-y-2">
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
 : "bg-card border-border hover:border-border"
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
 <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
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

type TabOrderBumpProps = {
  isNew: boolean;
  orderBumps: { id: string; bump_product_id: string }[];
  allProducts: Tables<"products">[];
  availableForBump: Tables<"products">[];
  selectedBumpProduct: string; setSelectedBumpProduct: StrS;
  addBump: () => void | Promise<void>;
  removeBump: (id: string) => void | Promise<void>;
};

function TabOrderBump({ isNew, orderBumps, allProducts, availableForBump, selectedBumpProduct, setSelectedBumpProduct, addBump, removeBump }: TabOrderBumpProps) {
 return (
 <div className="space-y-6">
 <SectionHeader icon={Layers} title="Order Bump" subtitle="Adicione produtos complementares que aparecem como oferta no checkout." />

 {/* How it works */}
 <EditorCard accentColor="bg-info">
 <div className="flex items-start gap-3">
 <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
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
 {orderBumps.map((bump, i: number) => {
 const prod = allProducts.find((p) => p.id === bump.bump_product_id);
 return (
 <motion.div
 key={bump.id}
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: i * 0.05 }}
 className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 relative overflow-hidden group/bump hover:border-primary/20 transition-all"
 >
 <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-warning" />
 <div className="flex items-center gap-3 min-w-0 flex-1 pl-1">
 {prod?.image_url ? (
 <img src={prod.image_url} alt={prod.name} className="h-11 w-11 rounded-xl object-cover shrink-0" />
 ) : (
 <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
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
 ) : allProducts.length === 0 ? (
  <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-3">
    <div className="mx-auto h-12 w-12 rounded-2xl bg-warning/10 flex items-center justify-center">
      <Layers className="h-5 w-5 text-warning" />
    </div>
    <p className="text-sm font-display font-bold text-foreground">Sem produtos para oferecer</p>
    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
      Order bumps são produtos adicionais que aparecem no checkout. Você precisa ter pelo menos mais um produto ativo para configurar.
    </p>
    <Button onClick={() => window.open("/vendas/produtos/novo", "_blank")} variant="outline" className="gap-1.5 rounded-xl mt-2">
      <Plus className="h-4 w-4" /> Criar outro produto
    </Button>
  </div>
 ) : (
 <EmptyCard icon={Layers} message="Nenhum bump adicionado. Selecione um produto abaixo." />
 )}

 {availableForBump.length > 0 && orderBumps.length < 5 && (
 <div className="flex gap-2">
 <Select value={selectedBumpProduct} onValueChange={setSelectedBumpProduct}>
 <SelectTrigger className="flex-1 h-10 bg-secondary border-border"><SelectValue placeholder="Selecione um produto..." /></SelectTrigger>
 <SelectContent>
 {availableForBump.map((p) => (
 <SelectItem key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Button onClick={addBump} disabled={!selectedBumpProduct} className="gap-1.5 rounded-xl"><Plus className="h-4 w-4" /> Adicionar</Button>
 </div>
 )}
 {allProducts.length > 0 && <p className="text-xs text-muted-foreground/40 text-right font-numbers tabular-nums">{orderBumps.length}/5</p>}

 </>
 )}
 </div>
 );
}

type TabUpsellProps = {
  isNew: boolean;
  name: string; price: string; imagePreview: string | null;
  hasCustomThankYou: boolean; setHasCustomThankYou: BoolS;
  thankYouUrl: string; setThankYouUrl: StrS;
  sendConfirmationEmail: boolean; setSendConfirmationEmail: BoolS;
  emailTiming: string; setEmailTiming: StrS;
  upsellEnabled: boolean; setUpsellEnabled: BoolS;
  upsellType: string; setUpsellType: StrS;
  upsellName: string; setUpsellName: StrS;
  upsellPrice: string; setUpsellPrice: StrS;
  upsellDiscount: string; setUpsellDiscount: StrS;
  upsellUrl: string; setUpsellUrl: StrS;
  downsellEnabled: boolean; setDownsellEnabled: BoolS;
  downsellUrl: string; setDownsellUrl: StrS;
  downsellPrice: string; setDownsellPrice: StrS;
  downsellDelay: string; setDownsellDelay: StrS;
};

function TabUpsell({ isNew, name, price, imagePreview, hasCustomThankYou, setHasCustomThankYou, thankYouUrl, setThankYouUrl, sendConfirmationEmail, setSendConfirmationEmail, emailTiming, setEmailTiming,
  upsellEnabled, setUpsellEnabled, upsellType, setUpsellType, upsellName, setUpsellName, upsellPrice, setUpsellPrice, upsellDiscount, setUpsellDiscount, upsellUrl, setUpsellUrl,
  downsellEnabled, setDownsellEnabled, downsellUrl, setDownsellUrl, downsellPrice, setDownsellPrice, downsellDelay, setDownsellDelay }: TabUpsellProps) {

 const mainPrice = Number(price || 0);
 const upPrice = Number(upsellPrice || 0);
 const downPrice = Number(downsellPrice || 0);

 const isConfigured = upsellEnabled && upsellType !== "none";

 // Projected AOV: assume 18% accept upsell, 12% of refusers accept downsell
 const projectedAov = mainPrice + (isConfigured ? upPrice * 0.18 : 0) + (isConfigured && downsellEnabled ? downPrice * 0.12 * 0.82 : 0);
 const upliftPct = mainPrice > 0 ? Math.round(((projectedAov - mainPrice) / mainPrice) * 100) : 0;

 return (
 <div className="space-y-6">
 <SectionHeader icon={ArrowUpRight} title="Funil pós-pagamento" subtitle="Defina a sequência de ofertas exibidas após a compra inicial." />

 {/* Master toggle */}
 <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-4">
   <div className="flex items-start gap-3 min-w-0">
     <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", upsellEnabled ? "bg-primary/10 text-primary" : "bg-muted/30 text-muted-foreground/50")}>
       <ArrowUpRight className="h-4 w-4" />
     </div>
     <div className="min-w-0">
       <p className="text-sm font-display font-bold text-foreground">Ativar upsell pós-pagamento</p>
       <p className="text-xs text-muted-foreground/70 mt-0.5">Quando desligado, o comprador vai direto para a página de obrigado.</p>
     </div>
   </div>
   <Switch checked={upsellEnabled} onCheckedChange={setUpsellEnabled} />
 </div>

 {!upsellEnabled ? (
   <EmptyCard icon={ArrowUpRight} message="Upsell desativado. Ative acima para configurar o funil." />
 ) : (<>


 {/* ═══ FUNNEL FLOW VISUAL ═══ */}
 <div className="rounded-2xl border border-border bg-card overflow-hidden">
 <div className="px-5 py-4 border-b border-border flex items-center justify-between">
 <div>
 <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70 font-display font-bold">Sequência do funil</p>
 <p className="text-[15px] font-display font-black text-foreground mt-0.5 tracking-[-0.02em]">Jornada do comprador</p>
 </div>
 <div className="text-right">
 <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Ticket projetado</p>
 <p className="text-base font-numbers font-black text-success tabular-nums">
 R$ {projectedAov.toFixed(2)}
 {upliftPct > 0 && <span className="text-[10px] font-display font-bold text-success/80 ml-1.5">+{upliftPct}%</span>}
 </p>
 </div>
 </div>

 <div className="p-5 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-3 md:gap-2 items-stretch">
 <FunnelStep
 step="01"
 status="active"
 label="Produto principal"
 title={name || "Seu produto"}
 price={mainPrice}
 thumb={imagePreview}
 anchor
 />
 <FunnelArrow />
 <FunnelStep
 step="02"
 status={isConfigured ? "active" : "empty"}
 label={isConfigured ? "Upsell" : "Sem upsell"}
 title={isConfigured ? (upsellName || "Oferta complementar") : "Configure abaixo"}
 price={isConfigured ? upPrice : undefined}
 badge={isConfigured && upsellDiscount ? `-${upsellDiscount}%` : undefined}
 />
 <FunnelArrow />
 <FunnelStep
 step="03"
 status={downsellEnabled ? "active" : "empty"}
 label={downsellEnabled ? "Downsell" : "Sem downsell"}
 title={downsellEnabled ? "Oferta de recuperação" : "Opcional"}
 price={downsellEnabled ? downPrice : undefined}
 muted
 />
 <FunnelArrow />
 <FunnelStep
 step="04"
 status="active"
 label="Confirmação"
 title="Página de obrigado"
 icon={Check}
 />
 </div>
 </div>

 {/* ═══ STEP 02 EDITOR — UPSELL TYPE ═══ */}
 <div className="rounded-2xl border border-border bg-card">
 <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
 <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-numbers font-black text-primary tabular-nums">02</div>
 <div className="flex-1 min-w-0">
 <p className="text-[15px] font-display font-black text-foreground tracking-[-0.02em]">Configurar oferta de upsell</p>
 <p className="text-xs text-muted-foreground/70 mt-0.5">Exibida imediatamente após o pagamento aprovado.</p>
 </div>
 </div>

 <div className="p-5 space-y-5">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
 {[
 { value: "none", label: "Nenhum", desc: "Ir direto para confirmação", icon: Check },
 { value: "page", label: "Página externa", desc: "Redirecionar para URL própria", icon: ExternalLink },
 { value: "popup", label: "Popup nativo", desc: "Oferta sobre página de obrigado", icon: Sparkles },
 ].map((opt) => {
 const selected = upsellType === opt.value;
 return (
 <button
 key={opt.value}
 type="button"
 onClick={() => { setUpsellType(opt.value); if (opt.value !== "none") setHasCustomThankYou(opt.value === "page"); }}
 className={cn(
 "group relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors",
 selected ? "bg-primary/5 border-primary/40" : "bg-card border-border hover:border-border/80"
 )}
 >
 {selected && <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-primary" />}
 <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors", selected ? "bg-primary/10 text-primary" : "bg-muted/30 text-muted-foreground/50")}>
 <opt.icon className="h-4 w-4" />
 </div>
 <div className="min-w-0">
 <p className={cn("text-[13px] font-display font-bold leading-tight", selected ? "text-foreground" : "text-foreground/80")}>{opt.label}</p>
 <p className="text-[11px] text-muted-foreground/60 mt-1 leading-snug">{opt.desc}</p>
 </div>
 </button>
 );
 })}
 </div>

 <AnimatePresence initial={false}>
 {upsellType === "popup" && (
 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
 <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-3 pt-1">
 <div className="space-y-1.5">
 <EditorLabel>Nome da oferta</EditorLabel>
 <Input value={upsellName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUpsellName(e.target.value)} placeholder="Ex: Mentoria 1:1 com 30% OFF" className="h-10 bg-secondary border-border" />
 </div>
 <div className="space-y-1.5">
 <EditorLabel>Preço (R$)</EditorLabel>
 <Input type="number" value={upsellPrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUpsellPrice(e.target.value)} placeholder="0,00" className="h-10 bg-secondary border-border font-numbers tabular-nums" />
 </div>
 <div className="space-y-1.5">
 <EditorLabel>Desconto (%)</EditorLabel>
 <Input type="number" min="0" max="90" value={upsellDiscount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUpsellDiscount(e.target.value)} className="h-10 bg-secondary border-border font-numbers tabular-nums" />
 </div>
 </div>
 </motion.div>
 )}
 {upsellType === "page" && (
 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
 <div className="space-y-1.5 pt-1">
 <EditorLabel>URL da página de upsell</EditorLabel>
 <Input value={thankYouUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThankYouUrl(e.target.value)} placeholder="https://seusite.com/oferta-especial" type="url" className="h-10 bg-secondary border-border" />
 <p className="text-[11px] text-muted-foreground/60">O comprador será redirecionado após pagamento aprovado.</p>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>

 {/* ═══ STEP 03 EDITOR — DOWNSELL ═══ */}
 <div className={cn("rounded-2xl border bg-card transition-colors", downsellEnabled ? "border-border" : "border-border/60")}>
 <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
 <div className={cn("h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-numbers font-black tabular-nums", downsellEnabled ? "bg-info/10 text-info" : "bg-muted/40 text-muted-foreground/50")}>03</div>
 <div className="flex-1 min-w-0">
 <p className="text-[15px] font-display font-black text-foreground tracking-[-0.02em]">Oferta de recuperação (Downsell)</p>
 <p className="text-xs text-muted-foreground/70 mt-0.5">Acionada apenas se o cliente recusar o upsell.</p>
 </div>
 <Switch checked={downsellEnabled} onCheckedChange={setDownsellEnabled} />
 </div>

 <AnimatePresence initial={false}>
 {downsellEnabled && (
 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
 <div className="p-5 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-3">
 <div className="space-y-1.5">
 <EditorLabel>URL ou identificador da oferta</EditorLabel>
 <Input value={downsellUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDownsellUrl(e.target.value)} placeholder="https://..." type="url" className="h-10 bg-secondary border-border" />
 </div>
 <div className="space-y-1.5">
 <EditorLabel>Preço reduzido (R$)</EditorLabel>
 <Input type="number" value={downsellPrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDownsellPrice(e.target.value)} placeholder="0,00" className="h-10 bg-secondary border-border font-numbers tabular-nums" />
 </div>
 <div className="space-y-1.5">
 <EditorLabel>Delay (s)</EditorLabel>
 <Input type="number" min="0" max="30" value={downsellDelay} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDownsellDelay(e.target.value)} className="h-10 bg-secondary border-border font-numbers tabular-nums text-center" />
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* ═══ STEP 04 EDITOR — CONFIRMATION EMAIL ═══ */}
 <div className="rounded-2xl border border-border bg-card">
 <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
 <div className="h-6 w-6 rounded-md bg-success/10 flex items-center justify-center text-[10px] font-numbers font-black text-success tabular-nums">04</div>
 <div className="flex-1 min-w-0">
 <p className="text-[15px] font-display font-black text-foreground tracking-[-0.02em]">E-mail de confirmação</p>
 <p className="text-xs text-muted-foreground/70 mt-0.5">Define quando o acesso é entregue ao comprador.</p>
 </div>
 <Switch checked={sendConfirmationEmail} onCheckedChange={setSendConfirmationEmail} />
 </div>

 <AnimatePresence initial={false}>
 {sendConfirmationEmail && (
 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
 <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
 {[
 { val: "immediate", label: "Enviar imediatamente", desc: "Logo após pagamento aprovado", icon: Zap },
 { val: "after_upsell", label: "Após o funil completo", desc: "Aguarda fim de upsell/downsell", icon: Clock },
 ].map(opt => {
 const selected = emailTiming === opt.val;
 return (
 <button
 key={opt.val}
 type="button"
 onClick={() => setEmailTiming(opt.val)}
 className={cn(
 "relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors",
 selected ? "bg-success/5 border-success/40" : "bg-card border-border hover:border-border/80"
 )}
 >
 {selected && <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-success" />}
 <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", selected ? "bg-success/10 text-success" : "bg-muted/30 text-muted-foreground/50")}>
 <opt.icon className="h-4 w-4" />
 </div>
 <div className="min-w-0">
 <p className="text-[13px] font-display font-bold leading-tight text-foreground">{opt.label}</p>
 <p className="text-[11px] text-muted-foreground/60 mt-1 leading-snug">{opt.desc}</p>
 </div>
 </button>
 );
 })}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </>)}
 </div>
 );
}


/* ───── Funnel sub-primitives ───── */
type FunnelStepProps = {
  step: number | string;
  status: string;
  label: string;
  title: string;
  price?: string | number;
  thumb?: string | null;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
  anchor?: boolean | string;
  muted?: boolean;
};

function FunnelStep({ step, status, label, title, price, thumb, badge, icon: Icon, anchor, muted }: FunnelStepProps) {
 const isEmpty = status === "empty";
 return (
 <div className={cn(
 "relative rounded-xl border p-3.5 flex flex-col gap-2 min-h-[112px]",
 anchor ? "bg-primary/[0.04] border-primary/30" : isEmpty ? "bg-muted/10 border-dashed border-border/70" : "bg-card border-border"
 )}>
 <div className="flex items-center justify-between">
 <span className={cn(
 "text-[10px] font-numbers font-black tabular-nums tracking-wider",
 anchor ? "text-primary" : isEmpty ? "text-muted-foreground/40" : "text-muted-foreground/70"
 )}>{step}</span>
 {badge && (
 <span className="text-[9px] font-display font-black px-1.5 py-0.5 rounded-md bg-success/10 text-success tabular-nums">{badge}</span>
 )}
 </div>
 <div className="flex items-center gap-2.5 min-w-0">
 {thumb ? (
 <img src={thumb} alt="" className="h-9 w-9 rounded-lg object-cover border border-border shrink-0" />
 ) : Icon ? (
 <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", isEmpty ? "bg-muted/20 text-muted-foreground/40" : "bg-success/10 text-success")}>
 <Icon className="h-4 w-4" />
 </div>
 ) : (
 <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", isEmpty ? "bg-muted/20 text-muted-foreground/40" : "bg-muted/30 text-muted-foreground/60")}>
 <Package className="h-4 w-4" />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <p className={cn("text-[10px] uppercase tracking-wider font-display font-bold leading-tight", isEmpty ? "text-muted-foreground/50" : "text-muted-foreground/70")}>{label}</p>
 <p className={cn("text-[13px] font-display font-bold truncate leading-tight mt-0.5", isEmpty ? "text-muted-foreground/60" : "text-foreground")}>{title}</p>
 </div>
 </div>
 {typeof price === "number" && price > 0 && (
 <p className={cn("text-xs font-numbers font-black tabular-nums mt-auto", anchor ? "text-primary" : "text-foreground/80")}>R$ {price.toFixed(2)}</p>
 )}
 </div>
 );
}

function FunnelArrow() {
 return (
 <div className="flex md:flex-col items-center justify-center text-muted-foreground/30 py-1 md:py-0">
 <ArrowUpRight className="h-3.5 w-3.5 rotate-45 md:rotate-0" />
 </div>
 );
}

type TabCheckoutProps = {
  isNew: boolean;
  name: string; price: string; productId?: string;
  buttonColor: string; setButtonColor: StrS;
  timerEnabled: boolean; setTimerEnabled: BoolS;
  timerMinutes: string; setTimerMinutes: StrS;
  socialProof: boolean; setSocialProof: BoolS;
  guaranteeEnabled: boolean; setGuaranteeEnabled: BoolS;
  warrantyDays: string;
  bannerDesktopPreview: string; bannerMobilePreview: string;
  desktopBannerRef: RefObject<HTMLInputElement>;
  mobileBannerRef: RefObject<HTMLInputElement>;
  handleBannerFile: (e: ChangeEvent<HTMLInputElement>, kind: "desktop" | "mobile") => void;
  setBannerDesktopFile: S<File | null>;
  setBannerDesktopPreview: StrS;
  setBannerMobileFile: S<File | null>;
  setBannerMobilePreview: StrS;
  getCheckoutLink: () => string;
  copyLink: (text: string) => void;
  navigate: (path: string) => void;
  pixEnabled: boolean; boletoEnabled: boolean; creditCardEnabled: boolean;
};

function TabCheckout({ isNew, name, price, productId, buttonColor, setButtonColor, timerEnabled, setTimerEnabled, timerMinutes, setTimerMinutes, socialProof, setSocialProof, guaranteeEnabled, setGuaranteeEnabled, warrantyDays, bannerDesktopPreview, bannerMobilePreview, desktopBannerRef, mobileBannerRef, handleBannerFile, setBannerDesktopFile, setBannerDesktopPreview, setBannerMobileFile, setBannerMobilePreview, getCheckoutLink, copyLink, navigate, pixEnabled, boletoEnabled, creditCardEnabled }: TabCheckoutProps) {
 const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

 return (
 <div className="space-y-6">
 <SectionHeader icon={ShoppingCart} title="Checkout" subtitle="Gerencie e personalize seus checkouts." />
 {isNew ? (
 <EmptyCard icon={ShoppingCart} message="Salve o produto primeiro para personalizar o checkout." />
 ) : (
 <>
 {/* Checkout Quick Actions Card */}
 <div className="rounded-2xl border border-border bg-card overflow-hidden relative">
 <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
 <div className="p-5 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
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
 <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
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
 "mx-auto rounded-xl border border-border bg-background overflow-hidden transition-all duration-300",
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
 <div className="h-10 w-10 rounded-lg bg-muted/10 flex items-center justify-center shrink-0 border border-border">
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
 <input type="color" value={buttonColor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setButtonColor(e.target.value)} className="w-12 h-12 rounded-xl border border-border cursor-pointer" />
 </div>
 <Input value={buttonColor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setButtonColor(e.target.value)} className="flex-1 font-mono text-sm bg-secondary border-border h-11" />
 <motion.div whileHover={{ scale: 1.02 }} className="h-11 px-8 rounded-xl flex items-center justify-center text-sm font-display font-black text-primary-foreground cursor-default" style={{ backgroundColor: buttonColor }}>
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
 className={cn("h-6 w-6 rounded-lg border-2 transition-all hover:scale-110", buttonColor === c ? "border-foreground ring-1 ring-foreground/20 scale-110" : "border-border")}
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
 <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimerMinutes(e.target.value)} className="w-16 h-8 text-center text-xs bg-secondary border-border" />
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
 <BannerUpload label="Banner Desktop" sublabel="Recomendado: 1200×200px" preview={bannerDesktopPreview} inputRef={desktopBannerRef} onFile={(e: React.ChangeEvent<HTMLInputElement>) => handleBannerFile(e, "desktop")} onClear={() => { setBannerDesktopFile(null); setBannerDesktopPreview(""); }} />
 <BannerUpload label="Banner Mobile" sublabel="Recomendado: 600×200px" preview={bannerMobilePreview} inputRef={mobileBannerRef} onFile={(e: React.ChangeEvent<HTMLInputElement>) => handleBannerFile(e, "mobile")} onClear={() => { setBannerMobileFile(null); setBannerMobilePreview(""); }} />
 </div>
 </EditorCard>
 </>
 )}
 </div>
 );
}

type TabCoProducaoProps = {
  isNew: boolean;
  coProducerEmail: string; setCoProducerEmail: StrS;
  coProductionSplit: string; setCoProductionSplit: StrS;
  coProductionDuration: string; setCoProductionDuration: StrS;
  coProductionSalesType: string; setCoProductionSalesType: StrS;
  coProductionsList?: Tables<"co_productions">[];
  inviteCoProducer: () => void | Promise<void>;
  removeCoProducer: (id: string) => void | Promise<void>;
  invitingCoProducer: boolean;
};

function TabCoProducao({ isNew, coProducerEmail, setCoProducerEmail, coProductionSplit, setCoProductionSplit, coProductionDuration, setCoProductionDuration, coProductionSalesType, setCoProductionSalesType, coProductionsList = [], inviteCoProducer, removeCoProducer, invitingCoProducer }: TabCoProducaoProps) {
 return (
 <div className="space-y-6">
 <SectionHeader icon={Handshake} title="Co-Produção" subtitle="Divida receitas com parceiros de produção." />

 {/* Info card */}
 <EditorCard accentColor="bg-info">
 <div className="flex items-start gap-3">
 <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
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
 <Input value={coProducerEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCoProducerEmail(e.target.value)} placeholder="email@coprodutor.com" type="email" className="h-11 bg-secondary border-border" />
 </div>
 <div className="space-y-2">
 <EditorLabel icon={Clock}>Tempo de duração</EditorLabel>
 <Select value={coProductionDuration} onValueChange={setCoProductionDuration}>
 <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
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
 <Input type="number" min="1" max="99" value={coProductionSplit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCoProductionSplit(e.target.value)} className="w-24 h-11 text-center font-numbers font-black text-lg bg-secondary border-border" />
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
 <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todas as vendas</SelectItem>
 <SelectItem value="producer_only">Vendas do produtor</SelectItem>
 <SelectItem value="affiliate_only">Vendas dos afiliados</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <Button onClick={inviteCoProducer} className="gap-2 rounded-xl font-display font-bold" disabled={!coProducerEmail || invitingCoProducer}>
 <UserPlus className="h-4 w-4" /> {invitingCoProducer ? "Enviando..." : "Convidar Co-Produtor"}
 </Button>
 </EditorCard>

 {coProductionsList.length > 0 ? (
   <div className="space-y-2">
     {coProductionsList.map((cp) => (
       <div key={cp.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 relative overflow-hidden">
         <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
           cp.status === "accepted" ? "bg-success" : cp.status === "rejected" ? "bg-destructive" : "bg-warning")} />
         <div className="flex items-center gap-3 pl-1 min-w-0">
           <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
             cp.status === "accepted" ? "bg-success/10 text-success" : cp.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>
             <Handshake className="h-4 w-4" />
           </div>
           <div className="min-w-0">
             <p className="text-sm font-display font-bold truncate">{cp.co_producer_email}</p>
             <p className="text-[11px] text-muted-foreground/70 font-numbers">
               {cp.split_percentage}% • {cp.status === "accepted" ? "Aceito" : cp.status === "rejected" ? "Rejeitado" : "Convite pendente"}
             </p>
           </div>
         </div>
         <Button variant="ghost" size="sm" onClick={() => removeCoProducer(cp.id)} className="text-destructive hover:text-destructive h-9 w-9 p-0 rounded-xl">
           <Trash2 className="h-4 w-4" />
         </Button>
       </div>
     ))}
   </div>
 ) : (
   <EmptyCard icon={Handshake} message="Nenhum co-produtor cadastrado" />
 )}

 </>
 )}
 </div>
 );
}

type TabCuponsProps = {
  isNew: boolean;
  coupons: Tables<"coupons">[];
  newCouponCode: string; setNewCouponCode: StrS;
  newCouponType: string; setNewCouponType: StrS;
  newCouponValue: string; setNewCouponValue: StrS;
  newCouponMaxUses: string; setNewCouponMaxUses: StrS;
  creatingCoupon: boolean;
  createCoupon: () => void | Promise<void>;
  toggleCoupon: (coupon: Tables<"coupons">) => void | Promise<void>;
  deleteCoupon: (id: string) => void | Promise<void>;
};

function TabCupons({ isNew, coupons, newCouponCode, setNewCouponCode, newCouponType, setNewCouponType, newCouponValue, setNewCouponValue, newCouponMaxUses, setNewCouponMaxUses, creatingCoupon, createCoupon, toggleCoupon, deleteCoupon }: TabCuponsProps) {
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
 <Input value={newCouponCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCouponCode(e.target.value.toUpperCase())} placeholder="EX: DESCONTO20" className="h-11 bg-secondary border-border font-mono uppercase" maxLength={30} />
 </div>
 <div className="space-y-2">
 <EditorLabel>Tipo de desconto</EditorLabel>
 <Select value={newCouponType} onValueChange={setNewCouponType}>
 <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
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
 <Input type="number" min="0.01" max={newCouponType === "percentage" ? "100" : "99999"} step="0.01" value={newCouponValue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCouponValue(e.target.value)} className="h-11 bg-secondary border-border font-numbers font-black" placeholder="0" />
 </div>
 <div className="space-y-2">
 <EditorLabel>Usos máximos</EditorLabel>
 <Input type="number" min="1" value={newCouponMaxUses} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCouponMaxUses(e.target.value)} className="h-11 bg-secondary border-border font-numbers" placeholder="Ilimitado" />
 </div>
 </div>
 <Button onClick={createCoupon} disabled={creatingCoupon || !newCouponCode.trim()} className="gap-2 rounded-xl font-display font-bold w-full sm:w-auto">
 <Plus className="h-4 w-4" /> {creatingCoupon ? "Criando..." : "Criar Cupom"}
 </Button>
 </EditorCard>

 {coupons.length > 0 ? (
 <div className="space-y-2">
 {coupons.map((coupon, i: number) => (
 <motion.div
 key={coupon.id}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.03 }}
 className={cn(
 "rounded-2xl border bg-card p-4 flex items-center justify-between relative overflow-hidden transition-all",
 coupon.is_active ? "border-border" : "border-border opacity-60"
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

type TabAfiliadosProps = {
  isNew: boolean;
  productId?: string;
  affiliateEnabled: boolean; setAffiliateEnabled: BoolS;
  affiliateCommission: string; setAffiliateCommission: StrS;
  affiliateAttribution: string; setAffiliateAttribution: StrS;
  affiliateCookieDays: string; setAffiliateCookieDays: StrS;
  affiliateApprovalManual: boolean; setAffiliateApprovalManual: BoolS;
  affiliateUpsellCommission: boolean; setAffiliateUpsellCommission: BoolS;
  affiliateMarketplace: boolean; setAffiliateMarketplace: BoolS;
  affiliateSupportEmail: string; setAffiliateSupportEmail: StrS;
  affiliateDescription: string; setAffiliateDescription: StrS;
  copyLink: (text: string) => void;
};

function TabAfiliados({ isNew, productId, affiliateEnabled, setAffiliateEnabled, affiliateCommission, setAffiliateCommission, affiliateAttribution, setAffiliateAttribution, affiliateCookieDays, setAffiliateCookieDays, affiliateApprovalManual, setAffiliateApprovalManual, affiliateUpsellCommission, setAffiliateUpsellCommission, affiliateMarketplace, setAffiliateMarketplace, affiliateSupportEmail, setAffiliateSupportEmail, affiliateDescription, setAffiliateDescription, copyLink }: TabAfiliadosProps) {
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
 <Input type="number" min="1" max="80" value={affiliateCommission} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAffiliateCommission(e.target.value)} className="w-24 h-11 text-center font-numbers font-black text-lg bg-secondary border-border" />
 <span className="text-lg font-display font-black text-muted-foreground">%</span>
 </div>
 </div>
 <div className="space-y-2">
 <EditorLabel>Atribuição</EditorLabel>
 <Select value={affiliateAttribution} onValueChange={setAffiliateAttribution}>
 <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
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
 <SelectTrigger className="h-11 w-40 bg-secondary border-border"><SelectValue /></SelectTrigger>
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
 <Input value={affiliateSupportEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAffiliateSupportEmail(e.target.value)} placeholder="suporte@..." type="email" className="h-11 bg-secondary border-border" />
 </div>
 <div className="space-y-2">
 <EditorLabel>Descrição para afiliados</EditorLabel>
 <Textarea value={affiliateDescription} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAffiliateDescription(e.target.value)} rows={2} placeholder="Descreva os benefícios..." className="resize-none bg-secondary border-border" />
 </div>
 </div>
 </EditorCard>

 {!isNew && (
 <EditorCard accentColor="bg-success">
 <h4 className="text-[15px] font-display font-black flex items-center gap-2"><UserPlus className="h-4 w-4 text-success" /> Convidar afiliados</h4>
 <p className="text-xs text-muted-foreground/60">Compartilhe esse link para convidar os seus afiliados:</p>
 <div className="flex items-center gap-2">
 <Input readOnly value={`${window.location.origin}/vendas/afiliados?product=${productId || ""}`} className="h-9 font-mono text-xs bg-muted/10 border-border" />
 <Button variant="outline" size="sm" onClick={() => copyLink(`${window.location.origin}/vendas/afiliados?product=${productId || ""}`)} className="gap-1.5 h-9 shrink-0 rounded-xl">

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

type TabLinksProps = {
  isNew: boolean;
  product: AnyObj | null;
  pageUrl: string;
  affiliateEnabled: boolean;
  productId?: string;
  getCheckoutLink: () => string;
  copyLink: (text: string) => void;
  name: string;
  price: string;
};

function TabLinks({ isNew, product, pageUrl, affiliateEnabled, productId, getCheckoutLink, copyLink, name, price }: TabLinksProps) {
   const [showQR, setShowQR] = useState(false);
   const checkoutLink = getCheckoutLink();
   const affiliateInviteLink = `${window.location.origin}/vendas/afiliados?product=${productId || ""}`;


  const shareLinks = [
    { label: "WhatsApp", icon: MessageSquare, url: `https://wa.me/?text=${encodeURIComponent(`Confira: ${name} por apenas R$ ${Number(price || 0).toFixed(2)}! ${checkoutLink}`)}` },
    { label: "Telegram", icon: Share2, url: `https://t.me/share/url?url=${encodeURIComponent(checkoutLink)}&text=${encodeURIComponent(`${name} — R$ ${Number(price || 0).toFixed(2)}`)}` },
    { label: "Twitter / X", icon: Megaphone, url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${name} — R$ ${Number(price || 0).toFixed(2)}`)}&url=${encodeURIComponent(checkoutLink)}` },
  ];

  type LinkRow = {
    type: string;
    typeColor: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    url: string;
    showQrToggle?: boolean;
  };

  const rows: LinkRow[] = [];
  if (product?.checkout_url && checkoutLink) {
    rows.push({
      type: "Checkout",
      typeColor: "bg-primary/10 text-primary border-primary/20",
      icon: ShoppingCart,
      label: "Link do Checkout",
      description: "Pagamento direto para este produto",
      url: checkoutLink,
      showQrToggle: true,
    });
  }
  if (pageUrl) {
    rows.push({
      type: "Página",
      typeColor: "bg-info/10 text-info border-info/20",
      icon: Globe,
      label: "Página de Vendas",
      description: "Landing page pública do produto",
      url: pageUrl,
    });
  }
  if (affiliateEnabled) {
    rows.push({
      type: "Afiliado",
      typeColor: "bg-warning/10 text-warning border-warning/20",
      icon: Users,
      label: "Convite de Afiliado",
      description: "Compartilhe para recrutar parceiros",
      url: affiliateInviteLink,
    });
  }

  return (
    <div className="space-y-6">
      <SectionHeader icon={Link2} title="Links de Venda" subtitle="Gerencie, compartilhe e monitore seus links de checkout." />

      {isNew ? (
        <EmptyCard icon={Link2} message="Salve o produto primeiro para gerar links." />
      ) : rows.length === 0 ? (
        <EmptyCard icon={Link2} message="Nenhum link disponível ainda." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-[140px_1fr_auto] gap-4 px-4 py-2.5 border-b border-border bg-muted/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Link</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Ações</span>
          </div>

          {rows.map((row, idx) => (
            <div key={row.label} className={cn("border-b border-border last:border-0", idx % 2 === 1 && "bg-muted/[0.04]")}>
              <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-3 md:gap-4 px-4 py-3.5 items-center">
                {/* Type pill + icon */}
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-muted/30 border border-border flex items-center justify-center shrink-0">
                    <row.icon className="h-3.5 w-3.5 text-foreground/70" />
                  </div>
                  <div className="min-w-0">
                    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border", row.typeColor)}>
                      {row.type}
                    </span>
                    <p className="text-[11px] text-muted-foreground/70 mt-1 truncate md:hidden">{row.description}</p>
                  </div>
                </div>

                {/* Link content */}
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-foreground mb-0.5">{row.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 mb-1.5 hidden md:block">{row.description}</p>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border">
                    <Link2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    <span className="font-mono text-[11px] text-foreground/80 truncate">{row.url}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 md:justify-end">
                  {row.showQrToggle && (
                    <Button
                      type="button"
                      variant={showQR ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowQR(!showQR)}
                      className="h-8 w-8 p-0 rounded-md"
                      title="Mostrar QR Code"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => window.open(row.url, "_blank")} className="h-8 w-8 p-0 rounded-md" title="Abrir link">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" onClick={() => copyLink(row.url)} className="h-8 gap-1.5 rounded-md font-semibold text-[11px] px-3">
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
              </div>

              {/* QR Code expansion (only for checkout row) */}
              <AnimatePresence>
                {row.showQrToggle && showQR && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col items-center gap-2 py-4 border-t border-border bg-muted/[0.03]">
                      <div className="bg-background p-3 rounded-lg border border-border">
                        <QRCodeSVG value={row.url} size={160} level="M" bgColor="transparent" fgColor="hsl(var(--foreground))" />
                      </div>
                      <p className="text-[10px] text-muted-foreground/60">Escaneie para acessar o checkout</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Quick share — compact strip */}
      {!isNew && checkoutLink && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Compartilhamento Rápido</h4>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {shareLinks.map(sl => (
              <a
                key={sl.label}
                href={sl.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-card hover:bg-muted/30 hover:border-primary/30 transition-colors text-[12px] font-semibold text-foreground"
              >
                <sl.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {sl.label}
              </a>
            ))}
          </div>
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
  const [courses, setCourses] = useState<Tables<"courses">[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleStats, setModuleStats] = useState<Record<string, { modules: number; lessons: number }>>({});
  const [creating, setCreating] = useState(false);

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
        const lessonsCount: Record<string, number> = {};
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

  const createCourse = async () => {
    if (!user || creating) return;
    setCreating(true);
    const { data, error } = await supabase.from("courses").insert({
      user_id: user.id, product_id: productId!, title: "Novo Curso", is_published: false
    } satisfies TablesInsert<"courses">).select().maybeSingle();
    setCreating(false);
    if (error || !data) { toast.error("Erro ao criar curso"); return; }
    navigate(`/vendas/conteudo/${data.id}/builder`);
  };

  if (isNew) {
    return (
      <div className="space-y-6">
        <header>
          <h2 className="text-[15px] font-display font-black tracking-[-0.02em] text-foreground">Conteúdo do produto</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Salve o produto primeiro para gerenciar cursos, módulos e aulas.</p>
        </header>
        <div className="rounded-2xl border border-border bg-card flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center border border-border">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">Salve o produto para acessar o conteúdo</p>
          <p className="text-xs text-muted-foreground">Você poderá criar cursos vinculados após o primeiro salvamento.</p>
        </div>
      </div>
    );
  }

  // Aggregate totals
  const totalModules = Object.values(moduleStats).reduce((a, s) => a + s.modules, 0);
  const totalLessons = Object.values(moduleStats).reduce((a, s) => a + s.lessons, 0);
  const publishedCount = courses.filter(c => c.is_published).length;

  return (
    <div className="space-y-6">
      {/* Header with primary action */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-display font-black tracking-[-0.02em] text-foreground">Conteúdo do produto</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Cursos, módulos e aulas entregues após a compra.</p>
        </div>
        {!loading && courses.length > 0 && (
          <Button onClick={createCourse} disabled={creating} className="h-10 gap-2 rounded-xl text-xs font-semibold">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            Novo curso
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 rounded-2xl border border-border bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center border border-border">
            <GraduationCap className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Nenhum curso criado</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">Crie seu primeiro curso para entregar conteúdo aos compradores deste produto.</p>
          </div>
          <Button onClick={createCourse} disabled={creating} className="h-10 gap-2 rounded-xl text-xs font-semibold">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            Criar primeiro curso
          </Button>
        </div>
      ) : (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-3 rounded-2xl border border-border bg-card divide-x divide-border overflow-hidden">
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cursos</p>
              <p className="mt-1.5 text-xl font-display font-black tabular-nums text-foreground">{courses.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{publishedCount} publicado{publishedCount !== 1 ? "s" : ""}</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Módulos</p>
              <p className="mt-1.5 text-xl font-display font-black tabular-nums text-foreground">{totalModules}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">no total</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Aulas</p>
              <p className="mt-1.5 text-xl font-display font-black tabular-nums text-foreground">{totalLessons}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">disponíveis</p>
            </div>
          </div>

          {/* Course list — dense rows */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cursos vinculados</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">{courses.length} {courses.length === 1 ? "item" : "itens"}</p>
            </div>
            <div className="divide-y divide-border">
              {courses.map((c) => {
                const stats = moduleStats[c.id] || { modules: 0, lessons: 0 };
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                    className="group w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-secondary/40 active:bg-secondary/60"
                  >
                    {/* Thumb */}
                    <div className="h-14 w-20 rounded-lg overflow-hidden shrink-0 bg-secondary border border-border relative">
                      {c.thumbnail_url ? (
                        <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <GraduationCap className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground truncate">{c.title}</h3>
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider border",
                          c.is_published
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-secondary text-muted-foreground border-border"
                        )}>
                          <span className={cn("h-1 w-1 rounded-full", c.is_published ? "bg-success" : "bg-muted-foreground/50")} />
                          {c.is_published ? "Publicado" : "Rascunho"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                        <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> {stats.modules} {stats.modules === 1 ? "módulo" : "módulos"}</span>
                        <span className="text-border">·</span>
                        <span className="flex items-center gap-1"><Video className="h-3 w-3" /> {stats.lessons} {stats.lessons === 1 ? "aula" : "aulas"}</span>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                      Gerenciar
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
 SHARED COMPONENTS
 ═══════════════════════════════════════════════ */

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
  <div className="flex items-center gap-3.5 mb-6">
  <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 border border-border flex items-center justify-center">
  <Icon className="h-5 w-5 text-primary" />
  </div>
  <div>
  <h2 className="text-[15px] font-display font-bold text-foreground tracking-[-0.02em]">{title}</h2>
  <p className="text-xs text-muted-foreground mt-0.5 font-display">{subtitle}</p>
  </div>
  </div>
  );
}

function EditorCard({ children, accentColor = "bg-primary" }: { children: React.ReactNode; accentColor?: string }) {
  return (
  <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 relative overflow-hidden hover:border-muted-foreground/20 transition-colors duration-250">
  <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", accentColor)} />
  {children}
  </div>
  );
}

function EditorLabel({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
  <Label className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
  {Icon && <Icon className="h-3 w-3 text-muted-foreground/60" />}
  {children}
  </Label>
  );
}

function EmptyCard({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
  <div className="rounded-2xl border border-border bg-card flex flex-col items-center justify-center py-16 gap-4">
  <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center border border-border">
  <Icon className="h-7 w-7 text-muted-foreground/30" />
  </div>
  <p className="text-sm font-display font-medium text-muted-foreground">{message}</p>
  </div>
  );
}

function ToggleRow({ icon: Icon, label, sublabel, checked, onChange, children }: {
  icon?: React.ComponentType<{ className?: string }>; label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
  <div className={cn(
  "flex items-center justify-between p-3.5 rounded-xl border transition-colors duration-200 relative",
  checked ? "border-primary/20 bg-primary/5" : "border-border bg-card hover:border-muted-foreground/20"
  )}>
  {checked && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />}
  <div className="flex items-center gap-3 flex-1">
  {Icon && (
  <div className={cn(
  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors duration-200",
  checked ? "bg-primary/10 border-primary/20" : "bg-secondary border-border"
  )}>
  <Icon className={cn("h-3.5 w-3.5 transition-colors duration-200", checked ? "text-primary" : "text-muted-foreground/50")} />
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
 const bgColor = color === "text-success" ? "bg-success/10" : color === "text-warning" ? "bg-warning/10" : "bg-info/10";

  return (
  <div className={cn(
  "flex items-center justify-between p-3.5 rounded-xl border transition-colors duration-200 relative",
  checked ? "bg-card border-border" : "bg-card border-border opacity-50"
  )}>
  {checked && <div className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-full", accentBg)} />}
  <div className="flex items-center gap-3">
  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center border border-border", bgColor)}>
  <Icon className={cn("h-4 w-4", color)} />
  </div>
  <div>
  <p className="text-sm font-semibold">{label}</p>
  {sublabel && <p className="text-[11px] text-muted-foreground font-numbers">{sublabel}</p>}
  </div>
  </div>
  <Switch checked={checked} onCheckedChange={onChange} />
  </div>
  );
}

function BannerUpload({ label, sublabel, preview, inputRef, onFile, onClear }: {
  label: string; sublabel?: string; preview: string; inputRef: React.RefObject<HTMLInputElement>; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void;
}) {
  return (
  <div className="space-y-2">
  <EditorLabel>{label}</EditorLabel>
  {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
  <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
  {preview ? (
  <div className="relative rounded-lg overflow-hidden border border-border group/banner">
  <img src={preview} alt={label} className="w-full h-24 object-cover" />
  <div className="absolute inset-0 bg-background/80 opacity-0 group-hover/banner:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
  <button type="button" onClick={() => inputRef.current?.click()} className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors duration-200 active:scale-95">
  <ImagePlus className="h-3.5 w-3.5 text-foreground" />
  </button>
  <button type="button" onClick={onClear} className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors duration-200 active:scale-95">
  <X className="h-3.5 w-3.5" />
  </button>
  </div>
  </div>
  ) : (
  <button type="button" onClick={() => inputRef.current?.click()} className="w-full h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-200 active:scale-[0.99]">
  <Upload className="h-4 w-4" /> Upload {label.toLowerCase()}
  </button>
  )}
  </div>
  );
}
