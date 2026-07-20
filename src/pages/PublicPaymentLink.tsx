import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Link2, Loader2, Copy, CheckCircle2, Clock, AlertCircle, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { HotzfyLogo } from "@/components/HotzfyLogo";

type PayLink = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  amount: number;
  accept_pix: boolean;
  accept_card: boolean;
  is_active: boolean;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
};

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const maskCpfCnpj = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/\.$|-$/, "");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/[./-]+$/, "");
};

export default function PublicPaymentLink() {
  const { slug } = useParams<{ slug: string }>();
  const [link, setLink] = useState<PayLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", document: "" });
  const [generating, setGenerating] = useState(false);
  const [pix, setPix] = useState<{ qrcode: string; expiresAt: string; transactionId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"pending" | "paid" | "expired">("pending");

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_public_payment_link", { _slug: slug });
      const row = (Array.isArray(data) ? data[0] : data) as PayLink | null;
      if (!row || !row.is_active) { setNotFound(true); setLoading(false); return; }
      setLink(row);
      supabase.rpc("increment_payment_link_clicks", { _slug: slug }).then(() => null);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!pix?.transactionId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("transactions").select("status").eq("id", pix.transactionId).maybeSingle();
      if (data?.status === "approved" || data?.status === "completed" || data?.status === "paid") {
        setStatus("paid"); clearInterval(interval);
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [pix?.transactionId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;
    if (form.name.trim().length < 3) { toast.error("Nome inválido"); return; }
    const doc = form.document.replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) { toast.error("CPF ou CNPJ inválido"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("pay-link-pix", {
        body: {
          slug: link.slug,
          customerName: form.name.trim(),
          customerEmail: form.email.trim(),
          customerDocument: doc,
        },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Falha ao gerar PIX. Tente novamente.");
        return;
      }
      setPix({
        qrcode: data.data.pix?.qrcode || data.data.pix?.copyPaste || "",
        expiresAt: data.data.pix?.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        transactionId: data.data.transactionId,
      });
    } finally { setGenerating(false); }
  };

  const copyPix = () => {
    if (!pix?.qrcode) return;
    navigator.clipboard.writeText(pix.qrcode);
    setCopied(true);
    toast.success("PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (notFound || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="font-display font-black text-2xl">Link não encontrado</h1>
          <p className="text-muted-foreground">Este link de pagamento não existe ou foi desativado pelo vendedor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/[0.03] py-8 px-4">
      <Seo title={`${link.title} · Pague com PIX`} description={link.description || `Pagamento seguro via PIX no valor de ${fmt(link.amount)}`} path={`/pl/${slug}`} noindex />

      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-center gap-2 mb-6">
          <HotzfyLogo className="h-8 w-auto" />
        </div>

        <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-xl">
          {link.cover_url && status !== "paid" && (
            <div className="aspect-[16/9] w-full bg-muted overflow-hidden">
              <img src={link.cover_url} alt={link.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-6 md:p-8">
            {status === "paid" ? (
              <div className="text-center py-8 space-y-4">
                <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                </div>
                <h1 className="font-display font-black text-2xl">Pagamento confirmado!</h1>
                <p className="text-muted-foreground">Obrigado por sua compra. Você já pode fechar esta página.</p>
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Comprovante</p>
                  <p className="font-mono text-xs mt-1 break-all">{pix?.transactionId}</p>
                </div>
              </div>
            ) : !pix ? (
              <>
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cobrança</p>
                  <h1 className="font-display font-black text-xl leading-tight mt-0.5">{link.title}</h1>
                  {link.description && (
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">{link.description}</p>
                  )}
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Valor a pagar</p>
                  <p className="font-display font-black text-3xl text-primary tabular-nums mt-1">{fmt(link.amount)}</p>
                </div>

                <form onSubmit={handleGenerate} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nome completo</label>
                    <input required minLength={3} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                      className="mt-1.5 w-full h-11 rounded-xl border border-border/60 bg-background px-3.5 text-sm focus:border-primary/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">E-mail</label>
                    <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                      className="mt-1.5 w-full h-11 rounded-xl border border-border/60 bg-background px-3.5 text-sm focus:border-primary/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CPF ou CNPJ</label>
                    <input required inputMode="numeric" value={form.document}
                      onChange={e => setForm({ ...form, document: maskCpfCnpj(e.target.value) })}
                      className="mt-1.5 w-full h-11 rounded-xl border border-border/60 bg-background px-3.5 text-sm focus:border-primary/50 focus:outline-none tabular-nums" />
                  </div>
                  <button type="submit" disabled={generating}
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs mt-2 flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60">
                    {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</> : <><QrCode className="h-4 w-4" /> Gerar PIX</>}
                  </button>
                </form>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                    <Clock className="h-3 w-3" /> Aguardando pagamento
                  </div>
                  <p className="font-display font-black text-3xl text-primary tabular-nums mt-3">{fmt(link.amount)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Escaneie o QR Code ou copie o código PIX</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">PIX Copia e Cola</p>
                  <div className="rounded-xl border border-border/60 bg-background p-3 max-h-32 overflow-y-auto">
                    <p className="font-mono text-[11px] break-all leading-relaxed">{pix.qrcode}</p>
                  </div>
                  <button onClick={copyPix} className="mt-3 w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2">
                    {copied ? <><CheckCircle2 className="h-4 w-4" /> Copiado!</> : <><Copy className="h-4 w-4" /> Copiar PIX</>}
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground text-center">
                  O pagamento é confirmado automaticamente em segundos. Não feche esta página.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <ShieldCheck className="h-3 w-3" /> Pagamento processado por Hotzfy
        </div>
      </div>
    </div>
  );
}
