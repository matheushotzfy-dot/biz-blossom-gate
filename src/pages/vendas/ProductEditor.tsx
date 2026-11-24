import { useState, useRef, useEffect, useCallback, type ChangeEvent, type Dispatch, type SetStateAction, type RefObject } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateAll } from "@/hooks/useQueryData";
import { useSellerSkin } from "@/hooks/useSellerSkin";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { QRCodeSVG } from "qrcode.react";
import { StatusPill } from "@/components/seller-ui/tx";
import { FieldHint, FieldLabel, GroupBox, ToggleRow as FormToggleRow } from "@/components/seller-ui/form";
import { Notice, OptionCard, StepEmpty, StudioHeading, StudioPanel } from "@/components/seller-ui/studio";
import { STATUS_META, formatCurrency, getEffectiveStatus } from "@/components/products/productPresentation";
import {
  ArrowLeft,
  Save,
  Package,
  ImagePlus,
  X,
  Settings,
  ShoppingCart,
  ArrowUpRight,
  Users,
  Handshake,
  Tag,
  Link2,
  Trash2,
  Plus,
  ExternalLink,
  CreditCard,
  QrCode,
  FileText,
  Mail,
  Shield,
  Timer,
  Eye,
  Upload,
  Copy,
  Globe,
  Zap,
  Percent,
  Clock,
  Layers,
  UserPlus,
  Lock,
  Palette,
  Sparkles,
  Check,
  ChevronRight,
  GraduationCap,
  Video,
  Loader2,
  MessageSquare,
  Share2,
  Smartphone,
  Monitor,
  MoreHorizontal,
  Star,
  Megaphone,
  MapPin,
  Rocket,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const GUARANTEE_DAYS = 7; // o checkout público sempre mostra a garantia de 7 dias

type TabKey = "geral" | "configuracoes" | "conteudo" | "order-bump" | "upsell" | "checkout" | "co-producao" | "cupons" | "afiliados" | "links";

// Abas temporariamente desativadas — voltaremos a ativar futuramente.
const DISABLED_TABS: TabKey[] = ["conteudo", "cupons", "afiliados"];

const ALL_TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "geral", label: "Geral", icon: Package },
  { key: "configuracoes", label: "Configurações", icon: Settings },
  { key: "conteudo", label: "Conteúdo", icon: GraduationCap },
  { key: "order-bump", label: "Order bump", icon: Layers },
  { key: "upsell", label: "Upsell e downsell", icon: ArrowUpRight },
  { key: "checkout", label: "Checkout", icon: ShoppingCart },
  { key: "co-producao", label: "Co-produção", icon: Handshake },
  { key: "cupons", label: "Cupons", icon: Tag },
  { key: "afiliados", label: "Afiliados", icon: Users },
  { key: "links", label: "Links", icon: Link2 },
];

const TABS = ALL_TABS.filter(t => !DISABLED_TABS.includes(t.key));

const BUTTON_PRESETS = ["#10b981", "#2563eb", "#f97316", "#8b5cf6", "#e11d48", "#111827"];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Lê o preço digitado ("1.997,00", "297", "R$ 10,50") e devolve o número. */
const priceToNumber = (raw: string): number => {
  const s = String(raw ?? "").replace(/[^0-9,.-]/g, "");
  if (!s) return 0;
  const n = s.includes(",") ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const formatPriceInput = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });


