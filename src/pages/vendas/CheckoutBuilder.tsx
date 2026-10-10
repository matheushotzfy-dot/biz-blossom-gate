import { formatCurrency } from "@/components/products/productPresentation";
/**
 * Checkout Builder — Premium immersive checkout customizer
 * @module CheckoutBuilder
 * @version 5.0.0
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 Palette, CreditCard, Mail, Package, Plus, Trash2, ArrowLeft,
 Timer, ShieldCheck, QrCode, FileText, MapPin, X, Upload,
 Zap, Users, Monitor, Smartphone, Check, Eye,
 Clock, Lock,
 Sparkles, Hash, MousePointerClick,
 RotateCcw, Copy, ExternalLink, Wand2, TrendingUp,
 ChevronRight, Grip, Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Constants ─── */
const TABS = [
 { id: "visual", label: "Visual", icon: Palette },
 { id: "payment", label: "Pagamento", icon: CreditCard },
 { id: "form", label: "Formulário", icon: Mail },
 { id: "bumps", label: "Order Bumps", icon: Package },
 { id: "cro", label: "Conversão", icon: Zap },
] as const;
type TabId = typeof TABS[number]["id"];

type ProductWithCheckoutTheme = Tables<"products"> & { checkout_theme?: unknown };

const normalizeCheckoutTheme = (value: unknown): "gray" | "white" | "dark" =>
 value === "white" ? "white" : value === "dark" ? "dark" : "gray";

const getCheckoutTheme = (value: Tables<"products"> | null) =>
 normalizeCheckoutTheme((value as ProductWithCheckoutTheme | null)?.checkout_theme);

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

/* ─── Score Ring ─── */
function ScoreRing({ score, max }: { score: number; max: number }) {
 const pct = Math.round((score / max) * 100);
 const r = 16, c = 2 * Math.PI * r;
 const color = pct >= 80 ? "hsl(var(--success))" : pct >= 50 ? "hsl(var(--warning))" : "hsl(var(--primary))";
 return (
 <div className="relative h-10 w-10 shrink-0">
 <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
 <circle cx="20" cy="20" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" opacity={0.15} />
 <motion.circle
 cx="20" cy="20" r={r} fill="none"
 stroke={color} strokeWidth="2.5" strokeLinecap="round"
 strokeDasharray={c}
 initial={{ strokeDashoffset: c }}
 animate={{ strokeDashoffset: c - (c * pct / 100) }}
 transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
 />
 </svg>
 <div className="absolute inset-0 flex items-center justify-center">
 <span className="text-[9px] font-numbers font-black tabular-nums" style={{ color }}>{pct}%</span>
 </div>
 </div>
 );
}

/* ─── Section Card ─── */
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
 return (
 <div className={cn("rounded-xl border border-border/40 bg-card/95 p-4 space-y-3 ", className)}>
 {children}
 </div>
 );
}

/* ─── Section Header ─── */
function SectionHeader({ title, desc, icon: Icon, badge }: { title: string; desc: string; icon?: React.ComponentType<{ className?: string }>; badge?: string }) {
 return (
 <div className="flex items-center gap-3 mb-1">
 {Icon && (
 <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/10">
 <Icon className="h-4 w-4 text-primary" />
 </div>
 )}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className="text-sm font-display font-bold text-foreground">{title}</p>
 {badge && (
 <span className="text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/10">{badge}</span>
 )}
 </div>
 <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
 </div>
 </div>
 );
}

/* ─── Toggle Row ─── */
function ToggleRow({ icon: Icon, title, desc, checked, onChange, extra, badge }: {
 icon: React.ComponentType<{ className?: string }>; title: string; desc: string;
 checked: boolean; onChange: (v: boolean) => void; extra?: React.ReactNode; badge?: string;
}) {
 return (
 <div className={cn(
 "group relative flex items-center justify-between p-3 rounded-xl border transition-all duration-200",
 checked
 ? "border-primary/25 bg-primary/[0.04]"
 : "border-border/30 bg-card/60 hover:border-border/50"
 )}>
 {checked && (
 <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-primary/60" />
 )}
 <div className="flex items-center gap-3 flex-1 min-w-0">
 <div className={cn(
 "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all border",
 checked ? "bg-primary/10 border-primary/15" : "bg-muted/30 border-transparent"
 )}>
 <Icon className={cn("h-4 w-4 transition-colors", checked ? "text-primary" : "text-muted-foreground/50")} />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <p className={cn("text-xs font-semibold transition-colors", checked ? "text-foreground" : "text-foreground/70")}>{title}</p>
 {badge && (
 <span className="text-[11px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{badge}</span>
 )}
 </div>
 <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {extra}
 <Switch checked={checked} onCheckedChange={onChange} />
 </div>
 </div>
 );
}

/* ─── Conversion Tip ─── */
function ConversionTip({ text, icon: Icon = Zap }: { text: string; icon?: React.ComponentType<{ className?: string }> }) {
 return (
 <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 flex items-start gap-2.5">
 <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
 <Icon className="h-3 w-3 text-primary" />
 </div>
 <div>
 <p className="text-[11px] font-medium text-primary/70 mb-0.5">Dica de conversão</p>
 <p className="text-[11px] text-muted-foreground leading-relaxed">{text}</p>
 </div>
 </div>
 );
}

