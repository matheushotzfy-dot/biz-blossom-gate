import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, QrCode, FileText, CheckCircle2, Copy, Clock, Loader2, RefreshCw, ShieldCheck, ChevronDown, User, Mail, FileDigit, Phone, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import guaranteeSeal from "@/assets/guarantee-seal.png";

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

type PaymentMethod = "pix" | "credit_card" | "boleto";
type CheckoutState = "form" | "pending" | "approved" | "failed";

function getCheckoutSessionId(slug: string): string {
  const key = `checkout_session_${slug}`;
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem(key, sessionId); }
  return sessionId;
}
function clearCheckoutSession(slug: string) { sessionStorage.removeItem(`checkout_session_${slug}`); }

// CPF validation
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

  // Address fields
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);

  // Social proof random
  const [socialCount] = useState(Math.floor(Math.random() * 150) + 50);

  // Timer
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

  // Set default payment method based on enabled methods
  useEffect(() => {
    if (!product) return;
    if (product.checkout_credit_card_enabled) setMethod("credit_card");
    else if (product.checkout_pix_enabled) setMethod("pix");
    else if (product.checkout_boleto_enabled) setMethod("boleto");
  }, [product]);

  // Poll transaction status
  useEffect(() => {
    if (checkoutState !== "pending" || !transactionId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("transactions").select("status").eq("id", transactionId).single();
      if (data?.status === "completed") { setCheckoutState("approved"); clearCheckoutSession(slug || ""); clearInterval(interval); }
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

  // CEP auto-fill
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

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || processingRef.current) return;

    // Validate CPF/CNPJ
    const docDigits = document.replace(/\D/g, "");
    if (docDigits.length === 11 && !isValidCpf(document)) { toast.error("CPF inválido"); return; }
    if (docDigits.length === 14 && !isValidCnpj(document)) { toast.error("CNPJ inválido"); return; }
    if (docDigits.length !== 11 && docDigits.length !== 14) { toast.error("CPF/CNPJ inválido"); return; }

    if (product.checkout_email_confirm && email !== emailConfirm) { toast.error("Os e-mails não coincidem"); return; }

    processingRef.current = true;
    setProcessing(true);
    try {
      const sessionId = getCheckoutSessionId(slug || "default");
      const payload: Record<string, unknown> = {
        productId: product.id, paymentMethod: method, customerName: name,
        customerEmail: email, customerDocument: docDigits, checkoutSessionId: sessionId,
      };
      if (method === "credit_card") {
        payload.installments = parseInt(installments);
        payload.cardData = { number: cardNumber.replace(/\s/g, ""), holderName: cardName, expMonth: parseInt(cardExpiry.split("/")[0]), expYear: 2000 + parseInt(cardExpiry.split("/")[1] || "0"), cvv: cardCvv };
      }
      const { data, error } = await supabase.functions.invoke("podpay-create-transaction", { body: payload });
      if (error || !data?.success) { toast.error(data?.error || error?.message || "Erro ao processar"); setCheckoutState("failed"); return; }
      const result = data.data;
      setTransactionId(result.transactionId);
      if (data.resumed) { if (result.pix) setPixData(result.pix); if (result.boleto) setBoletoData(result.boleto); setCheckoutState("pending"); toast.info("Retomando pagamento pendente..."); return; }
      if (method === "pix" && result.pix) { setPixData(result.pix); setCheckoutState("pending"); toast.success("QR Code PIX gerado!"); }
      else if (method === "boleto" && result.boleto) { setBoletoData(result.boleto); setCheckoutState("pending"); toast.success("Boleto gerado!"); }
      else if (method === "credit_card") {
        if (result.status === "paid" || result.status === "approved") { setCheckoutState("approved"); clearCheckoutSession(slug || ""); toast.success("Pagamento aprovado!"); }
        else if (result.secureUrl) { window.location.href = result.secureUrl; }
        else { setCheckoutState("approved"); clearCheckoutSession(slug || ""); toast.success("Pagamento processado!"); }
      } else { setCheckoutState("approved"); clearCheckoutSession(slug || ""); toast.success("Pagamento processado!"); }
    } catch (err) { console.error(err); toast.error("Erro inesperado"); setCheckoutState("failed"); }
    finally { setProcessing(false); processingRef.current = false; }
  };

  const retryPayment = () => { clearCheckoutSession(slug || ""); setCheckoutState("form"); setPixData(null); setBoletoData(null); setTransactionId(null); };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] text-white px-4"><div className="text-center"><Sparkles className="h-12 w-12 text-white/20 mx-auto mb-4" /><h1 className="text-xl font-bold mb-1">Produto não encontrado</h1><p className="text-sm text-white/40">Verifique o link e tente novamente.</p></div></div>;

  const price = Number(product.price);
  const btnColor = product.checkout_button_color || "#10b981";
  const installmentOptions = Array.from({ length: 12 }, (_, i) => { const n = i + 1; const val = n === 1 ? price : price * (1 + 0.0199 * (n - 1)) / n; return { n, val, total: n === 1 ? price : val * n }; });
  const selectedInstallment = installmentOptions[parseInt(installments) - 1];

  const availableMethods: { id: PaymentMethod; icon: any; label: string; short: string }[] = [];
  if (product.checkout_credit_card_enabled) availableMethods.push({ id: "credit_card", icon: CreditCard, label: "Cartão de crédito", short: "Cartão" });
  if (product.checkout_pix_enabled) availableMethods.push({ id: "pix", icon: QrCode, label: "Pix", short: "Pix" });
  if (product.checkout_boleto_enabled) availableMethods.push({ id: "boleto", icon: FileText, label: "Boleto", short: "Boleto" });

  // Approved
  if (checkoutState === "approved") return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0d0d0d] text-white">
      <div className="text-center animate-fade-in max-w-md">
        <div className="relative mx-auto mb-8 w-24 h-24"><div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl animate-pulse" /><div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl"><CheckCircle2 className="h-12 w-12 text-white" /></div></div>
        <h1 className="text-3xl font-bold mb-2">Pagamento Confirmado!</h1>
        <p className="text-white/50 mb-8">Seu pagamento de <strong className="text-emerald-400">R$ {price.toFixed(2)}</strong> foi aprovado.</p>
        <div className="rounded-2xl p-5 bg-white/[0.04] border border-white/10"><p className="text-xs text-white/40 uppercase tracking-widest mb-1">Produto</p><p className="font-semibold text-lg">{product.name}</p></div>
        <p className="text-xs text-white/30 mt-6">Confirmação enviada para {email}</p>
      </div>
    </div>
  );

  // Failed
  if (checkoutState === "failed") return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0d0d0d] text-white">
      <div className="text-center animate-fade-in max-w-md">
        <div className="relative mx-auto mb-8 w-24 h-24"><div className="absolute inset-0 rounded-full bg-red-500/20 blur-2xl animate-pulse" /><div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-2xl"><CreditCard className="h-12 w-12 text-white" /></div></div>
        <h1 className="text-3xl font-bold mb-2">Pagamento Recusado</h1>
        <p className="text-white/50 mb-8">Não foi possível processar. Tente novamente.</p>
        <Button onClick={retryPayment} style={{ backgroundColor: btnColor }} className="text-white rounded-xl h-12 px-8 gap-2 font-semibold hover:opacity-90"><RefreshCw className="h-4 w-4" /> Tentar Novamente</Button>
      </div>
    </div>
  );

  // Pending
  if (checkoutState === "pending") return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-lg mx-auto px-4 py-10 md:py-16">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {product.image_url ? <img src={product.image_url} alt={product.name} className="h-14 w-14 rounded-xl object-cover" /> : <Sparkles className="h-6 w-6 text-white/30" />}
          </div>
          <div><h2 className="font-bold">{product.name}</h2><p className="font-bold text-lg" style={{ color: btnColor }}>R$ {price.toFixed(2)}</p></div>
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
  // === FORM — Checkout with all customizations ========================
  // ====================================================================
  const inputClass = "mt-1 h-11 rounded-lg bg-[#1a1a1f] border-[#2a2a30] text-white placeholder:text-white/25 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm";

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Timer bar */}
      {product.checkout_timer_enabled && (
        <div className="sticky top-0 z-50 bg-[#111115]/90 backdrop-blur-md border-b border-white/[0.06]">
          <div className="max-w-[660px] mx-auto px-4 py-2.5 flex items-center justify-center gap-3">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="bg-[#1a1a1f] border border-white/10 rounded-md px-2.5 py-1 text-lg font-bold tabular-nums">{mins}</span>
              <span className="text-white/30 text-lg font-bold">:</span>
              <span className="bg-[#1a1a1f] border border-white/10 rounded-md px-2.5 py-1 text-lg font-bold tabular-nums">{secs}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-white/50 hidden sm:inline">Oferta por tempo limitado.</span>
              <span className="text-amber-400 font-semibold">Finalize sua compra!</span>
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
        <div className="max-w-[660px] mx-auto px-4 pt-4">
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full text-xs font-medium w-fit">
            <span className="flex -space-x-1.5">
              {[...Array(3)].map((_, i) => <div key={i} className="h-5 w-5 rounded-full bg-emerald-500/30 border border-emerald-500/50" />)}
            </span>
            🔥 {socialCount} pessoas compraram recentemente
          </div>
        </div>
      )}

      <div className="max-w-[660px] mx-auto px-4 py-6 md:py-10">
        {/* Product card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#131316] p-5 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {product.image_url ? <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-xl object-cover" /> : <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center"><Sparkles className="h-7 w-7 text-emerald-400" /></div>}
            </div>
            <div>
              <h1 className="font-bold text-base">{product.name}</h1>
              <p className="font-bold text-lg" style={{ color: btnColor }}>R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handlePay} className="space-y-5">
          {/* Personal data */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#131316] p-5 space-y-4">
            {/* Email */}
            <div className={product.checkout_email_confirm ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : ""}>
              <div>
                <Label className="text-xs text-white/60 font-medium flex items-center gap-1.5"><Mail className="h-3 w-3" /> Seu e-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Insira seu e-mail" required type="email" className={inputClass} />
              </div>
              {product.checkout_email_confirm && (
                <div>
                  <Label className="text-xs text-white/60 font-medium">Confirme seu e-mail</Label>
                  <Input value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} placeholder="Insira novamente" required type="email" className={inputClass} />
                </div>
              )}
            </div>
            {/* Name */}
            <div>
              <Label className="text-xs text-white/60 font-medium flex items-center gap-1.5"><User className="h-3 w-3" /> Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Insira seu nome completo" required className={inputClass} />
            </div>
            {/* CPF + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-white/60 font-medium flex items-center gap-1.5"><FileDigit className="h-3 w-3" /> CPF/CNPJ</Label>
                <Input value={document} onChange={(e) => setDocument(formatCpf(e.target.value))} placeholder="Insira seu CPF ou CNPJ" required className={inputClass} />
              </div>
              <div>
                <Label className="text-xs text-white/60 font-medium flex items-center gap-1.5"><Phone className="h-3 w-3" /> Seu celular</Label>
                <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" className={inputClass} />
              </div>
            </div>
          </section>

          {/* Address section */}
          {product.checkout_address_required && (
            <section className="rounded-2xl border border-white/[0.08] bg-[#131316] p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2"><MapPin className="h-4 w-4" /> Endereço</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-white/60 font-medium">CEP</Label>
                  <div className="relative">
                    <Input value={cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" required className={inputClass} />
                    {loadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-white/30 mt-0.5" />}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-white/60 font-medium">Bairro</Label>
                  <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" required className={inputClass} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-white/60 font-medium">Rua</Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua / Avenida" required className={inputClass} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-white/60 font-medium">Número</Label>
                  <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Nº" required className={inputClass} />
                </div>
                <div>
                  <Label className="text-xs text-white/60 font-medium">Complemento</Label>
                  <Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, sala..." className={inputClass} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs text-white/60 font-medium">Cidade / UF</Label>
                  <Input value={city && state ? `${city} - ${state}` : ""} readOnly placeholder="Preenchido via CEP" className={inputClass + " bg-[#151518]"} />
                </div>
              </div>
            </section>
          )}

          {/* Payment methods */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#131316] p-5">
            {availableMethods.length > 1 && (
              <div className="flex gap-2 sm:gap-3 mb-5">
                {availableMethods.map((m) => (
                  <button key={m.id} type="button" onClick={() => { setMethod(m.id); setPixData(null); setBoletoData(null); }}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-xl border text-xs sm:text-sm font-medium transition-all flex-1 justify-center ${
                      method === m.id ? "bg-white/[0.06] border-emerald-500/50 text-white shadow-sm shadow-emerald-500/10" : "bg-transparent border-white/10 text-white/40 hover:text-white/60 hover:border-white/20"
                    }`}>
                    <m.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{m.label}</span>
                    <span className="sm:hidden">{m.short}</span>
                  </button>
                ))}
              </div>
            )}

            {method === "credit_card" && (
              <div className="space-y-4">
                <div><Label className="text-xs text-white/60 font-medium">Número do cartão</Label><Input value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" required className={inputClass} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs text-white/60 font-medium">Validade</Label><Input value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" required className={inputClass} /></div>
                  <div><Label className="text-xs text-white/60 font-medium">CVV</Label><Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" required className={inputClass} /></div>
                  <div><Label className="text-xs text-white/60 font-medium">Parcelas</Label>
                    <div className="relative mt-1">
                      <select value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-full h-11 rounded-lg border bg-[#1a1a1f] border-[#2a2a30] text-white text-sm px-3 pr-8 appearance-none focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all">
                        {installmentOptions.map((opt) => <option key={opt.n} value={opt.n} className="bg-[#1a1a1f]">{opt.n}x R$ {opt.val.toFixed(2)}{opt.n > 1 ? "*" : ""}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div><Label className="text-xs text-white/60 font-medium">Nome do titular</Label><Input value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} placeholder="Nome impresso no cartão" required className={inputClass} /></div>
              </div>
            )}
            {method === "pix" && (
              <div className="flex items-center gap-3 py-2">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><QrCode className="h-5 w-5 text-emerald-400" /></div>
                <div><p className="text-sm font-medium">Pagamento instantâneo via PIX</p><p className="text-xs text-white/30">O QR Code será gerado após clicar em "Comprar agora"</p></div>
              </div>
            )}
            {method === "boleto" && (
              <div className="flex items-center gap-3 py-2">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><FileText className="h-5 w-5 text-emerald-400" /></div>
                <div><p className="text-sm font-medium">Boleto Bancário</p><p className="text-xs text-white/30">Compensação em 1-3 dias úteis</p></div>
              </div>
            )}
          </section>

          {/* Summary */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#131316] p-5">
            <h3 className="text-sm font-bold mb-4">Resumo</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-white/50">{product.name}</span><span className="text-white font-medium">R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
              <div className="border-t border-white/[0.06] pt-2.5 flex justify-between items-center">
                <span className="font-bold">Total</span>
                <span className="font-bold text-lg" style={{ color: btnColor }}>
                  {method === "credit_card" && installments !== "1" ? `${installments}x R$ ${selectedInstallment.val.toFixed(2)}` : `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                </span>
              </div>
            </div>
          </section>

          {/* Guarantee seal */}
          {product.checkout_guarantee_enabled && (
            <div className="flex items-center justify-center gap-3 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <img src={guaranteeSeal} alt="Garantia 7 dias" className="h-16 w-16 object-contain" />
              <div>
                <p className="text-sm font-bold text-white">Garantia de 7 dias</p>
                <p className="text-xs text-white/40">Se não gostar, devolvemos 100% do seu dinheiro.</p>
              </div>
            </div>
          )}

          {/* CTA */}
          <Button type="submit" disabled={processing} style={{ backgroundColor: btnColor }}
            className="w-full h-14 text-base font-bold rounded-xl text-white shadow-lg transition-all duration-200 hover:opacity-90 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100">
            {processing ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Processando...</span> : "Comprar agora"}
          </Button>

          {/* Trust */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <ShieldCheck className="h-4 w-4 text-white/20" />
            <div className="text-center"><p className="text-xs text-white/40 font-medium">Ambiente seguro</p><p className="text-[10px] text-white/20">Seus dados são confidenciais</p></div>
          </div>
          <p className="text-center text-[10px] text-white/15 leading-relaxed px-4 mt-2">
            Ao clicar em "Comprar agora", declaro que li e concordo com os <span className="underline">Termos de Compra</span> e <span className="underline">Política de Privacidade</span>.
          </p>
        </form>
      </div>
    </div>
  );
}
