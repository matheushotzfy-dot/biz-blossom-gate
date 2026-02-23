import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, QrCode, FileText, Shield, CheckCircle2, Copy, Clock, Lock, Loader2, RefreshCw, Sparkles, Zap, ShieldCheck } from "lucide-react";
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
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [processing, setProcessing] = useState(false);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("form");
  const processingRef = useRef(false);

  const [pixData, setPixData] = useState<any>(null);
  const [boletoData, setBoletoData] = useState<any>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [installments, setInstallments] = useState("1");

  useEffect(() => {
    if (!slug) return;
    // Match by slug at end of checkout_url
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
    const digits = v.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
    return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
  };

  const formatCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0,2)}/${digits.slice(2)}`;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    try {
      const sessionId = getCheckoutSessionId(slug || "default");
      const payload: Record<string, unknown> = {
        productId: product.id,
        paymentMethod: method,
        customerName: name,
        customerEmail: email,
        customerDocument: document,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#050505] via-[#0a0a0f] to-[#05050a]">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
          <Loader2 className="h-10 w-10 animate-spin text-emerald-400 relative z-10" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#050505] via-[#0a0a0f] to-[#05050a] text-white px-4">
        <div className="text-center">
          <div className="h-20 w-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="h-10 w-10 text-white/30" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Produto não encontrado</h1>
          <p className="text-white/40">Verifique o link e tente novamente.</p>
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

  // === APPROVED ===
  if (checkoutState === "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#050505] via-[#0a0a0f] to-[#05050a] text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/[0.02] rounded-full blur-3xl" />
        </div>
        <div className="text-center animate-slide-up max-w-md relative z-10">
          <div className="relative mx-auto mb-8 w-28 h-28">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
            <div className="relative h-28 w-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
              <CheckCircle2 className="h-14 w-14 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">Pagamento Confirmado!</h1>
          <p className="text-white/50 mb-8 text-lg">
            Seu pagamento de <strong className="text-emerald-400 font-semibold">R$ {price.toFixed(2)}</strong> foi aprovado.
          </p>
          <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Produto</p>
            <p className="font-semibold text-lg">{product.name}</p>
          </div>
          <p className="text-xs text-white/30 mt-8">Confirmação enviada para {email}</p>
        </div>
      </div>
    );
  }

  // === FAILED ===
  if (checkoutState === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#050505] via-[#0a0a0f] to-[#05050a] text-white">
        <div className="text-center animate-slide-up max-w-md">
          <div className="relative mx-auto mb-8 w-28 h-28">
            <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
            <div className="relative h-28 w-28 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-2xl shadow-red-500/30">
              <CreditCard className="h-14 w-14 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-3">Pagamento Recusado</h1>
          <p className="text-white/50 mb-8 text-lg">
            Não foi possível processar o pagamento. Tente novamente.
          </p>
          <Button
            onClick={retryPayment}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-2xl h-14 px-10 gap-2 text-base font-semibold shadow-xl shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 hover:scale-[1.02]"
          >
            <RefreshCw className="h-5 w-5" /> Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  // === PENDING ===
  if (checkoutState === "pending") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#0a0a0f] to-[#05050a] text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/[0.02] rounded-full blur-3xl" />
        </div>
        <div className="max-w-lg mx-auto px-4 py-12 md:py-20 relative z-10">
          <div className="text-center mb-10">
            <div className="relative mx-auto mb-6 w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
              <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/20">
                <Clock className="h-10 w-10 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">Aguardando Pagamento</h1>
            <p className="text-white/40">Finalize o pagamento para confirmar</p>
          </div>

          <div className="rounded-3xl p-6 bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm mb-6">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/[0.06]">
              <span className="text-white/40 text-sm">Produto</span>
              <span className="font-semibold">{product.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40 text-sm">Valor</span>
              <span className="font-bold text-2xl text-emerald-400">R$ {price.toFixed(2)}</span>
            </div>
          </div>

          {pixData && (
            <div className="rounded-3xl p-6 bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm mb-6">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-5 justify-center text-emerald-400">
                <QrCode className="h-4 w-4" /> Escaneie o QR Code PIX
              </h3>
              {(pixData.qrcode || pixData.qrCode || pixData.qrCodeText) && (
                <div className="flex justify-center mb-5">
                  <div className="bg-white p-4 rounded-2xl shadow-2xl">
                    <QRCodeSVG value={pixData.qrcode || pixData.qrCodeText || pixData.qrCode} size={208} />
                  </div>
                </div>
              )}
              <p className="text-xs text-white/30 mb-4 flex items-center gap-1 justify-center">
                <Clock className="h-3 w-3" /> Expira em 30 minutos
              </p>
              {(pixData.qrcode || pixData.qrCodeText) && (
                <Button
                  type="button"
                  className="w-full gap-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white rounded-2xl h-12 transition-all"
                  onClick={() => { navigator.clipboard.writeText(pixData.qrcode || pixData.qrCodeText); toast.success("Código copiado!"); }}
                >
                  <Copy className="h-4 w-4" /> Copiar código PIX
                </Button>
              )}
            </div>
          )}

          {boletoData && (
            <div className="rounded-3xl p-6 bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm mb-6 space-y-3">
              <h3 className="text-sm font-semibold text-center text-emerald-400">Boleto gerado — vencimento em 3 dias úteis</h3>
              {boletoData.url && (
                <Button type="button" className="w-full gap-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white rounded-2xl h-12"
                  onClick={() => window.open(boletoData.url, "_blank")}>
                  <FileText className="h-4 w-4" /> Visualizar Boleto
                </Button>
              )}
              {boletoData.barCode && (
                <Button type="button" className="w-full gap-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white rounded-2xl h-12"
                  onClick={() => { navigator.clipboard.writeText(boletoData.barCode); toast.success("Código copiado!"); }}>
                  <Copy className="h-4 w-4" /> Copiar código de barras
                </Button>
              )}
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-white/20 flex items-center justify-center gap-1 mb-4">
              <RefreshCw className="h-3 w-3 animate-spin" /> Verificando status automaticamente...
            </p>
            <Button variant="ghost" size="sm" className="text-white/30 hover:text-white" onClick={retryPayment}>
              Cancelar e tentar outro método
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // === FORM STATE ===
  const inputClass = "mt-1.5 h-12 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:ring-emerald-500/20 transition-all";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#0a0a0f] to-[#05050a] text-white relative overflow-hidden">
      {/* Ambient effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-emerald-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-emerald-500/[0.02] rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/[0.01] rounded-full blur-3xl" />
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-8 md:py-14 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-lg" />
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/25">
              <Zap className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-1.5 tracking-tight">{product.name}</h1>
          {product.description && <p className="text-sm text-white/40 max-w-xs mx-auto">{product.description}</p>}
        </div>

        {/* Price hero */}
        <div className="rounded-3xl p-7 mb-7 text-center bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-transparent" />
          <div className="relative z-10">
            <p className="text-xs text-white/30 uppercase tracking-[0.2em] mb-2 font-medium">Total a pagar</p>
            <p className="text-5xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            {method === "credit_card" && installments !== "1" && (
              <p className="text-sm text-emerald-400 mt-2 font-medium">
                ou {installments}x de R$ {installmentOptions[parseInt(installments) - 1]?.val.toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {/* Payment method tabs */}
        <div className="flex rounded-2xl p-1.5 mb-7 bg-white/[0.02] border border-white/[0.06]">
          {([
            { id: "pix" as const, icon: QrCode, label: "PIX", badge: "Instantâneo" },
            { id: "credit_card" as const, icon: CreditCard, label: "Cartão", badge: "Até 12x" },
            { id: "boleto" as const, icon: FileText, label: "Boleto", badge: "1-3 dias" },
          ]).map((m) => (
            <button
              key={m.id}
              onClick={() => { setMethod(m.id); setPixData(null); setBoletoData(null); }}
              className={`flex-1 flex flex-col items-center gap-1 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                method === m.id
                  ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              <m.icon className="h-5 w-5" />
              <span className="text-xs font-semibold">{m.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handlePay} className="space-y-5">
          {/* Customer info */}
          <div className="rounded-3xl p-6 space-y-4 bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 flex items-center gap-2">
              <span className="h-1 w-5 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" />
              Dados pessoais
            </h3>
            <div>
              <Label className="text-xs text-white/50 font-medium">Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" required className={inputClass} />
            </div>
            <div>
              <Label className="text-xs text-white/50 font-medium">E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className={inputClass} />
            </div>
            <div>
              <Label className="text-xs text-white/50 font-medium">CPF</Label>
              <Input value={document} onChange={(e) => setDocument(formatCpf(e.target.value))} placeholder="000.000.000-00" required className={inputClass} />
            </div>
          </div>

          {/* PIX info */}
          {method === "pix" && (
            <div className="rounded-3xl p-6 bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Pagamento via PIX</h3>
                  <p className="text-xs text-white/30">Confirmação instantânea</p>
                </div>
              </div>
              <p className="text-sm text-white/40">
                Clique em "Pagar" para gerar o QR Code PIX.
              </p>
            </div>
          )}

          {/* Credit Card */}
          {method === "credit_card" && (
            <div className="rounded-3xl p-6 space-y-4 bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 flex items-center gap-2">
                <span className="h-1 w-5 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" />
                Dados do cartão
              </h3>
              <div>
                <Label className="text-xs text-white/50 font-medium">Número do cartão</Label>
                <Input value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" required className={inputClass} />
              </div>
              <div>
                <Label className="text-xs text-white/50 font-medium">Nome no cartão</Label>
                <Input value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} placeholder="Como está no cartão" required className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-white/50 font-medium">Validade</Label>
                  <Input value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" required className={inputClass} />
                </div>
                <div>
                  <Label className="text-xs text-white/50 font-medium">CVV</Label>
                  <Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" required className={inputClass} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-white/50 font-medium">Parcelas</Label>
                <select
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  className="w-full mt-1.5 h-12 rounded-xl border bg-white/[0.04] border-white/[0.08] text-white px-4 text-sm focus:border-emerald-500/50 focus:outline-none transition-all"
                >
                  {installmentOptions.map((opt) => (
                    <option key={opt.n} value={opt.n} className="bg-[#111]">
                      {opt.n}x de R$ {opt.val.toFixed(2)} {opt.n === 1 ? "(à vista)" : `(total R$ ${opt.total.toFixed(2)})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Boleto info */}
          {method === "boleto" && (
            <div className="rounded-3xl p-6 bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Boleto Bancário</h3>
                  <p className="text-xs text-white/30">Compensação em 1-3 dias úteis</p>
                </div>
              </div>
              <p className="text-sm text-white/40">
                O boleto será gerado após clicar em "Pagar".
              </p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={processing}
            className="w-full h-[60px] text-base font-bold rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-2xl shadow-emerald-500/25 transition-all duration-300 hover:shadow-emerald-500/40 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Processando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Pagar R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            )}
          </Button>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-8 mt-8">
            <div className="flex flex-col items-center gap-1">
              <div className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="text-[10px] text-white/20 font-medium">SSL 256-bit</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="text-[10px] text-white/20 font-medium">Dados seguros</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="text-[10px] text-white/20 font-medium">Antifraude</span>
            </div>
          </div>

          <p className="text-center text-[10px] text-white/15 mt-4">
            Processado com segurança • Ao pagar você concorda com os termos de uso
          </p>
        </form>
      </div>
    </div>
  );
}