export default function ProductEditor() {
 const { productId } = useParams<{ productId: string }>();
 const navigate = useNavigate();
 const { user } = useAuth();
 useSellerSkin();
  // Métodos bloqueados pelo admin ficam indisponíveis e também são validados no banco.
  const [adminPixEnabled, setAdminPixEnabled] = useState(true);
 const [adminBoletoEnabled, setAdminBoletoEnabled] = useState(false);
 const [adminCardEnabled, setAdminCardEnabled] = useState(true);
 const invalidateAll = useInvalidateAll();
 const routeIsNew = productId === "novo";
 const [createdProductId, setCreatedProductId] = useState<string | null>(null);
 // "isNew" = o produto ainda não foi criado. Depois do primeiro salvar a URL muda, mas a rota do React Router continua "novo".
 const isNew = routeIsNew && !createdProductId;

 const [activeTab, setActiveTab] = useState<TabKey>("geral");
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);
 const [loading, setLoading] = useState(!routeIsNew);
 const [deleteOpen, setDeleteOpen] = useState(false);
 const [deleting, setDeleting] = useState(false);
 const [duplicating, setDuplicating] = useState(false);
  const busyRef = useRef(false); // trava síncrona contra clique duplo em duplicar/excluir
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
  const [displayName, setDisplayName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");

 const [deliveryType, setDeliveryType] = useState("link");
 const [memberAreaEnabled, setMemberAreaEnabled] = useState(false);

 const [buttonColor, setButtonColor] = useState("#10b981");
 const [timerEnabled, setTimerEnabled] = useState(true);
 const [timerMinutes, setTimerMinutes] = useState("15");
 const [socialProof, setSocialProof] = useState(false);
 const [guaranteeEnabled, setGuaranteeEnabled] = useState(true);
 const [pixEnabled, setPixEnabled] = useState(true);
 const [boletoEnabled, setBoletoEnabled] = useState(false);
 const [creditCardEnabled, setCreditCardEnabled] = useState(true);
 const [addressRequired, setAddressRequired] = useState(false);
 const [emailConfirm, setEmailConfirm] = useState(true);
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
 if (priceToNumber(price) > 0) score++;
 if (description.trim().length >= 50) score++;
 if (imagePreview) score++;
 if (pageUrl) score++;
 if (supportEmail.trim()) score++;
 if (displayName.trim()) score++;
 if (status === "active") score++;
 return Math.round((score / total) * 100);
 })();

 // O que ainda falta para o produto ficar completo (mostrado ao lado das etapas).
 const missingItems = [
 !name.trim() && "nome",
 !(priceToNumber(price) > 0) && "preço",
 description.trim().length < 50 && "descrição",
 !imagePreview && "capa",
 !pageUrl && "página de vendas",
 !supportEmail.trim() && "e-mail de suporte",
 !displayName.trim() && "nome do produtor",
 status !== "active" && "aprovação da equipe",
 ].filter(Boolean) as string[];

 const effectiveProductId = createdProductId || productId;
 const tabsLocked = isNew;

 const tabCompleted = useCallback((key: TabKey): boolean => {
 switch (key) {
 case "geral": return !!(name && priceToNumber(price) > 0);
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
 if (routeIsNew || !user?.id) { setLoading(false); return; }
 (async () => {
 const { data, error } = await supabase.from("products").select("*").eq("id", productId!).eq("user_id", user.id).maybeSingle();
 if (error || !data) { toast.error("Produto não encontrado"); navigate("/vendas/produtos"); return; }
 setProduct(data);
 setName(data.name);
 setDescription(data.description || "");
 setPrice(formatPriceInput(Number(data.price)));
 setStatus(data.status);
 setPageUrl(data.page_url || "");
 setImagePreview(data.image_url || null);
 setButtonColor(data.checkout_button_color || "#10b981");
 setTimerEnabled(data.checkout_timer_enabled ?? true);
 setTimerMinutes(String(data.checkout_timer_minutes ?? 15));
 setSocialProof(data.checkout_social_proof ?? false);
 setGuaranteeEnabled(data.checkout_guarantee_enabled ?? true);
 setPixEnabled(data.checkout_pix_enabled ?? true);
 setBoletoEnabled(data.checkout_boleto_enabled ?? false);
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
   }, [productId, user?.id, routeIsNew]);


  // Carrega gates de pagamento definidos pelo admin no perfil do seller
  useEffect(() => {
    if (!user?.id) return;
     supabase.from("profiles").select("pix_enabled, boleto_enabled, credit_card_enabled").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
         if (data.pix_enabled === false) { setAdminPixEnabled(false); setPixEnabled(false); }
         setAdminBoletoEnabled(data.boleto_enabled === true);
         if (data.boleto_enabled !== true) setBoletoEnabled(false);
        if (data.credit_card_enabled === false) { setAdminCardEnabled(false); setCreditCardEnabled(false); }
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || isNew || !effectiveProductId) return;
 supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").neq("id", effectiveProductId)
 .then(({ data }) => { if (data) setAllProducts(data); });
 supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", effectiveProductId)
 .then(({ data }) => { if (data) setOrderBumps(data); });
 supabase.from("coupons").select("*").eq("user_id", user.id).eq("product_id", effectiveProductId).order("created_at", { ascending: false })
 .then(({ data }) => { if (data) setCoupons(data); });
 supabase.from("co_productions").select("*").eq("product_id", effectiveProductId).order("created_at", { ascending: false })
 .then(({ data }) => { if (data) setCoProductionsList(data); });
 }, [user?.id, effectiveProductId, isNew]);


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
     if (!HEX_COLOR.test(buttonColor.trim())) { toast.error("Use uma cor no formato #10b981 para o botão do checkout"); setActiveTab(isNew ? "geral" : "checkout"); return; }
     // sincroniza o input para refletir a URL normalizada (caso o usuário salve sem ter prefixo)
     if (normalizedPageUrl !== pageUrl) setPageUrl(normalizedPageUrl);

 setSaving(true);
 try {
 let imageUrl: string | null = imagePreview;
 if (imageFile) {
 const ext = imageFile.name.split(".").pop();
 const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
 imageUrl = await uploadImage(imageFile, "product-images", path);
 // O aviso do erro já foi exibido; não salvamos o produto sem a capa que a pessoa escolheu.
 if (!imageUrl) return;
 }

 let desktopUrl = bannerDesktopPreview;
 let mobileUrl = bannerMobilePreview;
 if (bannerDesktopFile && !isNew) {
 const ext = bannerDesktopFile.name.split(".").pop();
 const uploaded = await uploadImage(bannerDesktopFile, "checkout-banners", `${user.id}/${effectiveProductId}-desktop.${ext}`);
 if (!uploaded) return;
 desktopUrl = uploaded;
 }
 if (bannerMobileFile && !isNew) {
 const ext = bannerMobileFile.name.split(".").pop();
 const uploaded = await uploadImage(bannerMobileFile, "checkout-banners", `${user.id}/${effectiveProductId}-mobile.${ext}`);
 if (!uploaded) return;
 mobileUrl = uploaded;
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


 if (isNew) {
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
  // Rascunho completo vai para análise (o servidor só permite ao seller: draft → pending_review).
  // Não toca em status definidos pelo admin (pending_review/inactive/active).
  const updatePayload: TablesUpdate<"products"> = { ...productData };
  const currentStatus = product?.status;
  const hasAllEssentials = name.trim().length > 1 && priceNum >= 1 && (description.trim().length >= 10) && !!imageUrl;
  const submittingForReview = currentStatus === "draft" && hasAllEssentials;
  if (submittingForReview) {
    updatePayload.status = "pending_review";
  } else {
    delete updatePayload.status; // preserva status do admin
  }
  const { error } = await supabase.from("products").update(updatePayload).eq("id", effectiveProductId!).eq("user_id", user.id);
  if (error) {
    toast.error(error.hint === "product_status_restricted" ? "Esse status só pode ser alterado pela equipe Vemprapay." : "Erro ao salvar");
    return;
  }
  if (submittingForReview) {
    setStatus("pending_review");
    toast.success("Produto enviado para análise da equipe.");
  }

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
 // As imagens já estão no storage: passamos a usar as URLs públicas e não reenviamos a cada salvamento.
 setImageFile(null);
 if (imageUrl) setImagePreview(imageUrl);
 setBannerDesktopFile(null); setBannerMobileFile(null);
 if (desktopUrl) setBannerDesktopPreview(desktopUrl);
 if (mobileUrl) setBannerMobilePreview(mobileUrl);
 } finally { setSaving(false); }
 };

 const confirmDelete = async () => {
 if (!user || tabsLocked || !effectiveProductId || busyRef.current) return;
 busyRef.current = true;
 setDeleting(true);
 // Exclusão lógica, igual à da lista de produtos: mantém vendas e histórico para auditoria.
 const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString(), status: "inactive" }).eq("id", effectiveProductId).eq("user_id", user.id);
 setDeleting(false);
 if (error) { busyRef.current = false; toast.error("Erro ao excluir produto"); return; }
 setDeleteOpen(false);
 toast.success("Produto removido");
 invalidateAll(["products"]);
 navigate("/vendas/produtos");
 };

 const handleDuplicate = async () => {
 if (!user || tabsLocked || !product || busyRef.current) return;
 busyRef.current = true;
 setDuplicating(true);
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
 setDuplicating(false);
 if (error) { busyRef.current = false; toast.error("Erro ao duplicar"); return; }
 toast.success("Produto duplicado com sucesso!");
 invalidateAll(["products"]);
 navigate("/vendas/produtos");
 };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Use JPG, PNG, WebP ou GIF"); return; }
 if (file.size > MAX_FILE_SIZE) { toast.error("Imagem: máximo 5 MB"); return; }
 setImageFile(file); setImagePreview(URL.createObjectURL(file));
 };

 const handleDrop = useCallback((e: React.DragEvent) => {
 e.preventDefault(); setIsDragging(false);
 const file = e.dataTransfer.files[0];
 if (!file) return;
 if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Use JPG, PNG, WebP ou GIF"); return; }
 if (file.size > MAX_FILE_SIZE) { toast.error("Imagem: máximo 5 MB"); return; }
 setImageFile(file); setImagePreview(URL.createObjectURL(file));
 }, []);

 const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>, type: "desktop" | "mobile") => {
 const file = e.target.files?.[0];
 if (!file) return;
 if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Use JPG, PNG, WebP ou GIF"); return; }
 if (file.size > MAX_FILE_SIZE) { toast.error("Imagem: máximo 5 MB"); return; }
 if (type === "desktop") { setBannerDesktopFile(file); setBannerDesktopPreview(URL.createObjectURL(file)); }
 else { setBannerMobileFile(file); setBannerMobilePreview(URL.createObjectURL(file)); }
 };

 const addBump = async () => {
 if (!selectedBumpProduct || isNew) return;
 if (orderBumps.length >= 5) { toast.error("Máximo de 5 order bumps"); return; }
 if (orderBumps.some(b => b.bump_product_id === selectedBumpProduct)) { toast.error("Produto já adicionado"); return; }
 const { data, error } = await supabase.from("order_bumps").insert({
 product_id: effectiveProductId!, bump_product_id: selectedBumpProduct, sort_order: orderBumps.length,
 }).select("id, bump_product_id").maybeSingle();
 if (error || !data) { toast.error("Erro ao adicionar"); return; }
 setOrderBumps(prev => [...prev, data]);
 setSelectedBumpProduct("");
 toast.success("Order bump adicionado!");
 };

 const removeBump = async (id: string) => {
 if (!user) return;
 if (!effectiveProductId) { toast.error("Salve o produto antes de remover order bumps."); return; }
 // Defense-in-depth: only delete bumps whose parent product belongs to the caller
 const { error } = await supabase.from("order_bumps").delete().eq("id", id).eq("product_id", effectiveProductId);
 if (error) { toast.error("Erro ao remover order bump"); return; }
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
   if (!user) return;
   // Defense-in-depth: only owner can remove
   const { error } = await supabase.from("co_productions").delete().eq("id", id).eq("owner_user_id", user.id);
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
 product_id: effectiveProductId!,
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
 if (!user) return;
 const { error } = await supabase.from("coupons").update({ is_active: !coupon.is_active }).eq("id", coupon.id).eq("user_id", user.id);
 if (error) { toast.error("Erro ao atualizar"); return; }
 setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
 };

 const deleteCoupon = async (id: string) => {
 if (!user) return;
 const { error } = await supabase.from("coupons").delete().eq("id", id).eq("user_id", user.id);
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
 if (!navigator.clipboard) { toast.error("Não foi possível copiar. Copie o link manualmente."); return; }
 navigator.clipboard.writeText(link).then(
 () => toast.success("Link copiado!"),
 () => toast.error("Não foi possível copiar. Copie o link manualmente."),
 );
 };


  const effectiveStatus = product ? getEffectiveStatus(product) : "draft";
  const statusMeta = STATUS_META[effectiveStatus] ?? STATUS_META.draft;

  if (loading) {
    return (
      <div className="vp-seller-shell vp-stage grid h-[100dvh] place-items-center">
        <div role="status" className="flex flex-col items-center gap-4 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground"><Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" /></span>
          <div>
            <p className="text-[17px] font-extrabold tracking-[-0.02em] text-foreground">Carregando produto</p>
            <p className="mt-1 text-[14px] text-muted-foreground">Só um instante.</p>
          </div>
        </div>
      </div>
    );
  }

  const availableForBump = allProducts.filter(p => !orderBumps.some(b => b.bump_product_id === p.id));
  const currentIdx = TABS.findIndex(t => t.key === activeTab);
  const prevTab = currentIdx > 0 ? TABS[currentIdx - 1] : null;
  const nextTab = currentIdx >= 0 && currentIdx < TABS.length - 1 ? TABS[currentIdx + 1] : null;
  const goNext = () => {
    if (!nextTab) return;
    if (tabsLocked) { handleSave(); return; }
    setActiveTab(nextTab.key);
  };
  const goPrev = () => { if (prevTab && !tabsLocked) setActiveTab(prevTab.key); };

  return (
    <MotionConfig reducedMotion="user">
    <div className="vp-seller-shell vp-stage h-[100dvh] overflow-hidden">
      <div ref={contentRef} className="h-full overflow-y-auto overscroll-contain">
        <header className="sticky top-0 z-30 border-b border-border bg-background">
          <div className="mx-auto flex h-[72px] max-w-[1180px] items-center gap-3 px-4 sm:px-6">
            <button type="button" onClick={() => navigate("/vendas/produtos")} aria-label="Voltar para produtos" className="vp-orb"><ArrowLeft className="h-[18px] w-[18px]" /></button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <h1 className="truncate font-heading text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{name.trim() || "Novo produto"}</h1>
                <StatusPill label={statusMeta.label} tone={statusMeta.tone} className="hidden shrink-0 sm:inline-flex" />
              </div>
              <p className="hidden truncate text-[13px] text-muted-foreground sm:block">
                {isNew ? "Preencha o essencial e crie o produto. As outras etapas liberam em seguida." : "Edite uma etapa por vez e salve quando terminar."}
              </p>
            </div>
            {!tabsLocked && (
              <div className="hidden items-center gap-2 md:flex">
                <button type="button" onClick={handleDuplicate} disabled={duplicating} className="vp-ghost"><Copy className="h-4 w-4" /> Duplicar</button>
                <button type="button" onClick={() => setDeleteOpen(true)} aria-label="Excluir produto" className="vp-orb text-destructive"><Trash2 className="h-[18px] w-[18px]" /></button>
              </div>
            )}
            {!tabsLocked && (
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label="Mais ações do produto" className="vp-orb"><MoreHorizontal className="h-[18px] w-[18px]" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" collisionPadding={16} sideOffset={6} className="w-56 rounded-[22px] border-border bg-popover p-2">
                    <DropdownMenuItem onSelect={() => { handleDuplicate(); }} className="vp-r16 h-12 cursor-pointer gap-3 px-3 text-[14.5px] font-semibold"><Copy className="h-4 w-4" /> Duplicar produto</DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="vp-r16 h-12 cursor-pointer gap-3 px-3 text-[14.5px] font-semibold text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Excluir produto</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            <button type="button" onClick={handleSave} disabled={saving} className="vp-cta shrink-0 px-5 sm:px-6">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando…" : saved ? "Salvo" : isNew ? "Criar produto" : "Salvar"}
            </button>
          </div>
          <div role="progressbar" aria-label="Produto preenchido" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent} className="h-[3px] bg-border">
            <div className="h-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${completionPercent}%` }} />
          </div>
        </header>

        <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-5 px-4 pb-16 pt-5 sm:px-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-10 lg:pt-8">
          <aside className="max-lg:sticky max-lg:top-[75px] max-lg:z-20 max-lg:-mx-4 max-lg:border-b max-lg:border-border max-lg:bg-background max-lg:px-4 max-lg:py-2 sm:max-lg:-mx-6 sm:max-lg:px-6 lg:sticky lg:top-[104px] lg:self-start">
            <div className="vp-sheet hidden p-5 lg:block">
              <p className="text-[13px] font-semibold text-muted-foreground">Seu produto está</p>
              <p className="mt-1.5 font-heading text-[44px] font-extrabold leading-none tracking-[-0.05em] vp-green-ink tabular-nums">
                {completionPercent}<span className="text-[26px]">%</span> <span className="text-[15px] font-bold tracking-normal text-muted-foreground">pronto</span>
              </p>
              <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
                {missingItems.length === 0
                  ? "Tudo preenchido."
                  : <>Falta: {missingItems.slice(0, 3).join(", ")}{missingItems.length > 3 ? ` e mais ${missingItems.length - 3}` : ""}.</>}
              </p>
            </div>
            <nav aria-label="Etapas do produto" className="scrollbar-none flex gap-1.5 overflow-x-auto lg:mt-4 lg:flex-col lg:overflow-visible">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const completed = tabCompleted(tab.key);
                const locked = tab.key !== "geral" && tabsLocked;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    aria-disabled={locked || undefined}
                    onClick={() => { if (locked) { toast.error("Crie o produto antes de abrir esta etapa."); return; } setActiveTab(tab.key); }}
                    className="vp-pill lg:!h-11 lg:w-full lg:justify-start"
                  >
                    {locked ? <Lock className="h-4 w-4" /> : <tab.icon className="h-4 w-4" />}
                    <span>{tab.label}</span>
                    {completed && !isActive && !locked && <Check aria-label="Etapa preenchida" className="ml-auto hidden h-4 w-4 text-primary lg:block" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeTab === "geral" && <TabGeral
                  {...{ name, setName, description, setDescription, price, setPrice, statusKey: effectiveStatus, pageUrl, setPageUrl, imagePreview, setImagePreview, setImageFile, fileInputRef, handleFileChange, displayName, setDisplayName, supportEmail, setSupportEmail, supportPhone, setSupportPhone, isDragging, setIsDragging, handleDrop }}
                />}

                {activeTab === "configuracoes" && <TabConfiguracoes
                  {...{ pixEnabled, setPixEnabled, boletoEnabled, setBoletoEnabled, creditCardEnabled, setCreditCardEnabled, emailConfirm, setEmailConfirm, addressRequired, setAddressRequired, deliveryType, setDeliveryType, adminPixEnabled, adminBoletoEnabled, adminCardEnabled }}
                />}

                {activeTab === "conteudo" && <TabConteudo productId={effectiveProductId} isNew={tabsLocked} />}

                {activeTab === "order-bump" && <TabOrderBump
                  {...{ isNew: tabsLocked, orderBumps, allProducts, availableForBump, selectedBumpProduct, setSelectedBumpProduct, addBump, removeBump }}
                />}

                {activeTab === "upsell" && <TabUpsell
                  {...{ name, price, imagePreview, emailTiming, setEmailTiming,
                    upsellEnabled, setUpsellEnabled, upsellType, setUpsellType, upsellName, setUpsellName, upsellPrice, setUpsellPrice, upsellDiscount, setUpsellDiscount, upsellUrl, setUpsellUrl,
                    downsellEnabled, setDownsellEnabled, downsellUrl, setDownsellUrl, downsellPrice, setDownsellPrice, downsellDelay, setDownsellDelay }}
                />}

                {activeTab === "checkout" && <TabCheckout
                  {...{ isNew: tabsLocked, name, price, imagePreview, productId: effectiveProductId, buttonColor, setButtonColor, timerEnabled, setTimerEnabled, timerMinutes, setTimerMinutes, guaranteeEnabled, setGuaranteeEnabled, bannerDesktopPreview, bannerMobilePreview, desktopBannerRef, mobileBannerRef, handleBannerFile, setBannerDesktopFile, setBannerDesktopPreview, setBannerMobileFile, setBannerMobilePreview, getCheckoutLink, copyLink, navigate, pixEnabled, boletoEnabled, creditCardEnabled }}
                />}

                {activeTab === "co-producao" && <TabCoProducao
                  {...{ isNew: tabsLocked, coProducerEmail, setCoProducerEmail, coProductionSplit, setCoProductionSplit, coProductionsList, inviteCoProducer, removeCoProducer, invitingCoProducer }}
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

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
              <button type="button" onClick={goPrev} disabled={!prevTab || tabsLocked} className="vp-ghost">
                <ChevronRight className="h-4 w-4 rotate-180" /> {prevTab ? prevTab.label : "Anterior"}
              </button>
              {nextTab ? (
                <button type="button" onClick={goNext} disabled={saving} className="vp-cta">
                  {tabsLocked ? "Criar produto e continuar" : `Próxima: ${nextTab.label}`} <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={handleSave} disabled={saving} className="vp-cta">
                  <Save className="h-4 w-4" /> Salvar alterações
                </button>
              )}
            </div>
          </main>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open); }}>
        <AlertDialogContent className="max-w-md rounded-[28px] border-border bg-card p-6 sm:p-8">
          <AlertDialogHeader className="space-y-2 text-left">
            <span className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></span>
            <AlertDialogTitle className="font-heading text-[21px] font-extrabold tracking-[-0.03em]">Excluir este produto?</AlertDialogTitle>
            <AlertDialogDescription className="text-[14.5px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{name.trim() || "Este produto"}</span> sai da sua lista e o checkout deixa de funcionar. As vendas já feitas continuam no seu histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-2">
            <AlertDialogCancel disabled={deleting} className="vp-ghost m-0 h-11">Manter produto</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={deleting} className="vp-cta vp-cta-danger h-11">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Excluindo…" : "Excluir produto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </MotionConfig>
  );
}


