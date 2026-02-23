import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, QrCode, FileText, Shield, CheckCircle2, Copy, Clock, Lock, Loader2, RefreshCw, ShieldCheck, ChevronDown, User, Mail, FileDigit, Phone, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  user_id: string;
};

type PaymentMethod = "pix" | "credit_card" | "boleto";
type CheckoutState = "form" | "pending" | "approved" | "failed";

function getCheckoutSessionId(slug: string): string {
  const key = `checkout_session_${slug}`;
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

function clearCheckoutSession(slug: string) {
  sessionStorage.removeItem(`checkout_session_${slug}`);
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

  // Countdown timer (15 min)
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");

  useEffect(() => {
    if (!slug) return;
    supabase.from("products").select("*").eq("status", "active").ilike("checkout_url", `%/${slug}`).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) setProduct(data as Product);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (checkoutState !== "pending" || !transactionId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("transactions")
        .select("status")
        .eq("id", transactionId)
        .single();
      if (data?.status === "completed") {
        setCheckoutState("approved");
        clearCheckoutSession(slug || "");
        clearInterval(interval);
      } else if (data?.status === "failed" || data?.status === "cancelled") {
        setCheckoutState("failed");
        clearCheckoutSession(slug || "");
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [checkoutState, transactionId, slug]);

  const formatCpf = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    if (digits.length <= 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  };

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || processingRef.current) return;

    if (email !== emailConfirm) {
      toast.error("Os e-mails não coincidem");
      return;
    }

    processingRef.current = true;
    setProcessing(true);

    try {
      const sessionId = getCheckoutSessionId(slug || "default");
      const payload: Record<string, unknown> = {
        productId: product.id,
        paymentMethod: method,
        customerName: name,
        customerEmail: email,
        customerDocument: document.replace(/\D/g, ""),
        checkoutSessionId: sessionId,
      };

      if (method === "credit_card") {
        payload.installments = parseInt(installments);
        payload.cardData = {
          number: cardNumber.replace(/\s/g, ""),
          holderName: cardName,
          expMonth: parseInt(cardExpiry.split("/")[0]),
          expYear: 2000 + parseInt(cardExpiry.split("/")[1] || "0"),
          cvv: cardCvv,
        };
      }

      const { data, error } = await supabase.functions.invoke("podpay-create-transaction", { body: payload });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Erro ao processar pagamento");
        setCheckoutState("failed");
        return;
      }

      const result = data.data;
      setTransactionId(result.transactionId);

      if (data.resumed) {
        if (result.pix) setPixData(result.pix);
        if (result.boleto) setBoletoData(result.boleto);
        setCheckoutState("pending");
        toast.info("Retomando pagamento pendente...");
        return;
      }

      if (method === "pix" && result.pix) {
        setPixData(result.pix);
        setCheckoutState("pending");
        toast.success("QR Code PIX gerado!");
      } else if (method === "boleto" && result.boleto) {
        setBoletoData(result.boleto);
        setCheckoutState("pending");
        toast.success("Boleto gerado!");
      } else if (method === "credit_card") {
        if (result.status === "paid" || result.status === "approved") {
          setCheckoutState("approved");
          clearCheckoutSession(slug || "");
          toast.success("Pagamento aprovado!");
        } else if (result.secureUrl) {
          window.location.href = result.secureUrl;
        } else {
          setCheckoutState("approved");
          clearCheckoutSession(slug || "");
          toast.success("Pagamento processado!");
        }
      } else {
        setCheckoutState("approved");
        clearCheckoutSession(slug || "");
        toast.success("Pagamento processado!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado ao processar pagamento");
      setCheckoutState("failed");
    } finally {
      setProcessing(false);
      processingRef.current = false;
    }
  };

  const retryPayment = () => {
    clearCheckoutSession(slug || "");
    setCheckoutState("form");
    setPixData(null);
    setBoletoData(null);
    setTransactionId(null);
  };

  // === LOADING ===
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // === NOT FOUND ===
  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] text-white px-4">
        <div className="text-center">
          <Sparkles className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-1">Produto não encontrado</h1>
          <p className="text-sm text-white/40">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const price = Number(product.price);
  const installmentOptions = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const val = n === 1 ? price : price * (1 + 0.0199 * (n - 1)) / n;
    return { n, val, total: n === 1 ? price : val * n };
  });
  const selectedInstallment = installmentOptions[parseInt(installments) - 1];

  // === APPROVED ===
  if (checkoutState === "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0d0d0d] text-white">
        <div className="text-center animate-fade-in max-w-md">
          <div className="relative mx-auto mb-8 w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl animate-pulse" />
            <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Pagamento Confirmado!</h1>
          <p className="text-white/50 mb-8">
            Seu pagamento de <strong className="text-emerald-400">R$ {price.toFixed(2)}</strong> foi aprovado com sucesso.
          </p>
          <div className="rounded-2xl p-5 bg-white/[0.04] border border-white/10">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Produto</p>
            <p className="font-semibold text-lg">{product.name}</p>
          </div>
          <p className="text-xs text-white/30 mt-6">Confirmação enviada para {email}</p>
        </div>
      </div>
    );
  }

  // === FAILED ===
  if (checkoutState === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0d0d0d] text-white">
        <div className="text-center animate-fade-in max-w-md">
          <div className="relative mx-auto mb-8 w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-red-500/20 blur-2xl animate-pulse" />
            <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-2xl">
              <CreditCard className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Pagamento Recusado</h1>
          <p className="text-white/50 mb-8">Não foi possível processar. Tente novamente.</p>
          <Button
            onClick={retryPayment}
            className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl h-12 px-8 gap-2 font-semibold"
          >
            <RefreshCw className="h-4 w-4" /> Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  // === PENDING (PIX / Boleto) ===
  if (checkoutState === "pending") {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white">
        <div className="max-w-lg mx-auto px-4 py-10 md:py-16">
          {/* Product */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-14 w-14 rounded-xl object-cover" />
              ) : (
                <Sparkles className="h-6 w-6 text-white/30" />
              )}
            </div>
            <div>
              <h2 className="font-bold">{product.name}</h2>
              <p className="text-emerald-400 font-bold text-lg">R$ {price.toFixed(2)}</p>
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 px-4 py-2 rounded-full text-sm font-medium">
              <Clock className="h-4 w-4" /> Aguardando Pagamento
            </div>
          </div>

          {pixData && (
            <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/10 mb-6">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-5 justify-center text-emerald-400">
                <QrCode className="h-4 w-4" /> Escaneie o QR Code PIX
              </h3>
              {(pixData.qrcode || pixData.qrCode || pixData.qrCodeText) && (
                <div className="flex justify-center mb-5">
                  <div className="bg-white p-4 rounded-2xl">
                    <QRCodeSVG value={pixData.qrcode || pixData.qrCodeText || pixData.qrCode} size={200} />
                  </div>
                </div>
              )}
              <p className="text-xs text-white/30 mb-4 text-center">Expira em 30 minutos</p>
              {(pixData.qrcode || pixData.qrCodeText) && (
                <Button
                  type="button"
                  className="w-full gap-2 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white rounded-xl h-12"
                  onClick={() => { navigator.clipboard.writeText(pixData.qrcode || pixData.qrCodeText); toast.success("Código copiado!"); }}
                >
                  <Copy className="h-4 w-4" /> Copiar código PIX
                </Button>
              )}
            </div>
          )}

          {boletoData && (
            <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/10 mb-6 space-y-3">
              <h3 className="text-sm font-semibold text-center text-emerald-400">Boleto gerado</h3>
              {boletoData.url && (
                <Button type="button" className="w-full gap-2 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white rounded-xl h-12"
                  onClick={() => window.open(boletoData.url, "_blank")}>
                  <FileText className="h-4 w-4" /> Visualizar Boleto
                </Button>
              )}
              {boletoData.barCode && (
                <Button type="button" className="w-full gap-2 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white rounded-xl h-12"
                  onClick={() => { navigator.clipboard.writeText(boletoData.barCode); toast.success("Código copiado!"); }}>
                  <Copy className="h-4 w-4" /> Copiar código de barras
                </Button>
              )}
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-white/20 flex items-center justify-center gap-1 mb-3">
              <RefreshCw className="h-3 w-3 animate-spin" /> Verificando status automaticamente...
            </p>
            <button className="text-xs text-white/30 hover:text-white/60 underline" onClick={retryPayment}>
              Cancelar e tentar outro método
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // === FORM STATE — Kirvano-style premium checkout ====================
  // ====================================================================
  const inputClass =
    "mt-1 h-11 rounded-lg bg-[#1a1a1f] border-[#2a2a30] text-white placeholder:text-white/25 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm";

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Urgency bar */}
      <div className="sticky top-0 z-50 bg-[#111115]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-[660px] mx-auto px-4 py-2.5 flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="bg-[#1a1a1f] border border-white/10 rounded-md px-2.5 py-1 text-lg font-bold tabular-nums">{minutes}</span>
            <span className="text-white/30 text-lg font-bold">:</span>
            <span className="bg-[#1a1a1f] border border-white/10 rounded-md px-2.5 py-1 text-lg font-bold tabular-nums">{seconds}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-white/50">Oferta por tempo limitado.</span>
            <span className="text-amber-400 font-semibold">Finalize sua compra!</span>
          </div>
        </div>
      </div>

      <div className="max-w-[660px] mx-auto px-4 py-6 md:py-10">
        {/* Product card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#131316] p-5 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-emerald-400" />
                </div>
              )}
            </div>
            <div>
              <h1 className="font-bold text-base">{product.name}</h1>
              <p className="text-emerald-400 font-bold text-lg">R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handlePay} className="space-y-5">
          {/* ===== DADOS PESSOAIS ===== */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#131316] p-5 space-y-4">
            {/* Email row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-white/60 font-medium flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> Seu e-mail
                </Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Insira seu e-mail" required type="email" className={inputClass} />
              </div>
              <div>
                <Label className="text-xs text-white/60 font-medium">Confirme seu e-mail</Label>
                <Input value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} placeholder="Insira novamente seu e-mail" required type="email" className={inputClass} />
              </div>
            </div>

            {/* Name */}
            <div>
              <Label className="text-xs text-white/60 font-medium flex items-center gap-1.5">
                <User className="h-3 w-3" /> Nome completo
              </Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Insira seu nome completo" required className={inputClass} />
            </div>

            {/* CPF + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-white/60 font-medium flex items-center gap-1.5">
                  <FileDigit className="h-3 w-3" /> CPF/CNPJ
                </Label>
                <Input value={document} onChange={(e) => setDocument(formatCpf(e.target.value))} placeholder="Insira seu CPF ou CNPJ" required className={inputClass} />
              </div>
              <div>
                <Label className="text-xs text-white/60 font-medium flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> Seu celular
                </Label>
                <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" className={inputClass} />
              </div>
            </div>
          </section>

          {/* ===== MÉTODO DE PAGAMENTO ===== */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#131316] p-5">
            <div className="flex gap-3 mb-5">
              {([
                { id: "credit_card" as const, icon: CreditCard, label: "Cartão de crédito" },
                { id: "pix" as const, icon: QrCode, label: "Pix" },
                { id: "boleto" as const, icon: FileText, label: "Boleto" },
              ]).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMethod(m.id); setPixData(null); setBoletoData(null); }}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    method === m.id
                      ? "bg-white/[0.06] border-emerald-500/50 text-white shadow-sm shadow-emerald-500/10"
                      : "bg-transparent border-white/10 text-white/40 hover:text-white/60 hover:border-white/20"
                  }`}
                >
                  <m.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{m.label}</span>
                  <span className="sm:hidden">{m.id === "credit_card" ? "Cartão" : m.label}</span>
                </button>
              ))}
            </div>

            {/* Credit Card Fields */}
            {method === "credit_card" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-white/60 font-medium">Número do cartão</Label>
                  <Input value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" required className={inputClass} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-white/60 font-medium">Validade</Label>
                    <Input value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" required className={inputClass} />
                  </div>
                  <div>
                    <Label className="text-xs text-white/60 font-medium">CVV</Label>
                    <Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" required className={inputClass} />
                  </div>
                  <div>
                    <Label className="text-xs text-white/60 font-medium">Parcelas</Label>
                    <div className="relative mt-1">
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(e.target.value)}
                        className="w-full h-11 rounded-lg border bg-[#1a1a1f] border-[#2a2a30] text-white text-sm px-3 pr-8 appearance-none focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all"
                      >
                        {installmentOptions.map((opt) => (
                          <option key={opt.n} value={opt.n} className="bg-[#1a1a1f]">
                            {opt.n}x R$ {opt.val.toFixed(2)}{opt.n > 1 ? "*" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-white/60 font-medium">Nome do titular</Label>
                  <Input value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} placeholder="Insira o nome impresso no cartão" required className={inputClass} />
                </div>
              </div>
            )}

            {/* PIX info */}
            {method === "pix" && (
              <div className="flex items-center gap-3 py-2">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Pagamento instantâneo via PIX</p>
                  <p className="text-xs text-white/30">O QR Code será gerado após clicar em "Comprar agora"</p>
                </div>
              </div>
            )}

            {/* Boleto info */}
            {method === "boleto" && (
              <div className="flex items-center gap-3 py-2">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Boleto Bancário</p>
                  <p className="text-xs text-white/30">Compensação em 1-3 dias úteis</p>
                </div>
              </div>
            )}
          </section>

          {/* ===== RESUMO ===== */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#131316] p-5">
            <h3 className="text-sm font-bold mb-4">Resumo</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">{product.name}</span>
                <span className="text-white font-medium">R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Subtotal</span>
                <span className="text-white font-medium">R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-white/[0.06] pt-2.5 flex justify-between items-center">
                <span className="font-bold">Total</span>
                <span className="font-bold text-emerald-400 text-lg">
                  {method === "credit_card" && installments !== "1"
                    ? `${installments}x R$ ${selectedInstallment.val.toFixed(2)}`
                    : `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  }
                </span>
              </div>
            </div>
          </section>

          {/* ===== CTA ===== */}
          <Button
            type="submit"
            disabled={processing}
            className="w-full h-14 text-base font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:shadow-emerald-500/30 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Processando...
              </span>
            ) : (
              "Comprar agora"
            )}
          </Button>

          {/* ===== TRUST ===== */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <ShieldCheck className="h-4 w-4 text-white/20" />
            <div className="text-center">
              <p className="text-xs text-white/40 font-medium">Ambiente seguro</p>
              <p className="text-[10px] text-white/20">Seus dados são confidenciais</p>
            </div>
          </div>

          <p className="text-center text-[10px] text-white/15 leading-relaxed px-4 mt-2">
            Ao clicar em "Comprar agora", declaro que li e concordo com os{" "}
            <span className="underline">Termos de Compra</span> e{" "}
            <span className="underline">Política de Privacidade</span>.
          </p>
        </form>
      </div>
    </div>
  );
}
