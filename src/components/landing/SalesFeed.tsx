/**
 * SalesFeed — pilha de notificações de vendas aprovadas usada na composição do
 * hero da landing page. Puramente apresentacional: os dados são estáticos e
 * rotacionam apenas para transmitir a sensação de operação ao vivo.
 */
import { memo, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface Sale {
  readonly product: string;
  readonly value: string;
  readonly ago: string;
}

const SALES: readonly Sale[] = [
  { product: "Mentoria Escala 7", value: "R$ 1.997,00", ago: "há 2s" },
  { product: "Pack Criativos Pro", value: "R$ 297,00", ago: "há 9s" },
  { product: "Comunidade Black", value: "R$ 89,90", ago: "há 21s" },
  { product: "Trilha Copy 360", value: "R$ 1.469,42", ago: "há 34s" },
  { product: "Curso Tráfego Real", value: "R$ 697,00", ago: "há 48s" },
  { product: "Assinatura Insiders", value: "R$ 149,00", ago: "há 1min" },
  { product: "Workshop Fechamento", value: "R$ 497,00", ago: "há 1min" },
];

export const SalesFeed = memo(function SalesFeed() {
  const reduce = useReducedMotion();
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setOffset((o) => (o + 1) % SALES.length), 3200);
    return () => window.clearInterval(id);
  }, [reduce]);

  const visible = Array.from({ length: 6 }, (_, i) => SALES[(offset + i) % SALES.length]);

  return (
    <div className="lp-feed" aria-hidden>
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="lp-mono text-[10px] uppercase text-muted-foreground">Vendas ao vivo</span>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-primary">
          <span className="lp-dot" /> agora
        </span>
      </div>
      <div className="grid gap-2">
        {visible.map((sale, i) => (
          <motion.div
            key={`${sale.product}-${offset}-${i}`}
            initial={reduce ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1 - i * 0.11, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="lp-feed-card"
          >
            <span className="lp-feed-icon">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-foreground">
                Venda aprovada no Pix
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{sale.product}</span>
            </span>
            <span className="text-right">
              <span className="lp-mono block text-[12px] font-bold text-primary">{sale.value}</span>
              <span className="block text-[10px] text-muted-foreground">{sale.ago}</span>
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

export default SalesFeed;
