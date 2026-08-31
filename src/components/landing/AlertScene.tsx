/**
 * AlertScene — a cena do alerta: o vendedor com o celular na mão recebendo
 * notificações de venda aprovada da VENXPAY, em clima cinematográfico.
 */
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import handPhone from "@/assets/landing/hand-phone.jpg";
import { PhoneApprovals } from "./device/PhoneApprovals";
import { Reveal } from "./parts";

const BEATS = [
  {
    title: "Notificação no segundo da aprovação",
    copy: "Push instantâneo no celular assim que o antifraude libera a transação — sem espera, sem F5 no painel.",
  },
  {
    title: "Pix caindo enquanto você dorme",
    copy: "Liquidação automática e saldo disponível no mesmo dia, com saque a qualquer hora, inclusive fim de semana.",
  },
  {
    title: "Cada centavo rastreável",
    copy: "Timeline completa da venda: checkout, antifraude, autorização, split e liquidação, com carimbo de tempo.",
  },
];

export function AlertScene() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-40, 60]);
  const phoneY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [50, -60]);

  return (
    <section ref={ref} id="experiencia" className="venx-cv relative overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 venx-vignette opacity-70" />

      <div className="relative mx-auto grid max-w-[1240px] items-center gap-16 px-5 lg:grid-cols-[1.05fr_0.95fr]">
        {/* cena fotográfica com o aparelho sobreposto */}
        <div className="relative mx-auto w-full max-w-[520px]">
          <motion.div style={{ y: imgY }} className="overflow-hidden rounded-[28px] border border-border">
            <img
              src={handPhone}
              alt="Produtor digital acompanhando as vendas aprovadas pelo celular"
              loading="lazy"
              width={1280}
              height={1600}
              className="h-[560px] w-full object-cover opacity-90"
            />
          </motion.div>
          <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-t from-background via-transparent to-transparent" />

          <motion.div
            style={{ y: phoneY }}
            className="absolute -right-2 top-10 w-[212px] sm:-right-8 sm:w-[236px]"
          >
            <PhoneApprovals interval={2600} />
          </motion.div>
        </div>

        <div>
          <Reveal>
            <span className="venx-kicker">o ritual do produtor</span>
            <h2 className="mt-5 text-[34px] font-extrabold text-foreground sm:text-[50px]">
              O som que você quer ouvir <span className="text-primary">o dia inteiro</span>
            </h2>
          </Reveal>

          <div className="mt-10 space-y-8">
            {BEATS.map((beat, i) => (
              <Reveal key={beat.title} delay={i * 0.08}>
                <div className="border-l border-border pl-5">
                  <p className="num text-[10.5px] uppercase tracking-[0.2em] text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-2 text-[19px] font-bold text-foreground">{beat.title}</h3>
                  <p className="mt-2 max-w-[46ch] text-[14.5px] leading-[1.7] text-muted-foreground">
                    {beat.copy}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
