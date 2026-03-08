import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard, QrCode, FileText, CheckCircle2, Copy, Clock, Loader2,
  RefreshCw, ShieldCheck, ChevronDown, User, Mail, FileDigit, Phone,
  Sparkles, Plus, Package, Lock, Eye, Zap, Star, TrendingUp,
  ArrowRight, Check, AlertCircle, Users, Timer, Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { initPixels, firePixelEvent, type PixelConfig } from "@/lib/pixelTracking";

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

/* ─── Live Viewer Counter Component ─── */
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
      <span className="text-[11px] font-semibold text-white/50">
        <strong className="text-white/80">{count}</strong> pessoas vendo agora
      </span>
    </div>
  );
}

/* ─── Recent Purchase Toast ─── */
function RecentPurchaseToast({ productName, color }: { productName: string; color: string }) {
  const [visible, setVisible] = useState(false);
  const [buyer, setBuyer] = useState({ name: "", city: "", ago: 0 });

  useEffect(() => {
    const show = () => {
      setBuyer({
        name: BUYER_NAMES[Math.floor(Math.random() * BUYER_NAMES.length)],
        city: CITIES[Math.floor(Math.random() * CITIES.length)],
        ago: Math.floor(Math.random() * 15) + 1,
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
      <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-3.5 shadow-2xl shadow-black/40 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "20" }}>
          <Check className="h-5 w-5" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-white truncate">{buyer.name} de {buyer.city}</p>
          <p className="text-[10px] text-white/40">Comprou há {buyer.ago} min • <span style={{ color }}>{productName}</span></p>
        </div>
      </div>
    </div>
  );
}

/* ─── Step Indicator ─── */
function StepIndicator({ current, total, color }: { current: number; total: number; color: string }) {
  return (
    <div className="flex items-center gap-1 w-full">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex-1 flex items-center gap-1">
            <div className="flex-1 h-1 rounded-full overflow-hidden bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: isDone ? "100%" : isActive ? "50%" : "0%",
                  backgroundColor: isDone || isActive ? color : "transparent",
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
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("credit_card");
  const [processing, setProcessing] = useState(false);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("form");
  const processingRef = useRef(false);

  const [pixData, setPixData] = useState<any>(null);
  const [boletoData, setBoletoData] = useState<any>(null);
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

  // Load product, pixels, and bumps in parallel for minimal latency
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function loadCheckoutData() {
      // Step 1: Load product first (required for step 2)
      const { data: prod } = await supabase
        .from("products_public")
        .select("*")
        .or(`checkout_url.eq.${slug},checkout_url.eq./${slug}`)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!prod) { setLoading(false); return; }
      setProduct(prod as unknown as Product);

      // Step 2: Load pixels + bumps in parallel (both need product.id)
      const [pixelsRes, bumpsRes] = await Promise.all([
        supabase.from("product_pixels_public" as any).select("*").eq("product_id", prod.id).eq("is_active", true),
        supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", prod.id).eq("is_active", true).order("sort_order"),
      ]);

      if (cancelled) return;

      // Process pixels
      if (pixelsRes.data && pixelsRes.data.length > 0) {
        const configs: PixelConfig[] = pixelsRes.data.map((d: any) => ({ ...d, events: Array.isArray(d.events) ? d.events : [] }));
        setProductPixels(configs);
        if (!pixelsInitialized.current) {
          initPixels(configs); pixelsInitialized.current = true;
          setTimeout(() => {
            firePixelEvent(configs, "PageView", { content_name: prod.name!, content_id: prod.id!, value: Number(prod.price) });
            firePixelEvent(configs, "ViewContent", { content_name: prod.name!, content_id: prod.id!, value: Number(prod.price) });
          }, 300);
        }
      }

      // Process bumps
      if (bumpsRes.data && bumpsRes.data.length > 0) {
        const bumpIds = bumpsRes.data.map(b => b.bump_product_id);
        const { data: bumpProducts } = await supabase.from("products_public").select("id, name, description, price, image_url").in("id", bumpIds);
        if (!cancelled && bumpProducts) {
          setOrderBumps(bumpsRes.data.map(b => ({
            id: b.id, bump_product_id: b.bump_product_id,
            bump_product: bumpProducts.find(p => p.id === b.bump_product_id) as any,
          })).filter(b => b.bump_product));
        }
      }

      setLoading(false);
    }

    loadCheckoutData();
    return () => { cancelled = true; };
  }, [slug]);

  // Set default method
  useEffect(() => {
    if (!product) return;
    if (product.checkout_pix_enabled) setMethod("pix");
    else if (product.checkout_credit_card_enabled) setMethod("credit_card");
    else if (product.checkout_boleto_enabled) setMethod("boleto");
  }, [product]);

  // Body overflow
  useEffect(() => {
    window.document.body.style.overflow = "auto";
    window.document.body.style.overscrollBehavior = "auto";
    return () => { window.document.body.style.overflow = "hidden"; window.document.body.style.overscrollBehavior = "none"; };
  }, []);

  // Poll transaction status with adaptive interval
  useEffect(() => {
    if (checkoutState !== "pending" || !transactionId) return;
    let pollCount = 0;
    const interval = setInterval(async () => {
      pollCount++;
      const { data } = await supabase.from("transactions").select("status").eq("id", transactionId).single();
      if (data?.status === "completed") {
        setCheckoutState("approved"); clearCheckoutSession(slug || ""); clearInterval(interval);
        if (product) firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: Number(product.price), session_key: slug || "default" });
      } else if (data?.status === "failed" || data?.status === "cancelled") {
        setCheckoutState("failed"); clearCheckoutSession(slug || ""); clearInterval(interval);
      }
      // After 60 polls (5min), slow down to 15s
    }, pollCount > 60 ? 15000 : 5000);
    return () => clearInterval(interval);
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

  // ─── Payment Handler ───
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || processingRef.current) return;
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
      };
      if (method === "credit_card") { payload.installments = parseInt(installments); payload.cardToken = null; }
      const { data, error } = await supabase.functions.invoke("podpay-create-transaction", { body: payload });
      if (error || !data?.success) { toast.error("Não foi possível processar. Tente novamente."); setCheckoutState("failed"); return; }
      const result = data.data;
      setTransactionId(result.transactionId);
      if (data.resumed) { if (result.pix) setPixData(result.pix); if (result.boleto) setBoletoData(result.boleto); setCheckoutState("pending"); return; }
      if (method === "pix" && result.pix) {
        setPixData(result.pix); setCheckoutState("pending");
        firePixelEvent(productPixels, "PixGenerated", { content_name: product.name, content_id: product.id, value: totalPrice });
      } else if (method === "boleto" && result.boleto) {
        setBoletoData(result.boleto); setCheckoutState("pending");
        firePixelEvent(productPixels, "BoletoGenerated", { content_name: product.name, content_id: product.id, value: totalPrice });
      } else if (method === "credit_card") {
        if (result.status === "paid" || result.status === "approved") {
          setCheckoutState("approved"); clearCheckoutSession(slug || "");
          firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: totalPrice, session_key: sessionKey });
        } else if (result.secureUrl) { window.location.href = result.secureUrl; }
        else { setCheckoutState("approved"); clearCheckoutSession(slug || ""); firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: totalPrice, session_key: sessionKey }); }
      } else { setCheckoutState("approved"); clearCheckoutSession(slug || ""); firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: totalPrice, session_key: sessionKey }); }
    } catch { toast.error("Instabilidade na rede. Tente novamente."); setCheckoutState("failed"); }
    finally { setProcessing(false); processingRef.current = false; }
  };

  const retryPayment = () => { clearCheckoutSession(slug || ""); setCheckoutState("form"); setPixData(null); setBoletoData(null); setTransactionId(null); };

  /* ─── Loading / Not found ─── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 animate-pulse" />
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-white/30 text-sm">Carregando checkout seguro...</p>
      </div>
    </div>
  );

  if (!product) return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080a] text-white px-4">
      <div className="text-center">
        <div className="h-20 w-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-10 w-10 text-white/20" />
        </div>
        <h1 className="text-xl font-bold mb-2">Produto não encontrado</h1>
        <p className="text-sm text-white/40">Verifique o link e tente novamente.</p>
      </div>
    </div>
  );

  /* ─── Computed values ─── */
  const price = Number(product.price);
  const bumpsTotal = orderBumps.filter(b => selectedBumps.has(b.id)).reduce((s, b) => s + Number(b.bump_product.price), 0);
  const totalPrice = price + bumpsTotal;
  const btnColor = product.checkout_button_color || "#10b981";
  const installmentOptions = Array.from({ length: 12 }, (_, i) => { const n = i + 1; const val = n === 1 ? totalPrice : totalPrice * (1 + 0.0199 * (n - 1)) / n; return { n, val, total: n === 1 ? totalPrice : val * n }; });
  const selectedInstallment = installmentOptions[parseInt(installments) - 1];

  const availableMethods: { id: PaymentMethod; icon: any; label: string; badge?: string }[] = [];
  if (product.checkout_pix_enabled) availableMethods.push({ id: "pix", icon: QrCode, label: "PIX", badge: "Aprovação instantânea" });
  if (product.checkout_credit_card_enabled) availableMethods.push({ id: "credit_card", icon: CreditCard, label: "Cartão", badge: "Até 12x" });
  if (product.checkout_boleto_enabled) availableMethods.push({ id: "boleto", icon: FileText, label: "Boleto", badge: "1-3 dias úteis" });

  const totalSteps = product.checkout_address_required ? 3 : 2;

  /* ══════════════════════════════════════════════════════ */
  /* ═══ TELA: APROVADO ═══════════════════════════════════ */
  /* ══════════════════════════════════════════════════════ */
  if (checkoutState === "approved") return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#08080a] text-white">
      <div className="text-center animate-fade-in max-w-md w-full">
        {/* Confetti-like effect */}
        <div className="relative mx-auto mb-8 w-28 h-28">
          <div className="absolute inset-0 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: btnColor + "30" }} />
          <div className="absolute inset-2 rounded-full blur-xl animate-pulse" style={{ backgroundColor: btnColor + "20", animationDelay: "0.5s" }} />
          <div className="relative h-28 w-28 rounded-full flex items-center justify-center shadow-2xl" style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}cc)` }}>
            <CheckCircle2 className="h-14 w-14 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold mb-3 tracking-tight">Pagamento Confirmado! 🎉</h1>
        <p className="text-white/50 mb-8 text-base">
          Seu acesso foi liberado com sucesso.
        </p>
        <div className="rounded-2xl p-6 bg-white/[0.04] border border-white/10 mb-6 text-left space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-white/40 text-sm">Produto</span>
            <span className="font-bold">{product.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/40 text-sm">Valor</span>
            <span className="font-extrabold text-lg" style={{ color: btnColor }}>R$ {fmtBRL(totalPrice)}</span>
          </div>
        </div>
        <p className="text-xs text-white/25">📧 Confirmação enviada para <strong className="text-white/50">{email}</strong></p>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════ */
  /* ═══ TELA: FALHA ══════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════ */
  if (checkoutState === "failed") return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#08080a] text-white">
      <div className="text-center animate-fade-in max-w-md w-full">
        <div className="relative mx-auto mb-8 w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-red-500/20 blur-2xl animate-pulse" />
          <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-2xl">
            <AlertCircle className="h-12 w-12 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-extrabold mb-2">Pagamento não aprovado</h1>
        <p className="text-white/40 mb-8 text-sm">Verifique seus dados ou tente outro método de pagamento.</p>
        <Button onClick={retryPayment} className="h-13 px-10 rounded-xl text-white font-bold text-base gap-2 hover:opacity-90 shadow-xl" style={{ backgroundColor: btnColor }}>
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </Button>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════ */
  /* ═══ TELA: PENDENTE (PIX/BOLETO) ═════════════════════ */
  /* ══════════════════════════════════════════════════════ */
  if (checkoutState === "pending") return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <div className="max-w-lg mx-auto px-4 py-8 md:py-14">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden">
            {product.image_url ? <img src={product.image_url} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <Sparkles className="h-6 w-6 text-white/20" />}
          </div>
          <div>
            <h2 className="font-bold text-lg">{product.name}</h2>
            <p className="font-extrabold text-xl" style={{ color: btnColor }}>R$ {fmtBRL(totalPrice)}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl border" style={{ backgroundColor: btnColor + "10", borderColor: btnColor + "25" }}>
            <Timer className="h-4 w-4 animate-pulse" style={{ color: btnColor }} />
            <span className="text-sm font-bold" style={{ color: btnColor }}>Aguardando pagamento</span>
          </div>
        </div>

        {/* PIX */}
        {pixData && (
          <div className="rounded-3xl p-6 md:p-8 bg-white/[0.03] border border-white/[0.08] mb-6 space-y-6">
            <div className="text-center">
              <h3 className="font-bold text-lg flex items-center justify-center gap-2 mb-1" style={{ color: btnColor }}>
                <QrCode className="h-5 w-5" /> PIX
              </h3>
              <p className="text-xs text-white/30">Escaneie o QR Code ou copie o código</p>
            </div>

            {(pixData.qrcode || pixData.qrCode || pixData.qrCodeText) && (
              <div className="flex justify-center">
                <div className="bg-white p-5 rounded-3xl shadow-2xl shadow-black/20">
                  <QRCodeSVG value={pixData.qrcode || pixData.qrCodeText || pixData.qrCode} size={220} />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-white/30 justify-center">
              <Clock className="h-3.5 w-3.5" /> Expira em 30 minutos
            </div>

            {(pixData.qrcode || pixData.qrCodeText) && (
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(pixData.qrcode || pixData.qrCodeText); setCopiedPix(true); toast.success("Código PIX copiado!"); setTimeout(() => setCopiedPix(false), 3000); }}
                className="w-full flex items-center justify-center gap-2.5 h-14 rounded-2xl font-bold text-base transition-all"
                style={{
                  backgroundColor: copiedPix ? "#10b981" : btnColor,
                  color: "white",
                }}
              >
                {copiedPix ? <><Check className="h-5 w-5" /> Código copiado!</> : <><Copy className="h-5 w-5" /> Copiar código PIX</>}
              </button>
            )}
          </div>
        )}

        {/* Boleto */}
        {boletoData && (
          <div className="rounded-3xl p-6 md:p-8 bg-white/[0.03] border border-white/[0.08] mb-6 space-y-4">
            <h3 className="text-center font-bold text-lg" style={{ color: btnColor }}>Boleto gerado com sucesso</h3>
            {boletoData.url && (
              <button type="button" onClick={() => window.open(boletoData.url, "_blank")}
                className="w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all"
                style={{ backgroundColor: btnColor }}>
                <FileText className="h-5 w-5" /> Visualizar Boleto
              </button>
            )}
            {boletoData.barCode && (
              <button type="button" onClick={() => { navigator.clipboard.writeText(boletoData.barCode); toast.success("Código copiado!"); }}
                className="w-full h-12 rounded-2xl font-semibold text-sm bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white flex items-center justify-center gap-2">
                <Copy className="h-4 w-4" /> Copiar código de barras
              </button>
            )}
          </div>
        )}

        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-white/25">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando automaticamente...
          </div>
          <button className="text-xs text-white/30 hover:text-white/60 underline transition-colors" onClick={retryPayment}>
            Cancelar e tentar outro método
          </button>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════ */
  /* ═══ FORMULÁRIO PRINCIPAL ═════════════════════════════ */
  /* ══════════════════════════════════════════════════════ */

  const inputClass = "mt-1.5 h-12 rounded-xl bg-[#111114] border-[#1e1e24] text-white placeholder:text-white/15 focus:border-[color:var(--btn-color)]/60 focus:ring-2 focus:ring-[color:var(--btn-color)]/15 transition-all text-[16px] leading-tight font-medium";
  const sectionClass = "rounded-2xl border border-white/[0.06] bg-[#0e0e11] overflow-hidden";
  const sectionHeaderClass = "px-5 py-4 border-b border-white/[0.04] flex items-center gap-3";
  const sectionBodyClass = "p-5 space-y-4";
  const labelClass = "text-[11px] text-white/40 font-semibold flex items-center gap-1.5 uppercase tracking-wider";

  return (
    <div className="min-h-screen bg-[#08080a] text-white selection:bg-emerald-500/30" style={{ "--btn-color": btnColor } as React.CSSProperties}>

      {/* ═══ Social Proof Toast ═══ */}
      {product.checkout_social_proof && <RecentPurchaseToast productName={product.name} color={btnColor} />}

      {/* ═══ Timer Bar ═══ */}
      {product.checkout_timer_enabled && (
        <div className="sticky top-0 z-50 backdrop-blur-2xl border-b border-white/[0.04]" style={{ backgroundColor: "#08080af0" }}>
          <div className="max-w-[660px] mx-auto px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: btnColor + "15" }}>
                <Zap className="h-3.5 w-3.5" style={{ color: btnColor }} />
              </div>
              <span className="text-xs font-semibold text-white/60">Oferta especial expira em</span>
            </div>
            <div className="flex items-center gap-1 font-mono">
              <span className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1 text-base font-extrabold tabular-nums">{mins}</span>
              <span className="text-white/20 font-bold mx-0.5 animate-pulse">:</span>
              <span className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1 text-base font-extrabold tabular-nums">{secs}</span>
            </div>
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

        {/* ═══ Social Proof Bar ═══ */}
        {product.checkout_social_proof && (
          <div className="mb-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex -space-x-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-[#0e0e11] flex items-center justify-center text-[9px] font-bold shadow-lg" style={{ backgroundColor: `hsl(${150 + i * 12}, 55%, ${28 + i * 5}%)`, zIndex: 6 - i }}>
                    {["AS", "CM", "JR", "PH", "ML", "LF"][i]}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[13px] font-bold text-white/80">
                  🔥 <span style={{ color: btnColor }}>{socialCount}+ compradores</span> nas últimas 24h
                </p>
                <p className="text-[10px] text-white/25 mt-0.5">Produto verificado • Alta demanda</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <LiveViewers color={btnColor} />
            </div>
          </div>
        )}

        {/* ═══ Product Card ═══ */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e11] p-5 mb-5">
          <div className="flex items-center gap-4">
            <div className="h-[72px] w-[72px] rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-[72px] w-[72px] rounded-2xl object-cover" />
              ) : (
                <div className="h-full w-full rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${btnColor}15, ${btnColor}05)` }}>
                  <Sparkles className="h-8 w-8" style={{ color: btnColor + "60" }} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-white/30">Acesso imediato</span>
              </div>
              <h1 className="font-bold text-base md:text-lg leading-tight">{product.name}</h1>
              {product.description && <p className="text-[11px] text-white/25 mt-0.5 line-clamp-1">{product.description}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-extrabold tracking-tight" style={{ color: btnColor }}>
                R$ {fmtBRL(price)}
              </p>
              {product.checkout_credit_card_enabled && (
                <p className="text-[10px] text-white/25 mt-0.5">ou 12x de R$ {fmtBRL(price * 1.2189 / 12)}</p>
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
              <div className="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-extrabold text-white" style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}bb)` }}>1</div>
              <div>
                <h3 className="text-sm font-bold">Identificação</h3>
                <p className="text-[10px] text-white/25">Preencha seus dados para continuar</p>
              </div>
              <div className="ml-auto">
                <Lock className="h-3.5 w-3.5 text-white/15" />
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
                <div className="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-extrabold text-white" style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}bb)` }}>2</div>
                <div><h3 className="text-sm font-bold">Endereço</h3><p className="text-[10px] text-white/25">Para emissão da nota fiscal</p></div>
              </div>
              <div className={sectionBodyClass}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className={labelClass}>CEP</Label>
                    <div className="relative">
                      <Input value={cep} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" required className={inputClass} inputMode="numeric" />
                      {loadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-white/30 mt-1" />}
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
                    <Input value={city && state ? `${city} - ${state}` : ""} readOnly placeholder="Preenchido via CEP" className={inputClass + " !bg-[#0a0a0d] !text-white/50"} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ═══════ ORDER BUMPS ═══════ */}
          {orderBumps.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Oferta exclusiva</span>
                <div className="flex-1 h-px bg-amber-400/10" />
              </div>
              {orderBumps.map(bump => {
                const selected = selectedBumps.has(bump.id);
                return (
                  <button key={bump.id} type="button" onClick={() => toggleBump(bump.id)}
                    className={`w-full rounded-2xl border-2 p-4 md:p-5 text-left transition-all duration-300 relative overflow-hidden ${
                      selected
                        ? "border-emerald-500/50 bg-emerald-500/[0.04]"
                        : "border-dashed border-amber-500/25 bg-gradient-to-br from-amber-500/[0.03] to-transparent hover:border-amber-500/50"
                    }`}>
                    {selected && <div className="absolute top-0 right-0 text-white text-[8px] font-extrabold px-3 py-1.5 rounded-bl-xl" style={{ backgroundColor: "#10b981" }}>ADICIONADO ✓</div>}
                    {!selected && <div className="absolute top-0 right-0 bg-amber-500 text-black text-[8px] font-extrabold px-3 py-1.5 rounded-bl-xl animate-pulse">APROVEITE!</div>}
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                        {bump.bump_product.image_url ? <img src={bump.bump_product.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <Package className="h-6 w-6 text-white/15" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm leading-tight">{bump.bump_product.name}</p>
                        {bump.bump_product.description && <p className="text-[11px] text-white/30 mt-1 line-clamp-2">{bump.bump_product.description}</p>}
                        <p className="font-extrabold text-base mt-1" style={{ color: selected ? "#10b981" : btnColor }}>
                          + R$ {fmtBRL(Number(bump.bump_product.price))}
                        </p>
                      </div>
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${selected ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-white/[0.04] border border-white/10 text-white/20"}`}>
                        {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ═══════ PAGAMENTO ═══════ */}
          <section className={sectionClass}>
            <div className={sectionHeaderClass}>
              <div className="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-extrabold text-white" style={{ background: `linear-gradient(135deg, ${btnColor}, ${btnColor}bb)` }}>
                {product.checkout_address_required ? "3" : "2"}
              </div>
              <div>
                <h3 className="text-sm font-bold">Pagamento</h3>
                <p className="text-[10px] text-white/25">Escolha a forma de pagamento</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-white/15" />
                <span className="text-[9px] text-white/15 font-semibold">SSL</span>
              </div>
            </div>

            <div className={sectionBodyClass}>
              {/* Method Tabs */}
              {availableMethods.length > 1 && (
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${availableMethods.length}, 1fr)` }}>
                  {availableMethods.map(m => {
                    const active = method === m.id;
                    return (
                      <button key={m.id} type="button" onClick={() => { setMethod(m.id); setPixData(null); setBoletoData(null); }}
                        className={`flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl border-2 text-center transition-all ${
                          active ? "bg-white/[0.04] text-white" : "bg-transparent border-transparent text-white/30 hover:text-white/50 hover:bg-white/[0.02]"
                        }`}
                        style={active ? { borderColor: btnColor + "50", boxShadow: `0 0 30px ${btnColor}08` } : { borderColor: "transparent" }}>
                        <m.icon className={`h-5 w-5 ${active ? "" : "opacity-50"}`} style={active ? { color: btnColor } : undefined} />
                        <span className="text-xs font-bold">{m.label}</span>
                        {m.badge && <span className={`text-[8px] ${active ? "text-white/40" : "text-white/15"}`}>{m.badge}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* PIX indicator */}
              {method === "pix" && (
                <div className="rounded-xl p-4 border border-white/[0.04] bg-white/[0.02] flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: btnColor + "12" }}>
                    <QrCode className="h-6 w-6" style={{ color: btnColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold flex items-center gap-2">Pagamento instantâneo <Zap className="h-3.5 w-3.5" style={{ color: btnColor }} /></p>
                    <p className="text-[11px] text-white/25 mt-0.5">QR Code gerado na hora • Aprovação em segundos</p>
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
                        <select value={installments} onChange={e => setInstallments(e.target.value)} className="w-full h-12 rounded-xl border bg-[#111114] border-[#1e1e24] text-white text-[16px] px-3 pr-8 appearance-none focus:outline-none font-medium">
                          {installmentOptions.map(opt => <option key={opt.n} value={opt.n} className="bg-[#111114]">{opt.n}x R$ {opt.val.toFixed(2)}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 pointer-events-none" />
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
                <div className="rounded-xl p-4 border border-white/[0.04] bg-white/[0.02] flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Boleto Bancário</p>
                    <p className="text-[11px] text-white/25 mt-0.5">Compensação em 1-3 dias úteis</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ═══════ RESUMO ═══════ */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e11] p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Resumo do pedido</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-white/40 flex items-center gap-2"><Package className="h-3.5 w-3.5" /> {product.name}</span>
                <span className="text-white/70 font-semibold">R$ {fmtBRL(price)}</span>
              </div>
              {orderBumps.filter(b => selectedBumps.has(b.id)).map(b => (
                <div key={b.id} className="flex justify-between items-center">
                  <span className="text-white/40 flex items-center gap-2"><Plus className="h-3 w-3" style={{ color: btnColor }} /> {b.bump_product.name}</span>
                  <span className="text-white/70 font-semibold">R$ {fmtBRL(Number(b.bump_product.price))}</span>
                </div>
              ))}
              <div className="border-t border-white/[0.06] pt-3 flex justify-between items-center">
                <span className="font-bold text-white text-base">Total</span>
                <div className="text-right">
                  <span className="font-extrabold text-xl" style={{ color: btnColor }}>
                    {method === "credit_card" && installments !== "1"
                      ? `${installments}x R$ ${fmtBRL(selectedInstallment.val)}`
                      : `R$ ${fmtBRL(totalPrice)}`}
                  </span>
                  {method === "credit_card" && installments !== "1" && (
                    <p className="text-[10px] text-white/20 mt-0.5">Total: R$ {fmtBRL(selectedInstallment.total)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════ GUARANTEE ═══════ */}
          {product.checkout_guarantee_enabled && (
            <div className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.02] flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: btnColor + "10", border: `1px solid ${btnColor}20` }}>
                <ShieldCheck className="h-7 w-7" style={{ color: btnColor }} />
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  Garantia incondicional de 7 dias
                </p>
                <p className="text-[11px] text-white/30 mt-0.5 leading-relaxed">
                  Não ficou satisfeito? Devolvemos 100% do valor. Sem burocracia, sem perguntas.
                </p>
              </div>
            </div>
          )}

          {/* ═══════ CTA BUTTON ═══════ */}
          <div className="pt-1">
            <Button
              type="submit"
              disabled={processing}
              className="w-full h-[60px] text-base font-extrabold rounded-2xl text-white shadow-2xl transition-all duration-300 hover:opacity-95 hover:scale-[1.005] hover:shadow-3xl disabled:opacity-50 disabled:hover:scale-100 relative overflow-hidden group"
              style={{ backgroundColor: btnColor, boxShadow: `0 10px 40px -10px ${btnColor}50` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </div>
              <span className="relative flex items-center gap-2.5">
                {processing ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Processando pagamento...</>
                ) : (
                  <>
                    <Lock className="h-4 w-4 opacity-70" />
                    Finalizar compra
                    <span className="opacity-70">•</span>
                    R$ {fmtBRL(totalPrice)}
                    <ArrowRight className="h-4 w-4 opacity-70" />
                  </>
                )}
              </span>
            </Button>
          </div>

          {/* ═══════ TRUST FOOTER ═══════ */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-1.5 text-white/15">
                <Lock className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold">Criptografia SSL</span>
              </div>
              <div className="h-3 w-px bg-white/[0.06]" />
              <div className="flex items-center gap-1.5 text-white/15">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold">Compra segura</span>
              </div>
              <div className="h-3 w-px bg-white/[0.06]" />
              <div className="flex items-center gap-1.5 text-white/15">
                <Eye className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold">Dados protegidos</span>
              </div>
            </div>
            <p className="text-center text-[10px] text-white/10 leading-relaxed px-6">
              Ao clicar em "Finalizar compra", declaro que li e concordo com os{" "}
              <span className="underline cursor-pointer hover:text-white/20">Termos de Uso</span> e{" "}
              <span className="underline cursor-pointer hover:text-white/20">Política de Privacidade</span>.
            </p>
          </div>
        </form>
      </div>

      {/* ═══ Slide-in animation ═══ */}
      <style>{`
        @keyframes slide-in-left {
          from { transform: translateX(-120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-left { animation: slide-in-left 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s ease-out; }
      `}</style>
    </div>
  );
}
