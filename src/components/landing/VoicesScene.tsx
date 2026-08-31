/**
 * VoicesScene — depoimentos em formato editorial: retrato grande, citação em
 * destaque e transição por corte controlada pelo visitante.
 */
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHead } from "./parts";
import voice1 from "@/assets/landing/voice-1.jpg";
import voice2 from "@/assets/landing/voice-2.jpg";
import voice3 from "@/assets/landing/voice-3.jpg";

const VOICES = [
  {
    photo: voice1,
    name: "Rafael Andrade",
    role: "Educação · 3 produtos",
    quote:
      "Migrei sete operações em uma semana. O que pesou de verdade foi o saque cair no mesmo dia — eu reinvisto em tráfego sem esperar o mês fechar.",
  },
  {
    photo: voice2,
    name: "Camila Nunes",
    role: "Mentorias de alto ticket",
    quote:
      "O checkout mudou o jogo. Order bump e recuperação de Pix trouxeram de volta uma receita que eu simplesmente perdia antes, todo dia.",
  },
  {
    photo: voice3,
    name: "Bruno Teixeira",
    role: "SaaS e comunidades",
    quote:
      "Integrei minha aplicação pela API em uma tarde. Webhook assinado, documentação limpa e nenhuma surpresa depois em produção.",
  },
];

export function VoicesScene() {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const active = VOICES[index];

  return (
    <section id="produtores" className="venx-cv relative overflow-hidden py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-5">
        <SectionHead kicker="Quem opera aqui" title={<>Palavras de quem já roda o dia inteiro na VENXPAY</>} />

        <div className="mt-14 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] border border-border">
            <AnimatePresence mode="wait">
              <motion.img
                key={active.name}
                src={active.photo}
                alt={`${active.name}, produtor na VENXPAY`}
                loading="lazy"
                width={1024}
                height={1280}
                initial={reduce ? false : { opacity: 0, scale: 1.06 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </AnimatePresence>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"
            />
          </div>

          <div>
            <Quote className="h-9 w-9 text-primary" />
            <AnimatePresence mode="wait">
              <motion.blockquote
                key={active.name}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="mt-6 font-heading text-[26px] font-bold leading-[1.28] text-foreground sm:text-[34px]"
              >
                “{active.quote}”
              </motion.blockquote>
            </AnimatePresence>
            <p className="mt-7 text-[15px] font-bold text-foreground">{active.name}</p>
            <p className="text-[13px] text-muted-foreground">{active.role}</p>

            <div className="mt-9 flex gap-2.5">
              {VOICES.map((v, i) => (
                <button
                  key={v.name}
                  type="button"
                  aria-label={`Ver depoimento de ${v.name}`}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-1 rounded-full transition-all duration-500",
                    i === index ? "w-14 bg-primary" : "w-7 bg-border hover:bg-primary/40",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
