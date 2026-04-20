/**
 * Checkout Builder — Premium immersive checkout customizer
 * @module CheckoutBuilder
 * @version 5.0.0
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 Palette, CreditCard, Mail, Package, Plus, Trash2, ArrowLeft,
 Timer, ShieldCheck, QrCode, FileText, MapPin, X, Upload,
 Zap, Video, Users, LogOut as ExitIcon, BarChart3, Monitor, Smartphone, Check, Eye,
 MessageSquare, Clock, Star, Lock, Percent,
 Sparkles, Phone, Hash, MousePointerClick,
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
  { id: "visual", label: "Design", icon: Palette },
  { id: "form", label: "Formulário", icon: Mail },
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
 <div className={cn("rounded-xl border border-border/40 bg-card/95 p-4 space-y-3 shadow-sm", className)}>
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
 <span className="text-[8px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/10">{badge}</span>
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
 <span className="text-[7px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{badge}</span>
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
 <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mb-0.5">Dica de conversão</p>
 <p className="text-[11px] text-muted-foreground leading-relaxed">{text}</p>
 </div>
 </div>
 );
}

/* ─── Preview Field ─── */
function PreviewField({ label, theme }: { label: string; theme?: string }) {
 return (
 <div>
 <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">{label}</p>
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
 const { user } = useAuth();
 const [product, setProduct] = useState<Tables<"products"> | null>(null);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<TabId>("visual");
 const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
 const [saving, setSaving] = useState(false);
 const [changeCount, setChangeCount] = useState(0);
 const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
 const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

 // Settings state
 const [buttonColor, setButtonColor] = useState("#10b981");
 const [checkoutTheme, setCheckoutTheme] = useState<"gray" | "white" | "dark">("gray");
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

 // Optimization score
 const optimizationScore = (() => {
 let s = 0, max = 12;
 if (pixEnabled) s++;
 if (creditCardEnabled) s++;
 if (boletoEnabled) s++;
 if (timerEnabled) s++;
 if (socialProof) s++;
 if (guaranteeEnabled) s++;
 if (trustBadgesEnabled) s++;
 if (progressBarEnabled) s++;
 if (testimonialEnabled) s++;
 if (scarcityEnabled) s++;
 if (orderBumps.length > 0) s++;
 if (bannerDesktopPreview || bannerMobilePreview) s++;
 return { score: s, max };
 })();

 // Tab feature counts
  const getTabFeatureCount = (tabId: TabId): number => {
    switch (tabId) {
      case "visual": return [timerEnabled, socialProof, guaranteeEnabled, !!bannerDesktopPreview, !!bannerMobilePreview].filter(Boolean).length;
      case "form": return [emailConfirm, phoneRequired, cpfRequired, addressRequired, nameOnCardRequired].filter(Boolean).length;
      case "cro": return [vslEnabled, fakeViewersEnabled, exitIntentEnabled, progressBarEnabled, testimonialEnabled, scarcityEnabled, whatsappEnabled, discountBadgeEnabled, trustBadgesEnabled].filter(Boolean).length;
      default: return 0;
    }
  };

 // Load product
 useEffect(() => {
 if (!user?.id || !productId) return;
 setLoading(true);
 supabase.from("products").select("*").eq("id", productId).eq("user_id", user.id).maybeSingle()
 .then(({ data, error }) => {
 if (error || !data) { toast.error("Produto não encontrado"); navigate("/vendas/produtos"); return; }
 setProduct(data);
 setButtonColor(data.checkout_button_color || "#10b981");
 setCheckoutTheme((data as any).checkout_theme === "white" ? "white" : (data as any).checkout_theme === "dark" ? "dark" : "gray");
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

 // Auto-save
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
 setChangeCount(0);
 if (!error) toast.success("Alterações salvas", { duration: 1500 });
 }, [user?.id, productId, buttonColor, checkoutTheme, timerEnabled, timerMinutes, socialProof, guaranteeEnabled, pixEnabled, boletoEnabled, creditCardEnabled, addressRequired, emailConfirm, bannerDesktopPreview, bannerMobilePreview, bannerDesktopFile, bannerMobileFile]);

 useEffect(() => {
 if (loading || !product) return;
 setChangeCount(prev => prev + 1);
 if (saveTimeout.current) clearTimeout(saveTimeout.current);
 saveTimeout.current = setTimeout(autoSave, 1200);
 return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
 }, [buttonColor, checkoutTheme, timerEnabled, timerMinutes, socialProof, guaranteeEnabled, pixEnabled, boletoEnabled, creditCardEnabled, addressRequired, emailConfirm]);

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
 <aside className="w-full lg:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-[50vh] lg:h-screen min-h-0">
 
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
 "relative flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all duration-200",
 isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
 )}
 >
 {isActive && (
 <motion.div
 layoutId="builder-tab"
 className="absolute inset-0 rounded-md bg-card border border-border/50 shadow-sm"
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
 <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Tema Visual</Label>
 <div className="grid grid-cols-3 gap-2.5">
 {[
 { key: "gray" as const, name: "Cinza Suave", preview: "bg-gradient-to-b from-gray-100 to-gray-200", ring: "border-gray-300" },
 { key: "white" as const, name: "Branco", preview: "bg-gradient-to-b from-white to-gray-50", ring: "border-gray-200" },
 { key: "dark" as const, name: "Escuro", preview: "bg-gradient-to-b from-[hsl(220_16%_18%)] to-[hsl(220_18%_10%)]", ring: "border-[hsl(220_12%_28%)]" },
 ].map(theme => (
 <button
 key={theme.key}
 type="button"
 onClick={() => setCheckoutTheme(theme.key)}
 className={cn(
 "relative rounded-lg border-2 p-2.5 transition-all text-left group",
 checkoutTheme === theme.key
 ? "border-primary shadow-sm shadow-primary/10"
 : "border-border/30 hover:border-border/60"
 )}
 >
 {checkoutTheme === theme.key && (
 <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
 <Check className="h-2.5 w-2.5 text-primary-foreground" />
 </div>
 )}
 <div className={cn("h-10 rounded-md mb-2 border", theme.preview, theme.ring)} />
 <p className="text-[10px] font-bold text-foreground">{theme.name}</p>
 </button>
 ))}
 </div>
 </SectionCard>

 {/* Color Picker */}
 <SectionCard>
 <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Cor do Botão CTA</Label>
 <div className="flex gap-2 flex-wrap">
 {PRESET_COLORS.map(c => (
 <button
 key={c.hex}
 onClick={() => setButtonColor(c.hex)}
 className={cn(
 "h-8 w-8 rounded-lg transition-all relative shadow-sm",
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
 className="h-11 rounded-lg flex items-center justify-center text-white text-sm font-bold gap-2 cursor-pointer transition-transform active:scale-[0.98]"
 style={{ backgroundColor: buttonColor, boxShadow: `0 8px 24px -6px ${buttonColor}40` }}
 >
 <Sparkles className="h-4 w-4" /> COMPRAR AGORA — R$ {Number(product?.price || 0).toFixed(2)}
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
 <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Banners</Label>
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
 <button onClick={() => banner.ref.current?.click()} className="h-8 w-8 rounded-lg bg-card border border-border/50 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
 <RotateCcw className="h-3.5 w-3.5 text-foreground" />
 </button>
 <button onClick={() => { banner.setFile(null); banner.setPreview(""); }} className="h-8 w-8 rounded-lg bg-card border border-border/50 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
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

 <ToggleRow icon={Users} title="Prova social" desc="Mostra compradores recentes" checked={socialProof} onChange={setSocialProof} />
 <ToggleRow icon={ShieldCheck} title="Selo de garantia" desc="Garantia com ícone de proteção" checked={guaranteeEnabled} onChange={setGuaranteeEnabled} />
 <ConversionTip text="Banners de qualidade aumentam a conversão em até 32%. Use imagens claras e diretas." icon={TrendingUp} />
 </>
 )}


 {/* ── FORM TAB ── */}
 {activeTab === "form" && (
 <>
 <SectionHeader icon={Mail} title="Formulário" desc="Campos do formulário do checkout" />
 <ToggleRow icon={Mail} title="Confirmação de e-mail" desc="Pede e-mail 2 vezes" checked={emailConfirm} onChange={setEmailConfirm} />
 <ToggleRow icon={Phone} title="Telefone / WhatsApp" desc="Solicita número" checked={phoneRequired} onChange={setPhoneRequired} />
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
 <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/15">Obrigatório</span>
 </div>
 <ToggleRow icon={MapPin} title="Endereço completo" desc="CEP com auto-preenchimento" checked={addressRequired} onChange={setAddressRequired} />
 <ToggleRow icon={CreditCard} title="Nome no cartão" desc="Campo separado" checked={nameOnCardRequired} onChange={setNameOnCardRequired} badge="Novo" />
 <ConversionTip text="Menos campos = mais conversão. Peça apenas o essencial." icon={MousePointerClick} />
 </>
 )}


 {/* ── CRO TAB ── */}
 {activeTab === "cro" && (
 <>
 <SectionHeader icon={Zap} title="Conversão" desc="Ferramentas avançadas de CRO" badge="Pro" />

 <ToggleRow icon={Video} title="Vídeo de vendas (VSL)" desc="Player no topo do checkout" checked={vslEnabled} onChange={setVslEnabled} />
 {vslEnabled && (
 <Input value={vslUrl} onChange={(e) => setVslUrl(e.target.value)} placeholder="https://youtube.com/embed/..." className="h-9 rounded-lg bg-muted/20 border-border/30 text-xs" />
 )}

 <ToggleRow icon={BarChart3} title="Barra de progresso" desc="Mostra etapa atual da compra" checked={progressBarEnabled} onChange={setProgressBarEnabled} />
 <ToggleRow icon={Users} title="Compradores em tempo real" desc="Quantidade fictícia de compradores" checked={fakeViewersEnabled} onChange={setFakeViewersEnabled} />
 <ToggleRow icon={Star} title="Depoimentos" desc="Testemunhos de compradores" checked={testimonialEnabled} onChange={setTestimonialEnabled} />

 <ToggleRow icon={Clock} title="Escassez de vagas" desc="Vagas limitadas" checked={scarcityEnabled} onChange={setScarcityEnabled}
 extra={scarcityEnabled ? (
 <Input type="number" min="1" max="999" value={scarcityUnits} onChange={(e) => setScarcityUnits(e.target.value)} className="w-14 h-7 text-center text-[11px] rounded-md bg-muted/20 border-border/30 font-bold" />
 ) : undefined}
 />

 <ToggleRow icon={Percent} title="Badge de desconto" desc="Preço original riscado" checked={discountBadgeEnabled} onChange={setDiscountBadgeEnabled} />
 {discountBadgeEnabled && (
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground shrink-0">De R$</span>
 <Input type="number" value={discountOriginalPrice} onChange={(e) => setDiscountOriginalPrice(e.target.value)} placeholder="297.00" className="h-9 rounded-lg bg-muted/20 border-border/30 text-xs font-bold" />
 </div>
 )}

 <ToggleRow icon={ExitIcon} title="Exit intent" desc="Popup ao tentar sair" checked={exitIntentEnabled} onChange={setExitIntentEnabled} badge="Pro" />
 <ToggleRow icon={MessageSquare} title="Botão WhatsApp" desc="Suporte via WhatsApp" checked={whatsappEnabled} onChange={setWhatsappEnabled} />
 {whatsappEnabled && (
 <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="5511999999999" className="h-9 rounded-lg bg-muted/20 border-border/30 text-xs" />
 )}

 <ToggleRow icon={Lock} title="Selos de confiança" desc="SSL, compra segura, dados criptografados" checked={trustBadgesEnabled} onChange={setTrustBadgesEnabled} badge="Novo" />
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
 className="absolute inset-0 bg-card shadow-sm border border-border/40 rounded-md"
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
 <span className="text-[9px] text-muted-foreground font-mono truncate">{checkoutUrl || "podpay.com/pay/seu-produto"}</span>
 </div>
 </div>
 <div className="flex items-center gap-1">
 <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
 <span className="text-[7px] font-bold text-success/60 uppercase tracking-widest">Live</span>
 </div>
 </div>

 {/* Preview Content */}
 <div data-preview-theme={checkoutTheme} className={cn(
 "rounded-b-xl border border-t-0 border-border/30 shadow-xl overflow-hidden",
 checkoutTheme === "white" ? "bg-[#fafbfc]" : checkoutTheme === "dark" ? "bg-[hsl(220_18%_11%)]" : "bg-[#f0f1f3]"
 )}>
 {/* Banner */}
 {(previewMode === "desktop" ? bannerDesktopPreview : bannerMobilePreview) && (
 <img src={previewMode === "desktop" ? bannerDesktopPreview : bannerMobilePreview} alt="Banner" className="w-full h-32 object-cover" />
 )}

 {/* VSL */}
 {vslEnabled && vslUrl && (
 <div className="p-5 pb-0">
 <div className="aspect-video rounded-xl bg-gray-900 flex items-center justify-center">
 <div className="flex flex-col items-center gap-2 text-gray-400">
 <Video className="h-8 w-8" />
 <span className="text-[10px]">Vídeo de vendas</span>
 </div>
 </div>
 </div>
 )}

 {/* Progress bar */}
 {progressBarEnabled && (
 <div className="px-5 pt-5">
 <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-700 mb-2">
 <span className="h-5 w-5 rounded-full text-white flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: buttonColor }}>1</span>
 Você está a 1 passo da sua vaga
 </div>
 <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
 <motion.div initial={{ width: 0 }} animate={{ width: "66%" }} transition={{ duration: 1.2 }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${buttonColor}, ${buttonColor}99)` }} />
 </div>
 </div>
 )}

 {/* Fake viewers */}
 {fakeViewersEnabled && (
 <div className="px-5 pt-4">
 <div className="inline-flex items-center gap-2 text-[11px] font-bold rounded-lg bg-orange-500/10 text-orange-600 px-3 py-2 border border-orange-500/15">
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute h-full w-full rounded-full bg-orange-500 opacity-75" />
 <span className="relative rounded-full h-2 w-2 bg-orange-500" />
 </span>
 14 pessoas comprando agora
 </div>
 </div>
 )}

 {/* Scarcity */}
 {scarcityEnabled && (
 <div className="px-5 pt-4">
 <div className="flex items-center gap-2 text-[11px] font-bold text-red-600 bg-red-500/10 rounded-lg py-2 px-3 border border-red-500/15">
 <Clock className="h-3.5 w-3.5" /> Apenas {scarcityUnits} vagas restantes
 </div>
 </div>
 )}

 {/* Timer */}
 {timerEnabled && (
 <div className="px-5 pt-4">
 <div className="flex items-center justify-center gap-2 text-[12px] font-bold text-amber-600 bg-amber-500/10 rounded-lg py-2.5 border border-amber-500/10">
 <Timer className="h-4 w-4" /> Oferta expira em {timerMinutes}:00
 </div>
 </div>
 )}

 {/* Discount badge */}
 {discountBadgeEnabled && discountOriginalPrice && (
 <div className="px-5 pt-4">
 <div className="inline-flex items-center gap-2 text-[11px] font-bold bg-emerald-500/10 text-emerald-600 px-3 py-2 rounded-lg border border-emerald-500/15">
 <Percent className="h-3 w-3" />
 De <span className="line-through text-gray-400">R$ {Number(discountOriginalPrice).toFixed(2)}</span> por <span className="font-black">R$ {Number(product?.price || 0).toFixed(2)}</span>
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
 <p className="text-xl font-black tracking-tight" style={{ color: buttonColor }}>R$ {Number(product?.price || 0).toFixed(2)}</p>
 </div>
 </div>

 {/* Testimonials */}
 {testimonialEnabled && (
 <div className="space-y-2">
 {[
 { name: "Maria S.", text: "Melhor investimento que fiz!", rating: 5 },
 { name: "João P.", text: "Conteúdo incrível, recomendo!", rating: 5 },
 ].map((t, i) => (
 <div key={i} className="p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
 <div className="flex items-center gap-2 mb-1">
 <div className="h-5 w-5 rounded-full bg-amber-400/15 flex items-center justify-center text-[8px] font-bold text-amber-500">{t.name[0]}</div>
 <div className="flex gap-0.5">
 {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />)}
 </div>
 <span className="text-[10px] font-medium text-gray-500">{t.name}</span>
 </div>
 <p className="text-[11px] text-gray-500 italic pl-7">"{t.text}"</p>
 </div>
 ))}
 </div>
 )}

 {/* Social proof */}
 {socialProof && (
 <div className="flex items-center gap-2 text-[11px] text-gray-600">
 <div className="flex -space-x-1.5">
 {[1,2,3,4].map(i => (
 <div key={i} className="h-6 w-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: buttonColor + (20 + i * 10).toString(16) }} />
 ))}
 </div>
 <span className="font-semibold">+127 compraram nas últimas 24h</span>
 </div>
 )}

 {/* Form fields */}
 <div className="space-y-2.5">
 <PreviewField label="Nome completo" theme={checkoutTheme} />
 <PreviewField label="E-mail" theme={checkoutTheme} />
 {emailConfirm && <PreviewField label="Confirme seu e-mail" theme={checkoutTheme} />}
 {phoneRequired && <PreviewField label="WhatsApp" theme={checkoutTheme} />}
 {cpfRequired && <PreviewField label="CPF / CNPJ" theme={checkoutTheme} />}
 {nameOnCardRequired && creditCardEnabled && <PreviewField label="Nome impresso no cartão" theme={checkoutTheme} />}
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
 <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: buttonColor }}>Oferta exclusiva</span>
 <div className="flex-1 h-px" style={{ backgroundColor: buttonColor + "15" }} />
 </div>
 {orderBumps.map(bump => {
 const prod = allProducts.find(p => p.id === bump.bump_product_id);
 return (
 <div key={bump.id} className="relative rounded-xl border-2 border-dashed p-3.5 overflow-hidden transition-all hover:shadow-md cursor-pointer" style={{ borderColor: buttonColor + "35", background: `linear-gradient(135deg, ${buttonColor}08, ${buttonColor}03)` }}>
 <div className="absolute top-0 right-0 text-white text-[7px] font-extrabold px-2.5 py-1 rounded-bl-lg" style={{ backgroundColor: buttonColor }}>
 APROVEITE!
 </div>
 <div className="flex items-center gap-3">
 {prod?.image_url ? (
 <img src={prod.image_url} className="h-12 w-12 rounded-lg object-cover border border-gray-200 shadow-sm" />
 ) : (
 <div className="h-12 w-12 rounded-lg border border-gray-200 flex items-center justify-center shadow-sm" style={{ backgroundColor: buttonColor + "10" }}>
 <Package className="h-5 w-5" style={{ color: buttonColor + "60" }} />
 </div>
 )}
 <div className="flex-1 min-w-0">
 <p className="text-xs font-bold text-gray-800 truncate">{prod?.name || "Bump"}</p>
 <p className="text-[10px] text-gray-400 mt-0.5">Adicione ao seu pedido</p>
 <p className="text-sm font-extrabold mt-0.5" style={{ color: buttonColor }}>+ R$ {Number(prod?.price || 0).toFixed(2)}</p>
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
 className="w-full py-3.5 rounded-lg text-white font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
 style={{ backgroundColor: buttonColor, boxShadow: `0 8px 24px -6px ${buttonColor}40` }}
 >
 <Lock className="h-4 w-4" /> COMPRAR AGORA
 </button>

 {/* Trust badges */}
 {trustBadgesEnabled && (
 <div className="flex items-center justify-center gap-5 py-2">
 {[
 { icon: Lock, label: "SSL Seguro" },
 { icon: ShieldCheck, label: "Compra Protegida" },
 { icon: CreditCard, label: "Dados Criptografados" },
 ].map((b, i) => (
 <div key={i} className="flex flex-col items-center gap-1">
 <div className="h-6 w-6 rounded-md bg-gray-100 flex items-center justify-center border border-gray-200">
 <b.icon className="h-3 w-3 text-gray-400" />
 </div>
 <span className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">{b.label}</span>
 </div>
 ))}
 </div>
 )}

 {/* Guarantee */}
 {guaranteeEnabled && (
 <div className="flex items-center justify-center gap-2 py-1 text-[11px] font-semibold" style={{ color: buttonColor }}>
 <ShieldCheck className="h-4 w-4" /> Garantia de 7 dias ou dinheiro de volta
 </div>
 )}

 {/* WhatsApp */}
 {whatsappEnabled && (
 <div className="flex items-center justify-center">
 <div className="inline-flex items-center gap-2 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/15">
 <MessageSquare className="h-3.5 w-3.5" /> Dúvidas? Fale no WhatsApp
 </div>
 </div>
 )}
 </div>

 {/* Exit intent indicator */}
 {exitIntentEnabled && (
 <div className="border-t border-gray-200 p-3 bg-gray-50 text-center">
 <p className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1.5">
 <ExitIcon className="h-3 w-3" /> Exit Intent ativo
 </p>
 </div>
 )}
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
