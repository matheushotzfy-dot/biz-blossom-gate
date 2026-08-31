/**
 * HeroCinema — abertura cinematográfica da landing VENXPAY.
 * Palco escuro com luz volumétrica, título revelado por máscara e o produto
 * real em cena: o painel do gateway e o iPhone recebendo vendas aprovadas.
 */
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import backdrop from "@/assets/landing/cinema-backdrop.jpg";
import { GatewayWindow } from "./device/GatewayWindow";
import { PhoneApprovals } from "./device/PhoneApprovals";
import { MaskLines } from "./parts";

export function HeroCinema({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const stageY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.94]);
  const lightY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 220]);

  return (
    <section ref={ref} className="venx-grain relative overflow-hidden pb-24 pt-32 sm:pb-32 sm:pt-40">
      {/* luz volumétrica de fundo */}
      <motion.img
        src={backdrop}
        alt=""
        aria-hidden
        width={1920}
        height={1088}
        style={{ y: lightY }}
        className="pointer-events-none absolute inset-x-0 top-[-8%] h-[130%] w-full object-cover opacity-[0.55]"
      />
      <div className="pointer-events-none absolute inset-0 venx-vignette" />
      <div className="pointer-events-none absolute inset-0 venx-mesh" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-background to-transparent" />

      <div className="relative mx-auto max-w-[1240px] px-5">
        <motion.span
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="venx-kicker"
        >
          infraestrutura de pagamentos
        </motion.span>

        <MaskLines
          className="mt-6 max-w-[13ch] text-[42px] font-extrabold text-foreground sm:text-[68px] lg:text-[88px]"
          lines={["A venda entra.", <>O dinheiro <span className="text-primary">chega.</span></>]}
          delay={0.1}
        />

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="mt-7 max-w-[52ch] text-[16px] leading-[1.75] text-muted-foreground sm:text-[17.5px]"
        >
          Checkout de alta conversão, antifraude próprio e liquidação no mesmo dia.
          Você acompanha cada aprovação pelo painel — e sente cada uma no bolso.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.58 }}
          className="mt-9 flex flex-wrap items-center gap-3"
        >
          <button type="button" onClick={onSignup} className="venx-cta">
            Criar minha conta <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={onLogin} className="venx-ghost">
            Já vendo na VENXPAY
          </button>
          <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Conta aprovada em minutos
          </span>
        </motion.div>

        {/* palco do produto */}
        <motion.div
          style={{ y: stageY, scale: stageScale }}
          className="relative mt-16 sm:mt-20"
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 60, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 1.1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="venx-stage"
          >
            <GatewayWindow />
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 70, x: 24 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            transition={{ duration: 1.1, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute -bottom-16 -right-4 hidden w-[236px] xl:block"
          >
            <PhoneApprovals />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
