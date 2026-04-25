import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Package, ArrowRight, ShieldCheck, Sparkles, Home, Zap, Gift, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type TxInfo = {
 product_name: string;
 amount: number;
 payment_method: string | null;
 customer_name: string | null;
 customer_email: string | null;
 status: string;
 product_id: string | null;
};

type UpsellOffer = {
 id: string;
 name: string;
 price: number;
 image_url: string | null;
 checkout_url: string | null;
};

export default function ThankYou() {
 const [params] = useSearchParams();
 const txId = params.get("tx");
 const [tx, setTx] = useState<TxInfo | null>(null);
 const [loading, setLoading] = useState(true);
 const [upsells, setUpsells] = useState<UpsellOffer[]>([]);
 const [upsellTimer, setUpsellTimer] = useState(600);
 const [dismissed, setDismissed] = useState(false);

 useEffect(() => {
 if (!txId) { setLoading(false); return; }
 (async () => {
 const { data } = await supabase
 .from("transactions")
 .select("amount, payment_method, customer_name, customer_email, status, product_id")
 .eq("id", txId)
 .single();
 if (data) {
 let productName = "Produto";
 if (data.product_id) {
  const { data: prod } = await supabase
  .from("products_public")
  .select("name")
  .eq("id", data.product_id)
  .maybeSingle();
  if (prod) productName = prod.name;

  const { data: bumps } = await supabase
  .from("order_bumps")
  .select("bump_product_id")
  .eq("product_id", data.product_id)
  .eq("is_active", true)
  .limit(3);
  if (bumps && bumps.length > 0) {
  const bumpIds = bumps.map(b => b.bump_product_id);
  const { data: bumpProducts } = await supabase
  .from("products_public")
  .select("id, name, price, image_url, checkout_url")
  .in("id", bumpIds)
  .eq("status", "active");
  if (bumpProducts) setUpsells(bumpProducts);
  }
 }
 setTx({
 product_name: productName,
 amount: data.amount,
 payment_method: data.payment_method,
 customer_name: data.customer_name,
 customer_email: data.customer_email,
 status: data.status,
 product_id: data.product_id,
 });
 }
 setLoading(false);
 })();
 }, [txId]);

 useEffect(() => {
 if (upsells.length === 0 || dismissed) return;
 const interval = setInterval(() => {
 setUpsellTimer(prev => {
 if (prev <= 1) { setDismissed(true); return 0; }
 return prev - 1;
 });
 }, 1000);
 return () => clearInterval(interval);
 }, [upsells.length, dismissed]);

 const paymentLabel: Record<string, string> = {
 pix: "PIX", credit_card: "Cartão de Crédito", boleto: "Boleto Bancário",
 };
 const fmtTimer = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
 const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

 if (loading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background flex items-center justify-center p-4">
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: 20 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
 className="max-w-lg w-full"
 >
 <div className="bg-card rounded-3xl border border-border/40 shadow-2xl shadow-primary/5 overflow-hidden">
 <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-primary" />
 <div className="p-8 sm:p-10 text-center">
 <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 12 }} className="mx-auto mb-6">
 <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/20 mx-auto">
 <CheckCircle2 className="h-10 w-10 text-primary" />
 </div>
 </motion.div>

 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center justify-center gap-2 mb-3">
 <Sparkles className="h-4 w-4 text-primary/60" />
 <span className="text-xs font-bold uppercase tracking-widest text-primary/70">Compra Confirmada</span>
 <Sparkles className="h-4 w-4 text-primary/60" />
 </motion.div>

 <h1 className="text-2xl font-display font-black text-foreground tracking-[-0.04em] mb-2">Obrigado pela sua compra!</h1>
 <p className="text-sm text-muted-foreground mb-8">Seu pagamento foi processado com sucesso. Confira os detalhes abaixo.</p>

 {tx && (
 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-muted/30 rounded-2xl p-5 mb-8 text-left space-y-3">
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Package className="h-5 w-5 text-primary" /></div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-display font-bold text-foreground truncate">{tx.product_name}</p>
 <p className="text-xs text-muted-foreground">{paymentLabel[tx.payment_method || ""] || tx.payment_method || "—"}</p>
 </div>
 <span className="text-lg font-display font-black text-foreground font-numbers tabular-nums">R$ {Number(tx.amount).toFixed(2).replace(".", ",")}</span>
 </div>
 {tx.customer_email && (
 <div className="pt-3 border-t border-border/30">
 <p className="text-xs text-muted-foreground">Recibo enviado para <span className="text-foreground font-medium">{tx.customer_email}</span></p>
 </div>
 )}
 </motion.div>
 )}

 {/* ─── UPSELL/DOWNSELL OFFERS ─── */}
 {upsells.length > 0 && !dismissed && (
 <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mb-8">
 <div className="flex items-center justify-center gap-2 mb-3">
 <Gift className="h-4 w-4 text-warning" />
 <span className="text-xs font-bold uppercase tracking-widest text-warning">Oferta Exclusiva</span>
 <div className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/20">
 <Clock className="h-3 w-3 text-destructive" />
 <span className="text-[10px] font-bold text-destructive font-mono">{fmtTimer(upsellTimer)}</span>
 </div>
 </div>
 <p className="text-xs text-muted-foreground mb-4">Aproveite estas ofertas especiais — disponíveis apenas agora!</p>
 <div className="grid gap-3">
 {upsells.map((offer, i) => (
 <motion.div key={offer.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.1 }}
 className="flex items-center gap-3 p-3 rounded-xl border border-warning/20 bg-warning/5 hover:bg-warning/10 transition-colors">
 {offer.image_url ? (
 <img src={offer.image_url} alt={offer.name} className="h-12 w-12 rounded-lg object-cover" />
 ) : (
 <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center"><Zap className="h-5 w-5 text-warning" /></div>
 )}
 <div className="flex-1 min-w-0 text-left">
 <p className="text-sm font-bold text-foreground truncate">{offer.name}</p>
 <p className="text-xs text-warning font-bold">{fmt(offer.price)}</p>
 </div>
 <a href={offer.checkout_url || `/pay/${offer.id}`}
 className={cn("shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all", "bg-warning text-warning-foreground hover:opacity-90 shadow-sm")}>
 Quero!
 </a>
 </motion.div>
 ))}
 </div>
 <button onClick={() => setDismissed(true)} className="mt-3 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
 Não, obrigado
 </button>
 </motion.div>
 )}

 <div className="flex items-center justify-center gap-2 mb-6">
 <ShieldCheck className="h-4 w-4 text-primary/50" />
 <span className="text-[11px] text-muted-foreground/60">Transação segura e criptografada</span>
 </div>

 {tx?.customer_email && (
 <Link to="/membros-area/login">
 <Button className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-sm gap-2 hover:opacity-90 transition-opacity">
 Acessar Área de Membros <ArrowRight className="h-4 w-4" />
 </Button>
 </Link>
 )}
 </div>
 </div>

 <div className="flex justify-center gap-6 mt-6">
 <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
 <Home className="h-3 w-3" /> Página Inicial
 </Link>
 </div>
 </motion.div>
 </div>
 );
}