/* ═══════════════════════════════════════════════
 TAB COMPONENTS
 ═══════════════════════════════════════════════ */

type S<T> = Dispatch<SetStateAction<T>>;
type StrS = S<string>;
type BoolS = S<boolean>;

const inputClass = "vp-field";
const selectTriggerClass = "h-12 vp-r16 border-border bg-background px-4 text-[15px] data-[placeholder]:font-normal data-[placeholder]:text-muted-foreground";

type TabGeralProps = {
  name: string; setName: StrS;
  description: string; setDescription: StrS;
  price: string; setPrice: StrS;
  statusKey: "draft" | "active" | "pending_review" | "inactive";
  pageUrl: string; setPageUrl: StrS;
  imagePreview: string | null; setImagePreview: S<string | null>;
  setImageFile: S<File | null>;
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  displayName: string; setDisplayName: StrS;
  supportEmail: string; setSupportEmail: StrS;
  supportPhone: string; setSupportPhone: StrS;
  isDragging: boolean; setIsDragging: BoolS;
  handleDrop: (e: React.DragEvent) => void;
};

const STATUS_TEXT: Record<TabGeralProps["statusKey"], string> = {
  draft: "Quando nome, preço, descrição e capa estiverem preenchidos, ao salvar o produto vai para a análise da equipe.",
  pending_review: "A equipe está revisando o produto. Assim que for aprovado, o checkout começa a aceitar pagamentos.",
  active: "O checkout está no ar e aceitando pagamentos.",
  inactive: "O checkout não está aceitando vendas.",
};

