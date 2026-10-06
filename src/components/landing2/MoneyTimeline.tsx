import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Rise } from "./bits";

const STEPS = [
  { code: "01", title: "Entrada", copy: "O pedido nasce com identidade própria e os dados necessários para seguir com segurança." },
  { code: "02", title: "Análise", copy: "Sinais de risco e contexto da compra são avaliados antes da autorização." },
  { code: "03", title: "Aprovação", copy: "A confirmação atualiza operação, acesso e comunicação sem intervenção manual." },
  { code: "04", title: "Divisão", copy: "Cada participante recebe exatamente a parcela definida para aquela venda." },
  { code: "05", title: "Liquidação", copy: "O valor chega ao saldo correto com origem, taxas e histórico rastreáveis." },
];

export function MoneyTimeline() {
  const reduce = useReducedMotion();

  return (
    <section id="fluxo" className="vx-section vx-flow">
      <div className="vx-shell">
        <div className="vx-section-intro">
          <span className="vx-kicker">01 / O FLUXO</span>
          <h2>O dinheiro não desaparece entre sistemas.</h2>
          <p>Cada etapa deixa um sinal. Cada sinal pode ser acompanhado.</p>
        </div>

        <div className="vx-flow-map">
          <motion.div
            className="vx-flow-progress"
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
          />
          {STEPS.map((step, index) => (
            <Rise key={step.code} delay={index * 0.08} className="vx-flow-step">
              <div className="vx-flow-node">{index < STEPS.length - 1 ? <ArrowRight /> : <span />}</div>
              <span>{step.code}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}