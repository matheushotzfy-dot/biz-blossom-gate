/**
 * Questions — acordeão minimalista de linhas.
 */
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export const QA = [
  {
    q: "Quanto tempo leva para o dinheiro ficar disponível?",
    a: "Vendas no Pix ficam disponíveis no mesmo dia. Cartão segue o prazo padrão de recebíveis, com antecipação opcional direto no painel.",
  },
  {
    q: "Preciso ter CNPJ para vender?",
    a: "Não. Pessoa física opera normalmente. O CNPJ é opcional e traz benefícios adicionais na emissão de nota fiscal.",
  },
  {
    q: "Como funciona o split com afiliados e coprodutores?",
    a: "Você define os percentuais uma vez no produto. Na aprovação, cada parte é creditada automaticamente no próprio saldo.",
  },
  {
    q: "Existe mensalidade ou taxa de adesão?",
    a: "Não existe mensalidade, adesão nem custo por produto criado. A plataforma é remunerada apenas pela taxa da transação aprovada.",
  },
  {
    q: "Posso integrar a VENXPAY na minha própria aplicação?",
    a: "Sim. A API REST cobre criação de cobrança, consulta, reembolso e estorno, com webhooks assinados em HMAC-SHA256.",
  },
  {
    q: "A área de membros está inclusa?",
    a: "Está. Você publica módulos, aulas e certificados, e o acesso do aluno é liberado no instante em que o pagamento é aprovado.",
  },
];

export function Questions() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section id="perguntas" className="vx-cv relative py-28 sm:py-36">
      <div className="mx-auto max-w-[1280px] px-5">
        <span className="vx-mono">perguntas</span>
        <h2 className="mt-5 max-w-[16ch] text-[38px] font-extrabold text-foreground sm:text-[58px]">
          Respostas diretas, sem letra miúda
        </h2>

        <div className="mt-14 border-t border-border">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-b border-border">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-8 py-6 text-left"
                >
                  <span
                    className={cn(
                      "text-[16px] font-bold transition-colors duration-300 sm:text-[19px]",
                      isOpen ? "text-primary" : "text-foreground",
                    )}
                  >
                    {item.q}
                  </span>
                  <span
                    className={cn(
                      "vx-mono shrink-0 transition-colors duration-300",
                      isOpen && "vx-mono-on",
                    )}
                  >
                    {isOpen ? "fechar" : "abrir"}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-[70ch] pb-7 text-[14px] leading-[1.8] text-muted-foreground">{item.a}</p>
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
