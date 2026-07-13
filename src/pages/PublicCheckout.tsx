import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
 CreditCard, QrCode, FileText, CheckCircle2, Copy, Clock, Loader2,
 RefreshCw, ShieldCheck, ChevronDown, User, Mail, FileDigit, Phone,
 Sparkles, Plus, Package, Lock, Eye, Zap, Star, TrendingUp,
 ArrowRight, Check, AlertCircle, Users, Timer, Heart, Ticket,
 type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { initPixels, firePixelEvent, type PixelConfig } from "@/lib/pixelTracking";
import { Seo } from "@/components/Seo";

/* ─── Types ─── */
type Product = {
 id: string; name: string; description: string | null; price: number;
 image_url: string | null; checkout_button_color: string | null;
 checkout_timer_enabled: boolean | null; checkout_timer_minutes: number | null;
 checkout_banner_desktop_url: string | null; checkout_banner_mobile_url: string | null;
 checkout_social_proof: boolean | null; checkout_guarantee_enabled: boolean | null;
 checkout_pix_enabled: boolean | null; checkout_boleto_enabled: boolean | null;
 checkout_credit_card_enabled: boolean | null; checkout_address_required: boolean | null;
 checkout_email_confirm: boolean | null;
 checkout_theme?: string | null;
 support_email?: string | null;
 display_name?: string | null;
};
type OrderBump = { id: string; bump_product_id: string; bump_product: { id: string; name: string; description: string | null; price: number; image_url: string | null; }; };
type PaymentMethod = "pix" | "credit_card" | "boleto";
type CheckoutState = "form" | "pending" | "approved" | "failed";

/* ─── Utils ─── */
function getCheckoutSessionId(slug: string): string {
 const key = `checkout_session_${slug}`;
 let sessionId = sessionStorage.getItem(key);
 if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem(key, sessionId); }
 return sessionId;
}
function clearCheckoutSession(slug: string) { sessionStorage.removeItem(`checkout_session_${slug}`); }

function isValidCpf(cpf: string): boolean {
 const digits = cpf.replace(/\D/g, "");
 if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
 let sum = 0;
 for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
 let rest = (sum * 10) % 11; if (rest === 10) rest = 0;
 if (rest !== parseInt(digits[9])) return false;
 sum = 0;
 for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
 rest = (sum * 10) % 11; if (rest === 10) rest = 0;
 return rest === parseInt(digits[10]);
}
function isValidCnpj(cnpj: string): boolean {
 const digits = cnpj.replace(/\D/g, "");
 if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
 const w1 = [5,4,3,2,9,8,7,6,5,4,3,2], w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
 let sum = 0;
 for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * w1[i];
 let rest = sum % 11; rest = rest < 2 ? 0 : 11 - rest;
 if (rest !== parseInt(digits[12])) return false;
 sum = 0;
 for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * w2[i];
 rest = sum % 11; rest = rest < 2 ? 0 : 11 - rest;
 return rest === parseInt(digits[13]);
}

/* ─── Formatters ─── */
const formatCpf = (v: string) => {
 const d = v.replace(/\D/g, "").slice(0, 14);
 if (d.length <= 3) return d;
 if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
 if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
 if (d.length <= 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
 return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
};
const formatPhone = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 11); if (d.length <= 2) return d; if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`; return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; };
const formatCardNumber = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const formatExpiry = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length <= 2 ? d : `${d.slice(0,2)}/${d.slice(2)}`; };
const formatCep = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 8); return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`; };
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── Fake names for social proof ─── */
const BUYER_NAMES = ["Ana S.", "Carlos M.", "Juliana R.", "Pedro H.", "Mariana L.", "Lucas F.", "Fernanda A.", "Rafael B.", "Camila T.", "Bruno V.", "Patricia O.", "Diego N.", "Isabela C.", "Thiago P.", "Larissa D."];
const CITIES = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre", "Salvador", "Brasília", "Fortaleza", "Recife", "Goiânia"];
const AVATAR_URLS = [
 "https://i.pravatar.cc/80?img=1", "https://i.pravatar.cc/80?img=5", "https://i.pravatar.cc/80?img=10",
 "https://i.pravatar.cc/80?img=12", "https://i.pravatar.cc/80?img=16", "https://i.pravatar.cc/80?img=20",
 "https://i.pravatar.cc/80?img=23", "https://i.pravatar.cc/80?img=25", "https://i.pravatar.cc/80?img=32",
 "https://i.pravatar.cc/80?img=36", "https://i.pravatar.cc/80?img=41", "https://i.pravatar.cc/80?img=44",
 "https://i.pravatar.cc/80?img=47", "https://i.pravatar.cc/80?img=49", "https://i.pravatar.cc/80?img=53",
];

/* ═══ Premium Loading Screen ═══ */
function PremiumLoader({ color }: { color?: string }) {
 const c = color || "#10b981";
 return (
 <div className="min-h-screen flex items-center justify-center bg-[hsl(210_20%_98%)]">
 <div className="flex flex-col items-center gap-6 animate-fade-in">
 {/* Animated logo area */}
 <div className="relative">
 {/* Outer glow ring */}
 <div className="absolute -inset-4 rounded-full animate-pulse opacity-30" style={{ background: `radial-gradient(circle, ${c}40, transparent 70%)` }} />
 {/* Spinning ring */}
 <div className="h-16 w-16 rounded-2xl relative">
 <svg className="absolute inset-0 h-16 w-16 animate-spin" style={{ animationDuration: "2.5s" }} viewBox="0 0 64 64">
 <circle cx="32" cy="32" r="28" fill="none" stroke={c + "15"} strokeWidth="3" />
 <circle cx="32" cy="32" r="28" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeDasharray="40 136" />
 </svg>
 <div className="absolute inset-0 flex items-center justify-center">
 <Lock className="h-5 w-5" style={{ color: c }} />
 </div>
 </div>
 </div>
 <div className="text-center space-y-1.5">
 <p className="text-sm font-bold text-gray-700">Carregando checkout seguro</p>
 <div className="flex items-center justify-center gap-1.5">
 <ShieldCheck className="h-3 w-3 text-gray-300" />
 <span className="text-[10px] text-gray-400 font-medium">Conexão criptografada</span>
 </div>
 </div>
 {/* Progress dots */}
 <div className="flex gap-1.5">
 {[0, 1, 2].map(i => (
 <div
 key={i}
 className="h-1.5 w-1.5 rounded-full animate-pulse"
 style={{ backgroundColor: c, animationDelay: `${i * 0.3}s` }}
 />
 ))}
 </div>
 </div>
 </div>
 );
}

/* ═══ Live Viewer Counter ═══ */
function LiveViewers({ color }: { color: string }) {
 const [count, setCount] = useState(Math.floor(Math.random() * 30) + 15);
 useEffect(() => {
 const interval = setInterval(() => {
 setCount(c => Math.max(8, c + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3)));
 }, 4000 + Math.random() * 3000);
 return () => clearInterval(interval);
 }, []);
 return (
 <div className="flex items-center gap-2">
 <span className="relative flex h-2.5 w-2.5">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
 <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
 </span>
 <span className="text-[11px] font-semibold text-[hsl(var(--checkout-text-muted))]">
 <strong className="text-[hsl(var(--checkout-text))]">{count}</strong> pessoas vendo agora
 </span>
 </div>
 );
}

/* ═══ Recent Purchase Toast ═══ */
function RecentPurchaseToast({ productName, color }: { productName: string; color: string }) {
 const [visible, setVisible] = useState(false);
 const [buyer, setBuyer] = useState({ name: "", city: "", ago: 0, avatar: "" });

 useEffect(() => {
 const show = () => {
 setBuyer({
 name: BUYER_NAMES[Math.floor(Math.random() * BUYER_NAMES.length)],
 city: CITIES[Math.floor(Math.random() * CITIES.length)],
 ago: Math.floor(Math.random() * 15) + 1,
 avatar: AVATAR_URLS[Math.floor(Math.random() * AVATAR_URLS.length)],
 });
 setVisible(true);
 setTimeout(() => setVisible(false), 4000);
 };
 const timeout = setTimeout(show, 5000 + Math.random() * 8000);
 const interval = setInterval(show, 18000 + Math.random() * 15000);
 return () => { clearTimeout(timeout); clearInterval(interval); };
 }, []);

 if (!visible) return null;
 return (
 <div className="fixed bottom-4 left-4 z-50 animate-slide-in-left max-w-[320px]">
 <div className="rounded-2xl border border-[hsl(var(--checkout-border))] bg-[hsl(var(--checkout-bg-elevated))] p-3.5 shadow-2xl shadow-black/10 flex items-center gap-3 backdrop-blur-xl">
 <img src={buyer.avatar} alt="" className="h-10 w-10 rounded-full object-cover border-2 border-white/20 shadow-md shrink-0" />
 <div className="min-w-0">
 <p className="text-[12px] font-bold text-[hsl(var(--checkout-text))] truncate">{buyer.name} de {buyer.city}</p>
 <p className="text-[10px] text-[hsl(var(--checkout-text-muted))]">Comprou há {buyer.ago} min • <span style={{ color }}>{productName}</span></p>
 </div>
 </div>
 </div>
 );
}

