/**
 * HeroScene — abertura "o dinheiro em movimento".
 * Campo de luz + malha reativa ao cursor, título em máscara e o painel real
 * flutuando em perspectiva.
 */
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, PlayCircle } from "lucide-react";
import { AuroraField } from "./AuroraField";
import { LiveConsole } from "./LiveConsole";
import { MaskLines, Reveal } from "./parts";
import aurora from "@/assets/landing/aurora-field.jpg";

export function HeroScene({ onSignup }: { onSignup: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.35 });
  const consoleY = useTransform(smooth, [0, 1], [0, -110]);
  const consoleRotate = useTransform(smooth, [0, 1], [8, -2]);
  const fade = useTransform(smooth, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="venx-grain relative isolate overflow-hidden pb-24 pt-32 sm:pb-32 sm:pt-40">
      {/* camadas de fundo */}
      <img
        src={aurora}
        alt=""
        aria-hidden
        width={1920}
        height={1088}
        className="pointer-events-none absolute inset-0 -z-30 h-full w-full object-cover opacity-[0.55]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 venx-vignette" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 venx-mesh" />
      <AuroraField className="pointer-events-none absolute inset-0 -z-10 h-full w-full" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-56 bg-gradient-to-b from-transparent to-background"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8">
        <motion.div style={reduce ? undefined : { opacity: fade }}>
          <Reveal y={12}>
            <span className="venx-kicker">Infraestrutura de pagamentos</span>
          </Reveal>

          <MaskLines
            className="mt-6 text-[44px] font-extrabold text-foreground sm:text-[64px] lg:text-[74px]"
            delay={0.1}
            lines={[
              <>O dinheiro em</>,
              <>
                movimento{" "}
                <span className="bg-gradient-to-r from-primary to-[hsl(var(--steel))] bg-clip-text text-transparent">
                  contínuo
                </span>
              </>,
            ]}
          />

          <Reveal delay={0.35} className="mt-7 max-w-xl">
            <p className="text-[16.5px] leading-[1.75] text-muted-foreground">
              A VENXPAY é a camada que recebe, autoriza, divide e liquida cada venda do seu
              produto digital. Checkout que converte, Pix aprovado em segundos e saque no
              mesmo dia — inclusive no fim de semana.
            </p>
          </Reveal>

          <Reveal delay={0.45} className="mt-9 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onSignup} className="venx-cta">
              Criar minha conta <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#motor" className="venx-ghost">
              <PlayCircle className="h-4 w-4 text-primary" /> Ver o motor rodando
            </a>
          </Reveal>

          <Reveal delay={0.55} className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
            {["Sem mensalidade", "Sem faturamento mínimo", "Aprovação em segundos"].map((item) => (
              <span key={item} className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-primary" />
                {item}
              </span>
            ))}
          </Reveal>
        </motion.div>

        {/* produto real em perspectiva */}
        <motion.div
          style={
            reduce
              ? undefined
              : { y: consoleY, rotate: consoleRotate, transformPerspective: 1400, willChange: "transform" }
          }
          initial={reduce ? false : { opacity: 0, scale: 0.94, y: 40 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div aria-hidden className="venx-orbit absolute -inset-8 hidden lg:block" />
          <LiveConsole />
        </motion.div>
      </div>
    </section>
  );
}
