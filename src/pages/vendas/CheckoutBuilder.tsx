/**
 * Checkout Builder — Ultra-Premium immersive checkout customizer
 * @module CheckoutBuilder
 * @version 4.0.0
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
  Sparkles, Phone, Hash, ChevronRight, Grip, CircleDot, Layers, MousePointerClick,
  RotateCcw, Copy, ExternalLink, Settings2, Wand2, TrendingUp
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
  { id: "visual", label: "Visual", icon: Palette, color: "from-violet-500/20 to-violet-500/5", activeColor: "text-violet-400", emoji: "🎨" },
  { id: "payment", label: "Pagamento", icon: CreditCard, color: "from-blue-500/20 to-blue-500/5", activeColor: "text-blue-400", emoji: "💳" },
  { id: "form", label: "Formulário", icon: Mail, color: "from-cyan-500/20 to-cyan-500/5", activeColor: "text-cyan-400", emoji: "📋" },
  { id: "bumps", label: "Order Bumps", icon: Package, color: "from-amber-500/20 to-amber-500/5", activeColor: "text-amber-400", emoji: "🎁" },
  { id: "cro", label: "Conversão", icon: Zap, color: "from-rose-500/20 to-rose-500/5", activeColor: "text-rose-400", emoji: "🚀" },
] as const;

type TabId = typeof TABS[number]["id"];

const PRESET_COLORS = [
  { name: "Esmeralda", hex: "#10b981", ring: "ring-emerald-400/30" },
  { name: "Laranja", hex: "#f97316", ring: "ring-orange-400/30" },
  { name: "Royal", hex: "#3b82f6", ring: "ring-blue-400/30" },
  { name: "Roxo", hex: "#8b5cf6", ring: "ring-violet-400/30" },
  { name: "Rosa", hex: "#ec4899", ring: "ring-pink-400/30" },
  { name: "Vermelho", hex: "#ef4444", ring: "ring-red-400/30" },
  { name: "Dourado", hex: "#eab308", ring: "ring-yellow-400/30" },
  { name: "Cyan", hex: "#06b6d4", ring: "ring-cyan-400/30" },
];

/* ─── Animated Score Ring ─── */
function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const r = 18, c = 2 * Math.PI * r;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--border)/0.15)" strokeWidth="3" />
        <motion.circle
          cx="22" cy="22" r={r} fill="none"
          stroke={pct >= 80 ? "hsl(var(--success))" : pct >= 50 ? "hsl(var(--warning))" : "hsl(var(--primary))"}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * pct / 100) }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-display font-black text-primary tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