/* ═══ Step Indicator (Premium) ═══ */
function StepIndicator({ current, total, color }: { current: number; total: number; color: string }) {
 return (
 <div className="flex items-center gap-2 w-full">
 {Array.from({ length: total }, (_, i) => {
 const step = i + 1;
 const isActive = step === current;
 const isDone = step < current;
 return (
 <div key={step} className="flex items-center gap-2 flex-1">
 <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${color}10` }}>
 <div
 className="h-full rounded-full transition-all duration-1000 ease-out"
 style={{
 width: isDone ? "100%" : isActive ? "50%" : "0%",
 backgroundColor: isDone || isActive ? color : "transparent",
 boxShadow: isDone || isActive ? `0 0 8px ${color}30` : "none",
 }}
 />
 </div>
 </div>
 );
 })}
 </div>
 );
}

/* ═══════════════════════════════════════════════════ */
/* ═══ MAIN CHECKOUT COMPONENT ═══════════════════════ */
/* ═══════════════════════════════════════════════════ */

export default function PublicCheckout() {
 const { slug } = useParams();
 const affiliateSlug = (typeof window !== "undefined")
   ? new URLSearchParams(window.location.search).get("aff") || new URLSearchParams(window.location.search).get("ref") || null
   : null;
 const [product, setProduct] = useState<Product | null>(null);
 const [loading, setLoading] = useState(true);
 const [method, setMethod] = useState<PaymentMethod>("credit_card");
 const [processing, setProcessing] = useState(false);
 const [checkoutState, setCheckoutState] = useState<CheckoutState>("form");
 const processingRef = useRef(false);

 const [pixData, setPixData] = useState<{ qrcode?: string; qrCode?: string; qrCodeText?: string } | null>(null);
 const [boletoData, setBoletoData] = useState<{ url?: string; barCode?: string } | null>(null);
 const [transactionId, setTransactionId] = useState<string | null>(null);
 const [orderBumps, setOrderBumps] = useState<OrderBump[]>([]);
 const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
 const [productPixels, setProductPixels] = useState<PixelConfig[]>([]);
 const pixelsInitialized = useRef(false);

 // Form fields
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [emailConfirm, setEmailConfirm] = useState("");
 const [document, setDocument] = useState("");
 const [phone, setPhone] = useState("");
 const [cardNumber, setCardNumber] = useState("");
 const [cardExpiry, setCardExpiry] = useState("");
 const [cardCvv, setCardCvv] = useState("");
 const [cardName, setCardName] = useState("");
 const [installments, setInstallments] = useState("1");
 const [cep, setCep] = useState("");
 const [street, setStreet] = useState("");
 const [number_, setNumber_] = useState("");
 const [complement, setComplement] = useState("");
 const [neighborhood, setNeighborhood] = useState("");
 const [city, setCity] = useState("");
 const [state, setState] = useState("");
 const [loadingCep, setLoadingCep] = useState(false);
 const [socialCount] = useState(Math.floor(Math.random() * 200) + 80);
  const [copiedPix, setCopiedPix] = useState(false);

  // Coupon
  const [couponInput, setCouponInput] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<null | { code: string; coupon_id: string; discount_amount: number; apply_to_bumps: boolean; discount_type: string; discount_value: number; }>(null);


 // Timer
 const timerMinutes = product?.checkout_timer_minutes ?? 15;
 const [timeLeft, setTimeLeft] = useState(timerMinutes * 60);
 useEffect(() => {
 if (!product?.checkout_timer_enabled) return;
 setTimeLeft((product?.checkout_timer_minutes ?? 15) * 60);
 }, [product?.checkout_timer_enabled, product?.checkout_timer_minutes]);
 useEffect(() => {
 if (!product?.checkout_timer_enabled) return;
 const timer = setInterval(() => setTimeLeft(t => (t > 0 ? t - 1 : 0)), 1000);
 return () => clearInterval(timer);
 }, [product?.checkout_timer_enabled]);
 const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
 const secs = String(timeLeft % 60).padStart(2, "0");

 // Load product, pixels, and bumps
 useEffect(() => {
 if (!slug) return;
 let cancelled = false;

    async function loadCheckoutData() {
      // Slug arrives from the URL — restrict to safe chars before interpolating
      // into a PostgREST `.or(...)` filter. This blocks injection of extra filter
      // clauses (comma, dot, parentheses) that would otherwise let a crafted URL
      // match unrelated products or break the query.
      const safeSlug = (slug || "").replace(/[^a-zA-Z0-9_-]/g, "");
      if (!safeSlug) { setLoading(false); return; }

      const { data: prod } = await supabase
        .from("products_public")
        .select("*")
        .or(`checkout_url.like.%/pay/${safeSlug},checkout_url.like.%/checkout/${safeSlug},checkout_url.eq.${safeSlug},checkout_url.eq./${safeSlug}`)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!prod) { setLoading(false); return; }
  const productWithTheme = { ...prod, checkout_theme: prod.checkout_theme || "gray" };
 if (cancelled) return;
 setProduct(productWithTheme as unknown as Product);

 const [pixelsRes, bumpsRes] = await Promise.all([
 supabase.from("product_pixels_public").select("*").eq("product_id", prod.id!).eq("is_active", true),
 supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", prod.id).eq("is_active", true).order("sort_order"),
 ]);

 if (cancelled) return;

 if (pixelsRes.data && pixelsRes.data.length > 0) {
 const configs: PixelConfig[] = pixelsRes.data.map((d) => ({ ...d, events: Array.isArray(d.events) ? d.events : [] }) as unknown as PixelConfig);
 setProductPixels(configs);
 if (!pixelsInitialized.current) {
 initPixels(configs); pixelsInitialized.current = true;
 setTimeout(() => {
 firePixelEvent(configs, "PageView", { content_name: prod.name!, content_id: prod.id!, value: Number(prod.price) });
 firePixelEvent(configs, "ViewContent", { content_name: prod.name!, content_id: prod.id!, value: Number(prod.price) });
 }, 300);
 }
 }

 if (bumpsRes.data && bumpsRes.data.length > 0) {
 const bumpIds = bumpsRes.data.map(b => b.bump_product_id);
 const { data: bumpProducts } = await supabase.from("products_public").select("id, name, description, price, image_url").in("id", bumpIds);
 if (!cancelled && bumpProducts) {
 setOrderBumps(bumpsRes.data.map(b => ({
 id: b.id, bump_product_id: b.bump_product_id,
 bump_product: bumpProducts.find(p => p.id === b.bump_product_id) as OrderBump["bump_product"],
 })).filter(b => b.bump_product));
 }
 }

 setLoading(false);
 }

 loadCheckoutData();
 return () => { cancelled = true; };
 }, [slug]);

 useEffect(() => {
 if (!product) return;
 if (product.checkout_pix_enabled) setMethod("pix");
 else if (product.checkout_credit_card_enabled) setMethod("credit_card");
 else if (product.checkout_boleto_enabled) setMethod("boleto");
 }, [product]);

 useEffect(() => {
 const prev = window.document.body.style.overflow;
 window.document.body.style.overflow = "auto";
 window.document.body.style.overscrollBehavior = "auto";
 return () => { window.document.body.style.overflow = prev || ""; window.document.body.style.overscrollBehavior = ""; };
 }, []);

 // Poll transaction status
 useEffect(() => {
 if (checkoutState !== "pending" || !transactionId) return;
 let pollCount = 0;
 let timer: ReturnType<typeof setTimeout>;

 const poll = async () => {
 pollCount++;
 try {
 const { data: status } = await supabase.rpc("get_checkout_status", { _transaction_id: transactionId });
 if (status === "completed") {
 setCheckoutState("approved"); clearCheckoutSession(slug || "");
 if (product) firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: Number(product.price), session_key: slug || "default" });
 return;
 } else if (status === "failed" || status === "cancelled") {
 setCheckoutState("failed"); clearCheckoutSession(slug || "");
 return;
 }
 } catch { /* network error, retry */ }
 const delay = pollCount > 60 ? 15000 : 5000;
 timer = setTimeout(poll, delay);
 };

 timer = setTimeout(poll, 3000);
 return () => clearTimeout(timer);
 }, [checkoutState, transactionId, slug]);

 // CEP handler
 const handleCepChange = useCallback(async (val: string) => {
 const formatted = formatCep(val); setCep(formatted);
 const digits = formatted.replace(/\D/g, "");
 if (digits.length === 8) {
 setLoadingCep(true);
 try {
 const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
 const data = await res.json();
 if (!data.erro) { setStreet(data.logradouro || ""); setNeighborhood(data.bairro || ""); setCity(data.localidade || ""); setState(data.uf || ""); }
 else toast.error("CEP não encontrado");
 } catch { toast.error("Erro ao buscar CEP"); }
 finally { setLoadingCep(false); }
 }
 }, []);

 const toggleBump = (bumpId: string) => {
 setSelectedBumps(prev => { const next = new Set(prev); if (next.has(bumpId)) next.delete(bumpId); else next.add(bumpId); return next; });
 };

 // Rate Limiting
 const submitCountRef = useRef<number[]>([]);
 const RATE_LIMIT_WINDOW = 60_000;
 const RATE_LIMIT_MAX = 3;

 // Payment Handler
 const handlePay = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!product || processingRef.current) return;

 const now = Date.now();
 submitCountRef.current = submitCountRef.current.filter(t => now - t < RATE_LIMIT_WINDOW);
 if (submitCountRef.current.length >= RATE_LIMIT_MAX) {
 toast.error("Muitas tentativas. Aguarde 1 minuto antes de tentar novamente.");
 return;
 }
 submitCountRef.current.push(now);
 const phoneDigits = phone.replace(/\D/g, "");
 if (phoneDigits.length < 10) { toast.error("Informe um WhatsApp válido"); return; }
 const docDigits = document.replace(/\D/g, "");
 if (docDigits.length === 11 && !isValidCpf(document)) { toast.error("CPF inválido"); return; }
 if (docDigits.length === 14 && !isValidCnpj(document)) { toast.error("CNPJ inválido"); return; }
 if (docDigits.length !== 11 && docDigits.length !== 14) { toast.error("CPF/CNPJ inválido"); return; }
 if (product.checkout_email_confirm && email !== emailConfirm) { toast.error("Os e-mails não coincidem"); return; }

 const sessionKey = slug || "default";
 firePixelEvent(productPixels, "InitiateCheckout", { content_name: product.name, content_id: product.id, value: totalPrice, session_key: sessionKey });
 firePixelEvent(productPixels, "AddPaymentInfo", { content_name: product.name, content_id: product.id, value: totalPrice, session_key: sessionKey });

 processingRef.current = true; setProcessing(true);
 try {
 const sessionId = getCheckoutSessionId(slug || "default");
  const payload: Record<string, unknown> = {
  productId: product.id, paymentMethod: method, customerName: name,
  customerEmail: email, customerDocument: docDigits, customerPhone: phoneDigits,
  checkoutSessionId: sessionId,
  couponCode: appliedCoupon?.code || null,
  affiliateSlug: affiliateSlug || null,
  selectedBumpIds: orderBumps
    .filter(b => selectedBumps.has(b.id))
    .map(b => b.bump_product_id),
  };

 if (method === "credit_card") { payload.installments = parseInt(installments); payload.cardToken = null; }
 const { data, error } = await supabase.functions.invoke("podpay-create-transaction", { body: payload });
 if (error || !data?.success) { toast.error("Não foi possível processar. Tente novamente."); setCheckoutState("failed"); return; }
 const result = data.data;
 setTransactionId(result.transactionId);
 if (data.resumed) { if (result.pix) setPixData(result.pix); if (result.boleto) setBoletoData(result.boleto); setCheckoutState("pending"); return; }
 if (method === "pix" && result.pix) {
 setPixData(result.pix); setCheckoutState("pending");
 firePixelEvent(productPixels, "PixGenerated", { content_name: product.name, content_id: product.id, value: totalPrice, session_key: sessionKey });
 } else if (method === "boleto" && result.boleto) {
 setBoletoData(result.boleto); setCheckoutState("pending");
 firePixelEvent(productPixels, "BoletoGenerated", { content_name: product.name, content_id: product.id, value: totalPrice, session_key: sessionKey });
 } else if (method === "credit_card") {
 if (result.status === "paid" || result.status === "approved") {
 setCheckoutState("approved"); clearCheckoutSession(slug || "");
 firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: totalPrice, session_key: sessionKey });
 } else if (result.secureUrl) {
 try {
 const url = new URL(result.secureUrl);
 if (url.protocol === 'https:' && (url.hostname.endsWith('.podpay.co') || url.hostname.endsWith('.pagar.me'))) {
 window.location.href = result.secureUrl;
 } else {
 toast.error("URL de pagamento inválida"); setCheckoutState("failed");
 }
 } catch { toast.error("URL de pagamento inválida"); setCheckoutState("failed"); }
 }
 else { setCheckoutState("approved"); clearCheckoutSession(slug || ""); firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: totalPrice, session_key: sessionKey }); }
 } else { setCheckoutState("approved"); clearCheckoutSession(slug || ""); firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: totalPrice, session_key: sessionKey }); }
 } catch { toast.error("Instabilidade na rede. Tente novamente."); setCheckoutState("failed"); }
 finally {
 setProcessing(false); processingRef.current = false;
 setCardNumber(""); setCardExpiry(""); setCardCvv(""); setCardName("");
 }
 };

 const retryPayment = () => { clearCheckoutSession(slug || ""); setCheckoutState("form"); setPixData(null); setBoletoData(null); setTransactionId(null); };

 /* ─── Loading ─── */
 if (loading) return <PremiumLoader />;

 if (!product) return (
 <div className="min-h-screen flex items-center justify-center bg-[hsl(210_20%_98%)] px-4">
 <div className="text-center animate-fade-in">
 <div className="relative mx-auto mb-6 w-20 h-20">
 <div className="absolute inset-0 rounded-3xl bg-gray-100 animate-pulse" />
 <div className="relative h-20 w-20 rounded-3xl bg-white border border-gray-200/80 flex items-center justify-center shadow-lg shadow-black/5">
 <AlertCircle className="h-8 w-8 text-gray-300" />
 </div>
 </div>
 <h1 className="text-xl font-extrabold text-gray-800 mb-2">Produto não encontrado</h1>
 <p className="text-sm text-gray-400 max-w-xs mx-auto">Verifique o link e tente novamente.</p>
 </div>
 </div>
 );

 /* ─── Computed values ─── */
  const price = Number(product.price);
  const bumpsTotal = orderBumps.filter(b => selectedBumps.has(b.id)).reduce((s, b) => s + Number(b.bump_product.price), 0);
  const subtotal = price + bumpsTotal;
  // Recompute discount on selected items (server is authoritative on submit)
  let discountValue = 0;
  if (appliedCoupon) {
    const base = appliedCoupon.apply_to_bumps ? subtotal : price;
    if (appliedCoupon.discount_type === "percentage") {
      discountValue = Math.round((base * Number(appliedCoupon.discount_value) / 100) * 100) / 100;
    } else {
      discountValue = Math.min(Number(appliedCoupon.discount_value), Math.max(base - 0.01, 0));
    }
    if (discountValue < 0) discountValue = 0;
  }
  const totalPrice = Math.max(subtotal - discountValue, 0.01);

 const btnColor = product.checkout_button_color || "#10b981";
 const themeMode = product.checkout_theme === "white" ? "white" : product.checkout_theme === "dark" ? "dark" : "gray";
 const isWhite = themeMode === "white";
 const isDark = themeMode === "dark";
 const checkoutThemeStyle = {
 "--btn-color": btnColor,
 "--checkout-bg": isDark ? "220 18% 11%" : isWhite ? "210 20% 98%" : "210 16% 94%",
 "--checkout-bg-elevated": isDark ? "220 16% 14%" : "0 0% 100%",
 "--checkout-bg-soft": isDark ? "220 15% 18%" : isWhite ? "210 20% 96%" : "210 18% 97%",
 "--checkout-border": isDark ? "220 12% 24%" : isWhite ? "215 18% 88%" : "215 16% 84%",
 "--checkout-text": isDark ? "210 20% 96%" : "220 24% 14%",
 "--checkout-text-muted": isDark ? "215 12% 68%" : "220 10% 46%",
 } as React.CSSProperties;
 const checkoutRuntimeStyles = (
 <style>{`
 @keyframes slide-in-left {
 from { transform: translateX(-120%); opacity: 0; }
 to { transform: translateX(0); opacity: 1; }
 }
 .animate-slide-in-left { animation: slide-in-left 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
 @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
 .animate-fade-in { animation: fade-in 0.6s ease-out; }
 @keyframes shimmer-flow {
 0% { transform: translateX(-100%); }
 100% { transform: translateX(100%); }
 }
 .checkout-shimmer { animation: shimmer-flow 2s infinite; }
 @keyframes float-gentle {
 0%, 100% { transform: translateY(0px); }
 50% { transform: translateY(-6px); }
 }
 .animate-float { animation: float-gentle 3s ease-in-out infinite; }
 @keyframes confetti-pop {
 0% { transform: scale(0.5); opacity: 0; }
 60% { transform: scale(1.1); }
 100% { transform: scale(1); opacity: 1; }
 }
 .animate-confetti-pop { animation: confetti-pop 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
 @keyframes checkmark-draw {
 0% { stroke-dashoffset: 30; }
 100% { stroke-dashoffset: 0; }
 }
 .animate-checkmark { animation: checkmark-draw 0.8s ease-out 0.3s both; }
 [data-checkout-theme="dark"] .bg-white,
 [data-checkout-theme="dark"] .bg-gray-50 {
 background-color: hsl(var(--checkout-bg-elevated)) !important;
 }
 [data-checkout-theme="dark"] .bg-gray-100 {
 background-color: hsl(var(--checkout-bg-soft)) !important;
 }
 [data-checkout-theme="dark"] .border-gray-100,
 [data-checkout-theme="dark"] .border-gray-200 {
 border-color: hsl(var(--checkout-border)) !important;
 }
 [data-checkout-theme="dark"] .text-gray-900,
 [data-checkout-theme="dark"] .text-gray-800,
 [data-checkout-theme="dark"] .text-gray-700,
 [data-checkout-theme="dark"] .text-gray-600 {
 color: hsl(var(--checkout-text)) !important;
 }
 [data-checkout-theme="dark"] .text-gray-500,
 [data-checkout-theme="dark"] .text-gray-400,
 [data-checkout-theme="dark"] .text-gray-300 {
 color: hsl(var(--checkout-text-muted)) !important;
 }
 [data-checkout-theme="dark"] input::placeholder {
 color: hsl(215 12% 48%) !important;
 }
 [data-checkout-theme="dark"] select option {
 background: hsl(var(--checkout-bg-elevated));
 color: hsl(var(--checkout-text));
 }
 `}</style>
 );
 const installmentOptions = Array.from({ length: 12 }, (_, i) => { const n = i + 1; const val = n === 1 ? totalPrice : totalPrice * (1 + 0.0199 * (n - 1)) / n; return { n, val, total: n === 1 ? totalPrice : val * n }; });
 const selectedInstallment = installmentOptions[parseInt(installments) - 1];

 const availableMethods: { id: PaymentMethod; icon: LucideIcon; label: string; badge?: string }[] = [];
 if (product.checkout_pix_enabled) availableMethods.push({ id: "pix", icon: QrCode, label: "PIX", badge: "Instantâneo" });
 if (product.checkout_credit_card_enabled) availableMethods.push({ id: "credit_card", icon: CreditCard, label: "Cartão", badge: "Até 12x" });
 if (product.checkout_boleto_enabled) availableMethods.push({ id: "boleto", icon: FileText, label: "Boleto", badge: "1-3 dias" });

 const totalSteps = product.checkout_address_required ? 3 : 2;

 /* ══════════════════════════════════════════════════════ */
 /* ═══ TELA: APROVADO ═══════════════════════════════════ */
 /* ══════════════════════════════════════════════════════ */
 if (checkoutState === "approved") {
 const txParam = transactionId ? `?tx=${transactionId}` : "";
 return (
 <div data-checkout-theme={themeMode} style={checkoutThemeStyle} className={`min-h-screen flex items-center justify-center p-4 ${isDark ? "bg-[hsl(220_18%_11%)] text-[hsl(210_20%_96%)]" : "bg-[hsl(210_20%_98%)] text-gray-900"}`}>
 <div className="text-center animate-confetti-pop max-w-md w-full">
 {/* Success orb with animated checkmark */}
 <div className="relative mx-auto mb-8 w-32 h-32">
 <div className="absolute inset-0 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: btnColor + "25" }} />
 <div className="absolute inset-3 rounded-full blur-xl" style={{ backgroundColor: btnColor + "15" }} />
 <div className="relative h-32 w-32 rounded-full flex items-center justify-center shadow-2xl animate-float" style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}cc)`, boxShadow: `0 20px 60px -15px ${btnColor}50` }}>
 <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <path d="M5 13l4 4L19 7" className="animate-checkmark" style={{ strokeDasharray: 30, strokeDashoffset: 0 }} />
 </svg>
 </div>
 </div>

 <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Pagamento Confirmado!</h1>
 <p className="text-gray-400 mb-8 text-base">Seu acesso foi liberado com sucesso</p>

 {/* Summary card */}
 <div className="rounded-2xl p-6 bg-white border border-gray-200/80 mb-6 text-left space-y-4 shadow-lg shadow-black/5">
 <div className="flex justify-between items-center">
 <span className="text-gray-400 text-sm">Produto</span>
 <span className="font-bold text-gray-800">{product.name}</span>
 </div>
 <div className="h-px bg-gray-100" />
 <div className="flex justify-between items-center">
 <span className="text-gray-400 text-sm">Valor pago</span>
 <span className="font-extrabold text-2xl tracking-tight" style={{ color: btnColor }}>R$ {fmtBRL(totalPrice)}</span>
 </div>
 </div>

 <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 mx-auto w-fit">
 <Mail className="h-3.5 w-3.5 text-gray-400" />
 <p className="text-xs text-gray-500">Confirmação enviada para <strong>{email}</strong></p>
 </div>

 <a
 href={`/obrigado${txParam}`}
 className="inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
 style={{ backgroundColor: btnColor, boxShadow: `0 10px 40px -10px ${btnColor}50` }}
 >
 Ver detalhes <ArrowRight className="h-4 w-4" />
 </a>
 </div>
 {checkoutRuntimeStyles}
 </div>
 );
 }

 /* ══════════════════════════════════════════════════════ */
 /* ═══ TELA: FALHA ══════════════════════════════════════ */
 /* ══════════════════════════════════════════════════════ */
 if (checkoutState === "failed") return (
 <div data-checkout-theme={themeMode} style={checkoutThemeStyle} className={`min-h-screen flex items-center justify-center p-4 ${isDark ? "bg-[hsl(220_18%_11%)] text-[hsl(210_20%_96%)]" : "bg-[hsl(210_20%_98%)] text-gray-900"}`}>
 <div className="text-center animate-fade-in max-w-md w-full">
 <div className="relative mx-auto mb-8 w-28 h-28">
 <div className="absolute inset-0 rounded-full bg-red-500/15 blur-3xl animate-pulse" />
 <div className="relative h-28 w-28 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-2xl shadow-red-500/20">
 <AlertCircle className="h-14 w-14 text-white" />
 </div>
 </div>
 <h1 className="text-2xl font-extrabold mb-3 tracking-tight">Pagamento não aprovado</h1>
 <p className="text-gray-400 mb-8 text-sm max-w-xs mx-auto">Verifique seus dados ou tente outro método de pagamento.</p>
 <Button onClick={retryPayment} className="h-14 px-10 rounded-2xl text-white font-bold text-base gap-2 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl" style={{ backgroundColor: btnColor, boxShadow: `0 10px 40px -10px ${btnColor}50` }}>
 <RefreshCw className="h-4 w-4" /> Tentar novamente
 </Button>
 </div>
 {checkoutRuntimeStyles}
 </div>
 );

 /* ══════════════════════════════════════════════════════ */
 /* ═══ TELA: PENDENTE (PIX/BOLETO) ═════════════════════ */
 /* ══════════════════════════════════════════════════════ */
 if (checkoutState === "pending") return (
 <div data-checkout-theme={themeMode} style={checkoutThemeStyle} className={`min-h-screen ${isDark ? "bg-[hsl(220_18%_11%)] text-[hsl(210_20%_96%)]" : "bg-[hsl(210_20%_98%)] text-gray-900"}`}>
 <Seo title={`Aguardando pagamento — ${product.name}`} description={`Finalize o pagamento de ${product.name} via PIX ou boleto.`} path={`/pay/${slug || ""}`} noindex />
 <div className="max-w-lg mx-auto px-4 py-8 md:py-14 animate-fade-in">
 {/* Header */}
 <div className="flex items-center gap-4 mb-8">
 <div className="h-16 w-16 rounded-2xl bg-white border border-gray-200/80 flex items-center justify-center shrink-0 overflow-hidden shadow-lg shadow-black/5">
 {product.image_url ? <img src={product.image_url} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <Sparkles className="h-6 w-6 text-gray-300" />}
 </div>
 <div>
 <h1 className="font-bold text-lg text-gray-800">{product.name}</h1>
 <p className="font-extrabold text-2xl tracking-tight" style={{ color: btnColor }}>R$ {fmtBRL(totalPrice)}</p>
 </div>
 </div>

 {/* Status badge */}
 <h2 className="sr-only">Status do pagamento</h2>
 <div className="flex justify-center mb-8">
 <div className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl border shadow-lg shadow-black/5" style={{ backgroundColor: btnColor + "08", borderColor: btnColor + "20" }}>
 <div className="relative">
 <Timer className="h-5 w-5" style={{ color: btnColor }} />
 <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full animate-ping" style={{ backgroundColor: btnColor }} />
 </div>
 <span className="text-sm font-bold" style={{ color: btnColor }}>Aguardando pagamento</span>
 </div>
 </div>

 {/* PIX */}
 {pixData && (
 <div className="rounded-3xl p-6 md:p-8 bg-white border border-gray-200/80 mb-6 space-y-6 shadow-xl shadow-black/5">
 <div className="text-center">
 <h3 className="font-bold text-lg flex items-center justify-center gap-2 mb-1" style={{ color: btnColor }}>
 <QrCode className="h-5 w-5" /> Pague com PIX
 </h3>
 <p className="text-xs text-gray-400">Escaneie o QR Code ou copie o código abaixo</p>
 </div>

 {(pixData.qrcode || pixData.qrCode || pixData.qrCodeText) && (
 <div className="flex justify-center">
 <div className="bg-white p-6 rounded-3xl shadow-lg shadow-black/5 border border-gray-100">
 <QRCodeSVG value={pixData.qrcode || pixData.qrCodeText || pixData.qrCode} size={220} />
 </div>
 </div>
 )}

 <div className="flex items-center gap-3 text-xs text-gray-400 justify-center">
 <Clock className="h-3.5 w-3.5" /> Expira em 30 minutos
 </div>

 {(pixData.qrcode || pixData.qrCodeText) && (
 <button
 type="button"
 onClick={() => { navigator.clipboard.writeText(pixData.qrcode || pixData.qrCodeText); setCopiedPix(true); toast.success("Código PIX copiado!"); setTimeout(() => setCopiedPix(false), 3000); }}
 className="w-full flex items-center justify-center gap-2.5 h-14 rounded-2xl font-bold text-base transition-all hover:scale-[1.01] active:scale-[0.99] text-white relative overflow-hidden"
 style={{
 backgroundColor: copiedPix ? "#10b981" : btnColor,
 boxShadow: `0 8px 30px -8px ${copiedPix ? "#10b981" : btnColor}50`,
 }}
 >
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent checkout-shimmer" />
 <span className="relative flex items-center gap-2">
 {copiedPix ? <><Check className="h-5 w-5" /> Código copiado!</> : <><Copy className="h-5 w-5" /> Copiar código PIX</>}
 </span>
 </button>
 )}
 </div>
 )}

 {/* Boleto */}
 {boletoData && (
 <div className="rounded-3xl p-6 md:p-8 bg-white border border-gray-200/80 mb-6 space-y-4 shadow-xl shadow-black/5">
 <h3 className="text-center font-bold text-lg" style={{ color: btnColor }}>Boleto gerado com sucesso</h3>
 {boletoData.url && (
 <button type="button" onClick={() => window.open(boletoData.url, "_blank")}
 className="w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
 style={{ backgroundColor: btnColor, boxShadow: `0 8px 30px -8px ${btnColor}50` }}>
 <FileText className="h-5 w-5" /> Visualizar Boleto
 </button>
 )}
 {boletoData.barCode && (
 <button type="button" onClick={() => { navigator.clipboard.writeText(boletoData.barCode); toast.success("Código copiado!"); }}
 className="w-full h-12 rounded-2xl font-semibold text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 flex items-center justify-center gap-2 transition-all">
 <Copy className="h-4 w-4" /> Copiar código de barras
 </button>
 )}
 </div>
 )}

 <div className="text-center space-y-4">
 <div className="inline-flex items-center gap-2 text-xs text-gray-400 px-4 py-2 rounded-xl bg-gray-50 border border-gray-100">
 <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando pagamento automaticamente...
 </div>
 <div>
 <button className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors" onClick={retryPayment}>
 Cancelar e tentar outro método
 </button>
 </div>
 </div>
 </div>
 {checkoutRuntimeStyles}
 </div>
 );

 /* ══════════════════════════════════════════════════════ */
 /* ═══ FORMULÁRIO PRINCIPAL ═════════════════════════════ */
 /* ══════════════════════════════════════════════════════ */

 const inputClass = "mt-1.5 h-12 rounded-xl border border-[hsl(var(--checkout-border))] bg-[hsl(var(--checkout-bg-soft))] text-[hsl(var(--checkout-text))] placeholder:text-[hsl(var(--checkout-text-muted))]/50 focus:border-[color:var(--btn-color)] focus:ring-2 focus:ring-[color:var(--btn-color)]/15 transition-all duration-300 text-[16px] leading-tight font-medium";
 const sectionClass = "rounded-2xl border border-[hsl(var(--checkout-border))]/80 bg-[hsl(var(--checkout-bg-elevated))] overflow-hidden shadow-lg shadow-black/[0.03] transition-all duration-300 hover:shadow-xl hover:shadow-black/[0.05]";
 const sectionHeaderClass = "px-5 py-4 border-b border-[hsl(var(--checkout-border))]/60 flex items-center gap-3";
 const sectionBodyClass = "p-5 space-y-4";
 const labelClass = "text-[11px] text-[hsl(var(--checkout-text-muted))] font-semibold flex items-center gap-1.5 uppercase tracking-wider";

 return (
 <div data-checkout-theme={themeMode} className={`min-h-screen selection:bg-emerald-500/20 ${isDark ? "bg-[hsl(220_18%_11%)] text-[hsl(210_20%_96%)]" : isWhite ? "bg-[hsl(210_20%_98%)] text-gray-900" : "bg-[hsl(210_16%_94%)] text-gray-900"}`} style={checkoutThemeStyle}>
 <Seo
   title={`${product.name} — Checkout HOTZFY`}
   description={(product.description || `Compre ${product.name} com pagamento seguro via PIX, cartão ou boleto.`).slice(0, 155)}
   path={`/pay/${slug || ""}`}
   ogType="product"
   noindex
   jsonLd={{
     "@context": "https://schema.org",
     "@type": "Product",
     name: product.name,
     description: product.description || undefined,
     image: product.image_url || undefined,
     offers: { "@type": "Offer", price: product.price, priceCurrency: "BRL", availability: "https://schema.org/InStock" },
   }}
 />

 {/* ═══ Social Proof Toast ═══ */}
 {product.checkout_social_proof && <RecentPurchaseToast productName={product.name} color={btnColor} />}

 {/* ═══ Timer Bar (Premium) ═══ */}
 {product.checkout_timer_enabled && (
 <div className="sticky top-0 z-50 backdrop-blur-2xl border-b border-gray-200/50" style={{ backgroundColor: isDark ? "hsla(220, 18%, 11%, 0.95)" : "rgba(255,255,255,0.95)" }}>
 <div className="max-w-[660px] mx-auto px-4 py-2.5 flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: btnColor + "12" }}>
 <Zap className="h-3.5 w-3.5" style={{ color: btnColor }} />
 </div>
 <span className="text-xs font-semibold text-gray-500">Oferta expira em</span>
 </div>
 <div className="flex items-center gap-1 font-mono">
 <span className="rounded-lg px-3 py-1.5 text-base font-extrabold tabular-nums bg-gray-100 border border-gray-200/80 shadow-sm">{mins}</span>
 <span className="text-gray-300 font-bold mx-0.5 animate-pulse text-lg">:</span>
 <span className="rounded-lg px-3 py-1.5 text-base font-extrabold tabular-nums bg-gray-100 border border-gray-200/80 shadow-sm">{secs}</span>
 </div>
 </div>
 {/* Timer progress bar */}
 <div className="h-0.5 w-full bg-gray-100">
 <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${(timeLeft / ((product.checkout_timer_minutes ?? 15) * 60)) * 100}%`, backgroundColor: btnColor + "80" }} />
 </div>
 </div>
 )}

 {/* ═══ Banner ═══ */}
 {(product.checkout_banner_desktop_url || product.checkout_banner_mobile_url) && (
 <div className="w-full overflow-hidden">
 {product.checkout_banner_desktop_url && <img src={product.checkout_banner_desktop_url} alt="" className="w-full hidden md:block max-h-[280px] object-cover" />}
 {product.checkout_banner_mobile_url && <img src={product.checkout_banner_mobile_url} alt="" className="w-full md:hidden max-h-[180px] object-cover" />}
 {!product.checkout_banner_mobile_url && product.checkout_banner_desktop_url && <img src={product.checkout_banner_desktop_url} alt="" className="w-full md:hidden max-h-[180px] object-cover" />}
 </div>
 )}

 <div className="max-w-[660px] mx-auto px-4 py-6 md:py-10">

 {/* ═══ Social Proof Bar (Premium) ═══ */}
 {product.checkout_social_proof && (
 <div className="mb-5 rounded-2xl border border-gray-200/80 bg-white p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 shadow-lg shadow-black/[0.03]">
 <div className="flex items-center gap-3 flex-1">
 <div className="flex -space-x-2.5">
 {AVATAR_URLS.slice(0, 6).map((url, i) => (
 <img key={i} src={url} alt="" className="h-9 w-9 rounded-full border-[2.5px] border-white object-cover shadow-md" style={{ zIndex: 6 - i }} />
 ))}
 </div>
 <div>
 <p className="text-[13px] font-bold text-gray-700">
 <span style={{ color: btnColor }}>{socialCount}+ compradores</span> nas últimas 24h
 </p>
 <p className="text-[10px] text-gray-400 mt-0.5">Produto verificado • Alta demanda</p>
 </div>
 </div>
 <div className="flex items-center gap-4">
 <LiveViewers color={btnColor} />
 </div>
 </div>
 )}

 {/* ═══ Product Card (Premium) ═══ */}
 <div className={`rounded-2xl border bg-white p-5 mb-5 shadow-lg shadow-black/[0.03] transition-all ${isWhite ? "border-gray-100" : "border-gray-200/80"}`}>
 <div className="flex items-center gap-4">
 <div className="h-[76px] w-[76px] rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center justify-center shrink-0 overflow-hidden shadow-md shadow-black/5">
 {product.image_url ? (
 <img src={product.image_url} alt={product.name} className="h-[76px] w-[76px] rounded-2xl object-cover" />
 ) : (
 <div className="h-full w-full rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${btnColor}12, ${btnColor}05)` }}>
 <Sparkles className="h-8 w-8" style={{ color: btnColor + "50" }} />
 </div>
 )}
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 mb-1.5">
 <span className="text-[8px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200/80 text-gray-400 flex items-center gap-1">
 <Zap className="h-2.5 w-2.5" /> Acesso imediato
 </span>
 </div>
 <h1 className="font-bold text-base md:text-lg leading-tight text-gray-800">{product.name}</h1>
 {product.description && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{product.description}</p>}
 </div>
 <div className="text-right shrink-0">
 <p className="text-2xl font-extrabold tracking-tight" style={{ color: btnColor }}>
 R$ {fmtBRL(price)}
 </p>
 {product.checkout_credit_card_enabled && (
 <p className="text-[10px] text-gray-400 mt-0.5">ou 12x de R$ {fmtBRL(price * 1.2189 / 12)}</p>
 )}
 </div>
 </div>
 </div>

 {/* ═══ Step Progress ═══ */}
 <div className="mb-5">
 <StepIndicator current={1} total={totalSteps} color={btnColor} />
 </div>

 <form onSubmit={handlePay} className="space-y-4">
 {/* ═══════ DADOS PESSOAIS ═══════ */}
 <section className={sectionClass}>
 <div className={sectionHeaderClass}>
 <div className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-extrabold text-white shadow-md" style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}bb)`, boxShadow: `0 4px 12px -4px ${btnColor}40` }}>1</div>
 <div>
 <h3 className="text-sm font-bold text-gray-800">Identificação</h3>
 <p className="text-[10px] text-gray-400">Preencha seus dados para continuar</p>
 </div>
 <div className="ml-auto flex items-center gap-1">
 <Lock className="h-3 w-3 text-gray-300" />
 <span className="text-[8px] text-gray-300 font-semibold">SEGURO</span>
 </div>
 </div>
 <div className={sectionBodyClass}>
 <div>
 <Label className={labelClass}><User className="h-3 w-3" /> Nome completo</Label>
 <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" required className={inputClass} autoComplete="name" />
 </div>
 <div className={product.checkout_email_confirm ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : ""}>
 <div>
 <Label className={labelClass}><Mail className="h-3 w-3" /> E-mail</Label>
 <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required type="email" className={inputClass} autoComplete="email" />
 </div>
 {product.checkout_email_confirm && (
 <div>
 <Label className={labelClass}>Confirme o e-mail</Label>
 <Input value={emailConfirm} onChange={e => setEmailConfirm(e.target.value)} placeholder="Confirme seu e-mail" required type="email" className={inputClass} />
 </div>
 )}
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <Label className={labelClass}><FileDigit className="h-3 w-3" /> CPF / CNPJ</Label>
 <Input value={document} onChange={e => setDocument(formatCpf(e.target.value))} placeholder="000.000.000-00" required className={inputClass} inputMode="numeric" autoComplete="off" />
 </div>
 <div>
 <Label className={labelClass}><Phone className="h-3 w-3" /> WhatsApp</Label>
 <Input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" required className={inputClass} inputMode="tel" autoComplete="tel" />
 </div>
 </div>
 </div>
 </section>

 {/* ═══════ ENDEREÇO ═══════ */}
 {product.checkout_address_required && (
 <section className={sectionClass}>
 <div className={sectionHeaderClass}>
 <div className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-extrabold text-white shadow-md" style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}bb)`, boxShadow: `0 4px 12px -4px ${btnColor}40` }}>2</div>
 <div><h3 className="text-sm font-bold text-gray-800">Endereço</h3><p className="text-[10px] text-gray-400">Para emissão da nota fiscal</p></div>
 </div>
 <div className={sectionBodyClass}>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <Label className={labelClass}>CEP</Label>
 <div className="relative">
 <Input value={cep} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" required className={inputClass} inputMode="numeric" />
 {loadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400 mt-1" />}
 </div>
 </div>
 <div>
 <Label className={labelClass}>Bairro</Label>
 <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Bairro" required className={inputClass} />
 </div>
 </div>
 <div>
 <Label className={labelClass}>Rua</Label>
 <Input value={street} onChange={e => setStreet(e.target.value)} placeholder="Rua / Avenida" required className={inputClass} />
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
 <div>
 <Label className={labelClass}>Número</Label>
 <Input value={number_} onChange={e => setNumber_(e.target.value)} placeholder="Nº" required className={inputClass} inputMode="numeric" />
 </div>
 <div>
 <Label className={labelClass}>Complemento</Label>
 <Input value={complement} onChange={e => setComplement(e.target.value)} placeholder="Apto, sala..." className={inputClass} />
 </div>
 <div className="col-span-2 sm:col-span-1">
 <Label className={labelClass}>Cidade / UF</Label>
 <Input value={city && state ? `${city} - ${state}` : ""} readOnly placeholder="Preenchido via CEP" className={inputClass + " !bg-gray-100 !text-gray-400"} />
 </div>
 </div>
 </div>
 </section>
 )}

 {/* ═══════ ORDER BUMPS (Persuasive Premium) ═══════ */}
 {orderBumps.length > 0 && (
 <div className="space-y-3">
 <div className="flex items-center gap-2 px-1">
 <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: btnColor + "15" }}>
 <Sparkles className="h-3.5 w-3.5" style={{ color: btnColor }} />
 </div>
 <div>
 <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: btnColor }}>Oferta exclusiva</span>
 <p className="text-[9px] text-gray-400 font-medium">Aproveite antes que acabe!</p>
 </div>
 <div className="flex-1 h-px" style={{ backgroundColor: btnColor + "15" }} />
 </div>
 {orderBumps.map(bump => {
 const selected = selectedBumps.has(bump.id);
 return (
 <button key={bump.id} type="button" onClick={() => toggleBump(bump.id)}
 className="w-full rounded-2xl border-2 p-4 md:p-5 text-left transition-all duration-300 relative overflow-hidden group"
 style={{
 borderColor: selected ? "#10b98180" : btnColor + "30",
 borderStyle: selected ? "solid" : "dashed",
 background: selected
 ? "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))"
 : `linear-gradient(135deg, ${btnColor}08, ${btnColor}03)`,
 boxShadow: selected ? "0 4px 16px -4px rgba(16,185,129,0.15)" : undefined,
 }}
 >
 {/* Badge */}
 {selected ? (
 <div className="absolute top-0 right-0 text-white text-[8px] font-extrabold px-3 py-1.5 rounded-bl-xl bg-emerald-500 shadow-sm">
 ADICIONADO ✓
 </div>
 ) : (
 <div className="absolute top-0 right-0 text-white text-[8px] font-extrabold px-3 py-1.5 rounded-bl-xl animate-pulse" style={{ backgroundColor: btnColor }}>
 APROVEITE!
 </div>
 )}
 <div className="flex items-center gap-4">
 <div className="h-16 w-16 rounded-xl border border-gray-200/80 flex items-center justify-center shrink-0 overflow-hidden shadow-md shadow-black/5 bg-white">
 {bump.bump_product.image_url ? (
 <img src={bump.bump_product.image_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
 ) : (
 <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: btnColor + "08" }}>
 <Package className="h-6 w-6" style={{ color: btnColor + "40" }} />
 </div>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-sm leading-tight text-gray-800">{bump.bump_product.name}</p>
 {bump.bump_product.description && <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{bump.bump_product.description}</p>}
 <p className="font-extrabold text-base mt-1.5" style={{ color: selected ? "#10b981" : btnColor }}>
 + R$ {fmtBRL(Number(bump.bump_product.price))}
 </p>
 </div>
 <div
 className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
 style={{
 backgroundColor: selected ? "#10b981" : btnColor + "10",
 borderWidth: selected ? 0 : 2,
 borderColor: btnColor + "25",
 color: selected ? "white" : btnColor,
 boxShadow: selected ? "0 4px 12px -4px rgba(16,185,129,0.3)" : undefined,
 transform: selected ? "scale(1.05)" : undefined,
 }}
 >
 {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
 </div>
 </div>
 </button>
 );
 })}
 </div>
 )}

 {/* ═══════ PAGAMENTO (Premium) ═══════ */}
 <section className={sectionClass}>
 <div className={sectionHeaderClass}>
 <div className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-extrabold text-white shadow-md" style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}bb)`, boxShadow: `0 4px 12px -4px ${btnColor}40` }}>
 {product.checkout_address_required ? "3" : "2"}
 </div>
 <div>
 <h3 className="text-sm font-bold text-gray-800">Pagamento</h3>
 <p className="text-[10px] text-gray-400">Escolha a forma de pagamento</p>
 </div>
 <div className="ml-auto flex items-center gap-1.5">
 <Lock className="h-3 w-3 text-gray-300" />
 <span className="text-[8px] text-gray-300 font-bold tracking-wider">SSL 256-BIT</span>
 </div>
 </div>

 <div className={sectionBodyClass}>
 {/* Method Tabs (Premium) */}
 {availableMethods.length > 1 && (
 <div className="grid gap-2.5 p-1 rounded-xl bg-gray-50 border border-gray-100" style={{ gridTemplateColumns: `repeat(${availableMethods.length}, 1fr)` }}>
 {availableMethods.map(m => {
 const active = method === m.id;
 return (
 <button key={m.id} type="button" onClick={() => { setMethod(m.id); setPixData(null); setBoletoData(null); }}
 className={`flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl text-center transition-all duration-300 ${
 active ? "bg-white shadow-md shadow-black/5 text-gray-800" : "bg-transparent text-gray-400 hover:text-gray-500 hover:bg-white/50"
 }`}
 style={active ? { boxShadow: `0 2px 12px -2px ${btnColor}15` } : undefined}>
 <m.icon className={`h-5 w-5 transition-all ${active ? "" : "opacity-40"}`} style={active ? { color: btnColor } : undefined} />
 <span className="text-xs font-bold">{m.label}</span>
 {m.badge && <span className={`text-[8px] font-medium ${active ? "text-gray-400" : "text-gray-300"}`}>{m.badge}</span>}
 </button>
 );
 })}
 </div>
 )}

 {/* PIX indicator */}
 {method === "pix" && (
 <div className="rounded-xl p-4 border border-gray-100 bg-gradient-to-br from-gray-50 to-white flex items-center gap-4">
 <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-md" style={{ backgroundColor: btnColor + "10", boxShadow: `0 4px 12px -4px ${btnColor}20` }}>
 <QrCode className="h-6 w-6" style={{ color: btnColor }} />
 </div>
 <div>
 <p className="text-sm font-bold text-gray-800 flex items-center gap-2">Pagamento instantâneo <Zap className="h-3.5 w-3.5" style={{ color: btnColor }} /></p>
 <p className="text-[11px] text-gray-400 mt-0.5">QR Code gerado na hora • Aprovação em segundos</p>
 </div>
 </div>
 )}

 {/* Credit Card fields */}
 {method === "credit_card" && (
 <div className="space-y-4">
 <div>
 <Label className={labelClass}>Número do cartão</Label>
 <Input value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" required className={inputClass} inputMode="numeric" />
 </div>
 <div className="grid grid-cols-3 gap-3">
 <div>
 <Label className={labelClass}>Validade</Label>
 <Input value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" required className={inputClass} inputMode="numeric" />
 </div>
 <div>
 <Label className={labelClass}>CVV</Label>
 <Input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" required className={inputClass} inputMode="numeric" />
 </div>
 <div>
 <Label className={labelClass}>Parcelas</Label>
 <div className="relative mt-1.5">
 <select value={installments} onChange={e => setInstallments(e.target.value)} className="w-full h-12 rounded-xl border bg-[hsl(var(--checkout-bg-soft))] border-[hsl(var(--checkout-border))] text-[hsl(var(--checkout-text))] text-[16px] px-3 pr-8 appearance-none focus:outline-none focus:ring-2 focus:border-[color:var(--btn-color)] font-medium transition-all duration-300" >
 {installmentOptions.map(opt => <option key={opt.n} value={opt.n}>{opt.n}x R$ {opt.val.toFixed(2)}</option>)}
 </select>
 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
 </div>
 </div>
 </div>
 <div>
 <Label className={labelClass}>Nome do titular</Label>
 <Input value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())} placeholder="NOME IMPRESSO NO CARTÃO" required className={inputClass} />
 </div>
 </div>
 )}

 {/* Boleto indicator */}
 {method === "boleto" && (
 <div className="rounded-xl p-4 border border-gray-100 bg-gradient-to-br from-gray-50 to-white flex items-center gap-4">
 <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/10">
 <FileText className="h-6 w-6 text-amber-500" />
 </div>
 <div>
 <p className="text-sm font-bold text-gray-800">Boleto Bancário</p>
 <p className="text-[11px] text-gray-400 mt-0.5">Compensação em 1-3 dias úteis</p>
 </div>
 </div>
 )}
 </div>
 </section>

 {/* ═══════ RESUMO (Premium) ═══════ */}
 <div className="rounded-2xl border border-gray-200/80 bg-white p-5 space-y-3 shadow-lg shadow-black/[0.03]">
 <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-3 flex items-center gap-2">
 <Package className="h-3 w-3" /> Resumo do pedido
 </h3>
 <div className="space-y-3 text-sm">
 <div className="flex justify-between items-center">
 <span className="text-gray-400 flex items-center gap-2">{product.name}</span>
 <span className="text-gray-700 font-semibold tabular-nums">R$ {fmtBRL(price)}</span>
 </div>
 {orderBumps.filter(b => selectedBumps.has(b.id)).map(b => (
 <div key={b.id} className="flex justify-between items-center">
 <span className="text-gray-400 flex items-center gap-2"><Plus className="h-3 w-3" style={{ color: btnColor }} /> {b.bump_product.name}</span>
 <span className="text-gray-700 font-semibold tabular-nums">R$ {fmtBRL(Number(b.bump_product.price))}</span>
 </div>
 ))}
 {/* Cupom */}
 <div className="border-t border-gray-100 pt-3">
   {appliedCoupon ? (
     <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
       <div className="flex items-center gap-2 min-w-0">
         <Ticket className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
         <span className="text-xs font-bold text-emerald-700 truncate">{appliedCoupon.code}</span>
         <span className="text-[10px] text-emerald-600">−R$ {fmtBRL(discountValue)}</span>
       </div>
       <button
         type="button"
         onClick={() => { setAppliedCoupon(null); setCouponInput(""); }}
         className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900"
       >Remover</button>
     </div>
   ) : (
     <div className="flex gap-2">
       <input
         type="text"
         value={couponInput}
         onChange={(e) => setCouponInput(e.target.value.toUpperCase().replace(/\s/g, ""))}
         placeholder="Cupom de desconto"
         className="flex-1 h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-mono font-bold text-gray-700 placeholder:font-sans placeholder:font-medium placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
       />
       <button
         type="button"
         disabled={!couponInput.trim() || couponApplying}
         onClick={async () => {
           if (!couponInput.trim() || !product) return;
           setCouponApplying(true);
           try {
             const { data, error } = await supabase.rpc("validate_coupon", {
               _code: couponInput.trim(),
               _product_id: product.id,
               _amount: price,
             });
             const row = Array.isArray(data) ? data[0] : data;
             if (error || !row?.valid) {
               toast.error(row?.error || "Cupom inválido");
             } else {
               setAppliedCoupon({
                 code: couponInput.trim().toUpperCase(),
                 coupon_id: row.coupon_id,
                 discount_amount: Number(row.discount_amount),
                 apply_to_bumps: !!row.apply_to_bumps,
                 discount_type: row.discount_type,
                 discount_value: Number(row.discount_value),
               });
               toast.success("Cupom aplicado!");
             }
           } catch {
             toast.error("Erro ao validar cupom");
           } finally {
             setCouponApplying(false);
           }
         }}
         className="h-9 px-4 rounded-lg text-xs font-bold text-white disabled:opacity-50 transition-opacity"
         style={{ backgroundColor: btnColor }}
       >{couponApplying ? "..." : "Aplicar"}</button>
     </div>
   )}
 </div>

 {discountValue > 0 && (
   <div className="flex justify-between items-center text-xs">
     <span className="text-gray-400">Desconto</span>
     <span className="text-emerald-600 font-semibold tabular-nums">− R$ {fmtBRL(discountValue)}</span>
   </div>
 )}

 <div className="border-t border-gray-100 pt-3 flex justify-between items-center">

 <span className="font-bold text-gray-800 text-base">Total</span>
 <div className="text-right">
 <span className="font-extrabold text-xl tracking-tight tabular-nums" style={{ color: btnColor }}>
 {method === "credit_card" && installments !== "1"
 ? `${installments}x R$ ${fmtBRL(selectedInstallment.val)}`
 : `R$ ${fmtBRL(totalPrice)}`}
 </span>
 {method === "credit_card" && installments !== "1" && (
 <p className="text-[10px] text-gray-300 mt-0.5 tabular-nums">Total: R$ {fmtBRL(selectedInstallment.total)}</p>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* ═══════ GUARANTEE (Premium) ═══════ */}
 {product.checkout_guarantee_enabled && (
 <div className="rounded-2xl p-5 border border-gray-200/80 bg-gradient-to-br from-white to-gray-50 flex items-center gap-4 shadow-lg shadow-black/[0.03]">
 <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md" style={{ backgroundColor: btnColor + "08", border: `1px solid ${btnColor}15`, boxShadow: `0 4px 12px -4px ${btnColor}15` }}>
 <ShieldCheck className="h-7 w-7" style={{ color: btnColor }} />
 </div>
 <div>
 <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
 Garantia incondicional de 7 dias
 </p>
 <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
 Não ficou satisfeito? Devolvemos 100% do valor. Sem burocracia.
 </p>
 </div>
 </div>
 )}

 {/* ═══════ CTA BUTTON (Ultra Premium) ═══════ */}
 <div className="pt-1">
 <Button
 type="submit"
 disabled={processing}
 className="w-full h-[62px] text-base font-extrabold rounded-2xl text-white transition-all duration-300 hover:opacity-95 hover:scale-[1.008] active:scale-[0.995] disabled:opacity-50 disabled:hover:scale-100 relative overflow-hidden group"
 style={{ backgroundColor: btnColor, boxShadow: `0 12px 40px -12px ${btnColor}60, 0 4px 12px -4px ${btnColor}30` }}
 >
 {/* Shimmer effect */}
 <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
 </div>
 <span className="relative flex items-center gap-2.5">
 {processing ? (
 <><Loader2 className="h-5 w-5 animate-spin" /> Processando pagamento...</>
 ) : (
 <>
 <Lock className="h-4 w-4 opacity-80" />
 Finalizar compra
 <span className="opacity-50">•</span>
 <span className="tabular-nums">R$ {fmtBRL(totalPrice)}</span>
 <ArrowRight className="h-4 w-4 opacity-70" />
 </>
 )}
 </span>
 </Button>
 </div>

 {/* ═══════ TRUST FOOTER (Premium) ═══════ */}
 <div className="space-y-4 pt-2">
 <div className="flex items-center justify-center gap-5">
 <div className="flex items-center gap-1.5 text-gray-300">
 <Lock className="h-3.5 w-3.5" />
 <span className="text-[10px] font-semibold">SSL 256-bit</span>
 </div>
 <div className="h-3 w-px bg-gray-200" />
 <div className="flex items-center gap-1.5 text-gray-300">
 <ShieldCheck className="h-3.5 w-3.5" />
 <span className="text-[10px] font-semibold">Compra 100% segura</span>
 </div>
 <div className="h-3 w-px bg-gray-200" />
 <div className="flex items-center gap-1.5 text-gray-300">
 <Eye className="h-3.5 w-3.5" />
 <span className="text-[10px] font-semibold">Dados protegidos</span>
 </div>
 </div>
 {(product.display_name || product.support_email) && (
 <div className="flex flex-col items-center gap-1 py-2.5 border-t border-gray-100">
 {product.display_name && (
 <span className="text-[11px] font-semibold text-gray-400">{product.display_name}</span>
 )}
 {product.support_email && (
 <a href={`mailto:${product.support_email}`} className="text-[10px] text-gray-300 hover:text-gray-500 underline transition-colors">
 {product.support_email}
 </a>
 )}
 </div>
 )}
 <p className="text-center text-[10px] text-gray-300 leading-relaxed px-6">
 Ao clicar em "Finalizar compra", declaro que li e concordo com os{" "}
 <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline cursor-pointer hover:text-gray-500 transition-colors">Termos de Uso</a> e{" "}
 <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline cursor-pointer hover:text-gray-500 transition-colors">Política de Privacidade</a>.
 </p>
 </div>
 </form>
 </div>

 {checkoutRuntimeStyles}
 </div>
 );
}
