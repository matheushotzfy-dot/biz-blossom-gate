/**
 * Construtor de checkout: personaliza a página onde o comprador paga e mostra uma prévia ao vivo.
 * Só a apresentação foi refeita; o que é gravado em `products` e `order_bumps` segue as mesmas colunas.
 * Tela cheia, fora do DashboardLayout: usa useSellerSkin() e a raiz `vp-seller-shell vp-stage`.
 */

import { PREVIEW_UPDATE, type PreviewUpdate } from "@/features/public-checkout/previewProtocol";
import { CheckoutLivePreview } from "@/components/products/CheckoutLivePreview";
import { defaultCheckoutProcessor } from "@/features/public-checkout/processor";
import { MAX_ORDER_BUMPS, orderBumpError, withVersion } from "@/components/products/orderBumps";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSellerSkin } from "@/hooks/useSellerSkin";
import {
  Palette, CreditCard, ClipboardList, Layers, Zap, ArrowLeft, Timer, ShieldCheck, QrCode, FileText, MapPin,
  Mail, Hash, Monitor, Smartphone, Check, Copy, ExternalLink, ImagePlus, Upload, X, Plus, Package, Lock,
  Loader2, Eye, SlidersHorizontal, Clock, AlertCircle, Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { MotionConfig, motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/components/products/productPresentation";
import { FieldHint, FieldLabel, GroupBox, ToggleRow } from "@/components/seller-ui/form";
import { Notice, StepEmpty } from "@/components/seller-ui/studio";

/* ─── Constantes ─── */
const TABS = [
  { id: "visual", label: "Visual", icon: Palette },
  { id: "payment", label: "Pagamento", icon: CreditCard },
  { id: "form", label: "Formulário", icon: ClipboardList },
  { id: "bumps", label: "Order bumps", icon: Layers },
  { id: "cro", label: "Conversão", icon: Zap },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Theme = "gray" | "white" | "dark";
type ProductWithCheckoutTheme = Tables<"products"> & { checkout_theme?: unknown };
const normalizeCheckoutTheme = (value: unknown): Theme => (value === "white" ? "white" : value === "dark" ? "dark" : "gray");
const getCheckoutTheme = (value: Tables<"products"> | null) => normalizeCheckoutTheme((value as ProductWithCheckoutTheme | null)?.checkout_theme);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_BUMPS = MAX_ORDER_BUMPS;
const MAX_BANNER = 5 * 1024 * 1024;
const ALLOWED_BANNER = ["image/jpeg", "image/png", "image/webp"];
const SAVE_DELAY = 1200;

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

const THEME_OPTIONS: { key: Theme; name: string; hint: string }[] = [
  { key: "gray", name: "Cinza suave", hint: "Fundo cinza claro" },
  { key: "white", name: "Branco", hint: "Fundo branco" },
  { key: "dark", name: "Escuro", hint: "Fundo escuro" },
];

/** Cores das miniaturas de tema: as mesmas de `checkout.css` (fundo, cartão, linha, texto), fixas nos dois temas do painel. */
const PREVIEW_THEMES: Record<Theme, { bg: string; card: string; border: string; text: string }> = {
  gray: { bg: "#eceff3", card: "#ffffff", border: "#d6dce4", text: "#141a24" },
  white: { bg: "#ffffff", card: "#ffffff", border: "#dfe4ea", text: "#141a24" },
  dark: { bg: "#10141c", card: "#1a1f2b", border: "#343e52", text: "#eef1f6" },
};

/* ─── Configurações editáveis e o que vai para o banco ─── */
type Settings = {
  buttonColor: string; theme: Theme; timerEnabled: boolean; timerMinutes: string; socialProof: boolean; guaranteeEnabled: boolean;
  pix: boolean; boleto: boolean; card: boolean; address: boolean; emailConfirm: boolean;
  bannerD: string; bannerM: string; fileD: File | null; fileM: File | null;
};
type Allowed = { pix: boolean; boleto: boolean; card: boolean };

const fromProduct = (p: Tables<"products">): Settings => ({
  buttonColor: p.checkout_button_color || "#10b981",
  theme: getCheckoutTheme(p),
  timerEnabled: p.checkout_timer_enabled ?? true,
  timerMinutes: String(p.checkout_timer_minutes ?? 15),
  socialProof: p.checkout_social_proof ?? false,
  guaranteeEnabled: p.checkout_guarantee_enabled ?? true,
  pix: p.checkout_pix_enabled ?? true,
  boleto: p.checkout_boleto_enabled ?? false,
  card: p.checkout_credit_card_enabled ?? true,
  address: p.checkout_address_required ?? false,
  emailConfirm: p.checkout_email_confirm ?? true,
  bannerD: p.checkout_banner_desktop_url || "",
  bannerM: p.checkout_banner_mobile_url || "",
  fileD: null,
  fileM: null,
});

/** Métodos que a conta não pode usar ficam desligados, como o checkout público também respeita. */
const effective = (s: Settings, allowed: Allowed | null): Settings =>
  allowed ? { ...s, pix: s.pix && allowed.pix, boleto: s.boleto && allowed.boleto, card: s.card && allowed.card } : s;

const fileKey = (f: File | null) => (f ? `${f.name}:${f.size}:${f.lastModified}` : "");
const makeSnapshot = (s: Settings) =>
  JSON.stringify([s.buttonColor.trim().toLowerCase(), s.theme, s.timerEnabled, s.timerMinutes, s.socialProof, s.guaranteeEnabled, s.pix, s.boleto, s.card, s.address, s.emailConfirm, s.bannerD, s.bannerM, fileKey(s.fileD), fileKey(s.fileM)]);

const timerValid = (s: Settings) => !s.timerEnabled || (/^\d+$/.test(s.timerMinutes.trim()) && Number(s.timerMinutes) >= 1 && Number(s.timerMinutes) <= 60);

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type Bump = { id: string; bump_product_id: string };

const inputClass = "vp-field";

/* ─── Blocos de interface ─── */
function Block({ title, subtitle, children, className }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("vp-sheet p-5", className)}>
      {title && (
        <div className="mb-4">
          <h3 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function PanelHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-1">
      <h2 className="font-heading text-[24px] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground">{title}</h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ThemeChoice({ option, selected, onSelect }: { option: (typeof THEME_OPTIONS)[number]; selected: boolean; onSelect: () => void }) {
  const T = PREVIEW_THEMES[option.key];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "vp-r16 relative border p-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected ? "border-primary/60 bg-accent" : "border-border bg-card hover:border-primary/40",
      )}
    >
      {selected && <span aria-hidden className="absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"><Check className="h-3 w-3" strokeWidth={3} /></span>}
      <span className="block rounded-[10px] p-2" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
        <span className="block h-1.5 w-2/3 rounded-full" style={{ background: T.text, opacity: 0.75 }} />
        <span className="mt-1.5 block h-5 rounded-md" style={{ background: T.card, border: `1px solid ${T.border}` }} />
        <span className="mt-1.5 block h-2 rounded-full bg-primary" />
      </span>
      <span className={cn("mt-2.5 block truncate text-[13px] font-bold leading-tight", selected ? "text-accent-foreground" : "text-foreground")}>{option.name}<span className="sr-only">. {option.hint}</span></span>
    </button>
  );
}

function BannerSlot({ label, size, hint, preview, inputRef, onFile, onClear }: {
  label: string; size: string; hint?: string; preview: string; inputRef: React.RefObject<HTMLInputElement>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void;
}) {
  return (
    <div>
      <FieldLabel hint={size}>{label}</FieldLabel>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="hidden" aria-label={`Escolher banner ${label.toLowerCase()}`} />
      {preview ? (
        <div className="relative overflow-hidden rounded-[16px] border border-border">
          <img src={preview} alt={`Banner ${label.toLowerCase()}`} className="h-24 w-full object-cover" />
          <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5">
            <button type="button" onClick={() => inputRef.current?.click()} aria-label={`Trocar banner ${label.toLowerCase()}`} className="vp-orb !h-9 !w-9 shadow-sm"><ImagePlus className="h-4 w-4" /></button>
            <button type="button" onClick={onClear} aria-label={`Remover banner ${label.toLowerCase()}`} className="vp-orb !h-9 !w-9 text-destructive shadow-sm"><X className="h-4 w-4" /></button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="vp-r16 flex h-24 w-full flex-col items-center justify-center gap-1 border-2 border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <Upload className="h-5 w-5" />
          <span className="text-[13.5px] font-semibold">Enviar imagem</span>
        </button>
      )}
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

/* ═══════════════════════════════════════════════ */
export default function CheckoutBuilder() {
  useSellerSkin();
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const initialProduct = (location.state as { product?: Tables<"products"> } | null)?.product ?? null;

  const [product, setProduct] = useState<Tables<"products"> | null>(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [activeTab, setActiveTab] = useState<TabId>("visual");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(() => (typeof window !== "undefined" && window.innerWidth < 1024 ? "mobile" : "desktop"));
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [loaded, setLoaded] = useState(false);

  const initial = useMemo(() => (initialProduct ? fromProduct(initialProduct) : null), [initialProduct]);
  const [buttonColor, setButtonColor] = useState(initial?.buttonColor ?? "#10b981");
  const [theme, setTheme] = useState<Theme>(initial?.theme ?? "gray");
  const [timerEnabled, setTimerEnabled] = useState(initial?.timerEnabled ?? true);
  const [timerMinutes, setTimerMinutes] = useState(initial?.timerMinutes ?? "15");
  const [socialProof, setSocialProof] = useState(initial?.socialProof ?? false);
  const [guaranteeEnabled, setGuaranteeEnabled] = useState(initial?.guaranteeEnabled ?? true);
  const [pixEnabled, setPixEnabled] = useState(initial?.pix ?? true);
  const [boletoEnabled, setBoletoEnabled] = useState(initial?.boleto ?? false);
  const [creditCardEnabled, setCreditCardEnabled] = useState(initial?.card ?? true);
  const [addressRequired, setAddressRequired] = useState(initial?.address ?? false);
  const [emailConfirm, setEmailConfirm] = useState(initial?.emailConfirm ?? true);
  const [bannerDesktopPreview, setBannerDesktopPreview] = useState(initial?.bannerD ?? "");
  const [bannerMobilePreview, setBannerMobilePreview] = useState(initial?.bannerM ?? "");
  const [bannerDesktopFile, setBannerDesktopFile] = useState<File | null>(null);
  const [bannerMobileFile, setBannerMobileFile] = useState<File | null>(null);
  const desktopRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  const [allowed, setAllowed] = useState<Allowed | null>(null);
  const [allProducts, setAllProducts] = useState<Tables<"products">[]>([]);
  const [orderBumps, setOrderBumps] = useState<Bump[]>([]);
  const [selectedBumpProduct, setSelectedBumpProduct] = useState("");
  const [addingBump, setAddingBump] = useState(false);

  // Valores atuais (com os métodos que a conta pode usar) e a "foto" do que já está no banco.
  const raw: Settings = { buttonColor, theme, timerEnabled, timerMinutes, socialProof, guaranteeEnabled, pix: pixEnabled, boleto: boletoEnabled, card: creditCardEnabled, address: addressRequired, emailConfirm, bannerD: bannerDesktopPreview, bannerM: bannerMobilePreview, fileD: bannerDesktopFile, fileM: bannerMobileFile };
  const current = effective(raw, allowed);
  const snapshot = makeSnapshot(current);
  const latest = useRef({ current, allowed });
  latest.current = { current, allowed };
  const savedSnapshot = useRef<string | null>(null);
  const savingRef = useRef(false);

  const colorValid = HEX_COLOR.test(buttonColor.trim());
  const minutesValid = timerValid(raw);
  const formValid = colorValid && minutesValid;
  const ready = loaded && allowed !== null;

  const applyProduct = useCallback((data: Tables<"products">) => {
    const s = fromProduct(data);
    setProduct(data);
    setButtonColor(s.buttonColor); setTheme(s.theme); setTimerEnabled(s.timerEnabled); setTimerMinutes(s.timerMinutes);
    setSocialProof(s.socialProof); setGuaranteeEnabled(s.guaranteeEnabled); setPixEnabled(s.pix); setBoletoEnabled(s.boleto);
    setCreditCardEnabled(s.card); setAddressRequired(s.address); setEmailConfirm(s.emailConfirm);
    setBannerDesktopPreview(s.bannerD); setBannerMobilePreview(s.bannerM);
    savedSnapshot.current = makeSnapshot(s);
    setLoaded(true);
    setLoading(false);
  }, []);

  /* Carrega produto, outros produtos ativos, order bumps e os métodos liberados para a conta */
  useEffect(() => {
    if (!user?.id || !productId) return;
    if (!initialProduct) setLoading(true);
    supabase.from("products").select("*").eq("id", productId).eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { toast.error("Produto não encontrado"); navigate("/vendas/produtos"); return; }
        applyProduct(data);
      });
    supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").is("deleted_at", null).neq("id", productId)
      .then(({ data }) => { if (data) setAllProducts(data); });
    supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", productId)
      .then(({ data }) => { if (data) setOrderBumps(data); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, productId]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("pix_enabled, boleto_enabled, credit_card_enabled").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setAllowed(data ? { pix: !!data.pix_enabled, boleto: !!data.boleto_enabled, card: !!data.credit_card_enabled } : { pix: true, boleto: true, card: true });
      });
  }, [user?.id]);

  /* Salvar: valida, envia os banners e grava. Devolve true se salvou. */
  const save = useCallback(async (manual = false): Promise<boolean> => {
    if (!user?.id || !productId || savingRef.current) return false;
    const { current: s } = latest.current;
    if (!HEX_COLOR.test(s.buttonColor.trim())) { if (manual) toast.error("Use uma cor no formato #10b981"); return false; }
    if (!timerValid(s)) { if (manual) toast.error("O timer vai de 1 a 60 minutos"); return false; }

    savingRef.current = true;
    setSaveState("saving");
    try {
      let desktopUrl = s.bannerD;
      let mobileUrl = s.bannerM;
      const banners = [
        { file: s.fileD, kind: "desktop" as const, label: "desktop" },
        { file: s.fileM, kind: "mobile" as const, label: "mobile" },
      ];
      for (const b of banners) {
        if (!b.file) continue;
        if (!ALLOWED_BANNER.includes(b.file.type)) throw new Error(`Banner ${b.label}: use JPG, PNG ou WebP`);
        if (b.file.size > MAX_BANNER) throw new Error(`Banner ${b.label}: máximo 5 MB`);
        const ext = (b.file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${user.id}/${productId}-${b.kind}.${ext}`;
        const { error: upErr } = await supabase.storage.from("checkout-banners").upload(path, b.file, { upsert: true });
        if (upErr) throw new Error(`Não foi possível enviar o banner ${b.label}. Tente de novo.`);
        const { data: pub } = supabase.storage.from("checkout-banners").getPublicUrl(path);
        const url = withVersion(pub.publicUrl);
        if (b.kind === "desktop") desktopUrl = url; else mobileUrl = url;
      }
      // Nunca grava um endereço temporário do navegador.
      if (desktopUrl.startsWith("blob:") || mobileUrl.startsWith("blob:")) throw new Error("Não foi possível enviar o banner. Tente de novo.");

      const { error } = await supabase.from("products").update({
        checkout_button_color: s.buttonColor.trim(),
        checkout_theme: s.theme,
        checkout_timer_enabled: s.timerEnabled,
        checkout_timer_minutes: timerValid(s) && /^\d+$/.test(s.timerMinutes.trim()) ? Number(s.timerMinutes) : 15,
        checkout_banner_desktop_url: desktopUrl || null,
        checkout_banner_mobile_url: mobileUrl || null,
        checkout_social_proof: s.socialProof,
        checkout_guarantee_enabled: s.guaranteeEnabled,
        checkout_pix_enabled: s.pix,
        checkout_boleto_enabled: s.boleto,
        checkout_credit_card_enabled: s.card,
        checkout_address_required: s.address,
        checkout_email_confirm: s.emailConfirm,
      }).eq("id", productId).eq("user_id", user.id);
      if (error) throw new Error("Não foi possível salvar. Tente de novo.");

      savedSnapshot.current = makeSnapshot({ ...s, bannerD: desktopUrl, bannerM: mobileUrl, fileD: null, fileM: null });
      if (s.fileD) { setBannerDesktopPreview(desktopUrl); setBannerDesktopFile(null); }
      if (s.fileM) { setBannerMobilePreview(mobileUrl); setBannerMobileFile(null); }
      setLastSavedAt(new Date());
      setSaveState("saved");
      if (manual) toast.success("Checkout salvo");
      return true;
    } catch (e) {
      setSaveState("error");
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar. Tente de novo.");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [user?.id, productId]);

  /* Salva sozinho 1,2 s depois da última mudança válida */
  useEffect(() => {
    if (!ready || savedSnapshot.current === null) return;
    if (snapshot === savedSnapshot.current) {
      setSaveState((prev) => (prev === "dirty" || prev === "error" ? (lastSavedAt ? "saved" : "idle") : prev));
      return;
    }
    setSaveState((prev) => (prev === "saving" ? prev : "dirty"));
    if (!formValid) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { if (savingRef.current) { timer = setTimeout(tick, 400); return; } void save(); };
    timer = setTimeout(tick, SAVE_DELAY);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, ready, formValid, save]);

  const isDirty = ready && savedSnapshot.current !== null && snapshot !== savedSnapshot.current;
  const dirtyRef = useRef(false);
  dirtyRef.current = isDirty;
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const handleBack = async () => {
    if (isDirty) {
      if (!formValid) { toast.error(!colorValid ? "Corrija a cor do botão antes de sair" : "Corrija o tempo do timer antes de sair"); return; }
      const ok = await save();
      if (!ok) return;
    }
    navigate("/vendas/produtos");
  };

  /* Banners */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: "desktop" | "mobile") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_BANNER.includes(file.type)) { toast.error("Use JPG, PNG ou WebP"); return; }
    if (file.size > MAX_BANNER) { toast.error("Banner: máximo 5 MB"); return; }
    const url = URL.createObjectURL(file);
    if (type === "desktop") { setBannerDesktopFile(file); setBannerDesktopPreview((prev) => { if (prev.startsWith("blob:")) URL.revokeObjectURL(prev); return url; }); }
    else { setBannerMobileFile(file); setBannerMobilePreview((prev) => { if (prev.startsWith("blob:")) URL.revokeObjectURL(prev); return url; }); }
  };
  const clearBanner = (type: "desktop" | "mobile") => {
    if (type === "desktop") { setBannerDesktopFile(null); setBannerDesktopPreview((prev) => { if (prev.startsWith("blob:")) URL.revokeObjectURL(prev); return ""; }); }
    else { setBannerMobileFile(null); setBannerMobilePreview((prev) => { if (prev.startsWith("blob:")) URL.revokeObjectURL(prev); return ""; }); }
  };

  /* Order bumps */
  const availableForBump = allProducts.filter((p) => !orderBumps.some((b) => b.bump_product_id === p.id));
  const addBump = async () => {
    if (!selectedBumpProduct || !productId || addingBump) return;
    if (orderBumps.length >= MAX_BUMPS) { toast.error(`Máximo de ${MAX_BUMPS} order bumps`); return; }
    if (orderBumps.some((b) => b.bump_product_id === selectedBumpProduct)) { toast.error("Produto já adicionado"); return; }
    setAddingBump(true);
    const { data, error } = await supabase.from("order_bumps").insert({ product_id: productId, bump_product_id: selectedBumpProduct, sort_order: orderBumps.length }).select("id, bump_product_id").maybeSingle();
    setAddingBump(false);
    if (error || !data) { toast.error(orderBumpError(error)); return; }
    setOrderBumps((prev) => [...prev, data]);
    setSelectedBumpProduct("");
    toast.success("Order bump adicionado");
  };
  const removeBump = async (id: string) => {
    if (!productId) return;
    const { error } = await supabase.from("order_bumps").delete().eq("id", id).eq("product_id", productId);
    if (error) { toast.error("Não foi possível remover o order bump"); return; }
    setOrderBumps((prev) => prev.filter((b) => b.id !== id));
    toast.success("Order bump removido");
  };

  /* Link do checkout */
  const checkoutUrl = product?.checkout_url ? `${window.location.origin}/pay/${product.checkout_url.split("/").pop()}` : "";
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(checkoutUrl); toast.success("Link copiado"); }
    catch { toast.error("Não foi possível copiar. Copie o link da barra do navegador."); }
  };

  /* O que a prévia mostra: o produto no formato de `products_public` com as escolhas desta tela (ainda não salvas também). */
  const previewPayload = useMemo<PreviewUpdate>(() => ({
    type: PREVIEW_UPDATE,
    product: {
      id: product?.id ?? productId ?? "preview",
      name: product?.name ?? null,
      description: product?.description ?? null,
      price: Number(product?.price || 0),
      image_url: product?.image_url ?? null,
      display_name: product?.display_name ?? null,
      checkout_button_color: buttonColor.trim(),
      checkout_theme: theme,
      checkout_timer_enabled: current.timerEnabled,
      checkout_timer_minutes: /^\d+$/.test(timerMinutes.trim()) ? Number(timerMinutes) : null,
      checkout_banner_desktop_url: bannerDesktopPreview || null,
      checkout_banner_mobile_url: bannerMobilePreview || null,
      checkout_guarantee_enabled: current.guaranteeEnabled,
      checkout_address_required: current.address,
      checkout_email_confirm: current.emailConfirm,
      checkout_pix_enabled: current.pix,
      checkout_credit_card_enabled: current.card,
      checkout_boleto_enabled: current.boleto,
    },
    bumps: orderBumps.flatMap((b) => {
      const prod = allProducts.find((p) => p.id === b.bump_product_id);
      return prod ? [{ bumpId: b.id, id: prod.id, name: prod.name, description: prod.description, price: Number(prod.price || 0), image_url: prod.image_url }] : [];
    }),
  }), [product, productId, buttonColor, theme, current.timerEnabled, timerMinutes, bannerDesktopPreview, bannerMobilePreview, current.guaranteeEnabled, current.address, current.emailConfirm, current.pix, current.card, current.boleto, orderBumps, allProducts]);

  /* Recomendações da aba Conversão (o que está ligado agora) */
  const checklist: { id: string; ok: boolean; title: string; why: string; tab: TabId }[] = [
    { id: "pix", ok: current.pix, title: "Pix ativo", why: "A confirmação costuma chegar em segundos.", tab: "payment" },
    { id: "card", ok: current.card, title: "Cartão ativo", why: "Permite parcelar em até 12x.", tab: "payment" },
    { id: "timer", ok: current.timerEnabled, title: "Timer de urgência", why: "Dá um prazo para o comprador decidir.", tab: "visual" },
    { id: "guarantee", ok: current.guaranteeEnabled, title: "Selo de garantia", why: "Reduz o receio de comprar.", tab: "visual" },
    { id: "bump", ok: orderBumps.length > 0, title: "Order bump", why: "Aumenta o valor do pedido com uma oferta complementar.", tab: "bumps" },
    { id: "banner", ok: !!(current.bannerD || current.bannerM), title: "Banner da oferta", why: "Reforça a identidade da sua página.", tab: "visual" },
  ];
  const checklistDone = checklist.filter((c) => c.ok).length;

  const themeName = THEME_OPTIONS.find((t) => t.key === theme)?.name ?? "Cinza suave";
  const timeText = lastSavedAt ? lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

  let statusNode: React.ReactNode;
  if (isDirty && !formValid) statusNode = <span className="inline-flex items-center gap-1.5 text-destructive"><AlertCircle className="h-3.5 w-3.5" /> Corrija o campo em vermelho para salvar</span>;
  else if (saveState === "saving") statusNode = <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> Salvando…</span>;
  else if (saveState === "error") statusNode = <span className="inline-flex items-center gap-1.5 text-destructive"><AlertCircle className="h-3.5 w-3.5" /> Não foi possível salvar. Clique em Salvar</span>;
  else if (isDirty) statusNode = <span>Salvando em instantes…</span>;
  else if (saveState === "saved" && timeText) statusNode = <span className="inline-flex items-center gap-1.5 vp-green-ink"><Check className="h-3.5 w-3.5" /> Salvo às {timeText}</span>;
  else statusNode = <span>Salvamento automático</span>;

  if (loading || !product) {
    return (
      <div className="vp-seller-shell vp-stage grid h-[100dvh] place-items-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary motion-reduce:animate-none" />
          <p className="text-[14.5px] font-semibold">Abrindo o construtor de checkout…</p>
        </div>
      </div>
    );
  }

  const switchLabel = (label: string) => ({ "aria-label": label });

  return (
    <MotionConfig reducedMotion="user">
      <div className="vp-seller-shell vp-stage flex h-[100dvh] flex-col overflow-hidden">
        {/* ─── Cabeçalho ─── */}
        <header className="z-30 border-b border-border bg-background">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button type="button" onClick={handleBack} aria-label="Voltar para Produtos" className="vp-orb shrink-0"><ArrowLeft className="h-[18px] w-[18px]" /></button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-heading text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">{product.name}</h1>
              <p className="truncate text-[13px] text-muted-foreground" aria-live="polite">{statusNode}</p>
            </div>
            {checkoutUrl && (
              <div className="hidden items-center gap-2 sm:flex">
                <button type="button" onClick={copyLink} className="vp-ghost"><Copy className="h-4 w-4" /> Copiar link</button>
                <button type="button" onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")} aria-label="Abrir o checkout em uma nova aba" className="vp-orb"><ExternalLink className="h-[18px] w-[18px]" /></button>
              </div>
            )}
            <button type="button" onClick={() => void save(true)} disabled={saveState === "saving"} className="vp-cta shrink-0 px-5 sm:px-6">
              {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}
              {saveState === "saving" ? "Salvando…" : "Salvar"}
            </button>
          </div>
          {/* Editar / Prévia (só no celular) */}
          <div className="flex gap-1.5 px-4 pb-3 lg:hidden" role="group" aria-label="Alternar entre edição e prévia">
            <button type="button" aria-pressed={mobileView === "edit"} onClick={() => setMobileView("edit")} className="vp-pill flex-1 justify-center"><SlidersHorizontal className="h-4 w-4" /> Editar</button>
            <button type="button" aria-pressed={mobileView === "preview"} onClick={() => setMobileView("preview")} className="vp-pill flex-1 justify-center"><Eye className="h-4 w-4" /> Prévia</button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* ─── Painel de edição ─── */}
          <aside className={cn("min-h-0 flex-col border-border bg-background max-lg:w-full lg:flex lg:w-[480px] lg:shrink-0 lg:border-r", mobileView === "edit" ? "flex" : "hidden")}>
            <div
              role="tablist"
              aria-label="Seções do checkout"
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
                e.preventDefault();
                const i = TABS.findIndex((t) => t.id === activeTab);
                const next = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
                setActiveTab(TABS[next].id);
                requestAnimationFrame(() => document.getElementById(`tab-${TABS[next].id}`)?.focus());
              }}
              className="scrollbar-none flex shrink-0 gap-1.5 overflow-x-auto !border-0 px-4 py-3 lg:flex-wrap lg:overflow-visible lg:px-6">
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={active}
                    aria-controls="builder-panel"
                    tabIndex={active ? 0 : -1}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setActiveTab(tab.id)}
                    className="vp-pill shrink-0"
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div id="builder-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-12 pt-2 lg:px-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  {/* ── Visual ── */}
                  {activeTab === "visual" && (
                    <>
                      <PanelHeading title="Visual" subtitle="Tema, cor do botão, banners e selos da página de pagamento." />

                      <Block title="Tema da página" subtitle="Cor de fundo do checkout.">
                        <div role="radiogroup" aria-label="Tema da página" className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2.5">
                          {THEME_OPTIONS.map((opt) => <ThemeChoice key={opt.key} option={opt} selected={theme === opt.key} onSelect={() => setTheme(opt.key)} />)}
                        </div>
                      </Block>

                      <Block title="Cor do botão de compra">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border" title="Escolher cor">
                            <span className="sr-only">Escolher a cor do botão</span>
                            <input type="color" value={colorValid ? buttonColor.trim() : "#10b981"} onChange={(e) => setButtonColor(e.target.value)} className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer border-0 bg-transparent p-0" />
                          </label>
                          <div className="w-[140px]">
                            <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} aria-label="Código da cor" aria-invalid={!colorValid} maxLength={7} spellCheck={false} className={cn(inputClass, "font-mono uppercase")} />
                          </div>
                          <span className="inline-flex h-12 items-center rounded-full px-6 text-[14.5px] font-bold text-white" style={{ backgroundColor: colorValid ? buttonColor.trim() : "#10b981" }}>Comprar agora</span>
                        </div>
                        {!colorValid && <FieldHint className="text-destructive">Use o formato #10b981 (um # e 6 letras ou números).</FieldHint>}
                        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Cores sugeridas">
                          {PRESET_COLORS.map((c) => {
                            const on = buttonColor.trim().toLowerCase() === c.hex;
                            return (
                              <button key={c.hex} type="button" onClick={() => setButtonColor(c.hex)} aria-label={`Usar a cor ${c.name}`} aria-pressed={on} title={c.name}
                                className={cn("grid h-8 w-8 place-items-center rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none", on ? "border-foreground" : "border-transparent")}
                                style={{ backgroundColor: c.hex }}>
                                {on && <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />}
                              </button>
                            );
                          })}
                        </div>
                      </Block>

                      <GroupBox>
                        <ToggleRow icon={<Timer className="h-[18px] w-[18px]" />} title="Timer de urgência" description="Contagem regressiva no topo do checkout.">
                          <div className="flex items-center gap-3">
                            {timerEnabled && (
                              <div className="flex items-center gap-2">
                                <div className="w-[76px]">
                                  <Input type="number" inputMode="numeric" min={1} max={60} value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} aria-label="Minutos do timer" aria-invalid={!minutesValid} className={cn(inputClass, "!h-10 !px-3 text-center tabular-nums")} />
                                </div>
                                <span className="text-[13px] text-muted-foreground">min</span>
                              </div>
                            )}
                            <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} {...switchLabel("Ativar timer de urgência")} />
                          </div>
                        </ToggleRow>
                        <ToggleRow icon={<ShieldCheck className="h-[18px] w-[18px]" />} title="Selo de garantia" description="Mostra a garantia de 7 dias.">
                          <Switch checked={guaranteeEnabled} onCheckedChange={setGuaranteeEnabled} {...switchLabel("Ativar selo de garantia")} />
                        </ToggleRow>
                      </GroupBox>
                      {!minutesValid && <FieldHint className="text-destructive">O timer vai de 1 a 60 minutos.</FieldHint>}

                      <Block title="Banners" subtitle="Imagem no topo do checkout. JPG, PNG ou WebP, até 5 MB.">
                        <div className="space-y-5">
                          <BannerSlot label="Desktop" size="1200 × 400" preview={bannerDesktopPreview} inputRef={desktopRef} onFile={(e) => handleFile(e, "desktop")} onClear={() => clearBanner("desktop")} />
                          <BannerSlot label="Celular" size="600 × 300" hint="Sem banner de celular, o de desktop é usado." preview={bannerMobilePreview} inputRef={mobileRef} onFile={(e) => handleFile(e, "mobile")} onClear={() => clearBanner("mobile")} />
                        </div>
                      </Block>
                    </>
                  )}

                  {/* ── Pagamento ── */}
                  {activeTab === "payment" && (
                    <>
                      <PanelHeading title="Pagamento" subtitle="Formas de pagamento que o comprador pode escolher." />
                      {!current.pix && !current.card && !current.boleto && (
                        <Notice tone="warn" icon={<AlertCircle className="h-4 w-4" />} title="Nenhuma forma de pagamento ativa">
                          Ative ao menos uma, senão o comprador não consegue pagar.
                        </Notice>
                      )}
                      <GroupBox>
                        <ToggleRow icon={<QrCode className="h-[18px] w-[18px]" />} title="Pix" description={allowed?.pix === false ? "Não liberado na sua conta." : "Confirmação rápida."} tone={allowed?.pix === false ? "muted" : "accent"}>
                          <Switch checked={current.pix} onCheckedChange={setPixEnabled} disabled={allowed?.pix === false} {...switchLabel("Aceitar Pix")} />
                        </ToggleRow>
                        <ToggleRow icon={<CreditCard className="h-[18px] w-[18px]" />} title="Cartão de crédito" description={allowed?.card === false ? "Não liberado na sua conta." : "Em até 12 parcelas."} tone={allowed?.card === false ? "muted" : "accent"}>
                          <Switch checked={current.card} onCheckedChange={setCreditCardEnabled} disabled={allowed?.card === false} {...switchLabel("Aceitar cartão de crédito")} />
                        </ToggleRow>
                        <ToggleRow icon={<FileText className="h-[18px] w-[18px]" />} title="Boleto bancário" description={allowed?.boleto === false ? "Não liberado na sua conta." : "Compensa em 1 a 3 dias."} tone={allowed?.boleto === false ? "muted" : "accent"}>
                          <Switch checked={current.boleto} onCheckedChange={setBoletoEnabled} disabled={allowed?.boleto === false} {...switchLabel("Aceitar boleto bancário")} />
                        </ToggleRow>
                      </GroupBox>
                      {!defaultCheckoutProcessor.available && (
                        <Notice tone="warn" icon={<Info className="h-4 w-4" />} title="Os pagamentos ainda não estão ligados">
                          A plataforma ainda não tem adquirente conectada. Até lá o comprador vê o pedido com o aviso "Pagamentos indisponíveis agora" e nada é cobrado. As formas que você ligar aqui passam a valer assim que os pagamentos entrarem no ar.
                        </Notice>
                      )}
                      <Notice icon={<Zap className="h-4 w-4" />} title="Combine Pix e cartão">
                        O Pix confirma rápido e o cartão atende quem prefere parcelar.
                      </Notice>
                    </>
                  )}

                  {/* ── Formulário ── */}
                  {activeTab === "form" && (
                    <>
                      <PanelHeading title="Formulário" subtitle="Os dados que o comprador preenche antes de pagar." />
                      <GroupBox>
                        <ToggleRow icon={<Mail className="h-[18px] w-[18px]" />} title="Confirmação de e-mail" description="O comprador digita o e-mail duas vezes.">
                          <Switch checked={emailConfirm} onCheckedChange={setEmailConfirm} {...switchLabel("Pedir confirmação de e-mail")} />
                        </ToggleRow>
                        <ToggleRow icon={<Hash className="h-[18px] w-[18px]" />} title="CPF ou CNPJ" description="Sempre pedido, é necessário para emitir o pagamento.">
                          <span className="rounded-full bg-accent px-3 py-1 text-[12.5px] font-semibold text-accent-foreground">Obrigatório</span>
                        </ToggleRow>
                        <ToggleRow icon={<MapPin className="h-[18px] w-[18px]" />} title="Endereço completo" description="Adiciona uma etapa com CEP e endereço.">
                          <Switch checked={addressRequired} onCheckedChange={setAddressRequired} {...switchLabel("Pedir endereço completo")} />
                        </ToggleRow>
                      </GroupBox>
                      <Notice icon={<ClipboardList className="h-4 w-4" />} title="Peça só o necessário">
                        Cada campo a mais é um motivo para o comprador desistir. Ative o endereço apenas se você envia algo físico.
                      </Notice>
                    </>
                  )}

                  {/* ── Order bumps ── */}
                  {activeTab === "bumps" && (
                    <>
                      <PanelHeading title="Order bumps" subtitle="Ofertas extras que o comprador adiciona com um clique antes de pagar." />

                      <Block title="Ofertas neste checkout" subtitle={`Até ${MAX_BUMPS} por produto.`}>
                        {orderBumps.length === 0 ? (
                          <p className="vp-r16 border border-dashed border-border px-4 py-6 text-center text-[14px] text-muted-foreground">Nenhuma oferta ainda. Escolha um produto abaixo.</p>
                        ) : (
                          <ul className="space-y-2.5">
                            {orderBumps.map((bump) => {
                              const prod = allProducts.find((p) => p.id === bump.bump_product_id);
                              return (
                                <li key={bump.id} className="vp-r16 flex items-center gap-3 border border-border bg-card p-3">
                                  {prod?.image_url ? <img src={prod.image_url} alt="" className="h-11 w-11 shrink-0 rounded-[12px] border border-border object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-accent text-accent-foreground"><Package className="h-[18px] w-[18px]" /></span>}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[14.5px] font-semibold text-foreground">{prod?.name || "Produto fora do ar"}</p>
                                    {prod ? (
                                      <p className="text-[13.5px] font-bold vp-green-ink tabular-nums">+ {formatCurrency(Number(prod.price || 0))}</p>
                                    ) : (
                                      <p className="text-[13px] text-muted-foreground">Inativo ou excluído: não aparece no checkout. Remova ou reative o produto.</p>
                                    )}
                                  </div>
                                  <button type="button" onClick={() => removeBump(bump.id)} aria-label={`Remover ${prod?.name || "order bump"}`} className="vp-orb !h-10 !w-10 text-destructive"><X className="h-4 w-4" /></button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </Block>

                      {orderBumps.length < MAX_BUMPS && (
                        availableForBump.length > 0 ? (
                          <Block title="Adicionar produto">
                            <div role="radiogroup" aria-label="Produto para oferecer" className="max-h-[260px] divide-y divide-border overflow-y-auto rounded-[16px] border border-border">
                              {availableForBump.map((p) => {
                                const on = selectedBumpProduct === p.id;
                                return (
                                  <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setSelectedBumpProduct(on ? "" : p.id)}
                                    className={cn("flex w-full items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary", on ? "bg-accent" : "hover:bg-muted/60")}>
                                    <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                                    {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded-[10px] border border-border object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-muted text-muted-foreground"><Package className="h-4 w-4" /></span>}
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[14px] font-semibold text-foreground">{p.name}</span>
                                      <span className="block text-[13px] font-bold vp-green-ink tabular-nums">{formatCurrency(Number(p.price))}</span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            <button type="button" onClick={addBump} disabled={!selectedBumpProduct || addingBump} className="vp-cta mt-4 w-full">
                              {addingBump ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Plus className="h-4 w-4" />} Adicionar order bump
                            </button>
                            <FieldHint>Só aparecem produtos seus que estão ativos.</FieldHint>
                          </Block>
                        ) : orderBumps.length === 0 ? (
                          <StepEmpty icon={<Package className="h-7 w-7" />} title="Você ainda não tem outro produto ativo"
                            action={<Link to="/vendas/produtos/novo/editar" className="vp-ghost">Criar outro produto</Link>}>
                            O order bump é um segundo produto seu oferecido junto com este.
                          </StepEmpty>
                        ) : null
                      )}
                      <Notice icon={<Layers className="h-4 w-4" />} title="Ofereça algo que complete a compra">
                        Funciona melhor com um produto de preço baixo que combina com o principal.
                      </Notice>
                    </>
                  )}

                  {/* ── Conversão ── */}
                  {activeTab === "cro" && (
                    <>
                      <PanelHeading title="Conversão" subtitle="O que já está ligado no seu checkout e o que ainda falta." />
                      <Block title={`${checklistDone} de ${checklist.length} recomendações ligadas`}>
                        <ul className="divide-y divide-border overflow-hidden rounded-[16px] border border-border">
                          {checklist.map((c) => (
                            <li key={c.id} className="flex items-center gap-3 bg-card px-4 py-3">
                              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full", c.ok ? "bg-primary text-primary-foreground" : "border-2 border-border text-transparent")} aria-hidden>{c.ok && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[14.5px] font-semibold text-foreground">{c.title}<span className="sr-only">{c.ok ? ", ligado" : ", desligado"}</span></p>
                                <p className="text-[13px] leading-snug text-muted-foreground">{c.why}</p>
                              </div>
                              {!c.ok && <button type="button" onClick={() => setActiveTab(c.tab)} className="vp-ghost !h-9 shrink-0 px-4 text-[13.5px]">Ajustar</button>}
                            </li>
                          ))}
                        </ul>
                      </Block>
                      <Notice icon={<Clock className="h-4 w-4" />} title="Em breve">
                        Vídeo de vendas, escassez, depoimentos e selos de confiança. Eles ainda não aparecem no checkout publicado.
                      </Notice>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Ações rápidas no celular (o cabeçalho esconde o link em telas estreitas) */}
            {checkoutUrl && (
              <div className="flex gap-2 border-t border-border bg-background px-4 py-3 sm:hidden">
                <button type="button" onClick={copyLink} className="vp-ghost flex-1 justify-center"><Copy className="h-4 w-4" /> Copiar link</button>
                <button type="button" onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")} className="vp-ghost flex-1 justify-center"><ExternalLink className="h-4 w-4" /> Abrir</button>
              </div>
            )}
          </aside>

          {/* ─── Prévia ─── */}
          <main className={cn("min-h-0 min-w-0 flex-1 flex-col !pb-0 bg-muted/50 lg:flex", mobileView === "preview" ? "flex" : "hidden")}>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2.5 sm:px-6">
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold text-foreground">Prévia</p>
                <p className="truncate text-[12.5px] text-muted-foreground">A mesma página que o comprador abre, com o que você mudou aqui. Tema: {themeName}.</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Tamanho da prévia">
                <button type="button" aria-pressed={previewMode === "desktop"} onClick={() => setPreviewMode("desktop")} className="vp-pill"><Monitor className="h-4 w-4" /><span className="hidden sm:inline">Computador</span></button>
                <button type="button" aria-pressed={previewMode === "mobile"} onClick={() => setPreviewMode("mobile")} className="vp-pill"><Smartphone className="h-4 w-4" /><span className="hidden sm:inline">Celular</span></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-8 sm:py-8">
              <CheckoutLivePreview device={previewMode} payload={previewPayload} host={(checkoutUrl || "seu-checkout").replace(/^https?:\/\//, "")} />
            </div>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
