import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHead } from "./bits";

export const QA = [
  { q: "Qual é a taxa de aprovação da Vemprapay?", a: "Trabalhamos com nominais e adquirências 100% exclusivas que mantêm a aprovação de PIX e cartão acima de 75%." },
  { q: "Como funciona o saque instantâneo?", a: "Você solicita o saque no painel e o valor disponível segue via PIX para a sua chave cadastrada." },
  { q: "Preciso ter CNPJ para vender?", a: "Não. Pessoa física pode operar normalmente. O CNPJ é opcional e habilita recursos empresariais adicionais." },
  { q: "Existe mensalidade ou taxa de adesão?", a: "Não. Sem mensalidade, sem adesão e sem custo por produto criado. As condições ficam visíveis antes de você vender." },
  { q: "Como funciona o split com afiliados e coprodutores?", a: "Você define os percentuais no produto. Após a confirmação, cada parte é destinada ao saldo correto com registro da divisão." },
  { q: "Posso integrar a Vemprapay na minha aplicação?", a: "Sim. A API cobre cobranças e consultas, e webhooks assinados informam cada mudança relevante." },
];

export function Questions() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section id="perguntas" className="vx3-section">
      <div className="vx3-shell vx3-faq">
        <SectionHead kicker="08 · Perguntas" title={<>Direto ao <em>ponto</em>.</>} />
        <div className="vx3-faq-list">
          {QA.map((item, i) => {
            const isOpen = open === i;
            const id = `vx3-faq-${i}`;
            return (
              <div key={item.q} className={cn("vx3-faq-item", isOpen && "is-open")}>
                <button type="button" aria-expanded={isOpen} aria-controls={id} onClick={() => setOpen(isOpen ? null : i)}>
                  <span>{item.q}</span>
                  <Plus aria-hidden />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={id}
                      role="region"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p>{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
