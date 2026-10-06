import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

const SALES = [
  ["21:04:08", "PIX", "R$ 297,00", "APROVADO"],
  ["21:04:11", "CARTÃO 3X", "R$ 1.497,00", "APROVADO"],
  ["21:04:17", "PIX", "R$ 47,90", "APROVADO"],
  ["21:04:24", "CARTÃO 6X", "R$ 897,00", "APROVADO"],
];

export function ApprovalStrip() {
  const reduce = useReducedMotion();

  return (
    <section className="vx-ledger" aria-label="Pulso de vendas ilustrativo">
      <div className="vx-shell">
        <div className="vx-ledger-head">
          <p><span /> operação em movimento</p>
          <p>atualização contínua / dados ilustrativos</p>
        </div>
        <div className="vx-ledger-track">
          {[...SALES, ...SALES].map(([time, method, value, status], index) => (
            <motion.div
              key={`${time}-${index}`}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (index % 4) * 0.07 }}
              className="vx-ledger-row"
            >
              <span>{time}</span><span>{method}</span><strong>{value}</strong>
              <span className="vx-approved"><Check /> {status}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}