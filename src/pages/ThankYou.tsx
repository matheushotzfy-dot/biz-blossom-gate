import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Package, ArrowRight, Download, ShieldCheck, Sparkles, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

type TxInfo = {
  product_name: string;
  amount: number;
  payment_method: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
};

export default function ThankYou() {
  const [params] = useSearchParams();
  const txId = params.get("tx");
  const [tx, setTx] = useState<TxInfo | null>(null);
  const [loading, setLoading] = useState(true);

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
            .from("products")
            .select("name")
            .eq("id", data.product_id)
            .single();
          if (prod) productName = prod.name;
        }
        setTx({
          product_name: productName,
          amount: data.amount,
          payment_method: data.payment_method,
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          status: data.status,
        });
      }
      setLoading(false);
    })();
  }, [txId]);

  const paymentLabel: Record<string, string> = {
    pix: "PIX",
    credit_card: "Cartão de Crédito",
    boleto: "Boleto Bancário",
  };

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
        {/* Success card */}
        <div className="bg-card rounded-3xl border border-border/40 shadow-2xl shadow-primary/5 overflow-hidden">
          {/* Top gradient bar */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-primary" />

          <div className="p-8 sm:p-10 text-center">
            {/* Animated check */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 12 }}
              className="mx-auto mb-6"
            >
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/20 mx-auto">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
            </motion.div>

            {/* Sparkles */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-2 mb-3"
            >
              <Sparkles className="h-4 w-4 text-primary/60" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary/70">Compra Confirmada</span>
              <Sparkles className="h-4 w-4 text-primary/60" />
            </motion.div>

            <h1 className="text-2xl font-display font-black text-foreground tracking-[-0.04em] mb-2">
              Obrigado pela sua compra!
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Seu pagamento foi processado com sucesso. Confira os detalhes abaixo.
            </p>

            {/* Order details */}
            {tx && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-muted/30 rounded-2xl p-5 mb-8 text-left space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-bold text-foreground truncate">{tx.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {paymentLabel[tx.payment_method || ""] || tx.payment_method || "—"}
                    </p>
                  </div>
                  <span className="text-lg font-display font-black text-foreground font-numbers tabular-nums">
                    R$ {Number(tx.amount).toFixed(2).replace(".", ",")}
                  </span>
                </div>

                {tx.customer_email && (
                  <div className="pt-3 border-t border-border/30">
                    <p className="text-xs text-muted-foreground">
                      Recibo enviado para <span className="text-foreground font-medium">{tx.customer_email}</span>
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Security badge */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <ShieldCheck className="h-4 w-4 text-primary/50" />
              <span className="text-[11px] text-muted-foreground/60">Transação segura e criptografada</span>
            </div>

            {/* CTA */}
            {tx?.customer_email && (
              <Link to="/membros-area/login">
                <Button
                  className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-sm gap-2 hover:opacity-90 transition-opacity"
                >
                  Acessar Área de Membros
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Footer links */}
        <div className="flex justify-center gap-6 mt-6">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <Home className="h-3 w-3" />
            Página Inicial
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
