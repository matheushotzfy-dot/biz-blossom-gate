import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const QA = [
  { q: "Quanto tempo leva para o dinheiro ficar disponível?", a: "Vendas no Pix ficam disponíveis conforme as condições da conta. Cartão segue o prazo dos recebíveis, com acompanhamento direto no painel." },
  { q: "Preciso ter CNPJ para vender?", a: "Não. Pessoa física pode operar normalmente. O CNPJ é opcional e habilita recursos empresariais adicionais." },
  { q: "Como funciona o split com afiliados e coprodutores?", a: "Você define os percentuais no produto. Após a confirmação, cada parte é destinada ao saldo correto com registro da divisão." },
  { q: "Existe mensalidade ou taxa de adesão?", a: "Não existe mensalidade, adesão ou custo por produto criado. As condições aplicáveis ficam visíveis antes da operação." },
  { q: "Posso integrar a VENXPAY na minha aplicação?", a: "Sim. A API cobre cobranças e consultas, enquanto webhooks assinados informam as mudanças relevantes." },
  { q: "A área de membros está inclusa?", a: "Sim. Módulos, aulas e certificados ficam ligados ao produto, e o acesso depende da confirmação do pagamento." },
];

export function Questions() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section id="perguntas">
      <div className="vx-shell vx-faq-layout">
        <div><span className="vx-kicker">07 / PERGUNTAS</span><h2>Direto ao ponto.</h2></div>
        <div className="vx-faq-list">
          {QA.map((item, itemIndex) => {
            const isOpen = open === itemIndex;
            return (
              <div key={item.q} className="vx-faq-item">
                <Button
                  type="button"
                  variant="ghost"
                  aria-expanded={isOpen}
                  aria-controls={`vx-faq-answer-${itemIndex}`}
                  onClick={() => setOpen(isOpen ? null : itemIndex)}
                  className="vx-faq-trigger"
                >
                  <span>{item.q}</span>{isOpen ? <Minus /> : <Plus />}
                </Button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`vx-faq-answer-${itemIndex}`}
                      role="region"
                      aria-label={item.q}
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: .32, ease: [0.16, 1, 0.3, 1] }}
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