/* ─── Floating Change Indicator ─── */
function ChangeIndicator({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <motion.div
      initial={{ scale: 0, y: 10 }}
      animate={{ scale: 1, y: 0 }}
      className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center ring-2 ring-card z-10"
    >
      {count}
    </motion.div>
  );
}

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
  const [hoveredPreviewElement, setHoveredPreviewElement] = useState<string | null>(null);

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
    if (!error) toast.success("Alterações salvas automaticamente", { duration: 1500 });
  }, [user?.id, productId, buttonColor, checkoutTheme, timerEnabled, timerMinutes, socialProof, guaranteeEnabled, pixEnabled, boletoEnabled, creditCardEnabled, addressRequired, emailConfirm, bannerDesktopPreview, bannerMobilePreview, bannerDesktopFile, bannerMobileFile]);

  // Trigger auto-save on settings change
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

  // Tab change counts for indicators
  const getTabFeatureCount = (tabId: TabId): number => {
    switch (tabId) {
      case "visual": return [timerEnabled, socialProof, guaranteeEnabled, !!bannerDesktopPreview, !!bannerMobilePreview].filter(Boolean).length;
      case "payment": return [pixEnabled, boletoEnabled, creditCardEnabled].filter(Boolean).length;
      case "form": return [emailConfirm, phoneRequired, cpfRequired, addressRequired, nameOnCardRequired].filter(Boolean).length;
      case "bumps": return orderBumps.length;
      case "cro": return [vslEnabled, fakeViewersEnabled, exitIntentEnabled, progressBarEnabled, testimonialEnabled, scarcityEnabled, whatsappEnabled, discountBadgeEnabled, trustBadgesEnabled].filter(Boolean).length;
      default: return 0;
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="h-16 w-16 border-2 border-primary/10 border-t-primary rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Wand2 className="h-5 w-5 text-primary/60" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-display font-black text-foreground">Checkout Builder</p>
          <p className="text-xs text-muted-foreground/40">Carregando experiência...</p>
        </div>
      </div>
    </div>
  );

  /* ── Section Header ── */
  const SectionHeader = ({ title, desc, icon: Icon, badge }: { title: string; desc: string; icon?: React.ComponentType<{ className?: string }>; badge?: string }) => (
    <div className="flex items-center gap-3 mb-2">
      {Icon && (
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10 shadow-sm shadow-primary/5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-display font-black text-foreground">{title}</p>
          {badge && (
            <span className="text-[8px] font-black uppercase tracking-widest bg-gradient-to-r from-primary/15 to-primary/5 text-primary px-2 py-0.5 rounded-full border border-primary/10">{badge}</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/40 leading-snug">{desc}</p>
      </div>
    </div>
  );

  /* ── Toggle Row component ── */
  const ToggleRow = ({ icon: Icon, iconColor, title, desc, checked, onChange, extra, badge, highlight }: {
    icon: React.ComponentType<{ className?: string }>; iconColor?: string; title: string; desc: string;
    checked: boolean; onChange: (v: boolean) => void; extra?: React.ReactNode; badge?: string; highlight?: boolean;
  }) => (
    <motion.div
      layout
      className={cn(
        "group/toggle relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300",
        checked
          ? "border-primary/20 bg-gradient-to-r from-primary/[0.06] to-transparent shadow-sm"
          : "border-border/15 bg-card/20 hover:border-border/30 hover:bg-card/30",
        highlight && !checked && "ring-1 ring-primary/10 animate-pulse"
      )}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
    >
      {/* Active indicator bar */}
      <AnimatePresence>
        {checked && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary/60 origin-center"
          />
        )}
      </AnimatePresence>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <motion.div
          animate={{ rotate: checked ? [0, -10, 10, 0] : 0 }}
          transition={{ duration: 0.4 }}
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 border",
            checked
              ? "bg-primary/10 border-primary/15 shadow-sm shadow-primary/5"
              : "bg-muted/10 border-transparent"
          )}
        >
          <Icon className={cn("h-4 w-4 transition-colors duration-300", checked ? "text-primary" : "text-muted-foreground/30")} />
        </motion.div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("text-[12px] font-display font-bold transition-colors", checked ? "text-foreground" : "text-foreground/70")}>{title}</p>
            {badge && (
              <span className="text-[7px] font-black uppercase tracking-widest bg-gradient-to-r from-primary/15 to-primary/5 text-primary px-1.5 py-0.5 rounded-full border border-primary/10">{badge}</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/40 leading-snug">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {extra}
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </motion.div>
  );

  /* ── Conversion Tip ── */
  const ConversionTip = ({ text, icon: Icon = Zap }: { text: string; icon?: React.ComponentType<{ className?: string }> }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-gradient-to-r from-primary/[0.06] via-primary/[0.03] to-transparent border border-primary/10 p-3.5 flex items-start gap-2.5"
    >
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-0.5">Dica de conversão</p>
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{text}</p>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* ─── LEFT: Control Panel ─── */}
      <aside className="w-full lg:w-[440px] shrink-0 border-b lg:border-b-0 lg:border-r border-border/15 bg-gradient-to-b from-card/40 via-card/20 to-background backdrop-blur-2xl flex flex-col lg:h-screen lg:sticky lg:top-0 overflow-hidden">
        {/* Header — Ultra Premium */}
        <div className="p-4 pb-3 border-b border-border/10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/vendas/produtos")} className="h-9 w-9 p-0 rounded-xl hover:bg-muted/20 text-muted-foreground/60 hover:text-foreground transition-all active:scale-90">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-display font-black text-foreground truncate">{product?.name}</h1>
              </div>
              <div className="flex items-center gap-2.5 mt-0.5">
                <span className="text-[8px] font-black text-muted-foreground/25 uppercase tracking-[0.25em]">Checkout Builder</span>
                <AnimatePresence mode="wait">
                  {saving ? (
                    <motion.span
                      key="saving"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="inline-flex items-center gap-1.5 text-[9px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full"
                    >
                      <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Salvando...
                    </motion.span>
                  ) : lastSavedAt ? (
                    <motion.span
                      key="saved"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-1 text-[9px] text-success font-bold bg-success/10 px-2 py-0.5 rounded-full"
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

        {/* Tabs — Interactive pill navigation */}
        <nav className="flex gap-1 p-2 mx-3 mt-3 rounded-2xl bg-muted/8 border border-border/8">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const featureCount = getTabFeatureCount(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex-1 flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-[8px] font-black uppercase tracking-[0.15em] transition-all duration-300",
                  isActive ? "text-foreground" : "text-muted-foreground/25 hover:text-muted-foreground/50"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="builder-tab-bg"
                    className="absolute inset-0 rounded-xl bg-card/80 border border-border/15 shadow-sm"
                    transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
                  />
                )}
                <div className="relative">
                  <tab.icon className={cn("h-4 w-4 relative z-10 transition-all duration-300", isActive ? tab.activeColor : "")} />
                  {featureCount > 0 && !isActive && (
                    <div className="absolute -top-1 -right-1.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[7px] font-black flex items-center justify-center">
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
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              {/* ── VISUAL TAB ── */}
              {activeTab === "visual" && (
                <>
                  <SectionHeader icon={Palette} title="Aparência do Checkout" desc="Personalize cores, banners e tema visual" badge="Design" />
                  
                  {/* Theme Selector — Interactive cards */}
                  <div className="rounded-2xl border border-border/10 bg-card/15 p-4 space-y-3">
                    <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 block">Tema Visual</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: "gray" as const, name: "Cinza Suave", desc: "Neutro e elegante", gradient: "from-gray-200 to-gray-300", borderColor: "border-gray-300" },
                        { key: "white" as const, name: "Branco Premium", desc: "Limpo com acentos", gradient: "from-white to-gray-50", borderColor: "border-gray-200" },
                        { key: "dark" as const, name: "Cinza Escuro", desc: "Impacto premium", gradient: "from-[hsl(220_16%_18%)] to-[hsl(220_18%_10%)]", borderColor: "border-[hsl(220_12%_26%)]" },
                      ].map(theme => (
                        <motion.button
                          key={theme.key}
                          type="button"
                          onClick={() => setCheckoutTheme(theme.key)}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            "relative rounded-2xl border-2 p-3.5 transition-all duration-300 text-left overflow-hidden",
                            checkoutTheme === theme.key
                              ? "border-primary/50 bg-primary/[0.04] shadow-md shadow-primary/5"
                              : "border-border/15 bg-card/15 hover:border-border/30"
                          )}
                        >
                          <AnimatePresence>
                            {checkoutTheme === theme.key && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20"
                              >
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className={cn("h-12 rounded-xl bg-gradient-to-br mb-2.5 border relative overflow-hidden", theme.gradient, theme.borderColor)}>
                            {theme.key === "white" && (
                              <motion.div
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                              />
                            )}
                            {theme.key === "dark" && (
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_45%)]" />
                            )}
                            <div className="absolute bottom-0 left-0 right-0 h-2.5 rounded-b-xl" style={{ backgroundColor: buttonColor + "25" }} />
                          </div>
                          <p className="text-[11px] font-display font-black text-foreground">{theme.name}</p>
                          <p className="text-[9px] text-muted-foreground/35">{theme.desc}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Color picker card — Enhanced */}
                  <div className="rounded-2xl border border-border/10 bg-card/15 overflow-hidden">
                    <div className="p-4 space-y-3">
                      <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 block">Cor do Botão CTA</Label>
                      <div className="flex gap-2.5 flex-wrap">
                        {PRESET_COLORS.map(c => (
                          <motion.button
                            key={c.hex}
                            onClick={() => setButtonColor(c.hex)}
                            whileHover={{ scale: 1.2, y: -3 }}
                            whileTap={{ scale: 0.9 }}
                            className={cn(
                              "h-9 w-9 rounded-xl transition-all duration-200 relative shadow-sm",
                              buttonColor === c.hex ? "ring-2 ring-offset-2 ring-offset-background scale-110 shadow-lg " + c.ring : "hover:shadow-md"
                            )}
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                          >
                            <AnimatePresence>
                              {buttonColor === c.hex && (
                                <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} className="absolute inset-0 flex items-center justify-center">
                                  <Check className="h-4 w-4 text-white drop-shadow-md" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="w-10 h-10 rounded-xl border border-border/20 cursor-pointer opacity-0 absolute inset-0 z-10" />
                          <div className="h-10 w-10 rounded-xl border border-border/15 flex items-center justify-center shadow-inner" style={{ backgroundColor: buttonColor }}>
                            <Palette className="h-4 w-4 text-white/80 drop-shadow" />
                          </div>
                        </div>
                        <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="flex-1 font-mono text-xs h-10 rounded-xl bg-card/40 border-border/10 font-bold" />
                      </div>
                    </div>
                    {/* CTA Preview — Interactive */}
                    <div className="px-4 pb-4">
                      <motion.div
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className="h-13 rounded-2xl flex items-center justify-center text-white text-sm font-display font-black shadow-xl transition-all duration-300 gap-2.5 cursor-pointer py-3.5"
                        style={{ backgroundColor: buttonColor, boxShadow: `0 16px 40px -10px ${buttonColor}50` }}
                      >
                        <Sparkles className="h-4 w-4" /> COMPRAR AGORA — R$ {Number(product?.price || 0).toFixed(2)}
                      </motion.div>
                      <p className="text-[9px] text-center text-muted-foreground/25 mt-2 font-medium">Prévia do botão CTA</p>
                    </div>
                  </div>

                  <ToggleRow icon={Timer} iconColor="amber-500" title="Timer de urgência" desc="Contador regressivo gera senso de urgência"
                    checked={timerEnabled} onChange={setTimerEnabled}
                    extra={timerEnabled ? (
                      <div className="flex items-center gap-1">
                        <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} className="w-14 h-7 text-center text-[11px] rounded-lg bg-card/40 border-border/10 font-bold" />
                        <span className="text-[9px] text-muted-foreground/30 font-bold">min</span>
                      </div>
                    ) : undefined}
                  />

                  {/* Banners — Enhanced with device labels */}
                  <div className="space-y-2.5">
                    {[
                      { type: "desktop" as const, label: "Banner Desktop", icon: Monitor, ref: desktopRef, preview: bannerDesktopPreview, setFile: setBannerDesktopFile, setPreview: setBannerDesktopPreview, aspect: "1200×400" },
                      { type: "mobile" as const, label: "Banner Mobile", icon: Smartphone, ref: mobileRef, preview: bannerMobilePreview, setFile: setBannerMobileFile, setPreview: setBannerMobilePreview, aspect: "600×300" },
                    ].map(banner => (
                      <div key={banner.type} className="rounded-2xl border border-border/10 bg-card/15 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/30 flex items-center gap-1.5">
                            <banner.icon className="h-3 w-3" /> {banner.label}
                          </Label>
                          <span className="text-[8px] text-muted-foreground/20 font-bold">{banner.aspect}</span>
                        </div>
                        <input ref={banner.ref} type="file" accept="image/*" onChange={(e) => handleFile(e, banner.type)} className="hidden" />
                        {banner.preview ? (
                          <div className="relative rounded-xl overflow-hidden border border-border/10 group/banner">
                            <img src={banner.preview} alt={banner.label} className="w-full h-24 object-cover" />
                            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm opacity-0 group-hover/banner:opacity-100 transition-all flex items-center justify-center gap-2">
                              <button type="button" onClick={() => banner.ref.current?.click()} className="h-9 w-9 rounded-xl bg-card/90 border border-border/15 flex items-center justify-center text-foreground shadow-lg active:scale-95 transition-transform">
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => { banner.setFile(null); banner.setPreview(""); }} className="h-9 w-9 rounded-xl bg-card/90 border border-border/15 flex items-center justify-center text-destructive shadow-lg active:scale-95 transition-transform">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            type="button" onClick={() => banner.ref.current?.click()}
                            className="w-full h-20 rounded-xl border-2 border-dashed border-border/15 hover:border-primary/25 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-1.5 text-muted-foreground/25 hover:text-primary/50 transition-all duration-300"
                          >
                            <Upload className="h-4 w-4" />
                            <span className="text-[10px] font-bold">Arraste ou clique para enviar</span>
                          </motion.button>
                        )}
                      </div>
                    ))}
                  </div>

                  <ToggleRow icon={Users} title="Prova social" desc="Mostra quantas pessoas compraram recentemente" checked={socialProof} onChange={setSocialProof} highlight={!socialProof} />
                  <ToggleRow icon={ShieldCheck} iconColor="emerald-500" title="Selo de garantia" desc="Garantia com ícone de proteção" checked={guaranteeEnabled} onChange={setGuaranteeEnabled} />

                  <ConversionTip text="Banners de alta qualidade aumentam a conversão em até 32%. Use imagens claras e diretas." icon={TrendingUp} />
                </>
              )}

              {/* ── PAYMENT TAB ── */}
              {activeTab === "payment" && (
                <>
                  <SectionHeader icon={CreditCard} title="Métodos de Pagamento" desc="Escolha quais formas de pagamento aceitar" badge="Core" />

                  {/* Payment method summary */}
                  <div className="grid grid-cols-3 gap-2 mb-1">
                    {[
                      { enabled: pixEnabled, icon: QrCode, label: "PIX", activeClasses: "border-emerald-500/20 bg-emerald-500/[0.06]", iconActive: "text-emerald-400" },
                      { enabled: boletoEnabled, icon: FileText, label: "Boleto", activeClasses: "border-amber-500/20 bg-amber-500/[0.06]", iconActive: "text-amber-400" },
                      { enabled: creditCardEnabled, icon: CreditCard, label: "Cartão", activeClasses: "border-blue-500/20 bg-blue-500/[0.06]", iconActive: "text-blue-400" },
                    ].map(pm => (
                      <motion.div
                        key={pm.label}
                        layout
                        className={cn(
                          "rounded-xl p-3 text-center border transition-all duration-300",
                          pm.enabled
                            ? pm.activeClasses
                            : "border-border/10 bg-card/10 opacity-40"
                        )}
                      >
                        <pm.icon className={cn("h-5 w-5 mx-auto mb-1", pm.enabled ? pm.iconActive : "text-muted-foreground/20")} />
                        <p className="text-[9px] font-black uppercase tracking-wider">{pm.label}</p>
                        <p className={cn("text-[8px] mt-0.5 font-bold", pm.enabled ? "text-success" : "text-muted-foreground/20")}>{pm.enabled ? "Ativo" : "Inativo"}</p>
                      </motion.div>
                    ))}
                  </div>

                  <ToggleRow icon={QrCode} iconColor="emerald-500" title="PIX" desc="Pagamento instantâneo via QR Code — 99% aprovação" checked={pixEnabled} onChange={setPixEnabled} highlight={!pixEnabled} />
                  <ToggleRow icon={FileText} iconColor="amber-500" title="Boleto Bancário" desc="Vencimento em 3 dias úteis" checked={boletoEnabled} onChange={setBoletoEnabled} />
                  <ToggleRow icon={CreditCard} iconColor="blue-500" title="Cartão de Crédito" desc="Até 12x sem juros" checked={creditCardEnabled} onChange={setCreditCardEnabled} />
                  
                  <ConversionTip text="Habilite PIX + Cartão para maximizar a conversão. PIX converte 99% e cartão captura quem prefere parcelar." />
                </>
              )}

              {/* ── FORM TAB ── */}
              {activeTab === "form" && (
                <>
                  <SectionHeader icon={Mail} title="Campos do Formulário" desc="Configure quais dados o comprador precisa informar" />
                  <ToggleRow icon={Mail} title="Confirmação de e-mail" desc="Pede para digitar o e-mail 2 vezes" checked={emailConfirm} onChange={setEmailConfirm} />
                  <ToggleRow icon={Phone} title="Telefone / WhatsApp" desc="Solicita número de telefone" checked={phoneRequired} onChange={setPhoneRequired} />
                  <ToggleRow icon={Hash} title="CPF / CNPJ" desc="Solicita documento do comprador" checked={cpfRequired} onChange={setCpfRequired} />
                  <ToggleRow icon={MapPin} title="Endereço completo" desc="CEP com preenchimento automático via ViaCEP" checked={addressRequired} onChange={setAddressRequired} />
                  <ToggleRow icon={CreditCard} title="Nome no cartão" desc="Campo separado para nome impresso no cartão" checked={nameOnCardRequired} onChange={setNameOnCardRequired} badge="Novo" />

                  <ConversionTip text="Menos campos = mais conversão. Peça apenas o essencial para não perder compradores." icon={MousePointerClick} />
                </>
              )}

              {/* ── BUMPS TAB ── */}
              {activeTab === "bumps" && (
                <>
                  <SectionHeader icon={Package} title="Order Bumps" desc="Ofertas adicionais exibidas no checkout" badge={orderBumps.length > 0 ? `${orderBumps.length} ativo${orderBumps.length > 1 ? "s" : ""}` : undefined} />
                  
                  {/* Active bumps */}
                  {orderBumps.length > 0 && (
                    <div className="space-y-2">
                      {orderBumps.map((bump, i) => {
                        const prod = allProducts.find(p => p.id === bump.bump_product_id);
                        return (
                          <motion.div
                            key={bump.id}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="group/bump relative flex items-center gap-3 p-3.5 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[0.04] to-transparent hover:from-primary/[0.07] transition-all duration-300"
                          >
                            <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary/50" />
                            {prod?.image_url ? (
                              <img src={prod.image_url} alt={prod.name} className="h-12 w-12 rounded-xl object-cover border border-border/10 shadow-sm" />
                            ) : (
                              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/10">
                                <Package className="h-5 w-5 text-primary/60" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-display font-bold truncate text-foreground">{prod?.name || "Produto"}</p>
                              <p className="text-[11px] font-black text-primary">+ R$ {Number(prod?.price || 0).toFixed(2)}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeBump(bump.id)} className="text-muted-foreground/15 hover:text-destructive h-8 w-8 p-0 rounded-xl opacity-0 group-hover/bump:opacity-100 transition-all">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add new bump */}
                  {availableForBump.length > 0 ? (
                    <div className="space-y-2.5">
                      <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/25 block">Adicionar Bump</Label>
                      <div className="rounded-2xl border border-border/10 bg-card/15 overflow-hidden">
                        <div className="max-h-[240px] overflow-y-auto divide-y divide-border/5">
                          {availableForBump.map(p => (
                            <motion.button
                              key={p.id}
                              onClick={() => setSelectedBumpProduct(prev => prev === p.id ? "" : p.id)}
                              whileTap={{ scale: 0.99 }}
                              className={cn(
                                "w-full flex items-center gap-3 p-3.5 text-left transition-all duration-200",
                                selectedBumpProduct === p.id ? "bg-primary/[0.06]" : "hover:bg-muted/8"
                              )}
                            >
                              <div className={cn(
                                "h-5 w-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200",
                                selectedBumpProduct === p.id ? "border-primary bg-primary" : "border-border/25"
                              )}>
                                {selectedBumpProduct === p.id && (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                  </motion.div>
                                )}
                              </div>
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded-xl object-cover border border-border/10 shadow-sm" />
                              ) : (
                                <div className="h-10 w-10 rounded-xl bg-muted/8 flex items-center justify-center border border-border/10">
                                  <Package className="h-4 w-4 text-muted-foreground/20" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-foreground truncate">{p.name}</p>
                                <p className="text-[10px] font-black text-primary">R$ {Number(p.price).toFixed(2)}</p>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                        <AnimatePresence>
                          {selectedBumpProduct && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-border/10 overflow-hidden"
                            >
                              <div className="p-3">
                                <Button onClick={addBump} className="w-full gap-2 rounded-xl h-10 font-display font-black text-xs">
                                  <Plus className="h-3.5 w-3.5" /> Adicionar como Bump
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  ) : orderBumps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/15 p-8 text-center space-y-2">
                      <Package className="h-8 w-8 text-muted-foreground/15 mx-auto" />
                      <p className="text-[12px] font-display font-bold text-muted-foreground/40">Nenhum produto disponível</p>
                      <p className="text-[10px] text-muted-foreground/25">Crie mais produtos ativos para usar como bumps</p>
                    </div>
                  ) : null}

                  <ConversionTip text="Order bumps podem aumentar o ticket médio em até 40%. Ofereça produtos complementares de baixo custo." icon={TrendingUp} />
                </>
              )}

              {/* ── CRO TAB ── */}
              {activeTab === "cro" && (
                <>
                  <SectionHeader icon={Zap} title="Otimização de Conversão" desc="Ferramentas avançadas para maximizar vendas" badge="Pro" />
                  
                  <ToggleRow icon={Video} title="Vídeo de vendas (VSL)" desc="Player de vídeo no topo do checkout" checked={vslEnabled} onChange={setVslEnabled} />
                  <AnimatePresence>
                    {vslEnabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <Input value={vslUrl} onChange={(e) => setVslUrl(e.target.value)} placeholder="https://youtube.com/embed/..." className="h-10 rounded-xl bg-card/30 border-border/10 text-xs" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <ToggleRow icon={BarChart3} iconColor="blue-500" title="Barra de progresso" desc="Mostra etapa atual da compra" checked={progressBarEnabled} onChange={setProgressBarEnabled} />
                  <ToggleRow icon={Users} iconColor="orange-500" title="Compradores em tempo real" desc="Exibe quantidade fictícia de compradores" checked={fakeViewersEnabled} onChange={setFakeViewersEnabled} />
                  <ToggleRow icon={Star} iconColor="amber-500" title="Depoimentos" desc="Testemunhos de compradores anteriores" checked={testimonialEnabled} onChange={setTestimonialEnabled} />
                  
                  <ToggleRow icon={Clock} iconColor="red-500" title="Escassez de vagas" desc="Mostra quantidade limitada de vagas" checked={scarcityEnabled} onChange={setScarcityEnabled}
                    extra={scarcityEnabled ? (
                      <Input type="number" min="1" max="999" value={scarcityUnits} onChange={(e) => setScarcityUnits(e.target.value)} className="w-14 h-7 text-center text-[11px] rounded-lg bg-card/40 border-border/10 font-bold" />
                    ) : undefined}
                  />

                  <ToggleRow icon={Percent} iconColor="emerald-500" title="Badge de desconto" desc="Mostra preço original riscado" checked={discountBadgeEnabled} onChange={setDiscountBadgeEnabled} />
                  <AnimatePresence>
                    {discountBadgeEnabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground/40 font-bold shrink-0">De R$</span>
                          <Input type="number" value={discountOriginalPrice} onChange={(e) => setDiscountOriginalPrice(e.target.value)} placeholder="297.00" className="h-9 rounded-xl bg-card/30 border-border/10 text-xs font-bold" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <ToggleRow icon={ExitIcon} title="Exit intent" desc="Popup quando visitante tenta sair" checked={exitIntentEnabled} onChange={setExitIntentEnabled} badge="Pro" />
                  <ToggleRow icon={MessageSquare} iconColor="emerald-500" title="Botão WhatsApp" desc="Botão flutuante de suporte" checked={whatsappEnabled} onChange={setWhatsappEnabled} />
                  <AnimatePresence>
                    {whatsappEnabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="5511999999999" className="h-9 rounded-xl bg-card/30 border-border/10 text-xs" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <ToggleRow icon={Lock} iconColor="blue-500" title="Selos de confiança" desc="SSL, compra segura, dados criptografados" checked={trustBadgesEnabled} onChange={setTrustBadgesEnabled} badge="Novo" />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom bar — Quick actions */}
        <div className="p-3 border-t border-border/10 bg-card/5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            {checkoutUrl && (
              <>
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(checkoutUrl); toast.success("Link copiado!"); }} className="flex-1 gap-1.5 rounded-xl h-9 text-[10px] font-bold border-border/15">
                  <Copy className="h-3 w-3" /> Copiar Link
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(checkoutUrl, "_blank")} className="gap-1.5 rounded-xl h-9 text-[10px] font-bold border-border/15">
                  <ExternalLink className="h-3 w-3" /> Abrir
                </Button>
              </>
            )}
            <Button size="sm" onClick={autoSave} disabled={saving} className="gap-1.5 rounded-xl h-9 text-[10px] font-display font-black">
              {saving ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity }} className="h-3 w-3 border border-primary-foreground/30 border-t-primary-foreground rounded-full" /> : <Check className="h-3 w-3" />}
              Salvar
            </Button>
          </div>
        </div>
      </aside>

      {/* ─── RIGHT: Live Preview ─── */}
      <main className="flex-1 flex flex-col min-h-[60vh] lg:min-h-screen">
        {/* Preview header — Enhanced */}
        <div className="h-14 border-b border-border/10 bg-card/5 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
              <Eye className="h-3.5 w-3.5 text-primary/70" />
            </div>
            <div>
              <span className="text-[9px] font-black text-muted-foreground/25 uppercase tracking-[0.25em]">Live Preview</span>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[8px] text-success font-bold">Atualização em tempo real</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/10 bg-card/60 px-3 py-1.5">
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-muted-foreground/25">Tema</p>
              <p className="mt-1 text-[10px] font-display font-black text-foreground">{themeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/8 border border-border/8">
            {[
              { mode: "desktop" as const, icon: Monitor, label: "Desktop" },
              { mode: "mobile" as const, icon: Smartphone, label: "Mobile" },
            ].map(m => (
              <button
                key={m.mode}
                onClick={() => setPreviewMode(m.mode)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-display font-bold transition-all duration-300",
                  previewMode === m.mode ? "text-foreground" : "text-muted-foreground/25 hover:text-muted-foreground/50"
                )}
              >
                {previewMode === m.mode && (
                  <motion.div
                    layoutId="preview-mode-bg"
                    className="absolute inset-0 bg-card shadow-sm border border-border/15 rounded-lg"
                    transition={{ type: "spring", bounce: 0.12, duration: 0.35 }}
                  />
                )}
                <m.icon className="h-3 w-3 relative z-10" />
                <span className="relative z-10">{m.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-2">
              <p className="text-[9px] text-muted-foreground/25 font-bold">Score</p>
              <p className="text-sm font-display font-black text-primary">{optimizationScore.score}/{optimizationScore.max}</p>
            </div>
          </div>
        </div>

        {/* Preview area — Immersive with device frame */}
        <div
          className="flex-1 flex items-start justify-center p-8 overflow-auto"
          style={{
            background: "radial-gradient(ellipse at center top, hsl(var(--primary)/0.03), transparent 60%)",
            backgroundImage: "radial-gradient(circle, hsl(var(--border)/0.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <motion.div
            layout
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "relative transition-all duration-500",
              previewMode === "desktop" ? "w-full max-w-2xl" : "w-[375px]"
            )}
          >
            {/* Device frame chrome — Enhanced macOS-style */}
            <div className="rounded-t-2xl border-t border-x border-border/20 bg-gradient-to-b from-muted/12 to-muted/6 backdrop-blur-xl px-4 py-2.5 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[hsl(0_70%_55%)] shadow-[inset_0_-1px_1px_hsl(0_60%_40%)]" />
                <div className="h-3 w-3 rounded-full bg-[hsl(45_80%_55%)] shadow-[inset_0_-1px_1px_hsl(45_70%_40%)]" />
                <div className="h-3 w-3 rounded-full bg-[hsl(130_55%_48%)] shadow-[inset_0_-1px_1px_hsl(130_45%_35%)]" />
              </div>
              <div className="flex-1 mx-2">
                <div className="flex items-center gap-2 bg-card/60 rounded-lg px-3 py-1.5 border border-border/15 shadow-inner">
                  <Lock className="h-2.5 w-2.5 text-success/50" />
                  <span className="text-[9px] text-muted-foreground/40 font-mono truncate">{checkoutUrl || "podpay.com/pay/seu-produto"}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[7px] font-black text-success/50 uppercase tracking-widest">Live</span>
              </div>
            </div>

            {/* Actual preview content */}
            <div data-preview-theme={checkoutTheme} className={cn(
              "rounded-b-2xl border border-border/15 shadow-2xl shadow-black/8 overflow-hidden",
              checkoutTheme === "white" ? "bg-[#fafbfc]" : checkoutTheme === "dark" ? "bg-[hsl(220_18%_11%)]" : "bg-[#f0f1f3]"
            )}>
              {/* Preview: Banner */}
              {(previewMode === "desktop" ? bannerDesktopPreview : bannerMobilePreview) && (
                <img src={previewMode === "desktop" ? bannerDesktopPreview : bannerMobilePreview} alt="Banner" className="w-full h-36 object-cover" />
              )}

              {/* Preview: VSL */}
              {vslEnabled && vslUrl && (
                <div className="p-5 pb-0">
                  <div className="aspect-video rounded-2xl bg-black/90 border border-border/10 flex items-center justify-center text-muted-foreground/15 overflow-hidden">
                    <div className="flex flex-col items-center gap-3">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="h-14 w-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur"
                      >
                        <Video className="h-6 w-6" />
                      </motion.div>
                      <span className="text-[10px] font-medium">Vídeo de vendas</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview: Progress bar */}
              {progressBarEnabled && (
                <div className="px-5 pt-5">
                  <div className="flex items-center gap-2.5 text-[11px] font-semibold text-gray-700 mb-2">
                    <span className="h-6 w-6 rounded-full text-white flex items-center justify-center text-[10px] font-black" style={{ backgroundColor: buttonColor }}>1</span>
                    Você está a 1 passo de garantir sua vaga
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: "66%" }} transition={{ duration: 1.5, ease: "easeOut" }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${buttonColor}, ${buttonColor}99)` }} />
                  </div>
                </div>
              )}

              {/* Preview: Fake viewers */}
              {fakeViewersEnabled && (
                <div className="px-5 pt-4">
                  <div className="inline-flex items-center gap-2 text-[11px] font-bold rounded-xl bg-orange-500/10 text-orange-600 px-3.5 py-2 border border-orange-500/15">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" /></span>
                    14 pessoas estão comprando agora
                  </div>
                </div>
              )}

              {/* Preview: Scarcity */}
              {scarcityEnabled && (
                <div className="px-5 pt-4">
                  <div className="flex items-center gap-2.5 text-[11px] font-bold text-red-600 bg-red-500/10 rounded-xl py-2.5 px-4 border border-red-500/15">
                    <Clock className="h-3.5 w-3.5" />
                    Apenas {scarcityUnits} vagas restantes
                  </div>
                </div>
              )}

              {/* Preview: Timer */}
              {timerEnabled && (
                <div className="px-5 pt-4">
                  <div className="flex items-center justify-center gap-2.5 text-[12px] font-bold text-amber-600 bg-amber-500/10 rounded-xl py-3 border border-amber-500/10">
                    <Timer className="h-4 w-4" /> Oferta expira em {timerMinutes}:00
                  </div>
                </div>
              )}

              {/* Preview: Discount badge */}
              {discountBadgeEnabled && discountOriginalPrice && (
                <div className="px-5 pt-4">
                  <div className="inline-flex items-center gap-2 text-[11px] font-bold bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-xl border border-emerald-500/15">
                    <Percent className="h-3.5 w-3.5" />
                    De <span className="line-through text-gray-400">R$ {Number(discountOriginalPrice).toFixed(2)}</span> por <span className="font-black">R$ {Number(product?.price || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="p-5 space-y-5">
                {/* Product info */}
                <div className="flex items-center gap-4">
                  {product?.image_url ? (
                    <img src={product.image_url} className="h-16 w-16 rounded-2xl object-cover border border-gray-200 shadow-lg" />
                  ) : (
                    <div className="h-16 w-16 rounded-2xl flex items-center justify-center border border-gray-200" style={{ backgroundColor: buttonColor + "15" }}><Package className="h-6 w-6" style={{ color: buttonColor }} /></div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-gray-900">{product?.name}</p>
                    <p className="text-2xl font-black tracking-tight" style={{ color: buttonColor }}>R$ {Number(product?.price || 0).toFixed(2)}</p>
                  </div>
                </div>

                {/* Testimonials */}
                {testimonialEnabled && (
                  <div className="space-y-2.5">
                    {[
                      { name: "Maria S.", text: "Melhor investimento que fiz!", rating: 5 },
                      { name: "João P.", text: "Conteúdo incrível, recomendo!", rating: 5 },
                    ].map((t, i) => (
                      <div key={i} className="p-3.5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-400/5 flex items-center justify-center text-[9px] font-black text-amber-500">{t.name[0]}</div>
                          <div className="flex gap-0.5">
                            {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />)}
                          </div>
                          <span className="text-[10px] font-bold text-gray-500">{t.name}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 italic pl-8">"{t.text}"</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Social proof */}
                {socialProof && (
                  <div className="flex items-center gap-2.5 text-[11px] text-gray-600">
                    <div className="flex -space-x-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-7 w-7 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: buttonColor + (20 + i * 10).toString(16) }} />
                      ))}
                    </div>
                    <span className="font-semibold">+127 compraram nas últimas 24h</span>
                  </div>
                )}

                {/* Form preview */}
                <div className="space-y-3">
                  <PreviewField label="Nome completo" theme={checkoutTheme} />
                  <PreviewField label="E-mail" theme={checkoutTheme} />
                  {emailConfirm && <PreviewField label="Confirme seu e-mail" theme={checkoutTheme} />}
                  {phoneRequired && <PreviewField label="WhatsApp" theme={checkoutTheme} />}
                  {cpfRequired && <PreviewField label="CPF / CNPJ" theme={checkoutTheme} />}
                  {nameOnCardRequired && creditCardEnabled && <PreviewField label="Nome impresso no cartão" theme={checkoutTheme} />}
                  {addressRequired && (
                    <div className="grid grid-cols-3 gap-2.5">
                      <PreviewField label="CEP" theme={checkoutTheme} />
                      <div className="col-span-2"><PreviewField label="Endereço" theme={checkoutTheme} /></div>
                    </div>
                  )}
                </div>

                {/* Payment methods preview */}
                <div className="flex gap-2 flex-wrap">
                  {pixEnabled && <span className="text-[10px] font-bold px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 inline-flex items-center gap-1.5"><QrCode className="h-3 w-3" /> PIX</span>}
                  {boletoEnabled && <span className="text-[10px] font-bold px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/15 inline-flex items-center gap-1.5"><FileText className="h-3 w-3" /> Boleto</span>}
                  {creditCardEnabled && <span className="text-[10px] font-bold px-3 py-2 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/15 inline-flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Cartão</span>}
                </div>

                {/* Order bumps preview */}
                {orderBumps.length > 0 && (
                  <div className="space-y-2.5">
                    {orderBumps.map(bump => {
                      const prod = allProducts.find(p => p.id === bump.bump_product_id);
                      return (
                        <div key={bump.id} className="p-4 rounded-2xl border-2 border-dashed hover:bg-white/50 transition-colors" style={{ borderColor: buttonColor + "30" }}>
                          <div className="flex items-center gap-3">
                            <div className="h-5 w-5 rounded-lg border-2 flex items-center justify-center" style={{ borderColor: buttonColor + "40" }}>
                              <Plus className="h-2.5 w-2.5" style={{ color: buttonColor + "60" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold text-gray-800 truncate block">{prod?.name || "Bump"}</span>
                              <span className="text-[10px] text-gray-400">Adicione ao seu pedido</span>
                            </div>
                            <span className="text-sm font-black" style={{ color: buttonColor }}>+ R$ {Number(prod?.price || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* CTA button */}
                <motion.button
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-4 rounded-2xl text-white font-display font-black text-sm transition-all flex items-center justify-center gap-2.5"
                  style={{ backgroundColor: buttonColor, boxShadow: `0 16px 40px -10px ${buttonColor}50` }}
                >
                  <Lock className="h-4 w-4" />
                  COMPRAR AGORA
                </motion.button>

                {/* Trust badges */}
                {trustBadgesEnabled && (
                  <div className="flex items-center justify-center gap-6 py-2">
                    {[
                      { icon: Lock, label: "SSL Seguro" },
                      { icon: ShieldCheck, label: "Compra Protegida" },
                      { icon: CreditCard, label: "Dados Criptografados" },
                    ].map((b, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                          <b.icon className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{b.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Guarantee seal */}
                {guaranteeEnabled && (
                  <div className="flex items-center justify-center gap-2 py-2 text-[11px] font-semibold" style={{ color: buttonColor }}>
                    <ShieldCheck className="h-4 w-4" /> Garantia de 7 dias ou seu dinheiro de volta
                  </div>
                )}

                {/* WhatsApp button */}
                {whatsappEnabled && (
                  <div className="flex items-center justify-center">
                    <div className="inline-flex items-center gap-2.5 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-5 py-2.5 rounded-xl border border-emerald-500/15 cursor-pointer hover:bg-emerald-500/15 transition-all duration-200">
                      <MessageSquare className="h-4 w-4" />
                      Dúvidas? Fale no WhatsApp
                    </div>
                  </div>
                )}
              </div>

              {/* Exit intent preview */}
              {exitIntentEnabled && (
                <div className="border-t border-gray-200 p-3.5 bg-gray-50 text-center">
                  <p className="text-[10px] text-gray-400 font-medium flex items-center justify-center gap-1.5">
                    <ExitIcon className="h-3 w-3" /> Exit Intent ativo — popup ao sair da página
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
      <style>{`
        [data-preview-theme="dark"] .bg-white,
        [data-preview-theme="dark"] .bg-gray-50 {
          background-color: hsl(220 16% 14%) !important;
        }
        [data-preview-theme="dark"] .bg-gray-100 {
          background-color: hsl(220 15% 18%) !important;
        }
        [data-preview-theme="dark"] .border-gray-100,
        [data-preview-theme="dark"] .border-gray-200 {
          border-color: hsl(220 12% 24%) !important;
        }
        [data-preview-theme="dark"] .text-gray-900,
        [data-preview-theme="dark"] .text-gray-800,
        [data-preview-theme="dark"] .text-gray-700,
        [data-preview-theme="dark"] .text-gray-600 {
          color: hsl(210 20% 96%) !important;
        }
        [data-preview-theme="dark"] .text-gray-500,
        [data-preview-theme="dark"] .text-gray-400,
        [data-preview-theme="dark"] .text-gray-300 {
          color: hsl(215 10% 66%) !important;
        }
      `}</style>
    </div>
  );
}

/* ── Preview Field ── */
function PreviewField({ label, theme }: { label: string; theme?: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">{label}</p>
      <div className={cn("h-10 rounded-xl border", theme === "white" ? "bg-white border-gray-200" : theme === "dark" ? "bg-[hsl(220_15%_16%)] border-[hsl(220_12%_24%)]" : "bg-white/60 border-gray-200")} />
    </div>
  );
}
