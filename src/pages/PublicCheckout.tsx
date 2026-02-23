import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, QrCode, FileText, Shield, CheckCircle2, Copy, Clock, Lock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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

// Generate a unique session ID per checkout attempt
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
  const processingRef = useRef(false); // Anti double-click

  // Payment result
  const [pixData, setPixData] = useState<any>(null);
  const [boletoData, setBoletoData] = useState<any>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Customer form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");

  // Card
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [installments, setInstallments] = useState("1");

  useEffect(() => {
    if (!slug) return;
    supabase.from("products").select("*").eq("status", "active").ilike("checkout_url", `%${slug}%`).limit(1).single()
      .then(({ data }) => {
        if (data) setProduct(data as Product);
        setLoading(false);
      });
  }, [slug]);

  // Poll payment status when pending
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

      const { data, error } = await supabase.functions.invoke("podpay-create-transaction", {
        body: payload,
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Erro ao processar pagamento");
        setCheckoutState("failed");
        return;
      }

      const result = data.data;
      setTransactionId(result.transactionId);

      if (data.resumed) {
        // Resumed existing payment
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Produto não encontrado</h1>
          <p className="text-gray-500">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  // === APPROVED STATE ===
  if (checkoutState === "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0a] text-white">
        <div className="text-center animate-slide-up max-w-md">
          <div className="h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6 ring-2 ring-emerald-500/30">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Pagamento Confirmado!</h1>
          <p className="text-gray-400 mb-6">
            Seu pagamento de <strong className="text-white">R$ {Number(product.price).toFixed(2)}</strong> foi processado com sucesso.
          </p>
          <div className="rounded-xl p-4 bg-white/5 border border-white/10">
            <p className="text-sm text-gray-500">Produto</p>
            <p className="font-semibold">{product.name}</p>
          </div>
          <p className="text-xs text-gray-500 mt-6">Confirmação enviada para {email}</p>
        </div>
      </div>
    );
  }

  // === FAILED STATE ===
  if (checkoutState === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0a] text-white">
        <div className="text-center animate-slide-up max-w-md">
          <div className="h-24 w-24 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 ring-2 ring-red-500/30">
            <CreditCard className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Pagamento Recusado</h1>
          <p className="text-gray-400 mb-6">
            Não foi possível processar o pagamento. Tente novamente com outro método ou cartão.
          </p>
          <Button
            onClick={retryPayment}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 px-8 gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  // === PENDING STATE (PIX/Boleto waiting) ===
  if (checkoutState === "pending") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-16">
          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4 ring-2 ring-yellow-500/30 animate-pulse">
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
            <h1 className="text-2xl font-bold mb-1">Pagamento Pendente</h1>
            <p className="text-gray-400 text-sm">Aguardando confirmação do pagamento</p>
          </div>

          <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/10 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400 text-sm">Produto</span>
              <span className="font-semibold">{product.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Valor</span>
              <span className="font-bold text-xl text-emerald-400">R$ {Number(product.price).toFixed(2)}</span>
            </div>
          </div>

          {/* PIX QR Code */}
          {pixData && (
            <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/10 mb-6">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-4 text-center justify-center">
                <QrCode className="h-4 w-4 text-emerald-400" /> Escaneie o QR Code PIX
              </h3>
              {pixData.qrCode && (
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-3 rounded-xl">
                    <img src={`data:image/png;base64,${pixData.qrCode}`} alt="QR Code PIX" className="h-48 w-48" />
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400 mb-3 flex items-center gap-1 justify-center">
                <Clock className="h-3 w-3" /> Expira em 30 minutos
              </p>
              {pixData.qrCodeText && (
                <Button
                  type="button" variant="outline" className="w-full gap-2 border-white/10 hover:bg-white/5"
                  onClick={() => { navigator.clipboard.writeText(pixData.qrCodeText); toast.success("Código copiado!"); }}
                >
                  <Copy className="h-4 w-4" /> Copiar código PIX
                </Button>
              )}
            </div>
          )}

          {/* Boleto */}
          {boletoData && (
            <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/10 mb-6 space-y-3">
              <h3 className="text-sm font-semibold text-center">Boleto gerado — vencimento em 3 dias úteis</h3>
              {boletoData.url && (
                <Button type="button" variant="outline" className="w-full gap-2 border-white/10 hover:bg-white/5"
                  onClick={() => window.open(boletoData.url, "_blank")}>
                  <FileText className="h-4 w-4" /> Visualizar Boleto
                </Button>
              )}
              {boletoData.barCode && (
                <Button type="button" variant="outline" className="w-full gap-2 border-white/10 hover:bg-white/5"
                  onClick={() => { navigator.clipboard.writeText(boletoData.barCode); toast.success("Código copiado!"); }}>
                  <Copy className="h-4 w-4" /> Copiar código de barras
                </Button>
              )}
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-4">
              <RefreshCw className="h-3 w-3 animate-spin" /> Verificando status automaticamente...
            </p>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-white" onClick={retryPayment}>
              Cancelar e tentar outro método
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // === FORM STATE ===
  const price = Number(product.price);
  const installmentOptions = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const val = n === 1 ? price : price * (1 + 0.0199 * (n - 1)) / n;
    return { n, val, total: n === 1 ? price : val * n };
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-lg mx-auto px-4 py-8 md:py-16">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold mb-1">{product.name}</h1>
          {product.description && <p className="text-sm text-gray-400">{product.description}</p>}
        </div>

        {/* Price card */}
        <div className="rounded-2xl p-6 mb-6 text-center bg-white/[0.03] border border-white/10 backdrop-blur-sm">
          <p className="text-sm text-gray-400 mb-1">Total a pagar</p>
          <p className="text-4xl font-bold tracking-tight">
            R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          {method === "credit_card" && installments !== "1" && (
            <p className="text-sm text-emerald-400 mt-1">
              ou {installments}x de R$ {installmentOptions[parseInt(installments) - 1]?.val.toFixed(2)}
            </p>
          )}
        </div>

        {/* Payment method tabs */}
        <div className="flex rounded-xl p-1 mb-6 bg-white/[0.03] border border-white/10">
          {([
            { id: "pix" as const, icon: QrCode, label: "PIX" },
            { id: "credit_card" as const, icon: CreditCard, label: "Cartão" },
            { id: "boleto" as const, icon: FileText, label: "Boleto" },
          ]).map((m) => (
            <button
              key={m.id}
              onClick={() => { setMethod(m.id); setPixData(null); setBoletoData(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
                method === m.id
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={handlePay}>
          {/* Customer info */}
          <div className="rounded-2xl p-5 mb-4 space-y-4 bg-white/[0.03] border border-white/10">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="h-1 w-4 bg-emerald-500 rounded-full" />
              Seus dados
            </h3>
            <div>
              <Label className="text-xs text-gray-300">Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            </div>
            <div>
              <Label className="text-xs text-gray-300">E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            </div>
            <div>
              <Label className="text-xs text-gray-300">CPF</Label>
              <Input value={document} onChange={(e) => setDocument(formatCpf(e.target.value))} placeholder="000.000.000-00" required className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            </div>
          </div>

          {/* PIX info */}
          {method === "pix" && (
            <div className="rounded-2xl p-5 mb-4 bg-white/[0.03] border border-white/10">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <span className="h-1 w-4 bg-emerald-500 rounded-full" />
                Pagamento via PIX
              </h3>
              <p className="text-sm text-gray-400">
                Clique em "Pagar" para gerar o QR Code PIX. Pagamento confirmado instantaneamente.
              </p>
            </div>
          )}

          {/* Credit Card */}
          {method === "credit_card" && (
            <div className="rounded-2xl p-5 mb-4 space-y-4 bg-white/[0.03] border border-white/10">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="h-1 w-4 bg-emerald-500 rounded-full" />
                Dados do Cartão
              </h3>
              <div>
                <Label className="text-xs text-gray-300">Número do cartão</Label>
                <Input value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" required className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              <div>
                <Label className="text-xs text-gray-300">Nome no cartão</Label>
                <Input value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} placeholder="Como está no cartão" required className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-300">Validade</Label>
                  <Input value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" required className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
                </div>
                <div>
                  <Label className="text-xs text-gray-300">CVV</Label>
                  <Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" required className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-300">Parcelas</Label>
                <select
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  className="w-full mt-1 h-10 rounded-md border bg-white/5 border-white/10 text-white px-3 text-sm"
                >
                  {installmentOptions.map((opt) => (
                    <option key={opt.n} value={opt.n} className="bg-[#1a1a1a]">
                      {opt.n}x de R$ {opt.val.toFixed(2)} {opt.n === 1 ? "(à vista)" : `(total R$ ${opt.total.toFixed(2)})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Boleto info */}
          {method === "boleto" && (
            <div className="rounded-2xl p-5 mb-4 bg-white/[0.03] border border-white/10">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <span className="h-1 w-4 bg-emerald-500 rounded-full" />
                Boleto Bancário
              </h3>
              <p className="text-sm text-gray-400">
                O boleto será gerado após clicar em "Pagar". Prazo de compensação: 1-3 dias úteis.
              </p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={processing}
            className="w-full h-14 text-base font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </span>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Pagar R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </>
            )}
          </Button>

          {/* Security badges */}
          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> SSL Seguro</span>
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Dados protegidos</span>
          </div>

          <p className="text-center text-[10px] text-gray-600 mt-4">
            Processado com segurança • Ao pagar você concorda com os termos de uso
          </p>
        </form>
      </div>
    </div>
  );
}
