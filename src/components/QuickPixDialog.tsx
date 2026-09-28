import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  Loader2,
  QrCode,
  ShieldCheck,
  Timer,
  User,
  FileText,
  Mail,
  CircleDollarSign,
  ArrowLeft,
  CheckCircle2,
  Link2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  const idempotencyKeyRef = useRef(crypto.randomUUID());

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
    idempotencyKeyRef.current = crypto.randomUUID();
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
          idempotencyKey: idempotencyKeyRef.current,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Erro ao gerar PIX");
        setSubmitting(false);
        return;
      }
      setResult(data.data as PixResult);
      setStep("result");
    } catch {
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

  const ease = "transition-all duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[700px] max-h-[90vh] overflow-y-auto p-0 rounded-[28px] border border-border bg-card">
        {/* Header — solid, no gradients/blur */}
        <div className="relative px-7 pt-7 pb-6 border-b border-border bg-card sm:px-9">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                {step === "form" ? (
                  <Link2 className="h-5 w-5" strokeWidth={2.5} />
                ) : (
                  <QrCode className="h-5 w-5" strokeWidth={2.5} />
                )}
              </div>
              <div>
                <DialogTitle className="font-display text-xl font-bold tracking-tight text-foreground">
                  {step === "form" ? "Gerar cobrança Pix" : "Pix gerado"}
                </DialogTitle>
                <p className="text-[12.5px] text-muted-foreground mt-0.5">
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
          <div className="px-7 py-6 space-y-5 bg-card sm:px-9">
            {/* Amount — large input */}
            <div className="space-y-2">
              <Label className="text-[12px] font-semibold text-muted-foreground">
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
                  className={cn(
                    "h-16 pl-12 font-display text-[30px] font-bold tabular-nums tracking-tight rounded-2xl border border-primary/40 bg-primary/[0.05]",
                    ease,
                    "focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/50",
                  )}
                  placeholder="R$ 0,00"
                  style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                />
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[5000, 10000, 25000, 50000].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAmountCents(c)}
                    className={cn(
                      "h-9 rounded-full border text-[12px] font-semibold tabular-nums transition-all active:scale-[0.97]",
                      amountCents === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/40 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    R$ {c / 100}
                  </button>
                ))}
              </div>
              {amountCents > 0 && amountCents < 100 && (
                <p className="text-[11px] text-destructive font-bold">
                  Valor mínimo: R$ 1,00
                </p>
              )}
            </div>

            {/* Payer fields — compact two-column grid keeps the dialog short */}
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[12px] font-semibold text-muted-foreground">
                  Nome do pagador
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn("h-12 pl-10 rounded-2xl border border-border/80 bg-card-inset text-[13px] font-bold focus-visible:border-primary/45 focus-visible:ring-primary/20", ease)}
                    placeholder="Nome completo"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[12px] font-semibold text-muted-foreground">
                  CPF / CNPJ
                </Label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={doc}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 14);
                      setDoc(d.length <= 11 ? fmtCpf(d) : d);
                    }}
                    inputMode="numeric"
                    className={cn("h-12 pl-10 rounded-2xl border border-border/80 bg-card-inset font-mono text-[12.5px] font-bold tabular-nums focus-visible:border-primary/45 focus-visible:ring-primary/20", ease)}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[12px] font-semibold text-muted-foreground">
                  E-mail <span className="opacity-60 normal-case font-bold">(opcional)</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn("h-12 pl-10 rounded-2xl border border-border/80 bg-card-inset text-[13px] font-bold focus-visible:border-primary/45 focus-visible:ring-primary/20", ease)}
                    placeholder="email@exemplo.com"
                    type="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[12px] font-semibold text-muted-foreground">
                  Descrição <span className="opacity-60 normal-case font-bold">(opcional)</span>
                </Label>
                <Input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value.slice(0, 100))}
                  className={cn("h-12 rounded-2xl border border-border/80 bg-card-inset text-[13px] font-bold focus-visible:border-primary/45 focus-visible:ring-primary/20", ease)}
                  placeholder="Ex: Consultoria, Mentoria..."
                />
              </div>
            </div>

            {/* Trust row */}
            <div className="flex items-center gap-2 pt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-success" strokeWidth={2.25} />
              <p className="text-[10.5px] font-medium text-muted-foreground">
                Processado com criptografia bancária
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!valid || submitting}
              className={cn(
                "group relative w-full h-14 overflow-hidden rounded-2xl font-display text-[14px] font-bold active:scale-[0.98]",
                "flex items-center justify-center gap-2 bg-primary text-primary-foreground",
                "transition-colors duration-200 hover:bg-primary/90",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando PIX…
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4" strokeWidth={2.25} />
                  Gerar PIX
                  <span className="mx-1 h-3.5 w-px bg-primary-foreground/30" />
                  <span className="tabular-nums">{fmtBrl(amountCents)}</span>
                </>
              )}
            </button>

          </div>
        )}

        {step === "result" && result && (
          <div className="px-7 py-6 bg-card sm:px-9 sm:py-7">
            {paid ? (
              <div className="flex flex-col items-center text-center py-6 space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-success/10 border border-success/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-success" strokeWidth={2.25} />
                </div>
                <div>
                  <h3 className="font-display text-xl font-black tracking-[-0.02em]">Pagamento confirmado</h3>
                  <p className="font-display text-[28px] font-black text-success tabular-nums mt-1">
                    {fmtBrl(Math.round(result.amount * 100))}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Recebido com sucesso
                  </p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "w-full max-w-xs h-11 rounded-xl bg-primary text-primary-foreground font-display font-black text-[12px] uppercase tracking-[0.14em]",
                    "hover:bg-primary/90 active:scale-[0.985] border border-primary/40",
                    ease,
                  )}
                >
                  Fechar
                </button>
              </div>
            ) : (
              /* Two-column layout: QR stays fixed on the left, details on the right —
                 no vertical scrolling needed to see the full content. */
              <div className="grid items-start gap-7 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-9">
                {/* QR column */}
                <div className="flex flex-col items-center gap-4 justify-self-center">
                  {pixCode && (
                    <div className="p-4 rounded-2xl bg-white border border-border">
                      <QRCodeSVG
                        value={pixCode}
                        size={210}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setStep("form")}
                    className={cn(
                      "text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5",
                      ease,
                    )}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Gerar outro PIX
                  </button>
                </div>

                {/* Details column */}
                <div className="min-w-0 space-y-4">
                  {/* Amount + Timer */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-background">
                    <div>
                      <p className="text-[12px] font-semibold text-muted-foreground">
                        Valor a receber
                      </p>
                      <p className="font-display text-[26px] font-black tabular-nums tracking-[-0.03em] text-foreground leading-none mt-1.5"
                         style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}>
                        {fmtBrl(Math.round(result.amount * 100))}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card">
                      <Timer className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-[11px] font-black text-foreground tabular-nums">
                        {mmss}
                      </span>
                    </div>
                  </div>

                  {/* Copy code */}
                  <div className="space-y-2">
                    <Label className="text-[12px] font-semibold text-muted-foreground">
                      PIX copia e cola
                    </Label>
                    <div className="relative">
                      <div className="p-3 pr-12 rounded-xl border border-border bg-muted/40 font-mono text-[10.5px] text-muted-foreground break-all max-h-20 overflow-hidden">
                        {pixCode || "—"}
                      </div>
                      <button
                        onClick={copyCode}
                        disabled={!pixCode}
                        className={cn(
                          "absolute right-2 top-2 h-8 w-8 rounded-md bg-primary text-primary-foreground border border-primary/40 flex items-center justify-center",
                          "hover:bg-primary/90 active:scale-95",
                          ease,
                        )}
                        aria-label="Copiar código"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={copyCode}
                    disabled={!pixCode}
                    className={cn(
                      "w-full h-12 rounded-xl font-display text-[12.5px] font-bold uppercase tracking-[0.12em] flex items-center justify-center gap-2",
                      "bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Código copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copiar código PIX
                      </>
                    )}
                  </button>

                  {/* Status */}
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
                    </span>
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Aguardando pagamento
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
