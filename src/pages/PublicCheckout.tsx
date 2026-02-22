import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, QrCode, FileText, Shield, CheckCircle2, Copy, Clock, Lock, Loader2 } from "lucide-react";
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

export default function PublicCheckout() {
  const { slug } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [processing, setProcessing] = useState(false);
  const [paid, setPaid] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Payment result
  const [pixData, setPixData] = useState<any>(null);
  const [boletoData, setBoletoData] = useState<any>(null);

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
    if (!product) return;
    setProcessing(true);

    try {
      const payload: Record<string, unknown> = {
        productId: product.id,
        paymentMethod: method,
        customerName: name,
        customerEmail: email,
        customerDocument: document,
      };

      if (method === "credit_card") {
        payload.installments = parseInt(installments);
        // In production, card data would be tokenized via PodSub.encrypt()
        // For now we send card details through the secure edge function
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
        setProcessing(false);
        return;
      }

      const result = data.data;

      if (method === "pix" && result.pix) {
        setPixData(result.pix);
        toast.success("QR Code PIX gerado!");
      } else if (method === "boleto" && result.boleto) {
        setBoletoData(result.boleto);
        toast.success("Boleto gerado!");
      } else if (method === "credit_card") {
        if (result.status === "paid" || result.status === "approved") {
          setPaid(true);
          toast.success("Pagamento aprovado!");
        } else if (result.secureUrl) {
          // 3DS redirect
          window.location.href = result.secureUrl;
        } else {
          setPaid(true);
          toast.success("Pagamento processado!");
        }
      } else {
        toast.success("Pagamento processado!");
        setPaid(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado ao processar pagamento");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-[#0a0a0a] text-white" : "bg-gray-50 text-gray-900"}`}>
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-[#0a0a0a] text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Produto não encontrado</h1>
          <p className="text-gray-500">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (paid) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${darkMode ? "bg-[#0a0a0a] text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="text-center animate-slide-up max-w-md">
          <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Pagamento Confirmado!</h1>
          <p className="text-gray-500 mb-6">Seu pagamento de <strong className={darkMode ? "text-white" : "text-gray-900"}>R$ {Number(product.price).toFixed(2)}</strong> foi processado com sucesso.</p>
          <div className={`rounded-xl p-4 ${darkMode ? "bg-white/5 border border-white/10" : "bg-gray-100 border border-gray-200"}`}>
            <p className="text-sm text-gray-500">Produto</p>
            <p className="font-semibold">{product.name}</p>
          </div>
          <p className="text-xs text-gray-500 mt-6">Um e-mail de confirmação será enviado para {email}</p>
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

  const bg = darkMode ? "bg-[#0a0a0a] text-white" : "bg-gray-50 text-gray-900";
  const card = darkMode ? "bg-white/[0.03] border border-white/10" : "bg-white border border-gray-200 shadow-sm";
  const inputCls = darkMode ? "bg-white/5 border-white/10 text-white placeholder:text-gray-500" : "";

  return (
    <div className={`min-h-screen ${bg}`}>
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-4 right-4 z-50 text-xs px-3 py-1.5 rounded-full border transition-colors"
        style={{
          borderColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          backgroundColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
        }}
      >
        {darkMode ? "☀️ Light" : "🌙 Dark"}
      </button>

      <div className="max-w-lg mx-auto px-4 py-8 md:py-16">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-emerald-500 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold mb-1">{product.name}</h1>
          {product.description && <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{product.description}</p>}
        </div>

        <div className={`rounded-2xl p-6 mb-6 text-center ${card}`}>
          <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} mb-1`}>Total a pagar</p>
          <p className="text-4xl font-bold tracking-tight">
            R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          {method === "credit_card" && installments !== "1" && (
            <p className="text-sm text-emerald-500 mt-1">
              ou {installments}x de R$ {installmentOptions[parseInt(installments) - 1]?.val.toFixed(2)}
            </p>
          )}
        </div>

        {/* Payment method tabs */}
        <div className={`flex rounded-xl p-1 mb-6 ${darkMode ? "bg-white/[0.03] border border-white/10" : "bg-gray-100 border border-gray-200"}`}>
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
                  : darkMode ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={handlePay}>
          {/* Customer info */}
          <div className={`rounded-2xl p-5 mb-4 space-y-4 ${card}`}>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="h-1 w-4 bg-emerald-500 rounded-full" />
              Seus dados
            </h3>
            <div>
              <Label className="text-xs">Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={document} onChange={(e) => setDocument(formatCpf(e.target.value))} placeholder="000.000.000-00" required className={`mt-1 ${inputCls}`} />
            </div>
          </div>

          {/* PIX */}
          {method === "pix" && (
            <div className={`rounded-2xl p-5 mb-4 ${card}`}>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                <span className="h-1 w-4 bg-emerald-500 rounded-full" />
                Pagamento via PIX
              </h3>
              {pixData ? (
                <div className="flex flex-col items-center">
                  {pixData.qrCode && (
                    <img src={`data:image/png;base64,${pixData.qrCode}`} alt="QR Code PIX" className="h-48 w-48 rounded-xl mb-4" />
                  )}
                  <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"} mb-3 flex items-center gap-1`}>
                    <Clock className="h-3 w-3" /> Expira em 30 minutos
                  </p>
                  {pixData.qrCodeText && (
                    <Button
                      type="button" variant="outline" size="sm" className="gap-2"
                      onClick={() => { navigator.clipboard.writeText(pixData.qrCodeText); toast.success("Código copiado!"); }}
                    >
                      <Copy className="h-3 w-3" /> Copiar código PIX
                    </Button>
                  )}
                </div>
              ) : (
                <p className={`text-sm text-center ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Clique em "Pagar" para gerar o QR Code PIX
                </p>
              )}
            </div>
          )}

          {/* Credit Card */}
          {method === "credit_card" && (
            <div className={`rounded-2xl p-5 mb-4 space-y-4 ${card}`}>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="h-1 w-4 bg-emerald-500 rounded-full" />
                Dados do Cartão
              </h3>
              <div>
                <Label className="text-xs">Número do cartão</Label>
                <Input value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" required className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <Label className="text-xs">Nome no cartão</Label>
                <Input value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} placeholder="Como está no cartão" required className={`mt-1 ${inputCls}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Validade</Label>
                  <Input value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" required className={`mt-1 ${inputCls}`} />
                </div>
                <div>
                  <Label className="text-xs">CVV</Label>
                  <Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" required className={`mt-1 ${inputCls}`} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Parcelas</Label>
                <select
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  className={`w-full mt-1 h-10 rounded-md border px-3 text-sm ${darkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200"}`}
                >
                  {installmentOptions.map((opt) => (
                    <option key={opt.n} value={opt.n} className={darkMode ? "bg-[#1a1a1a]" : ""}>
                      {opt.n}x de R$ {opt.val.toFixed(2)} {opt.n === 1 ? "(à vista)" : `(total R$ ${opt.total.toFixed(2)})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Boleto */}
          {method === "boleto" && (
            <div className={`rounded-2xl p-5 mb-4 ${card}`}>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <span className="h-1 w-4 bg-emerald-500 rounded-full" />
                Boleto Bancário
              </h3>
              {boletoData ? (
                <div className="text-center space-y-3">
                  <p className="text-sm">Boleto gerado! Vencimento em 3 dias úteis.</p>
                  {boletoData.url && (
                    <Button type="button" variant="outline" size="sm" onClick={() => window.open(boletoData.url, "_blank")}>
                      Visualizar Boleto
                    </Button>
                  )}
                  {boletoData.barCode && (
                    <Button type="button" variant="outline" size="sm" className="gap-2"
                      onClick={() => { navigator.clipboard.writeText(boletoData.barCode); toast.success("Código copiado!"); }}
                    >
                      <Copy className="h-3 w-3" /> Copiar código de barras
                    </Button>
                  )}
                </div>
              ) : (
                <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  O boleto será gerado após a confirmação. Prazo de compensação: 1-3 dias úteis.
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          {!pixData && !boletoData && (
            <Button
              type="submit"
              disabled={processing}
              className="w-full h-14 text-base font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all"
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </span>
              ) : (
                `Pagar R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              )}
            </Button>
          )}

          {/* Security badges */}
          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> SSL Seguro</span>
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Dados protegidos</span>
          </div>

          <p className="text-center text-xs text-gray-500 mt-4">
            Processado com segurança
          </p>
        </form>
      </div>
    </div>
  );
}