function TabGeral({ name, setName, description, setDescription, price, setPrice, statusKey, pageUrl, setPageUrl, imagePreview, setImagePreview, setImageFile, fileInputRef, handleFileChange, displayName, setDisplayName, supportEmail, setSupportEmail, supportPhone, setSupportPhone, isDragging, setIsDragging, handleDrop }: TabGeralProps) {
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
  const priceNumber = priceToNumber(price);
  const priceInvalid = price !== "" && (priceNumber < 1 || priceNumber > 99999.99);
  const status = STATUS_META[statusKey];

  return (
    <div className="space-y-5">
      <StudioHeading title="Informações do produto" subtitle="É o que o comprador vê no checkout. Preencha tudo para enviar o produto à análise." />

      <StudioPanel title="Sobre o produto">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="shrink-0">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" aria-label="Escolher imagem de capa" />
            <div
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "relative h-[148px] w-[148px] overflow-hidden rounded-[22px] border-2 transition-colors",
                imagePreview ? "border-border" : cn("border-dashed", isDragging ? "border-primary bg-accent" : "border-border bg-muted/60 hover:border-primary/50"),
              )}
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Capa do produto" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5">
                    <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Trocar capa" className="vp-orb !h-9 !w-9 shadow-sm"><ImagePlus className="h-4 w-4" /></button>
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} aria-label="Remover capa" className="vp-orb !h-9 !w-9 text-destructive shadow-sm"><X className="h-4 w-4" /></button>
                  </div>
                </>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  <ImagePlus className="h-7 w-7" />
                  <span className="text-[13.5px] font-semibold leading-tight">Adicionar capa</span>
                </button>
              )}
            </div>
            <FieldHint className="w-[148px]">JPG, PNG, WebP ou GIF, até 5 MB. Necessária para enviar à análise.</FieldHint>
          </div>

          <div className="min-w-0 flex-1 space-y-5">
            <div>
              <FieldLabel htmlFor="product-name">Nome do produto</FieldLabel>
              <Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Formação em marketing digital" className={inputClass} maxLength={200} />
              <FieldHint>É o nome que o comprador vê no checkout.</FieldHint>
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <label htmlFor="product-description" className="text-[13.5px] font-semibold text-foreground">Descrição</label>
                <span className={cn("text-[12.5px] tabular-nums", description.length > 0 && !descValid ? "font-semibold text-destructive" : "text-muted-foreground")}>{description.length}/2000</span>
              </div>
              <Textarea id="product-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Explique o que o comprador recebe e o resultado que pode esperar." aria-invalid={description.length > 0 && !descValid} className={cn(inputClass, "resize-none leading-relaxed")} maxLength={2000} />
              <FieldHint className={description.length > 0 && !descValid ? "text-destructive" : undefined}>
                {description.length > 0 && !descValid ? `Escreva mais ${50 - description.length} caracteres. O mínimo é 50.` : "Mínimo de 50 caracteres."}
              </FieldHint>
            </div>
          </div>
        </div>
      </StudioPanel>

      <StudioPanel title="Preço e cobrança">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="product-price">Preço de venda</FieldLabel>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-muted-foreground">R$</span>
              <Input id="product-price" inputMode="decimal" value={price} onChange={(event) => handlePriceChange(event.target.value)} placeholder="0,00" aria-invalid={priceInvalid} className={cn(inputClass, "!pl-12 text-[17px] font-bold tabular-nums")} />
            </div>
            <FieldHint className={priceInvalid ? "text-destructive" : undefined}>
              {priceInvalid ? "O preço vai de R$ 1,00 a R$ 99.999,99." : "De R$ 1,00 a R$ 99.999,99."}
            </FieldHint>
          </div>
          <div>
            <FieldLabel>Cobrança</FieldLabel>
            <div role="radiogroup" aria-label="Tipo de cobrança" className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
              <OptionCard selected onClick={() => undefined} icon={<CreditCard className="h-[18px] w-[18px]" />} title="Pagamento único" description="O comprador paga uma vez." />
              <OptionCard selected={false} disabled onClick={() => undefined} icon={<RefreshCw className="h-[18px] w-[18px]" />} title="Assinatura" badge="Em breve" description="Cobrança recorrente." />
            </div>
          </div>
        </div>
      </StudioPanel>

      <StudioPanel title="Publicação e suporte" subtitle="Para onde o comprador vai e como ele fala com você.">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="product-page">Página de vendas</FieldLabel>
            <Input id="product-page" value={pageUrl} onChange={(event) => setPageUrl(event.target.value)} placeholder="seuproduto.com" inputMode="url" aria-invalid={pageUrl !== "" && !urlValid} className={inputClass} />
            <FieldHint className={pageUrl !== "" && !urlValid ? "text-destructive" : undefined}>{pageUrl !== "" && !urlValid ? "Digite um endereço válido, como seuproduto.com." : "Pode digitar sem https://."}</FieldHint>
          </div>
          <div>
            <FieldLabel htmlFor="product-display-name">Nome do produtor</FieldLabel>
            <Input id="product-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Seu nome ou da sua marca" className={inputClass} />
            <FieldHint>Aparece no checkout como vendedor.</FieldHint>
          </div>
          <div>
            <FieldLabel htmlFor="product-support-email">E-mail de suporte</FieldLabel>
            <Input id="product-support-email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="suporte@seuproduto.com" type="email" aria-invalid={supportEmail !== "" && !emailValid} className={inputClass} />
            <FieldHint className={supportEmail !== "" && !emailValid ? "text-destructive" : undefined}>{supportEmail !== "" && !emailValid ? "Digite um e-mail válido." : "Para onde o comprador escreve se precisar de ajuda."}</FieldHint>
          </div>
          <div>
            <FieldLabel htmlFor="product-support-phone">Telefone de suporte</FieldLabel>
            <Input id="product-support-phone" value={supportPhone} onChange={(event) => setSupportPhone(formatPhone(event.target.value))} placeholder="(11) 91234-5678" inputMode="tel" aria-invalid={supportPhone !== "" && !phoneValid} className={inputClass} />
            <FieldHint className={supportPhone !== "" && !phoneValid ? "text-destructive" : undefined}>{supportPhone !== "" && !phoneValid ? "Digite o telefone com DDD." : "Com DDD."}</FieldHint>
          </div>
        </div>
      </StudioPanel>

      <StudioPanel title="Situação do produto">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusPill label={status.label} tone={status.tone} />
          <p className="min-w-0 flex-1 basis-[260px] text-[14px] leading-relaxed text-muted-foreground">{STATUS_TEXT[statusKey]}</p>
        </div>
      </StudioPanel>
    </div>
  );
}

type TabConfiguracoesProps = {
  pixEnabled: boolean; setPixEnabled: BoolS;
  boletoEnabled: boolean; setBoletoEnabled: BoolS;
  creditCardEnabled: boolean; setCreditCardEnabled: BoolS;
  emailConfirm: boolean; setEmailConfirm: BoolS;
  addressRequired: boolean; setAddressRequired: BoolS;
  deliveryType: string; setDeliveryType: StrS;
  adminBoletoEnabled?: boolean;
  adminCardEnabled?: boolean;
  adminPixEnabled?: boolean;
};

