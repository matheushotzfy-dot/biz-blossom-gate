import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  Loader2,
  QrCode,
  ShieldCheck,
  Sparkles,
  Timer,
  User,
  FileText,
  Mail,
  CircleDollarSign,
  ArrowLeft,
  PartyPopper,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type PixResult = {
  transactionId: string;
  podpayId: string;
  amount: number;
  pix: {
    qrcode?: string;
    qrcodeBase64?: string;
    expiresAt?: string;
  } | null;
};

const fmtCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const fmtBrl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function QuickPixDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<"form" | "result">("form");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  const [remaining, setRemaining] = useState(30 * 60);
  const [result, setResult] = useState<PixResult | null>(null);

  // form
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const [email, setEmail] = useState("");
  const [desc, setDesc] = useState("");
  const [amountCents, setAmountCents] = useState(0);

  const pollRef = useRef<number | null>(null);

  const reset = () => {
    setStep("form");
    setSubmitting(false);
    setCopied(false);
    setPaid(false);
    setRemaining(30 * 60);
    setResult(null);
    setName("");
    setDoc("");
    setEmail("");
    setDesc("");
    setAmountCents(0);
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // Countdown
  useEffect(() => {
    if (step !== "result" || paid) return;
    const id = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, paid]);

  // Polling status
  useEffect(() => {
    if (step !== "result" || !result?.transactionId || paid) return;
    pollRef.current = window.setInterval(async () => {
      const { data } = await supabase
        .from("transactions")
        .select("status")
        .eq("id", result.transactionId)
        .maybeSingle();
      if (data?.status === "completed") {
        setPaid(true);
        toast.success("Pagamento confirmado!");
        if (pollRef.current) window.clearInterval(pollRef.current);
      }
    }, 4000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [step, result?.transactionId, paid]);

  const docClean = doc.replace(/\D/g, "");
  const valid =
    name.trim().length >= 3 &&
    (docClean.length === 11 || docClean.length === 14) &&
    amountCents >= 100;

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("quick-pix", {
        body: {
          amount: amountCents / 100,
          customerName: name.trim(),
          customerDocument: docClean,
          customerEmail: email.trim() || undefined,
          description: desc.trim() || undefined,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Erro ao gerar PIX");
        setSubmitting(false);
        return;
      }
      setResult(data.data as PixResult);
      setStep("result");
    } catch (e) {
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const pixCode = result?.pix?.qrcode || "";

  const copyCode = async () => {
    if (!pixCode) return;
    await navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const mmss = useMemo(() => {
    const m = Math.floor(remaining / 60).toString().padStart(2, "0");
    const s = (remaining % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [remaining]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-border/60 bg-card rounded-3xl">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-border/40 bg-gradient-to-br from-primary/10 via-transparent to-success/5">
          <div className="absolute inset-0 opacity-30 pointer-events-none [background-image:radial-gradient(circle_at_30%_0%,hsl(var(--primary)/0.25),transparent_60%)]" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25">
                <QrCode className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tight">
                  {step === "form" ? "Gerar Link de Pagamento" : "PIX gerado"}
                </DialogTitle>
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                  {step === "form"
                    ? "Receba via PIX em segundos"
                    : "Compartilhe ou aguarde o pagamento"}
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        {step === "form" && (
          <div className="px-6 py-5 space-y-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Valor a cobrar
              </Label>
              <div className="relative">
                <CircleDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-success" />
                <Input
                  value={fmtBrl(amountCents)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                    setAmountCents(Number(digits || 0));
                  }}
                  inputMode="numeric"
                  className="h-14 pl-12 text-2xl font-black tracking-tight rounded-2xl border-border/60 bg-background/60 focus-visible:ring-primary/30"
                  placeholder="R$ 0,00"
                />
              </div>
              {amountCents > 0 && amountCents < 100 && (
                <p className="text-[11px] text-destructive font-medium">
                  Valor mínimo: R$ 1,00
                </p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Nome do pagador
              </Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 pl-11 rounded-xl border-border/60 bg-background/60"
                  placeholder="Nome completo"
                />
              </div>
            </div>

            {/* CPF + Email side-by-side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  CPF / CNPJ
                </Label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={doc}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 14);
                      setDoc(d.length <= 11 ? fmtCpf(d) : d);
                    }}
                    inputMode="numeric"
                    className="h-11 pl-11 rounded-xl border-border/60 bg-background/60 font-mono text-[13px]"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  E-mail <span className="opacity-50 normal-case font-medium">(opcional)</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-11 rounded-xl border-border/60 bg-background/60"
                    placeholder="email@exemplo.com"
                    type="email"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Descrição <span className="opacity-50 normal-case font-medium">(opcional)</span>
              </Label>
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value.slice(0, 100))}
                className="h-11 rounded-xl border-border/60 bg-background/60"
                placeholder="Ex: Consultoria, Mentoria..."
              />
            </div>

            {/* Trust row */}
            <div className="flex items-center gap-2 pt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <p className="text-[10px] font-medium text-muted-foreground">
                Pagamento processado com criptografia bancária
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!valid || submitting}
              className="w-full h-12 rounded-2xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25 disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Gerando PIX...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar PIX • {fmtBrl(amountCents)}
                </>
              )}
            </Button>
          </div>
        )}

        {step === "result" && result && (
          <div className="px-6 py-5 space-y-4">
            {paid ? (
              <div className="flex flex-col items-center text-center py-6 space-y-3">
                <div className="h-16 w-16 rounded-full bg-success/15 flex items-center justify-center ring-1 ring-success/30">
                  <PartyPopper className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h3 className="text-xl font-black">Pagamento confirmado!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {fmtBrl(Math.round(result.amount * 100))} recebidos
                  </p>
                </div>
                <Button
                  onClick={() => onOpenChange(false)}
                  className="w-full h-11 rounded-xl font-bold mt-2"
                >
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                {/* Amount + Timer */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-background/60 border border-border/40">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Valor a receber
                    </p>
                    <p className="text-2xl font-black tracking-tight text-foreground leading-tight">
                      {fmtBrl(Math.round(result.amount * 100))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                    <Timer className="h-3 w-3 text-primary" />
                    <span className="text-[11px] font-black font-mono text-primary tabular-nums">
                      {mmss}
                    </span>
                  </div>
                </div>

                {/* QR Code */}
                {pixCode && (
                  <div className="flex justify-center p-5 rounded-2xl bg-white border border-border/40">
                    <QRCodeSVG
                      value={pixCode}
                      size={200}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                )}

                {/* Copy code */}
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    PIX copia e cola
                  </Label>
                  <div className="relative">
                    <div className="p-3 pr-12 rounded-xl border border-border/60 bg-background/60 font-mono text-[10px] text-muted-foreground break-all max-h-20 overflow-hidden">
                      {pixCode || "—"}
                    </div>
                    <Button
                      size="icon"
                      onClick={copyCode}
                      disabled={!pixCode}
                      className="absolute right-2 top-2 h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={copyCode}
                  disabled={!pixCode}
                  className="w-full h-12 rounded-2xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Código copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar código PIX
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Aguardando pagamento...
                </div>

                <button
                  onClick={() => setStep("form")}
                  className="w-full text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Gerar outro PIX
                </button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
