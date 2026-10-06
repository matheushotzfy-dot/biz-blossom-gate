/**
 * Pilha de notificações "Venda aprovada" em loop (dados fixos, ilustrativos).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAKE_SALES, type FakeSale } from "./salesFeed";
import { brl } from "./bits";

export interface SaleToastsProps {
  className?: string;
  /** Quantas notificações ficam visíveis ao mesmo tempo. */
  visible?: number;
  interval?: number;
  offset?: number;
}

interface Entry extends FakeSale { key: string; }

export function SaleToasts({ className, visible = 3, interval = 2400, offset = 0 }: SaleToastsProps) {
  const reduce = useReducedMotion();
  const [cursor, setCursor] = useState(offset + visible);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setCursor((c) => c + 1), interval);
    return () => window.clearInterval(id);
  }, [reduce, interval]);

  const items: Entry[] = Array.from({ length: visible }, (_, i) => {
    const n = cursor - i;
    const sale = FAKE_SALES[((n % FAKE_SALES.length) + FAKE_SALES.length) % FAKE_SALES.length];
    return { ...sale, key: `${sale.id}-${n}` };
  });

  return (
    <ul className={cn("vx3-toasts", className)} aria-hidden>
      <AnimatePresence initial={false}>
        {items.map((sale, i) => (
          <motion.li
            key={sale.key}
            layout
            initial={{ opacity: 0, y: -24, scale: 0.92 }}
            animate={{ opacity: 1 - i * 0.22, y: 0, scale: 1 - i * 0.03 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="vx3-toast"
          >
            <span className="vx3-toast-icon"><CheckCircle2 /></span>
            <span className="min-w-0 flex-1">
              <b>Venda aprovada · {sale.method}</b>
              <small>{sale.product}</small>
            </span>
            <strong className="vx3-num">{brl(sale.amount)}</strong>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