function TabConfiguracoes({ pixEnabled, setPixEnabled, boletoEnabled, setBoletoEnabled, creditCardEnabled, setCreditCardEnabled, emailConfirm, setEmailConfirm, addressRequired, setAddressRequired, deliveryType, setDeliveryType, adminPixEnabled = true, adminBoletoEnabled = true, adminCardEnabled = true }: TabConfiguracoesProps) {
  const methodsAllowed = (adminPixEnabled ? 1 : 0) + (adminBoletoEnabled ? 1 : 0) + (adminCardEnabled ? 1 : 0);
  const methodsOn = (adminPixEnabled && pixEnabled ? 1 : 0) + (adminBoletoEnabled && boletoEnabled ? 1 : 0) + (adminCardEnabled && creditCardEnabled ? 1 : 0);

  return (
    <div className="space-y-5">
      <StudioHeading title="Configurações" subtitle="Como o comprador paga, o que preenche e como recebe o conteúdo." />

      <StudioPanel title="Formas de pagamento" subtitle="O comprador escolhe entre as que estiverem ativas.">
        {methodsAllowed === 0 ? (
          <Notice tone="warn" icon={<AlertTriangle className="h-4 w-4" />} title="Nenhuma forma de pagamento liberada">
            Sua conta ainda não tem métodos de pagamento liberados. <Link to="/suporte" className="font-semibold text-primary underline-offset-2 hover:underline">Fale com o suporte</Link> para ativar.
          </Notice>
        ) : (
          <>
            <GroupBox>
              {adminPixEnabled && <FormToggleRow icon={<QrCode className="h-[18px] w-[18px]" />} title="Pix" description="Aprovação na hora."><Switch checked={pixEnabled} onCheckedChange={setPixEnabled} aria-label="Aceitar Pix" /></FormToggleRow>}
              {adminBoletoEnabled && <FormToggleRow icon={<FileText className="h-[18px] w-[18px]" />} title="Boleto" description="Para quem prefere pagar no banco." tone="warning"><Switch checked={boletoEnabled} onCheckedChange={setBoletoEnabled} aria-label="Aceitar boleto" /></FormToggleRow>}
              {adminCardEnabled && <FormToggleRow icon={<CreditCard className="h-[18px] w-[18px]" />} title="Cartão de crédito" description="Parcelamento em até 12x."><Switch checked={creditCardEnabled} onCheckedChange={setCreditCardEnabled} aria-label="Aceitar cartão de crédito" /></FormToggleRow>}
            </GroupBox>
            {methodsOn === 0 && (
              <Notice tone="warn" icon={<AlertTriangle className="h-4 w-4" />} className="mt-4">
                Ative pelo menos uma forma de pagamento. Sem isso, o comprador não consegue finalizar a compra.
              </Notice>
            )}
            <FieldHint className="mt-3">As taxas de cada método estão em <Link to="/financeiro/taxas" className="font-semibold text-primary underline-offset-2 hover:underline">Financeiro, Taxas</Link>.</FieldHint>
          </>
        )}
      </StudioPanel>

      <StudioPanel title="Formulário de compra" subtitle="Menos campos costumam vender mais.">
        <GroupBox>
          <FormToggleRow icon={<Mail className="h-[18px] w-[18px]" />} title="Confirmação de e-mail" description="O comprador digita o e-mail duas vezes."><Switch checked={emailConfirm} onCheckedChange={setEmailConfirm} aria-label="Pedir confirmação de e-mail" /></FormToggleRow>
          <FormToggleRow icon={<MapPin className="h-[18px] w-[18px]" />} title="Endereço do comprador" description="CEP com preenchimento automático."><Switch checked={addressRequired} onCheckedChange={setAddressRequired} aria-label="Pedir endereço do comprador" /></FormToggleRow>
        </GroupBox>
      </StudioPanel>

      <StudioPanel title="Entrega do conteúdo" subtitle="O que o comprador recebe depois de pagar.">
        <div role="radiogroup" aria-label="Entrega do conteúdo" className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          {[
            { value: "digital", label: "Área de membros", desc: "Aulas e materiais dentro da plataforma.", icon: Star },
            { value: "email", label: "Acesso por e-mail", desc: "Links e arquivos enviados por e-mail.", icon: Mail },
            { value: "link", label: "Só o pagamento", desc: "Você entrega o produto por conta própria.", icon: Link2 },
            { value: "external", label: "Área externa", desc: "Plataforma de terceiros.", icon: ExternalLink },
          ].map((opt) => (
            <OptionCard key={opt.value} selected={deliveryType === opt.value} onClick={() => setDeliveryType(opt.value)} icon={<opt.icon className="h-[18px] w-[18px]" />} title={opt.label} description={opt.desc} />
          ))}
        </div>
        {deliveryType === "digital" && (
          <Notice tone="ok" icon={<GraduationCap className="h-4 w-4" />} className="mt-4">
            Ao salvar, criamos o curso deste produto na Área de membros para você montar as aulas.
          </Notice>
        )}
      </StudioPanel>
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
    <div className="space-y-5">
      <StudioHeading title="Order bump" subtitle="Uma oferta extra que aparece no checkout, antes do pagamento. O comprador adiciona com um clique." />

      {isNew ? (
        <StepEmpty icon={<Layers className="h-7 w-7" />} title="Crie o produto primeiro">
          Salve a etapa Geral para poder oferecer outros produtos como order bump.
        </StepEmpty>
      ) : allProducts.length === 0 && orderBumps.length === 0 ? (
        <StepEmpty
          icon={<Layers className="h-7 w-7" />}
          title="Você ainda não tem outro produto ativo"
          action={<button type="button" onClick={() => window.open("/vendas/produtos/novo/editar", "_blank")} className="vp-cta"><Plus className="h-4 w-4" /> Criar outro produto</button>}
        >
          O order bump é outro produto seu, ativo, oferecido junto com este. Crie e ative mais um produto para configurar.
        </StepEmpty>
      ) : (
        <>
          <StudioPanel
            title="Ofertas neste checkout"
            subtitle="Até 5 por produto."
            aside={<span className="rounded-full bg-muted px-3 py-1 text-[13px] font-semibold tabular-nums text-muted-foreground">{orderBumps.length} de 5</span>}
          >
            {orderBumps.length > 0 ? (
              <GroupBox>
                {orderBumps.map((bump) => {
                  const prod = allProducts.find((p) => p.id === bump.bump_product_id);
                  return (
                    <div key={bump.id} className="flex items-center gap-3.5 px-4 py-3.5">
                      {prod?.image_url ? (
                        <img src={prod.image_url} alt="" className="h-12 w-12 shrink-0 rounded-[14px] object-cover" />
                      ) : (
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-accent text-accent-foreground"><Package className="h-5 w-5" /></span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold text-foreground">{prod?.name || "Produto indisponível"}</p>
                        <p className="text-[13.5px] font-bold tabular-nums vp-green-ink">{prod ? formatCurrency(Number(prod.price)) : "Pausado ou removido"}</p>
                      </div>
                      <button type="button" onClick={() => removeBump(bump.id)} aria-label={`Remover order bump ${prod?.name || ""}`.trim()} className="vp-orb text-destructive"><Trash2 className="h-[18px] w-[18px]" /></button>
                    </div>
                  );
                })}
              </GroupBox>
            ) : (
              <p className="rounded-[16px] border border-dashed border-border px-4 py-6 text-center text-[14px] text-muted-foreground">Nenhuma oferta ainda. Escolha um produto abaixo.</p>
            )}

            {availableForBump.length > 0 && orderBumps.length < 5 && (
              <div className="mt-6">
                <FieldLabel htmlFor="bump-select">Adicionar produto</FieldLabel>
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Select value={selectedBumpProduct} onValueChange={setSelectedBumpProduct}>
                    <SelectTrigger id="bump-select" className={cn(selectTriggerClass, "min-w-0 flex-1")}><SelectValue placeholder="Escolha um dos seus produtos" /></SelectTrigger>
                    <SelectContent>
                      {availableForBump.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} <span className="text-muted-foreground">{formatCurrency(Number(p.price))}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button type="button" onClick={addBump} disabled={!selectedBumpProduct} className="vp-cta"><Plus className="h-4 w-4" /> Adicionar</button>
                </div>
                <FieldHint>Só aparecem produtos seus que estão ativos.</FieldHint>
              </div>
            )}
          </StudioPanel>
        </>
      )}
    </div>
  );
}

type TabUpsellProps = {
  name: string; price: string; imagePreview: string | null;
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

function TabUpsell({ name, price, imagePreview, emailTiming, setEmailTiming,
  upsellEnabled, setUpsellEnabled, upsellType, setUpsellType, upsellName, setUpsellName, upsellPrice, setUpsellPrice, upsellDiscount, setUpsellDiscount, upsellUrl, setUpsellUrl,
  downsellEnabled, setDownsellEnabled, downsellUrl, setDownsellUrl, downsellPrice, setDownsellPrice, downsellDelay, setDownsellDelay }: TabUpsellProps) {

  const mainPrice = priceToNumber(price);
  const upPrice = Number(String(upsellPrice || 0).replace(",", ".")) || 0;
  const downPrice = Number(String(downsellPrice || 0).replace(",", ".")) || 0;
  const isConfigured = upsellEnabled && upsellType !== "none";

  return (
    <div className="space-y-5">
      <StudioHeading title="Upsell e downsell" subtitle="Ofertas mostradas depois que o comprador paga." />

      <Notice tone="warn" icon={<Rocket className="h-4 w-4" />} title="Ainda não aparece para o comprador">
        As ofertas pós-pagamento estão em desenvolvimento. O que você configurar aqui fica salvo e entra no ar quando o recurso for liberado.
      </Notice>

      <GroupBox>
        <FormToggleRow icon={<ArrowUpRight className="h-[18px] w-[18px]" />} title="Ativar upsell pós-pagamento" description="Desligado, o comprador vai direto para a página de obrigado.">
          <Switch checked={upsellEnabled} onCheckedChange={setUpsellEnabled} aria-label="Ativar upsell pós-pagamento" />
        </FormToggleRow>
      </GroupBox>

      {upsellEnabled && (
        <>
          <StudioPanel title="Jornada do comprador" subtitle="A sequência em que as ofertas aparecem.">
            <ol className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))]">
              <FunnelStep step={1} label="Compra" title={name || "Seu produto"} price={mainPrice} thumb={imagePreview} anchor />
              <FunnelStep step={2} label={isConfigured ? "Upsell" : "Sem upsell"} title={isConfigured ? (upsellName || "Oferta complementar") : "Vai direto à confirmação"} price={isConfigured ? upPrice : undefined} badge={isConfigured && upsellType === "popup" && upsellDiscount ? `-${upsellDiscount}%` : undefined} empty={!isConfigured} />
              <FunnelStep step={3} label={downsellEnabled ? "Downsell" : "Sem downsell"} title={downsellEnabled ? "Oferta de recuperação" : "Opcional"} price={downsellEnabled ? downPrice : undefined} empty={!downsellEnabled} />
              <FunnelStep step={4} label="Confirmação" title="Página de obrigado" icon={<Check className="h-4 w-4" />} />
            </ol>
          </StudioPanel>

          <StudioPanel title="Oferta de upsell" subtitle="Exibida logo depois do pagamento aprovado.">
            <div role="radiogroup" aria-label="Tipo de upsell" className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
              {[
                { value: "none", label: "Nenhum", desc: "Vai direto para a confirmação.", icon: Check },
                { value: "page", label: "Página externa", desc: "Leva para uma página sua.", icon: ExternalLink },
                { value: "popup", label: "Popup", desc: "Oferta sobre a página de obrigado.", icon: Sparkles },
              ].map((opt) => (
                <OptionCard key={opt.value} selected={upsellType === opt.value} onClick={() => setUpsellType(opt.value)} icon={<opt.icon className="h-[18px] w-[18px]" />} title={opt.label} description={opt.desc} />
              ))}
            </div>

            {upsellType === "popup" && (
              <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <FieldLabel htmlFor="upsell-name">Nome da oferta</FieldLabel>
                  <Input id="upsell-name" value={upsellName} onChange={(e) => setUpsellName(e.target.value)} placeholder="Ex.: Mentoria 1:1 com desconto" className={inputClass} />
                </div>
                <div>
                  <FieldLabel htmlFor="upsell-price">Preço (R$)</FieldLabel>
                  <Input id="upsell-price" type="number" min="0" step="0.01" inputMode="decimal" value={upsellPrice} onChange={(e) => setUpsellPrice(e.target.value)} placeholder="0,00" className={cn(inputClass, "tabular-nums")} />
                </div>
                <div>
                  <FieldLabel htmlFor="upsell-discount">Desconto (%)</FieldLabel>
                  <Input id="upsell-discount" type="number" min="0" max="90" value={upsellDiscount} onChange={(e) => setUpsellDiscount(e.target.value)} className={cn(inputClass, "tabular-nums")} />
                </div>
              </div>
            )}
            {upsellType === "page" && (
              <div className="mt-6">
                <FieldLabel htmlFor="upsell-url">Endereço da página de upsell</FieldLabel>
                <Input id="upsell-url" value={upsellUrl} onChange={(e) => setUpsellUrl(e.target.value)} placeholder="https://seusite.com/oferta-especial" type="url" className={inputClass} />
                <FieldHint>O comprador é levado para esse endereço depois que o pagamento é aprovado.</FieldHint>
              </div>
            )}
          </StudioPanel>

          <StudioPanel
            title="Oferta de recuperação (downsell)"
            subtitle="Só aparece se o comprador recusar o upsell."
            aside={<Switch checked={downsellEnabled} onCheckedChange={setDownsellEnabled} aria-label="Ativar downsell" />}
          >
            {downsellEnabled ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <FieldLabel htmlFor="downsell-url">Endereço da oferta</FieldLabel>
                  <Input id="downsell-url" value={downsellUrl} onChange={(e) => setDownsellUrl(e.target.value)} placeholder="https://..." type="url" className={inputClass} />
                </div>
                <div>
                  <FieldLabel htmlFor="downsell-price">Preço reduzido (R$)</FieldLabel>
                  <Input id="downsell-price" type="number" min="0" step="0.01" inputMode="decimal" value={downsellPrice} onChange={(e) => setDownsellPrice(e.target.value)} placeholder="0,00" className={cn(inputClass, "tabular-nums")} />
                </div>
                <div>
                  <FieldLabel htmlFor="downsell-delay">Atraso (segundos)</FieldLabel>
                  <Input id="downsell-delay" type="number" min="0" max="30" value={downsellDelay} onChange={(e) => setDownsellDelay(e.target.value)} className={cn(inputClass, "tabular-nums")} />
                </div>
              </div>
            ) : (
              <p className="text-[14px] text-muted-foreground">Desligado. Ative para oferecer um preço menor a quem recusar o upsell.</p>
            )}
          </StudioPanel>
        </>
      )}

      <StudioPanel title="Quando enviar o acesso" subtitle="Define o momento do e-mail de confirmação com o acesso ao comprador.">
        <div role="radiogroup" aria-label="Momento do e-mail de confirmação" className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          {[
            { val: "immediate", label: "Logo após o pagamento", desc: "Assim que o pagamento é aprovado.", icon: Zap },
            { val: "after_upsell", label: "Depois das ofertas", desc: "Espera o fim do upsell e do downsell.", icon: Clock },
          ].map((opt) => (
            <OptionCard key={opt.val} selected={emailTiming === opt.val} onClick={() => setEmailTiming(opt.val)} icon={<opt.icon className="h-[18px] w-[18px]" />} title={opt.label} description={opt.desc} />
          ))}
        </div>
      </StudioPanel>
    </div>
  );
}

