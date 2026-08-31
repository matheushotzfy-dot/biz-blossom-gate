/**
 * MoneyTimeline — narrativa vertical do percurso do dinheiro. Um traço se
 * preenche conforme o scroll e cada etapa entra por corte horizontal.
 */
import { useRef } from "react";
import { motion, useInView, useReducedMotion, useScroll, useSpring } from "framer-motion";

const STEPS = [
  {
    code: "01",
    title: "Pagamento",
    copy: "Pix, cartão em até 12x ou boleto — o cliente escolhe no checkout e o pedido nasce com identificador único.",
  },
  {
    code: "02",
    title: "Antifraude",
    copy: "Score de risco, device, comportamento e histórico avaliados antes de qualquer autorização.",
  },
  {
    code: "03",
    title: "Aprovação",
    copy: "Confirmação em segundos, push no celular e liberação imediata do acesso ao produto ou à área de membros.",
  },
  {
    code: "04",
    title: "Split",
    copy: "Afiliado, coprodutor e produtor creditados no mesmo instante, cada um no próprio saldo, sem planilha.",
  },
  {
    code: "05",
    title: "Liquidação",
    copy: "Saldo disponível para saque com extrato por lançamento — inclusive fim de semana e feriado.",
  },
];

function Step({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduce = useReducedMotion();

  return (
    <li ref={ref} className="relative pl-12 sm:pl-20">
      <motion.span
        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
        animate={inView ? { scale: 1, opacity: 1 } : undefined}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-[-4.5px] top-3 h-2.5 w-2.5 rounded-full bg-primary sm:left-[-5px]"
      />
      <div className="overflow-hidden">
        <motion.div
          initial={reduce ? false : { x: -28, opacity: 0 }}
          animate={inView ? { x: 0, opacity: 1 } : undefined}
          transition={{ duration: 0.75, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="vx-mono">{step.code}</span>
          <h3 className="mt-3 text-[30px] font-extrabold text-foreground sm:text-[42px]">{step.title}</h3>
          <p className="mt-3 max-w-[54ch] text-[14.5px] leading-[1.75] text-muted-foreground">{step.copy}</p>
        </motion.div>
      </div>
    </li>
  );
}

export function MoneyTimeline() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 80%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });

  return (
    <section ref={ref} id="fluxo" className="vx-cv relative py-28 sm:py-40">
      <div className="mx-auto max-w-[1280px] px-5">
        <span className="vx-mono">o percurso</span>
        <h2 className="mt-5 max-w-[16ch] text-[38px] font-extrabold text-foreground sm:text-[62px]">
          Cinco etapas. Nenhuma delas às escuras.
        </h2>

        <ol className="relative mt-20 space-y-20 border-l border-border sm:space-y-28">
          <motion.span
            style={{ scaleY: fill }}
            className="absolute -left-px top-0 h-full w-px origin-top bg-primary"
            aria-hidden
          />
          {STEPS.map((s, i) => (
            <Step key={s.code} step={s} index={i} />
          ))}
        </ol>
      </div>
    </section>
  );
}
