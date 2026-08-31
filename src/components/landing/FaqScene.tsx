/**
 * FaqScene — perguntas frequentes com abertura controlada e animação de altura.
 */
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHead } from "./parts";

export const FAQ_ITEMS = [
  {
    q: "Quanto tempo leva para o dinheiro ficar disponível?",
    a: "Vendas no Pix ficam disponíveis no mesmo dia. Cartão segue o prazo padrão de recebíveis, com antecipação opcional direto no painel.",
  },
  {
    q: "Preciso ter CNPJ para vender?",
    a: "Não. Pessoa física pode operar normalmente. O CNPJ é opcional e traz benefícios adicionais na emissão de nota fiscal.",
  },
  {
    q: "Como funciona o split com afiliados e coprodutores?",
    a: "Você define os percentuais uma vez no produto. No momento da aprovação, cada parte é creditada automaticamente no próprio saldo.",
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

export function FaqScene() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section id="faq" className="venx-cv relative py-28 sm:py-36">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionHead kicker="Dúvidas" title={<>Respostas diretas, sem letra miúda</>} />

        <div className="divide-y divide-border border-y border-border">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-start justify-between gap-6 py-6 text-left transition-colors duration-300 hover:text-primary"
                >
                  <span className="text-[15.5px] font-bold text-foreground">{item.q}</span>
                  <Plus
                    className={cn(
                      "mt-0.5 h-4.5 w-4.5 shrink-0 text-primary transition-transform duration-400",
                      isOpen && "rotate-45",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-6 text-[14px] leading-[1.75] text-muted-foreground">{item.a}</p>
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