/* ───── Funnel sub-primitives ───── */
type FunnelStepProps = {
  step: number;
  label: string;
  title: string;
  price?: number;
  thumb?: string | null;
  badge?: string;
  icon?: React.ReactNode;
  anchor?: boolean;
  empty?: boolean;
};

function FunnelStep({ step, label, title, price, thumb, badge, icon, anchor, empty }: FunnelStepProps) {
  return (
    <li className={cn(
      "relative flex min-h-[116px] flex-col gap-2.5 rounded-[16px] border p-4",
      anchor ? "border-primary/50 bg-accent" : empty ? "border-dashed border-border bg-muted/40" : "border-border bg-card",
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold tabular-nums", anchor ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{step}</span>
        {badge && <span className="rounded-full bg-accent px-2 py-0.5 text-[12px] font-bold tabular-nums text-accent-foreground">{badge}</span>}
      </div>
      <div className="flex min-w-0 items-center gap-2.5">
        {thumb ? (
          <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded-[12px] border border-border object-cover" />
        ) : (
          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[12px]", empty ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground")}>{icon ?? <Package className="h-4 w-4" />}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] leading-tight text-muted-foreground">{label}</p>
          <p className={cn("mt-0.5 line-clamp-2 break-words text-[14px] font-bold leading-tight", empty ? "text-muted-foreground" : "text-foreground")}>{title}</p>
        </div>
      </div>
      {typeof price === "number" && price > 0 && <p className="mt-auto text-[13.5px] font-bold tabular-nums text-foreground">{formatCurrency(price)}</p>}
    </li>
  );
}

type TabCheckoutProps = {
  isNew: boolean;
  name: string; price: string; imagePreview: string | null; productId?: string;
  buttonColor: string; setButtonColor: StrS;
  timerEnabled: boolean; setTimerEnabled: BoolS;
  timerMinutes: string; setTimerMinutes: StrS;
  guaranteeEnabled: boolean; setGuaranteeEnabled: BoolS;
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

function TabCheckout({ isNew, name, price, imagePreview, productId, buttonColor, setButtonColor, timerEnabled, setTimerEnabled, timerMinutes, setTimerMinutes, guaranteeEnabled, setGuaranteeEnabled, bannerDesktopPreview, bannerMobilePreview, desktopBannerRef, mobileBannerRef, handleBannerFile, setBannerDesktopFile, setBannerDesktopPreview, setBannerMobileFile, setBannerMobilePreview, getCheckoutLink, copyLink, navigate, pixEnabled, boletoEnabled, creditCardEnabled }: TabCheckoutProps) {
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const priceValue = priceToNumber(price);
  const colorValid = HEX_COLOR.test(buttonColor.trim());
  const shownColor = colorValid ? buttonColor.trim() : "#10b981";
  const banner = previewDevice === "desktop" ? bannerDesktopPreview : bannerMobilePreview;

  if (isNew) {
    return (
      <div className="space-y-5">
        <StudioHeading title="Checkout" subtitle="A página onde o comprador paga." />
        <StepEmpty icon={<ShoppingCart className="h-7 w-7" />} title="Crie o produto primeiro">
          Salve a etapa Geral para personalizar e abrir o checkout deste produto.
        </StepEmpty>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StudioHeading title="Checkout" subtitle="Cor, timer, banners e selos da página onde o comprador paga." />

      <div className="vp-sheet flex flex-wrap items-center gap-4 p-5 sm:px-7">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><ShoppingCart className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1 basis-[180px]">
          <p className="text-[16px] font-bold leading-tight text-foreground">Checkout padrão</p>
          <p className="mt-0.5 text-[14px] font-bold tabular-nums vp-green-ink">{formatCurrency(priceValue)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => navigate(`/vendas/produtos/${productId}/checkout-builder`)} className="vp-cta"><Palette className="h-4 w-4" /> Abrir o construtor</button>
          <button type="button" onClick={() => copyLink(getCheckoutLink())} className="vp-ghost"><Copy className="h-4 w-4" /> Copiar link</button>
          <button type="button" onClick={() => window.open(getCheckoutLink(), "_blank")} className="vp-ghost"><Eye className="h-4 w-4" /> Abrir</button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <StudioPanel title="Cor do botão de compra">
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border" title="Escolher cor">
                <span className="sr-only">Escolher a cor do botão</span>
                <input type="color" value={shownColor} onChange={(e) => setButtonColor(e.target.value)} className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer border-0 bg-transparent p-0" />
              </label>
              <div className="w-[140px]">
                <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} aria-label="Código da cor" aria-invalid={!colorValid} maxLength={7} spellCheck={false} className={cn(inputClass, "font-mono uppercase")} />
              </div>
              <span className="inline-flex h-12 items-center rounded-full px-7 text-[14.5px] font-bold text-white" style={{ backgroundColor: shownColor }}>Comprar agora</span>
            </div>
            {!colorValid && <FieldHint className="text-destructive">Use o formato #10b981 (um # e 6 letras ou números).</FieldHint>}
            <div className="mt-5 flex flex-wrap items-center gap-2.5" role="group" aria-label="Cores sugeridas">
              <span className="mr-1 text-[13px] text-muted-foreground">Sugestões</span>
              {BUTTON_PRESETS.map((c) => (
                <button key={c} type="button" onClick={() => setButtonColor(c)} aria-label={`Usar a cor ${c}`} aria-pressed={buttonColor.toLowerCase() === c}
                  className={cn("h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none", buttonColor.toLowerCase() === c ? "border-foreground" : "border-transparent ring-1 ring-border")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </StudioPanel>

          <StudioPanel title="Elementos de conversão">
            <GroupBox>
              <FormToggleRow icon={<Timer className="h-[18px] w-[18px]" />} title="Timer de urgência" description="Contagem regressiva no checkout.">
                <div className="flex items-center gap-3">
                  {timerEnabled && (
                    <div className="flex items-center gap-2">
                      <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} aria-label="Minutos do timer" className={cn(inputClass, "!h-10 !w-[76px] !px-3 text-center tabular-nums")} />
                      <span className="text-[13px] text-muted-foreground">min</span>
                    </div>
                  )}
                  <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} aria-label="Ativar timer de urgência" />
                </div>
              </FormToggleRow>
              <FormToggleRow icon={<Shield className="h-[18px] w-[18px]" />} title="Selo de garantia" description={`Garantia de ${GUARANTEE_DAYS} dias no checkout.`}><Switch checked={guaranteeEnabled} onCheckedChange={setGuaranteeEnabled} aria-label="Ativar selo de garantia" /></FormToggleRow>
            </GroupBox>
          </StudioPanel>

          <StudioPanel title="Banners do checkout" subtitle="Aparecem no topo da página de pagamento.">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
              <BannerUpload label="Banner no computador" sublabel="Tamanho ideal: 1200×200 px" preview={bannerDesktopPreview} inputRef={desktopBannerRef} onFile={(e) => handleBannerFile(e, "desktop")} onClear={() => { setBannerDesktopFile(null); setBannerDesktopPreview(""); if (desktopBannerRef.current) desktopBannerRef.current.value = ""; }} />
              <BannerUpload label="Banner no celular" sublabel="Tamanho ideal: 600×200 px" preview={bannerMobilePreview} inputRef={mobileBannerRef} onFile={(e) => handleBannerFile(e, "mobile")} onClear={() => { setBannerMobileFile(null); setBannerMobilePreview(""); if (mobileBannerRef.current) mobileBannerRef.current.value = ""; }} />
            </div>
          </StudioPanel>
        </div>

        <div className="max-lg:order-first lg:sticky lg:top-[104px] lg:self-start">
          <section className="vp-sheet p-5" aria-label="Pré-visualização do checkout">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">Pré-visualização</h3>
              <div className="flex items-center gap-1" role="group" aria-label="Tamanho da pré-visualização">
                <button type="button" onClick={() => setPreviewDevice("desktop")} aria-pressed={previewDevice === "desktop"} aria-label="Computador" className="vp-pill !h-9 !px-3"><Monitor className="h-4 w-4" /></button>
                <button type="button" onClick={() => setPreviewDevice("mobile")} aria-pressed={previewDevice === "mobile"} aria-label="Celular" className="vp-pill !h-9 !px-3"><Smartphone className="h-4 w-4" /></button>
              </div>
            </div>
            <div className={cn("mx-auto overflow-hidden rounded-[16px] border border-border bg-background transition-[max-width] duration-300 motion-reduce:transition-none", previewDevice === "mobile" ? "max-w-[220px]" : "max-w-full")}>
              {banner && <img src={banner} alt="" className="h-16 w-full object-cover" />}
              <div className="space-y-3 p-3.5">
                {timerEnabled && (
                  <div className="flex items-center justify-center gap-1.5 rounded-[10px] bg-destructive/10 py-1.5 text-[12px] font-bold tabular-nums text-destructive">
                    <Timer className="h-3.5 w-3.5" /> {String(parseInt(timerMinutes) || 15).padStart(2, "0")}:00
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  {imagePreview ? <img src={imagePreview} alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-muted text-muted-foreground"><Package className="h-4 w-4" /></span>}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-foreground">{name || "Seu produto"}</p>
                    <p className="text-[13px] font-bold tabular-nums vp-green-ink">{formatCurrency(priceValue)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {pixEnabled && <span className="rounded-full bg-accent px-2 py-0.5 text-[11.5px] font-bold text-accent-foreground">Pix</span>}
                  {creditCardEnabled && <span className="rounded-full bg-info/15 px-2 py-0.5 text-[11.5px] font-bold text-info">Cartão</span>}
                  {boletoEnabled && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11.5px] font-bold text-warning">Boleto</span>}
                </div>
                <div className="rounded-full py-2.5 text-center text-[13px] font-bold text-white" style={{ backgroundColor: shownColor }}>Comprar agora</div>
                {guaranteeEnabled && <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground"><Shield className="h-3 w-3" /> Garantia de {GUARANTEE_DAYS} dias</p>}
              </div>
            </div>
            <FieldHint className="text-center">Aproximação do que o comprador vê.</FieldHint>
          </section>
        </div>
      </div>
    </div>
  );
}

type TabCoProducaoProps = {
  isNew: boolean;
  coProducerEmail: string; setCoProducerEmail: StrS;
  coProductionSplit: string; setCoProductionSplit: StrS;
  coProductionsList?: Tables<"co_productions">[];
  inviteCoProducer: () => void | Promise<void>;
  removeCoProducer: (id: string) => void | Promise<void>;
  invitingCoProducer: boolean;
};

function TabCoProducao({ isNew, coProducerEmail, setCoProducerEmail, coProductionSplit, setCoProductionSplit, coProductionsList = [], inviteCoProducer, removeCoProducer, invitingCoProducer }: TabCoProducaoProps) {
  const [removeTarget, setRemoveTarget] = useState<Tables<"co_productions"> | null>(null);
  const [removing, setRemoving] = useState(false);
  const split = Math.min(Math.max(Number(coProductionSplit) || 0, 0), 100);
  const splitInvalid = coProductionSplit !== "" && (Number(coProductionSplit) < 1 || Number(coProductionSplit) > 99);
  const emailInvalid = coProducerEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coProducerEmail.trim());

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    await removeCoProducer(removeTarget.id);
    setRemoving(false);
    setRemoveTarget(null);
  };

  return (
    <div className="space-y-5">
      <StudioHeading title="Co-produção" subtitle="Divida a receita deste produto com um parceiro. Ele precisa aceitar o convite." />

      {isNew ? (
        <StepEmpty icon={<Handshake className="h-7 w-7" />} title="Crie o produto primeiro">
          Salve a etapa Geral para convidar um co-produtor.
        </StepEmpty>
      ) : (
        <>
          <StudioPanel title="Convidar co-produtor">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-[minmax(0,1fr)_200px]">
              <div>
                <FieldLabel htmlFor="coprod-email">E-mail do co-produtor</FieldLabel>
                <Input id="coprod-email" value={coProducerEmail} onChange={(e) => setCoProducerEmail(e.target.value)} placeholder="email@coprodutor.com" type="email" aria-invalid={emailInvalid} className={inputClass} />
                <FieldHint className={emailInvalid ? "text-destructive" : undefined}>{emailInvalid ? "Digite um e-mail válido." : "A pessoa recebe o convite nesse e-mail."}</FieldHint>
              </div>
              <div>
                <FieldLabel htmlFor="coprod-split">Parte do co-produtor (%)</FieldLabel>
                <div className="relative">
                  <Input id="coprod-split" type="number" min="1" max="99" value={coProductionSplit} onChange={(e) => setCoProductionSplit(e.target.value)} aria-invalid={splitInvalid} className={cn(inputClass, "!pr-10 tabular-nums")} />
                  <Percent aria-hidden className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <FieldHint className={splitInvalid ? "text-destructive" : undefined}>{splitInvalid ? "Use um valor de 1 a 99." : "De 1 a 99."}</FieldHint>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Você fica com ${100 - split}% e o co-produtor com ${split}%`}>
                <div className="h-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${100 - split}%` }} />
                <div className="h-full bg-primary/30 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${split}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[13px] font-semibold tabular-nums">
                <span className="vp-green-ink">Você: {100 - split}%</span>
                <span className="text-muted-foreground">Co-produtor: {split}%</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button type="button" onClick={inviteCoProducer} disabled={!coProducerEmail.trim() || invitingCoProducer} className="vp-cta">
                {invitingCoProducer ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {invitingCoProducer ? "Enviando…" : "Convidar co-produtor"}
              </button>
            </div>
          </StudioPanel>

          <StudioPanel title="Convites e co-produtores">
            {coProductionsList.length > 0 ? (
              <GroupBox>
                {coProductionsList.map((cp) => {
                  const st = cp.status === "accepted" ? { label: "Aceito", tone: "ok" as const } : cp.status === "rejected" ? { label: "Recusado", tone: "alert" as const } : { label: "Convite pendente", tone: "wait" as const };
                  return (
                    <div key={cp.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-[14px] font-bold text-muted-foreground">{(cp.co_producer_email || "?").charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1 basis-[160px]">
                        <p className="truncate text-[14.5px] font-semibold text-foreground">{cp.co_producer_email}</p>
                        <p className="text-[13px] tabular-nums text-muted-foreground">{cp.split_percentage}% da receita</p>
                      </div>
                      <StatusPill label={st.label} tone={st.tone} />
                      <button type="button" onClick={() => setRemoveTarget(cp)} aria-label={`Remover ${cp.co_producer_email}`} className="vp-orb text-destructive"><Trash2 className="h-[18px] w-[18px]" /></button>
                    </div>
                  );
                })}
              </GroupBox>
            ) : (
              <p className="rounded-[16px] border border-dashed border-border px-4 py-6 text-center text-[14px] text-muted-foreground">Nenhum convite enviado ainda.</p>
            )}
          </StudioPanel>

          <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open && !removing) setRemoveTarget(null); }}>
            <AlertDialogContent className="max-w-md rounded-[28px] border-border bg-card p-6 sm:p-8">
              <AlertDialogHeader className="space-y-2 text-left">
                <span className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></span>
                <AlertDialogTitle className="font-heading text-[21px] font-extrabold tracking-[-0.03em]">Remover este co-produtor?</AlertDialogTitle>
                <AlertDialogDescription className="text-[14.5px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">{removeTarget?.co_producer_email}</span> é removido da co-produção deste produto.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4 gap-2 sm:gap-2">
                <AlertDialogCancel disabled={removing} className="vp-ghost m-0 h-11">Manter co-produtor</AlertDialogCancel>
                <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmRemove(); }} disabled={removing} className="vp-cta vp-cta-danger h-11">
                  {removing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {removing ? "Removendo…" : "Remover co-produtor"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
 <Input value={newCouponCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCouponCode(e.target.value.toUpperCase())} placeholder="EX: DESCONTO20" className="h-11 bg-secondary border-border font-mono " maxLength={30} />
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
 "rounded-[12px] border bg-card p-4 flex items-center justify-between relative overflow-hidden transition-all",
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
  product: Tables<"products"> | null;
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
  const priceLabel = formatCurrency(priceToNumber(price));

  const shareLinks = [
    { label: "WhatsApp", icon: MessageSquare, url: `https://wa.me/?text=${encodeURIComponent(`Confira: ${name} por apenas ${priceLabel}! ${checkoutLink}`)}` },
    { label: "Telegram", icon: Share2, url: `https://t.me/share/url?url=${encodeURIComponent(checkoutLink)}&text=${encodeURIComponent(`${name} — ${priceLabel}`)}` },
    { label: "X (Twitter)", icon: Megaphone, url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${name} — ${priceLabel}`)}&url=${encodeURIComponent(checkoutLink)}` },
  ];

  type LinkRow = { key: string; icon: React.ComponentType<{ className?: string }>; label: string; description: string; url: string; qr?: boolean };
  const rows: LinkRow[] = [];
  if (product?.checkout_url && checkoutLink) {
    rows.push({ key: "checkout", icon: ShoppingCart, label: "Link do checkout", description: "Leva direto ao pagamento deste produto.", url: checkoutLink, qr: true });
  }
  if (pageUrl.trim()) {
    const href = /^https?:\/\//i.test(pageUrl.trim()) ? pageUrl.trim() : `https://${pageUrl.trim()}`;
    rows.push({ key: "page", icon: Globe, label: "Página de vendas", description: "A página pública que apresenta o produto.", url: href });
  }
  if (affiliateEnabled) {
    rows.push({ key: "affiliate", icon: Users, label: "Convite de afiliado", description: "Para recrutar parceiros que vendem por você.", url: affiliateInviteLink });
  }

  return (
    <div className="space-y-5">
      <StudioHeading title="Links de venda" subtitle="Copie, abra ou compartilhe os endereços deste produto." />

      {isNew ? (
        <StepEmpty icon={<Link2 className="h-7 w-7" />} title="Crie o produto primeiro">
          Salve a etapa Geral para gerar o link do checkout.
        </StepEmpty>
      ) : rows.length === 0 ? (
        <StepEmpty icon={<Link2 className="h-7 w-7" />} title="Nenhum link disponível ainda">
          Preencha a página de vendas na etapa Geral para ver os links aqui.
        </StepEmpty>
      ) : (
        <>
          {product && product.status !== "active" && product.checkout_url && (
            <Notice tone="info" icon={<Clock className="h-4 w-4" />}>
              O checkout só aceita pagamentos depois que o produto estiver ativo.
            </Notice>
          )}
          <section className="vp-sheet divide-y divide-border overflow-hidden" aria-label="Links do produto">
            {rows.map((row) => (
              <div key={row.key}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5 sm:px-7">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><row.icon className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1 basis-[240px]">
                    <p className="text-[15px] font-bold leading-tight text-foreground">{row.label}</p>
                    <p className="mt-0.5 text-[13.5px] text-muted-foreground">{row.description}</p>
                    <div className="mt-2.5 flex items-center gap-2 rounded-[12px] border border-border bg-muted/50 px-3 py-2">
                      <Link2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono text-[12.5px] text-foreground">{row.url}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 sm:w-[224px]">
                    {row.qr && (
                      <button type="button" onClick={() => setShowQR(!showQR)} aria-pressed={showQR} aria-label="Mostrar QR Code" className={cn("vp-orb", showQR && "!border-primary !bg-accent text-accent-foreground")}><QrCode className="h-[18px] w-[18px]" /></button>
                    )}
                    <button type="button" onClick={() => window.open(row.url, "_blank", "noopener,noreferrer")} aria-label={`Abrir ${row.label.toLowerCase()}`} className="vp-orb"><ExternalLink className="h-[18px] w-[18px]" /></button>
                    <button type="button" onClick={() => copyLink(row.url)} className="vp-cta !h-11"><Copy className="h-4 w-4" /> Copiar</button>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {row.qr && showQR && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="flex flex-col items-center gap-3 border-t border-border bg-muted/30 py-6">
                        <div className="rounded-[16px] bg-white p-3.5 shadow-sm ring-1 ring-black/5">
                          <QRCodeSVG value={row.url} size={168} level="M" bgColor="#ffffff" fgColor="#0b1220" />
                        </div>
                        <p className="text-[13px] text-muted-foreground">Aponte a câmera do celular para abrir o checkout.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </section>

          {checkoutLink && (
            <StudioPanel title="Compartilhar rápido" subtitle="Abre o app com a mensagem e o link do checkout prontos.">
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-3">
                {shareLinks.map((sl) => (
                  <a key={sl.label} href={sl.url} target="_blank" rel="noopener noreferrer" className="vp-ghost">
                    <sl.icon className="h-4 w-4 text-muted-foreground" /> {sl.label}
                  </a>
                ))}
              </div>
            </StudioPanel>
          )}
        </>
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
        <div className="rounded-[12px] border border-border bg-card flex flex-col items-center justify-center py-16 gap-3">
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
        <div className="flex items-center justify-center py-16 rounded-[12px] border border-border bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-card flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-14 w-14 rounded-[12px] bg-secondary flex items-center justify-center border border-border">
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
          <div className="grid grid-cols-3 rounded-[12px] border border-border bg-card divide-x divide-border overflow-hidden">
            <div className="p-4">
              <p className="text-[11px] font-semibold text-muted-foreground">Cursos</p>
              <p className="mt-1.5 text-xl font-display font-black tabular-nums text-foreground">{courses.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{publishedCount} publicado{publishedCount !== 1 ? "s" : ""}</p>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-semibold text-muted-foreground">Módulos</p>
              <p className="mt-1.5 text-xl font-display font-black tabular-nums text-foreground">{totalModules}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">no total</p>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-semibold text-muted-foreground">Aulas</p>
              <p className="mt-1.5 text-xl font-display font-black tabular-nums text-foreground">{totalLessons}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">disponíveis</p>
            </div>
          </div>

          {/* Course list — dense rows */}
          <div className="rounded-[12px] border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
              <p className="text-[11px] font-semibold text-muted-foreground">Cursos vinculados</p>
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
 "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold border",
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
 SHARED COMPONENTS (usados também pelas abas desativadas)
 ═══════════════════════════════════════════════ */

function SectionHeader({ title, subtitle }: { icon?: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return <StudioHeading title={title} subtitle={subtitle} />;
}

function EditorCard({ children }: { children: React.ReactNode; accentColor?: string }) {
  return <StudioPanel className="space-y-5">{children}</StudioPanel>;
}

function EditorLabel({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Label className="mb-2 flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      {children}
    </Label>
  );
}

function EmptyCard({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return <StepEmpty icon={<Icon className="h-7 w-7" />} title={message} />;
}

function ToggleRow({ icon: Icon, label, sublabel, checked, onChange, children }: {
  icon?: React.ComponentType<{ className?: string }>; label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-card">
      <FormToggleRow icon={Icon ? <Icon className="h-[18px] w-[18px]" /> : undefined} title={label} description={sublabel}>
        <div className="flex items-center gap-3">
          {children}
          <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
        </div>
      </FormToggleRow>
    </div>
  );
}

function BannerUpload({ label, sublabel, preview, inputRef, onFile, onClear }: {
  label: string; sublabel?: string; preview: string; inputRef: React.RefObject<HTMLInputElement>; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void;
}) {
  return (
    <div>
      <FieldLabel hint={sublabel}>{label}</FieldLabel>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFile} className="hidden" aria-label={`Escolher ${label.toLowerCase()}`} />
      {preview ? (
        <div className="relative overflow-hidden rounded-[16px] border border-border">
          <img src={preview} alt={label} className="h-28 w-full object-cover" />
          <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5">
            <button type="button" onClick={() => inputRef.current?.click()} aria-label={`Trocar ${label.toLowerCase()}`} className="vp-orb !h-9 !w-9 shadow-sm"><ImagePlus className="h-4 w-4" /></button>
            <button type="button" onClick={onClear} aria-label={`Remover ${label.toLowerCase()}`} className="vp-orb !h-9 !w-9 text-destructive shadow-sm"><X className="h-4 w-4" /></button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="vp-r16 flex h-28 w-full flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Upload className="h-5 w-5" />
          <span className="text-[13.5px] font-semibold">Enviar imagem</span>
        </button>
      )}
    </div>
  );
}