/* ─── Preview Field ─── */
function PreviewField({ label, theme }: { label: string; theme?: string }) {
 return (
 <div>
 <p className="text-[11px] font-semibold text-gray-500 mb-1.5 ">{label}</p>
 <div className={cn(
 "h-10 rounded-lg border",
 theme === "white" ? "bg-white border-gray-200" : theme === "dark" ? "bg-[hsl(220_15%_16%)] border-[hsl(220_12%_24%)]" : "bg-white/70 border-gray-200"
 )} />
 </div>
 );
}

/* ═══════════════════════════════════════════════ */
/* MAIN COMPONENT */
/* ═══════════════════════════════════════════════ */
export default function CheckoutBuilder() {
 const { productId } = useParams<{ productId: string }>();
 const navigate = useNavigate();
 const location = useLocation();
 const { user } = useAuth();
 const initialProduct = (location.state as { product?: Tables<"products"> } | null)?.product ?? null;
 const [product, setProduct] = useState<Tables<"products"> | null>(initialProduct);
 const [loading, setLoading] = useState(!initialProduct);
 const [activeTab, setActiveTab] = useState<TabId>("visual");
 const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
 const [saving, setSaving] = useState(false);
 const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
 const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
 const initializedRef = useRef(false);

 // Settings state
 const [buttonColor, setButtonColor] = useState(initialProduct?.checkout_button_color || "#10b981");
 const [checkoutTheme, setCheckoutTheme] = useState<"gray" | "white" | "dark">(getCheckoutTheme(initialProduct));
 const [timerEnabled, setTimerEnabled] = useState(initialProduct?.checkout_timer_enabled ?? true);
 const [timerMinutes, setTimerMinutes] = useState(String(initialProduct?.checkout_timer_minutes ?? 15));
 const [socialProof, setSocialProof] = useState(initialProduct?.checkout_social_proof ?? false);
 const [guaranteeEnabled, setGuaranteeEnabled] = useState(initialProduct?.checkout_guarantee_enabled ?? true);
 const [pixEnabled, setPixEnabled] = useState(initialProduct?.checkout_pix_enabled ?? true);
 const [boletoEnabled, setBoletoEnabled] = useState(initialProduct?.checkout_boleto_enabled ?? false);
 const [creditCardEnabled, setCreditCardEnabled] = useState(initialProduct?.checkout_credit_card_enabled ?? true);
 const [allowedMethods, setAllowedMethods] = useState({ pix: true, boleto: false, card: true });
 const [addressRequired, setAddressRequired] = useState(initialProduct?.checkout_address_required ?? false);
 const [emailConfirm, setEmailConfirm] = useState(initialProduct?.checkout_email_confirm ?? true);
 const [bannerDesktopPreview, setBannerDesktopPreview] = useState(initialProduct?.checkout_banner_desktop_url || "");
 const [bannerMobilePreview, setBannerMobilePreview] = useState(initialProduct?.checkout_banner_mobile_url || "");
 const [bannerDesktopFile, setBannerDesktopFile] = useState<File | null>(null);
 const [bannerMobileFile, setBannerMobileFile] = useState<File | null>(null);
 const desktopRef = useRef<HTMLInputElement>(null);
 const mobileRef = useRef<HTMLInputElement>(null);

 // Form extras
 const [cpfRequired] = useState(true);

 // Order bumps
 const [allProducts, setAllProducts] = useState<Tables<"products">[]>([]);
 const [orderBumps, setOrderBumps] = useState<{ id: string; bump_product_id: string }[]>([]);
 const [selectedBumpProduct, setSelectedBumpProduct] = useState("");

 // Optimization score
 const optimizationScore = (() => {
 let s = 0;
 const max = 8;
 if (pixEnabled) s++;
 if (creditCardEnabled) s++;
 if (boletoEnabled) s++;
 if (timerEnabled) s++;
 if (socialProof) s++;
 if (guaranteeEnabled) s++;
 if (orderBumps.length > 0) s++;
 if (bannerDesktopPreview || bannerMobilePreview) s++;
 return { score: s, max };
 })();

 // Tab feature counts
 const getTabFeatureCount = (tabId: TabId): number => {
 switch (tabId) {
 case "visual": return [timerEnabled, socialProof, guaranteeEnabled, !!bannerDesktopPreview, !!bannerMobilePreview].filter(Boolean).length;
 case "payment": return [pixEnabled, boletoEnabled, creditCardEnabled].filter(Boolean).length;
 case "form": return [emailConfirm, cpfRequired, addressRequired].filter(Boolean).length;
 case "bumps": return orderBumps.length;
 case "cro": return 0;
 default: return 0;
 }
 };

 // Load product
 useEffect(() => {
 if (!user?.id || !productId) return;
 if (!product) setLoading(true);
 supabase.from("products").select("*").eq("id", productId).eq("user_id", user.id).maybeSingle()
 .then(({ data, error }) => {
 if (error || !data) { toast.error("Produto não encontrado"); navigate("/vendas/produtos"); return; }
 setProduct(data);
 setButtonColor(data.checkout_button_color || "#10b981");
 setCheckoutTheme(getCheckoutTheme(data));
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
 setLoading(false);
 });
 supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").neq("id", productId)
 .then(({ data }) => { if (data) setAllProducts(data); });
 supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", productId)
 .then(({ data }) => { if (data) setOrderBumps(data); });
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [user?.id, productId]);

 useEffect(() => {
  if (!user?.id) return;
  supabase.from("profiles").select("pix_enabled, boleto_enabled, credit_card_enabled").eq("user_id", user.id).maybeSingle()
   .then(({ data }) => {
    if (!data) return;
    setAllowedMethods({ pix: data.pix_enabled, boleto: data.boleto_enabled, card: data.credit_card_enabled });
    if (!data.pix_enabled) setPixEnabled(false);
    if (!data.boleto_enabled) setBoletoEnabled(false);
    if (!data.credit_card_enabled) setCreditCardEnabled(false);
   });
 }, [user?.id]);

 // Auto-save
 const autoSave = useCallback(async () => {
 if (!user?.id || !productId) return;
 setSaving(true);
 let desktopUrl = bannerDesktopPreview;
 let mobileUrl = bannerMobilePreview;
 const ALLOWED_BANNER = ["image/jpeg", "image/png", "image/webp"];
 const MAX_BANNER = 5 * 1024 * 1024;
 if (bannerDesktopFile) {
 if (!ALLOWED_BANNER.includes(bannerDesktopFile.type)) { toast.error("Banner desktop: use JPG, PNG ou WebP"); setSaving(false); return; }
 if (bannerDesktopFile.size > MAX_BANNER) { toast.error("Banner desktop: máximo 5MB"); setSaving(false); return; }
 const ext = (bannerDesktopFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
 const path = `${user.id}/${productId}-desktop.${ext}`;
 const { error } = await supabase.storage.from("checkout-banners").upload(path, bannerDesktopFile, { upsert: true });
 if (!error) { const { data } = supabase.storage.from("checkout-banners").getPublicUrl(path); desktopUrl = data.publicUrl; }
 setBannerDesktopFile(null);
 }
 if (bannerMobileFile) {
 if (!ALLOWED_BANNER.includes(bannerMobileFile.type)) { toast.error("Banner mobile: use JPG, PNG ou WebP"); setSaving(false); return; }
 if (bannerMobileFile.size > MAX_BANNER) { toast.error("Banner mobile: máximo 5MB"); setSaving(false); return; }
 const ext = (bannerMobileFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
 const path = `${user.id}/${productId}-mobile.${ext}`;
 const { error } = await supabase.storage.from("checkout-banners").upload(path, bannerMobileFile, { upsert: true });
 if (!error) { const { data } = supabase.storage.from("checkout-banners").getPublicUrl(path); mobileUrl = data.publicUrl; }
 setBannerMobileFile(null);
 }
 const { error } = await supabase.from("products").update({
 checkout_button_color: buttonColor,
 checkout_theme: checkoutTheme,
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
 setLastSavedAt(new Date());
 if (!error) toast.success("Alterações salvas", { duration: 1500 });
 }, [user?.id, productId, buttonColor, checkoutTheme, timerEnabled, timerMinutes, socialProof, guaranteeEnabled, pixEnabled, boletoEnabled, creditCardEnabled, addressRequired, emailConfirm, bannerDesktopPreview, bannerMobilePreview, bannerDesktopFile, bannerMobileFile]);

 useEffect(() => {
 if (loading || !product) return;
  if (!initializedRef.current) { initializedRef.current = true; return; }
 if (saveTimeout.current) clearTimeout(saveTimeout.current);
 saveTimeout.current = setTimeout(autoSave, 1200);
 return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
 }, [buttonColor, checkoutTheme, timerEnabled, timerMinutes, socialProof, guaranteeEnabled, pixEnabled, boletoEnabled, creditCardEnabled, addressRequired, emailConfirm, autoSave, loading, product]);

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
 const { data, error } = await supabase.from("order_bumps").insert({ product_id: productId!, bump_product_id: selectedBumpProduct, sort_order: orderBumps.length }).select("id, bump_product_id").maybeSingle();
 if (error || !data) { toast.error("Erro ao adicionar"); return; }
 setOrderBumps(prev => [...prev, data]);
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
 const themeLabel = checkoutTheme === "white" ? "Branco Premium" : checkoutTheme === "dark" ? "Cinza Escuro" : "Cinza Suave";

 /* ─── LOADING STATE ─── */
 if (loading) return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="flex flex-col items-center gap-4">
 <motion.div
 animate={{ rotate: 360 }}
 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
 className="h-12 w-12 border-2 border-border/20 border-t-primary rounded-full"
 />
 <div className="text-center space-y-1">
 <p className="text-sm font-display font-bold text-foreground">Checkout Builder</p>
 <p className="text-xs text-muted-foreground">Carregando...</p>
 </div>
 </div>
 </div>
 );

 /* ═══════════════════════════════════════════════ */
 /* RENDER */
 /* ═══════════════════════════════════════════════ */
 return (
 <div className="h-screen bg-background flex flex-col lg:flex-row overflow-hidden">
 
 {/* ─── LEFT: Control Panel ─── */}
 <aside className="w-full lg:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-border/50 bg-card/50 backdrop-blur-sm flex flex-col max-h-[60vh] lg:max-h-none lg:h-screen min-h-0">
 
 {/* Header */}
 <div className="px-4 py-3 border-b border-border/40 bg-card/80">
 <div className="flex items-center gap-3">
 <Button
 variant="ghost" size="icon"
 onClick={() => navigate("/vendas/produtos")}
 className="h-8 w-8 rounded-lg hover:bg-muted/50 text-muted-foreground"
 >
 <ArrowLeft className="h-4 w-4" />
 </Button>
 <div className="min-w-0 flex-1">
 <h1 className="text-sm font-display font-bold text-foreground truncate">{product?.name}</h1>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-[10px] text-muted-foreground font-medium">Checkout Builder</span>
 <AnimatePresence mode="wait">
 {saving ? (
 <motion.span
 key="saving"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="inline-flex items-center gap-1 text-[10px] text-primary font-medium"
 >
 <motion.span
 animate={{ scale: [1, 1.4, 1] }}
 transition={{ repeat: Infinity, duration: 0.8 }}
 className="h-1.5 w-1.5 rounded-full bg-primary"
 />
 Salvando...
 </motion.span>
 ) : lastSavedAt ? (
 <motion.span
 key="saved"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="inline-flex items-center gap-1 text-[10px] text-success font-medium"
 >
 <Check className="h-2.5 w-2.5" /> Salvo
 </motion.span>
 ) : null}
 </AnimatePresence>
 </div>
 </div>
 <ScoreRing score={optimizationScore.score} max={optimizationScore.max} />
 </div>
 </div>

 {/* Tab Navigation */}
 <nav className="flex gap-0.5 p-2 mx-3 mt-3 rounded-lg bg-muted/30 border border-border/30">
 {TABS.map(tab => {
 const isActive = activeTab === tab.id;
 const featureCount = getTabFeatureCount(tab.id);
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={cn(
 "relative flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-md text-[11px] font-medium transition-all duration-200",
 isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
 )}
 >
 {isActive && (
 <motion.div
 layoutId="builder-tab"
 className="absolute inset-0 rounded-md bg-card border border-border/50 "
 transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
 />
 )}
 <div className="relative z-10">
 <tab.icon className={cn("h-3.5 w-3.5 transition-colors", isActive ? "text-primary" : "")} />
 {featureCount > 0 && !isActive && (
 <div className="absolute -top-1 -right-2 h-3.5 min-w-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[7px] font-bold flex items-center justify-center">
 {featureCount}
 </div>
 )}
 </div>
 <span className="relative z-10">{tab.label}</span>
 </button>
 );
 })}
 </nav>

 {/* Tab Content */}
 <div className="flex-1 overflow-y-auto p-4 pt-3 overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
 <AnimatePresence mode="wait">
 <motion.div
 key={activeTab}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
 className="space-y-3"
 >
 {/* ── VISUAL TAB ── */}
 {activeTab === "visual" && (
 <>
 <SectionHeader icon={Palette} title="Aparência" desc="Cores, banners e tema visual" badge="Design" />

 {/* Theme Selector */}
 <SectionCard>
 <Label className="text-[11px] font-medium text-muted-foreground block">Tema Visual</Label>
 <div className="grid grid-cols-3 gap-2.5">
 {[
 { key: "gray" as const, name: "Cinza Suave", swatch: "linear-gradient(180deg,#f3f4f6,#e5e7eb)", ring: "border-border" },
 { key: "white" as const, name: "Branco", swatch: "linear-gradient(180deg,#ffffff,#f9fafb)", ring: "border-border" },
 { key: "dark" as const, name: "Escuro", swatch: "linear-gradient(180deg,hsl(220 16% 18%),hsl(220 18% 10%))", ring: "border-border" },
 ].map(theme => (
 <button
 key={theme.key}
 type="button"
 onClick={() => setCheckoutTheme(theme.key)}
 className={cn(
 "relative rounded-lg border-2 p-2.5 transition-all text-left group",
 checkoutTheme === theme.key
 ? "border-primary "
 : "border-border/30 hover:border-border/60"
 )}
 >
 {checkoutTheme === theme.key && (
 <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
 <Check className="h-2.5 w-2.5 text-primary-foreground" />
 </div>
 )}
 <div className={cn("h-10 rounded-md mb-2 border", theme.ring)} style={{ background: theme.swatch }} />
 <p className="text-[10px] font-bold text-foreground">{theme.name}</p>
 </button>
 ))}
 </div>
 </SectionCard>

 {/* Color Picker */}
 <SectionCard>
 <Label className="text-[11px] font-medium text-muted-foreground block">Cor do Botão CTA</Label>
 <div className="flex gap-2 flex-wrap">
 {PRESET_COLORS.map(c => (
 <button
 key={c.hex}
 onClick={() => setButtonColor(c.hex)}
 className={cn(
 "h-8 w-8 rounded-lg transition-all relative ",
 buttonColor === c.hex ? "ring-2 ring-offset-2 ring-offset-card ring-primary scale-110" : "hover:scale-105"
 )}
 style={{ backgroundColor: c.hex }}
 title={c.name}
 >
 {buttonColor === c.hex && (
 <div className="absolute inset-0 flex items-center justify-center">
 <Check className="h-3.5 w-3.5 text-white drop-shadow" />
 </div>
 )}
 </button>
 ))}
 </div>
 <div className="flex items-center gap-2">
 <div className="relative">
 <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer opacity-0 absolute inset-0 z-10" />
 <div className="h-9 w-9 rounded-lg border border-border/30 flex items-center justify-center" style={{ backgroundColor: buttonColor }}>
 <Palette className="h-3.5 w-3.5 text-white/80 drop-shadow" />
 </div>
 </div>
 <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="flex-1 font-mono text-xs h-9 rounded-lg bg-muted/20 border-border/30" />
 </div>
 {/* CTA Preview */}
 <div
 className="h-11 rounded-lg flex items-center justify-center text-white text-sm font-bold gap-2 cursor-pointer transition-transform "
 style={{ backgroundColor: buttonColor, boxShadow: `0 8px 24px -6px ${buttonColor}40` }}
 >
 <Sparkles className="h-4 w-4" /> COMPRAR AGORA — {formatCurrency(Number(product?.price || 0))}
 </div>
 </SectionCard>

 <ToggleRow icon={Timer} title="Timer de urgência" desc="Contador regressivo de oferta"
 checked={timerEnabled} onChange={setTimerEnabled}
 extra={timerEnabled ? (
 <div className="flex items-center gap-1">
 <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} className="w-14 h-7 text-center text-[11px] rounded-md bg-muted/20 border-border/30 font-bold" />
 <span className="text-[10px] text-muted-foreground">min</span>
 </div>
 ) : undefined}
 />

 {/* Banners */}
 <SectionCard>
 <Label className="text-[11px] font-medium text-muted-foreground block">Banners</Label>
 {[
 { type: "desktop" as const, label: "Desktop", icon: Monitor, ref: desktopRef, preview: bannerDesktopPreview, setFile: setBannerDesktopFile, setPreview: setBannerDesktopPreview, size: "1200×400" },
 { type: "mobile" as const, label: "Mobile", icon: Smartphone, ref: mobileRef, preview: bannerMobilePreview, setFile: setBannerMobileFile, setPreview: setBannerMobilePreview, size: "600×300" },
 ].map(banner => (
 <div key={banner.type} className="space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-xs text-foreground/70 font-medium flex items-center gap-1.5">
 <banner.icon className="h-3.5 w-3.5 text-muted-foreground" /> {banner.label}
 </span>
 <span className="text-[10px] text-muted-foreground">{banner.size}</span>
 </div>
 <input ref={banner.ref} type="file" accept="image/*" onChange={(e) => handleFile(e, banner.type)} className="hidden" />
 {banner.preview ? (
 <div className="relative rounded-lg overflow-hidden border border-border/30 group">
 <img src={banner.preview} alt={banner.label} className="w-full h-20 object-cover" />
 <div className="absolute inset-0 bg-background/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
 <button onClick={() => banner.ref.current?.click()} className="h-8 w-8 rounded-lg bg-card border border-border/50 flex items-center justify-center  active:scale-95 transition-transform">
 <RotateCcw className="h-3.5 w-3.5 text-foreground" />
 </button>
 <button onClick={() => { banner.setFile(null); banner.setPreview(""); }} className="h-8 w-8 rounded-lg bg-card border border-border/50 flex items-center justify-center  active:scale-95 transition-transform">
 <X className="h-3.5 w-3.5 text-destructive" />
 </button>
 </div>
 </div>
 ) : (
 <button
 type="button" onClick={() => banner.ref.current?.click()}
 className="w-full h-16 rounded-lg border-2 border-dashed border-border/30 hover:border-primary/30 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all"
 >
 <Upload className="h-4 w-4" />
 <span className="text-[10px] font-medium">Clique para enviar</span>
 </button>
 )}
 </div>
 ))}
 </SectionCard>

  <ToggleRow icon={ShieldCheck} title="Selo de garantia" desc="Garantia com ícone de proteção" checked={guaranteeEnabled} onChange={setGuaranteeEnabled} />
 <ConversionTip text="Banners de qualidade aumentam a conversão em até 32%. Use imagens claras e diretas." icon={TrendingUp} />
 </>
 )}

 {/* ── PAYMENT TAB ── */}
 {activeTab === "payment" && (
 <>
 <SectionHeader icon={CreditCard} title="Pagamento" desc="Formas de pagamento aceitas" badge="Core" />

 {/* Payment summary cards */}
 <div className="grid grid-cols-3 gap-2">
 {[
 { enabled: allowedMethods.pix && pixEnabled, icon: QrCode, label: "PIX", color: "text-success", bg: "bg-success/10 border-success/20" },
 { enabled: allowedMethods.boleto && boletoEnabled, icon: FileText, label: "Boleto", color: "text-warning", bg: "bg-warning/10 border-warning/20" },
 { enabled: allowedMethods.card && creditCardEnabled, icon: CreditCard, label: "Cartão", color: "text-info", bg: "bg-info/10 border-info/20" },
 ].map(pm => (
 <div key={pm.label} className={cn(
 "rounded-lg p-3 text-center border transition-all",
 pm.enabled ? pm.bg : "border-border/20 bg-muted/10 opacity-40"
 )}>
 <pm.icon className={cn("h-5 w-5 mx-auto mb-1", pm.enabled ? pm.color : "text-muted-foreground/30")} />
 <p className="text-[10px] font-bold">{pm.label}</p>
 <p className={cn("text-[9px] font-medium mt-0.5", pm.enabled ? "text-success" : "text-muted-foreground/40")}>{pm.enabled ? "Ativo" : "Inativo"}</p>
 </div>
 ))}
 </div>

 {allowedMethods.pix && <ToggleRow icon={QrCode} title="PIX" desc="Pagamento instantâneo" checked={pixEnabled} onChange={setPixEnabled} />}
 {allowedMethods.boleto && <ToggleRow icon={FileText} title="Boleto Bancário" desc="Vencimento em 3 dias úteis" checked={boletoEnabled} onChange={setBoletoEnabled} />}
 {allowedMethods.card && <ToggleRow icon={CreditCard} title="Cartão de Crédito" desc="Até 12x" checked={creditCardEnabled} onChange={setCreditCardEnabled} />}
 <ConversionTip text="PIX + Cartão maximiza a conversão. PIX converte 99% e cartão captura quem prefere parcelar." />
 </>
 )}

 {/* ── FORM TAB ── */}
 {activeTab === "form" && (
 <>
 <SectionHeader icon={Mail} title="Formulário" desc="Campos do formulário do checkout" />
 <ToggleRow icon={Mail} title="Confirmação de e-mail" desc="Pede e-mail 2 vezes" checked={emailConfirm} onChange={setEmailConfirm} />
 <div className="group relative flex items-center justify-between p-3 rounded-xl border border-primary/25 bg-primary/[0.04]">
 <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-primary/60" />
 <div className="flex items-center gap-3 flex-1 min-w-0">
 <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 border border-primary/15">
 <Hash className="h-4 w-4 text-primary" />
 </div>
 <div className="min-w-0">
 <p className="text-xs font-semibold text-foreground">CPF / CNPJ</p>
 <p className="text-[11px] text-muted-foreground leading-snug">Obrigatório — campo sempre ativo</p>
 </div>
 </div>
 <span className="text-[11px] font-medium bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/15">Obrigatório</span>
 </div>
 <ToggleRow icon={MapPin} title="Endereço completo" desc="CEP com auto-preenchimento" checked={addressRequired} onChange={setAddressRequired} />
 <ConversionTip text="Menos campos = mais conversão. Peça apenas o essencial." icon={MousePointerClick} />
 </>
 )}

 {/* ── BUMPS TAB ── */}
 {activeTab === "bumps" && (
 <>
 <SectionHeader icon={Package} title="Order Bumps" desc="Ofertas adicionais no checkout" badge={orderBumps.length > 0 ? `${orderBumps.length} ativo${orderBumps.length > 1 ? "s" : ""}` : undefined} />

 {orderBumps.length > 0 && (
 <div className="space-y-2">
 {orderBumps.map((bump, i) => {
 const prod = allProducts.find(p => p.id === bump.bump_product_id);
 return (
 <motion.div
 key={bump.id}
 initial={{ opacity: 0, x: -12 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: i * 0.05 }}
 className="group relative flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/[0.04]"
 >
 <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-primary/50" />
 {prod?.image_url ? (
 <img src={prod.image_url} alt={prod.name} className="h-10 w-10 rounded-lg object-cover border border-border/20" />
 ) : (
 <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
 <Package className="h-4 w-4 text-primary/60" />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <p className="text-xs font-semibold truncate">{prod?.name || "Produto"}</p>
 <p className="text-xs font-bold text-primary">+ {formatCurrency(Number(prod?.price || 0))}</p>
 </div>
 <Button variant="ghost" size="icon" onClick={() => removeBump(bump.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </motion.div>
 );
 })}
 </div>
 )}

 {availableForBump.length > 0 ? (
 <SectionCard>
 <Label className="text-[11px] font-medium text-muted-foreground block">Adicionar Bump</Label>
 <div className="max-h-[200px] overflow-y-auto divide-y divide-border/20 rounded-lg border border-border/30 bg-muted/10">
 {availableForBump.map(p => (
 <button
 key={p.id}
 onClick={() => setSelectedBumpProduct(prev => prev === p.id ? "" : p.id)}
 className={cn(
 "w-full flex items-center gap-3 p-3 text-left transition-colors",
 selectedBumpProduct === p.id ? "bg-primary/[0.06]" : "hover:bg-muted/20"
 )}
 >
 <div className={cn(
 "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
 selectedBumpProduct === p.id ? "border-primary bg-primary" : "border-border/40"
 )}>
 {selectedBumpProduct === p.id && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
 </div>
 {p.image_url ? (
 <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded-lg object-cover border border-border/20" />
 ) : (
 <div className="h-9 w-9 rounded-lg bg-muted/20 flex items-center justify-center">
 <Package className="h-3.5 w-3.5 text-muted-foreground/40" />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <p className="text-xs font-medium truncate">{p.name}</p>
 <p className="text-[11px] font-bold text-primary">{formatCurrency(Number(p.price))}</p>
 </div>
 </button>
 ))}
 </div>
 {selectedBumpProduct && (
 <Button onClick={addBump} className="w-full gap-2 h-9 text-xs font-bold">
 <Plus className="h-3.5 w-3.5" /> Adicionar como Bump
 </Button>
 )}
 </SectionCard>
 ) : orderBumps.length === 0 ? (
 <div className="rounded-xl border border-dashed border-border/30 p-8 text-center space-y-2">
 <Package className="h-8 w-8 text-muted-foreground/30 mx-auto" />
 <p className="text-xs font-semibold text-muted-foreground">Nenhum produto disponível</p>
 <p className="text-[11px] text-muted-foreground/60">Crie mais produtos para usar como bumps</p>
 </div>
 ) : null}

 <ConversionTip text="Bumps podem aumentar o ticket médio em até 40%. Ofereça produtos complementares de baixo custo." icon={TrendingUp} />
 </>
 )}

 {/* ── CRO TAB ── */}
 {activeTab === "cro" && (
 <>
 <SectionHeader icon={Zap} title="Conversão" desc="Ferramentas avançadas de CRO" />
 <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 p-5 text-center space-y-2">
 <div className="h-9 w-9 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
 <Clock className="h-4 w-4 text-primary" />
 </div>
 <p className="text-xs font-semibold text-foreground">Em breve</p>
 <p className="text-[11px] text-muted-foreground leading-relaxed">
 Estamos desenvolvendo as ferramentas de CRO (vídeo de vendas, escassez,
 depoimentos, badges de confiança e mais) com persistência real e
 aplicação no checkout publicado. Avisaremos quando estiverem disponíveis.
 </p>
 </div>
 </>
 )}
 </motion.div>
 </AnimatePresence>
 </div>

 {/* Bottom Bar */}
 <div className="p-3 border-t border-border/40 bg-card/80">
 <div className="flex items-center gap-2">
 {checkoutUrl && (
 <>
 <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(checkoutUrl); toast.success("Link copiado!"); }} className="flex-1 gap-1.5 h-9 text-xs font-medium">
 <Copy className="h-3 w-3" /> Copiar Link
 </Button>
 <Button variant="outline" size="sm" onClick={() => window.open(checkoutUrl, "_blank")} className="gap-1.5 h-9 text-xs font-medium">
 <ExternalLink className="h-3 w-3" />
 </Button>
 </>
 )}
 <Button size="sm" onClick={autoSave} disabled={saving} className="gap-1.5 h-9 text-xs font-bold">
 {saving ? (
 <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity }} className="h-3 w-3 border border-primary-foreground/30 border-t-primary-foreground rounded-full" />
 ) : <Check className="h-3 w-3" />}
 Salvar
 </Button>
 </div>
 </div>
 </aside>

 {/* ─── RIGHT: Live Preview ─── */}
 <main className="flex-1 flex flex-col min-h-0 bg-muted/10 overflow-hidden">
 
 {/* Preview Header */}
 <div className="h-12 border-b border-border/40 bg-card/80 backdrop-blur-sm flex items-center justify-between px-5 sticky top-0 z-10">
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2">
 <Eye className="h-3.5 w-3.5 text-primary" />
 <span className="text-xs font-bold text-foreground">Preview</span>
 </div>
 <div className="h-4 w-px bg-border/30" />
 <div className="flex items-center gap-1.5">
 <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
 <span className="text-[10px] text-success font-medium">Tempo real</span>
 </div>
 <div className="h-4 w-px bg-border/30" />
 <span className="text-[10px] text-muted-foreground font-medium">{themeLabel}</span>
 </div>

 <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/30 border border-border/30">
 {[
 { mode: "desktop" as const, icon: Monitor },
 { mode: "mobile" as const, icon: Smartphone },
 ].map(m => (
 <button
 key={m.mode}
 onClick={() => setPreviewMode(m.mode)}
 className={cn(
 "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all",
 previewMode === m.mode ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
 )}
 >
 {previewMode === m.mode && (
 <motion.div
 layoutId="preview-mode"
 className="absolute inset-0 bg-card  border border-border/40 rounded-md"
 transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
 />
 )}
 <m.icon className="h-3 w-3 relative z-10" />
 <span className="relative z-10 hidden sm:inline">{m.mode === "desktop" ? "Desktop" : "Mobile"}</span>
 </button>
 ))}
 </div>

 <div className="flex items-center gap-2">
 <span className="text-[10px] text-muted-foreground font-medium">Score</span>
 <span className="text-sm font-numbers font-bold text-primary">{optimizationScore.score}/{optimizationScore.max}</span>
 </div>
 </div>

 {/* Preview Canvas */}
 <div
 className="flex-1 flex items-start justify-center p-6 lg:p-10 overflow-auto min-h-0"
 style={{
 backgroundImage: "radial-gradient(circle, hsl(var(--border)/0.08) 1px, transparent 1px)",
 backgroundSize: "20px 20px",
 }}
 >
 <motion.div
 layout
 transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
 className={cn(
 "transition-all duration-500",
 previewMode === "desktop" ? "w-full max-w-2xl" : "w-[375px]"
 )}
 >
 {/* Browser Chrome */}
 <div className="rounded-t-xl border-t border-x border-border/30 bg-card/90 px-4 py-2 flex items-center gap-3">
 <div className="flex gap-1.5">
 <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
 <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
 <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
 </div>
 <div className="flex-1 mx-2">
 <div className="flex items-center gap-1.5 bg-muted/30 rounded-md px-3 py-1 border border-border/20">
 <Lock className="h-2.5 w-2.5 text-success/60" />
  <span className="text-[9px] text-muted-foreground font-mono truncate">{checkoutUrl || "venxpay.com.br/pay/seu-produto"}</span>
 </div>
 </div>
 <div className="flex items-center gap-1">
 <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
 <span className="text-[11px] font-medium text-success/60 ">Live</span>
 </div>
 </div>

 {/* Preview Content */}
 <div data-preview-theme={checkoutTheme} className={cn(
 "rounded-b-xl border border-t-0 border-border/30  overflow-hidden",
 checkoutTheme === "white" ? "bg-[#fafbfc]" : checkoutTheme === "dark" ? "bg-[hsl(220_18%_11%)]" : "bg-[#f0f1f3]"
 )}>
 {/* Banner */}
 {(previewMode === "desktop" ? bannerDesktopPreview : bannerMobilePreview) && (
 <img src={previewMode === "desktop" ? bannerDesktopPreview : bannerMobilePreview} alt="Banner" className="w-full h-32 object-cover" />
 )}





 {/* Timer */}
 {timerEnabled && (
 <div className="px-5 pt-4">
 <div className="flex items-center justify-center gap-2 text-[12px] font-bold text-amber-600 bg-amber-500/10 rounded-lg py-2.5 border border-amber-500/10">
 <Timer className="h-4 w-4" /> Oferta expira em {timerMinutes}:00
 </div>
 </div>
 )}


 <div className="p-5 space-y-4">
 {/* Product info */}
 <div className="flex items-center gap-3">
 {product?.image_url ? (
 <img src={product.image_url} className="h-14 w-14 rounded-xl object-cover border border-gray-200 shadow" />
 ) : (
 <div className="h-14 w-14 rounded-xl flex items-center justify-center border border-gray-200" style={{ backgroundColor: buttonColor + "15" }}>
 <Package className="h-5 w-5" style={{ color: buttonColor }} />
 </div>
 )}
 <div>
 <p className="text-sm font-bold text-gray-900">{product?.name}</p>
 <p className="text-xl font-black tracking-tight" style={{ color: buttonColor }}>{formatCurrency(Number(product?.price || 0))}</p>
 </div>
 </div>


 {/* Form fields */}
 <div className="space-y-2.5">
 <PreviewField label="Nome completo" theme={checkoutTheme} />
 <PreviewField label="E-mail" theme={checkoutTheme} />
 {emailConfirm && <PreviewField label="Confirme seu e-mail" theme={checkoutTheme} />}
 {cpfRequired && <PreviewField label="CPF / CNPJ" theme={checkoutTheme} />}
 {addressRequired && (
 <div className="grid grid-cols-3 gap-2">
 <PreviewField label="CEP" theme={checkoutTheme} />
 <div className="col-span-2"><PreviewField label="Endereço" theme={checkoutTheme} /></div>
 </div>
 )}
 </div>

 {/* Payment methods */}
 <div className="flex gap-2 flex-wrap">
 {pixEnabled && <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 inline-flex items-center gap-1.5"><QrCode className="h-3 w-3" /> PIX</span>}
 {boletoEnabled && <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/15 inline-flex items-center gap-1.5"><FileText className="h-3 w-3" /> Boleto</span>}
 {creditCardEnabled && <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/15 inline-flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Cartão</span>}
 </div>

 {/* Order bumps — Persuasive */}
 {orderBumps.length > 0 && (
 <div className="space-y-2.5">
 <div className="flex items-center gap-2 px-0.5">
 <div className="h-4 w-4 rounded-md flex items-center justify-center" style={{ backgroundColor: buttonColor + "18" }}>
 <Sparkles className="h-2.5 w-2.5" style={{ color: buttonColor }} />
 </div>
 <span className="text-[11px] font-extrabold " style={{ color: buttonColor }}>Oferta exclusiva</span>
 <div className="flex-1 h-px" style={{ backgroundColor: buttonColor + "15" }} />
 </div>
 {orderBumps.map(bump => {
 const prod = allProducts.find(p => p.id === bump.bump_product_id);
 return (
 <div key={bump.id} className="relative rounded-xl border-2 border-dashed p-3.5 overflow-hidden transition-all hover: cursor-pointer" style={{ borderColor: buttonColor + "35", background: `linear-gradient(135deg, ${buttonColor}08, ${buttonColor}03)` }}>
 <div className="absolute top-0 right-0 text-white text-[7px] font-extrabold px-2.5 py-1 rounded-bl-lg" style={{ backgroundColor: buttonColor }}>
 APROVEITE!
 </div>
 <div className="flex items-center gap-3">
 {prod?.image_url ? (
 <img src={prod.image_url} className="h-12 w-12 rounded-lg object-cover border border-gray-200 " />
 ) : (
 <div className="h-12 w-12 rounded-lg border border-gray-200 flex items-center justify-center " style={{ backgroundColor: buttonColor + "10" }}>
 <Package className="h-5 w-5" style={{ color: buttonColor + "60" }} />
 </div>
 )}
 <div className="flex-1 min-w-0">
 <p className="text-xs font-bold text-gray-800 truncate">{prod?.name || "Bump"}</p>
 <p className="text-[10px] text-gray-400 mt-0.5">Adicione ao seu pedido</p>
 <p className="text-sm font-extrabold mt-0.5" style={{ color: buttonColor }}>+ {formatCurrency(Number(prod?.price || 0))}</p>
 </div>
 <div className="h-8 w-8 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all" style={{ borderColor: buttonColor + "40", backgroundColor: buttonColor + "08" }}>
 <Plus className="h-3.5 w-3.5" style={{ color: buttonColor }} />
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* CTA */}
 <button
 className="w-full py-3.5 rounded-lg text-white font-bold text-sm flex items-center justify-center gap-2 transition-transform "
 style={{ backgroundColor: buttonColor, boxShadow: `0 8px 24px -6px ${buttonColor}40` }}
 >
 <Lock className="h-4 w-4" /> COMPRAR AGORA
 </button>


 {/* Guarantee */}
 {guaranteeEnabled && (
 <div className="flex items-center justify-center gap-2 py-1 text-[11px] font-semibold" style={{ color: buttonColor }}>
 <ShieldCheck className="h-4 w-4" /> Garantia de 7 dias ou dinheiro de volta
 </div>
 )}

 </div>

 </div>
 </motion.div>
 </div>
 </main>

 {/* Theme overrides for dark preview */}
 <style>{`
 [data-preview-theme="dark"] .bg-white,
 [data-preview-theme="dark"] .bg-gray-50 { background-color: hsl(220 16% 14%) !important; }
 [data-preview-theme="dark"] .bg-gray-100 { background-color: hsl(220 15% 18%) !important; }
 [data-preview-theme="dark"] .border-gray-100,
 [data-preview-theme="dark"] .border-gray-200 { border-color: hsl(220 12% 24%) !important; }
 [data-preview-theme="dark"] .text-gray-900,
 [data-preview-theme="dark"] .text-gray-800,
 [data-preview-theme="dark"] .text-gray-700,
 [data-preview-theme="dark"] .text-gray-600 { color: hsl(210 20% 96%) !important; }
 [data-preview-theme="dark"] .text-gray-500,
 [data-preview-theme="dark"] .text-gray-400,
 [data-preview-theme="dark"] .text-gray-300 { color: hsl(215 10% 66%) !important; }
 `}</style>
 </div>
 );
}
