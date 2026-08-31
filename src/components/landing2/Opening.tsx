/**
 * Opening — abertura em tela cheia: halo esmeralda, grade técnica e título
 * revelado linha a linha. Sem cards, sem métricas de vaidade.
 */
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { CutLines, Tag } from "./bits";
import halo from "@/assets/landing-v2/halo-field.jpg";

export function Opening({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const haloY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <section ref={ref} className="relative flex min-h-dvh items-center overflow-hidden pt-24">
      <motion.div style={{ y: haloY, opacity: fade }} className="pointer-events-none absolute inset-0">
        <img
          src={halo}
          alt=""
          aria-hidden
          width={1920}
          height={1088}
          className="h-full w-full scale-125 object-cover opacity-80"
        />
        <div className="absolute inset-0 vx-grid vx-fade-edges opacity-60" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </motion.div>

      <div className="relative mx-auto w-full max-w-[1280px] px-5">
        <Tag>infraestrutura de pagamento · brasil</Tag>

        <CutLines
          delay={0.1}
          className="mt-7 text-[46px] font-extrabold text-foreground sm:text-[76px] lg:text-[104px]"
          lines={[
            <>O dinheiro entra.</>,
            <>
              E ele <span className="text-primary">não some</span> no caminho.
            </>,
          ]}
        />

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 max-w-[52ch] text-[16px] leading-[1.75] text-muted-foreground sm:text-[17px]"
        >
          Checkout, antifraude, split e liquidação operando no mesmo núcleo — com cada etapa
          visível, carimbada e conferível por você.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.62, ease: [0.16, 1, 0.3, 1] }}
          className="mt-11 flex flex-wrap items-center gap-3"
        >
          <button type="button" onClick={onSignup} className="vx-btn">
            Abrir minha conta <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={onLogin} className="vx-btn-ghost">
            Já tenho conta
          </button>
        </motion.div>

        <div className="mt-20 flex items-center gap-3 text-muted-foreground">
          <ArrowDown className="h-4 w-4 animate-bounce text-primary" />
          <span className="vx-mono">role para ver o percurso do dinheiro</span>
        </div>
      </div>
    </section>
  );
}
