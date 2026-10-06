import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

const SALES = [
  { id: "a", time: "21:04:08", method: "PIX", value: "R$ 297,00", status: "APROVADO" },
  { id: "b", time: "21:04:11", method: "CARTÃO 3X", value: "R$ 1.497,00", status: "APROVADO" },
  { id: "c", time: "21:04:17", method: "PIX", value: "R$ 47,90", status: "APROVADO" },
  { id: "d", time: "21:04:24", method: "CARTÃO 6X", value: "R$ 897,00", status: "APROVADO" },
];

export function ApprovalStrip() {
  const reduce = useReducedMotion();

  return (
    <section className="vx-ledger" aria-label="Pulso de vendas ilustrativo">
      <div className="vx-shell">
        <h2>Sua operação, em uma visão.</h2>
        <div className="vx-ledger-head">
          <p><span /> operação em movimento</p>
          <p>atualização contínua / dados ilustrativos</p>
        </div>
        <div className="vx-ledger-track">
          {SALES.map(({ id, time, method, value, status }, index) => (
            <motion.div
              key={id}
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