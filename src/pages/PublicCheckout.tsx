import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, QrCode, FileText, CheckCircle2, Copy, Clock, Loader2, RefreshCw, ShieldCheck, ChevronDown, User, Mail, FileDigit, Phone, MapPin, Sparkles, Plus, Minus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import guaranteeSeal from "@/assets/guarantee-seal.png";
import { initPixels, firePixelEvent, type PixelConfig } from "@/lib/pixelTracking";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  checkout_button_color: string | null;
  checkout_timer_enabled: boolean | null;
  checkout_timer_minutes: number | null;
  checkout_banner_desktop_url: string | null;
  checkout_banner_mobile_url: string | null;
  checkout_social_proof: boolean | null;
  checkout_guarantee_enabled: boolean | null;
  checkout_pix_enabled: boolean | null;
  checkout_boleto_enabled: boolean | null;
  checkout_credit_card_enabled: boolean | null;
  checkout_address_required: boolean | null;
  checkout_email_confirm: boolean | null;
};

type OrderBump = {
  id: string;
  bump_product_id: string;
  bump_product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
  };
};

type PaymentMethod = "pix" | "credit_card" | "boleto";
type CheckoutState = "form" | "pending" | "approved" | "failed";

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
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
}

function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let rest = sum % 11;
  if (rest < 2) rest = 0; else rest = 11 - rest;
  if (rest !== parseInt(digits[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  rest = sum % 11;
  if (rest < 2) rest = 0; else rest = 11 - rest;
  return rest === parseInt(digits[13]);
}

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

  // Order bumps
  const [orderBumps, setOrderBumps] = useState<OrderBump[]>([]);
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  
  // Pixel tracking
  const [productPixels, setProductPixels] = useState<PixelConfig[]>([]);
  const pixelsInitialized = useRef(false);

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

  const [socialCount] = useState(Math.floor(Math.random() * 150) + 50);

  const timerMinutes = product?.checkout_timer_minutes ?? 15;
  const [timeLeft, setTimeLeft] = useState(timerMinutes * 60);
  useEffect(() => {
    if (!product?.checkout_timer_enabled) return;
    setTimeLeft((product?.checkout_timer_minutes ?? 15) * 60);
  }, [product?.checkout_timer_enabled, product?.checkout_timer_minutes]);

  useEffect(() => {
    if (!product?.checkout_timer_enabled) return;
    const timer = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [product?.checkout_timer_enabled]);

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");

  // Load product
  useEffect(() => {
    if (!slug) return;
    supabase.from("products_public").select("*").ilike("checkout_url", `%/${slug}`).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) setProduct(data as unknown as Product);
        setLoading(false);
      });
  }, [slug]);

  // Load pixels for this product & init tracking
  useEffect(() => {
    if (!product?.id) return;
    supabase
      .from("product_pixels_public" as any)
      .select("*")
      .eq("product_id", product.id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const configs: PixelConfig[] = data.map((d: any) => ({
          ...d,
          events: Array.isArray(d.events) ? d.events : [],
        }));
        setProductPixels(configs);
        if (!pixelsInitialized.current) {
          initPixels(configs);
          pixelsInitialized.current = true;
          // Fire PageView
          setTimeout(() => {
            firePixelEvent(configs, "PageView", {
              content_name: product.name,
              content_id: product.id,
              value: Number(product.price),
            });
            firePixelEvent(configs, "ViewContent", {
              content_name: product.name,
              content_id: product.id,
              value: Number(product.price),
            });
          }, 500);
        }
      });
  }, [product?.id]);

  // Load order bumps
  useEffect(() => {
    if (!product?.id) return;
    supabase
      .from("order_bumps")
      .select("id, bump_product_id")
      .eq("product_id", product.id)
      .eq("is_active", true)
      .order("sort_order")
      .then(async ({ data: bumps }) => {
        if (!bumps || bumps.length === 0) return;
        const bumpIds = bumps.map(b => b.bump_product_id);
        const { data: products } = await supabase
          .from("products_public")
          .select("id, name, description, price, image_url")
          .in("id", bumpIds);
        if (!products) return;
        const enriched: OrderBump[] = bumps.map(b => ({
          id: b.id,
          bump_product_id: b.bump_product_id,
          bump_product: products.find(p => p.id === b.bump_product_id) as any,
        })).filter(b => b.bump_product);
        setOrderBumps(enriched);
      });
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    if (product.checkout_credit_card_enabled) setMethod("credit_card");
    else if (product.checkout_pix_enabled) setMethod("pix");
    else if (product.checkout_boleto_enabled) setMethod("boleto");
  }, [product]);

  useEffect(() => {
    if (checkoutState !== "pending" || !transactionId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("transactions").select("status").eq("id", transactionId).single();
      if (data?.status === "completed") {
        setCheckoutState("approved"); clearCheckoutSession(slug || ""); clearInterval(interval);
        if (product) firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: Number(product.price) });
      }
      else if (data?.status === "failed" || data?.status === "cancelled") { setCheckoutState("failed"); clearCheckoutSession(slug || ""); clearInterval(interval); }
    }, 5000);
    return () => clearInterval(interval);
  }, [checkoutState, transactionId, slug]);

  // Formatters
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

  const handleCepChange = async (val: string) => {
    const formatted = formatCep(val);
    setCep(formatted);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro || "");
          setNeighborhood(data.bairro || "");
          setCity(data.localidade || "");
          setState(data.uf || "");
        } else { toast.error("CEP não encontrado"); }
      } catch { toast.error("Erro ao buscar CEP"); }
      finally { setLoadingCep(false); }
    }
  };

  const toggleBump = (bumpId: string) => {
    setSelectedBumps(prev => {
      const next = new Set(prev);
      if (next.has(bumpId)) next.delete(bumpId); else next.add(bumpId);
      return next;
    });
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || processingRef.current) return;

    // Validate phone (WhatsApp mandatory)
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) { toast.error("Informe um WhatsApp válido"); return; }

    const docDigits = document.replace(/\D/g, "");
    if (docDigits.length === 11 && !isValidCpf(document)) { toast.error("CPF inválido"); return; }
    if (docDigits.length === 14 && !isValidCnpj(document)) { toast.error("CNPJ inválido"); return; }
    if (docDigits.length !== 11 && docDigits.length !== 14) { toast.error("CPF/CNPJ inválido"); return; }

    if (product.checkout_email_confirm && email !== emailConfirm) { toast.error("Os e-mails não coincidem"); return; }

    // Fire InitiateCheckout pixel
    firePixelEvent(productPixels, "InitiateCheckout", {
      content_name: product.name, content_id: product.id, value: totalPrice,
    });
    firePixelEvent(productPixels, "AddPaymentInfo", {
      content_name: product.name, content_id: product.id, value: totalPrice,
    });

    processingRef.current = true;
    setProcessing(true);
    try {
      const sessionId = getCheckoutSessionId(slug || "default");
      const payload: Record<string, unknown> = {
        productId: product.id, paymentMethod: method, customerName: name,
        customerEmail: email, customerDocument: docDigits, customerPhone: phoneDigits,
        checkoutSessionId: sessionId,
      };
      if (method === "credit_card") {
        payload.installments = parseInt(installments);
        // NOTE: Card data should be tokenized client-side via PodPay SDK before sending.
        // Never send raw card numbers to our backend. cardToken is the secure approach.
        payload.cardToken = null; // TODO: Implement PodPay client-side tokenization
      }
      const { data, error } = await supabase.functions.invoke("podpay-create-transaction", { body: payload });
      if (error || !data?.success) { toast.error(data?.error || error?.message || "Erro ao processar"); setCheckoutState("failed"); return; }
      const result = data.data;
      setTransactionId(result.transactionId);
      if (data.resumed) { if (result.pix) setPixData(result.pix); if (result.boleto) setBoletoData(result.boleto); setCheckoutState("pending"); toast.info("Retomando pagamento pendente..."); return; }
      if (method === "pix" && result.pix) {
        setPixData(result.pix); setCheckoutState("pending"); toast.success("QR Code PIX gerado!");
        firePixelEvent(productPixels, "PixGenerated", { content_name: product.name, content_id: product.id, value: totalPrice });
      }
      else if (method === "boleto" && result.boleto) {
        setBoletoData(result.boleto); setCheckoutState("pending"); toast.success("Boleto gerado!");
        firePixelEvent(productPixels, "BoletoGenerated", { content_name: product.name, content_id: product.id, value: totalPrice });
      }
      else if (method === "credit_card") {
        if (result.status === "paid" || result.status === "approved") {
          setCheckoutState("approved"); clearCheckoutSession(slug || ""); toast.success("Pagamento aprovado!");
          firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: totalPrice });
        }
        else if (result.secureUrl) { window.location.href = result.secureUrl; }
        else {
          setCheckoutState("approved"); clearCheckoutSession(slug || ""); toast.success("Pagamento processado!");
          firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: totalPrice });
        }
      } else {
        setCheckoutState("approved"); clearCheckoutSession(slug || ""); toast.success("Pagamento processado!");
        firePixelEvent(productPixels, "Purchase", { content_name: product.name, content_id: product.id, value: totalPrice });
      }
    } catch (err) { console.error(err); toast.error("Erro inesperado"); setCheckoutState("failed"); }
    finally { setProcessing(false); processingRef.current = false; }
  };

  const retryPayment = () => { clearCheckoutSession(slug || ""); setCheckoutState("form"); setPixData(null); setBoletoData(null); setTransactionId(null); };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#08080a]"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center bg-[#08080a] text-white px-4"><div className="text-center"><Sparkles className="h-12 w-12 text-white/20 mx-auto mb-4" /><h1 className="text-xl font-bold mb-1">Produto não encontrado</h1><p className="text-sm text-white/40">Verifique o link e tente novamente.</p></div></div>;

  const price = Number(product.price);
  const bumpsTotal = orderBumps.filter(b => selectedBumps.has(b.id)).reduce((sum, b) => sum + Number(b.bump_product.price), 0);
  const totalPrice = price + bumpsTotal;
  const btnColor = product.checkout_button_color || "#10b981";
  const installmentOptions = Array.from({ length: 12 }, (_, i) => { const n = i + 1; const val = n === 1 ? totalPrice : totalPrice * (1 + 0.0199 * (n - 1)) / n; return { n, val, total: n === 1 ? totalPrice : val * n }; });
  const selectedInstallment = installmentOptions[parseInt(installments) - 1];

  const availableMethods: { id: PaymentMethod; icon: any; label: string; short: string }[] = [];
  if (product.checkout_credit_card_enabled) availableMethods.push({ id: "credit_card", icon: CreditCard, label: "Cartão de crédito", short: "Cartão" });
  if (product.checkout_pix_enabled) availableMethods.push({ id: "pix", icon: QrCode, label: "Pix", short: "Pix" });
  if (product.checkout_boleto_enabled) availableMethods.push({ id: "boleto", icon: FileText, label: "Boleto", short: "Boleto" });

  // ---- SCREENS ----

  if (checkoutState === "approved") return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#08080a] text-white">
      <div className="text-center animate-fade-in max-w-md">
        <div className="relative mx-auto mb-8 w-24 h-24"><div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl animate-pulse" /><div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl"><CheckCircle2 className="h-12 w-12 text-white" /></div></div>
        <h1 className="text-3xl font-bold mb-2">Pagamento Confirmado!</h1>
        <p className="text-white/50 mb-8">Seu pagamento de <strong className="text-emerald-400">R$ {totalPrice.toFixed(2)}</strong> foi aprovado.</p>
        <div className="rounded-2xl p-5 bg-white/[0.04] border border-white/10"><p className="text-xs text-white/40 uppercase tracking-widest mb-1">Produto</p><p className="font-semibold text-lg">{product.name}</p></div>
        <p className="text-xs text-white/30 mt-6">Confirmação enviada para {email}</p>
      </div>
    </div>
  );

  if (checkoutState === "failed") return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#08080a] text-white">
      <div className="text-center animate-fade-in max-w-md">
        <div className="relative mx-auto mb-8 w-24 h-24"><div className="absolute inset-0 rounded-full bg-red-500/20 blur-2xl animate-pulse" /><div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-2xl"><CreditCard className="h-12 w-12 text-white" /></div></div>
        <h1 className="text-3xl font-bold mb-2">Pagamento Recusado</h1>
        <p className="text-white/50 mb-8">Não foi possível processar. Tente novamente.</p>
        <Button onClick={retryPayment} style={{ backgroundColor: btnColor }} className="text-white rounded-xl h-12 px-8 gap-2 font-semibold hover:opacity-90"><RefreshCw className="h-4 w-4" /> Tentar Novamente</Button>
      </div>
    </div>
  );

  if (checkoutState === "pending") return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <div className="max-w-lg mx-auto px-4 py-10 md:py-16">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {product.image_url ? <img src={product.image_url} alt={product.name} className="h-14 w-14 rounded-xl object-cover" /> : <Sparkles className="h-6 w-6 text-white/30" />}
          </div>
          <div><h2 className="font-bold">{product.name}</h2><p className="font-bold text-lg" style={{ color: btnColor }}>R$ {totalPrice.toFixed(2)}</p></div>
        </div>
        <div className="text-center mb-8"><div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 px-4 py-2 rounded-full text-sm font-medium"><Clock className="h-4 w-4" /> Aguardando Pagamento</div></div>
        {pixData && (
          <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/10 mb-6">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-5 justify-center" style={{ color: btnColor }}><QrCode className="h-4 w-4" /> Escaneie o QR Code PIX</h3>
            {(pixData.qrcode || pixData.qrCode || pixData.qrCodeText) && <div className="flex justify-center mb-5"><div className="bg-white p-4 rounded-2xl"><QRCodeSVG value={pixData.qrcode || pixData.qrCodeText || pixData.qrCode} size={200} /></div></div>}
            <p className="text-xs text-white/30 mb-4 text-center">Expira em 30 minutos</p>
            {(pixData.qrcode || pixData.qrCodeText) && <Button type="button" className="w-full gap-2 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white rounded-xl h-12" onClick={() => { navigator.clipboard.writeText(pixData.qrcode || pixData.qrCodeText); toast.success("Código copiado!"); }}><Copy className="h-4 w-4" /> Copiar código PIX</Button>}
          </div>
        )}
        {boletoData && (
          <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/10 mb-6 space-y-3">
            <h3 className="text-sm font-semibold text-center" style={{ color: btnColor }}>Boleto gerado</h3>
            {boletoData.url && <Button type="button" className="w-full gap-2 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white rounded-xl h-12" onClick={() => window.open(boletoData.url, "_blank")}><FileText className="h-4 w-4" /> Visualizar Boleto</Button>}
            {boletoData.barCode && <Button type="button" className="w-full gap-2 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white rounded-xl h-12" onClick={() => { navigator.clipboard.writeText(boletoData.barCode); toast.success("Código copiado!"); }}><Copy className="h-4 w-4" /> Copiar código de barras</Button>}
          </div>
        )}
        <div className="text-center">
          <p className="text-xs text-white/20 flex items-center justify-center gap-1 mb-3"><RefreshCw className="h-3 w-3 animate-spin" /> Verificando status automaticamente...</p>
          <button className="text-xs text-white/30 hover:text-white/60 underline" onClick={retryPayment}>Cancelar e tentar outro método</button>
        </div>
      </div>
    </div>
  );

  // ====================================================================
  // === FORM — Modern Checkout =========================================
  // ====================================================================

  // Prevent iOS zoom: font-size >= 16px on inputs
  const inputClass = "mt-1 h-12 rounded-xl bg-[#111114] border-[#222228] text-white placeholder:text-white/20 focus:border-[color:var(--btn-color)]/50 focus:ring-1 focus:ring-[color:var(--btn-color)]/20 transition-all text-[16px] leading-tight";

  const sectionClass = "rounded-2xl border border-white/[0.06] bg-[#0f0f12] p-5 md:p-6 space-y-4";
  const labelClass = "text-xs text-white/50 font-semibold flex items-center gap-1.5 uppercase tracking-wide";

  return (
    <div className="min-h-screen bg-[#08080a] text-white" style={{ "--btn-color": btnColor } as React.CSSProperties}>
      {/* Timer bar */}
      {product.checkout_timer_enabled && (
        <div className="sticky top-0 z-50 bg-[#0a0a0d]/95 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="max-w-[680px] mx-auto px-4 py-2.5 flex items-center justify-center gap-3">
            <div className="flex items-center gap-1 font-mono">
              <span className="bg-[#151518] border border-white/10 rounded-lg px-3 py-1.5 text-lg font-bold tabular-nums text-white">{mins}</span>
              <span className="text-white/20 text-lg font-bold mx-0.5">:</span>
              <span className="bg-[#151518] border border-white/10 rounded-lg px-3 py-1.5 text-lg font-bold tabular-nums text-white">{secs}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-amber-400 font-semibold">Oferta expira em breve!</span>
            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      {(product.checkout_banner_desktop_url || product.checkout_banner_mobile_url) && (
        <>
          {product.checkout_banner_desktop_url && <img src={product.checkout_banner_desktop_url} alt="Banner" className="w-full hidden md:block max-h-[300px] object-cover" />}
          {product.checkout_banner_mobile_url && <img src={product.checkout_banner_mobile_url} alt="Banner" className="w-full md:hidden max-h-[200px] object-cover" />}
          {!product.checkout_banner_mobile_url && product.checkout_banner_desktop_url && <img src={product.checkout_banner_desktop_url} alt="Banner" className="w-full md:hidden max-h-[200px] object-cover" />}
        </>
      )}

      {/* Social proof */}
      {product.checkout_social_proof && (
        <div className="max-w-[680px] mx-auto px-4 pt-5">
          <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-500/[0.08] to-emerald-600/[0.04] border border-emerald-500/20 px-5 py-4 rounded-2xl w-full">
            <span className="flex -space-x-2.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-[#08080a] flex items-center justify-center text-[10px] font-bold shadow-lg" style={{ backgroundColor: `hsl(${148 + i * 8}, 65%, ${30 + i * 6}%)`, zIndex: 5 - i }}>
                  {["A", "M", "L", "R", "S"][i]}
                </div>
              ))}
            </span>
            <div className="flex-1">
              <p className="text-emerald-400 font-bold text-[14px]">🔥 {socialCount} vendas realizadas</p>
              <p className="text-emerald-400/40 text-[11px]">nas últimas 24 horas • Produto verificado</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[10px] font-bold">AO VIVO</span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[680px] mx-auto px-4 py-6 md:py-10">
        {/* Product card */}
        <div className={sectionClass + " !space-y-0 mb-5"}>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
              {product.image_url ? <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-2xl object-cover" /> : <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 flex items-center justify-center"><Sparkles className="h-7 w-7 text-emerald-400/60" /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-base md:text-lg leading-tight truncate">{product.name}</h1>
              {product.description && <p className="text-xs text-white/30 mt-0.5 line-clamp-1">{product.description}</p>}
              <p className="font-extrabold text-xl mt-1" style={{ color: btnColor }}>R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handlePay} className="space-y-4">
          {/* ====== DADOS PESSOAIS ====== */}
          <section className={sectionClass}>
            <h3 className="text-sm font-bold flex items-center gap-2 !mb-4">
              <div className="h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: btnColor }}>1</div>
              Seus dados
            </h3>

            <div>
              <Label className={labelClass}><User className="h-3 w-3" /> Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" required className={inputClass} />
            </div>

            <div className={product.checkout_email_confirm ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : ""}>
              <div>
                <Label className={labelClass}><Mail className="h-3 w-3" /> E-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required type="email" className={inputClass} />
              </div>
              {product.checkout_email_confirm && (
                <div>
                  <Label className={labelClass}>Confirme o e-mail</Label>
                  <Input value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} placeholder="Confirme seu e-mail" required type="email" className={inputClass} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className={labelClass}><FileDigit className="h-3 w-3" /> CPF / CNPJ</Label>
                <Input value={document} onChange={(e) => setDocument(formatCpf(e.target.value))} placeholder="000.000.000-00" required className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}><Phone className="h-3 w-3" /> WhatsApp</Label>
                <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" required className={inputClass} />
              </div>
            </div>
          </section>

          {/* ====== ENDEREÇO ====== */}
          {product.checkout_address_required && (
            <section className={sectionClass}>
              <h3 className="text-sm font-bold flex items-center gap-2 !mb-4">
                <div className="h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: btnColor }}>2</div>
                Endereço
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className={labelClass}>CEP</Label>
                  <div className="relative">
                    <Input value={cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" required className={inputClass} inputMode="numeric" />
                    {loadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-white/30 mt-0.5" />}
                  </div>
                </div>
                <div>
                  <Label className={labelClass}>Bairro</Label>
                  <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" required className={inputClass} />
                </div>
              </div>
              <div>
                <Label className={labelClass}>Rua</Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua / Avenida" required className={inputClass} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <Label className={labelClass}>Número</Label>
                  <Input value={number_} onChange={(e) => setNumber_(e.target.value)} placeholder="Nº" required className={inputClass} inputMode="numeric" />
                </div>
                <div>
                  <Label className={labelClass}>Complemento</Label>
                  <Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, sala..." className={inputClass} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className={labelClass}>Cidade / UF</Label>
                  <Input value={city && state ? `${city} - ${state}` : ""} readOnly placeholder="Via CEP" className={inputClass + " !bg-[#0c0c0f]"} />
                </div>
              </div>
            </section>
          )}

          {/* ====== ORDER BUMPS ====== */}
          {orderBumps.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">🎁 Ofertas especiais para você</span>
                <div className="flex-1 h-px bg-amber-400/10" />
              </div>
              {orderBumps.map(bump => {
                const selected = selectedBumps.has(bump.id);
                return (
                  <button
                    key={bump.id}
                    type="button"
                    onClick={() => toggleBump(bump.id)}
                    className={`w-full rounded-2xl border-2 p-5 text-left transition-all duration-300 relative overflow-hidden ${
                      selected
                        ? "border-emerald-500/60 bg-emerald-500/[0.06] shadow-xl shadow-emerald-500/10"
                        : "border-dashed border-amber-500/30 bg-gradient-to-r from-amber-500/[0.04] to-amber-600/[0.02] hover:border-amber-500/60 hover:bg-amber-500/[0.06]"
                    }`}
                  >
                    {selected && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-bold px-3 py-1 rounded-bl-xl">ADICIONADO ✓</div>}
                    {!selected && <div className="absolute top-0 right-0 bg-amber-500/80 text-white text-[8px] font-bold px-3 py-1 rounded-bl-xl animate-pulse">ADICIONE AGORA</div>}
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {bump.bump_product.image_url ? (
                          <img src={bump.bump_product.image_url} alt={bump.bump_product.name} className="h-16 w-16 rounded-2xl object-cover" />
                        ) : (
                          <Package className="h-7 w-7 text-white/20" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[15px] leading-tight">{bump.bump_product.name}</p>
                        {bump.bump_product.description && (
                          <p className="text-xs text-white/40 mt-1 line-clamp-2 leading-relaxed">{bump.bump_product.description}</p>
                        )}
                        <p className="font-extrabold text-base mt-1.5" style={{ color: selected ? '#10b981' : btnColor }}>
                          + R$ {Number(bump.bump_product.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                        selected ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-white/[0.06] border border-white/10 text-white/30"
                      }`}>
                        {selected ? <CheckCircle2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </section>
          )}

          {/* ====== PAGAMENTO ====== */}
          <section className={sectionClass}>
            <h3 className="text-sm font-bold flex items-center gap-2 !mb-4">
              <div className="h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: btnColor }}>
                {product.checkout_address_required ? "3" : "2"}
              </div>
              Pagamento
            </h3>

            {availableMethods.length > 1 && (
              <div className="flex gap-2 mb-5">
                {availableMethods.map((m) => (
                  <button key={m.id} type="button" onClick={() => { setMethod(m.id); setPixData(null); setBoletoData(null); }}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all flex-1 justify-center ${
                      method === m.id ? "bg-white/[0.06] border-white/20 text-white" : "bg-transparent border-white/[0.06] text-white/30 hover:text-white/50 hover:border-white/15"
                    }`}
                    style={method === m.id ? { borderColor: btnColor + "60", boxShadow: `0 0 20px ${btnColor}10` } : undefined}>
                    <m.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{m.label}</span>
                    <span className="sm:hidden">{m.short}</span>
                  </button>
                ))}
              </div>
            )}

            {method === "credit_card" && (
              <div className="space-y-4">
                <div><Label className={labelClass}>Número do cartão</Label><Input value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" required className={inputClass} inputMode="numeric" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className={labelClass}>Validade</Label><Input value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" required className={inputClass} inputMode="numeric" /></div>
                  <div><Label className={labelClass}>CVV</Label><Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" required className={inputClass} inputMode="numeric" /></div>
                  <div><Label className={labelClass}>Parcelas</Label>
                    <div className="relative mt-1">
                      <select value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-full h-12 rounded-xl border bg-[#111114] border-[#222228] text-white text-[16px] px-3 pr-8 appearance-none focus:outline-none transition-all">
                        {installmentOptions.map((opt) => <option key={opt.n} value={opt.n} className="bg-[#111114]">{opt.n}x R$ {opt.val.toFixed(2)}{opt.n > 1 ? "*" : ""}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div><Label className={labelClass}>Nome do titular</Label><Input value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} placeholder="NOME IMPRESSO NO CARTÃO" required className={inputClass} /></div>
              </div>
            )}
            {method === "pix" && (
              <div className="flex items-center gap-4 py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center"><QrCode className="h-5 w-5 text-emerald-400" /></div>
                <div><p className="text-sm font-semibold">Pagamento instantâneo via PIX</p><p className="text-xs text-white/25 mt-0.5">QR Code gerado após clicar em finalizar</p></div>
              </div>
            )}
            {method === "boleto" && (
              <div className="flex items-center gap-4 py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center"><FileText className="h-5 w-5 text-amber-400" /></div>
                <div><p className="text-sm font-semibold">Boleto Bancário</p><p className="text-xs text-white/25 mt-0.5">Compensação em 1-3 dias úteis</p></div>
              </div>
            )}
          </section>

          {/* ====== RESUMO ====== */}
          <section className={sectionClass + " !space-y-3"}>
            <h3 className="text-sm font-bold">Resumo do pedido</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">{product.name}</span>
                <span className="text-white/70 font-medium">R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              {orderBumps.filter(b => selectedBumps.has(b.id)).map(b => (
                <div key={b.id} className="flex justify-between">
                  <span className="text-white/40 flex items-center gap-1"><Plus className="h-3 w-3 text-emerald-400" /> {b.bump_product.name}</span>
                  <span className="text-white/70 font-medium">R$ {Number(b.bump_product.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="border-t border-white/[0.06] pt-3 flex justify-between items-center">
                <span className="font-bold text-white">Total</span>
                <span className="font-extrabold text-xl" style={{ color: btnColor }}>
                  {method === "credit_card" && installments !== "1" ? `${installments}x R$ ${selectedInstallment.val.toFixed(2)}` : `R$ ${totalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </span>
              </div>
            </div>
          </section>

          {/* Guarantee seal */}
          {product.checkout_guarantee_enabled && (
            <div className="flex items-center gap-4 p-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03]">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Garantia incondicional de 7 dias
                </p>
                <p className="text-xs text-white/40 mt-0.5">Não ficou satisfeito? Devolvemos 100% do seu dinheiro sem burocracia.</p>
              </div>
            </div>
          )}

          {/* CTA */}
          <Button type="submit" disabled={processing} style={{ backgroundColor: btnColor }}
            className="w-full h-14 text-base font-bold rounded-xl text-white shadow-xl transition-all duration-300 hover:opacity-90 hover:scale-[1.01] hover:shadow-2xl disabled:opacity-50 disabled:hover:scale-100">
            {processing ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Processando...</span> : `Finalizar compra • R$ ${totalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          </Button>

          {/* Trust */}
          <div className="flex items-center justify-center gap-2 pt-2 pb-1">
            <ShieldCheck className="h-4 w-4 text-white/15" />
            <div className="text-center"><p className="text-[11px] text-white/30 font-medium">Compra 100% segura</p><p className="text-[10px] text-white/15">Dados protegidos com criptografia SSL</p></div>
          </div>
          <p className="text-center text-[10px] text-white/10 leading-relaxed px-4">
            Ao clicar em "Finalizar compra", declaro que li e concordo com os <span className="underline">Termos de Compra</span> e <span className="underline">Política de Privacidade</span>.
          </p>
        </form>
      </div>
    </div>
  );
}
